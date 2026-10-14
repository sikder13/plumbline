import { randomInt } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp, { type Sharp } from 'sharp';
import { config, nzTime, paths, utcIso, type Business, type Db } from '@plumbline/core';
import { aiSummary } from '@plumbline/ai';
import { CHECK_IDS } from '@plumbline/checks';
import { latestBatch } from '@plumbline/export';
import { loadLibrary } from '@plumbline/impact';
import { businessView, type EvidenceRow, type FindingView } from '@plumbline/report';
import { loadCrawlmouse as loadWaveCrawlmouse, ownerOrder, speedRuns, speedSeen, statedSentence } from '@plumbline/wave';
import { correctedQuestions, correctedSummary } from './ai.ts';
import { loadCrawlmouse, loadVerified } from './crawlmouse.ts';
import { contentDir, previewPaths } from './paths.ts';
import { loadRecipe, recipeContent, recipeFile } from './recipe.ts';
import type { ContentFile, FindingCard, PageData, Picture, SecondCheck, Strength } from './types.ts';

/** The pages are served under this path on the main site. */
export const BASE_PATH = '/demo';

const TOKEN_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
const tokenKey = (slug: string) => `preview_token:${slug}`;

/** Six random characters per business, kept so the address stays the same between builds. */
export function ensureToken(db: Db, slug: string): string {
  const row = db.prepare('SELECT value FROM kv WHERE key = ?').get(tokenKey(slug)) as { value: string } | undefined;
  if (row) return row.value;
  const token = Array.from({ length: 6 }, () => TOKEN_ALPHABET[randomInt(TOKEN_ALPHABET.length)]).join('');
  db.prepare('INSERT INTO kv (key, value, at) VALUES (?, ?, ?)').run(tokenKey(slug), token, utcIso());
  return token;
}

export function tokenFor(db: Db, slug: string): string | null {
  return (db.prepare('SELECT value FROM kv WHERE key = ?').get(tokenKey(slug)) as { value: string } | undefined)?.value ?? null;
}

export function forgetToken(db: Db, slug: string): void {
  db.prepare('DELETE FROM kv WHERE key = ?').run(tokenKey(slug));
}

/** Whether a page is laid out from a recipe by the section library, rather than by a design of its own. */
export function hasRecipe(slug: string): boolean {
  return existsSync(recipeFile(slug));
}

export function loadContent(slug: string): ContentFile {
  if (hasRecipe(slug)) return recipeContent(loadRecipe(slug));
  const file = join(contentDir(slug), 'content.json');
  if (!existsSync(file)) throw new Error(`${file} does not exist`);
  return JSON.parse(readFileSync(file, 'utf8')) as ContentFile;
}

/** Where a page's photographs and film are read from: the folder its wave was researched into, or its own content folder. */
export function mediaDir(slug: string, content: Pick<ContentFile, 'wave'> = loadContent(slug)): string {
  return content.wave ? join(paths.data, 'wave', slug) : contentDir(slug);
}

const DEFAULT_WIDTHS = [480, 800, 1200, 1800];

type Crop = { left: number; top: number; width: number; height: number };

/**
 * A crop in whole pixels. One given in fractions (all values at most 1) is measured against the
 * photograph, and is held inside it: two rounded fractions can add up to a pixel more than there is.
 */
export function cropInPixels(c: Crop, width: number, height: number): Crop {
  const fractional = c.left <= 1 && c.top <= 1 && c.width <= 1 && c.height <= 1;
  if (!fractional) return c;
  const left = Math.min(width - 1, Math.round(c.left * width));
  const top = Math.min(height - 1, Math.round(c.top * height));
  return { left, top, width: Math.max(1, Math.min(width - left, Math.round(c.width * width))), height: Math.max(1, Math.min(height - top, Math.round(c.height * height))) };
}

function hex(n: number): string {
  return Math.round(n).toString(16).padStart(2, '0');
}

