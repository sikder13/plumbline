import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { Command } from 'commander';
import sharp from 'sharp';
import { chromium } from 'playwright';
import { ROOT, db, env, paths, type Db } from '@plumbline/core';
import { CHECK_IDS } from '@plumbline/checks';
import { loadLibrary } from '@plumbline/impact';
import { BASE_PATH, servedFile, EngineConfig, MIN_SCORE, MIN_WIDTH, OWN_VISIT, PHONE_KINDS, bannedIssues, measuredOn, buildEngineSample, contentDir, dashIssues, numberIssues, numberSet, ensureToken, gradeEnginePhotos, nzReadable, packCards, previewPaths, quietContext, serveSite, sharpnessScore, tokenFor, type FactPack, type PageData } from '@plumbline/preview';
import { isSuppressed } from '@plumbline/wave';
import { suppressionList } from './approve.ts';
import { gateEnginePage, phoneShots, type SampleGate } from './engine.ts';
import { VERCEL_JSON, scriptsAfterPaint } from './preview.ts';

/**
 * The real pages of a wave made by the page engines. Each page is its settings
 * (previews/content/<slug>/engine.json), its photos and pulled homepage under data/wave/<slug>/, and
 * the fact pack the wave run wrote. The page data and images land under previews/out/ beside every
 * other page, so a deploy stages them with the rest; the local site of these pages alone is built
 * under previews/<wave>/ for looking and for the gates. Nothing is deployed here.
 */
export const PAGES_WAVE = 'wave-4';
export const PACKS_DIR = join(paths.reports, 'nz-tourism-1', PAGES_WAVE);
export const PAGES_OUT = join(ROOT, 'previews', PAGES_WAVE);
const REPLY_EMAIL = 'udaay@nahltech.com';

export const pageMedia = (slug: string) => join(paths.data, 'wave', slug);

/** The businesses with engine settings, or the ones named. */
export function pageSlugs(only?: string): string[] {
  if (only) return only.split(',').map((s) => s.trim()).filter(Boolean);
  if (!existsSync(previewPaths.content)) return [];
  return readdirSync(previewPaths.content).filter((s) => existsSync(join(contentDir(s), 'engine.json'))).sort();
}

export function loadPack(slug: string): FactPack {
  const file = join(PACKS_DIR, `${slug}.json`);
  if (!existsSync(file)) throw new Error(`${file} does not exist. Run plumb wave run for this business first.`);
  return JSON.parse(readFileSync(file, 'utf8')) as FactPack;
}

const bare = (url: string) => url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '').toLowerCase();

/** The pages of their site the wave run read, one entry per address with its words. */
export function sitePages(slug: string): { url: string; text: string; dir: string; viewport: string }[] {
  const root = join(paths.data, PAGES_WAVE, slug, 'capture');
  if (!existsSync(root)) return [];
  const byUrl = new Map<string, { url: string; text: string; dir: string; viewport: string }>();
  for (const d of readdirSync(root)) {
    const file = join(root, d, 'capture.json');
    if (!existsSync(file)) continue;
    const c = JSON.parse(readFileSync(file, 'utf8')) as { url: string; finalUrl?: string; text?: string; viewport?: string; ok?: boolean };
    if (c.ok === false) continue;
    const url = c.finalUrl || c.url;
    const text = c.text ?? '';
    const was = byUrl.get(url);
    if (!was || (c.viewport === 'mobile' && was.viewport !== 'mobile') || text.length > was.text.length) byUrl.set(url, { url, text, dir: join(root, d), viewport: c.viewport ?? '' });
  }
  return [...byUrl.values()];
}

/** Their own words from every page we read, and the words the assets kept, for checking each figure on the page. */
export function ownSiteText(slug: string): string {
  const parts = sitePages(slug).map((p) => `== ${p.url}\n${p.text}`);
  const assets = join(paths.data, PAGES_WAVE, 'assets', slug, 'assets.json');
  if (existsSync(assets)) for (const w of (JSON.parse(readFileSync(assets, 'utf8')) as { words?: { text: string }[] }).words ?? []) parts.push(w.text);
  return parts.join('\n');
}

/**
 * The first phone screen of their homepage as the wave run saw it (390 by 844), for a finding about
 * that screen. Null when no phone capture of the homepage was kept.
 */
