import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as cheerio from 'cheerio';
import { utcIso } from '@plumbline/core';
import type { Polite } from '@plumbline/fetch';
import { contentDir, crawlmouseFile } from './paths.ts';

export interface CrawlmouseSummary {
  site: string;
  site_score: number | null;
  grade: string | null;
  pages_read: number;
  ai_readiness: { score: number; band: string } | null;
  ai_crawler_access: string | null;
  note?: string;
  findings_plain: { text: string; examples: string[] }[];
}

export function loadCrawlmouse(slug: string): CrawlmouseSummary | null {
  const file = crawlmouseFile(slug);
  return file ? (JSON.parse(readFileSync(file, 'utf8')) as CrawlmouseSummary) : null;
}

export interface PageFacts {
  url: string;
  status: number | null;
  metaDescription: boolean;
  h1: boolean;
  structuredData: boolean;
  words: number;
  /** The page itself says it was not found, whatever status it was served with. */
  saysNotFound: boolean;
}

export function pageFacts(url: string, status: number | null, html: string): PageFacts {
  const $ = cheerio.load(html);
  const structuredData = $('script[type="application/ld+json"]').length > 0 || $('[itemscope]').length > 0 || $('[typeof]').length > 0;
  const metaDescription = !!$('meta[name="description" i]').attr('content')?.trim();
  const h1 = $('h1').filter((_, e) => !!$(e).text().trim() || $(e).find('img[alt]').length > 0).length > 0;
  $('script, style, noscript, template').remove();
  const text = $('body').text();
  const words = text.split(/\s+/).filter(Boolean).length;
  const saysNotFound = /page (was )?not found|no results found|\b404\b/i.test(`${$('title').text()} ${$('h1, h2').text()}`);
  return { url, status, metaDescription, h1, structuredData, words, saysNotFound };
}

type Kind = 'missing_page' | 'no_meta_description' | 'no_structured_data' | 'no_h1' | 'thin_text' | 'not_checkable';

export function kindOf(text: string): Kind {
  if (/not linked from anywhere/i.test(text)) return 'not_checkable';
  if (/404|missing page|page not found|does not load/i.test(text)) return 'missing_page';
  if (/meta description/i.test(text)) return 'no_meta_description';
  if (/structured data/i.test(text)) return 'no_structured_data';
  if (/main heading|\bH1\b/i.test(text)) return 'no_h1';
  if (/very little text/i.test(text)) return 'thin_text';
  return 'not_checkable';
}

const THIN_WORDS = 150;

/** Whether one example page still shows the problem the sentence describes. */
export function holds(kind: Kind, p: PageFacts): boolean {
  const ok = p.status !== null && p.status >= 200 && p.status < 300;
  switch (kind) {
    case 'missing_page':
      return (p.status !== null && p.status >= 400) || (ok && p.saysNotFound);
    case 'no_meta_description':
      return ok && !p.metaDescription;
    case 'no_structured_data':
      return ok && !p.structuredData;
    case 'no_h1':
      return ok && !p.h1;
    case 'thin_text':
      return ok && p.words < THIN_WORDS;
    default:
      return false;
  }
}

export interface VerifiedFinding {
  text: string;
  kind: Kind;
  verified: boolean;
  reason: string;
  pages: PageFacts[];
}

export interface CrawlmouseVerified {
  checked_at_utc: string;
  findings: VerifiedFinding[];
}

/**
 * Re-opens every example URL behind each Crawlmouse sentence. A sentence is kept only when every
 * example still shows the problem. A sentence whose claim cannot be tested by opening its examples
 * (a page nothing links to) is not kept.
 */
export async function verifyCrawlmouse(polite: Polite, slug: string): Promise<CrawlmouseVerified | null> {
  const summary = loadCrawlmouse(slug);
  if (!summary) return null;
  const findings: VerifiedFinding[] = [];
  for (const f of summary.findings_plain) {
    const kind = kindOf(f.text);
    if (kind === 'not_checkable') {
      findings.push({ text: f.text, kind, verified: false, reason: 'opening the example pages cannot prove this', pages: [] });
      continue;
    }
    const pages: PageFacts[] = [];
    for (const url of f.examples) {
      const r = await polite.get(url);
      pages.push(pageFacts(url, r.status, r.body));
    }
    const failed = pages.filter((p) => !holds(kind, p));
    findings.push({ text: f.text, kind, verified: pages.length > 0 && failed.length === 0, reason: failed.length ? `no longer true for ${failed.map((p) => p.url).join(', ')}` : 'every example still shows it', pages });
  }
  const out = { checked_at_utc: utcIso(), findings };
  writeFileSync(join(contentDir(slug), 'crawlmouse-verified.json'), JSON.stringify(out, null, 2));
  return out;
}

export function loadVerified(slug: string): CrawlmouseVerified | null {
  const file = join(contentDir(slug), 'crawlmouse-verified.json');
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as CrawlmouseVerified) : null;
}
