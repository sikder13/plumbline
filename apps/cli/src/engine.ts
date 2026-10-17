import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Command } from 'commander';
import pLimit from 'p-limit';
import { ROOT, env, median, paths, utcIso } from '@plumbline/core';
import { captureBrand, type BrandCapture } from '@plumbline/brand';
import { fingerprintUrl } from '@plumbline/collect';
import { HostLimiter, Polite, RobotsCache } from '@plumbline/fetch';
import { Renderer, type PageCapture } from '@plumbline/render';
import { AxeBuilder } from '@axe-core/playwright';
import { BASE_PATH, ENGINES, EngineConfig, buildEngineSample, checkBeacon, checkLinks, contentDir, engineLook, engineVarietyIssues, gradeEnginePhotos, heroFor, lighthouseOnce, paletteChecks, paletteFrom, previewPaths, quietContext, rankPhotos, scanPage, serveSite, splitPage, swatchesOf, type EngineName, type GradedIndex, type LighthouseRun, type Look, type PageData, type Swatch } from '@plumbline/preview';
import { chromium } from 'playwright';
import { collectPhotos, fullSize, imageUrlsIn, type FoundImage } from '@plumbline/wave';
import sharp from 'sharp';
import { parseCsv } from './csv.ts';
import { scriptsAfterPaint } from './preview.ts';

/**
 * Sample pages for the four page engines. Everything here reads a business's homepage and keeps it
 * under data/wave-4/design-samples/<slug>/. Nothing is stored in the database and nothing is audited.
 */
export const SAMPLES_DIR = join(paths.data, 'wave-4', 'design-samples');

export interface PulledBlock {
  text: string;
  tag: string;
  heading: string | null;
  href: string | null;
}

export interface Pulled {
  at: string;
  slug: string;
  url: string;
  finalUrl: string;
  title: string;
  description: string | null;
  /** The homepage's own words in reading order, without the menu and with each block once. */
  blocks: PulledBlock[];
  footer: string[];
  links: { tel: string[]; mailto: string[]; booking: { href: string; text: string; system: string }[]; other: { href: string; text: string }[] };
  brand: { logo: string | null; logoFrom: string | null; colours: BrandCapture['colours']; fonts: BrandCapture['fonts'] | null };
  photos: { file: string | null; url: string; alt: string; width: number; height: number; sharpness: number; entropy: number; kind: string; bytes: number }[];
}

function ownText(cap: PageCapture): { blocks: PulledBlock[]; footer: string[] } {
  const seen = new Set<string>();
  const blocks: PulledBlock[] = [];
  const footer: string[] = [];
  for (const b of cap.blocks) {
    const text = b.text.replace(/\s+/g, ' ').trim();
    if (!text || b.inNav) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (b.inFooter) footer.push(text);
    else blocks.push({ text, tag: b.tag, heading: b.heading, href: b.href });
  }
  return { blocks, footer };
}

function linksOf(cap: PageCapture): Pulled['links'] {
  const out: Pulled['links'] = { tel: [], mailto: [], booking: [], other: [] };
  const add = <T>(list: T[], item: T, key: (x: T) => string) => void (list.some((x) => key(x) === key(item)) || list.push(item));
  for (const l of cap.links) {
    const href = l.href || l.raw;
    if (/^tel:/i.test(href)) add(out.tel, href, (x) => x);
    else if (/^mailto:/i.test(href)) add(out.mailto, href, (x) => x);
    else if (/^https?:/i.test(href)) {
      const fp = fingerprintUrl(href);
      if (fp) add(out.booking, { href, text: l.text.trim(), system: fp.system }, (x) => x.href);
      else add(out.other, { href, text: l.text.trim() }, (x) => x.href);
    }
  }
  return out;
}

