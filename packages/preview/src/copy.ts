import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as cheerio from 'cheerio';
import { paths } from '@plumbline/core';
import { BANNED_WORDS } from '@plumbline/impact';
import { contentDir } from './paths.ts';

export interface CopyIssue {
  kind: 'dash' | 'banned' | 'number';
  where: string;
  text: string;
  context: string;
}

/** Dash characters, and a hyphen doing a dash's job: set off by spaces, or joining two numbers. */
const DASH = /[‐‒–—―−]|(?<=\s)-(?=\s)|(?<=\d)-(?=\d)|^\s*-\s/m;

function around(text: string, index: number, length: number): string {
  return text.slice(Math.max(0, index - 40), index + length + 40).replace(/\s+/g, ' ').trim();
}

export function dashIssues(text: string, where: string): CopyIssue[] {
  const out: CopyIssue[] = [];
  const re = new RegExp(DASH.source, 'gm');
  for (const m of text.matchAll(re)) out.push({ kind: 'dash', where, text: m[0], context: around(text, m.index, m[0].length) });
  return out;
}

export function bannedIssues(text: string, where: string): CopyIssue[] {
  const out: CopyIssue[] = [];
  for (const banned of BANNED_WORDS) {
    const re = new RegExp(`\\b${banned.replace('-', '[- ]?')}`, 'gi');
    for (const m of text.matchAll(re)) out.push({ kind: 'banned', where, text: m[0], context: around(text, m.index, m[0].length) });
  }
  return out;
}

/** Every number in a text, as written, less thousands separators. Each one must trace to a source. */
export function numbersIn(text: string): { token: string; index: number }[] {
  return [...text.matchAll(/\d[\d,.]*\d|\d/g)].map((m) => ({ token: m[0].replace(/,(?=\d{3}\b)/g, '').replace(/[.,]+$/, ''), index: m.index }));
}

export function numberSet(text: string): Set<string> {
  return new Set(numbersIn(text).map((n) => n.token));
}

export function numberIssues(text: string, where: string, known: Set<string>): CopyIssue[] {
  return numbersIn(text).filter((n) => !known.has(n.token)).map((n) => ({ kind: 'number' as const, where, text: n.token, context: around(text, n.index, n.token.length) }));
}

/** The words a visitor can read in a piece of HTML, with image descriptions and labels included. */
export function visibleText(html: string): string {
  const $ = cheerio.load(html);
  $('script, style, template, noscript, svg title').remove();
  // Decoration hidden from a screen reader, such as a step counter, is not copy. A headline split for show keeps its label.
  $('[aria-hidden="true"]').remove();
  $('img[alt]').each((_, e) => void $(e).replaceWith(` ${$(e).attr('alt')} `));
  $('[aria-label]').each((_, e) => void $(e).prepend(` ${$(e).attr('aria-label')} `));
  $('br, p, div, li, h1, h2, h3, h4, td, th, section, summary, dt, dd, button, a, span, label, option').each((_, e) => void $(e).append(' '));
  return $.root().text().replace(/[ \t\u00a0]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}

/** The pages kept for a business when its wave was researched: each one's source, where it was read. */
function wavePages(slug: string): string[] {
  const dir = join(paths.data, 'wave', slug, 'pages');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).map((name) => join(dir, name, 'page.html')).filter((f) => existsSync(f));
}

/** Everything read from the business's own site: the saved pages and the fact sheet built from them. */
export function ownSiteText(slug: string): string {
  const dir = contentDir(slug);
  const parts: string[] = [];
  const researched = join(paths.data, 'wave', slug, 'facts.json');
  if (existsSync(researched)) parts.push(readFileSync(researched, 'utf8'));
  for (const f of wavePages(slug)) parts.push(visibleText(readFileSync(f, 'utf8')));
  const facts = join(dir, 'facts.json');
  if (existsSync(facts)) parts.push(readFileSync(facts, 'utf8'));
  const html = join(dir, 'html');
  if (existsSync(html)) for (const f of readdirSync(html)) parts.push(visibleText(readFileSync(join(html, f), 'utf8')));
  return parts.join('\n');
}

/** The saved pages of the business's own site, as fetched. */
export function ownSiteHtml(slug: string): string {
  const html = join(contentDir(slug), 'html');
  const kept = existsSync(html) ? readdirSync(html).map((f) => join(html, f)) : [];
  return [...kept, ...wavePages(slug)].map((f) => readFileSync(f, 'utf8')).join('\n');
}

export interface PageCopy {
  /** The redesigned homepage. Its numbers must come from the business's own site. */
  demo: string;
  /** Findings, pricing and reply. Its numbers come from stored measurements and our own offer. */
  found: string;
  /** The bar and anything else outside the two tabs. */
  rest: string;
}

export function splitPage(html: string): PageCopy {
  const $ = cheerio.load(html);
  const demo = visibleText($.html($('#demo')));
  const found = visibleText($.html($('#found')));
  $('#demo, #found').remove();
  return { demo, found, rest: visibleText($.html($('body'))) };
}

export function scanPage(copy: PageCopy, sources: { ownSite: string; measured: string; offer: string }): CopyIssue[] {
  const issues: CopyIssue[] = [];
  for (const [where, text] of Object.entries(copy) as [keyof PageCopy, string][]) issues.push(...dashIssues(text, where), ...bannedIssues(text, where));
  // The demo may quote a stored measurement about the business, such as its Google rating, beside what its own site says.
  issues.push(...numberIssues(copy.demo, 'demo', numberSet(`${sources.ownSite}\n${sources.measured}`)));
  issues.push(...numberIssues(copy.found, 'found', numberSet(`${sources.measured}\n${sources.offer}`)));
  issues.push(...numberIssues(copy.rest, 'rest', numberSet(sources.offer)));
  return issues;
}
