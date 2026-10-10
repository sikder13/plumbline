import { utcIso, type Db } from '@plumbline/core';

/** Flags the three highest scoring approved findings for a business. */
export function refreshTop3(db: Db, businessId: number, batch: string): number[] {
  db.prepare('UPDATE findings SET top3 = 0 WHERE business_id = ? AND batch = ?').run(businessId, batch);
  const top = db.prepare("SELECT id FROM findings WHERE business_id = ? AND batch = ? AND status = 'approved' ORDER BY score DESC, severity DESC, id LIMIT 3").all(businessId, batch) as { id: number }[];
  for (const t of top) db.prepare('UPDATE findings SET top3 = 1 WHERE id = ?').run(t.id);
  return top.map((t) => t.id);
}

/** Records UD's decision on a finding. Only a reproduced finding can be approved. */
export function decide(db: Db, findingId: number, decision: 'approve' | 'reject', note: string | null): void {
  const f = db.prepare('SELECT business_id, batch, reproduced, status FROM findings WHERE id = ?').get(findingId) as { business_id: number; batch: string; reproduced: number; status: string } | undefined;
  if (!f) throw new Error(`no finding ${findingId}`);
  if (decision === 'approve' && !f.reproduced) throw new Error('a finding must be reproduced before it can be approved');
  db.prepare('INSERT INTO reviews (finding_id, decision, note, at) VALUES (?, ?, ?, ?)').run(findingId, decision, note, utcIso());
  db.prepare('UPDATE findings SET status = ? WHERE id = ?').run(decision === 'approve' ? 'approved' : 'rejected', findingId);
  refreshTop3(db, f.business_id, f.batch);
}