/** Writes AVIF and WebP versions of one photo at phone and desktop widths. Skips files that are already newer than the source. */
export async function buildPicture(source: string, outDir: string, urlBase: string, key: string, spec: ContentFile['images'][string]): Promise<Picture> {
  if (!existsSync(source)) throw new Error(`image ${source} does not exist`);
  mkdirSync(outDir, { recursive: true });
  // A crop given in fractions (all values at most 1) is measured against the photo, so it survives a re-download at another size.
  const whole = await sharp(source).rotate().toBuffer({ resolveWithObject: true });
  const crop = spec.crop ? cropInPixels(spec.crop, whole.info.width, whole.info.height) : undefined;
  const base = () => {
    const img = sharp(source).rotate();
    return crop ? img.extract(crop) : img;
  };
  const meta = await base().toBuffer({ resolveWithObject: true });
  const full = { width: meta.info.width, height: meta.info.height };
  const widths = [...new Set((spec.widths ?? DEFAULT_WIDTHS).map((w) => Math.min(w, full.width)))].sort((a, b) => a - b);
  // What the stored versions were made from. A key that now points at another photo, or another crop of it, is made again.
  // A photograph with no quality of its own is recorded as it always was, so nothing already made is made again.
  const made = `${source}|${JSON.stringify(crop ?? null)}|${statSync(source).mtimeMs}${spec.quality ? `|q${spec.quality}` : ''}`;
  const madeFile = join(outDir, `${key}.made`);
  const current = existsSync(madeFile) && readFileSync(madeFile, 'utf8') === made;
  const formats = [
    { ext: 'avif', type: 'image/avif', write: (img: Sharp) => img.avif({ quality: spec.quality ?? 48, effort: 5 }) },
    { ext: 'webp', type: 'image/webp', write: (img: Sharp) => img.webp({ quality: spec.quality ? spec.quality + 22 : 70, effort: 5 }) },
  ];
  const sources: Picture['sources'] = [];
  for (const f of formats) {
    const parts: string[] = [];
    for (const w of widths) {
      const name = `${key}-${w}.${f.ext}`;
      const file = join(outDir, name);
      if (!current || !existsSync(file)) await f.write(base().resize({ width: w, withoutEnlargement: true })).toFile(file);
      parts.push(`${urlBase}/${name} ${w}w`);
    }
    sources.push({ type: f.type, srcset: parts.join(', ') });
  }
  writeFileSync(madeFile, made);
  const { channels } = await sharp(meta.data).stats();
  const mid = widths[Math.min(1, widths.length - 1)]!;
  return {
    width: full.width,
    height: full.height,
    alt: spec.alt,
    sources,
    fallback: `${urlBase}/${key}-${mid}.webp`,
    colour: `#${hex(channels[0]!.mean)}${hex(channels[1]!.mean)}${hex(channels[2]!.mean)}`,
    position: spec.position ?? null,
  };
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "11 October 2026, 4:52 pm" in New Zealand time. */
export function nzReadable(iso: string): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-NZ', { timeZone: 'Pacific/Auckland', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day} ${MONTHS[Number(p.month) - 1]} ${p.year}, ${p.hour}:${p.minute} ${String(p.dayPeriod).toLowerCase().replace(/\./g, '')}`;
}

/** The library's impact sentence, less any sentence that leans on an outside figure or study. */
export function plainImpact(impact: string): string {
  const sentences = impact.match(/[^.!?]+[.!?]+(?:\s|$)/g) ?? [impact];
  const kept = sentences.map((s) => s.trim()).filter((s) => !/\d|\bstudy\b|\bsays\b/i.test(s));
  return kept.join(' ');
}

/** Dates stored as 2018-12-31 are written out as 31 December 2018. */
export function plainDates(text: string): string {
  return text.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_, y: string, m: string, d: string) => `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`);
}

/** What was recorded as seen, made readable: no code, no rule names, dates written out. */
export function plainSeen(excerpt: string | null): string | null {
  if (!excerpt) return null;
  let s = excerpt.split(/\s+HTML:|\s<[a-z!]|\s+\|\s+Listing\b/i)[0]!;
  // Rule names, links and language codes in brackets are for us, not for the reader. Anything else in brackets is part of what was seen.
  s = plainDates(s.replace(/\s*\((?:[a-z-]+, (?:serious|critical|moderate|minor), \d+ elements?|https?:[^)]*|[a-z]{2,3})\)/g, ''));
  s = s.replace(/\s+\|\s+/g, ', ').replace(/\s+/g, ' ').trim();
  if (s.length > 260) s = `${s.slice(0, 260).replace(/\s+\S*$/, '')}.`;
  return s || null;
}

const DASH = '[-‐‒–—―−]';
const MONEY = String.raw`(?:[A-Z]{2})?\$\s?\d[\d,]*(?:\.\d+)?(?:pp)?`;
const CLOCK = String.raw`\d{1,2}(?:[:.]\d{2})?\s?[ap]m`;
/** A dash between two prices, or between two times of day, marks a range. A price run straight into a number by a dash does too. */
const RANGES = [new RegExp(`(${MONEY})\\s*${DASH}\\s*(?=${MONEY})`, 'g'), new RegExp(`(${MONEY})${DASH}(?=\\d)`, 'g'), new RegExp(`(${CLOCK})\\s*${DASH}\\s*(?=${CLOCK})`, 'gi')];

