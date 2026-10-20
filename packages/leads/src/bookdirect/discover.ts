import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as cheerio from 'cheerio';
import { requireEnv, slugify } from '@plumbline/core';
import { HostLimiter, Polite } from '@plumbline/fetch';
import { parseCsv } from '../batch.ts';
import { CallLedger, QuotaStop, type AddressPart } from '../enrich.ts';
import { campaignPaths, toCsv } from '../pull.ts';
import { bookDirectDropReason, hostOfUrl, loadDiscoverConfig, nameKey, placeFlags, priorContactReason, type Centre, type ListId, type PlaceLike } from './filters.ts';
import { loadPriorContact } from './prior.ts';

/** The relay's field mask, plus the page token. */
const MASK = [...['id', 'displayName', 'formattedAddress', 'addressComponents', 'nationalPhoneNumber', 'websiteUri', 'googleMapsUri', 'rating', 'userRatingCount', 'businessStatus', 'primaryType'].map((f) => `places.${f}`), 'nextPageToken'].join(',');

export interface Place extends PlaceLike {
  addressComponents?: AddressPart[];
  nationalPhoneNumber?: string;
  googleMapsUri?: string;
  rating?: number;
}

/** One request start per second per host, as the relay allows. */
export const BOOK_DIRECT_GAP_MS = 1000;
export const PLACES_CAP = 1500;

export function bookDirectPaths() {
  const p = campaignPaths('book-direct');
  return { ...p, places: join(p.data, 'cache', 'places'), parks: join(p.data, 'cache', 'holidayparks'), ledger: join(p.data, 'cache', 'places', '_calls.jsonl') };
}

async function searchText(query: string, centre: Centre | null, pageToken?: string, pageSize = 20): Promise<{ places?: Place[]; nextPageToken?: string }> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': requireEnv('GOOGLE_MAPS_API_KEY'), 'x-goog-fieldmask': MASK },
    body: JSON.stringify({
      textQuery: query,
      pageSize,
      regionCode: 'NZ',
      languageCode: 'en',
      ...(centre ? { locationBias: { circle: { center: { latitude: centre.lat, longitude: centre.lng }, radius: centre.radiusKm * 1000 } } } : {}),
      ...(pageToken ? { pageToken } : {}),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    if (res.status === 429 || res.status === 403 || /quota|billing|RESOURCE_EXHAUSTED/i.test(body)) throw new QuotaStop(`Places answered ${res.status}: ${body}`);
    throw new Error(`Places answered ${res.status}: ${body}`);
  }
  return (await res.json()) as { places?: Place[]; nextPageToken?: string };
}

/** The town Google gives a place: its locality, else its suburb's town, else the centre searched. */
export function townOf(p: Place, fallback: string): string {
  const part = (t: string) => p.addressComponents?.find((c) => c.types?.includes(t))?.longText;
  return part('locality') ?? part('postal_town') ?? part('administrative_area_level_2') ?? fallback;
}

export function regionOf(p: Place): string {
  return p.addressComponents?.find((c) => c.types?.includes('administrative_area_level_1'))?.longText ?? '';
}

export interface Park {
  url: string;
  name: string;
  town: string;
  website: string;
  phone: string;
  affiliations: string[];
}

