import type { Business, Db } from '@plumbline/core';
import { contactReady } from '@plumbline/contacts';

/** How well a discovered business fits: small, well reviewed, clearly an operator. */
export function fit(b: Pick<Business, 'google_rating' | 'google_review_count' | 'seed'>): number {
  const reviews = b.google_review_count ?? 0;
  const rating = b.google_rating ?? 0;
  let s = 0;
  if (reviews >= 20 && reviews <= 800) s += 3;
  else if (reviews > 800 && reviews <= 1500) s += 1.5;
  else if (reviews >= 5 && reviews < 20) s += 1;
  if (rating >= 4.5) s += 2;
  else if (rating >= 4.2) s += 1;
  const types = ((JSON.parse(b.seed || '{}') as { types?: string[] }).types ?? []) as string[];
  if (types.some((t) => ['tour_agency', 'travel_agency', 'tourist_attraction', 'winery', 'fishing_charter', 'boat_tour_agency', 'tour_operator'].includes(t))) s += 1;
  return s;
}

/**
 * Orders businesses for a batch: everything from the supplied research first, then discovered ones,
 * best fit first, taken in turn from each region so the batch covers the country.
 */
export function rank(pool: Business[], size: number): Business[] {
  const seeded = pool.filter((b) => b.source !== 'discovered').slice(0, size);
  const byRegion = new Map<string, Business[]>();
  for (const b of pool.filter((x) => x.source === 'discovered').sort((a, c) => fit(c) - fit(a) || (c.google_review_count ?? 0) - (a.google_review_count ?? 0) || a.id - c.id)) {
    const key = b.region ?? 'unknown';
    byRegion.set(key, [...(byRegion.get(key) ?? []), b]);
  }
  const picked: Business[] = [...seeded];
  const queues = [...byRegion.values()];
  while (picked.length < size && queues.some((q) => q.length)) {
    for (const q of queues) {
      if (picked.length >= size) break;
      const next = q.shift();
      if (next) picked.push(next);
    }
  }
  return picked;
}

/** Fills a batch from the businesses that passed contacts and the consent check. */
export function selectBatch(db: Db, batch: string, size: number, pool?: Business[]): { total: number; seeded: number; discovered: number; regions: number } {
  const ready = pool ?? (db.prepare("SELECT * FROM businesses WHERE status IN ('qualified', 'audited') AND website IS NOT NULL ORDER BY id").all() as Business[]).filter((b) => contactReady(db, b.id));
  const picked = rank(ready, size);
  const ins = db.prepare('INSERT OR IGNORE INTO batch_members (batch, business_id) VALUES (?, ?)');
  db.transaction(() => picked.forEach((b) => ins.run(batch, b.id)))();
  const seeded = picked.filter((b) => b.source !== 'discovered').length;
  return { total: picked.length, seeded, discovered: picked.length - seeded, regions: new Set(picked.map((b) => b.region)).size };
}
