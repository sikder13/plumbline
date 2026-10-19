import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import sharp from 'sharp';
import { openDb, paths, requireEnv, slugify } from '@plumbline/core';
import { ensureToken } from '@plumbline/preview';
import { earlierSlugs, parseCsv, sharpness } from './batch.ts';
import { CallLedger, QuotaStop, nameMatch, photoUri, sameAddress, tradeWords, type Details, type SearchPlace } from './enrich.ts';
import { plainWords } from './names.ts';
import { campaignPaths, loadDictionary, toCsv } from './pull.ts';

/** The sweep's own field masks: the search asks for what bucketing needs, Details for what scoring needs. */
const SWEEP_MASK = [...['id', 'displayName', 'formattedAddress', 'addressComponents', 'nationalPhoneNumber', 'websiteUri', 'googleMapsUri', 'rating', 'userRatingCount', 'businessStatus', 'primaryType', 'primaryTypeDisplayName'].map((f) => `places.${f}`), 'nextPageToken'].join(',');
const SWEEP_DETAILS_MASK = ['regularOpeningHours', 'photos', 'editorialSummary', 'reviews'].join(',');

export interface SweepPlace extends SearchPlace {
  nationalPhoneNumber?: string;
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  primaryTypeDisplayName?: { text: string };
}

export type SweepDetails = Pick<Details, 'regularOpeningHours' | 'photos' | 'editorialSummary' | 'reviews'>;

export interface Area {
  id: string;
  label: string;
  lat: number;
  lng: number;
  radiusKm: number;
}

export interface SweepConfig {
  terms: Record<string, string[]>;
  cities: Record<string, { name: string; areas: Area[] }>;
}

export function loadSweep(campaign: string): SweepConfig {
  return parse(readFileSync(join(campaignPaths(campaign).config, 'sweep.yml'), 'utf8')) as SweepConfig;
}

/** The faith screen: words a name or a Google type may not carry, whole words only. */
const FAITH = ['bar', 'pub', 'lounge', 'club', 'hookah', 'vape', 'smoke', 'liquor', 'hemp', 'cbd', 'dispensary', 'casino', 'pawn', 'adult'];
/** Google types that are the same thing under another name. */
const FAITH_TYPES = /^(bar|pub|night_club|wine_bar|cocktail_bar|sports_bar|hookah_bar|lounge_bar|liquor_store|casino|cannabis_store|tobacco_shop|vape_shop|pawn_shop|adult_entertainment_store|adult_entertainment_club)$/;

function hasWord(words: string[], word: string): boolean {
  const parts = plainWords(word);
  return words.some((_, i) => parts.every((p, j) => words[i + j] === p || (j === parts.length - 1 && words[i + j] === `${p}s`)));
}

