import { existsSync } from 'node:fs';
import { db, nzTime } from '@plumbline/core';
import { CHECKS } from '@plumbline/checks/ids';
import { readEntries, type ImpactEntry } from '@plumbline/impact';

export { nzTime };

export function batches(): string[] {
  return (db().prepare('SELECT batch, MAX(id) AS last FROM runs GROUP BY batch ORDER BY last DESC').all() as { batch: string }[]).map((r) => r.batch);
}

export function currentBatch(requested?: string): string | null {
  const all = batches();
  return requested && all.includes(requested) ? requested : (all[0] ?? null);
}

export interface BusinessRow {
  id: number;
  slug: string;
  name: string;
  town: string | null;
  region: string | null;
  status: string;
  runA: string | null;
  runB: string | null;
  candidate: number;
  reproduced: number;
  approved: number;
  rejected: number;
  top: { check_id: string; status: string; score: number }[];
}

export function businessRows(batch: string): BusinessRow[] {
  const rows = db()
    .prepare(
      `SELECT b.id, b.slug, b.name, b.town, b.region, b.status,
        (SELECT MAX(finished_at) FROM runs r WHERE r.business_id = b.id AND r.batch = m.batch AND r.kind = 'A' AND r.status IN ('done', 'blocked')) AS runA,
        (SELECT MAX(finished_at) FROM runs r WHERE r.business_id = b.id AND r.batch = m.batch AND r.kind = 'B' AND r.status IN ('done', 'blocked')) AS runB,
        (SELECT COUNT(*) FROM findings f WHERE f.business_id = b.id AND f.batch = m.batch AND f.status = 'candidate') AS candidate,
        (SELECT COUNT(*) FROM findings f WHERE f.business_id = b.id AND f.batch = m.batch AND f.status = 'reproduced') AS reproduced,
        (SELECT COUNT(*) FROM findings f WHERE f.business_id = b.id AND f.batch = m.batch AND f.status = 'approved') AS approved,
        (SELECT COUNT(*) FROM findings f WHERE f.business_id = b.id AND f.batch = m.batch AND f.status = 'rejected') AS rejected
       FROM businesses b JOIN batch_members m ON m.business_id = b.id WHERE m.batch = ? ORDER BY reproduced DESC, b.name`,
    )
    .all(batch) as Omit<BusinessRow, 'top'>[];
  const top = db().prepare("SELECT check_id, status, score FROM findings WHERE business_id = ? AND batch = ? AND status IN ('reproduced', 'approved') ORDER BY (status = 'approved') DESC, score DESC, id LIMIT 3");
  return rows.map((r) => ({ ...r, top: top.all(r.id, batch) as BusinessRow['top'] }));
}

export interface Evidence {
  id: number;
  kind: string;
  url: string | null;
  viewport: string | null;
  excerpt: string | null;
  path: string | null;
  captured_at_utc: string;
  captured_at_nz: string;
}

export interface Finding {
  id: number;
  check_id: string;
  title: string;
  tier: string;
  severity: number;
  status: string;
  reproduced: number;
  score: number;
  page_url: string | null;
  viewport: string | null;
  top3: number;
  last_verified_at: string | null;
  note: string | null;
  evidence: Evidence[];
  entry: ImpactEntry | null;
  checkTitle: string;
}

export function library(): Map<string, ImpactEntry> {
  return new Map(readEntries().map((e) => [e.check, e]));
}

export function business(slug: string) {
  return db().prepare('SELECT * FROM businesses WHERE slug = ?').get(slug) as { id: number; slug: string; name: string; website: string | null; town: string | null; region: string | null; activity: string | null } | undefined;
}

export function findingsFor(businessId: number, batch: string): Finding[] {
  const lib = library();
  const rows = db().prepare("SELECT f.*, (SELECT note FROM reviews r WHERE r.finding_id = f.id ORDER BY r.id DESC LIMIT 1) AS note FROM findings f WHERE f.business_id = ? AND f.batch = ? ORDER BY (f.status = 'rejected'), (f.status = 'candidate'), f.score DESC, f.id").all(businessId, batch) as Omit<Finding, 'evidence' | 'entry' | 'checkTitle'>[];
  const ev = db().prepare('SELECT id, kind, url, viewport, excerpt, path, captured_at_utc, captured_at_nz FROM evidence WHERE finding_id = ? ORDER BY id');
  return rows.map((r) => ({
    ...r,
    evidence: (ev.all(r.id) as Evidence[]).map((e) => ({ ...e, path: e.path && existsSync(e.path) ? e.path : null })),
    entry: lib.get(r.check_id) ?? null,
    checkTitle: CHECKS.find((c) => c.id === r.check_id)?.title ?? r.check_id,
  }));
}

export function neighbours(batch: string, slug: string): { prev: string | null; next: string | null } {
  const order = businessRows(batch).map((b) => b.slug);
  const i = order.indexOf(slug);
  return { prev: i > 0 ? order[i - 1]! : null, next: i >= 0 && i < order.length - 1 ? order[i + 1]! : null };
}

export interface AnswerRow {
  id: number;
  question_key: string;
  question: string;
  provider: string;
  model: string;
  run_index: number;
  answer: string;
  citations: string;
  asked_at: string;
  mentions: { id: number; name: string; business_id: number | null; matched_by: string; confirmed: number | null }[];
}

export function aiQuestions(batch: string): { question_key: string; question: string; kind: string; businesses: number; answers: number }[] {
  return db()
    .prepare(
      `SELECT l.question_key, MAX(l.kind) AS kind, COUNT(DISTINCT l.business_id) AS businesses,
        (SELECT question FROM ai_answers a WHERE a.question_key = l.question_key LIMIT 1) AS question,
        (SELECT COUNT(*) FROM ai_answers a WHERE a.question_key = l.question_key) AS answers
       FROM ai_question_links l WHERE l.batch = ? GROUP BY l.question_key HAVING answers > 0 ORDER BY (kind = 'brand'), l.question_key`,
    )
    .all(batch) as { question_key: string; question: string; kind: string; businesses: number; answers: number }[];
}

export function aiAnswers(key: string): AnswerRow[] {
  const rows = db().prepare('SELECT id, question_key, question, provider, model, run_index, answer, citations, asked_at FROM ai_answers WHERE question_key = ? ORDER BY provider, run_index').all(key) as Omit<AnswerRow, 'mentions'>[];
  const m = db().prepare('SELECT id, name, business_id, matched_by, confirmed FROM ai_mentions WHERE answer_id = ? ORDER BY (business_id IS NULL), name');
  return rows.map((r) => ({ ...r, mentions: m.all(r.id) as AnswerRow['mentions'] }));
}

export interface ContactRow {
  id: number;
  business_id: number;
  slug: string;
  business: string;
  role: string;
  name: string | null;
  name_confirmed: number;
  title: string | null;
  email: string | null;
  email_source_url: string | null;
  phone: string | null;
  contact_form_url: string | null;
  linkedin_url: string | null;
  source_url: string | null;
  source_quote: string | null;
}

export function contactRows(batch: string | null): ContactRow[] {
  const sql = `SELECT c.*, b.slug, b.name AS business FROM contacts c JOIN businesses b ON b.id = c.business_id ${batch ? 'JOIN batch_members m ON m.business_id = b.id AND m.batch = ?' : ''}
     ORDER BY b.name, CASE c.role WHEN 'owner' THEN 0 WHEN 'second' THEN 1 ELSE 2 END, c.id`;
  return (batch ? db().prepare(sql).all(batch) : db().prepare(sql).all()) as ContactRow[];
}
