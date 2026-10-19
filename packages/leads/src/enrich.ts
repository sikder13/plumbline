import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { requireEnv } from '@plumbline/core';
import { normaliseName, plainWords, ratio, tokenSetRatio, type Dictionary } from './names.ts';
import { RECENT_DAYS, campaignPaths, loadDictionary, toCsv, type PoolRow } from './pull.ts';

/** Google Places (New). Only these fields are ever asked for. */
const SEARCH_MASK = ['id', 'displayName', 'formattedAddress', 'addressComponents', 'websiteUri', 'businessStatus', 'primaryType'].map((f) => `places.${f}`).join(',');
const DETAILS_MASK = ['id', 'displayName', 'formattedAddress', 'addressComponents', 'nationalPhoneNumber', 'websiteUri', 'googleMapsUri', 'rating', 'userRatingCount', 'regularOpeningHours', 'photos', 'businessStatus', 'primaryType', 'primaryTypeDisplayName', 'editorialSummary', 'reviews'].join(',');

/** The match a place must reach before its details are fetched. */
export const MATCH = 0.8;

export interface AddressPart {
  longText?: string;
  shortText?: string;
  types?: string[];
}

export interface SearchPlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  addressComponents?: AddressPart[];
  websiteUri?: string;
  businessStatus?: string;
  primaryType?: string;
}

export interface Photo {
  name: string;
  widthPx: number;
  heightPx: number;
  authorAttributions?: { displayName?: string; uri?: string }[];
}

export interface Details extends SearchPlace {
  nationalPhoneNumber?: string;
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: { weekdayDescriptions?: string[]; periods?: unknown[] };
  photos?: Photo[];
  primaryTypeDisplayName?: { text: string };
  editorialSummary?: { text: string };
  reviews?: { rating?: number; text?: { text: string }; originalText?: { text: string }; relativePublishTimeDescription?: string; publishTime?: string }[];
}

export type Bucket = 'A' | 'B' | 'C' | 'D';

function state(p: SearchPlace): string | null {
  return p.addressComponents?.find((c) => c.types?.includes('administrative_area_level_1'))?.shortText ?? null;
}

/** Words that say nothing about which business a name belongs to. */
const GENERIC = new Set(['services', 'service', 'company', 'group', 'solutions', 'and', 'the', 'of', 'by', 'a', 'in', 'at', 'for', 'my', 'our', 'your', 'el', 'la', 'los', 'las', 'de', 'del', 'y', 'indy', 'indiana', 'indianapolis', 'midwest', 'hoosier', 'pro', 'pros', 'professional', 'professionals', 'quality', 'custom', 'premier', 'best', 'general', 'home', 'homes', 'studio', 'studios', 'shop', 'enterprises', 'enterprise', 'works', 'llc', 'inc', 'corp', 'co', 'ii', 'iii', 'iv', '2', '3', '4']);

/** Every word of the trade dictionary, which names share across unrelated businesses. */
export function tradeWords(dict: Pick<Dictionary, 'trades'>): Set<string> {
  return new Set(Object.values(dict.trades).flatMap((list) => (list ?? []).flatMap((t) => plainWords(t).flatMap((w) => [w, `${w}s`]))));
}

/**
 * How surely a Google profile is the filed business, 0 to 1. The token set ratio is taken over the
 * distinctive words only (trade words, generic words and the town left out), and one name's
 * distinctive words must sit inside the other's or read closely alike. Two names sharing only
 * "welding and fabrication" are not the same business.
 */
export function nameMatch(legal: string, place: string, generic: Set<string>): number {
  const distinct = (name: string) => normaliseName(name).split(' ').filter((w) => w && !GENERIC.has(w) && !generic.has(w));
  const a = [...new Set(distinct(legal))].sort();
  const b = [...new Set(distinct(place))].sort();
  if (!a.length || !b.length) return a.length || b.length ? Math.min(0.5, ratio(normaliseName(legal), normaliseName(place))) : tokenSetRatio(legal, place);
  // The same words, or one name holding two or more of the other's: one shared surname or place word is not enough.
  const [small, big] = a.length <= b.length ? [a, b] : [b, a];
  if (small.every((w) => big.includes(w)) && (small.length === big.length || small.length >= 2)) return 1;
  return ratio(a.join(' '), b.join(' '));
}

