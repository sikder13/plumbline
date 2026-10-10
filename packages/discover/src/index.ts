import pLimit from 'p-limit';
import { config, domainOf, foldName, kvGet, kvSet, requireEnv, slugify, utcIso, type Business, type Db } from '@plumbline/core';
import { callCount, guard, loadPrices, placesCallCost, record } from '@plumbline/budget';
import { NOT_OWN_SITE, exclusionFor } from '@plumbline/checks';
import { rawFetch, type Polite } from '@plumbline/fetch';

export interface Region {
  name: string;
  lat: number;
  lng: number;
  radiusKm: number;
}

/** Search areas for New Zealand. The circle only biases results towards the region. */
export const NZ_REGIONS: Region[] = [
  { name: 'Northland', lat: -35.4, lng: 173.9, radiusKm: 50 },
  { name: 'Auckland', lat: -36.75, lng: 174.85, radiusKm: 50 },
  { name: 'Coromandel', lat: -36.85, lng: 175.65, radiusKm: 40 },
  { name: 'Waikato', lat: -37.9, lng: 175.2, radiusKm: 50 },
  { name: 'Bay of Plenty', lat: -37.75, lng: 176.6, radiusKm: 50 },
  { name: 'Rotorua', lat: -38.14, lng: 176.25, radiusKm: 30 },
  { name: 'Taupō', lat: -38.75, lng: 176.0, radiusKm: 40 },
  { name: "Hawke's Bay", lat: -39.55, lng: 176.85, radiusKm: 50 },
  { name: 'Wellington', lat: -41.15, lng: 175.2, radiusKm: 50 },
  { name: 'Nelson Tasman', lat: -41.05, lng: 173.0, radiusKm: 50 },
  { name: 'Marlborough', lat: -41.35, lng: 173.95, radiusKm: 50 },
  { name: 'Kaikōura', lat: -42.4, lng: 173.68, radiusKm: 30 },
  { name: 'West Coast', lat: -42.9, lng: 170.9, radiusKm: 50 },
  { name: 'Canterbury', lat: -43.6, lng: 172.6, radiusKm: 50 },
  { name: 'Mackenzie', lat: -44.05, lng: 170.3, radiusKm: 50 },
  { name: 'Otago', lat: -45.6, lng: 170.3, radiusKm: 50 },
  { name: 'Queenstown', lat: -45.03, lng: 168.66, radiusKm: 30 },
  { name: 'Wānaka', lat: -44.7, lng: 169.13, radiusKm: 30 },
  { name: 'Fiordland', lat: -45.42, lng: 167.72, radiusKm: 50 },
  { name: 'Southland', lat: -46.5, lng: 168.4, radiusKm: 50 },
];

export const TOURISM_ACTIVITIES = ['kayak tours', 'boat cruises', 'fishing charters', 'guided walks', 'wildlife tours', 'winery cellar door tastings', 'horse trekking', 'eco tours'];
export const TOURISM_EXTRA_ACTIVITIES = ['jet boat', 'scenic tours', 'food tours', 'stargazing', 'cave tours'];

export const FIELD_MASK = ['places.id', 'places.displayName', 'places.formattedAddress', 'places.location', 'places.websiteUri', 'places.rating', 'places.userRatingCount', 'places.nationalPhoneNumber', 'places.types', 'places.businessStatus'].join(',');

export interface Place {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  nationalPhoneNumber?: string;
  types?: string[];
  businessStatus?: string;
}

export function searchBody(region: Region, activity: string): Record<string, unknown> {
  return {
    textQuery: `${activity} in ${region.name}, New Zealand`,
    pageSize: 20,
    languageCode: 'en',
    regionCode: 'NZ',
    locationBias: { circle: { center: { latitude: region.lat, longitude: region.lng }, radius: region.radiusKm * 1000 } },
  };
}

export type PlacesSearch = (body: Record<string, unknown>) => Promise<Place[]>;

export const googlePlacesSearch: PlacesSearch = async (body) => {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': requireEnv('GOOGLE_MAPS_API_KEY'), 'x-goog-fieldmask': FIELD_MASK },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Places API returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()) as { places?: Place[] }).places ?? [];
};

/** The town is the part of the address before the postcode and country. */
export function townFrom(address: string | undefined): string | null {
  if (!address) return null;
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const withPostcode = parts.findLast((p) => /\b\d{4}\b/.test(p) && !/^new zealand$/i.test(p));
  const town = (withPostcode ?? parts[parts.length - 2]!).replace(/\b\d{4}\b/, '').trim();
  return town || null;
}

