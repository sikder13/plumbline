import { utcIso, type Db } from '@plumbline/core';

/**
 * Whether a finding may take one of the top three places. Slow mobile speed is so common that it
 * takes a place only when it is severe: a median score under 30, or main content after 6 seconds.
 * Otherwise it stays a listed finding.
 */
export function top3Eligible(checkId: string, detail: Record<string, unknown>): boolean {
  if (checkId !== 'C20_slow_mobile') return true;
  const performance = typeof detail.performance === 'number' ? detail.performance : null;
  const lcpMs = typeof detail.lcpMs === 'number' ? detail.lcpMs : null;
  return (performance !== null && performance < 30) || (lcpMs !== null && lcpMs > 6000);
}

/** Flags the three highest scoring approved findings for a business. */
export function refreshTop3(db: Db, businessId: number, batch: string): number[] {
  db.prepare('UPDATE findings SET top3 = 0 WHERE business_id = ? AND batch = ?').run(businessId, batch);
  const approved = db.prepare("SELECT id, check_id, detail FROM findings WHERE business_id = ? AND batch = ? AND status = 'approved' ORDER BY score DESC, severity DESC, id").all(businessId, batch) as { id: number; check_id: string; detail: string }[];
  const top = approved.filter((f) => top3Eligible(f.check_id, JSON.parse(f.detail) as Record<string, unknown>)).slice(0, 3);
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