/** Why a profile is dropped, in the relay's order, or null when it is kept as bucket A. */
export function dropReason(p: SweepPlace, franchises: string[]): string | null {
  if (p.websiteUri) return 'website';
  if (p.businessStatus !== 'OPERATIONAL') return 'status';
  const n = p.userRatingCount ?? 0;
  if (n < 3 || n > 150) return 'rating count';
  const name = p.displayName?.text ?? '';
  const words = plainWords(name);
  if (franchises.some((f) => hasWord(words, f)) || /#\s*\d+|\bstore\s*(no\.?\s*)?\d+/i.test(name)) return 'franchise';
  const typeWords = (p.primaryType ?? '').split('_');
  if (FAITH.some((w) => hasWord(words, w)) || FAITH_TYPES.test(p.primaryType ?? '') || FAITH.some((w) => typeWords.includes(w))) return 'faith screen';
  return null;
}

/** One point each, eight in all. */
export function sweepScore(p: Pick<SweepPlace, 'userRatingCount' | 'rating' | 'nationalPhoneNumber'>, d: SweepDetails, group: string, newFiling: boolean): { score: number; points: string[] } {
  const points: string[] = [];
  const n = p.userRatingCount ?? 0;
  if (n >= 5 && n <= 60) points.push(`${n} reviews (5 to 60)`);
  if ((p.rating ?? 0) >= 4.3) points.push(`rated ${p.rating} (4.3 or better)`);
  if (d.regularOpeningHours?.weekdayDescriptions?.length) points.push('hours on the profile');
  if ((d.photos?.length ?? 0) >= 6) points.push(`${d.photos!.length} photos (6 or more)`);
  if (p.nationalPhoneNumber) points.push('phone on the profile');
  if (d.editorialSummary?.text) points.push('Google description');
  if (group === 'beauty' || group === 'food') points.push(`trade group ${group}`);
  if (newFiling) points.push('new filing in INBiz');
  return { score: points.length, points };
}

/** A profile that is also a September filing: the distinctive name agrees and the street number is the same. */
export function isNewFiling(p: SweepPlace, filings: { name: string; address: string; created: string }[], generic: Set<string>): { created: string } | null {
  for (const f of filings) if (sameAddress(f.address, p.formattedAddress) && nameMatch(f.name, p.displayName?.text ?? '', generic) >= 0.8) return { created: f.created };
  return null;
}

/** Ten to build and ten alternates: score, then rating count, four per trade group at most, none excluded. */
export function pickSweep<T extends { slug: string; name: string; group: string; score: number; count: number }>(list: T[], exclude: Set<string>): { picked: T[]; alternates: T[] } {
  const ranked = list.filter((l) => !exclude.has(l.slug) && !exclude.has(l.name.toLowerCase())).sort((a, b) => b.score - a.score || b.count - a.count || a.slug.localeCompare(b.slug));
  const picked: T[] = [];
  const count: Record<string, number> = {};
  for (const l of ranked) {
    if (picked.length === 10) break;
    if ((count[l.group] ?? 0) >= 4) continue;
    count[l.group] = (count[l.group] ?? 0) + 1;
    picked.push(l);
  }
  const chosen = new Set(picked.map((l) => l.slug));
  return { picked, alternates: ranked.filter((l) => !chosen.has(l.slug)).slice(0, 10) };
}

async function placesCall<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    if (res.status === 429 || res.status === 403 || /quota|billing|RESOURCE_EXHAUSTED/i.test(body)) throw new QuotaStop(`Places answered ${res.status}: ${body}`);
    throw new Error(`Places answered ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

function searchPage(query: string, area: Area, pageToken?: string): Promise<{ places?: SweepPlace[]; nextPageToken?: string }> {
  return placesCall('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': requireEnv('GOOGLE_MAPS_API_KEY'), 'x-goog-fieldmask': SWEEP_MASK },
    body: JSON.stringify({ textQuery: query, pageSize: 20, regionCode: 'US', languageCode: 'en', locationBias: { circle: { center: { latitude: area.lat, longitude: area.lng }, radius: area.radiusKm * 1000 } }, ...(pageToken ? { pageToken } : {}) }),
  });
}

function sweepDetails(id: string): Promise<SweepDetails> {
  return placesCall(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`, { headers: { 'x-goog-api-key': requireEnv('GOOGLE_MAPS_API_KEY'), 'x-goog-fieldmask': SWEEP_DETAILS_MASK } });
}

export interface Found {
  place: SweepPlace;
  group: string;
  term: string;
  area: string;
  /** Every query that returned it. */
  hits: number;
}

export interface SweepRow {
  slug: string;
  id: string;
  name: string;
  group: string;
  term: string;
  area: string;
  address: string;
  phone: string;
  maps: string;
  type: string;
  rating: number | null;
  count: number | null;
  website: string;
  status: string;
  reason: string;
  newFiling: boolean;
  filed: string;
  hours: boolean;
  photos: number;
  summary: boolean;
  score: number;
  points: string;
  details: boolean;
}

export const SWEEP_COLUMNS: (keyof SweepRow)[] = ['slug', 'id', 'name', 'group', 'term', 'area', 'address', 'phone', 'maps', 'type', 'rating', 'count', 'website', 'status', 'reason', 'newFiling', 'filed', 'hours', 'photos', 'summary', 'score', 'points', 'details'];

export interface SweepSummary {
  queries: number;
  pages: number;
  returned: number;
  unique: number;
  drops: Record<string, number>;
  bucketA: number;
  byGroup: Record<string, number>;
  byArea: Record<string, number>;
  details: number;
  newFilings: number;
  callsThisRun: number;
  callsToday: number;
  stopped: string | null;
}

