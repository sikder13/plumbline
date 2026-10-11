import { describe, expect, it } from 'vitest';
import { memoryDb, type Business } from '@plumbline/core';
import { spent } from '@plumbline/budget';
import { FIELD_MASK, NZ_REGIONS, TOURISM_ACTIVITIES, discover, qualifyOffline, searchBody, townFrom, upsertPlaces, type Place } from './index.ts';

const place = (id: string, name: string, patch: Partial<Place> = {}): Place => ({ id, displayName: { text: name }, formattedAddress: '1 Wharf Road, Paihia 0200, New Zealand', location: { latitude: -35.28, longitude: 174.09 }, websiteUri: `https://www.${id}.co.nz/`, rating: 4.8, userRatingCount: 120, nationalPhoneNumber: '09 402 0000', types: ['tourist_attraction'], businessStatus: 'OPERATIONAL', ...patch });

describe('Places requests', () => {
  it('covers 20 regions and 8 activities, 160 queries', () => {
    expect(NZ_REGIONS).toHaveLength(20);
    expect(TOURISM_ACTIVITIES).toHaveLength(8);
    expect(NZ_REGIONS.every((r) => r.radiusKm <= 50)).toBe(true);
  });

  it('asks only for the agreed fields and never for review text', () => {
    expect(FIELD_MASK.split(',')).toEqual(['places.id', 'places.displayName', 'places.formattedAddress', 'places.location', 'places.websiteUri', 'places.rating', 'places.userRatingCount', 'places.nationalPhoneNumber', 'places.types', 'places.businessStatus']);
    expect(FIELD_MASK).not.toMatch(/review(s|Summary)\b/);
  });

  it('builds an English query with region bias and at most 20 results', () => {
    const body = searchBody(NZ_REGIONS[0]!, 'kayak tours');
    expect(body).toMatchObject({ textQuery: 'kayak tours in Northland, New Zealand', pageSize: 20, languageCode: 'en', regionCode: 'NZ' });
    expect((body.locationBias as { circle: { radius: number } }).circle.radius).toBe(50_000);
  });

  it('reads the town out of an address', () => {
    expect(townFrom('1 Wharf Road, Paihia 0200, New Zealand')).toBe('Paihia');
    expect(townFrom('Marsden Road, Paihia, New Zealand')).toBe('Paihia');
    expect(townFrom('New Zealand')).toBeNull();
  });
});

describe('storing results', () => {
  it('deduplicates by place id and by website domain', () => {
    const db = memoryDb();
    db.prepare("INSERT INTO businesses (slug, name, website, domain, source, created_at) VALUES ('seeded', 'Seeded Kayaks', 'https://seeded.co.nz', 'seeded.co.nz', 'seed20', 'x')").run();
    const r1 = upsertPlaces(db, [place('a', 'Alpha Tours'), place('b', 'Beta Tours'), place('s', 'Seeded Kayaks Ltd', { websiteUri: 'https://www.seeded.co.nz/book' })], NZ_REGIONS[0]!, 'kayak tours');
    expect(r1).toEqual({ added: 2, matchedExisting: 1, duplicates: 0 });
    const r2 = upsertPlaces(db, [place('a', 'Alpha Tours'), place('c', 'Alpha Tours Booking Office', { websiteUri: 'https://a.co.nz/contact' }), place('d', 'Delta')], NZ_REGIONS[1]!, 'boat cruises');
    expect(r2).toEqual({ added: 1, matchedExisting: 0, duplicates: 2 });
    const seeded = db.prepare("SELECT google_place_id, google_rating, source FROM businesses WHERE slug = 'seeded'").get();
    expect(seeded).toEqual({ google_place_id: 's', google_rating: 4.8, source: 'seed20' });
    expect(db.prepare("SELECT COUNT(*) AS n FROM businesses WHERE source = 'discovered'").get()).toEqual({ n: 3 });
  });

  it('gives businesses with the same name different slugs', () => {
    const db = memoryDb();
    upsertPlaces(db, [place('a', 'Kayak Tours'), place('b', 'Kayak Tours', { formattedAddress: '2 Beach Road, Hahei 3591, New Zealand' })], NZ_REGIONS[0]!, 'kayak tours');
    expect(db.prepare('SELECT slug FROM businesses ORDER BY id').all()).toEqual([{ slug: 'kayak-tours' }, { slug: 'kayak-tours-hahei' }]);
  });
});