async function homepageScreen(slug: string, pack: FactPack, outDir: string, urlBase: string, name: string): Promise<{ src: string; width: number; height: number } | null> {
  const home = bare(pack.phone?.url ?? pack.website);
  const page = sitePages(slug).find((p) => p.viewport === 'mobile' && bare(p.url) === home);
  const tile = page && join(page.dir, 'tile-00.jpg');
  if (!tile || !existsSync(tile)) return null;
  const meta = await sharp(tile).metadata();
  const width = meta.width ?? 0;
  const scale = width / 390;
  const height = Math.min(meta.height ?? 0, Math.round(844 * scale));
  if (!width || !height) return null;
  mkdirSync(outDir, { recursive: true });
  const info = await sharp(tile).extract({ left: 0, top: 0, width, height }).resize({ width: 440 }).webp({ quality: 72 }).toFile(join(outDir, `${name}.webp`));
  return { src: `${urlBase}/${name}.webp`, width: info.width, height: info.height };
}

/**
 * Gets one business ready for its settings to be written: their photos (the pulled homepage's, topped
 * up from the wave run's assets, one of each picture) ranked by sharpness on a numbered sheet, and
 * their words (the pulled homepage, then every page the wave run read) in one file. Both go to
 * previews/review/<wave>/pages/prep/<slug>/; the photos stay under data/wave/<slug>/photos/.
 */
