import type { Business, Db } from '@plumbline/core';

export type WaveStatus = 'wave' | 'reserve' | 'dropped';

export interface WaveEntry {
  slug: string;
  /** The row number in the list the wave was chosen from. */
  position: number;
  status: WaveStatus;
  note?: string | null;
}

/** Stores a wave as the list gives it, replacing what was stored before. Slugs not in the database are reported and left out. */
export function importWave(db: Db, wave: string, entries: WaveEntry[]): { stored: number; unknown: string[] } {
  const find = db.prepare('SELECT id FROM businesses WHERE slug = ?');
  const insert = db.prepare('INSERT INTO waves (wave, business_id, position, status, note) VALUES (?, ?, ?, ?, ?)');
  const unknown: string[] = [];
  let stored = 0;
  db.transaction(() => {
    db.prepare('DELETE FROM waves WHERE wave = ?').run(wave);
    for (const e of entries) {
      const b = find.get(e.slug) as { id: number } | undefined;
      if (!b) {
        unknown.push(e.slug);
        continue;
      }
      insert.run(wave, b.id, e.position, e.status, e.note ?? null);
      stored += 1;
    }
  })();
  return { stored, unknown };
}

export interface WaveMember extends Business {
  position: number;
  wave_status: WaveStatus;
  wave_note: string | null;
}

/** The businesses of a wave in list order. Reserves and dropped rows are left out unless asked for. */
export function waveMembers(db: Db, wave: string, statuses: WaveStatus[] = ['wave']): WaveMember[] {
  const rows = db.prepare('SELECT b.*, w.position, w.status AS wave_status, w.note AS wave_note FROM waves w JOIN businesses b ON b.id = w.business_id WHERE w.wave = ? ORDER BY w.position').all(wave) as WaveMember[];
  return rows.filter((r) => statuses.includes(r.wave_status));
}

export function waves(db: Db): string[] {
  return (db.prepare('SELECT DISTINCT wave FROM waves ORDER BY wave').all() as { wave: string }[]).map((r) => r.wave);
}

/** Records a decision on one row: dropped with its reason, or a reserve brought in. The row stays in the list either way. */
export function setWaveStatus(db: Db, wave: string, slug: string, status: WaveStatus, note: string | null): void {
  const r = db.prepare('UPDATE waves SET status = ?, note = ? WHERE wave = ? AND business_id = (SELECT id FROM businesses WHERE slug = ?)').run(status, note, wave, slug);
  if (!r.changes) throw new Error(`${slug} is not in ${wave}`);
}
