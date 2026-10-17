import { utcIso, type Db } from '@plumbline/core';

export interface NewFact {
  label?: string;
  value: unknown;
  /** The page the fact was read on. */
  sourceUrl?: string | null;
  /** The words on that page that state it. */
  quote?: string | null;
  /** Anything a reader must know before using it: a conflict, a doubt, "no longer published". */
  flag?: string | null;
}

export interface Fact {
  id: number;
  businessId: number;
  topic: string;
  label: string;
  value: unknown;
  sourceUrl: string | null;
  quote: string | null;
  flag: string | null;
  checkedOn: string;
}

/** Stores the facts of one topic for a business, replacing the earlier ones, in a single short write. */
export function setFacts(db: Db, businessId: number, topic: string, facts: NewFact[], checkedOn: string = utcIso()): void {
  const insert = db.prepare('INSERT INTO facts (business_id, topic, label, value, source_url, quote, flag, checked_on) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  db.transaction(() => {
    db.prepare('DELETE FROM facts WHERE business_id = ? AND topic = ?').run(businessId, topic);
    for (const f of facts) insert.run(businessId, topic, f.label ?? '', JSON.stringify(f.value), f.sourceUrl ?? null, f.quote ?? null, f.flag ?? null, checkedOn);
  })();
}

export function factsFor(db: Db, businessId: number, topic?: string): Fact[] {
  const rows = (topic
    ? db.prepare('SELECT * FROM facts WHERE business_id = ? AND topic = ? ORDER BY id').all(businessId, topic)
    : db.prepare('SELECT * FROM facts WHERE business_id = ? ORDER BY topic, id').all(businessId)) as { id: number; business_id: number; topic: string; label: string; value: string; source_url: string | null; quote: string | null; flag: string | null; checked_on: string }[];
  return rows.map((r) => ({ id: r.id, businessId: r.business_id, topic: r.topic, label: r.label, value: JSON.parse(r.value) as unknown, sourceUrl: r.source_url, quote: r.quote, flag: r.flag, checkedOn: r.checked_on }));
}

/** The activities written down for a business, main one first. The AI question is built from these when the homepage shows them. */
export function statedActivities(db: Db, businessId: number): string[] {
  return factsFor(db, businessId, 'activity').map((f) => String(f.value)).filter(Boolean);
}
