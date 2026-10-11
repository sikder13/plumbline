import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { nzTime, paths, type Db } from '@plumbline/core';
import { CHECKS } from '@plumbline/checks';

interface TruthItem {
  check?: string;
  pattern?: string;
  note: string;
  miss_reason?: string;
}

interface Truth {
  businesses: { slug: string; verified: TruthItem[]; false: TruthItem[] }[];
}

interface FindingRow {
  id: number;
  check_id: string;
  title: string;
  status: string;
  detail: string;
  score: number;
  excerpts: string | null;
}

export interface CalibrationRow {
  slug: string;
  stage: 'reproduced' | 'run A only' | 'not audited';
  matches: string[];
  falseFindings: { check: string; title: string; rule: string }[];
  missed: { check: string; note: string; reason: string }[];
  fresh: { check: string; title: string }[];
}

export interface Calibration {
  rows: CalibrationRow[];
  totals: { matches: number; falseFindings: number; missed: number; missedExplained: number; fresh: number; verified: number };
}

export function calibrate(db: Db, batch: string, truthFile: string = join(paths.calibration, 'truth.json')): Calibration {
  const truth = JSON.parse(readFileSync(truthFile, 'utf8')) as Truth;
  const rows: CalibrationRow[] = [];
  for (const t of truth.businesses) {
    const b = db.prepare('SELECT id FROM businesses WHERE slug = ?').get(t.slug) as { id: number } | undefined;
    const hasB = b ? !!db.prepare("SELECT 1 FROM runs WHERE business_id = ? AND batch = ? AND kind = 'B' AND status IN ('done', 'blocked')").get(b.id, batch) : false;
    const hasA = b ? !!db.prepare("SELECT 1 FROM runs WHERE business_id = ? AND batch = ? AND kind = 'A' AND status IN ('done', 'blocked')").get(b.id, batch) : false;
    const findings = (b
      ? db
          .prepare(
            `SELECT f.id, f.check_id, f.title, f.status, f.detail, f.score, (SELECT group_concat(e.excerpt, ' || ') FROM evidence e WHERE e.finding_id = f.id) AS excerpts
             FROM findings f WHERE f.business_id = ? AND f.batch = ? AND f.status IN (${hasB ? "'reproduced', 'approved'" : "'candidate', 'reproduced', 'approved'"}) ORDER BY f.score DESC`,
          )
          .all(b.id, batch)
      : []) as FindingRow[];

    const row: CalibrationRow = { slug: t.slug, stage: hasB ? 'reproduced' : hasA ? 'run A only' : 'not audited', matches: [], falseFindings: [], missed: [], fresh: [] };
    const fired = new Set(findings.map((f) => f.check_id));
    const isFalse = (f: FindingRow) =>
      t.false.find((rule) => {
        if (rule.check && rule.check !== f.check_id) return false;
        if (!rule.pattern) return true;
        return new RegExp(rule.pattern, 'i').test(`${f.title} ${f.detail} ${f.excerpts ?? ''}`);
      });

    for (const f of findings) {
      const rule = isFalse(f);
      if (rule) row.falseFindings.push({ check: f.check_id, title: f.title, rule: rule.note });
    }
    const falseIds = new Set(row.falseFindings.map((x) => `${x.check}|${x.title}`));
    for (const v of t.verified) {
      if (v.check && fired.has(v.check)) row.matches.push(v.check);
      else row.missed.push({ check: v.check ?? '', note: v.note, reason: v.miss_reason ?? 'not detected' });
    }
    const expected = new Set(t.verified.map((v) => v.check));
    for (const f of findings) {
      if (expected.has(f.check_id) || falseIds.has(`${f.check_id}|${f.title}`)) continue;
      row.fresh.push({ check: f.check_id, title: f.title });
    }
    rows.push(row);
  }
  const sum = (f: (r: CalibrationRow) => number) => rows.reduce((s, r) => s + f(r), 0);
  return {
    rows,
    totals: {
      verified: truth.businesses.reduce((s, b) => s + b.verified.length, 0),
      matches: sum((r) => r.matches.length),
      falseFindings: sum((r) => r.falseFindings.length),
      missed: sum((r) => r.missed.length),
      missedExplained: sum((r) => r.missed.filter((m) => m.reason !== 'not detected').length),
      fresh: sum((r) => r.fresh.length),
    },
  };
}

const short = (id: string) => id.split('_')[0]!;
const title = (id: string) => CHECKS.find((c) => c.id === id)?.title ?? id;

export function calibrationReport(c: Calibration, batch: string): string {
  const lines: string[] = [];
  const t = c.totals;
  lines.push('# Calibration on the first 20', '');
  lines.push(`Batch \`${batch}\`, written ${nzTime()}.`, '');
  lines.push('Truth comes from `calibration/truth.json`, built from the 20 dossiers. A match is a verified dossier problem that Plumbline found. A false finding is anything the dossiers mark as false or unverified. A new finding is something Plumbline found that the dossiers do not list, for UD to judge.', '');
  lines.push('## Totals', '');
  lines.push('| Measure | Count |', '|---|---|');
  lines.push(`| Verified problems that map to a check | ${t.verified} |`);
  lines.push(`| Matches | ${t.matches} |`);
  lines.push(`| False findings (must be zero) | ${t.falseFindings} |`);
  lines.push(`| Missed, with a known reason | ${t.missedExplained} |`);
  lines.push(`| Missed, not detected | ${t.missed - t.missedExplained} |`);
  lines.push(`| New findings for UD to judge | ${t.fresh} |`, '');
  lines.push('## By business', '');
  lines.push('| Business | Stage | Matches | False | Missed | New |', '|---|---|---|---|---|---|');
  for (const r of c.rows) {
    lines.push(`| ${r.slug} | ${r.stage} | ${r.matches.map(short).join(', ') || '0'} | ${r.falseFindings.length} | ${r.missed.map((m) => short(m.check)).join(', ') || '0'} | ${r.fresh.map((f) => short(f.check)).join(', ') || '0'} |`);
  }
  lines.push('');
  if (t.falseFindings) {
    lines.push('## False findings', '');
    for (const r of c.rows) for (const f of r.falseFindings) lines.push(`- **${r.slug}** ${f.check}: ${f.title}. Dossier: ${f.rule}`);
    lines.push('');
  }
  lines.push('## Missed findings and why', '');
  for (const r of c.rows) for (const m of r.missed) lines.push(`- **${r.slug}** ${m.check} (${m.note}) Reason: ${m.reason}`);
  lines.push('', '## New findings for UD to judge', '');
  for (const r of c.rows) {
    if (!r.fresh.length) continue;
    lines.push(`**${r.slug}**`);
    for (const f of r.fresh) lines.push(`- ${f.check} (${title(f.check)}): ${f.title}`);
    lines.push('');
  }
  return lines.join('\n') + '\n';
}

export function writeCalibration(db: Db, batch: string): Calibration {
  const c = calibrate(db, batch);
  writeFileSync(join(paths.calibration, 'REPORT.md'), calibrationReport(c, batch));
  return c;
}