describe('discover', () => {
  it('asks each region and activity once, records every call in the ledger at $0 inside the free tier, and resumes', async () => {
    const db = memoryDb();
    let calls = 0;
    const search = async () => {
      calls += 1;
      return [place(`p${calls}`, `Operator ${calls}`)];
    };
    const quiet = () => undefined;
    const first = await discover(db, { search, log: quiet, regions: NZ_REGIONS.slice(0, 2), activities: ['kayak tours', 'boat cruises'], maxQueries: 3 });
    expect(first).toMatchObject({ queries: 3, added: 3, stoppedBy: 'max_queries' });
    const second = await discover(db, { search, log: quiet, regions: NZ_REGIONS.slice(0, 2), activities: ['kayak tours', 'boat cruises'] });
    expect(second).toMatchObject({ queries: 1, skipped: 3, stoppedBy: 'done' });
    expect(calls).toBe(4);
    const ledger = db.prepare("SELECT provider, operation, estimated_usd, actual_usd FROM ledger").all();
    expect(ledger).toHaveLength(4);
    expect(ledger[0]).toEqual({ provider: 'google_places', operation: 'text_search', estimated_usd: 0.035, actual_usd: 0 });
    expect(spent(db)).toBe(0);
  });

  it('stops at the total cap', async () => {
    const db = memoryDb();
    const r = await discover(db, { search: async () => [], log: () => undefined, totalCap: 5 });
    expect(r).toMatchObject({ queries: 5, stoppedBy: 'total_cap' });
  });
});

describe('qualification rules that need no network', () => {
  const b = (patch: Partial<Business>): Business => ({ name: 'Fixture Kayaks', website: 'https://fixturekayaks.co.nz/', domain: 'fixturekayaks.co.nz', google_business_status: 'OPERATIONAL', google_review_count: 120, seed: JSON.stringify({ types: ['tourist_attraction'], address: '1 Wharf Road, Paihia 0200' }), source: 'discovered', lat: -35.28, lng: 174.09, ...patch }) as Business;
  const reason = (patch: Partial<Business>) => qualifyOffline(b(patch))?.reason ?? null;

  it('passes an ordinary operator on to the site check', () => {
    expect(qualifyOffline(b({}))).toBeNull();
  });
  it('excludes closed businesses', () => {
    expect(reason({ google_business_status: 'CLOSED_PERMANENTLY' })).toMatch(/^closed/);
  });
  it('excludes businesses with no website or only a social or platform page', () => {
    expect(reason({ website: null })).toBe('no_website');
    expect(reason({ website: 'https://www.facebook.com/fixturekayaks' })).toMatch(/^no_own_website/);
    expect(reason({ website: 'https://fixture.rezdy.com/' })).toMatch(/^no_own_website/);
  });
  it('excludes large groups and their brands', () => {
    expect(reason({ name: 'Shotover Jet' })).toBe('large_group (Ngāi Tahu Tourism)');
    expect(reason({ name: 'RealNZ Milford Sound Cruises' })).toBe('large_group (RealNZ)');
    expect(reason({ name: 'Hobbiton Movie Set Tours' })).toBe('large_group (Hobbiton)');
    expect(reason({ name: 'Queenstown Lake Cruises', domain: 'bungy.co.nz' })).toBe('large_group (AJ Hackett)');
    expect(reason({ name: 'Waitomo Glowworm Caves' })).toBe('large_group (Tourism Holdings)');
    expect(reason({ name: 'Napier isite Visitor Information Centre' })).toBe('large_group (Public bodies and information centres)');
    expect(reason({ name: 'Kauri Walk', domain: 'doc.govt.nz' })).toBe('large_group (Public bodies and information centres)');
    expect(reason({ name: 'Volcanic Hills Winery Tasting Room (at the top of the Skyline Gondola)' })).toBeNull();
    expect(reason({ name: 'Arataki Honey - Visitor Centre' })).toBeNull();
  });
  it('holds back businesses with 3,000 or more reviews for a manual check', () => {
    expect(reason({ google_review_count: 3000 })).toMatch(/^manual_check/);
    expect(reason({ google_review_count: 2999 })).toBeNull();
  });
  it('decides the country by map position, since the address leaves it out', () => {
    expect(reason({ lat: -33.86, lng: 151.2 })).toBe('outside_new_zealand');
    expect(reason({ lat: -46.9, lng: 168.1 })).toBeNull();
    expect(reason({ lat: -43.95, lng: -176.55 })).toBeNull();
  });
  it('excludes places that are not activity operators', () => {
    expect(reason({ seed: JSON.stringify({ types: ['lodging', 'hotel'], address: 'NZ, New Zealand' }) })).toMatch(/^not_an_activity_operator/);
    expect(reason({ seed: JSON.stringify({ types: ['lodging', 'tourist_attraction'], address: 'NZ, New Zealand' }) })).toBeNull();
  });
});