export interface SweepOptions {
  city: string;
  /** Calls allowed today across every ledger of the campaign. */
  ceiling: number;
  detailsCap: number;
  log?: (line: string) => void;
}

/**
 * Part 1 and 2 of the sweep: every term in every area, up to three pages each, all cached; then the
 * profiles are deduplicated, dropped by reason, Details fetched for bucket A (cached), tagged against
 * the September filings, and scored.
 */
export async function sweep(campaign: string, opts: SweepOptions): Promise<{ rows: SweepRow[]; summary: SweepSummary }> {
  const p = campaignPaths(campaign);
  const cfg = loadSweep(campaign);
  const city = cfg.cities[opts.city];
  if (!city) throw new Error(`no city "${opts.city}" in config/${campaign}/sweep.yml`);
  const dir = join(p.data, 'cache', 'sweep', opts.city);
  const detailDir = join(p.data, 'cache', 'sweep', 'details');
  mkdirSync(dir, { recursive: true });
  mkdirSync(detailDir, { recursive: true });
  const ledger = new CallLedger(join(p.data, 'cache', 'sweep', '_calls.jsonl'), opts.ceiling, [join(p.cache, '_calls.jsonl')]);
  const log = opts.log ?? (() => undefined);
  const before = ledger.total();
  let stopped: string | null = null;
  let queries = 0;
  let pages = 0;
  let returned = 0;
  const found = new Map<string, Found>();

  outer: for (const area of city.areas) {
    for (const [group, terms] of Object.entries(cfg.terms)) {
      for (const term of terms) {
        queries++;
        let token: string | undefined;
        for (let page = 1; page <= 3; page++) {
          const file = join(dir, `${area.id}-${slugify(term)}-p${page}.json`);
          let res: { places?: SweepPlace[]; nextPageToken?: string };
          if (existsSync(file)) res = JSON.parse(readFileSync(file, 'utf8'));
          else {
            if (page > 1 && !token) break;
            try {
              ledger.take('sweepSearch', `${area.id}/${term}/${page}`);
              res = await searchPage(`${term} in ${city.name}, IN`, area, token);
            } catch (e) {
              if (e instanceof QuotaStop) {
                stopped = e.message;
                break outer;
              }
              throw e;
            }
            writeFileSync(file, JSON.stringify(res, null, 2));
          }
          pages++;
          for (const pl of res.places ?? []) {
            returned++;
            const seen = found.get(pl.id);
            if (seen) seen.hits++;
            else found.set(pl.id, { place: pl, group, term, area: area.id, hits: 1 });
          }
          token = res.nextPageToken;
          if (!token) break;
        }
        log(`${area.id} / ${term}: ${found.size} unique so far`);
      }
    }
  }

  const dict = loadDictionary(campaign);
  const generic = tradeWords(dict);
  const filings = parseCsv(readFileSync(join(p.leads, '_candidates.csv'), 'utf8')).map((r) => ({ name: r.name!, address: r.address!, created: r.created! }));
  const taken = new Set<string>();
  const rows: SweepRow[] = [];
  for (const f of found.values()) {
    const pl = f.place;
    const name = pl.displayName?.text ?? '';
    let slug = slugify(name) || pl.id.toLowerCase();
    if (taken.has(slug)) slug = `${slug}-${slugify(f.area)}`;
    for (let i = 2; taken.has(slug); i++) slug = `${slugify(name)}-${i}`;
    taken.add(slug);
    const reason = dropReason(pl, dict.franchises) ?? 'kept';
    const nf = reason === 'kept' ? isNewFiling(pl, filings, new Set([...generic, 'indianapolis', 'indy'])) : null;
    rows.push({ slug, id: pl.id, name, group: f.group, term: f.term, area: f.area, address: pl.formattedAddress ?? '', phone: pl.nationalPhoneNumber ?? '', maps: pl.googleMapsUri ?? '', type: pl.primaryTypeDisplayName?.text ?? pl.primaryType ?? '', rating: pl.rating ?? null, count: pl.userRatingCount ?? null, website: pl.websiteUri ?? '', status: pl.businessStatus ?? '', reason, newFiling: !!nf, filed: nf?.created ?? '', hours: false, photos: 0, summary: false, score: 0, points: '', details: false });
  }

  // Details for bucket A: those with 5 to 60 ratings first, then the rest by rating count, up to the cap.
  const bucketA = rows.filter((r) => r.reason === 'kept');
  const order = [...bucketA].sort((a, b) => {
    const band = (r: SweepRow) => ((r.count ?? 0) >= 5 && (r.count ?? 0) <= 60 ? 0 : 1);
    return band(a) - band(b) || (b.count ?? 0) - (a.count ?? 0);
  });
  let detailCalls = 0;
  for (const r of order.slice(0, opts.detailsCap)) {
    if (stopped) break;
    const file = join(detailDir, `${r.id}.json`);
    let d: SweepDetails;
    if (existsSync(file)) d = JSON.parse(readFileSync(file, 'utf8'));
    else {
      try {
        ledger.take('sweepDetails', r.slug);
        d = await sweepDetails(r.id);
        detailCalls++;
      } catch (e) {
        if (e instanceof QuotaStop) {
          stopped = e.message;
          break;
        }
        throw e;
      }
      writeFileSync(file, JSON.stringify(d, null, 2));
    }
    const pl = found.get(r.id)!.place;
    const s = sweepScore(pl, d, r.group, r.newFiling);
    Object.assign(r, { details: true, hours: !!d.regularOpeningHours?.weekdayDescriptions?.length, photos: d.photos?.length ?? 0, summary: !!d.editorialSummary?.text, score: s.score, points: s.points.join('; ') });
    if (detailCalls && detailCalls % 100 === 0) log(`details: ${detailCalls}`);
  }

  writeFileSync(join(p.leads, '_sweep_pool.csv'), toCsv(rows, SWEEP_COLUMNS));
  const scored = rows.filter((r) => r.reason === 'kept' && r.details).sort((a, b) => b.score - a.score || (b.count ?? 0) - (a.count ?? 0));
  writeFileSync(join(p.leads, '_sweep_scored.csv'), toCsv(scored, SWEEP_COLUMNS));

  // Profiles with a website go to the campaign B queue with their trade, once each.
  const queue = join(p.data, 'campaign-b-queue.csv');
  const qcols = ['slug', 'name', 'trading', 'group', 'city', 'website', 'phone', 'maps', 'created', 'source', 'trade'];
  const known = existsSync(queue) ? parseCsv(readFileSync(queue, 'utf8')) : [];
  const knownKeys = new Set(known.flatMap((r) => [r.slug, r.maps].filter(Boolean)));
  const header = existsSync(queue) ? readFileSync(queue, 'utf8').split('\n')[0]! : '';
  const fresh = rows.filter((r) => r.reason === 'website' && !knownKeys.has(r.slug) && !knownKeys.has(r.maps)).map((r) => ({ slug: r.slug, name: r.name, trading: r.name, group: r.group, city: city.name, website: r.website, phone: r.phone, maps: r.maps, created: '', source: `sweep ${opts.city}`, trade: r.term }));
  if (!header.includes('source')) writeFileSync(queue, toCsv([...known, ...fresh] as Record<string, unknown>[], qcols as never[]));
  else if (fresh.length) appendFileSync(queue, toCsv(fresh, qcols as (keyof (typeof fresh)[number])[]).split('\n').slice(1).join('\n'));

  const drops: Record<string, number> = {};
  for (const r of rows.filter((x) => x.reason !== 'kept')) drops[r.reason] = (drops[r.reason] ?? 0) + 1;
  const byGroup: Record<string, number> = {};
  const byArea: Record<string, number> = {};
  for (const r of bucketA) {
    byGroup[r.group] = (byGroup[r.group] ?? 0) + 1;
    byArea[r.area] = (byArea[r.area] ?? 0) + 1;
  }
  return {
    rows,
    summary: { queries, pages, returned, unique: rows.length, drops, bucketA: bucketA.length, byGroup, byArea, details: rows.filter((r) => r.details).length, newFilings: bucketA.filter((r) => r.newFiling).length, callsThisRun: ledger.total() - before, callsToday: ledger.today(), stopped },
  };
}