export function uniqueSlug(db: Db, name: string, town: string | null): string {
  const base = slugify(name.replace(/\(.*?\)/g, ' ')) || 'business';
  const taken = (s: string) => !!db.prepare('SELECT 1 FROM businesses WHERE slug = ?').get(s);
  if (!taken(base)) return base;
  const withTown = town ? `${base}-${slugify(town)}` : base;
  if (withTown !== base && !taken(withTown)) return withTown;
  for (let i = 2; ; i++) if (!taken(`${withTown}-${i}`)) return `${withTown}-${i}`;
}

export interface UpsertResult {
  added: number;
  matchedExisting: number;
  duplicates: number;
}

/** Adds places as candidates. A place already known by id or by website domain updates that row. */
export function upsertPlaces(db: Db, places: Place[], region: Region, activity: string): UpsertResult {
  const result: UpsertResult = { added: 0, matchedExisting: 0, duplicates: 0 };
  for (const p of places) {
    const name = p.displayName?.text?.trim();
    if (!p.id || !name) continue;
    const domain = p.websiteUri && !NOT_OWN_SITE.test(new URL(p.websiteUri).hostname) ? domainOf(p.websiteUri) : null;
    const byPlace = db.prepare('SELECT id FROM businesses WHERE google_place_id = ?').get(p.id) as { id: number } | undefined;
    if (byPlace) {
      result.duplicates += 1;
      continue;
    }
    const byDomain = domain ? (db.prepare('SELECT id, google_place_id, source, name FROM businesses WHERE domain = ?').get(domain) as { id: number; google_place_id: string | null; source: string; name: string } | undefined) : undefined;
    if (byDomain) {
      // The same website under another listing: keep one business, and take the Google data if it has none yet.
      if (!byDomain.google_place_id) {
        db.prepare('UPDATE businesses SET google_place_id = ?, google_rating = ?, google_review_count = ?, google_business_status = ?, lat = COALESCE(lat, ?), lng = COALESCE(lng, ?) WHERE id = ?').run(p.id, p.rating ?? null, p.userRatingCount ?? null, p.businessStatus ?? null, p.location?.latitude ?? null, p.location?.longitude ?? null, byDomain.id);
        result.matchedExisting += 1;
      } else result.duplicates += 1;
      continue;
    }
    const town = townFrom(p.formattedAddress);
    db.prepare(
      `INSERT INTO businesses (slug, name, website, domain, country, region, town, lat, lng, pack, activity, source, google_place_id, google_rating, google_review_count, google_business_status, phone, seed, status, created_at)
       VALUES (?, ?, ?, ?, 'NZ', ?, ?, ?, ?, 'tourism', ?, 'discovered', ?, ?, ?, ?, ?, ?, 'candidate', ?)`,
    ).run(uniqueSlug(db, name, town), name, p.websiteUri ?? null, domain, region.name, town, p.location?.latitude ?? null, p.location?.longitude ?? null, activity, p.id, p.rating ?? null, p.userRatingCount ?? null, p.businessStatus ?? null, p.nationalPhoneNumber ?? null, JSON.stringify({ address: p.formattedAddress ?? null, types: p.types ?? [], query: `${activity} in ${region.name}` }), utcIso());
    result.added += 1;
  }
  return result;
}

export interface DiscoverOptions {
  activities?: string[];
  regions?: Region[];
  search?: PlacesSearch;
  log?: (line: string) => void;
  /** Ceiling on queries in this call, on top of the daily and total limits. */
  maxQueries?: number;
  totalCap?: number;
}

export interface DiscoverResult {
  queries: number;
  skipped: number;
  added: number;
  matchedExisting: number;
  duplicates: number;
  stoppedBy: 'done' | 'daily_limit' | 'total_cap' | 'max_queries';
}

