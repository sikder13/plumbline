import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { AxeBuilder } from '@axe-core/playwright';
import { chromium, type Browser, type Page } from 'playwright';
import { median } from '@plumbline/core';
import { BANNED_WORDS } from '@plumbline/impact';
import { dashIssues, numbersIn, visibleText } from './copy.ts';
import { BASE_PATH } from './build.ts';
import { checkBeacon, lighthouseOnce, quietContext, validMailto, type LighthouseRun } from './gates.ts';
import type { PageData } from './types.ts';

/** The words the Open Sign relay names, on top of the library's list. */
const AI_WORDS = [...new Set([...BANNED_WORDS, 'empower', 'leverage', 'unlock', 'transform', 'harness', 'cutting-edge', 'innovative', 'world-class', 'solutions', 'forward-thinking'])];
const PLACEHOLDER = /\b(lorem|ipsum|placeholder|todo|tbd|xxx|coming soon)\b/gi;
/** A US phone number as a page writes it; its hyphen is part of the number, not a dash in a sentence. */
const US_PHONE = /\(\d{3}\)\s?\d{3}-\d{4}/g;

export const OPEN_SIGN_LIMITS = { performance: 85, accessibility: 95, lcpMs: 2500, cls: 0.05, tbtMs: 200 };

/** A US number in international form: +1, then ten digits. */
export function usTel(href: string): boolean {
  return /^tel:\+1[2-9]\d{9}$/.test(href);
}

export interface OpenSignIssue {
  kind: 'dash' | 'banned' | 'placeholder' | 'number';
  where: string;
  text: string;
  context: string;
}

/**
 * The copy rules for an Open Sign page: no dash inside a sentence, no AI words, no placeholder, and
 * no figure that is not among the facts the page was given (their address, phone and hours, and our price).
 */
export function openSignCopy(text: string, allowed: Set<string>, where = 'page'): OpenSignIssue[] {
  const plain = text.replace(US_PHONE, (m) => m.replace(/-/g, ' '));
  const around = (i: number, n: number) => plain.slice(Math.max(0, i - 30), i + n + 30);
  const out: OpenSignIssue[] = dashIssues(plain, where).map((d) => ({ ...d, kind: 'dash' as const }));
  for (const word of AI_WORDS) for (const m of plain.matchAll(new RegExp(`\\b${word.replace('-', '[- ]?')}\\w*`, 'gi'))) out.push({ kind: 'banned', where, text: m[0], context: around(m.index, m[0].length) });
  for (const m of plain.matchAll(PLACEHOLDER)) out.push({ kind: 'placeholder', where, text: m[0], context: around(m.index, m[0].length) });
  for (const n of numbersIn(plain)) if (!allowed.has(n.token)) out.push({ kind: 'number', where, text: n.token, context: around(n.index, n.token.length) });
  return out;
}

export interface OpenSignReport {
  slug: string;
  url: string;
  lighthouse: { performance: number | null; accessibility: number | null; lcpMs: number | null; cls: number | null; tbtMs: number | null; runs: LighthouseRun[] };
  axe: { tab: string; id: string; impact: string; nodes: number; first: string }[];
  overflow: { width: number; tab: string; scrollWidth: number }[];
  links: { href: string; label: string; ok: boolean; note: string }[];
  beacon: { early: number; views: number; tokens: string[]; ok: boolean };
  reducedMotion: { animated: number; ok: boolean };
  copy: OpenSignIssue[];
  screenshots: string[];
  failures: string[];
}

function med(values: (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => typeof x === 'number');
  return v.length ? median(v) : null;
}

async function walk(page: Page): Promise<void> {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 160));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(600);
}

/**
 * Every gate for one Open Sign page, served from this machine. Each browser marks itself as ours and
 * answers the visit report locally, so no check is ever counted as a visit.
 */
