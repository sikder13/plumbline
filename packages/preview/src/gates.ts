import { execFile } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';
import { AxeBuilder } from '@axe-core/playwright';
import { chromium, type Browser } from 'playwright';
import { median } from '@plumbline/core';
import { scanPage, splitPage, ownSiteHtml, ownSiteText, type CopyIssue } from './copy.ts';
import { BASE_PATH } from './build.ts';
import { previewPaths } from './paths.ts';
import type { PageData } from './types.ts';

const WORKER = join(dirname(fileURLToPath(import.meta.url)), 'lighthouse-page.mjs');

const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.txt': 'text/plain', '.svg': 'image/svg+xml', '.avif': 'image/avif', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

/** Serves the built site from this machine, compressed the way the host compresses it, for checks before a deploy. */
export function serveSite(dir: string = previewPaths.site, port = 4321): Promise<{ server: Server; base: string }> {
  const server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0]!);
    let file = normalize(join(dir, path));
    if (!file.startsWith(dir)) return void res.writeHead(403).end();
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
      const missing = join(dir, '404.html');
      res.writeHead(404, { 'content-type': TYPES['.html'] });
      return void res.end(existsSync(missing) ? readFileSync(missing) : 'Not found');
    }
    const type = TYPES[extname(file)] ?? 'application/octet-stream';
    const compress = /text|javascript|json|svg/.test(type) && /gzip/.test(String(req.headers['accept-encoding'] ?? ''));
    res.writeHead(200, { 'content-type': type, 'cache-control': extname(file) === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable', ...(compress ? { 'content-encoding': 'gzip' } : {}) });
    if (compress) createReadStream(file).pipe(createGzip()).pipe(res);
    else createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${port}` })));
}

interface LighthouseRun {
  error?: string;
  version?: string;
  performance?: number | null;
  accessibility?: number | null;
  lcpMs?: number | null;
  cls?: number | null;
  tbtMs?: number | null;
  failedAccessibility?: string[];
}

function lighthouseOnce(url: string): Promise<LighthouseRun> {
  return new Promise((resolve) => {
    execFile(process.execPath, [WORKER, url, chromium.executablePath()], { timeout: 150_000, maxBuffer: 16 * 1024 * 1024, killSignal: 'SIGKILL' }, (err, stdout) => {
      const line = stdout.split('\n').find((l) => l.startsWith('PLUMBLINE_LH '));
      if (line) {
        try {
          return resolve(JSON.parse(line.slice('PLUMBLINE_LH '.length)) as LighthouseRun);
        } catch {
          // Fall through to the error below.
        }
      }
      resolve({ error: err ? err.message.split('\n')[0]!.slice(0, 200) : 'no result' });
    });
  });
}

export interface LinkCheck {
  kind: 'booking' | 'tel' | 'mailto' | 'anchor' | 'external';
  label: string;
  href: string;
  ok: boolean;
  note: string;
}

export interface GateReport {
  slug: string;
  url: string;
  lighthouse: { performance: number | null; accessibility: number | null; lcpMs: number | null; cls: number | null; tbtMs: number | null; runs: LighthouseRun[] };
  axe: { tab: string; id: string; impact: string; help: string; nodes: number; first: string }[];
  overflow: { width: number; tab: string; scrollWidth: number }[];
  links: LinkCheck[];
  copy: CopyIssue[];
  screenshots: string[];
  failures: string[];
}

export const LIMITS = { performance: 90, accessibility: 95, lcpMs: 2500 };
const WIDTHS = [360, 390, 430];
const TABS = [
  { name: 'demo', hash: '' },
  { name: 'found', hash: '#found' },
];

function med(values: (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => typeof x === 'number');
  return v.length ? median(v) : null;
}

/** A New Zealand number in international form: +64, then eight to ten digits. */
export function validTel(href: string): boolean {
  return /^tel:\+64[2-9]\d{7,9}$/.test(href);
}

export function validMailto(href: string): boolean {
  const m = /^mailto:([^?]+)(\?.*)?$/.exec(href);
  return !!m && /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(decodeURIComponent(m[1]!));
}

async function checkLinks(browser: Browser, url: string, bookingHosts: RegExp, ownSiteHtml: string): Promise<LinkCheck[]> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load' });
  const found = await page.evaluate(() => {
    const ids = new Set([...document.querySelectorAll('[id]')].map((e) => e.id));
    return [...document.querySelectorAll('a[href]')].map((a) => {
      const raw = a.getAttribute('href') ?? '';
      return { href: raw, label: (a.textContent ?? '').replace(/\s+/g, ' ').trim() || a.getAttribute('aria-label') || '', anchorOk: raw.startsWith('#') ? raw === '#' ? false : ids.has(raw.slice(1)) : null };
    });
  });
  await ctx.close();
  const out: LinkCheck[] = [];
  const seen = new Map<string, LinkCheck>();
  for (const l of found) {
    const key = l.href;
    const prior = seen.get(key);
    if (prior) {
      out.push({ ...prior, label: l.label });
      continue;
    }
    let check: LinkCheck;
    if (l.href.startsWith('tel:')) check = { kind: 'tel', label: l.label, href: l.href, ok: validTel(l.href), note: validTel(l.href) ? 'valid number' : 'not a valid number' };
    else if (l.href.startsWith('mailto:')) check = { kind: 'mailto', label: l.label, href: l.href, ok: validMailto(l.href), note: validMailto(l.href) ? 'valid address' : 'not a valid address' };
    else if (l.href.startsWith('#')) check = { kind: 'anchor', label: l.label, href: l.href, ok: !!l.anchorOk, note: l.anchorOk ? 'target exists' : 'no element with that id' };
    else if (/^https?:/.test(l.href)) {
      // Opened in a real browser, the way a visitor's tap opens it.
      const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const p = await c.newPage();
      let status: number | null = null;
      let title: string;
      let final = l.href;
      try {
        const res = await p.goto(l.href, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        status = res?.status() ?? null;
        final = p.url();
        title = (await p.title()).slice(0, 80);
      } catch (e) {
        title = (e as Error).message.split('\n')[0]!.slice(0, 80);
      }
      await c.close();
      const booking = bookingHosts.test(l.href);
      // Booking systems turn automated visits away. That is not worked around: the link then passes
      // only when it is, character for character, a link the business's own site sends visitors to.
      const turnedAway = booking && status === 403;
      const theirs = ownSiteHtml.includes(l.href.replace(/&/g, '&amp;')) || ownSiteHtml.includes(l.href);
      const ok = (status !== null && status < 400) || (turnedAway && theirs);
      const note = turnedAway ? (theirs ? 'the booking system refuses automated visits (403); the link is the same one their own site uses, and needs one tap by a person' : 'the booking system refuses automated visits (403) and the link is not found on their own site') : `${status ?? 'no answer'} ${final !== l.href ? `-> ${final} ` : ''}"${title}"`;
      check = { kind: booking ? 'booking' : 'external', label: l.label, href: l.href, ok, note };
    } else check = { kind: 'external', label: l.label, href: l.href, ok: false, note: 'not a web, phone, email or in-page link' };
    seen.set(key, check);
    out.push(check);
  }
  return out;
}

export interface CheckOptions {
  /** Where the pages are served: the live address, or a local server. */
  base: string;
  /** The text of our own offer, whose numbers are ours to state. */
  offerText: string;
  lighthouseRuns?: number;
  skipLighthouse?: boolean;
  log?: (line: string) => void;
}

/** Runs every gate for one page and saves the review screenshots. */
export async function checkPage(data: PageData, opts: CheckOptions): Promise<GateReport> {
  const url = `${opts.base}${BASE_PATH}/${data.path}/`;
  const log = opts.log ?? (() => undefined);
  const failures: string[] = [];

  const runs: LighthouseRun[] = [];
  if (!opts.skipLighthouse) {
    for (let i = 0; i < (opts.lighthouseRuns ?? 3); i++) {
      runs.push(await lighthouseOnce(url));
      log(`  lighthouse run ${i + 1}: ${runs[i]!.error ?? `performance ${runs[i]!.performance}, accessibility ${runs[i]!.accessibility}, LCP ${((runs[i]!.lcpMs ?? 0) / 1000).toFixed(2)} s`}`);
    }
  }
  const lighthouse = { performance: med(runs.map((r) => r.performance)), accessibility: med(runs.map((r) => r.accessibility)), lcpMs: med(runs.map((r) => r.lcpMs)), cls: med(runs.map((r) => r.cls)), tbtMs: med(runs.map((r) => r.tbtMs)), runs };
  if (!opts.skipLighthouse) {
    if (lighthouse.performance === null || lighthouse.performance < LIMITS.performance) failures.push(`performance ${lighthouse.performance ?? 'not measured'} is under ${LIMITS.performance}`);
    if (lighthouse.accessibility === null || lighthouse.accessibility < LIMITS.accessibility) failures.push(`accessibility ${lighthouse.accessibility ?? 'not measured'} is under ${LIMITS.accessibility}`);
    if (lighthouse.lcpMs === null || lighthouse.lcpMs >= LIMITS.lcpMs) failures.push(`largest contentful paint ${lighthouse.lcpMs === null ? 'not measured' : `${(lighthouse.lcpMs / 1000).toFixed(2)} s`} is not under ${LIMITS.lcpMs / 1000} s`);
  }

  const browser = await chromium.launch();
  const overflow: GateReport['overflow'] = [];
  const axe: GateReport['axe'] = [];
  const screenshots: string[] = [];
  const reviewDir = join(previewPaths.review, data.slug);
  mkdirSync(reviewDir, { recursive: true });
  let html = '';
  try {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      for (const tab of TABS) {
        await page.goto(`${url}${tab.hash}`, { waitUntil: 'networkidle' });
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(300);
        const scrollWidth = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
        if (scrollWidth > width) overflow.push({ width, tab: tab.name, scrollWidth });
      }
      await ctx.close();
    }
    for (const o of overflow) failures.push(`the ${o.tab} tab scrolls sideways at ${o.width} px (content is ${o.scrollWidth} px wide)`);

    for (const width of [390, 1440]) {
      const ctx = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, deviceScaleFactor: width === 390 ? 2 : 1, isMobile: width === 390, hasTouch: width === 390, reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      for (const tab of TABS) {
        await page.goto(`${url}${tab.hash}`, { waitUntil: 'networkidle' });
        if (!html) html = await page.content();
        // Lazy images load as they come into view, so the page is walked once before the picture is taken.
        await page.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += 600) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 80));
          }
          window.scrollTo(0, 0);
        });
        await page.waitForLoadState('networkidle');
        const results = await new AxeBuilder({ page }).analyze();
        for (const v of results.violations) if (v.impact === 'serious' || v.impact === 'critical') axe.push({ tab: `${tab.name} ${width}`, id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, first: v.nodes[0]?.html.slice(0, 200) ?? '' });
        const file = join(reviewDir, `${tab.name}-${width}.png`);
        await page.screenshot({ path: file, fullPage: true });
        screenshots.push(file);
      }
      await ctx.close();
    }
    for (const v of axe) failures.push(`axe ${v.impact}: ${v.id} on ${v.tab} (${v.nodes} elements) ${v.first}`);

    const links = await checkLinks(browser, url, /rezdy|fareharbor|lodgify|bookeo|checkfront/i, ownSiteHtml(data.slug));
    for (const l of links.filter((x) => !x.ok)) failures.push(`link "${l.label}" ${l.href}: ${l.note}`);
    if (!links.some((l) => l.kind === 'tel')) failures.push('no tap to call link on the page');
    if (!links.some((l) => l.kind === 'mailto')) failures.push('no email link on the page');

    const copy = scanPage(splitPage(html), { ownSite: ownSiteText(data.slug), measured: JSON.stringify({ findings: data.findings, strengths: data.strengths, secondCheck: data.secondCheck }), offer: opts.offerText });
    for (const c of copy) failures.push(`copy ${c.kind} in ${c.where}: "${c.text}" in "${c.context}"`);
    return { slug: data.slug, url, lighthouse, axe, overflow, links, copy, screenshots, failures };
  } finally {
    await browser.close();
  }
}
