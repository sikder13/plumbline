import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import * as cheerio from 'cheerio';
import { bothTimes, paths, slugify, type Box, type Db } from '@plumbline/core';
import { scoreOf } from '@plumbline/checks';
import { cropElement, pageShot } from '@plumbline/evidence';
import type { PageCapture, Renderer } from '@plumbline/render';
import { readPage, sameAddress, savedHtml } from './pages.ts';

/** A Crawlmouse summary as UD supplies it: plain sentences, each with example pages. */
export interface CrawlmouseSummary {
  audited_at?: string;
  audit_id?: string;
  site_score: number | null;
  grade: string | null;
  confidence?: string;
  pages_read?: number;
  coverage_pct?: number;
  ai_readiness_score?: number;
  ai_crawler_access?: string;
  note?: string;
  findings_plain: { text: string; examples: string[]; caution?: string }[];
}

function jsonFilesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? jsonFilesUnder(join(dir, e.name)) : e.name.endsWith('.json') ? [join(dir, e.name)] : []));
}

/** The summary for a business, wherever it sits under the inputs folder. A long slug may be filed under its first words. */
export function crawlmouseFileFor(slug: string, inputsRoot: string = paths.inputs): string | null {
  const files = jsonFilesUnder(inputsRoot).filter((f) => f.split(/[\\/]/).includes('crawlmouse'));
  const name = (f: string) => basename(f, '.json');
  return files.find((f) => name(f) === slug) ?? files.filter((f) => slug.startsWith(`${name(f)}-`)).sort((a, b) => name(b).length - name(a).length)[0] ?? null;
}

export function loadCrawlmouse(slug: string, inputsRoot?: string): CrawlmouseSummary | null {
  const file = crawlmouseFileFor(slug, inputsRoot);
  return file ? (JSON.parse(readFileSync(file, 'utf8')) as CrawlmouseSummary) : null;
}

export type Claim = 'missing_page' | 'orphan_page' | 'no_meta_description' | 'no_main_heading' | 'no_structured_data' | 'thin_page' | 'leftover_page';

const CLAIMS: [Claim, RegExp][] = [
  ['missing_page', /\b404\b|missing pages?|broken links?|links? (?:are|is) broken/i],
  ['orphan_page', /not linked from anywhere|\bunlinked\b/i],
  ['no_meta_description', /meta description/i],
  ['no_main_heading', /main heading|\bH1\b/],
  ['no_structured_data', /structured data/i],
  ['thin_page', /very little text|nearly empty/i],
  ['leftover_page', /\bleftover\b|still live\b/i],
];

/** What a sentence claims, in the order it claims it. A sentence that claims none of these cannot be tested by opening its examples. */
export function claimsIn(text: string): Claim[] {
  return CLAIMS.map(([claim, re]) => ({ claim, at: text.search(re) })).filter((c) => c.at >= 0).sort((a, b) => a.at - b.at).map((c) => c.claim);
}

export interface PageState {
  url: string;
  status: number | null;
  /** The page answers with an error, or says itself that it was not found. */
  missing: boolean;
  metaDescription: boolean;
  mainHeading: boolean;
  structuredData: boolean;
  words: number;
  title: string;
}

