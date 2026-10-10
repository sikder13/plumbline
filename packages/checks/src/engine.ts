import { bothTimes, config, minutesBetween, paths, utcIso, type CandidateFinding, type Db, type EvidenceSpec, type Tier } from '@plumbline/core';
import type { SiteData } from '@plumbline/collect';
import { cropElement, pageShot } from '@plumbline/evidence';
import type { ImpactEntry } from '@plumbline/impact';
import type { PageCapture } from '@plumbline/render';
import { join } from 'node:path';
import { CHECKS } from './ids.ts';
import { checkById, checksFor } from './registry.ts';
import type { AiSummary } from './types.ts';

export function scoreOf(severity: number, where: CandidateFinding['where'], tier: Tier): number {
  return Math.round(severity * config.score.visibility[where] * config.score.tier[tier] * 100) / 100;
}

export interface Evaluation {
  findings: CandidateFinding[];
  errors: string[];
}

/** Runs every check that applies to this site. A check that throws is reported and skipped. */
export function evaluateSite(site: SiteData, pack: string, now: Date, ai: AiSummary | null = null): Evaluation {
  const findings: CandidateFinding[] = [];
  const errors: string[] = [];
  const ctx = { site, now, ai };
  for (const check of checksFor(pack)) {
    try {
      if (!check.appliesTo(ctx)) continue;
      findings.push(...check.evaluate(ctx));
    } catch (e) {
      errors.push(`${check.id}: ${(e as Error).message}`);
    }
  }
  return { findings, errors };
}

function captureFor(site: SiteData, spec: EvidenceSpec): PageCapture | null {
  const all = [site.homepage.mobile, site.homepage.desktop, ...site.inner].filter((p): p is PageCapture => !!p && p.ok);
  return (
    all.find((p) => p.finalUrl === spec.url && p.viewport === spec.viewport) ??
    all.find((p) => p.finalUrl === spec.url) ??
    (spec.kind === 'page' ? (all[0] ?? null) : null)
  );
}

