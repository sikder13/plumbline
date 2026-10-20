import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { requireEnv, slugify } from '@plumbline/core';
import { QuotaStop } from '../../enrich.ts';
import { toCsv } from '../../pull.ts';
import { bookDirectPaths, regionOf, townOf, type Place } from '../discover.ts';
import { hostOfUrl, placeFlags, priorContactReason, type Centre } from '../filters.ts';
import { loadPriorContact } from '../prior.ts';
import { loadSweepConfig, perCentreCap, rotation, sweepDropReason, termShares, tradeOf, type Industry } from './config.ts';
import { Registry, registryKey } from './registry.ts';

/** Relay 01's fields, plus the Google types, the location (for nearest competitors) and the opening hours (for the hours check). */
const SWEEP_MASK = [...['id', 'displayName', 'formattedAddress', 'addressComponents', 'nationalPhoneNumber', 'websiteUri', 'googleMapsUri', 'rating', 'userRatingCount', 'businessStatus', 'primaryType', 'types', 'location', 'regularOpeningHours'].map((f) => `places.${f}`), 'nextPageToken'].join(',');

export interface HoursPeriod {
  open: { day: number; hour?: number; minute?: number };
  close?: { day: number; hour?: number; minute?: number };
}

export interface BookSweepPlace extends Place {
  types?: string[];
  location?: { latitude: number; longitude: number };
  regularOpeningHours?: { weekdayDescriptions?: string[]; periods?: HoursPeriod[] };
}

export const PLACES_RUN_CAP = 2000;

export function sweepPaths(name: string) {
  const p = bookDirectPaths();
  const dir = join(p.data, 'sweep', name);
  return { ...p, dir, sites: join(dir, 'sites'), shots: join(dir, 'shots'), places: join(p.data, 'cache', 'places-sweep'), crawlCache: join(p.data, 'cache', 'sweep-sites'), ledger: join(dir, '_places_calls.jsonl'), previews: join(p.data, '..', '..', 'previews', 'review', 'book-direct') };
}

/** Places calls in this sweep, all days together, against the run's cap. */
export class RunLedger {
  constructor(
    private file: string,
    readonly cap: number,
  ) {}
  count(): number {
    return existsSync(this.file) ? readFileSync(this.file, 'utf8').split('\n').filter(Boolean).length : 0;
  }
  take(kind: string, key: string): void {
    if (this.count() >= this.cap) throw new QuotaStop(`the cap of ${this.cap} Places calls for this sweep is reached`);
    appendFileSync(this.file, `${JSON.stringify({ at: new Date().toISOString(), kind, key })}\n`);
  }
}

async function searchText(query: string, centre: Centre, pageToken?: string): Promise<{ places?: BookSweepPlace[]; nextPageToken?: string }> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': requireEnv('GOOGLE_MAPS_API_KEY'), 'x-goog-fieldmask': SWEEP_MASK },
    body: JSON.stringify({
      textQuery: query,
      pageSize: 20,
      regionCode: 'NZ',
      languageCode: 'en',
      locationBias: { circle: { center: { latitude: centre.lat, longitude: centre.lng }, radius: centre.radiusKm * 1000 } },
      ...(pageToken ? { pageToken } : {}),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    if (res.status === 429 || res.status === 403 || /quota|billing|RESOURCE_EXHAUSTED/i.test(body)) throw new QuotaStop(`Places answered ${res.status}: ${body}`);
    throw new Error(`Places answered ${res.status}: ${body}`);
  }
  return (await res.json()) as { places?: BookSweepPlace[]; nextPageToken?: string };
}

export interface SweepCandidate {
  domain: string;
  industry: string;
  trade: string;
  term: string;
  centre: string;
  place_id: string;
  name: string;
  town: string;
  region: string;
  address: string;
  phone: string;
  website: string;
  maps: string;
  rating: number | string;
  rating_count: number | string;
  status: string;
  primary_type: string;
  types: string;
  lat: number | string;
  lng: number | string;
  hours: string;
  hours_periods: string;
  flags: string;
  reason: string;
}