/** Reads one homepage at phone and desktop size, with its logo, colours, fonts and photos. */
export async function pullSample(renderer: Renderer, polite: Polite, slug: string, url: string): Promise<Pulled> {
  const dir = join(SAMPLES_DIR, slug);
  mkdirSync(dir, { recursive: true });
  let brand: BrandCapture | null = null;
  const caps: PageCapture[] = [];
  const rendered: { url: string; alt: string; pageUrl: string }[] = [];
  for (const viewport of ['desktop', 'mobile'] as const) {
    const cap = await renderer.render({
      url,
      viewport,
      outDir: join(dir, `page-${viewport}`),
      screenshots: false,
      onPage: async (page) => {
        if (viewport === 'desktop') brand = await captureBrand(page, viewport, join(dir, 'brand'));
        // Pictures a script put in place, and backgrounds set in stylesheets, are not in the saved HTML.
        const seen = await page.evaluate(() => {
          const out: { url: string; alt: string }[] = [];
          for (const img of document.querySelectorAll('img')) if (img.currentSrc) out.push({ url: img.currentSrc, alt: img.alt || '' });
          for (const el of document.querySelectorAll<HTMLElement>('body *')) {
            const bg = getComputedStyle(el).backgroundImage;
            for (const m of bg.matchAll(/url\(["']?([^"')]+)["']?\)/g)) if (m[1] && !m[1].startsWith('data:')) out.push({ url: m[1], alt: el.getAttribute('aria-label') ?? '' });
          }
          return out;
        });
        for (const x of seen) rendered.push({ ...x, pageUrl: url });
      },
    });
    if (cap.ok) caps.push(cap);
  }
  const main = caps[0];
  if (!main) throw new Error(`${slug}: the homepage did not load`);
  const html = main.htmlFile && existsSync(main.htmlFile) ? readFileSync(main.htmlFile, 'utf8') : '';
  const found = new Map<string, FoundImage>();
  for (const cap of caps) {
    const h = cap.htmlFile && existsSync(cap.htmlFile) ? readFileSync(cap.htmlFile, 'utf8') : html;
    for (const f of imageUrlsIn(h, cap.finalUrl)) if (!found.has(f.url)) found.set(f.url, f);
  }
  for (const r of rendered) {
    if (/\.svg(\?|$)/i.test(r.url)) continue;
    const big = fullSize(r.url);
    if (!found.has(big)) found.set(big, { url: big, asFound: r.url, alt: r.alt, pageUrl: r.pageUrl });
  }
  const b = brand as BrandCapture | null;
  for (const i of b?.images ?? []) if (/^https?:/.test(i.url) && !found.has(fullSize(i.url))) found.set(fullSize(i.url), { url: fullSize(i.url), asFound: i.url, alt: i.alt, pageUrl: url });
  const photos = await collectPhotos(polite, [...found.values()], join(dir, 'photos'), { max: 60, keepFromWidth: 640 });
  const { blocks, footer } = ownText(main);
  const pulled: Pulled = {
    at: utcIso(),
    slug,
    url,
    finalUrl: main.finalUrl,
    title: main.meta.title,
    description: main.meta.description,
    blocks,
    footer,
    links: linksOf(main),
    brand: { logo: b?.logoPath ?? null, logoFrom: b?.logoSourceUrl ?? null, colours: b?.colours ?? [], fonts: b?.fonts ?? null },
    photos: photos.map((p) => ({ file: p.file, url: p.url, alt: p.alt, width: p.width, height: p.height, sharpness: p.sharpness, entropy: p.entropy, kind: p.kind, bytes: p.bytes })),
  };
  writeFileSync(join(dir, 'pull.json'), JSON.stringify(pulled, null, 2));
  // The words alone, for reading and for the copy gate: every figure on a sample page must be found here.
  writeFileSync(join(dir, 'text.txt'), [main.meta.title, main.meta.description ?? '', ...blocks.map((x) => x.text), ...footer].join('\n'));
  return pulled;
}

/** Where the sample pages are built: local only, under previews/ like every other page. */
export const SAMPLE_OUT = join(ROOT, 'previews', 'engine-samples');
export const SAMPLE_TOKEN = 'sample';
const REPLY_EMAIL = 'udaay@nahltech.com';

export function sampleSlugs(): string[] {
  if (!existsSync(SAMPLES_DIR)) return [];
  return readdirSync(SAMPLES_DIR).filter((d) => existsSync(join(SAMPLES_DIR, d, 'config.json'))).sort();
}