export async function checkOpenSignPage(data: PageData, opts: { base: string; allowed: Set<string>; shotsDir: string; previewDir?: string; lighthouseRuns?: number; log?: (line: string) => void }): Promise<OpenSignReport> {
  const url = `${opts.base}${BASE_PATH}/${data.path}/`;
  const log = opts.log ?? (() => undefined);
  const failures: string[] = [];
  const runs: LighthouseRun[] = [];
  for (let i = 0; i < (opts.lighthouseRuns ?? 3); i++) {
    runs.push(await lighthouseOnce(url));
    const r = runs[i]!;
    log(`  lighthouse ${i + 1}: ${r.error ?? `performance ${r.performance}, accessibility ${r.accessibility}, LCP ${((r.lcpMs ?? 0) / 1000).toFixed(2)} s, CLS ${(r.cls ?? 0).toFixed(3)}, TBT ${Math.round(r.tbtMs ?? 0)} ms`}`);
  }
  const lighthouse = { performance: med(runs.map((r) => r.performance)), accessibility: med(runs.map((r) => r.accessibility)), lcpMs: med(runs.map((r) => r.lcpMs)), cls: med(runs.map((r) => r.cls)), tbtMs: med(runs.map((r) => r.tbtMs)), runs };
  const L = OPEN_SIGN_LIMITS;
  if (runs.length) {
    if ((lighthouse.performance ?? 0) < L.performance) failures.push(`performance ${lighthouse.performance} is under ${L.performance}`);
    if ((lighthouse.accessibility ?? 0) < L.accessibility) failures.push(`accessibility ${lighthouse.accessibility} is under ${L.accessibility}`);
    if (lighthouse.lcpMs === null || lighthouse.lcpMs >= L.lcpMs) failures.push(`LCP ${((lighthouse.lcpMs ?? 0) / 1000).toFixed(2)} s is not under 2.5 s`);
    if (lighthouse.cls === null || lighthouse.cls >= L.cls) failures.push(`CLS ${lighthouse.cls} is not under 0.05`);
    if (lighthouse.tbtMs === null || lighthouse.tbtMs >= L.tbtMs) failures.push(`TBT ${Math.round(lighthouse.tbtMs ?? 0)} ms is not under 200 ms`);
  }

  const browser: Browser = await chromium.launch();
  const overflow: OpenSignReport['overflow'] = [];
  const axe: OpenSignReport['axe'] = [];
  const screenshots: string[] = [];
  const texts: { tab: string; text: string }[] = [];
  mkdirSync(opts.shotsDir, { recursive: true });
  try {
    for (const width of [360, 1440]) {
      const ctx = await quietContext(browser, { viewport: { width, height: 800 }, deviceScaleFactor: 1, isMobile: width < 900, hasTouch: width < 900 });
      const page = await ctx.newPage();
      for (const tab of ['', '#found']) {
        await page.goto(`${url}${tab}`, { waitUntil: 'networkidle' });
        await walk(page);
        const sw = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
        if (sw > width) overflow.push({ width, tab: tab ? 'price' : 'demo', scrollWidth: sw });
      }
      await ctx.close();
    }
    for (const o of overflow) failures.push(`the ${o.tab} tab scrolls sideways at ${o.width} px (${o.scrollWidth} px wide)`);

    for (const width of [390, 1440]) {
      const ctx = await quietContext(browser, { viewport: { width, height: width === 390 ? 844 : 900 }, deviceScaleFactor: width === 390 ? 2 : 1, isMobile: width === 390, hasTouch: width === 390, reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      for (const tab of ['', '#found']) {
        const name = tab ? 'price' : 'demo';
        await page.goto(`${url}${tab}`, { waitUntil: 'networkidle' });
        await walk(page);
        await page.waitForLoadState('networkidle');
        const results = await new AxeBuilder({ page }).analyze();
        for (const v of results.violations) if (v.impact === 'serious' || v.impact === 'critical') axe.push({ tab: `${name} ${width}`, id: v.id, impact: v.impact, nodes: v.nodes.length, first: v.nodes[0]?.html.slice(0, 160) ?? '' });
        if (width === 390) texts.push({ tab: name, text: visibleText(await page.content()) });
        const file = join(opts.shotsDir, `${name}-${width}.png`);
        await page.screenshot({ path: file, fullPage: true });
        screenshots.push(file);
        if (!tab && opts.previewDir) {
          const first = join(opts.previewDir, width === 390 ? 'preview-mobile.png' : 'preview-desktop.png');
          await page.screenshot({ path: first, fullPage: true });
          screenshots.push(first);
        }
      }
      await ctx.close();
    }
    for (const v of axe) failures.push(`axe ${v.impact} ${v.id} on ${v.tab} (${v.nodes}): ${v.first}`);

    // With reduced motion asked for, nothing may still be moving once the page has settled.
    const rmCtx = await quietContext(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const rmPage = await rmCtx.newPage();
    await rmPage.goto(url, { waitUntil: 'networkidle' });
    await rmPage.waitForTimeout(1500);
    const animated = await rmPage.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && Number(a.effect?.getComputedTiming().duration ?? 0) > 50).length);
    await rmCtx.close();
    const reducedMotion = { animated, ok: animated === 0 };
    if (!reducedMotion.ok) failures.push(`${animated} animation(s) still run with reduced motion asked for`);

    // Links: phone, email, in-page, and every web address opened as a visitor's tap opens it.
    const lctx = await quietContext(browser, { viewport: { width: 390, height: 844 } });
    const lpage = await lctx.newPage();
    await lpage.goto(url, { waitUntil: 'load' });
    const found = await lpage.evaluate(() => {
      const ids = new Set([...document.querySelectorAll('[id]')].map((e) => e.id));
      return [...document.querySelectorAll('a[href]')].map((a) => ({ href: a.getAttribute('href') ?? '', label: (a.textContent ?? '').replace(/\s+/g, ' ').trim() || a.getAttribute('aria-label') || '', anchor: (a.getAttribute('href') ?? '').startsWith('#') ? ids.has((a.getAttribute('href') ?? '').slice(1)) : null }));
    });
    await lctx.close();
    const links: OpenSignReport['links'] = [];
    const seen = new Map<string, { ok: boolean; note: string }>();
    for (const l of found) {
      let r = seen.get(l.href);
      if (!r) {
        if (l.href.startsWith('tel:')) r = { ok: usTel(l.href), note: usTel(l.href) ? 'valid US number' : 'not a valid US number' };
        else if (l.href.startsWith('mailto:')) r = { ok: validMailto(l.href), note: validMailto(l.href) ? 'valid address' : 'not a valid address' };
        else if (l.href.startsWith('#')) r = { ok: !!l.anchor, note: l.anchor ? 'target exists' : 'no element with that id' };
        else if (/^https?:/.test(l.href)) {
          const c = await quietContext(browser, { viewport: { width: 390, height: 844 } });
          const p = await c.newPage();
          try {
            const res = await p.goto(l.href, { waitUntil: 'domcontentloaded', timeout: 30_000 });
            const status = res?.status() ?? 0;
            r = { ok: status > 0 && status < 400, note: `${status} ${p.url().slice(0, 70)}` };
          } catch (e) {
            r = { ok: false, note: (e as Error).message.split('\n')[0]!.slice(0, 90) };
          }
          await c.close();
        } else r = { ok: false, note: 'not a web, phone, email or in-page link' };
        seen.set(l.href, r);
      }
      links.push({ href: l.href, label: l.label, ...r });
    }
    for (const l of links.filter((x) => !x.ok)) failures.push(`link "${l.label}" ${l.href}: ${l.note}`);
    if (!links.some((l) => l.href.startsWith('tel:'))) failures.push('no call link');
    if (!links.some((l) => /maps\.google\.com|google\.com\/maps/.test(l.href))) failures.push('no directions link');

    const beacon = await checkBeacon(browser, url, data.path);
    if (!beacon.ok) failures.push(`visit report: ${beacon.early} early, ${beacon.views} view(s), tokens ${beacon.tokens.join(', ') || 'none'}`);

    const copy = texts.flatMap((t) => openSignCopy(t.text, opts.allowed, t.tab));
    for (const c of copy) failures.push(`copy ${c.kind} in ${c.where}: "${c.text}" in "${c.context.replace(/\s+/g, ' ')}"`);
    return { slug: data.slug, url, lighthouse, axe, overflow, links, beacon, reducedMotion, copy, screenshots, failures };
  } finally {
    await browser.close();
  }
}