/** A holidayparks.co.nz park page: the name, and the contact block's phone, town and website. */
export function parsePark(url: string, html: string): Park | null {
  const $ = cheerio.load(html);
  const name = $('h1').first().text().replace(/\s+/g, ' ').trim();
  if (!name || /page not found/i.test($('title').text())) return null;
  $('script,style,noscript,svg').remove();
  const parts = $('body')
    .text()
    .split(/\n+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const own = $('a[href^="http"]')
    .toArray()
    .map((a) => $(a).attr('href') ?? '')
    .find((h) => {
      const host = hostOfUrl(h);
      return host && !/holidayparks\.co\.nz|google\.|goo\.gl|hpnz\.info|dubzz|gmpg\.org|facebook|instagram|youtube|wordpress|w\.org|elementor|gstatic/.test(host);
    });
  const i = parts.findIndex((s) => /^get directions$/i.test(s));
  const after = i >= 0 ? parts.slice(i + 1, i + 6) : [];
  const phone = after.find((s) => /^[\d()+ -]{7,}$/.test(s)) ?? '';
  const webIdx = after.findIndex((s) => /^(?:https?:\/\/)?www\.|\.(?:co\.nz|nz|com)\b/i.test(s));
  const town = webIdx > 0 ? (after[webIdx - 1] ?? '') : (after[2] ?? '');
  const affStart = parts.findIndex((s) => /^affiliations$/i.test(s));
  const affEnd = parts.findIndex((s, k) => k > affStart && /^contact /i.test(s));
  const affiliations = affStart >= 0 ? parts.slice(affStart + 1, affEnd > affStart ? affEnd : affStart + 4).filter((s) => s.length < 60) : [];
  return { url, name, town, website: own ?? '', phone, affiliations };
}

export interface CandidateRow {
  slug: string;
  list: ListId;
  place_id: string;
  name: string;
  town: string;
  region: string;
  centre: string;
  term: string;
  source: string;
  address: string;
  phone: string;
  website: string;
  maps: string;
  rating: number | string;
  rating_count: number | string;
  status: string;
  primary_type: string;
  flags: string;
  keep: boolean;
  reason: string;
}

export const CANDIDATE_COLUMNS: (keyof CandidateRow)[] = ['slug', 'list', 'place_id', 'name', 'town', 'region', 'centre', 'term', 'source', 'address', 'phone', 'website', 'maps', 'rating', 'rating_count', 'status', 'primary_type', 'flags', 'keep', 'reason'];

export interface DiscoverSummary {
  list: ListId;
  queries: number;
  pages: number;
  results: number;
  unique: number;
  parks: number;
  parksMatched: number;
  parkSearches: number;
  kept: number;
  drops: Record<string, number>;
  callsThisRun: number;
  callsToday: number;
  stopped: string | null;
  priorFiles: { file: string; rows: number }[];
}

interface Found {
  place: Place;
  centre: string;
  term: string;
  source: string;
  affiliations: string[];
}

/** Part 1: every term in every centre, three pages at most each, then holidayparks.co.nz for list A. Everything cached. */
export async function discover(list: ListId, opts: { cap?: number; log?: (l: string) => void } = {}): Promise<{ rows: CandidateRow[]; summary: DiscoverSummary }> {
  const cfg = loadDiscoverConfig();
  const p = bookDirectPaths();
  const log = opts.log ?? (() => undefined);
  for (const d of [p.places, p.parks, p.leads, p.raw]) mkdirSync(d, { recursive: true });
  const ledger = new CallLedger(p.ledger, opts.cap ?? PLACES_CAP);
  const before = ledger.total();
  const found = new Map<string, Found>();
  let stopped: string | null = null;
  let queries = 0;
  let pages = 0;
  let results = 0;
  const call = async (key: string, file: string, run: () => Promise<{ places?: Place[]; nextPageToken?: string }>) => {
    if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')) as { places?: Place[]; nextPageToken?: string };
    ledger.take(`search-${list}`, key);
    const res = await run();
    writeFileSync(file, JSON.stringify(res, null, 1));
    return res;
  };

  outer: for (const centre of cfg.centres) {
    for (const term of cfg.lists[list].terms) {
      queries++;
      let token: string | undefined;
      for (let page = 1; page <= 3; page++) {
        const file = join(p.places, `${list}-${centre.id}-${slugify(term)}-p${page}.json`);
        if (page > 1 && !token && !existsSync(file)) break;
        let res: { places?: Place[]; nextPageToken?: string };
        try {
          res = await call(`${centre.id}/${term}/${page}`, file, () => searchText(`${term} in ${centre.name}, New Zealand`, centre, token));
        } catch (e) {
          if (e instanceof QuotaStop) {
            stopped = e.message;
            break outer;
          }
          throw e;
        }
        pages++;
        for (const pl of res.places ?? []) {
          results++;
          if (!found.has(pl.id)) found.set(pl.id, { place: pl, centre: centre.name, term, source: 'google places', affiliations: [] });
        }
        token = res.nextPageToken;
        if (!token) break;
      }
    }
    log(`${list} ${centre.id}: ${found.size} unique places so far`);
  }

  // List A also reads the holiday parks association's own park pages.
  let parks = 0;
  let parksMatched = 0;
  let parkSearches = 0;
  if (list === 'A' && !stopped) {
    const polite = new Polite(new HostLimiter(BOOK_DIRECT_GAP_MS));
    const mapFile = join(p.parks, 'park-sitemap.xml');
    if (!existsSync(mapFile)) {
      const r = await polite.get(cfg.holidayParks.sitemap, { timeoutMs: 30_000 });
      if (r.status === 200) writeFileSync(mapFile, r.body);
    }
    const urls = existsSync(mapFile) ? [...readFileSync(mapFile, 'utf8').matchAll(/<loc>([^<]+\/park\/[^<]+)<\/loc>/g)].map((m) => m[1]!) : [];
    const byHost = new Map<string, Found>();
    for (const f of found.values()) {
      const h = hostOfUrl(f.place.websiteUri);
      if (h && !byHost.has(h)) byHost.set(h, f);
    }
    for (const url of urls) {
      const file = join(p.parks, `${slugify(url.replace(/\/$/, '').split('/').pop() ?? url)}.html`);
      let html = existsSync(file) ? readFileSync(file, 'utf8') : '';
      if (!html) {
        const r = await polite.get(url, { timeoutMs: 30_000 });
        if (r.status !== 200) continue;
        html = r.body;
        writeFileSync(file, html);
      }
      const park = parsePark(url, html);
      if (!park) continue;
      parks++;
      const host = hostOfUrl(park.website);
      const hit = host ? byHost.get(host) : undefined;
      if (hit) {
        parksMatched++;
        hit.affiliations = park.affiliations;
        hit.source = `${hit.source} + holidayparks.co.nz`;
        continue;
      }
      // Not found by the searches: one search for the park by name and town, cached.
      const sfile = join(p.places, `A-park-${slugify(park.name)}.json`);
      let res: { places?: Place[] };
      try {
        res = await call(`park/${park.name}`, sfile, () => searchText(`${park.name}, ${park.town}, New Zealand`, null, undefined, 3));
      } catch (e) {
        if (e instanceof QuotaStop) {
          stopped = e.message;
          break;
        }
        throw e;
      }
      parkSearches++;
      const pick = (res.places ?? []).find((x) => (host && hostOfUrl(x.websiteUri) === host) || nameKey(x.displayName?.text ?? '') === nameKey(park.name)) ?? null;
      if (pick && !found.has(pick.id)) {
        parksMatched++;
        found.set(pick.id, { place: pick, centre: park.town, term: 'holiday park', source: 'holidayparks.co.nz', affiliations: park.affiliations });
      }
    }
    log(`holidayparks.co.nz: ${parks} parks read, ${parksMatched} matched to a Google profile`);
  }

  // Filters, in the relay's order.
  const hostCounts = new Map<string, number>();
  for (const f of found.values()) {
    const h = hostOfUrl(f.place.websiteUri);
    if (h) hostCounts.set(h, (hostCounts.get(h) ?? 0) + 1);
  }
  const prior = loadPriorContact(cfg.priorContact);
  const taken = new Set<string>();
  const rows: CandidateRow[] = [];
  for (const f of found.values()) {
    const pl = f.place;
    const name = pl.displayName?.text ?? '';
    const town = townOf(pl, f.centre);
    let slug = slugify(`${name}`) || pl.id.toLowerCase();
    if (taken.has(slug)) slug = `${slug}-${slugify(town)}`;
    for (let i = 2; taken.has(slug); i++) slug = `${slugify(name)}-${i}`;
    taken.add(slug);
    const reason = bookDirectDropReason(pl, { list, cfg, hostCounts }) ?? priorContactReason(prior, { name, town, website: pl.websiteUri ?? '' }) ?? 'kept';
    rows.push({
      slug,
      list,
      place_id: pl.id,
      name,
      town,
      region: regionOf(pl),
      centre: f.centre,
      term: f.term,
      source: f.source,
      address: pl.formattedAddress ?? '',
      phone: pl.nationalPhoneNumber ?? '',
      website: pl.websiteUri ?? '',
      maps: pl.googleMapsUri ?? '',
      rating: pl.rating ?? '',
      rating_count: pl.userRatingCount ?? '',
      status: pl.businessStatus ?? '',
      primary_type: pl.primaryType ?? '',
      flags: placeFlags(pl, f.affiliations).join(';'),
      keep: reason === 'kept',
      reason,
    });
  }
  // Two profiles of one business on one website: the one with more ratings is kept.
  const bestByHost = new Map<string, CandidateRow>();
  for (const r of rows.filter((x) => x.keep)) {
    const h = hostOfUrl(r.website);
    const prev = bestByHost.get(h);
    if (!prev) bestByHost.set(h, r);
    else if (Number(r.rating_count) > Number(prev.rating_count)) {
      Object.assign(prev, { keep: false, reason: 'duplicate_website' });
      bestByHost.set(h, r);
    } else Object.assign(r, { keep: false, reason: 'duplicate_website' });
  }

  writeFileSync(join(p.leads, `_pool_${list}.csv`), toCsv(rows, CANDIDATE_COLUMNS));
  // _candidates.csv holds every list's kept rows; this list's rows are replaced, the others kept.
  const candFile = join(p.leads, '_candidates.csv');
  const others = existsSync(candFile) ? (parseCsv(readFileSync(candFile, 'utf8')) as unknown as CandidateRow[]).filter((r) => r.list !== list) : [];
  // A website already kept in another list stays there.
  const otherHosts = new Set(others.map((r) => hostOfUrl(r.website)));
  for (const r of rows.filter((x) => x.keep && otherHosts.has(hostOfUrl(x.website)))) Object.assign(r, { keep: false, reason: 'in_another_list' });
  const kept = rows.filter((r) => r.keep);
  writeFileSync(candFile, toCsv([...others, ...kept], CANDIDATE_COLUMNS));
  writeFileSync(join(p.leads, `_pool_${list}.csv`), toCsv(rows, CANDIDATE_COLUMNS));

  const drops: Record<string, number> = {};
  for (const r of rows.filter((x) => !x.keep)) drops[r.reason] = (drops[r.reason] ?? 0) + 1;
  return {
    rows,
    summary: { list, queries, pages, results, unique: found.size, parks, parksMatched, parkSearches, kept: kept.length, drops, callsThisRun: ledger.total() - before, callsToday: ledger.today(), stopped, priorFiles: prior.files },
  };
}