/** One Text Search per region and activity. Each pair is asked once and remembered. */
export async function discover(db: Db, opts: DiscoverOptions = {}): Promise<DiscoverResult> {
  const log = opts.log ?? ((l: string) => console.log(l));
  const search = opts.search ?? googlePlacesSearch;
  const prices = loadPrices();
  const regions = opts.regions ?? NZ_REGIONS;
  const activities = opts.activities ?? TOURISM_ACTIVITIES;
  const totalCap = opts.totalCap ?? config.places.maxQueries;
  const result: DiscoverResult = { queries: 0, skipped: 0, added: 0, matchedExisting: 0, duplicates: 0, stoppedBy: 'done' };

  const pairs = regions.flatMap((r) => activities.map((a) => ({ r, a }))).filter(({ r, a }) => !kvGet(db, `places:${r.name}:${a}`));
  result.skipped = regions.length * activities.length - pairs.length;
  log(`[budget] Places Text Search: ${pairs.length} queries to run at list price $${prices.providers.google_places.per_call.toFixed(3)} each ($${(pairs.length * prices.providers.google_places.per_call).toFixed(2)} at list). Counted as $0 while this month's calls stay under ${prices.providers.google_places.count_as_free_until}.`);

  for (const { r, a } of pairs) {
    const now = new Date();
    if (callCount(db, 'google_places', now.toISOString().slice(0, 10)) >= config.places.perDay) {
      result.stoppedBy = 'daily_limit';
      break;
    }
    if (callCount(db, 'google_places', '') >= totalCap) {
      result.stoppedBy = 'total_cap';
      break;
    }
    if (opts.maxQueries !== undefined && result.queries >= opts.maxQueries) {
      result.stoppedBy = 'max_queries';
      break;
    }
    const cost = placesCallCost(db, prices, now);
    guard(db, `Places "${a} in ${r.name}"`, cost.actual, { quiet: true });
    let places: Place[];
    try {
      places = await search(searchBody(r, a));
    } catch (e) {
      // A failed request may still be billed, so it is recorded.
      record(db, { provider: 'google_places', operation: 'text_search', units: { region: r.name, activity: a, error: (e as Error).message.slice(0, 120) }, estimatedUsd: cost.estimated, actualUsd: cost.actual });
      throw e;
    }
    record(db, { provider: 'google_places', operation: 'text_search', units: { region: r.name, activity: a, calls: 1, results: places.length }, estimatedUsd: cost.estimated, actualUsd: cost.actual });
    const u = upsertPlaces(db, places, r, a);
    kvSet(db, `places:${r.name}:${a}`, JSON.stringify({ results: places.length, ...u }));
    result.queries += 1;
    result.added += u.added;
    result.matchedExisting += u.matchedExisting;
    result.duplicates += u.duplicates;
    log(`  ${a} in ${r.name}: ${places.length} results, ${u.added} new`);
  }
  return result;
}

const NOT_ACTIVITY = new Set(['lodging', 'hotel', 'motel', 'hostel', 'bed_and_breakfast', 'campground', 'rv_park', 'resort_hotel', 'guest_house', 'cottage', 'restaurant', 'cafe', 'bar', 'pub', 'supermarket', 'grocery_store', 'gas_station', 'car_rental', 'real_estate_agency', 'school', 'university', 'hospital', 'shopping_mall', 'clothing_store', 'liquor_store', 'bakery', 'meal_takeaway', 'car_dealer', 'car_repair', 'bank', 'pharmacy', 'airport', 'bus_station', 'train_station', 'transit_station', 'visitor_center', 'local_government_office', 'museum', 'library', 'church', 'place_of_worship', 'national_park', 'park', 'hiking_area', 'beach', 'natural_feature']);
const ACTIVITY = new Set(['tourist_attraction', 'travel_agency', 'tour_agency', 'winery', 'vineyard', 'marina', 'fishing_charter', 'boat_tour_agency', 'adventure_sports_center', 'sports_activity_location', 'tour_operator', 'stable', 'ranch', 'farm', 'observatory', 'wildlife_park', 'zoo', 'aquarium', 'amusement_center', 'event_venue', 'boat_rental_agency', 'bicycle_rental', 'ski_resort', 'golf_course']);

export interface QualifyDecision {
  status: 'qualified' | 'excluded';
  reason: string | null;
}