const NOT_FOUND = /\bnot found\b|\b404\b|\bpage (?:doesn'?t|does not) exist\b|\bno longer (?:exists|available)\b/i;

/** What one page shows when opened: read from the page as a browser renders it, and from its source. */
export function pageState(page: PageCapture, html: string): PageState {
  const $ = html ? cheerio.load(html) : null;
  const headings = [...page.meta.h1, ...page.blocks.filter((b) => b.heading === 'h1').map((b) => b.text)].map((h) => h.trim()).filter(Boolean);
  const live = page.status !== null && page.status >= 200 && page.status < 300;
  return {
    url: page.finalUrl,
    status: page.status,
    missing: (page.status !== null && page.status >= 400) || (live && NOT_FOUND.test(`${page.meta.title} ${headings.join(' ')}`)),
    metaDescription: !!page.meta.description?.trim(),
    mainHeading: headings.length > 0 || (!!$ && $('h1 img[alt]').filter((_, e) => !!$(e).attr('alt')?.trim()).length > 0),
    structuredData: page.meta.jsonld.length > 0 || (!!$ && $('[itemscope], [typeof]').length > 0),
    words: page.text.split(/\s+/).filter(Boolean).length,
    title: page.meta.title,
  };
}

export interface Linker {
  pageUrl: string;
  text: string;
  where: 'menu' | 'footer' | 'page';
  box: Box | null;
}

/** Link words as a person reads them: without icon glyphs and stray spacing. */
const linkText = (t: string) => t.replace(/[\ue000-\uf8ff\u200b-\u200d\ufeff]/g, '').replace(/\s+/g, ' ').trim();

/**
 * The pages that link to an address, one link for each: a link a visitor can see, or one folded
 * away in the menu. On a page the link with words on it is taken before a picture or a button,
 * and pages whose link has words come first.
 */
export function linkersOf(pages: PageCapture[], target: string): Linker[] {
  const out: Linker[] = [];
  for (const page of pages) {
    if (!page.ok || sameAddress(page.finalUrl, target) || out.some((l) => sameAddress(l.pageUrl, page.finalUrl))) continue;
    const matches = page.links.filter((l) => sameAddress(l.href, target));
    const link = matches.find((l) => l.visible && linkText(l.text)) ?? matches.find((l) => l.visible) ?? matches.find((l) => l.inNav && linkText(l.text)) ?? matches.find((l) => l.inNav);
    if (link) out.push({ pageUrl: page.finalUrl, text: linkText(link.text), where: link.inNav ? 'menu' : link.inFooter ? 'footer' : 'page', box: link.visible ? link.box : null });
  }
  return [...out.filter((l) => l.text), ...out.filter((l) => !l.text)];
}

export interface ExampleState extends PageState {
  linkedFrom: Linker[];
}

export interface Verdict {
  confirmed: boolean;
  /** What we measured, in words, when the sentence holds. */
  measured: string | null;
  /** Why it was dropped, when it does not. */
  reason: string | null;
}

const THIN_WORDS = 150;
const ABSENCE: Partial<Record<Claim, { label: string; shown: (p: PageState) => boolean; has: string; all: string }>> = {
  no_meta_description: { label: 'meta description', shown: (p) => !p.metaDescription, has: 'has a meta description', all: 'have one' },
  no_main_heading: { label: 'main heading', shown: (p) => !p.mainHeading, has: 'has a main heading', all: 'have one' },
  no_structured_data: { label: 'structured data', shown: (p) => !p.structuredData, has: 'carries structured data', all: 'carry some' },
};
const live = (p: PageState) => p.status !== null && p.status >= 200 && p.status < 300 && !p.missing;
const pagesWord = (n: number) => (n === 1 ? 'the example page' : `the ${n} example pages`);

function linkWords(l: Linker): string {
  const where = l.where === 'page' ? '' : `${l.where} `;
  return l.text ? `The ${where}link "${l.text}" on ${l.pageUrl} leads to it.` : `A ${where}link with no words on it (a picture or a button) on ${l.pageUrl} leads to it.`;
}

const answers = (e: ExampleState) => (e.status !== null && e.status >= 400 ? `answers ${e.status} (not found)` : `says it was not found (status ${e.status})`);

/** Whether one example shows one claim, and if not, why not. */
function shows(claim: Claim, e: ExampleState): { ok: boolean; why: string } {
  switch (claim) {
    case 'missing_page':
      return e.missing ? { ok: true, why: '' } : { ok: false, why: `${e.url} now loads (status ${e.status})` };
    case 'orphan_page':
      if (!live(e)) return { ok: false, why: `${e.url} no longer loads (status ${e.status})` };
      return e.linkedFrom.length ? { ok: false, why: `${e.url} is linked from ${e.linkedFrom[0]!.pageUrl} ("${e.linkedFrom[0]!.text}")` } : { ok: true, why: '' };
    case 'thin_page':
      return live(e) && e.words < THIN_WORDS ? { ok: true, why: '' } : { ok: false, why: live(e) ? `${e.url} shows ${e.words} words` : `${e.url} no longer loads (status ${e.status})` };
    case 'leftover_page':
      return live(e) ? { ok: true, why: '' } : { ok: false, why: `${e.url} no longer loads (status ${e.status})` };
    default: {
      const a = ABSENCE[claim]!;
      if (!live(e)) return { ok: false, why: `${e.url} no longer loads (status ${e.status})` };
      return a.shown(e) ? { ok: true, why: '' } : { ok: false, why: `${e.url} ${a.has}` };
    }
  }
}

/**
 * Whether a sentence still holds. Every example must show at least one thing the sentence claims.
 * Every claim must be shown by an example, or, for something absent from pages, by two of the
 * other pages we read. Missing pages count only when one of their own pages links to at least
 * one of them: a page nobody is sent to costs nothing.
 */
export function judge(claims: Claim[], examples: ExampleState[], others: PageState[]): Verdict {
  const drop = (reason: string): Verdict => ({ confirmed: false, measured: null, reason });
  if (!claims.length) return drop('opening the example pages cannot prove this');
  if (!examples.length) return drop('no example page was given');
  const rest = others.filter((o) => live(o) && !examples.some((e) => sameAddress(e.url, o.url)));
  for (const e of examples) {
    const results = claims.map((c) => shows(c, e));
    if (!results.some((r) => r.ok)) return drop(results[0]!.why);
  }
  const measured: string[] = [];
  for (const claim of claims) {
    const showing = examples.filter((e) => shows(claim, e).ok);
    const absence = ABSENCE[claim];
    const also = absence ? rest.filter(absence.shown).length : 0;
    if (!showing.length && also < 2) return drop(`no page we read shows: ${absence ? `no ${absence.label}` : claim.replace(/_/g, ' ')}`);
    if (claim === 'missing_page') {
      const linked = showing.filter((e) => e.linkedFrom.length);
      const unlinked = showing.filter((e) => !e.linkedFrom.length);
      if (!linked.length) return drop(`${showing[0]!.url} is missing, but none of the ${others.length} pages we read links to it`);
      const name = (e: ExampleState) => (showing.length === 1 ? 'The page' : e.url);
      measured.push(...linked.map((e) => `${name(e)} ${answers(e)}. ${linkWords(e.linkedFrom[0]!)}`), ...unlinked.map((e) => `${name(e)} ${answers(e)}. None of the ${others.length} pages we read links to it.`));
    } else if (claim === 'orphan_page') measured.push(showing.length === 1 ? `The page loads. None of the ${rest.length} other pages we read links to it.` : `The ${showing.length} example pages load. None of the ${rest.length} other pages we read links to them.`);
    else if (claim === 'thin_page') measured.push(`${showing.length === 1 ? 'The example page shows' : 'The example pages show'} ${showing.map((e) => e.words).join(' and ')} words.`);
    else if (claim === 'leftover_page') measured.push(`The page loads, with the title "${showing[0]!.title}".`);
    else {
      const label = absence!.label;
      if (!showing.length) measured.push(`No ${label} on ${also} of the ${rest.length} other pages we read.`);
      else if (!rest.length) measured.push(`No ${label} on ${pagesWord(showing.length)}.`);
      // Where the other pages we read do not bear out a count in the sentence, the line says so.
      else if (!also) measured.push(`No ${label} on ${pagesWord(showing.length)}. The ${rest.length} other pages we read all ${absence!.all}.`);
      else measured.push(`No ${label} on ${pagesWord(showing.length)}, nor on ${also} of the ${rest.length} other pages we read.`);
    }
  }
  return { confirmed: true, measured: measured.join(' '), reason: null };
}

export interface SentenceEvidence {
  url: string;
  path: string | null;
  excerpt: string;
  capturedAt: string;
}

export interface SentenceResult extends Verdict {
  text: string;
  claims: Claim[];
  caution: string | null;
  examples: ExampleState[];
  evidence: SentenceEvidence[];
}

const SEVERITY: Record<Claim, number> = { missing_page: 5, orphan_page: 3, leftover_page: 2, thin_page: 2, no_meta_description: 2, no_main_heading: 2, no_structured_data: 2 };

/**
 * Stores what held as findings from Crawlmouse. Crawlmouse saw each one first and we saw it again
 * on our own visit, so a stored finding is ready for a decision. One that no longer holds is
 * marked resolved, and a decision already made on a finding is kept.
 */
export function storeCrawlmouse(db: Db, business: { id: number }, batch: string, results: SentenceResult[], meta: { auditedAt?: string; auditId?: string; pagesRead?: number; coveragePct?: number; confidence?: string; checkedAt: string }): { stored: number; dropped: number } {
  const find = db.prepare("SELECT id, status FROM findings WHERE business_id = ? AND batch = ? AND source = 'crawlmouse' AND fingerprint = ?");
  const insert = db.prepare(
    `INSERT INTO findings (business_id, batch, check_id, pack, tier, severity, status, reproduced, fingerprint, title, page_url, viewport, visibility_weight, score, detail, first_seen_at, last_verified_at, source)
     VALUES (?, ?, ?, 'crawlmouse', 'measured', ?, 'reproduced', 1, ?, ?, ?, 'desktop', 0.6, ?, ?, ?, ?, 'crawlmouse')`,
  );
  const evidence = db.prepare("INSERT INTO evidence (finding_id, kind, url, viewport, excerpt, path, captured_at_utc, captured_at_nz) VALUES (?, 'page', ?, 'desktop', ?, ?, ?, ?)");
  let stored = 0;
  let dropped = 0;
  db.transaction(() => {
    for (const r of results) {
      const fingerprint = slugify(r.text);
      const row = find.get(business.id, batch, fingerprint) as { id: number; status: string } | undefined;
      if (!r.confirmed) {
        dropped += 1;
        if (row && ['candidate', 'reproduced', 'approved'].includes(row.status)) db.prepare("UPDATE findings SET status = 'resolved', top3 = 0 WHERE id = ?").run(row.id);
        continue;
      }
      const claim = r.claims[0]!;
      const detail = JSON.stringify({
        sentence: r.text,
        claims: r.claims,
        measured: r.measured,
        caution: r.caution,
        examples: r.examples.map(({ linkedFrom, ...e }) => ({ ...e, linkedFrom: linkedFrom.map(({ pageUrl, text, where }) => ({ pageUrl, text, where })) })),
        crawlmouse: { auditedAt: meta.auditedAt ?? null, auditId: meta.auditId ?? null, pagesRead: meta.pagesRead ?? null, coveragePct: meta.coveragePct ?? null, confidence: meta.confidence ?? null },
      });
      let id = row?.id;
      if (id === undefined) id = Number(insert.run(business.id, batch, `CM_${claim}`, SEVERITY[claim], fingerprint, r.text, r.examples[0]?.url ?? null, scoreOf(SEVERITY[claim], 'inner', 'measured'), detail, meta.checkedAt, meta.checkedAt).lastInsertRowid);
      else db.prepare("UPDATE findings SET detail = ?, last_verified_at = ?, reproduced = 1, status = CASE status WHEN 'resolved' THEN 'reproduced' WHEN 'candidate' THEN 'reproduced' ELSE status END WHERE id = ?").run(detail, meta.checkedAt, id);
      db.prepare('DELETE FROM evidence WHERE finding_id = ?').run(id);
      for (const e of r.evidence) {
        const t = bothTimes(new Date(e.capturedAt));
        evidence.run(id, e.url, e.excerpt, e.path, t.utc, t.nz);
      }
      stored += 1;
    }
  })();
  return { stored, dropped };
}

/** Parent addresses of a page, nearest first: the pages most likely to link to it. */
function parents(url: string): string[] {
  const u = new URL(url);
  const parts = u.pathname.split('/').filter(Boolean);
  const out: string[] = [];
  for (let i = parts.length - 1; i >= 0; i--) out.push(`${u.origin}/${parts.slice(0, i).join('/')}${i ? '/' : ''}`);
  return out.slice(0, 3);
}

/**
 * A site kept in two folders links "Info.html" from each. When a page read in one folder links
 * to a file of the same name as the missing page, the copy of that page in the missing page's
 * own folder is the likely linker.
 */
function siblingGuesses(pages: PageCapture[], target: string): string[] {
  const file = (u: string) => new URL(u).pathname.split('/').pop()!.toLowerCase();
  const wanted = file(target);
  if (!wanted) return [];
  const out: string[] = [];
  for (const p of pages) {
    if (!p.ok || !p.links.some((l) => /^https?:/.test(l.href) && file(l.href) === wanted && !sameAddress(l.href, target))) continue;
    const name = new URL(p.finalUrl).pathname.split('/').pop();
    if (!name) continue;
    const guess = new URL(name, target).toString();
    if (!out.includes(guess) && !pages.some((x) => sameAddress(x.finalUrl, guess) || sameAddress(x.url, guess))) out.push(guess);
  }
  return out.slice(0, 2);
}

function describe(e: ExampleState): string {
  return [`Status ${e.status ?? 'none'}${e.missing ? ' (not found)' : ''}`, `title "${e.title}"`, `meta description ${e.metaDescription ? 'present' : 'absent'}`, `main heading ${e.mainHeading ? 'present' : 'absent'}`, `structured data ${e.structuredData ? 'present' : 'absent'}`, `${e.words} words`].join(', ');
}

/**
 * Opens every example page behind each sentence again and judges the sentence on what is there
 * now. For a missing page it looks for the page of theirs that links to it, reading the pages
 * above it when none of the pages already read does. Each example gets a screenshot, and a link
 * to a missing page gets a second one with the link boxed.
 */
export async function verifyCrawlmouse(renderer: Renderer, slug: string, summary: CrawlmouseSummary, known: PageCapture[], evidenceRoot: string = paths.evidence): Promise<SentenceResult[]> {
  // The same page can be held twice: read for the wave and again in an audit run. Each counts once.
  const pages: PageCapture[] = [];
  for (const p of known) if (!pages.some((x) => sameAddress(x.finalUrl, p.finalUrl))) pages.push(p);
  const states = new Map<string, PageState>();
  const stateOf = (p: PageCapture) => {
    if (!states.has(p.finalUrl)) states.set(p.finalUrl, pageState(p, savedHtml(p)));
    return states.get(p.finalUrl)!;
  };
  const results: SentenceResult[] = [];
  let shot = 0;
  for (const f of summary.findings_plain) {
    const claims = claimsIn(f.text);
    const examples: ExampleState[] = [];
    const evidence: SentenceEvidence[] = [];
    for (const url of claims.length ? f.examples : []) {
      const capture = await readPage(renderer, slug, url, { screenshots: true });
      const state = pageState(capture, savedHtml(capture));
      let linkedFrom = linkersOf(pages, url);
      if (claims.includes('missing_page') && state.missing && !linkedFrom.length) {
        for (const likely of [...siblingGuesses(pages, url), ...parents(url)]) {
          if (pages.some((p) => sameAddress(p.finalUrl, likely) || sameAddress(p.url, likely))) continue;
          const p = await readPage(renderer, slug, likely);
          if (p.ok) pages.push(p);
          linkedFrom = linkersOf(pages, url);
          if (linkedFrom.length) break;
        }
      }
      const example = { ...state, url, linkedFrom };
      examples.push(example);
      const linker = claims.includes('missing_page') && state.missing ? linkedFrom[0] : undefined;
      if (linker) {
        // The link is boxed on a fresh copy of the page it sits on, so the picture and the claim are of the same moment.
        const from = await readPage(renderer, slug, linker.pageUrl, { screenshots: true });
        const link = from.links.find((l) => sameAddress(l.href, url) && l.visible);
        const file = join(evidenceRoot, slug, `crawlmouse-${++shot}.webp`);
        const crop = link?.box ? await cropElement(from, link.box, file).catch(() => null) : await pageShot(from, file).catch(() => null);
        evidence.push({ url: linker.pageUrl, path: crop?.file ?? null, excerpt: `${linkWords(linker).replace(` on ${linker.pageUrl} leads to it.`, '')} on this page leads to ${url}`, capturedAt: from.capturedAtUtc });
      }
      const file = join(evidenceRoot, slug, `crawlmouse-${++shot}.webp`);
      const picture = capture.tiles.length ? await pageShot(capture, file).catch(() => null) : null;
      evidence.push({ url, path: picture?.file ?? null, excerpt: describe(example), capturedAt: capture.capturedAtUtc });
    }
    const others = pages.filter((p) => p.ok).map(stateOf);
    results.push({ text: f.text, claims, caution: f.caution ?? null, examples, evidence, ...judge(claims, examples, others) });
  }
  return results;
}