export async function prepPage(slug: string): Promise<{ photos: number; heroOk: number; pages: number }> {
  const media = pageMedia(slug);
  const photos = join(media, 'photos');
  mkdirSync(photos, { recursive: true });
  const pull = JSON.parse(readFileSync(join(media, 'pull.json'), 'utf8')) as { url: string; title: string; description: string | null; photos: { file: string | null; url: string; alt: string }[]; blocks: { text: string; tag: string; heading: string | null; href: string | null }[]; footer: string[]; links: unknown };
  const sources: Record<string, { pageUrl: string; alt: string }> = {};
  for (const p of pull.photos) if (p.file) sources[p.file.split('/').pop()!] = { pageUrl: pull.url, alt: p.alt };
  const assetsDir = join(paths.data, PAGES_WAVE, 'assets', slug);
  const assets = existsSync(join(assetsDir, 'assets.json')) ? (JSON.parse(readFileSync(join(assetsDir, 'assets.json'), 'utf8')) as { images: { pageUrl: string; alt: string; width: number; kind: string; file: string | null }[] }).images : [];
  let n = 0;
  for (const img of assets) {
    if (!img.file || img.kind !== 'photo' || img.width < 640) continue;
    // The assets were written from another working copy: the file is found by its name under this one's data.
    const local = existsSync(img.file) ? img.file : join(assetsDir, 'images', img.file.split('/').pop()!);
    if (!existsSync(local)) continue;
    const name = `a${String(++n).padStart(2, '0')}${extname(local).toLowerCase()}`;
    copyFileSync(local, join(photos, name));
    sources[name] = { pageUrl: img.pageUrl, alt: img.alt };
  }
  // One of each picture: the same photo at two sizes keeps the larger.
  const rows: { f: string; w: number; h: number; s: number; key: string }[] = [];
  for (const f of readdirSync(photos).filter((x) => /\.(jpe?g|png|webp)$/i.test(x))) {
    const file = join(photos, f);
    try {
      const m = await sharp(file).rotate().metadata();
      const tiny = await sharp(file).rotate().resize(12, 12, { fit: 'fill' }).greyscale().raw().toBuffer();
      const mean = tiny.reduce((x, y) => x + y, 0) / tiny.length;
      rows.push({ f, w: m.autoOrient?.width ?? m.width ?? 0, h: m.autoOrient?.height ?? m.height ?? 0, s: await sharpnessScore(file), key: Array.from(tiny, (v) => (v > mean ? '1' : '0')).join('') });
    } catch {
      // A file the image library cannot read is not offered.
    }
  }
  const kept: typeof rows = [];
  for (const r of rows.sort((x, y) => y.w * y.h - x.w * x.h)) if (!kept.some((k) => [...k.key].filter((c, i) => c !== r.key[i]).length <= 12)) kept.push(r);
  const heroOk = (r: (typeof rows)[number]) => r.w >= MIN_WIDTH.hero && r.s >= MIN_SCORE.hero;
  kept.sort((x, y) => Number(heroOk(y)) - Number(heroOk(x)) || y.s - x.s);
  const out = join(previewPaths.review, PAGES_WAVE, 'pages', 'prep', slug);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'photos.txt'), kept.map((r, i) => `${String(i + 1).padStart(2)} photos/${r.f} ${r.w}x${r.h} sharpness ${r.s}${r.s < MIN_SCORE.any ? ' (soft: not usable)' : heroOk(r) ? ' (hero ok)' : ''} | found at ${sources[r.f]?.pageUrl ?? pull.url} | alt "${(sources[r.f]?.alt ?? '').slice(0, 80)}"`).join('\n') + '\n');
  const W = 360;
  const H = 270;
  const cols = 4;
  const tiles = await Promise.all(
    kept.slice(0, 24).map(async (r, i) => {
      const img = await sharp(join(photos, r.f)).rotate().resize(W, H - 26, { fit: 'contain', background: '#fff' }).toBuffer();
      const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="26"><text x="4" y="19" font-family="sans-serif" font-size="16">${i + 1}. ${r.f} ${r.w}x${r.h} s${Math.round(r.s)}</text></svg>`);
      return [
        { input: label, left: (i % cols) * W, top: Math.floor(i / cols) * H },
        { input: img, left: (i % cols) * W, top: Math.floor(i / cols) * H + 26 },
      ];
    }),
  );
  if (tiles.length) await sharp({ create: { width: cols * W, height: Math.ceil(tiles.length / cols) * H, channels: 3, background: '#fff' } }).composite(tiles.flat()).jpeg({ quality: 78 }).toFile(join(out, 'photos.jpg'));
  const lines = [`# ${slug}`, `== HOMEPAGE (pulled ${pull.url})`, `title: ${pull.title}`, `description: ${pull.description ?? ''}`];
  for (const b of pull.blocks) lines.push(`[${b.tag}${b.heading ? ` under "${b.heading}"` : ''}${b.href ? ` -> ${b.href}` : ''}] ${b.text}`);
  lines.push('-- footer', ...pull.footer, '-- links', JSON.stringify(pull.links, null, 1));
  const pages = sitePages(slug);
  for (const p of pages) lines.push('', `== PAGE ${p.url}`, p.text);
  writeFileSync(join(out, 'site.txt'), lines.join('\n'));
  return { photos: kept.length, heroOk: kept.filter(heroOk).length, pages: pages.length };
}

/** Why a business gets no page: on the suppression list by its slug, an address or its domain. */
export function pageHeld(slug: string, pack: FactPack, config: EngineConfig): string | null {
  const { list } = suppressionList();
  const emails = [pack.to.address, config.contact.email?.address].filter((e): e is string => !!e);
  return isSuppressed(list, slug, emails, pack.website) ? 'on the suppression list' : null;
}

/**
 * Grades the photos and writes the page data of one real engine page. Its demo address is made once
 * with the token every page gets, and never changes after. A suppressed business gets no page.
 */
export async function buildRealPage(d: Db, slug: string, call: string): Promise<PageData | null> {
  const config = EngineConfig.parse(JSON.parse(readFileSync(join(contentDir(slug), 'engine.json'), 'utf8')));
  const pack = loadPack(slug);
  const held = pageHeld(slug, pack, config);
  if (held) {
    console.log(`${slug}: skipped, ${held}`);
    rmSync(join(previewPaths.data, `${slug}.json`), { force: true });
    return null;
  }
  const media = pageMedia(slug);
  await gradeEnginePhotos(config, media, (line) => console.log(`${slug}${line}`));
  const token = ensureToken(d, slug);
  const path = `${slug}-${token}`;
  const assets = join(previewPaths.out, 'assets', path);
  const data = await buildEngineSample(config, { media, assets, urlBase: `${BASE_PATH}/${path}`, reply: { email: REPLY_EMAIL, subject: `${config.name} website`, call }, token });
  const library = loadLibrary(CHECK_IDS);
  data.findings = await packCards(pack, library, (f) => (PHONE_KINDS.has(f.type) ? homepageScreen(slug, pack, join(assets, 'evidence'), `${BASE_PATH}/${path}/evidence`, `${f.place}-1`) : Promise.resolve(null)), { bookingSystem: !!config.contact.booking });
  mkdirSync(previewPaths.data, { recursive: true });
  writeFileSync(join(previewPaths.data, `${slug}.json`), JSON.stringify(data, null, 2));
  return data;
}

/** The page data of one built page, as written by buildRealPage. */
export function pageData(slug: string): PageData {
  const file = join(previewPaths.data, `${slug}.json`);
  if (!existsSync(file)) throw new Error(`${file} does not exist. Run plumb engine pages build first.`);
  return JSON.parse(readFileSync(file, 'utf8')) as PageData;
}

/** Builds the local site of these pages alone into previews/<wave>/site, served the way the host serves the real ones. */
export function buildPagesSite(slugs: string[]): void {
  const staged = join(PAGES_OUT, 'staged');
  rmSync(staged, { recursive: true, force: true });
  mkdirSync(staged, { recursive: true });
  for (const slug of slugs) if (existsSync(join(previewPaths.data, `${slug}.json`))) copyFileSync(join(previewPaths.data, `${slug}.json`), join(staged, `${slug}.json`));
  const app = previewPaths.app;
  execFileSync(process.execPath, [join(app, 'scripts', 'fonts.mjs')], { cwd: app, stdio: 'inherit' });
  execFileSync(join(app, 'node_modules', '.bin', 'next'), ['build'], { cwd: app, stdio: 'inherit', env: { ...process.env, PREVIEWS_DATA: staged, NEXT_TELEMETRY_DISABLED: '1' } });
  const site = join(PAGES_OUT, 'site');
  const served = join(site, BASE_PATH);
  rmSync(site, { recursive: true, force: true });
  cpSync(join(app, 'out'), served, { recursive: true, dereference: true, filter: servedFile });
  const pages = readdirSync(staged).map((f) => JSON.parse(readFileSync(join(staged, f), 'utf8')) as PageData);
  const published = new Set(pages.map((p) => p.path));
  for (const e of readdirSync(served, { withFileTypes: true })) if (e.isDirectory() && /-[a-z0-9]{6}$/.test(e.name) && !published.has(e.name)) rmSync(join(served, e.name), { recursive: true, force: true });
  for (const page of pages) {
    const assets = join(previewPaths.out, 'assets', page.path);
    if (existsSync(assets)) cpSync(assets, join(served, page.path), { recursive: true, filter: servedFile });
    const html = join(served, page.path, 'index.html');
    writeFileSync(html, scriptsAfterPaint(readFileSync(html, 'utf8')));
  }
  writeFileSync(join(site, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
}

/**
 * Stages the whole site for a deploy into previews/out/: every page now live, as its built data and
 * images were staged for the last deploy in `liveOut` (another working copy's previews/out, read and
 * never written), and this wave's engine pages. A business on the suppression list is left out.
 * Returns the pages staged and the ones held.
 */
export function stageWholeSite(liveOut: string, waveSlugs: string[]): { live: string[]; wave: string[]; held: { slug: string; why: string }[] } {
  const { list } = suppressionList();
  const held: { slug: string; why: string }[] = [];
  const staged = join(previewPaths.out, 'staged');
  rmSync(staged, { recursive: true, force: true });
  mkdirSync(staged, { recursive: true });
  const live: string[] = [];
  for (const f of readdirSync(join(liveOut, 'staged')).filter((x) => x.endsWith('.json'))) {
    const page = JSON.parse(readFileSync(join(liveOut, 'staged', f), 'utf8')) as PageData;
    if (waveSlugs.includes(page.slug)) throw new Error(`${page.slug} is both live and in this wave`);
    if (isSuppressed(list, page.slug, [], page.domain)) {
      held.push({ slug: page.slug, why: 'on the suppression list' });
      continue;
    }
    copyFileSync(join(liveOut, 'staged', f), join(staged, f));
    const assets = join(liveOut, 'assets', page.path);
    if (existsSync(assets)) cpSync(assets, join(previewPaths.out, 'assets', page.path), { recursive: true, dereference: true });
    live.push(page.slug);
  }
  const wave: string[] = [];
  for (const slug of waveSlugs) {
    const file = join(previewPaths.data, `${slug}.json`);
    if (!existsSync(file)) {
      held.push({ slug, why: 'not built' });
      continue;
    }
    copyFileSync(file, join(staged, `${slug}.json`));
    wave.push(slug);
  }
  return { live, wave, held };
}

/** Builds the staged pages into previews/out/site, the folder the host serves, with its settings beside it. */
export function buildWholeSite(): number {
  const staged = join(previewPaths.out, 'staged');
  const app = previewPaths.app;
  execFileSync(process.execPath, [join(app, 'scripts', 'fonts.mjs')], { cwd: app, stdio: 'inherit' });
  execFileSync(join(app, 'node_modules', '.bin', 'next'), ['build'], { cwd: app, stdio: 'inherit', env: { ...process.env, PREVIEWS_DATA: staged, NEXT_TELEMETRY_DISABLED: '1' } });
  const served = join(previewPaths.site, BASE_PATH);
  rmSync(previewPaths.site, { recursive: true, force: true });
  cpSync(join(app, 'out'), served, { recursive: true, dereference: true, filter: servedFile });
  const pages = readdirSync(staged).map((f) => JSON.parse(readFileSync(join(staged, f), 'utf8')) as PageData);
  const published = new Set(pages.map((p) => p.path));
  for (const e of readdirSync(served, { withFileTypes: true })) if (e.isDirectory() && /-[a-z0-9]{6}$/.test(e.name) && !published.has(e.name)) rmSync(join(served, e.name), { recursive: true, force: true });
  for (const page of pages) {
    const assets = join(previewPaths.out, 'assets', page.path);
    if (existsSync(assets)) cpSync(assets, join(served, page.path), { recursive: true, filter: servedFile });
    const html = join(served, page.path, 'index.html');
    writeFileSync(html, scriptsAfterPaint(readFileSync(html, 'utf8')));
  }
  writeFileSync(join(previewPaths.site, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  writeFileSync(join(previewPaths.out, 'vercel.json'), JSON.stringify(VERCEL_JSON, null, 2));
  return pages.length;
}

/** What the findings tab of a page may state: the pack's sentences and measured values, and the times they were measured. */
function measuredText(pack: FactPack): string {
  return pack.findings.flatMap((f) => [f.sentence, f.measured, f.evidence_url, f.linked_from ?? '', nzReadable(f.measured_at)]).join('\n');
}

/** The first desktop screen of a page, 1280 by 800, as a JPEG. The visit report is answered in the browser. */
async function desktopShot(url: string, file: string): Promise<void> {
  const browser = await chromium.launch();
  try {
    const ctx = await quietContext(browser, { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(2600);
    await page.screenshot({ path: file, type: 'jpeg', quality: 80 });
    await ctx.close();
  } finally {
    await browser.close();
  }
}

/** One sheet of named tiles, in rows, each labelled with its business. */
async function contactSheet(tiles: { file: string; label: string }[], out: string, w: number, h: number, cols: number): Promise<void> {
  const gap = 16;
  const label = 30;
  const parts = await Promise.all(
    tiles.map(async (t, i) => {
      const left = gap + (i % cols) * (w + gap);
      const top = gap + Math.floor(i / cols) * (h + label + gap);
      const img = await sharp(t.file).resize(w, h, { fit: 'cover', position: 'top' }).toBuffer();
      const text = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${label}"><text x="2" y="21" font-family="sans-serif" font-size="17" fill="#222">${t.label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);
      return [
        { input: text, left, top },
        { input: img, left, top: top + label },
      ];
    }),
  );
  mkdirSync(join(out, '..'), { recursive: true });
  await sharp({ create: { width: cols * w + (cols + 1) * gap, height: Math.ceil(tiles.length / cols) * (h + label + gap) + gap, channels: 3, background: '#e4e3df' } })
    .composite(parts.flat())
    .jpeg({ quality: 74 })
    .toFile(out);
}

/** The words a settings file puts on the page, each with where it sits: every string but addresses, ids, files and colours. */
function wordsOf(value: unknown, at = ''): { at: string; text: string }[] {
  if (typeof value === 'string') return [{ at, text: value }];
  if (Array.isArray(value)) return value.flatMap((v, i) => wordsOf(v, `${at}[${i}]`));
  if (value && typeof value === 'object')
    return Object.entries(value).flatMap(([k, v]) => (['source', 'href', 'tel', 'file', 'id', 'photo', 'inset', 'palette', 'look', 'engine', 'slug', 'domain', 'focus', 'keep', 'area', 'kind', 'concept'].includes(k) ? [] : wordsOf(v, at ? `${at}.${k}` : k)));
  return [];
}

/**
 * What is wrong with one page's settings before it is built: the schema, any figure not on their own
 * site, dashes inside sentences, banned words, a testimonial on a physio page, a photo that is
 * missing or used twice, and a source that is not on their own site.
 */
export function lintSettings(slug: string): string[] {
  const out: string[] = [];
  const file = join(contentDir(slug), 'engine.json');
  if (!existsSync(file)) return [`${file} does not exist`];
  const raw = JSON.parse(readFileSync(file, 'utf8')) as unknown;
  const parsed = EngineConfig.safeParse(raw);
  if (!parsed.success) return parsed.error.issues.map((i) => `schema: ${i.path.join('.')}: ${i.message}`);
  const c = parsed.data;
  const media = pageMedia(slug);
  const pulled = existsSync(join(media, 'text.txt')) ? readFileSync(join(media, 'text.txt'), 'utf8') : '';
  // The phone and email links their homepage carries count as their words, as they do in the gates.
  const links = existsSync(join(media, 'pull.json')) ? (JSON.parse(readFileSync(join(media, 'pull.json'), 'utf8')) as { links: { tel: string[]; mailto: string[] } }).links : { tel: [], mailto: [] };
  const linkText = [...links.tel.map((t) => decodeURIComponent(t)), ...links.mailto].join('\n');
  const known = numberSet(`${pulled}\n${linkText}\n${ownSiteText(slug)}`);
  for (const w of wordsOf(raw)) {
    for (const i of numberIssues(w.text, w.at, known)) out.push(`figure "${i.text}" at ${w.at} is not on their site: "${i.context}"`);
    for (const i of dashIssues(w.text, w.at)) out.push(`dash at ${w.at}: "${i.context}"`);
    for (const i of bannedIssues(w.text, w.at)) out.push(`banned word "${i.text}" at ${w.at}`);
    if (c.engine === 'physio' && /\b(testimonials?|reviews?|rated|ratings?)\b|★/i.test(w.text)) out.push(`physio page mentions a testimonial, review or rating at ${w.at}: "${w.text.slice(0, 80)}"`);
  }
  const ids = new Set(c.photos.map((p) => p.id));
  for (const p of c.photos) if (!existsSync(join(media, p.file))) out.push(`photo ${p.id}: ${p.file} is not in ${media}`);
  const used = [c.hero.photo, c.hero.inset, ...(c.story?.steps.map((s) => s.photo) ?? []), ...(c.offers?.items.map((i) => i.photo) ?? []), ...(c.people?.items.map((i) => i.photo) ?? []), ...(c.signature?.kind === 'rooms' ? c.signature.units.map((u) => u.photo) : []), ...c.gallery].filter((x): x is string => !!x);
  for (const id of used) if (!ids.has(id)) out.push(`photo ${id} is used but not listed in photos`);
  for (const id of new Set(used)) if (used.filter((x) => x === id).length > 1) out.push(`photo ${id} is used ${used.filter((x) => x === id).length} times`);
  const own = c.domain.replace(/^www\./, '');
  const sources = JSON.stringify(raw).match(/"source":\s*"([^"]+)"/g) ?? [];
  for (const m of sources) {
    const url = m.replace(/^"source":\s*"/, '').replace(/"$/, '');
    let h = '';
    try {
      h = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      // not an address
    }
    if (h !== own && !h.endsWith(`.${own}`)) out.push(`source ${url} is not on ${own}`);
  }
  if (c.palette.family !== c.look.family) out.push(`look.family ${c.look.family} is not the palette's family ${c.palette.family}`);
  return [...new Set(out)];
}

/** The address a page will have once deployed. */
export const SITE_ADDRESS = 'https://nahltech.com';

/** Where a finding's evidence is linked from, in words for the email inputs. */
function linkedFromText(f: FactPack['findings'][number], website: string): string {
  if (f.linked_from) return f.linked_from;
  if (f.type === 'booking_page_unlinked') return 'nothing on the site links to it (that is the finding)';
  const on = measuredOn(f, website);
  if (bare(on) !== bare(f.evidence_url)) return `${on} (the homepage)`;
  return 'not linked from another page: the evidence is the page itself';
}

/**
 * The email inputs of one business: who it goes to and on what authority, the greeting, the demo
 * address, the findings as the page states them, the concept, and everything to check before sending.
 */
export function emailBlock(d: Db, slug: string): string {
  const pack = loadPack(slug);
  const config = EngineConfig.parse(JSON.parse(readFileSync(join(contentDir(slug), 'engine.json'), 'utf8')));
  const token = tokenFor(d, slug);
  const built = existsSync(join(previewPaths.data, `${slug}.json`));
  const L: string[] = [`## ${slug}`, '', `- Business: ${pack.name}`, `- To: ${pack.to.address ?? 'none found'} (source: ${pack.to.source_url ?? 'none'})`, `- Greeting: ${pack.greeting_names.length ? pack.greeting_names.join(' and ') : 'none found'}${pack.owner_source_url ? ` (source: ${pack.owner_source_url})` : ''}`, `- Demo URL (not live yet): ${token ? `${SITE_ADDRESS}${BASE_PATH}/${slug}-${token}` : 'no token yet'}${built ? '' : ' (page not built)'}`, `- Concept: ${config.concept}`, ''];
  for (const f of [...pack.findings].sort((a, b) => a.place - b.place).slice(0, 3)) {
    L.push(`Finding ${f.place}: ${f.sentence}`, `- Measured: ${f.measured} (${nzReadable(f.measured_at)} NZ time)`, `- Evidence URL: ${f.evidence_url}`, `- Linked from: ${linkedFromText(f, pack.website)}`, '');
  }
  const flags: string[] = [];
  if (pack.recheck) flags.push(`Measured ${nzReadable(pack.recheck.measured_at)} NZ time; ${new Date(pack.recheck.fresh_until) < new Date() ? 'expired' : 'fresh until'} ${nzReadable(pack.recheck.fresh_until)}: recheck before sending with \`${pack.recheck.command}\`.`);
  for (const f of pack.findings.slice(0, 3)) {
    const caution = /Caution from Crawlmouse:\s*(.*)$/s.exec(f.measured)?.[1];
    if (caution) flags.push(`Finding ${f.place} carries a note from Crawlmouse: "${caution.trim()}"`);
  }
  if (pack.findings.some((f) => f.type === 'physio_testimonials')) flags.push('The testimonial finding is shown on the page without quoting any testimonial.');
  if (pack.flags.security_review.length) flags.push('Security review flag on file: leave it out of the email and the page, as instructed.');
  for (const x of pack.flags.facts_changed) flags.push(`Facts changed: ${x}`);
  for (const x of pack.flags.faith) flags.push(`Faith: ${x}`);
  if (pack.flags.refuses_unsolicited) flags.push(`Refuses unsolicited contact: ${pack.flags.refuses_unsolicited}`);
  for (const x of pack.notes?.trading_signs ?? []) flags.push(`Trading sign: ${x}`);
  if (pack.notes?.csv) flags.push(`List note: ${pack.notes.csv}`);
  // What was noticed while the page was made, one line each, kept beside its settings.
  const notes = join(contentDir(slug), 'notes.txt');
  if (existsSync(notes)) for (const line of readFileSync(notes, 'utf8').split('\n').map((x) => x.trim()).filter(Boolean)) flags.push(`Page: ${line}`);
  L.push(`Flags: ${flags.length ? '' : 'none'}`, ...flags.map((x) => `- ${x}`), '');
  return L.join('\n');
}

const SITE_PORT = 4341;

export function registerEnginePages(engine: Command): void {
  const pages = engine.command('pages').description(`The real pages of ${PAGES_WAVE} made by the engines: build, gates, contact sheets and a local server. Nothing is deployed.`);

  pages
    .command('build')
    .description('Grade the photos and write the page data of each page with engine settings (tokens are made once), then build the local site of these pages')
    .option('--only <slugs>', 'comma separated slugs')
    .option('--no-site', 'write the page data only')
    .option('--draft', 'build without CAL_LINK')
    .option('--site-only', 'only build the local site from the page data already written')
    .action(async (o: { only?: string; site?: boolean; draft?: boolean; siteOnly?: boolean }) => {
      const call = env().CAL_LINK;
      if (!call && !o.draft) throw new Error('CAL_LINK is not set in .env. Use --draft to build without it.');
      const d = db();
      for (const slug of o.siteOnly ? [] : pageSlugs(o.only)) {
        const data = await buildRealPage(d, slug, call || `mailto:${REPLY_EMAIL}?subject=${encodeURIComponent('15 minute call')}`);
        if (!data) continue;
        const demo = data.demo as { heroKind: string; heroNote: string | null; look: { type: string; family: string } };
        console.log(`${slug}: /${data.path}/ ${data.design}, ${demo.heroKind} hero${demo.heroNote ? ` (${demo.heroNote})` : ''}, ${demo.look.type}, ${demo.look.family}, ${Object.keys(data.images).length} images, ${data.findings.length} findings`);
      }
      if (o.site !== false) {
        buildPagesSite(pageSlugs().filter((s) => existsSync(join(previewPaths.data, `${s}.json`))));
        console.log(`Site: ${join(PAGES_OUT, 'site')}`);
      }
    });

  pages
    .command('prep <slugs>')
    .description('Ready businesses for their settings (comma separated, homepage pulled first with plumb engine pull --pages): photos ranked on a numbered sheet and their words in one file, under previews/review/<wave>/pages/prep/<slug>/')
    .action(async (slugs: string) => {
      for (const slug of slugs.split(',').map((x) => x.trim()).filter(Boolean)) {
        const r = await prepPage(slug);
        console.log(`${slug}: ${r.photos} photos (${r.heroOk} hero ok), ${r.pages} pages of text`);
      }
    });

  pages
    .command('lint')
    .description("Check each page's settings before it is built: schema, figures on their own site, dashes, banned words, physio testimonials, photos and sources")
    .option('--only <slugs>', 'comma separated slugs')
    .action((o: { only?: string }) => {
      let bad = 0;
      for (const slug of pageSlugs(o.only)) {
        const issues = lintSettings(slug);
        console.log(`${slug}: ${issues.length ? `${issues.length} problem(s)` : 'clean'}`);
        for (const i of issues) console.log(`  ${i}`);
        if (issues.length) bad++;
      }
      if (bad) process.exitCode = 1;
    });

  pages
    .command('site')
    .description('Stage and build the whole site for a deploy into previews/out/site: the pages live now (read from another working copy) and this wave. Nothing is deployed.')
    .requiredOption('--live <dir>', "the previews/out folder the live pages were last deployed from (read only)")
    .action((o: { live: string }) => {
      const r = stageWholeSite(o.live, pageSlugs());
      for (const h of r.held) console.log(`held: ${h.slug}, ${h.why}`);
      const n = buildWholeSite();
      console.log(`Built ${n} pages into ${previewPaths.site}: ${r.live.length} live now, ${r.wave.length} of ${PAGES_WAVE}.`);
    });

  pages
    .command('emails')
    .description(`Write ${join('reports', 'nz-tourism-1', PAGES_WAVE, 'EMAIL-INPUTS.md')}: one block per page with its recipient, greeting, demo address, findings, concept and flags`)
    .option('--only <slugs>', 'comma separated slugs')
    .action((o: { only?: string }) => {
      const d = db();
      const slugs = pageSlugs(o.only);
      const head = [`# Wave 4 email inputs`, '', `${slugs.length} pages, written ${nzReadable(new Date().toISOString())} NZ time. The demo addresses are not live until the pages are deployed. Speed was skipped for this wave.`, ''];
      const file = join(PACKS_DIR, 'EMAIL-INPUTS.md');
      writeFileSync(file, [...head, ...slugs.map((slug) => emailBlock(d, slug))].join('\n'));
      console.log(file);
    });

  pages
    .command('gates')
    .description('Every gate of the Premium Standard on each page of the local site, with the figures held to the pages of their own site we read')
    .option('--only <slugs>', 'comma separated slugs')
    .option('--runs <n>', 'Lighthouse runs per page (median)', (v) => Number(v), 3)
    .option('--skip <gates>', 'comma separated: lighthouse, overflow, axe, type, copy, links, beacon')
    .action(async (o: { only?: string; runs: number; skip?: string }) => {
      const { server, base } = await serveSite(join(PAGES_OUT, 'site'), SITE_PORT + 1);
      const results: SampleGate[] = [];
      try {
        for (const slug of pageSlugs(o.only)) {
          const data = pageData(slug);
          const pack = loadPack(slug);
          const r = await gateEnginePage({ slug, url: `${base}${BASE_PATH}/${data.path}/`, path: data.path, dir: pageMedia(slug), ownSite: ownSiteText(slug), measured: measuredText(pack), physio: data.design === 'physio' }, { runs: o.runs, skip: new Set((o.skip ?? '').split(',').filter(Boolean)) });
          results.push(r);
          const l = r.lighthouse;
          console.log(`${slug}: perf ${l.performance} a11y ${l.accessibility} LCP ${l.lcpMs === null ? '-' : (l.lcpMs / 1000).toFixed(2)} s CLS ${l.cls === null ? '-' : l.cls.toFixed(3)} TBT ${l.tbtMs === null ? '-' : Math.round(l.tbtMs)} ms | ${r.failures.length ? 'FAIL' : 'pass'}`);
          for (const f of r.failures) console.log(`  ${f}`);
        }
      } finally {
        server.close();
      }
      mkdirSync(join(PAGES_OUT, 'gates'), { recursive: true });
      writeFileSync(join(PAGES_OUT, 'gates', `gates-${Date.now()}.json`), JSON.stringify(results, null, 2));
      if (results.some((r) => r.failures.length)) process.exitCode = 1;
    });

  pages
    .command('sheets')
    .description('Contact sheets of the first phone screens and the first desktop screens of the pages, from the local site')
    .option('--only <slugs>', 'comma separated slugs')
    .option('--out <dir>', 'where the sheets go', join(previewPaths.review, PAGES_WAVE, 'pages'))
    .action(async (o: { only?: string; out: string }) => {
      const shots = join(o.out, 'shots');
      mkdirSync(shots, { recursive: true });
      const { server, base } = await serveSite(join(PAGES_OUT, 'site'), SITE_PORT + 2);
      const phone: { file: string; label: string }[] = [];
      const desktop: { file: string; label: string }[] = [];
      try {
        for (const slug of pageSlugs(o.only)) {
          if (!existsSync(join(previewPaths.data, `${slug}.json`))) continue;
          const data = pageData(slug);
          const url = `${base}${BASE_PATH}/${data.path}/`;
          const [first] = await phoneShots(url, shots, slug, { screens: 1, mid: false });
          phone.push({ file: first!, label: slug });
          const wide = join(shots, `${slug}-desktop1.jpg`);
          await desktopShot(url, wide);
          desktop.push({ file: wide, label: slug });
          console.log(`${slug}: shots taken`);
        }
      } finally {
        server.close();
      }
      await contactSheet(phone, join(o.out, 'contact-sheet-phone.jpg'), 390, 844, 6);
      await contactSheet(desktop, join(o.out, 'contact-sheet-desktop.jpg'), 640, 400, 3);
      console.log(`${join(o.out, 'contact-sheet-phone.jpg')}\n${join(o.out, 'contact-sheet-desktop.jpg')}`);
    });

  pages
    .command('serve')
    .description('Serve the pages on this machine for clicking through. Their visit reports come back to this server and are dropped; nothing reaches the live address.')
    .option('--port <n>', 'port', (v) => Number(v), SITE_PORT)
    .action(async (o: { port: number }) => {
      const { base } = await serveSite(join(PAGES_OUT, 'site'), o.port, { quiet: true });
      const d = db();
      console.log(`Serving ${join(PAGES_OUT, 'site')} at ${base}. Visit reports are answered here and never sent. Ctrl+C stops it.`);
      for (const slug of pageSlugs()) {
        const token = tokenFor(d, slug);
        if (token && existsSync(join(PAGES_OUT, 'site', BASE_PATH.slice(1), `${slug}-${token}`))) console.log(`  ${base}${BASE_PATH}/${slug}-${token}/?${OWN_VISIT.param}=1`);
      }
    });
}
