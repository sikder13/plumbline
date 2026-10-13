import { existsSync } from 'node:fs';
import type { Db } from '@plumbline/core';
import { decide, refreshTop3 } from '@plumbline/checks/review';
import type { ApprovalFinding, Decision } from './approve.ts';

/** The suppression list: slugs and email addresses that must not be built for or written to. */
export function readSuppression(text: string): Set<string> {
  return new Set(
    text
      .split(/[\r\n,;]+/)
      // A list saved from a spreadsheet has its cells in quotes.
      .map((x) => x.trim().replace(/^"(.*)"$/, '$1').trim().toLowerCase())
      .filter((x) => x && !/^(slug|email|address|reason)$/.test(x)),
  );
}

export function isSuppressed(list: Set<string>, slug: string, emails: string[]): boolean {
  return list.has(slug.toLowerCase()) || emails.some((e) => list.has(e.trim().toLowerCase()));
}

/** A decision made by the rules is marked so. A rejection without the mark was made by a person and stands. */
export const BY_RULE = 'By rule: ';

interface Row {
  id: number;
  check_id: string;
  source: string;
  status: string;
  reproduced: number;
  tier: string;
  severity: number;
  score: number;
  title: string;
  detail: string;
  last_verified_at: string | null;
  note: string | null;
}

export interface PersonDecision {
  findingId: number;
  checkId: string;
  title: string;
  note: string;
}

/**
 * A business's findings as the rules should see them. What a person rejected is left out and
 * reported apart. An earlier approval, or a rejection the rules themselves made, is put up for
 * deciding again from the facts.
 */
export function findingsToDecide(db: Db, businessId: number, batch: string, exists: (path: string) => boolean = existsSync): { findings: ApprovalFinding[]; byPerson: PersonDecision[] } {
  const rows = db
    .prepare('SELECT f.id, f.check_id, f.source, f.status, f.reproduced, f.tier, f.severity, f.score, f.title, f.detail, f.last_verified_at, (SELECT note FROM reviews r WHERE r.finding_id = f.id ORDER BY r.id DESC LIMIT 1) AS note FROM findings f WHERE f.business_id = ? AND f.batch = ? ORDER BY f.id')
    .all(businessId, batch) as Row[];
  const evidence = db.prepare('SELECT kind, path, excerpt FROM evidence WHERE finding_id = ? ORDER BY id');
  const byPerson: PersonDecision[] = [];
  const findings: ApprovalFinding[] = [];
  for (const r of rows) {
    if (r.status === 'rejected' && !(r.note ?? '').startsWith(BY_RULE)) {
      byPerson.push({ findingId: r.id, checkId: r.check_id, title: r.title, note: r.note ?? 'rejected in review' });
      continue;
    }
    const decided = r.status === 'approved' || r.status === 'rejected';
    findings.push({
      id: r.id,
      checkId: r.check_id,
      source: r.source,
      status: decided ? (r.reproduced ? 'reproduced' : 'candidate') : r.status,
      tier: r.tier,
      severity: r.severity,
      score: r.score,
      title: r.title,
      detail: JSON.parse(r.detail || '{}') as Record<string, unknown>,
      lastVerifiedAt: r.last_verified_at,
      evidence: (evidence.all(r.id) as { kind: string; path: string | null; excerpt: string | null }[]).map((e) => ({ ...e, path: e.path && exists(e.path) ? e.path : null })),
    });
  }
  return { findings, byPerson };
}

export type Verdicts = Record<string, { verdict: 'ok' | 'flag'; reason: string }>;

/**
 * Stores what the rules decided. A rejection is stored at once. An approval is stored only when
 * the independent check has passed the finding, and waits otherwise. An approval the rules gave
 * earlier is taken back when the pass behind it no longer stands, as when the finding now reads
 * differently. A finding that has gone from the site, or never reproduced, keeps its own status.
 */
export function storeDecisions(db: Db, decisions: Decision[], verdicts: Verdicts): { approved: number; rejected: number; waiting: number } {
  const out = { approved: 0, rejected: 0, waiting: 0 };
  const status = db.prepare('SELECT status, business_id, batch FROM findings WHERE id = ?');
  const lastNote = db.prepare('SELECT note FROM reviews WHERE finding_id = ? ORDER BY id DESC LIMIT 1');
  for (const d of decisions) {
    const row = status.get(d.findingId) as { status: string; business_id: number; batch: string } | undefined;
    const current = row?.status;
    if (!row || !current) continue;
    const passed = verdicts[String(d.findingId)]?.verdict === 'ok';
    if (d.decision === 'reject') {
      if (current === 'reproduced' || current === 'approved') {
        decide(db, d.findingId, 'reject', `${BY_RULE}${d.rule}. ${d.reason}`);
        out.rejected += 1;
      }
    } else if (current === 'approved') {
      // What a person approved stands. What the rules approved stands only for the sentence that was passed.
      const byRule = ((lastNote.get(d.findingId) as { note: string | null } | undefined)?.note ?? '').startsWith(BY_RULE);
      if (!passed && byRule) {
        db.prepare("UPDATE findings SET status = 'reproduced' WHERE id = ?").run(d.findingId);
        refreshTop3(db, row.business_id, row.batch);
        out.waiting += 1;
      }
    } else {
      if (passed) {
        if (current === 'rejected') db.prepare("UPDATE findings SET status = 'reproduced' WHERE id = ? AND reproduced = 1").run(d.findingId);
        decide(db, d.findingId, 'approve', `${BY_RULE}${d.rule}. ${d.reason}. Passed the independent check.`);
        out.approved += 1;
      } else out.waiting += 1;
    }
  }
  return out;
}
