import { bothTimes, config, minutesBetween, paths, type CandidateFinding, type Db, type EvidenceSpec, type Tier } from '@plumbline/core';
import type { SiteData } from '@plumbline/collect';
import { cropElement, pageShot } from '@plumbline/evidence';
import type { ImpactEntry } from '@plumbline/impact';
import type { PageCapture } from '@plumbline/render';
import { join } from 'node:path';
import { CHECKS } from './ids.ts';
import { checkById, checksFor } from './registry.ts';
import type { AiSummary } from './types.ts';

/**
 * A finding built from AI answers is not re-measured by visiting the site. It counts as reproduced
 * when its answers came in two passes at least 60 minutes apart and both passes agree.
 */
function settleAiFinding(db: Db, findingId: number, f: CandidateFinding, verifiedAt: string): void {
  if (checkById(f.checkId)?.evidenceSpec !== 'ai') return;
  if (f.detail.reproducedAcrossPasses === true) db.prepare("UPDATE findings SET status = CASE status WHEN 'candidate' THEN 'reproduced' ELSE status END, reproduced = 1, last_verified_at = ? WHERE id = ?").run(verifiedAt, findingId);
}

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
      settleAiFinding(db, Number(r.lastInsertRowid), f, site.finishedAt);
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
    if (check?.evidenceSpec === 'ai') {
      // Seeing the same stored answers a second time proves nothing. Only the answers' own spread in time does.
      if (again) {
        db.prepare('UPDATE findings SET detail = ?, title = ?, last_run_id = ? WHERE id = ?').run(JSON.stringify(again.detail), again.title, site.runId, row.id);
        await writeEvidence(db, row.id, site.runId, site, again.evidence, evidenceRoot);
        settleAiFinding(db, row.id, again, site.finishedAt);
        if (again.detail.reproducedAcrossPasses === true) result.reproduced += 1;
      }
      continue;
    }
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
      settleAiFinding(db, Number(r.lastInsertRowid), f, site.finishedAt);
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
      // The title carries measured numbers, so it follows the newest measurement like the evidence does.
      db.prepare('UPDATE findings SET detail = ?, title = ?, last_run_id = ?, last_verified_at = ? WHERE id = ?').run(JSON.stringify(merged), again.title, site.runId, site.finishedAt, row.id);
      await writeEvidence(db, row.id, site.runId, site, again.evidence, evidenceRoot);
      result.reproduced += 1;
    } else {
      db.prepare("UPDATE findings SET status = 'resolved', top3 = 0, last_run_id = ? WHERE id = ?").run(site.runId, row.id);
      result.resolved += 1;
    }
  }
  return result;
}

/**
 * Runs one check over runs that are already stored, without visiting the site again. Used when a
 * check is added after a batch was audited. A finding is reproduced when the check fires on the
 * stored captures of both run A and run B, which were taken at least 60 minutes apart.
 */
export async function applyCheckToStoredRuns(db: Db, library: Map<string, ImpactEntry>, checkId: string, batch: string, a: SiteData | null, b: SiteData | null, evidenceRoot?: string): Promise<{ candidates: number; reproduced: number }> {
  const check = checkById(checkId);
  const first = a ?? b;
  if (!check || !first) return { candidates: 0, reproduced: 0 };
  const fire = (site: SiteData | null) => {
    if (!site) return [];
    const ctx = { site, now: new Date(site.finishedAt), ai: null };
    return check.appliesTo(ctx) ? check.evaluate(ctx) : [];
  };
  const fa = fire(a);
  const fb = fire(b);
  const m = meta(checkId);
  const severity = library.get(checkId)?.severity ?? 1;
  const result = { candidates: 0, reproduced: 0 };
  const insert = db.prepare(
    `INSERT INTO findings (business_id, batch, check_id, pack, tier, severity, status, reproduced, fingerprint, title, page_url, viewport, visibility_weight, score, detail, first_run_id, last_run_id, first_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, 'candidate', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (business_id, batch, check_id, fingerprint) DO NOTHING`,
  );
  const find = db.prepare('SELECT id, status FROM findings WHERE business_id = ? AND batch = ? AND check_id = ? AND fingerprint = ?');
  for (const [site, list] of [[a, fa], [b, fb]] as const) {
    if (!site) continue;
    for (const f of list) {
      const r = insert.run(site.business.id, batch, f.checkId, m.pack, m.tier, severity, f.fingerprint, f.title, f.pageUrl, f.viewport, config.score.visibility[f.where], scoreOf(severity, f.where, m.tier), JSON.stringify(f.detail), site.runId, site.runId, site.finishedAt);
      if (r.changes) {
        await writeEvidence(db, Number(r.lastInsertRowid), site.runId, site, f.evidence, evidenceRoot);
        result.candidates += 1;
      }
    }
  }
  if (a && b && minutesBetween(a.finishedAt, b.startedAt) >= config.reproduce.minGapMinutes) {
    for (const f of fb) {
      const again = fa.find((x) => x.fingerprint === f.fingerprint);
      const row = find.get(b.business.id, batch, checkId, f.fingerprint) as { id: number; status: string } | undefined;
      if (!again || !row || row.status === 'rejected') continue;
      const merged = check.merge ? check.merge(again.detail, f.detail) : f.detail;
      if (!merged) continue;
      db.prepare("UPDATE findings SET status = CASE status WHEN 'candidate' THEN 'reproduced' ELSE status END, reproduced = 1, detail = ?, last_run_id = ?, last_verified_at = ? WHERE id = ?").run(JSON.stringify(merged), b.runId, b.finishedAt, row.id);
      await writeEvidence(db, row.id, b.runId, b, f.evidence, evidenceRoot);
      result.reproduced += 1;
    }
  }
  return result;
}

export { decide, refreshTop3, top3Eligible } from './review.ts';