/** The rules that need no network: status, own website, exclusion list, review count, kind of place. */
export function qualifyOffline(b: Pick<Business, 'name' | 'website' | 'domain' | 'google_business_status' | 'google_review_count' | 'seed' | 'source' | 'lat' | 'lng'>): QualifyDecision | null {
  if (b.google_business_status && b.google_business_status !== 'OPERATIONAL') return { status: 'excluded', reason: `closed (${b.google_business_status.toLowerCase()})` };
  if (!b.website) return { status: 'excluded', reason: 'no_website' };
  let host: string;
  try {
    host = new URL(b.website).hostname;
  } catch {
    return { status: 'excluded', reason: 'no_website' };
  }
  if (NOT_OWN_SITE.test(host)) return { status: 'excluded', reason: 'no_own_website (platform or social page only)' };
  const group = exclusionFor(b.name, b.domain);
  if (group) return { status: 'excluded', reason: `large_group (${group})` };
  if ((b.google_review_count ?? 0) >= config.qualify.manualCheckAboveReviews) return { status: 'excluded', reason: 'manual_check (3,000 or more Google reviews)' };
  if (b.source === 'discovered') {
    const types = ((JSON.parse(b.seed || '{}') as { types?: string[] }).types ?? []) as string[];
    if (types.length && !types.some((t) => ACTIVITY.has(t)) && types.some((t) => NOT_ACTIVITY.has(t))) return { status: 'excluded', reason: `not_an_activity_operator (${types.filter((t) => NOT_ACTIVITY.has(t)).slice(0, 2).join(', ')})` };
    // The address leaves the country out when the search is made for NZ, so the map position decides.
    if (b.lat !== null && b.lng !== null && b.lat !== undefined && b.lng !== undefined) {
      const inNz = b.lat <= -34 && b.lat >= -47.6 && ((b.lng >= 166 && b.lng <= 179) || b.lng <= -175.5);
      if (!inNz) return { status: 'excluded', reason: 'outside_new_zealand' };
    }
  }
  return null;
}

export interface QualifyResult {
  qualified: number;
  excluded: Record<string, number>;
}

/** Decides every candidate. The last rule loads the site once, politely. */
export async function qualify(db: Db, polite: Polite, log: (l: string) => void = console.log): Promise<QualifyResult> {
  const candidates = db.prepare("SELECT * FROM businesses WHERE status = 'candidate'").all() as Business[];
  const result: QualifyResult = { qualified: 0, excluded: {} };
  const set = db.prepare('UPDATE businesses SET status = ?, exclude_reason = ? WHERE id = ?');
  const apply = (b: Business, d: QualifyDecision) => {
    set.run(d.status, d.reason, b.id);
    if (d.status === 'qualified') result.qualified += 1;
    else {
      const key = (d.reason ?? '').split(' (')[0]!;
      result.excluded[key] = (result.excluded[key] ?? 0) + 1;
    }
  };
  const online: Business[] = [];
  for (const b of candidates) {
    const d = qualifyOffline(b);
    if (d) apply(b, d);
    else online.push(b);
  }
  // Two businesses that turn out to share a name and town are one business listed twice.
  const seen = new Map<string, number>();
  const limit = pLimit(8);
  let n = 0;
  await Promise.all(
    online.map((b) =>
      limit(async () => {
        const url = b.website!;
        let decision: QualifyDecision = { status: 'qualified', reason: null };
        if (!(await polite.robots.allows(url))) decision = { status: 'excluded', reason: 'robots_blocked (robots.txt disallows the homepage)' };
        else {
          let res = await rawFetch(polite.limiter, url, { timeoutMs: 25_000, maxBytes: 200_000 });
          if (res.status === null) res = await rawFetch(polite.limiter, url, { timeoutMs: 25_000, maxBytes: 200_000 });
          // A refusal still shows a site is there. Only a dead address, a missing page or a server error fails.
          if (res.status === null) decision = { status: 'excluded', reason: `site_does_not_load (${res.error ?? 'no response'})` };
          else if (res.status === 404 || res.status === 410 || res.status >= 500) decision = { status: 'excluded', reason: `site_does_not_load (HTTP ${res.status})` };
          else {
            const finalHost = new URL(res.finalUrl).hostname;
            if (NOT_OWN_SITE.test(finalHost)) decision = { status: 'excluded', reason: 'no_own_website (redirects to a platform or social page)' };
            else if (/domain (is )?for sale|buy this domain|this domain (has expired|is parked)|parked free|sedoparking|hugedomains/i.test(res.body.slice(0, 20_000))) decision = { status: 'excluded', reason: 'site_does_not_load (parked domain)' };
          }
        }
        if (decision.status === 'qualified') {
          const key = `${foldName(b.name)}|${foldName(b.town ?? '')}`;
          if (seen.has(key)) decision = { status: 'excluded', reason: 'duplicate (same name and town as another business)' };
          else seen.set(key, b.id);
        }
        apply(b, decision);
        if (++n % 25 === 0) log(`  checked ${n} of ${online.length} sites`);
      }),
    ),
  );
  return result;
}