/**
 * Words quoted from a site, without the dashes a page may not carry, even inside a quotation. A
 * range of prices or of hours is written with "to", so that it still reads as a range. Any other
 * dash set off by spaces becomes a comma.
 */
export function withoutDashes(text: string | null): string | null {
  if (text === null) return null;
  return RANGES.reduce((s, range) => s.replace(range, '$1 to '), text).replace(new RegExp(`\\s+${DASH}\\s+`, 'g'), ', ');
}

async function evidenceImage(e: EvidenceRow, outDir: string, urlBase: string, name: string): Promise<{ src: string; width: number; height: number } | null> {
  if (!e.path || !existsSync(e.path)) return null;
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, `${name}.webp`);
  const info = await sharp(e.path).resize({ width: 880, height: 1100, fit: 'cover', position: 'top', withoutEnlargement: true }).webp({ quality: 72 }).toFile(file);
  return { src: `${urlBase}/${name}.webp`, width: info.width, height: info.height };
}

export interface Dropped {
  check: string;
  title: string;
  reason: string;
}

export interface BuildResult {
  data: PageData;
  dropped: Dropped[];
  warnings: string[];
}

const AI_CHECK = 'C37_not_named_by_ai';
/** A finding with two contradicting sightings needs both shown. Every other card shows one. */
const TWO_SHOTS = new Set(['C60_conflicting_facts']);

export interface BuildOptions {
  replyEmail: string;
  callLink: string;
  now?: Date;
}

/** The parts of a Crawlmouse summary a page shows, however the summary was filed. */
export interface SecondCrawl {
  site_score: number | null;
  grade: string | null;
  ai_readiness?: { score: number } | null;
  ai_readiness_score?: number;
  ai_crawler_access?: string | null;
  /** What the second tool says of broken links, such as "None found." */
  broken_links?: string | null;
}

/**
 * What the page of a wave's business says of the second crawl: its scores where a summary is on file, and up to
 * three approved findings. Null when there is neither, and the page then says nothing of it.
 */
export function secondCheckOf(summary: SecondCrawl | null, findings: string[]): SecondCheck | null {
  if (!summary && !findings.length) return null;
  const readiness = summary?.ai_readiness?.score ?? summary?.ai_readiness_score ?? null;
  return {
    score: summary && summary.site_score !== null && summary.grade ? `${Math.round(summary.site_score)} out of 100 (grade ${summary.grade})` : null,
    aiReadiness: readiness === null ? null : `${readiness} out of 100`,
    crawlerAccess: summary?.ai_crawler_access ? summary.ai_crawler_access.replace(/\s*(This is )?a strength, not a finding\.?/i, '').replace(/\s*\(([^)]*)\)/, ': $1').trim() : null,
    // A clean result is worth saying. Broken links that were found come as findings, not here.
    ...(/^\s*none found\b/i.test(summary?.broken_links ?? '') ? { brokenLinks: 'None found' } : {}),
    // A page carries no dash, so one inside a title it quotes is set as a comma.
    findings: findings.slice(0, 3).map((f) => withoutDashes(f)!),
  };
}

/**
 * The second tool's findings a wave page lists under the second check: those approved, and after
 * them any the content file names. A named one must have held when we opened its pages ourselves,
 * so a finding that has since fallen away is never listed by an old content file.
 */
export function secondCheckList<T extends { id: number; status: string; reproduced: number }>(rows: T[], also: number[] = []): T[] {
  const approved = rows.filter((r) => r.status === 'approved');
  const named = also.filter((id) => !approved.some((r) => r.id === id)).map((id) => {
    const row = rows.find((r) => r.id === id);
    if (!row) throw new Error(`finding ${id} is not one of the second check's findings for this business`);
    if (!row.reproduced || row.status === 'resolved') throw new Error(`finding ${id} did not hold when we opened its pages ourselves`);
    return row;
  });
  return [...approved, ...named];
}