export interface SweepPicked extends SweepRow {
  token: string;
  demoUrl: string;
}

const SWEEP_LEADS_COLUMNS = ['slug', 'legal_name', 'trading_name', 'trade_group', 'city', 'county', 'zip', 'filing_date', 'phone', 'address', 'hours', 'photo_count', 'score', 'google_link', 'facebook_link', 'email', 'planned_demo_url', 'status', 'new_filing', 'rating', 'rating_count', 'facebook_url', 'instagram_url'];

/**
 * Part 3's data step: picks the ten and ten alternates from _sweep_scored.csv (none already in another
 * batch or in the campaign B queue), gives each its demo address, downloads up to ten of its own
 * Google photos, and writes the batch folder, LEADS.csv and ALTERNATES.csv.
 */
export async function pickSweepBatch(campaign: string, batch: string, opts: { ceiling: number; log?: (line: string) => void }): Promise<{ picked: SweepPicked[]; alternates: SweepRow[]; stopped: string | null; calls: number }> {
  const p = campaignPaths(campaign);
  const log = opts.log ?? (() => undefined);
  const rows = parseCsv(readFileSync(join(p.leads, '_sweep_scored.csv'), 'utf8')).map((r) => ({ ...(r as unknown as SweepRow), score: Number(r.score), count: Number(r.count), rating: r.rating ? Number(r.rating) : null, photos: Number(r.photos), newFiling: r.newFiling === 'true', hours: r.hours === 'true', summary: r.summary === 'true', details: r.details === 'true' }));
  // Not again: any business already in a batch (by slug or by its Google place), or waiting in the campaign B queue.
  const exclude = earlierSlugs(p.batches, batch);
  if (existsSync(p.batches)) {
    for (const b of readdirSync(p.batches)) {
      if (b === batch) continue;
      for (const f of readdirSync(join(p.batches, b), { withFileTypes: true })) {
        const facts = join(p.batches, b, f.name, 'facts.json');
        if (f.isDirectory() && existsSync(facts)) {
          const j = JSON.parse(readFileSync(facts, 'utf8')) as { details?: { id?: string; displayName?: { text: string } } };
          if (j.details?.id) exclude.add(j.details.id);
          if (j.details?.displayName?.text) exclude.add(j.details.displayName.text.toLowerCase());
        }
      }
    }
  }
  const queue = join(p.data, 'campaign-b-queue.csv');
  if (existsSync(queue)) for (const r of parseCsv(readFileSync(queue, 'utf8'))) for (const k of [r.slug, r.name?.toLowerCase(), r.trading?.toLowerCase()]) if (k) exclude.add(k);
  const eligible = rows.filter((r) => !exclude.has(r.id));
  const { picked, alternates } = pickSweep(eligible, exclude);
  const dir = join(p.batches, batch);
  mkdirSync(dir, { recursive: true });
  const db = openDb(paths.db);
  const ledger = new CallLedger(join(p.data, 'cache', 'sweep', '_calls.jsonl'), opts.ceiling, [join(p.cache, '_calls.jsonl')]);
  const before = ledger.total();
  let stopped: string | null = null;
  const out: SweepPicked[] = [];
  for (const [i, lead] of picked.entries()) {
    const token = ensureToken(db, lead.slug);
    const demoUrl = `https://nahltech.com/demo/${lead.slug}-${token}`;
    const search = (() => {
      const cityDir = join(p.data, 'cache', 'sweep');
      for (const c of Object.keys(loadSweep(campaign).cities)) {
        const d = join(cityDir, c);
        if (!existsSync(d)) continue;
        for (const f of readdirSync(d).filter((x) => x.endsWith('.json'))) {
          const j = JSON.parse(readFileSync(join(d, f), 'utf8')) as { places?: SweepPlace[] };
          const hit = j.places?.find((x) => x.id === lead.id);
          if (hit) return hit;
        }
      }
      return null;
    })();
    const details = JSON.parse(readFileSync(join(p.data, 'cache', 'sweep', 'details', `${lead.id}.json`), 'utf8')) as SweepDetails;
    const folder = join(dir, lead.slug);
    const assets = join(p.assets, lead.slug);
    mkdirSync(folder, { recursive: true });
    mkdirSync(assets, { recursive: true });
    const listFile = join(assets, 'photos.json');
    const files: { file: string; width: number; height: number; sharpness: number; author: string; authorUri: string }[] = existsSync(listFile) ? JSON.parse(readFileSync(listFile, 'utf8')) : [];
    const left = Math.max(0, opts.ceiling - ledger.today());
    const share = Math.min(10, Math.floor(left / (picked.length - i)));
    const saved = new Set(files.map((f) => f.file));
    const wanted = (details.photos ?? []).slice(0, 10).map((ph, k) => ({ ph, name: `photo-${String(k + 1).padStart(2, '0')}.jpg` })).filter((x) => !saved.has(x.name)).slice(0, share);
    for (const { ph, name } of wanted) {
      if (stopped) break;
      try {
        ledger.take('sweepPhoto', lead.slug);
        const { photoUri: uri } = await photoUri(ph.name);
        const res = await fetch(uri, { signal: AbortSignal.timeout(30_000) });
        if (!res.ok) throw new Error(`photo ${res.status}`);
        const file = join(assets, name);
        const info = await sharp(Buffer.from(await res.arrayBuffer())).rotate().resize({ width: 2000, withoutEnlargement: true }).jpeg({ quality: 92, mozjpeg: true }).toFile(file);
        files.push({ file: name, width: info.width, height: info.height, sharpness: await sharpness(file), author: ph.authorAttributions?.[0]?.displayName ?? '', authorUri: ph.authorAttributions?.[0]?.uri ?? '' });
      } catch (e) {
        if (e instanceof QuotaStop) {
          stopped = e.message;
          break;
        }
        log(`  ${lead.slug} ${name}: ${(e as Error).message}`);
      }
    }
    files.sort((a, b) => a.file.localeCompare(b.file));
    writeFileSync(listFile, JSON.stringify(files, null, 2));
    writeFileSync(join(folder, 'facts.json'), JSON.stringify({ lead: { ...lead, token, demoUrl }, search, details, photos: files }, null, 2));
    out.push({ ...lead, token, demoUrl });
    log(`${lead.slug}: picked, score ${lead.score}, ${lead.count} reviews, ${files.length} photos, ${demoUrl}`);
  }
  db.close();
  const leadsFile = join(dir, 'LEADS.csv');
  const kept = existsSync(leadsFile) ? new Map(parseCsv(readFileSync(leadsFile, 'utf8')).map((r) => [r.slug!, r])) : new Map<string, Record<string, string>>();
  const rowsOut = out.map((l) => {
    const k = kept.get(l.slug) ?? {};
    const zip = /\b(\d{5})\b/.exec(l.address)?.[1] ?? '';
    const photoCount = existsSync(join(p.assets, l.slug, 'photos.json')) ? (JSON.parse(readFileSync(join(p.assets, l.slug, 'photos.json'), 'utf8')) as unknown[]).length : 0;
    return { slug: l.slug, legal_name: k.legal_name ?? '', trading_name: l.name, trade_group: l.group, city: k.city ?? '', county: k.county ?? '', zip, filing_date: l.filed, phone: l.phone, address: l.address, hours: l.hours ? 'yes' : 'no', photo_count: photoCount, score: l.score, google_link: l.maps, facebook_link: k.facebook_link ?? '', email: k.email ?? '', planned_demo_url: l.demoUrl, status: k.status || 'researched', new_filing: l.newFiling ? 'yes' : 'no', rating: l.rating ?? '', rating_count: l.count ?? '', facebook_url: k.facebook_url ?? '', instagram_url: k.instagram_url ?? '' };
  });
  writeFileSync(leadsFile, toCsv(rowsOut, SWEEP_LEADS_COLUMNS as (keyof (typeof rowsOut)[number])[]));
  writeFileSync(join(dir, 'ALTERNATES.csv'), toCsv(alternates, ['slug', 'name', 'group', 'term', 'area', 'score', 'rating', 'count', 'photos', 'hours', 'phone', 'maps', 'address']));
  return { picked: out, alternates, stopped, calls: ledger.total() - before };
}