/** Grades a sample's photos and writes its page data. Nothing is read from or written to the database. */
export async function buildSample(slug: string): Promise<PageData> {
  const dir = join(SAMPLES_DIR, slug);
  const config = EngineConfig.parse(JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8')));
  // Each picked photo's sharpness score is logged as it is graded.
  await gradeEnginePhotos(config, dir, (line) => console.log(`${slug}${line}`));
  const call = env().CAL_LINK || `mailto:${REPLY_EMAIL}?subject=${encodeURIComponent('15 minute call')}`;
  const path = `${slug}-${SAMPLE_TOKEN}`;
  const data = await buildEngineSample(config, { media: dir, assets: join(SAMPLE_OUT, 'assets', path), urlBase: `${BASE_PATH}/${path}`, reply: { email: REPLY_EMAIL, subject: `${config.name} website`, call }, token: SAMPLE_TOKEN });
  mkdirSync(join(SAMPLE_OUT, 'data'), { recursive: true });
  writeFileSync(join(SAMPLE_OUT, 'data', `${slug}.json`), JSON.stringify(data, null, 2));
  return data;
}

/** Builds the site of sample pages into previews/engine-samples/site, served the way the host serves the real ones. */
export function buildSampleSite(): void {
  const app = previewPaths.app;
  execFileSync(process.execPath, [join(app, 'scripts', 'fonts.mjs')], { cwd: app, stdio: 'inherit' });
  execFileSync(join(app, 'node_modules', '.bin', 'next'), ['build'], { cwd: app, stdio: 'inherit', env: { ...process.env, PREVIEWS_DATA: join(SAMPLE_OUT, 'data'), NEXT_TELEMETRY_DISABLED: '1' } });
  const site = join(SAMPLE_OUT, 'site');
  const served = join(site, BASE_PATH);
  rmSync(site, { recursive: true, force: true });
  cpSync(join(app, 'out'), served, { recursive: true, dereference: true });
  for (const f of readdirSync(join(SAMPLE_OUT, 'data'))) {
    const page = JSON.parse(readFileSync(join(SAMPLE_OUT, 'data', f), 'utf8')) as PageData;
    const assets = join(SAMPLE_OUT, 'assets', page.path);
    if (existsSync(assets)) cpSync(assets, join(served, page.path), { recursive: true, filter: (from) => !from.endsWith('.made') });
    const html = join(served, page.path, 'index.html');
    writeFileSync(html, scriptsAfterPaint(readFileSync(html, 'utf8')));
  }
  writeFileSync(join(site, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
}

/**
 * Phone screenshots of one page, 390 wide, as small JPEGs: the first three screens and one from the
 * middle. The visit report is answered in the browser and never reaches the real address.
 */
export async function phoneShots(url: string, out: string, name: string, opts: { screens?: number; mid?: boolean } = {}): Promise<string[]> {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const files: string[] = [];
  try {
    const ctx = await quietContext(browser, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(2600);
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    const stops = Array.from({ length: opts.screens ?? 3 }, (_, i) => i * 844);
    if (opts.mid !== false) stops.push(Math.round(height / 2));
    for (const [i, y] of stops.entries()) {
      // Scrolled in steps, as a thumb would, so what waits to be scrolled to has arrived.
      const from = await page.evaluate(() => window.scrollY);
      for (let k = 1; k <= 6; k++) await page.evaluate((to) => window.scrollTo(0, to), Math.round(from + ((y - from) * k) / 6)).then(() => page.waitForTimeout(120));
      await page.waitForTimeout(1400);
      const file = join(out, `${name}-${i < (opts.screens ?? 3) ? `screen${i + 1}` : 'mid'}.jpg`);
      await page.screenshot({ path: file, type: 'jpeg', quality: 72 });
      files.push(file);
    }
    await ctx.close();
  } finally {
    await browser.close();
  }
  return files;
}

/**
 * The type scale, the labels and the pacing of the standard, measured in the page as a visitor gets
 * it. Only h1 and h2 may be set at display sizes. Running text (60 characters or more in a
 * paragraph, item or definition) stays at 22 px on a phone and 24 px on a desktop, and at most about
 * 72 characters a line; any other text stays at 28 px and 36 px. Words in the signature section are
 * 14 px or more and never turned. At most one section is held in place, never on a phone, and for
 * no more than two screens of scroll.
 */
const TYPE_SCALE_CHECK = (): string[] => {
  const phone = window.innerWidth < 600;
  const out: string[] = [];
  const demo = document.querySelector('#demo');
  if (!demo) return ['no demo tab'];
  const own = (el: Element) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent ?? '').join('').trim();
  const shown = (el: Element) => {
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getBoundingClientRect().width > 0;
  };
  for (const el of demo.querySelectorAll('*')) {
    if (!own(el) || el.closest('h1, h2, svg') || !shown(el)) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    const all = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    const running = /^(P|LI|DD|BLOCKQUOTE|FIGCAPTION)$/.test(el.tagName) && all.length >= 60;
    const cap = running ? (phone ? 22.5 : 24.5) : phone ? 28.5 : 36.5;
    if (size > cap) out.push(`${el.tagName.toLowerCase()} "${all.slice(0, 36)}" is ${size.toFixed(1)} px (${running ? 'running text' : 'not a heading'}, at most ${cap - 0.5})`);
    if (running && !phone) {
      const range = document.createRange();
      range.selectNodeContents(el);
      const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
      if (lines >= 2 && all.length / lines > 76) out.push(`"${all.slice(0, 36)}" runs ${Math.round(all.length / lines)} characters a line`);
    }
  }
  const signature = demo.querySelector('#board, #choose, #around, #treat');
  if (signature)
    for (const el of signature.querySelectorAll('*')) {
      if (!own(el) || el.closest('svg') || !shown(el)) continue;
      const cs = getComputedStyle(el);
      if (parseFloat(cs.fontSize) < 13.5) out.push(`signature label "${own(el).slice(0, 30)}" is ${cs.fontSize}`);
      const m = /matrix\(([^)]+)\)/.exec(cs.transform);
      if (m && Math.abs(Number(m[1]!.split(',')[1])) > 0.01) out.push(`signature label "${own(el).slice(0, 30)}" is turned`);
    }
  const held = [...demo.querySelectorAll('[data-frame]')].filter((f) => getComputedStyle(f).position === 'sticky');
  if (phone && held.length) out.push('a section is held in place on a phone');
  if (held.length > 1) out.push(`${held.length} sections are held in place`);
  for (const f of held) {
    const extra = (f.parentElement?.getBoundingClientRect().height ?? 0) - window.innerHeight;
    if (extra > 2.05 * window.innerHeight) out.push(`a held section takes ${(extra / window.innerHeight).toFixed(1)} screens of scroll`);
  }
  return out;
};

/** The bar of the Premium Standard for every sample. Stricter than the earlier pages' gate on speed. */
export const SAMPLE_LIMITS = { performance: 90, accessibility: 95, lcpMs: 2500, cls: 0.05, tbtMs: 200 };
const PLACEHOLDER = /\b(lorem|ipsum|placeholder|tbd|todo|coming soon|title here|your (?:text|title) here|undefined|NaN)\b|\{\{|\}\}|\[object /i;

export interface SampleGate {
  slug: string;
  lighthouse: { performance: number | null; accessibility: number | null; lcpMs: number | null; cls: number | null; tbtMs: number | null; runs: LighthouseRun[] };
  failures: string[];
}

const med = (v: (number | null | undefined)[]) => {
  const x = v.filter((n): n is number => typeof n === 'number');
  return x.length ? median(x) : null;
};

/** Every gate of the standard on one sample page, served from this machine. The visit report never leaves the browser. */
export async function gateSample(slug: string, base: string, opts: { runs?: number; skip?: Set<string> } = {}): Promise<SampleGate> {
  const url = `${base}${BASE_PATH}/${slug}-${SAMPLE_TOKEN}/`;
  const skip = opts.skip ?? new Set<string>();
  const failures: string[] = [];
  const runs: LighthouseRun[] = [];
  if (!skip.has('lighthouse')) for (let i = 0; i < (opts.runs ?? 3); i++) runs.push(await lighthouseOnce(url));
  const lighthouse = { performance: med(runs.map((r) => r.performance)), accessibility: med(runs.map((r) => r.accessibility)), lcpMs: med(runs.map((r) => r.lcpMs)), cls: med(runs.map((r) => r.cls)), tbtMs: med(runs.map((r) => r.tbtMs)), runs };
  if (!skip.has('lighthouse')) {
    const L = SAMPLE_LIMITS;
    if ((lighthouse.performance ?? 0) < L.performance) failures.push(`performance ${lighthouse.performance} under ${L.performance}`);
    if ((lighthouse.accessibility ?? 0) < L.accessibility) failures.push(`accessibility ${lighthouse.accessibility} under ${L.accessibility} (${[...new Set(runs.flatMap((r) => r.failedAccessibility ?? []))].join(', ')})`);
    if (lighthouse.lcpMs === null || lighthouse.lcpMs >= L.lcpMs) failures.push(`LCP ${lighthouse.lcpMs} ms`);
    if (lighthouse.cls === null || lighthouse.cls >= L.cls) failures.push(`CLS ${lighthouse.cls}`);
    if (lighthouse.tbtMs === null || lighthouse.tbtMs >= L.tbtMs) failures.push(`TBT ${lighthouse.tbtMs} ms`);
  }
  const browser = await chromium.launch();
  try {
    let html = '';
    const texts: string[] = [];
    if (!skip.has('overflow'))
      for (const width of [360, 390, 768, 1280]) {
        const phone = width < 760;
        const ctx = await quietContext(browser, { viewport: { width, height: 800 }, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone });
        const page = await ctx.newPage();
        for (const hash of ['', '#found']) {
          await page.goto(`${url}${hash}`, { waitUntil: 'networkidle' });
          await page.evaluate(async () => {
            for (let y = 0; y < document.documentElement.scrollHeight; y += 500) {
              window.scrollTo(0, y);
              await new Promise((r) => setTimeout(r, 40));
            }
          });
          await page.waitForTimeout(300);
          const wide = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
          if (wide > width) failures.push(`sideways scroll at ${width} on ${hash || 'the demo'} (${wide} px)`);
        }
        await ctx.close();
      }
    for (const width of [390, 1280]) {
      const ctx = await quietContext(browser, { viewport: { width, height: width === 390 ? 844 : 900 }, deviceScaleFactor: 1, isMobile: width === 390, hasTouch: width === 390, reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      for (const hash of ['', '#found']) {
        await page.goto(`${url}${hash}`, { waitUntil: 'networkidle' });
        if (!html) html = await page.content();
        texts.push(await page.evaluate(() => document.body.innerText));
        if (!skip.has('axe')) {
          const r = await new AxeBuilder({ page }).analyze();
          for (const v of r.violations) if (v.impact === 'serious' || v.impact === 'critical') failures.push(`axe ${v.id} at ${width}${hash} (${v.nodes.length}): ${v.nodes[0]?.html.slice(0, 140) ?? ''}`);
        }
      }
      await ctx.close();
    }
    if (!skip.has('type'))
      for (const width of [390, 1280]) {
        const ctx = await quietContext(browser, { viewport: { width, height: width === 390 ? 844 : 900 }, deviceScaleFactor: 1, isMobile: width === 390, hasTouch: width === 390 });
        const page = await ctx.newPage();
        await page.goto(url, { waitUntil: 'networkidle' });
        // The runner that compiles this file names inner functions with a helper the page does not have.
        await page.evaluate('globalThis.__name = (f) => f');
        for (const issue of await page.evaluate(TYPE_SCALE_CHECK)) failures.push(`type at ${width}: ${issue}`);
        await ctx.close();
      }
    for (const t of texts) {
      const m = PLACEHOLDER.exec(t);
      if (m) failures.push(`placeholder text "${m[0]}"`);
    }
    const dir = join(SAMPLES_DIR, slug);
    const pulled = samplePulled(slug);
    // Their own words, and the phone and email links their own site carries.
    const ownSite = [readFileSync(join(dir, 'text.txt'), 'utf8'), ...pulled.links.tel.map((t) => decodeURIComponent(t)), ...pulled.links.mailto].join('\n');
    if (!skip.has('copy')) for (const c of scanPage(splitPage(html), { ownSite, measured: '', offer: readFileSync(join(previewPaths.app, 'lib', 'offer.ts'), 'utf8') })) failures.push(`copy ${c.kind} in ${c.where}: "${c.text}" in "${c.context}"`);
    if (!skip.has('links')) {
      const ownHtml = ['page-desktop', 'page-mobile'].map((d) => join(dir, d, 'page.html')).filter((f) => existsSync(f)).map((f) => readFileSync(f, 'utf8')).join('\n');
      for (const l of await checkLinks(browser, url, /rezdy|fareharbor|littlehotelier|gensolve|raftingbookings|bookeo|checkfront/i, ownHtml)) if (!l.ok) failures.push(`link "${l.label}" ${l.href}: ${l.note}`);
    }
    if (!skip.has('beacon')) {
      const b = await checkBeacon(browser, url, `${slug}-${SAMPLE_TOKEN}`);
      if (!b.ok) failures.push(`visit report: ${b.early} early, ${b.views} view(s)`);
    }
  } finally {
    await browser.close();
  }
  return { slug, lighthouse, failures };
}

/** The look of every engine page with settings: the samples, and any real page in previews/content. */
export function engineLooks(): { slug: string; look: Look }[] {
  const out: { slug: string; look: Look }[] = [];
  const add = (slug: string, raw: unknown, media: string) => {
    const c = EngineConfig.parse(raw);
    const file = join(media, 'graded', 'index.json');
    const index = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as GradedIndex) : null;
    const p = index?.hero && index.photos ? index.photos[index.hero] : undefined;
    const hero = heroFor(c.look.hero, p ? { width: p.width, height: p.height, score: p.score } : null).kind;
    out.push({ slug, look: engineLook(c, hero) });
  };
  for (const slug of sampleSlugs()) add(`${slug} (sample)`, JSON.parse(readFileSync(join(SAMPLES_DIR, slug, 'config.json'), 'utf8')), join(SAMPLES_DIR, slug));
  if (existsSync(previewPaths.content))
    for (const slug of readdirSync(previewPaths.content)) {
      const f = join(contentDir(slug), 'engine.json');
      if (existsSync(f)) add(slug, JSON.parse(readFileSync(f, 'utf8')), join(paths.data, 'wave', slug));
    }
  return out;
}

/** The looks of the pages made to order and laid out from recipes that this working copy holds. */
function otherLooks(): { slug: string; look: Look }[] {
  const out: { slug: string; look: Look }[] = [];
  if (existsSync(previewPaths.content))
    for (const slug of readdirSync(previewPaths.content)) {
      const f = join(contentDir(slug), 'content.json');
      if (!existsSync(f)) continue;
      const look = (JSON.parse(readFileSync(f, 'utf8')) as { look?: Look }).look;
      if (look) out.push({ slug, look });
    }
  return out;
}

export function samplePulled(slug: string): Pulled {
  const file = join(SAMPLES_DIR, slug, 'pull.json');
  if (!existsSync(file)) throw new Error(`${file} does not exist. Run plumb engine pull first.`);
  return JSON.parse(readFileSync(file, 'utf8')) as Pulled;
}

/** The colours a palette is made from: the logo's, the site's own and the photos'. */
export async function sampleSwatches(slug: string): Promise<Swatch[]> {
  const p = samplePulled(slug);
  const out: Swatch[] = [];
  if (p.brand.logo && existsSync(p.brand.logo)) {
    try {
      out.push(...(await swatchesOf(p.brand.logo, 'logo')));
    } catch {
      // A logo the image library cannot read gives no colours.
    }
  }
  for (const c of p.brand.colours) out.push({ hex: c.hex, share: Math.min(1, c.share), from: 'site' });
  for (const c of rankPhotos(p.photos).slice(0, 3)) out.push(...(await swatchesOf(c.file, 'photo')).map((s) => ({ ...s, share: s.share / 3 })));
  return out;
}

/** A sheet of the best photos, numbered as the ranking prints them, for choosing a hero and its focus by eye. */
async function photoSheet(files: string[], out: string): Promise<void> {
  const w = 220;
  const tiles = await Promise.all(files.map((f) => sharp(f).rotate().resize(w, 150, { fit: 'cover' }).jpeg({ quality: 70 }).toBuffer()));
  const cols = 4;
  const rows = Math.ceil(tiles.length / cols);
  await sharp({ create: { width: cols * w, height: rows * 150, channels: 3, background: '#222' } })
    .composite(tiles.map((input, i) => ({ input, left: (i % cols) * w, top: Math.floor(i / cols) * 150 })))
    .jpeg({ quality: 70 })
    .toFile(out);
}

export function registerEngine(program: Command): void {
  const engine = program.command('engine').description('The four page engines: sample content, palettes, photos, variety and sample builds');

  engine
    .command('pull')
    .description('Read the homepage of each named business (text, links, logo, colours and photos) into data/wave-4/design-samples/<slug>/')
    .requiredOption('--list <file>', 'the wave list, as a CSV file with slug and website columns')
    .requiredOption('--only <slugs>', 'comma separated slugs')
    .action(async (o: { list: string; only: string }) => {
      const rows = parseCsv(readFileSync(o.list, 'utf8'));
      const wanted = o.only.split(',').map((s) => s.trim()).filter(Boolean);
      const limiter = new HostLimiter();
      // robots.txt answers are kept with the samples, not in the shared cache.
      const polite = new Polite(limiter, new RobotsCache(limiter, join(SAMPLES_DIR, '_cache', 'robots')));
      const renderer = new Renderer(polite);
      await renderer.start();
      const limit = pLimit(3);
      try {
        await Promise.all(
          wanted.map((slug) =>
            limit(async () => {
              const row = rows.find((r) => r.slug === slug);
              if (!row?.website) return void console.log(`${slug}: not in the list, or no website`);
              try {
                const p = await pullSample(renderer, polite, slug, row.website);
                const big = p.photos.filter((x) => x.kind === 'photo' && x.width >= 1800).length;
                const kept = p.photos.filter((x) => x.file).length;
                console.log(`${slug}: ${p.blocks.length} text blocks, ${p.photos.length} pictures (${kept} kept, ${big} at least 1800 px wide), logo ${p.brand.logo ? 'kept' : 'not found'}, ${p.links.booking.length} booking link(s), ${p.links.tel.length} phone link(s)`);
              } catch (e) {
                console.log(`${slug}: failed, ${(e as Error).message.slice(0, 200)}`);
              }
            }),
          ),
        );
      } finally {
        await renderer.stop();
      }
    });

  engine
    .command('palette <slug>')
    .description("Make a sample's palette from its logo, site colours and photos, and show the contrast of every pair")
    .requiredOption('--engine <name>', ENGINES.join(', '))
    .action(async (slug: string, o: { engine: string }) => {
      if (!ENGINES.includes(o.engine as EngineName)) throw new Error(`no engine called ${o.engine}`);
      const palette = paletteFrom(o.engine as EngineName, await sampleSwatches(slug));
      writeFileSync(join(SAMPLES_DIR, slug, 'palette.json'), JSON.stringify(palette, null, 2));
      console.log(`${slug}: ${palette.family} | accent ${palette.accent} deep ${palette.deep} paper ${palette.paper} | from ${palette.from.slice(0, 3).join('; ')}`);
      for (const c of paletteChecks(palette)) if (!c.ok) console.log(`  FAILS ${c.pair} ${c.ratio}`);
    });

  engine
    .command('photos <slug>')
    .description("Rank a sample's photos by size and sharpness and lay the best out on a numbered sheet")
    .option('--top <n>', 'how many to show', (v) => Number(v), 12)
    .action(async (slug: string, o: { top: number }) => {
      const ranked = rankPhotos(samplePulled(slug).photos).filter((c) => c.fit !== 'none');
      const top = ranked.slice(0, o.top);
      for (const [i, c] of top.entries()) console.log(`${String(i + 1).padStart(2)} ${c.fit.padEnd(6)} ${c.width}x${c.height} sharp ${c.sharpness} ${c.file.split('/').slice(-2).join('/')} ${c.alt.slice(0, 50)}`);
      if (top.length) await photoSheet(top.map((c) => c.file), join(SAMPLES_DIR, slug, 'photo-sheet.jpg'));
    });

  engine
    .command('build')
    .description('Grade the photos and write the page data of each sample with a config.json, then build the sample site (local only)')
    .option('--only <slugs>', 'comma separated slugs')
    .option('--no-site', 'write the page data only')
    .action(async (o: { only?: string; site?: boolean }) => {
      const slugs = o.only ? o.only.split(',').map((x) => x.trim()) : sampleSlugs();
      for (const slug of slugs) {
        const data = await buildSample(slug);
        const demo = data.demo as { heroKind: string; heroNote: string | null; look: { type: string; family: string } };
        console.log(`${slug}: ${data.design}, ${demo.heroKind} hero${demo.heroNote ? ` (${demo.heroNote})` : ''}, ${demo.look.type}, ${demo.look.family}, ${Object.keys(data.images).length} images`);
      }
      if (o.site !== false) {
        buildSampleSite();
        console.log(`Sample site: ${join(SAMPLE_OUT, 'site')}`);
      }
    });

  engine
    .command('shots')
    .description('Phone screenshots (390 wide JPEG) of sample pages from the local sample site, or of any page by address')
    .option('--only <slugs>', 'comma separated slugs of samples')
    .option('--url <address>', 'a page by its address instead, such as a live page')
    .option('--name <name>', 'file name stem for --url')
    .requiredOption('--out <dir>', 'where to write the pictures')
    .option('--first', 'the first screen only')
    .action(async (o: { only?: string; url?: string; name?: string; out: string; first?: boolean }) => {
      const opts = o.first ? { screens: 1, mid: false } : {};
      if (o.url) {
        for (const f of await phoneShots(o.url, o.out, o.name ?? 'page', opts)) console.log(f);
        return;
      }
      const { server, base } = await serveSite(join(SAMPLE_OUT, 'site'), 4331);
      try {
        for (const slug of o.only ? o.only.split(',') : sampleSlugs()) for (const f of await phoneShots(`${base}${BASE_PATH}/${slug}-${SAMPLE_TOKEN}/`, o.out, slug, opts)) console.log(f);
      } finally {
        server.close();
      }
    });

  engine
    .command('grade <slug>')
    .description("Grade a real engine page's picked photos (previews/content/<slug>/engine.json, photos under data/wave/<slug>/) before plumb preview build")
    .action(async (slug: string) => {
      const config = EngineConfig.parse(JSON.parse(readFileSync(join(contentDir(slug), 'engine.json'), 'utf8')));
      const index = await gradeEnginePhotos(config, join(paths.data, 'wave', slug), (line) => console.log(`${slug}${line}`));
      console.log(`${slug}: ${Object.keys(index.photos).length} photos graded, hero ${index.hero ?? 'none (typographic)'}${index.inset ? `, inset ${index.inset}` : ''}`);
    });

  engine
    .command('variety')
    .description('The variety rules for engine pages: no pair of faces used before or by another engine, and no two pages of any wave alike in hero, faces and palette family')
    .action(() => {
      const mine = engineLooks();
      for (const p of mine) console.log(`${p.slug}: ${p.look.hero}, ${p.look.type}, ${p.look.family}`);
      const issues = engineVarietyIssues(mine, otherLooks());
      for (const i of issues) console.log(`PROBLEM ${i}`);
      console.log(issues.length ? `${issues.length} problem(s).` : `${mine.length} engine page(s): the variety rules hold.`);
      if (issues.length) process.exitCode = 1;
    });

  engine
    .command('gates')
    .description('The gates of the Premium Standard on the sample site: speed and accessibility, sideways scroll, contrast, the type scale, labels and pacing, links, placeholder text, dashes and figures, and the visit report')
    .option('--only <slugs>', 'comma separated slugs')
    .option('--runs <n>', 'Lighthouse runs per page (median)', (v) => Number(v), 3)
    .option('--skip <gates>', 'comma separated: lighthouse, overflow, axe, type, copy, links, beacon')
    .action(async (o: { only?: string; runs: number; skip?: string }) => {
      const { server, base } = await serveSite(join(SAMPLE_OUT, 'site'), 4332);
      const results: SampleGate[] = [];
      try {
        for (const slug of o.only ? o.only.split(',') : sampleSlugs()) {
          const r = await gateSample(slug, base, { runs: o.runs, skip: new Set((o.skip ?? '').split(',').filter(Boolean)) });
          results.push(r);
          const l = r.lighthouse;
          console.log(`${slug}: perf ${l.performance} a11y ${l.accessibility} LCP ${l.lcpMs === null ? '-' : (l.lcpMs / 1000).toFixed(2)} s CLS ${l.cls === null ? '-' : l.cls.toFixed(3)} TBT ${l.tbtMs === null ? '-' : Math.round(l.tbtMs)} ms | ${r.failures.length ? 'FAIL' : 'pass'}`);
          for (const f of r.failures) console.log(`  ${f}`);
        }
      } finally {
        server.close();
      }
      mkdirSync(join(SAMPLE_OUT, 'gates'), { recursive: true });
      writeFileSync(join(SAMPLE_OUT, 'gates', `gates-${Date.now()}.json`), JSON.stringify(results, null, 2));
      if (results.some((r) => r.failures.length)) process.exitCode = 1;
    });

  engine
    .command('sheet')
    .description("Lay the samples' first phone screens side by side on one contact sheet")
    .requiredOption('--from <dir>', 'where the screenshots are (<slug>-screen1.jpg)')
    .requiredOption('--out <file>', 'the sheet, a JPEG')
    .action(async (o: { from: string; out: string }) => {
      const slugs = sampleSlugs().filter((slug) => existsSync(join(o.from, `${slug}-screen1.jpg`)));
      const w = 390;
      const h = 844;
      const cols = 4;
      const tiles = await Promise.all(slugs.map((slug) => sharp(join(o.from, `${slug}-screen1.jpg`)).resize(w, h, { fit: 'cover', position: 'top' }).toBuffer()));
      mkdirSync(join(o.out, '..'), { recursive: true });
      await sharp({ create: { width: cols * w + (cols + 1) * 16, height: Math.ceil(tiles.length / cols) * (h + 16) + 16, channels: 3, background: '#d9d9d6' } })
        .composite(tiles.map((input, i) => ({ input, left: 16 + (i % cols) * (w + 16), top: 16 + Math.floor(i / cols) * (h + 16) })))
        .jpeg({ quality: 74 })
        .toFile(o.out);
      console.log(`${o.out}: ${slugs.join(', ')}`);
    });

  engine
    .command('pairs')
    .description('Set out blind pairs for a reviewer: each sample beside a reference page, labelled A and B in random order. The key is written elsewhere.')
    .requiredOption('--from <dir>', 'where the screenshots are (<name>-screen1.jpg ... -mid.jpg)')
    .requiredOption('--samples <slugs>', 'comma separated, one per pair')
    .requiredOption('--reference <name>', 'the reference page’s file stem')
    .requiredOption('--out <dir>', 'the folder the reviewer is given')
    .requiredOption('--key <file>', 'where the key is written, outside the reviewer’s folder')
    .action((o: { from: string; samples: string; reference: string; out: string; key: string }) => {
      const key: Record<string, { A: string; B: string }> = {};
      for (const [i, slug] of o.samples.split(',').entries()) {
        const pair = `pair-${i + 1}`;
        const first = Math.random() < 0.5;
        const side = { A: first ? slug : o.reference, B: first ? o.reference : slug };
        key[pair] = side;
        const dir = join(o.out, pair);
        mkdirSync(dir, { recursive: true });
        for (const label of ['A', 'B'] as const)
          for (const shot of ['screen1', 'screen2', 'screen3', 'mid']) cpSync(join(o.from, `${side[label]}-${shot}.jpg`), join(dir, `${label}-${shot}.jpg`));
      }
      mkdirSync(join(o.key, '..'), { recursive: true });
      writeFileSync(o.key, JSON.stringify(key, null, 2));
      console.log(`${Object.keys(key).length} pairs in ${o.out}; key in ${o.key}`);
    });
}