/** Writes the evidence for one finding from the captures of one run, replacing what was there. */
export async function writeEvidence(db: Db, findingId: number, runId: number, site: SiteData, specs: EvidenceSpec[], evidenceRoot: string = paths.evidence): Promise<number> {
  db.prepare('DELETE FROM evidence WHERE finding_id = ?').run(findingId);
  const insert = db.prepare(
    'INSERT INTO evidence (finding_id, run_id, kind, url, viewport, selector, bbox, excerpt, path, captured_at_utc, captured_at_nz) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );
  let n = 0;
  for (const [i, spec] of specs.entries()) {
    const capture = captureFor(site, spec);
    const file = join(evidenceRoot, site.business.slug, `${findingId}-${i + 1}.webp`);
    let path: string | null = null;
    try {
      if (capture && spec.kind === 'element' && spec.box) path = (await cropElement(capture, spec.box, file))?.file ?? null;
      else if (capture && spec.kind === 'page') path = (await pageShot(capture, file))?.file ?? null;
    } catch {
      path = null;
    }
    const times = capture ? { utc: capture.capturedAtUtc, nz: capture.capturedAtNz } : bothTimes(new Date(site.finishedAt));
    insert.run(findingId, runId, spec.kind, spec.url ?? null, spec.viewport ?? capture?.viewport ?? null, spec.selector ?? null, spec.box ? JSON.stringify(spec.box) : null, spec.excerpt, path, times.utc, times.nz);
    n += 1;
  }
  return n;
}

interface FindingRow {
  id: number;
  check_id: string;
  fingerprint: string;
  status: string;
  detail: string;
  first_run_id: number | null;
}

export interface RecordResult {
  candidates: number;
  reproduced: number;
  notReproduced: number;
  newInB: number;
  resolved: number;
}

function meta(checkId: string) {
  const m = CHECKS.find((c) => c.id === checkId);
  if (!m) throw new Error(`unknown check ${checkId}`);
  return m;
}

/**
 * Run A: every finding starts as a candidate. Findings from an earlier run A of the same batch
 * are cleared first, unless UD has already ruled on them.
 */
export async function recordRunA(db: Db, library: Map<string, ImpactEntry>, site: SiteData, batch: string, findings: CandidateFinding[], evidenceRoot?: string): Promise<RecordResult> {
  const businessId = site.business.id;
  db.prepare("DELETE FROM findings WHERE business_id = ? AND batch = ? AND status IN ('candidate', 'reproduced')").run(businessId, batch);
  const insert = db.prepare(
    `INSERT INTO findings (business_id, batch, check_id, pack, tier, severity, status, reproduced, fingerprint, title, page_url, viewport, visibility_weight, score, detail, first_run_id, last_run_id, first_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, 'candidate', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (business_id, batch, check_id, fingerprint) DO NOTHING`,
  );
  let n = 0;
  for (const f of findings) {
    const m = meta(f.checkId);
    const severity = library.get(f.checkId)?.severity ?? 1;
    const r = insert.run(businessId, batch, f.checkId, m.pack, m.tier, severity, f.fingerprint, f.title, f.pageUrl, f.viewport, config.score.visibility[f.where], scoreOf(severity, f.where, m.tier), JSON.stringify(f.detail), site.runId, site.runId, site.finishedAt);
    if (r.changes) {
      await writeEvidence(db, Number(r.lastInsertRowid), site.runId, site, f.evidence, evidenceRoot);
      n += 1;
    }
  }
  return { candidates: n, reproduced: 0, notReproduced: 0, newInB: 0, resolved: 0 };
}

/**
 * Run B: a finding is reproduced when the same check fires again with the same fingerprint, at
 * least the minimum gap after run A. Anything that appears only in run B stays a candidate.
 */
export async function recordRunB(db: Db, library: Map<string, ImpactEntry>, site: SiteData, batch: string, findings: CandidateFinding[], runAFinishedAt: string, evidenceRoot?: string): Promise<RecordResult> {
  const gap = minutesBetween(runAFinishedAt, site.startedAt);
  if (gap < config.reproduce.minGapMinutes || new Date(site.startedAt) < new Date(runAFinishedAt)) {
    throw new Error(`run B started ${gap.toFixed(0)} minutes after run A; it must be at least ${config.reproduce.minGapMinutes}`);
  }
  const businessId = site.business.id;
  const existing = db.prepare('SELECT id, check_id, fingerprint, status, detail, first_run_id FROM findings WHERE business_id = ? AND batch = ?').all(businessId, batch) as FindingRow[];
  const byKey = new Map(findings.map((f) => [`${f.checkId}|${f.fingerprint}`, f]));
  const result: RecordResult = { candidates: 0, reproduced: 0, notReproduced: 0, newInB: 0, resolved: 0 };

  for (const row of existing) {
    if (row.status === 'rejected') continue;
    const again = byKey.get(`${row.check_id}|${row.fingerprint}`);
    byKey.delete(`${row.check_id}|${row.fingerprint}`);
    const check = checkById(row.check_id);
    const merged = again ? (check?.merge ? check.merge(JSON.parse(row.detail), again.detail) : again.detail) : null;
    if (!again || !merged) {
      if (row.status === 'candidate') result.notReproduced += 1;
      continue;
    }
    const status = row.status === 'candidate' ? 'reproduced' : row.status;
    db.prepare('UPDATE findings SET status = ?, reproduced = 1, detail = ?, title = ?, last_run_id = ?, last_verified_at = ? WHERE id = ?').run(status, JSON.stringify(merged), again.title, site.runId, site.finishedAt, row.id);
    await writeEvidence(db, row.id, site.runId, site, again.evidence, evidenceRoot);
    result.reproduced += 1;
  }

  const insert = db.prepare(
    `INSERT INTO findings (business_id, batch, check_id, pack, tier, severity, status, reproduced, fingerprint, title, page_url, viewport, visibility_weight, score, detail, first_run_id, last_run_id, first_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, 'candidate', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (business_id, batch, check_id, fingerprint) DO NOTHING`,
  );
  for (const f of byKey.values()) {
    const m = meta(f.checkId);
    const severity = library.get(f.checkId)?.severity ?? 1;
    const r = insert.run(businessId, batch, f.checkId, m.pack, m.tier, severity, f.fingerprint, f.title, f.pageUrl, f.viewport, config.score.visibility[f.where], scoreOf(severity, f.where, m.tier), JSON.stringify(f.detail), site.runId, site.runId, site.finishedAt);
    if (r.changes) {
      await writeEvidence(db, Number(r.lastInsertRowid), site.runId, site, f.evidence, evidenceRoot);
      result.newInB += 1;
    }
  }
  return result;
}

/**
 * Re-verification on the day of sending. A reproduced or approved finding that still fires gets a
 * fresh verification time and fresh evidence. One that no longer fires is marked resolved.
 */
export async function recordRecheck(db: Db, site: SiteData, batch: string, findings: CandidateFinding[], evidenceRoot?: string): Promise<RecordResult> {
  const existing = db.prepare("SELECT id, check_id, fingerprint, status, detail, first_run_id FROM findings WHERE business_id = ? AND batch = ? AND status IN ('reproduced', 'approved')").all(site.business.id, batch) as FindingRow[];
  const byKey = new Map(findings.map((f) => [`${f.checkId}|${f.fingerprint}`, f]));
  const result: RecordResult = { candidates: 0, reproduced: 0, notReproduced: 0, newInB: 0, resolved: 0 };
  for (const row of existing) {
    // Findings built from AI answers are not re-measured by a site visit.
    if (checkById(row.check_id)?.evidenceSpec === 'ai') continue;
    const again = byKey.get(`${row.check_id}|${row.fingerprint}`);
    const check = checkById(row.check_id);
    const merged = again ? (check?.merge ? check.merge(JSON.parse(row.detail), again.detail) : again.detail) : null;
    if (again && merged) {
      db.prepare('UPDATE findings SET detail = ?, last_run_id = ?, last_verified_at = ? WHERE id = ?').run(JSON.stringify(merged), site.runId, site.finishedAt, row.id);
      await writeEvidence(db, row.id, site.runId, site, again.evidence, evidenceRoot);
      result.reproduced += 1;
    } else {
      db.prepare("UPDATE findings SET status = 'resolved', top3 = 0, last_run_id = ? WHERE id = ?").run(site.runId, row.id);
      result.resolved += 1;
    }
  }
  return result;
}

/** Flags the three highest scoring approved findings for a business. */
export function refreshTop3(db: Db, businessId: number, batch: string): number[] {
  db.prepare('UPDATE findings SET top3 = 0 WHERE business_id = ? AND batch = ?').run(businessId, batch);
  const top = db.prepare("SELECT id FROM findings WHERE business_id = ? AND batch = ? AND status = 'approved' ORDER BY score DESC, severity DESC, id LIMIT 3").all(businessId, batch) as { id: number }[];
  for (const t of top) db.prepare('UPDATE findings SET top3 = 1 WHERE id = ?').run(t.id);
  return top.map((t) => t.id);
}

export function decide(db: Db, findingId: number, decision: 'approve' | 'reject', note: string | null): void {
  const f = db.prepare('SELECT business_id, batch, reproduced, status FROM findings WHERE id = ?').get(findingId) as { business_id: number; batch: string; reproduced: number; status: string } | undefined;
  if (!f) throw new Error(`no finding ${findingId}`);
  if (decision === 'approve' && !f.reproduced) throw new Error('a finding must be reproduced before it can be approved');
  db.prepare('INSERT INTO reviews (finding_id, decision, note, at) VALUES (?, ?, ?, ?)').run(findingId, decision, note, utcIso());
  db.prepare('UPDATE findings SET status = ? WHERE id = ?').run(decision === 'approve' ? 'approved' : 'rejected', findingId);
  refreshTop3(db, f.business_id, f.batch);
}