/** The Indiana place whose name is closest to the filed name. */
export function bestMatch(legal: string, places: SearchPlace[], generic: Set<string> = new Set()): { place: SearchPlace; match: number } | null {
  let best: { place: SearchPlace; match: number } | null = null;
  for (const place of places) {
    if (state(place) !== 'IN') continue;
    const match = nameMatch(legal, place.displayName?.text ?? '', generic);
    if (!best || match > best.match) best = { place, match };
  }
  return best;
}

/** A: theirs, open, no website. B: theirs but not open, or not surely theirs. C: has a website. D: no profile. */
export function bucketOf(match: number | null, details: Details | null, place?: SearchPlace): Bucket {
  if (match === null) return 'D';
  if (match < MATCH) return 'B';
  if (place?.websiteUri || details?.websiteUri) return 'C';
  if (!details) return 'B';
  return details.businessStatus === 'OPERATIONAL' ? 'A' : 'B';
}

export interface LeadFacts {
  ownerIsAgent: boolean;
  group: string;
  created: string;
}

/** Whether the profile stands at the filed address: the same street number first in both. */
export function sameAddress(filed: string, profile: string | undefined): boolean {
  const number = (a: string | undefined) => /^\s*(\d+)\b/.exec(a ?? '')?.[1] ?? null;
  const n = number(filed);
  return !!n && n === number(profile);
}

/** One point each, and the reason for each point. */
export function leadScore(d: Details, lead: LeadFacts, today: Date): { score: number; points: string[] } {
  const points: string[] = [];
  const n = d.userRatingCount ?? 0;
  if (n >= 1 && n <= 15) points.push(`${n} Google reviews (1 to 15)`);
  if (d.regularOpeningHours?.weekdayDescriptions?.length) points.push('hours on the profile');
  if ((d.photos?.length ?? 0) >= 4) points.push(`${d.photos!.length} photos (4 or more)`);
  if (d.nationalPhoneNumber) points.push('phone on the profile');
  if (lead.ownerIsAgent) points.push('owner filed as agent');
  if (['food', 'beauty', 'trades'].includes(lead.group)) points.push(`trade group ${lead.group}`);
  const days = Math.floor((today.getTime() - new Date(`${lead.created}T12:00:00Z`).getTime()) / 86_400_000);
  if (days <= RECENT_DAYS) points.push(`filed ${lead.created}, within ${RECENT_DAYS} days`);
  return { score: points.length, points };
}

/** The ten to build: score, then newest filing, with at most four food and three of any other group. The next five are alternates. */
export function pickTen<T extends { slug: string; group: string; score: number; created: string }>(list: T[]): { picked: T[]; alternates: T[] } {
  const ranked = [...list].sort((a, b) => b.score - a.score || b.created.localeCompare(a.created) || a.slug.localeCompare(b.slug));
  const picked: T[] = [];
  const count: Record<string, number> = {};
  for (const l of ranked) {
    if (picked.length === 10) break;
    const cap = l.group === 'food' ? 4 : 3;
    if ((count[l.group] ?? 0) >= cap) continue;
    count[l.group] = (count[l.group] ?? 0) + 1;
    picked.push(l);
  }
  const chosen = new Set(picked.map((l) => l.slug));
  return { picked, alternates: ranked.filter((l) => !chosen.has(l.slug)).slice(0, 5) };
}

export class QuotaStop extends Error {}

/** The day Google counts the quota in: midnight to midnight, Pacific time. */
function pacificDay(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(d);
}

/** Every call made, one line each, so a ceiling holds across runs. */
export class CallLedger {
  constructor(
    private file: string,
    readonly ceiling: number,
  ) {}
  today(): number {
    if (!existsSync(this.file)) return 0;
    const day = pacificDay();
    return readFileSync(this.file, 'utf8').split('\n').filter((l) => l && (JSON.parse(l) as { day: string }).day === day).length;
  }
  total(): number {
    return existsSync(this.file) ? readFileSync(this.file, 'utf8').split('\n').filter(Boolean).length : 0;
  }
  take(kind: string, slug: string): void {
    if (this.today() >= this.ceiling) throw new QuotaStop(`the ceiling of ${this.ceiling} Places calls today is reached`);
    appendFileSync(this.file, `${JSON.stringify({ day: pacificDay(), at: new Date().toISOString(), kind, slug })}\n`);
  }
}

