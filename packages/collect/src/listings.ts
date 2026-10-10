import * as cheerio from 'cheerio';
import { hostOf } from '@plumbline/core';
import type { Polite } from '@plumbline/fetch';
import { fingerprintUrl } from './booking.ts';
import { emailsIn, phonesIn, pricesInText } from './content.ts';
import type { ListingData } from './types.ts';

const DIRECTORIES = /(^|\.)(newzealand\.com|northlandnz\.com|rotoruanz\.com|lovetaupo\.com|thecoromandel\.com|nelsontasman\.nz|marlboroughnz\.com|christchurchnz\.com|queenstownnz\.co\.nz|dunedinnz\.com|southlandnz\.com|fiordland\.org\.nz|westcoast\.co\.nz|wellingtonnz\.com|hawkesbaynz\.com|aucklandnz\.com|bayofplentynz\.com|waikatonz\.com|kaikoura\.co\.nz|mackenzienz\.com|lakewanaka\.co\.nz)$/;
const REVIEWS = /(^|\.)(tripadvisor\.[a-z.]+|google\.[a-z.]+|g\.page|facebook\.com|trustpilot\.com)$/;

export function classifyListing(url: string): { platform: string; kind: ListingData['kind'] } {
  const host = (hostOf(url) ?? '').replace(/^www\./, '');
  const f = fingerprintUrl(url);
  if (f && f.system === 'Tripadvisor') return { platform: 'Tripadvisor', kind: 'review' };
  if (f) return { platform: f.system, kind: f.kind === 'system' ? 'booking_system' : 'booking_platform' };
  if (DIRECTORIES.test(host)) return { platform: host, kind: 'directory' };
  if (REVIEWS.test(host)) return { platform: host, kind: 'review' };
  return { platform: host, kind: 'other' };
}

/** Pulls every URL out of free text such as a CSV cell, including bare booking-system hostnames. */
export function urlsIn(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/https?:\/\/[^\s;,)"'<>]+/gi)) out.add(m[0].replace(/[.)\]]+$/, ''));
  for (const m of text.matchAll(/(?<![/\w.@-])([a-z0-9-]+\.(?:rezdy|fareharbor|bookeo|checkfront|trekksoft|xola)\.com)\b/gi)) out.add(`https://${m[1]!.toLowerCase()}/`);
  return [...out];
}

function aggregateRating(node: unknown, depth = 0): { rating: number; count: number | null } | null {
  if (!node || typeof node !== 'object' || depth > 6) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = aggregateRating(n, depth + 1);
      if (r) return r;
    }
    return null;
  }
  const o = node as Record<string, unknown>;
  const agg = o.aggregateRating as Record<string, unknown> | undefined;
  if (agg && agg.ratingValue !== undefined) {
    const rating = Number(agg.ratingValue);
    const count = Number(agg.reviewCount ?? agg.ratingCount);
    if (Number.isFinite(rating)) return { rating, count: Number.isFinite(count) ? count : null };
  }
  for (const v of Object.values(o)) {
    const r = aggregateRating(v, depth + 1);
    if (r) return r;
  }
  return null;
}

export function parseListing(url: string, html: string): Omit<ListingData, 'status'> {
  const { platform, kind } = classifyListing(url);
  const $ = cheerio.load(html);
  let rating: number | null = null;
  let reviewCount: number | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (rating !== null) return;
    try {
      const r = aggregateRating(JSON.parse($(el).text()));
      if (r) {
        rating = r.rating;
        reviewCount = r.count;
      }
    } catch {
      // Listings often carry broken JSON-LD. It is skipped.
    }
  });
  const name = ($('meta[property="og:title"]').attr('content') || $('h1').first().text() || $('title').text() || '').replace(/\s+/g, ' ').trim() || null;
  const mailtos = $('a[href^="mailto:"]').map((_, a) => decodeURIComponent(($(a).attr('href') ?? '').slice(7).split('?')[0] ?? '')).get();
  const tels = $('a[href^="tel:"]').map((_, a) => decodeURIComponent(($(a).attr('href') ?? '').slice(4))).get();
  $('script, style, noscript, template, svg').remove();
  const text = $('body').text().replace(/[ \t\r\f]+/g, ' ').replace(/\n\s*\n+/g, '\n');
  return {
    url,
    platform,
    kind,
    name,
    phones: [...new Set([...tels, ...phonesIn(text)].map((p) => p.trim()).filter(Boolean))].slice(0, 6),
    emails: [...new Set([...mailtos, ...emailsIn(text)].map((e) => e.trim().toLowerCase()).filter(Boolean))].slice(0, 6),
    prices: pricesInText(text).slice(0, 30),
    rating,
    reviewCount,
  };
}

/** Fetches each listing once, if its robots.txt allows. A block is recorded and never worked around. */
export async function fetchListings(polite: Polite, urls: string[]): Promise<ListingData[]> {
  const out: ListingData[] = [];
  for (const url of urls.slice(0, 8)) {
    const base = { url, ...classifyListing(url), name: null, phones: [], emails: [], prices: [], rating: null, reviewCount: null };
    const res = await polite.get(url, { timeoutMs: 20_000 });
    if (res.error === 'robots') out.push({ ...base, status: 'robots' });
    // A refusal is a block. It is recorded and left alone.
    else if (res.status === 401 || res.status === 403 || res.status === 429) out.push({ ...base, status: 'blocked' });
    else if (res.status !== 200) out.push({ ...base, status: 'error' });
    else out.push({ ...parseListing(url, res.body), status: 'fetched' });
  }
  return out;
}