/** Gathers everything one page shows and writes its images. Nothing is written to the repository. */
export async function buildPage(db: Db, slug: string, opts: BuildOptions): Promise<BuildResult> {
  const b = db.prepare('SELECT * FROM businesses WHERE slug = ?').get(slug) as Business | undefined;
  if (!b) throw new Error(`no business with slug ${slug}`);
  const batch = latestBatch(db, b.id);
  if (!batch) throw new Error(`${slug} has not been audited`);
  const content = loadContent(slug);
  const now = opts.now ?? new Date();
  const token = ensureToken(db, slug);
  const path = `${slug}-${token}`;
  const assets = join(previewPaths.out, 'assets', path);
  const warnings: string[] = [];
  const dropped: Dropped[] = [];
  const name = content.name ?? b.name;

  const view = businessView(db, b, batch, loadLibrary(CHECK_IDS));
  const questions = correctedQuestions(slug);
  const corrected = questions.length ? correctedSummary(db, b, questions) : null;

  for (const f of view.findings.filter((x) => x.status === 'resolved')) dropped.push({ check: f.checkId, title: f.title, reason: 'did not reproduce when re-verified' });

  // The page of a business prepared as part of a wave states each finding as it is put to the owner, in the owner's order.
  const asWave = !!content.wave;
  const runs = asWave ? speedRuns(db, b.id, batch) : [];
  const said = (f: FindingView) => (asWave ? statedSentence(f, runs) : f.title);

  const cards: FindingCard[] = [];
  const held: FindingView[] = view.findings.filter((f) => f.status === 'approved');
  const approved = asWave ? ownerOrder(held, runs) : held;
  for (const f of approved) {
    if (f.checkId === AI_CHECK && corrected) {
      // The stored finding came from questions about the wrong kind of business. Only the corrected questions count.
      if (!corrected.complete) dropped.push({ check: f.checkId, title: f.title, reason: 'the corrected questions have not all been answered' });
      else if (corrected.namedIn > 0) dropped.push({ check: f.checkId, title: f.title, reason: `the corrected questions name the business in ${corrected.namedIn} of ${corrected.answers} answers` });
      else {
        const first = corrected.questions[0]!;
        const others = first.others.slice(0, 5).map((o) => o.name).join(', ');
        cards.push({ check: f.checkId, title: `Named in 0 of ${corrected.answers} AI answers`, sentence: plainImpact(f.impact.impact), fix: f.impact.fix, measuredNz: nzReadable(first.answers[0]!.askedAt), pageUrl: null, shots: [{ image: null, seen: `We asked: "${first.question}"${others ? ` The answers named: ${others}.` : ''}` }], score: f.score });
      }
      continue;
    }
    if (!f.lastVerifiedAt) {
      dropped.push({ check: f.checkId, title: f.title, reason: 'never re-verified' });
      continue;
    }
    const hours = (now.getTime() - new Date(f.lastVerifiedAt).getTime()) / 3_600_000;
    if (hours > config.fresh.maxAgeHours) warnings.push(`${f.checkId}: last verified ${hours.toFixed(1)} hours ago. Run plumb preview recheck before sending.`);
    const rows = f.evidence.slice(0, TWO_SHOTS.has(f.checkId) ? 2 : 1);
    const shots: FindingCard['shots'] = [];
    const seen = (e: EvidenceRow) => (!asWave ? plainSeen(e.excerpt) : f.checkId === 'C20_slow_mobile' ? (speedSeen(runs) ?? plainSeen(e.excerpt)) : withoutDashes(plainSeen(e.excerpt)));
    for (const [i, e] of rows.entries()) shots.push({ image: await evidenceImage(e, join(assets, 'evidence'), `${BASE_PATH}/${path}/evidence`, `${f.id}-${i + 1}`), seen: seen(e) });
    cards.push({ check: f.checkId, title: plainDates(said(f)), sentence: plainImpact(f.impact.impact), fix: f.impact.fix, measuredNz: nzReadable(f.evidence[0]?.captured_at_utc ?? f.lastVerifiedAt), pageUrl: f.pageUrl, shots, score: f.score });
  }
  if (!asWave) cards.sort((x, y) => y.score - x.score);

  const strengths: Strength[] = [];
  if (b.google_rating && b.google_review_count) strengths.push({ text: `Rated ${b.google_rating.toFixed(1)} from ${b.google_review_count} reviews.`, source: 'Google, October 2026' });
  if (corrected) {
    for (const q of corrected.questions.filter((x) => x.namedIn > 0)) strengths.push({ text: `AI tools named you in ${q.namedIn} of ${q.answers.length} answers when we asked: "${q.question}"`, source: `ChatGPT and Perplexity, ${nzReadable(q.answers[0]!.askedAt).split(',')[0]}` });
  } else {
    const ai = aiSummary(db, b, batch);
    if (ai?.sample && ai.namedIn > 0) strengths.push({ text: `AI tools named you in ${ai.namedIn} of ${ai.questions} answers when we asked: "${ai.sample.question}"`, source: `ChatGPT and Perplexity, ${nzReadable(ai.sample.askedAt).split(',')[0]}` });
  }
  for (const s of content.strengths ?? []) strengths.push(s);

  let secondCheck: SecondCheck | null = null;
  const cm = loadCrawlmouse(slug);
  if (asWave) {
    // What Crawlmouse wrote is kept where it was approved as a finding, or where the content file lists it and it held on our own reading. It is said in terms of what we read ourselves.
    const rows = db.prepare("SELECT id, check_id, severity, score, title, detail, status, reproduced FROM findings WHERE business_id = ? AND batch = ? AND source = 'crawlmouse'").all(b.id, batch) as { id: number; check_id: string; severity: number; score: number; title: string; detail: string; status: string; reproduced: number }[];
    const asFinding = (r: (typeof rows)[number]) => ({ id: r.id, checkId: r.check_id, severity: r.severity, score: r.score, title: r.title, detail: JSON.parse(r.detail || '{}') as Record<string, unknown> });
    const listed = secondCheckList(rows, content.secondCheckAlso);
    const kept = [...ownerOrder(listed.filter((r) => r.status === 'approved').map(asFinding), runs), ...listed.filter((r) => r.status !== 'approved').map(asFinding)];
    // The summary of a wave's business is filed with the wave's inputs, not where the first pages kept theirs.
    secondCheck = secondCheckOf(cm ?? loadWaveCrawlmouse(slug, b.website), kept.map((f) => `${statedSentence(f, runs)}.`));
  } else if (cm) {
    const verified = loadVerified(slug);
    const keep = (verified?.findings ?? []).filter((x) => x.verified).map((x) => x.text);
    for (const x of cm.findings_plain) if (!keep.includes(x.text)) dropped.push({ check: 'Crawlmouse', title: x.text, reason: verified?.findings.find((v) => v.text === x.text)?.reason ?? 'not re-verified yet' });
    secondCheck = {
      score: cm.site_score !== null && cm.grade ? `${Math.round(cm.site_score)} out of 100 (grade ${cm.grade})` : null,
      aiReadiness: cm.ai_readiness ? `${cm.ai_readiness.score} out of 100` : null,
      crawlerAccess: cm.ai_crawler_access ? cm.ai_crawler_access.replace(/\s*This is a strength, not a finding\.?/i, '').replace(/\s*\(([^)]*)\)/, ': $1').trim() : null,
      findings: keep.slice(0, 3),
    };
  }

  const images: Record<string, Picture> = {};
  for (const [key, spec] of Object.entries(content.images)) images[key] = await buildPicture(join(mediaDir(slug, content), spec.file), join(assets, 'img'), `${BASE_PATH}/${path}/img`, key, spec);

  let video: string | null = null;
  if (content.video) {
    const from = join(mediaDir(slug, content), content.video.file);
    if (!existsSync(from)) throw new Error(`video ${from} does not exist`);
    if (statSync(from).size > 2_000_000) throw new Error(`${from} is over 2 MB`);
    mkdirSync(join(assets, 'media'), { recursive: true });
    copyFileSync(from, join(assets, 'media', 'hero.mp4'));
    video = `${BASE_PATH}/${path}/media/hero.mp4`;
  }

  const data: PageData = {
    slug,
    token,
    path,
    name,
    domain: b.domain ?? '',
    design: content.design,
    demo: content.demo,
    images,
    video,
    findings: cards,
    strengths,
    rating: b.google_rating && b.google_review_count ? { value: b.google_rating.toFixed(1), count: b.google_review_count } : null,
    secondCheck,
    reply: { email: opts.replyEmail, subject: `${name} website`, call: opts.callLink },
    builtAtNz: nzTime(now),
  };
  mkdirSync(previewPaths.data, { recursive: true });
  writeFileSync(join(previewPaths.data, `${slug}.json`), JSON.stringify(data, null, 2));
  return { data, dropped, warnings };
}

/** Deletes everything generated for one business. The content folder is left alone. */
export function removeGenerated(db: Db, slug: string): string | null {
  const token = tokenFor(db, slug);
  rmSync(join(previewPaths.data, `${slug}.json`), { force: true });
  if (token) {
    rmSync(join(previewPaths.out, 'assets', `${slug}-${token}`), { recursive: true, force: true });
    rmSync(join(previewPaths.site, BASE_PATH, `${slug}-${token}`), { recursive: true, force: true });
  }
  rmSync(join(previewPaths.review, slug), { recursive: true, force: true });
  return token;
}