async function places<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    if (res.status === 429 || res.status === 403 || /quota|billing|RESOURCE_EXHAUSTED/i.test(body)) throw new QuotaStop(`Places answered ${res.status}: ${body}`);
    throw new Error(`Places answered ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

export function textSearch(query: string): Promise<{ places?: SearchPlace[] }> {
  return places('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': requireEnv('GOOGLE_MAPS_API_KEY'), 'x-goog-fieldmask': SEARCH_MASK },
    body: JSON.stringify({ textQuery: query, pageSize: 5, regionCode: 'US', languageCode: 'en' }),
  });
}

export function placeDetails(id: string): Promise<Details> {
  return places(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`, { headers: { 'x-goog-api-key': requireEnv('GOOGLE_MAPS_API_KEY'), 'x-goog-fieldmask': DETAILS_MASK } });
}

/** The address of one photo at most 2000 px wide. The image itself is then fetched from Google's image host, which is not a Places call. */
export function photoUri(name: string): Promise<{ photoUri: string }> {
  return places(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=2000&skipHttpRedirect=true`, { headers: { 'x-goog-api-key': requireEnv('GOOGLE_MAPS_API_KEY') } });
}

export interface Cached {
  slug: string;
  query: string;
  searchedAt: string;
  search: { places?: SearchPlace[] };
  details?: Details;
  detailsAt?: string;
  /** Details fetched under an earlier match rule for a profile that is no longer the match. */
  earlierDetails?: Details[];
}

export interface Enriched {
  slug: string;
  name: string;
  trading: string;
  group: string;
  trade: string;
  city: string;
  created: string;
  ownerIsAgent: boolean;
  agent: string;
  bucket: Bucket;
  match: number | null;
  website: string;
  status: string;
  score: number;
  points: string;
  phone: string;
  maps: string;
  reviews: number | null;
  rating: number | null;
  photos: number;
  hours: boolean;
  county: string;
  address: string;
  note: string;
}

export const ENRICHED_COLUMNS: (keyof Enriched)[] = ['slug', 'name', 'trading', 'group', 'trade', 'city', 'county', 'created', 'ownerIsAgent', 'agent', 'bucket', 'match', 'website', 'status', 'score', 'points', 'phone', 'maps', 'reviews', 'rating', 'photos', 'hours', 'address', 'note'];

function county(p: SearchPlace | undefined): string {
  return p?.addressComponents?.find((c) => c.types?.includes('administrative_area_level_2'))?.longText ?? '';
}

export interface EnrichOptions {
  limit: number;
  ceiling: number;
  today?: Date;
  log?: (line: string) => void;
}

/**
 * One Text Search per candidate, and Place Details only for a match of 0.8 or better. Every answer
 * is cached under data/<campaign>/cache/places/<slug>.json and never asked for again.
 */
export async function enrich(campaign: string, candidates: PoolRow[], opts: EnrichOptions): Promise<{ rows: Enriched[]; stopped: string | null; calls: number }> {
  const p = campaignPaths(campaign);
  mkdirSync(p.cache, { recursive: true });
  const ledger = new CallLedger(join(p.cache, '_calls.jsonl'), opts.ceiling);
  const log = opts.log ?? (() => undefined);
  const today = opts.today ?? new Date();
  const rows: Enriched[] = [];
  let stopped: string | null = null;
  const before = ledger.total();
  const trade = tradeWords(loadDictionary(campaign));
  for (const c of candidates.slice(0, opts.limit)) {
    const file = join(p.cache, `${c.slug}.json`);
    let cached: Cached | null = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Cached) : null;
    try {
      if (!cached) {
        const query = `${normaliseName(c.name)}, ${c.city}, Indiana`;
        ledger.take('searchText', c.slug);
        const search = await textSearch(query);
        cached = { slug: c.slug, query, searchedAt: new Date().toISOString(), search };
        writeFileSync(file, JSON.stringify(cached, null, 2));
      }
      const best = bestMatch(c.name, cached.search.places ?? [], new Set([...trade, ...plainWords(c.city)]));
      // Details only for a profile that could be bucket A: theirs, open and with no website. The search already says the rest.
      const likelyA = !!best && best.match >= MATCH && !best.place.websiteUri && best.place.businessStatus === 'OPERATIONAL';
      if (likelyA && cached.details?.id !== best.place.id) {
        if (cached.details) cached.earlierDetails = [...(cached.earlierDetails ?? []), cached.details];
        ledger.take('placeDetails', c.slug);
        cached.details = await placeDetails(best.place.id);
        cached.detailsAt = new Date().toISOString();
        writeFileSync(file, JSON.stringify(cached, null, 2));
      }
      const d = likelyA && cached.details?.id === best!.place.id ? cached.details : null;
      let bucket = bucketOf(best ? best.match : null, d, best?.place);
      // A name can match another business with similar words. Bucket A also needs the profile at the filed address.
      let note = '';
      if (bucket === 'A' && !sameAddress(c.address, d?.formattedAddress)) {
        bucket = 'B';
        note = 'name matched but the profile is at another address';
      }
      const scored = bucket === 'A' && d ? leadScore(d, { ownerIsAgent: c.owner_is_agent, group: c.trade_group, created: c.created }, today) : { score: 0, points: [] };
      const shown = d ?? best?.place;
      rows.push({
        slug: c.slug,
        name: c.name,
        trading: shown?.displayName?.text ?? '',
        group: c.trade_group,
        trade: c.trade,
        city: c.city,
        county: county(shown),
        created: c.created,
        ownerIsAgent: c.owner_is_agent,
        agent: c.agent,
        bucket,
        match: best ? Number(best.match.toFixed(3)) : null,
        website: best && best.match >= MATCH ? (shown?.websiteUri ?? '') : '',
        status: shown?.businessStatus ?? '',
        score: scored.score,
        points: scored.points.join('; '),
        phone: d?.nationalPhoneNumber ?? '',
        maps: d?.googleMapsUri ?? '',
        reviews: d?.userRatingCount ?? null,
        rating: d?.rating ?? null,
        photos: d?.photos?.length ?? 0,
        hours: !!d?.regularOpeningHours?.weekdayDescriptions?.length,
        address: shown?.formattedAddress ?? '',
        note,
      });
      log(`${c.slug}: ${bucket}${best ? ` match ${best.match.toFixed(2)} "${shown?.displayName?.text ?? ''}"` : ''}${bucket === 'A' ? ` score ${scored.score}` : ''}`);
    } catch (e) {
      if (e instanceof QuotaStop) {
        stopped = e.message;
        log(`stopped: ${e.message}`);
        break;
      }
      throw e;
    }
  }
  return { rows, stopped, calls: ledger.total() - before };
}

/** Writes _enriched.csv, _scored.csv (bucket A, best first) and the campaign B queue. */
export function writeEnriched(campaign: string, rows: Enriched[]): void {
  const p = campaignPaths(campaign);
  writeFileSync(join(p.leads, '_enriched.csv'), toCsv(rows, ENRICHED_COLUMNS));
  const a = rows.filter((r) => r.bucket === 'A').sort((x, y) => y.score - x.score || y.created.localeCompare(x.created));
  writeFileSync(join(p.leads, '_scored.csv'), toCsv(a, ENRICHED_COLUMNS));
  // The queue is appended to across runs: a business already in it is not added twice.
  const queue = join(p.data, 'campaign-b-queue.csv');
  const columns: (keyof Enriched)[] = ['slug', 'name', 'trading', 'group', 'city', 'website', 'phone', 'maps', 'created'];
  const known = existsSync(queue) ? new Set(readFileSync(queue, 'utf8').split('\n').slice(1).map((l) => l.split(',')[0])) : null;
  const fresh = rows.filter((r) => r.bucket === 'C' && !known?.has(r.slug));
  if (!known) writeFileSync(queue, toCsv(fresh, columns));
  else if (fresh.length) appendFileSync(queue, toCsv(fresh, columns).split('\n').slice(1).join('\n'));
}