export const SWEEP_CANDIDATE_COLUMNS: (keyof SweepCandidate)[] = ['domain', 'industry', 'trade', 'term', 'centre', 'place_id', 'name', 'town', 'region', 'address', 'phone', 'website', 'maps', 'rating', 'rating_count', 'status', 'primary_type', 'types', 'lat', 'lng', 'hours', 'hours_periods', 'flags', 'reason'];

export interface SweepDiscoverSummary {
  sweep: string;
  perIndustry: Record<string, { target: number; kept: number; terms: Record<string, { share: number; kept: number; centres: string[] }> }>;
  placesSeen: number;
  kept: number;
  drops: Record<string, number>;
  callsThisRun: number;
  callsCached: number;
  callsTotal: number;
  stopped: string | null;
}

/**
 * Part 1 of a sweep: each industry's terms, each term filling its share of about 100 sites, centres taken
 * in a rotated order and at most a few sites per centre per term, so no one city fills a list. Every
 * response is cached; a domain in the registry, on the suppression list or emailed before is never a
 * candidate unless `reaudit` is set.
 */
export async function sweepDiscover(name: string, opts: { cap?: number; reaudit?: boolean; log?: (l: string) => void } = {}): Promise<{ rows: SweepCandidate[]; summary: SweepDiscoverSummary }> {
  const cfg = loadSweepConfig();
  const sp = sweepPaths(name);
  const log = opts.log ?? (() => undefined);
  for (const d of [sp.dir, sp.places]) mkdirSync(d, { recursive: true });
  const ledger = new RunLedger(sp.ledger, opts.cap ?? PLACES_RUN_CAP);
  const registry = new Registry();
  const prior = loadPriorContact(cfg.base.priorContact);
  const before = ledger.count();
  let cached = 0;
  let stopped: string | null = null;
  const seen = new Map<string, SweepCandidate>();
  const keptHosts = new Set<string>();
  const hostCounts = new Map<string, number>();
  const pool: SweepCandidate[] = [];
  const summary: SweepDiscoverSummary = { sweep: name, perIndustry: {}, placesSeen: 0, kept: 0, drops: {}, callsThisRun: 0, callsCached: 0, callsTotal: 0, stopped: null };

  const call = async (key: string, file: string, run: () => Promise<{ places?: BookSweepPlace[]; nextPageToken?: string }>) => {
    if (existsSync(file)) {
      cached++;
      return JSON.parse(readFileSync(file, 'utf8')) as { places?: BookSweepPlace[]; nextPageToken?: string };
    }
    ledger.take('search', key);
    const res = await run();
    writeFileSync(file, JSON.stringify(res, null, 1));
    return res;
  };

  const rowOf = (pl: BookSweepPlace, ind: Industry, term: string, centre: Centre, reason: string): SweepCandidate => ({
    domain: registryKey(pl.websiteUri ?? '') || slugify(pl.displayName?.text ?? pl.id),
    industry: ind.id,
    trade: tradeOf(ind.id, term),
    term,
    centre: centre.name,
    place_id: pl.id,
    name: pl.displayName?.text ?? '',
    town: townOf(pl, centre.name),
    region: regionOf(pl),
    address: pl.formattedAddress ?? '',
    phone: pl.nationalPhoneNumber ?? '',
    website: pl.websiteUri ?? '',
    maps: pl.googleMapsUri ?? '',
    rating: pl.rating ?? '',
    rating_count: pl.userRatingCount ?? '',
    status: pl.businessStatus ?? '',
    primary_type: pl.primaryType ?? '',
    types: (pl.types ?? []).join(';'),
    lat: pl.location?.latitude ?? '',
    lng: pl.location?.longitude ?? '',
    hours: (pl.regularOpeningHours?.weekdayDescriptions ?? []).join(' | '),
    hours_periods: pl.regularOpeningHours?.periods ? JSON.stringify(pl.regularOpeningHours.periods) : '',
    flags: placeFlags(pl).join(';'),
    reason,
  });

  let termIndex = 0;
  outer: for (const ind of cfg.industries) {
    const shares = termShares(cfg.perIndustry, ind.terms);
    const indSum: SweepDiscoverSummary['perIndustry'][string] = { target: cfg.perIndustry, kept: 0, terms: {} };
    summary.perIndustry[ind.id] = indSum;
    for (const term of ind.terms) {
      const share = shares.get(term)!;
      const cap = perCentreCap(share);
      const order = rotation(cfg.centres, termIndex++);
      const t = { share, kept: 0, centres: [] as string[] };
      indSum.terms[term] = t;
      const tokens = new Map<string, string | undefined>();
      for (let page = 1; page <= 3 && t.kept < share; page++) {
        for (const centre of order) {
          if (t.kept >= share) break;
          if (page > 1 && !tokens.get(centre.id)) continue;
          const file = join(sp.places, `${ind.id}-${centre.id}-${slugify(term)}-p${page}.json`);
          let res: { places?: BookSweepPlace[]; nextPageToken?: string };
          try {
            res = await call(`${ind.id}/${centre.id}/${term}/${page}`, file, () => searchText(`${term} in ${centre.name}, New Zealand`, centre, tokens.get(centre.id)));
          } catch (e) {
            if (e instanceof QuotaStop) {
              stopped = e.message;
              break outer;
            }
            throw e;
          }
          tokens.set(centre.id, res.nextPageToken);
          for (const pl of res.places ?? []) {
            const h = hostOfUrl(pl.websiteUri);
            if (h && !seen.has(pl.id)) hostCounts.set(h, (hostCounts.get(h) ?? 0) + 1);
          }
          let here = 0;
          for (const pl of res.places ?? []) {
            if (seen.has(pl.id)) continue;
            if (here >= cap || t.kept >= share) break;
            const host = hostOfUrl(pl.websiteUri);
            const reason =
              sweepDropReason(pl, { industry: ind, cfg, hostCounts }) ??
              (!opts.reaudit && host && registry.has(host) ? 'in_registry' : null) ??
              priorContactReason(prior, { name: pl.displayName?.text ?? '', town: townOf(pl, centre.name), website: pl.websiteUri ?? '' }) ??
              (host && keptHosts.has(host) ? 'duplicate_website' : null) ??
              'kept';
            const row = rowOf(pl, ind, term, centre, reason);
            seen.set(pl.id, row);
            pool.push(row);
            if (reason !== 'kept') continue;
            keptHosts.add(host);
            here++;
            t.kept++;
            indSum.kept++;
          }
          if (here && !t.centres.includes(centre.name)) t.centres.push(centre.name);
        }
      }
      log(`${ind.id} / ${term}: ${t.kept} of ${share} from ${t.centres.length} centres (${ledger.count() - before} Places calls so far)`);
    }
  }

  const kept = pool.filter((r) => r.reason === 'kept');
  for (const r of pool.filter((x) => x.reason !== 'kept')) summary.drops[r.reason] = (summary.drops[r.reason] ?? 0) + 1;
  writeFileSync(join(sp.dir, '_pool.csv'), toCsv(pool, SWEEP_CANDIDATE_COLUMNS));
  writeFileSync(join(sp.dir, '_candidates.csv'), toCsv(kept, SWEEP_CANDIDATE_COLUMNS));
  summary.placesSeen = pool.length;
  summary.kept = kept.length;
  summary.callsThisRun = ledger.count() - before;
  summary.callsCached = cached;
  summary.callsTotal = ledger.count();
  summary.stopped = stopped;
  writeFileSync(join(sp.dir, '_discover.json'), JSON.stringify(summary, null, 1));
  return { rows: kept, summary };
}
