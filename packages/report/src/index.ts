import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { nzTime, paths, type Business, type Db } from '@plumbline/core';
import { spendByProvider, spent } from '@plumbline/budget';
import { CHECKS, CHECK_IDS } from '@plumbline/checks';
import { contactReady } from '@plumbline/contacts';
import { loadLibrary } from '@plumbline/impact';
import { MASTER_COLUMNS, businessView, masterRow, type BusinessView } from './data.ts';
import { businessHtml, indexHtml } from './html.ts';
import { topMarkdown } from './top.ts';

export * from './data.ts';
export { businessHtml, esc, indexHtml } from './html.ts';

export function csv(rows: Record<string, unknown>[], columns: string[]): string {
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\n') + '\n';
}

export interface ReportOptions {
  outDir?: string;
  calibration?: string | null;
  uncertain?: string[];
}

export interface ReportResult {
  dir: string;
  audited: number;
  excluded: number;
  stages: Record<string, number>;
}

/** Businesses in the batch with a finished run A, which is what "audited" means in the report. */
export function auditedIn(db: Db, batch: string): Business[] {
  return db
    .prepare("SELECT DISTINCT b.* FROM businesses b JOIN batch_members m ON m.business_id = b.id AND m.batch = ? JOIN runs r ON r.business_id = b.id AND r.batch = m.batch AND r.kind = 'A' AND r.status = 'done' ORDER BY b.id")
    .all(batch) as Business[];
}

export function stageCounts(db: Db, batch: string): Record<string, number> {
  const one = (sql: string, ...args: unknown[]) => (db.prepare(sql).get(...args) as { n: number }).n;
  const qualifiedIds = (db.prepare("SELECT id FROM businesses WHERE status IN ('qualified', 'audited')").all() as { id: number }[]).map((r) => r.id);
  return {
    seeded: one("SELECT COUNT(*) AS n FROM businesses WHERE source IN ('seed20', 'master76')"),
    discovered: one("SELECT COUNT(*) AS n FROM businesses WHERE source = 'discovered'"),
    candidates_in_total: one('SELECT COUNT(*) AS n FROM businesses'),
    qualified: qualifiedIds.length + one("SELECT COUNT(*) AS n FROM businesses WHERE status = 'excluded' AND (exclude_reason LIKE 'no_published_email%' OR exclude_reason = 'no_unsolicited_statement')"),
    checked_for_contacts: one('SELECT COUNT(*) AS n FROM consent_checks'),
    with_contacts: qualifiedIds.filter((id) => contactReady(db, id)).length,
    in_batch: one('SELECT COUNT(*) AS n FROM batch_members WHERE batch = ?', batch),
    audited: auditedIn(db, batch).length,
    confirmed_by_run_b: one("SELECT COUNT(DISTINCT business_id) AS n FROM runs WHERE batch = ? AND kind = 'B' AND status = 'done'", batch),
  };
}

function summaryMd(db: Db, batch: string, views: BusinessView[], stages: Record<string, number>, opts: ReportOptions): string {
  const lines: string[] = [`# ${batch}: summary`, '', `Written ${nzTime()}. Internal document.`, '', '## Counts at each stage', '', '| Stage | Count |', '|---|---|'];
  const label: Record<string, string> = {
    seeded: 'Imported from the supplied research',
    discovered: 'Found through Google Places',
    candidates_in_total: 'Candidates in total',
    qualified: 'Qualified',
    checked_for_contacts: 'Checked for contacts and consent',
    with_contacts: 'With a published email or contact form, and consent check passed',
    in_batch: 'Selected for this batch',
    audited: 'Audited (run A complete)',
    confirmed_by_run_b: 'Confirmed by run B',
  };
  for (const [k, v] of Object.entries(stages)) lines.push(`| ${label[k] ?? k} | ${v} |`);

  const reasons = db.prepare("SELECT COALESCE(exclude_reason, 'unknown') AS reason, COUNT(*) AS n FROM businesses WHERE status = 'excluded' GROUP BY 1").all() as { reason: string; n: number }[];
  const grouped = new Map<string, number>();
  for (const r of reasons) grouped.set(r.reason.split(' (')[0]!, (grouped.get(r.reason.split(' (')[0]!) ?? 0) + r.n);
  lines.push('', '## Why businesses were excluded', '', '| Reason | Count |', '|---|---|');
  for (const [reason, n] of [...grouped.entries()].sort((a, b) => b[1] - a[1])) lines.push(`| ${reason.replace(/_/g, ' ')} | ${n} |`);

  const byCheck = new Map<string, { reproduced: number; candidate: number; approved: number }>();
  for (const v of views) {
    for (const f of v.findings) {
      const e = byCheck.get(f.checkId) ?? { reproduced: 0, candidate: 0, approved: 0 };
      if (f.status === 'approved') e.approved += 1;
      else if (f.status === 'reproduced') e.reproduced += 1;
      else if (f.status === 'candidate') e.candidate += 1;
      byCheck.set(f.checkId, e);
    }
  }
  lines.push('', '## Most common findings', '', `Across ${views.length} audited businesses. Reproduced means seen in two runs at least 60 minutes apart.`, '', '| Check | Reproduced | Approved | Seen in one run only |', '|---|---|---|---|');
  for (const [id, e] of [...byCheck.entries()].sort((a, b) => b[1].reproduced + b[1].approved - (a[1].reproduced + a[1].approved))) {
    lines.push(`| ${id.split('_')[0]} ${CHECKS.find((c) => c.id === id)?.title ?? id} | ${e.reproduced} | ${e.approved} | ${e.candidate} |`);
  }

  lines.push('', '## Calibration', '', opts.calibration ?? 'See calibration/REPORT.md.');

  lines.push('', '## Spend by provider', '', '| Provider | Calls | At list price | Actual |', '|---|---|---|---|');
  for (const r of spendByProvider(db)) lines.push(`| ${r.provider} | ${r.calls} | $${r.estimated.toFixed(2)} | $${r.actual.toFixed(2)} |`);
  lines.push(`| **Total** | | | **$${spent(db).toFixed(2)}** |`);

  const library = loadLibrary(CHECK_IDS);
  const unverified = [...library.values()].filter((e) => e.basis === 'BENCHMARK' && e.sources.some((s) => !s.verified_by_ud));
  lines.push('', '## Anything uncertain', '');
  for (const u of opts.uncertain ?? []) lines.push(`- ${u}`);
  lines.push(`- ${unverified.length} impact library entries have a benchmark source UD has not yet verified: ${unverified.map((e) => e.check.split('_')[0]).join(', ')}. Export refuses these until they are verified.`);
  const noB = views.filter((v) => !v.runB).length;
  if (noB) lines.push(`- ${noB} businesses have run A only, so their findings are unconfirmed candidates.`);
  const noOwner = views.filter((v) => !v.owner).length;
  lines.push(`- ${noOwner} of ${views.length} audited businesses have no owner named on the pages read. No name is marked confirmed, because the companies register lookup was not available.`);
  return lines.join('\n') + '\n';
}

/** Writes the internal report for a batch: master.csv, index.html, one page per business, TOP25.md, excluded.csv and SUMMARY.md. */
export function writeReport(db: Db, batch: string, opts: ReportOptions = {}): ReportResult {
  const dir = opts.outDir ?? join(paths.reports, batch);
  mkdirSync(join(dir, 'businesses'), { recursive: true });
  const library = loadLibrary(CHECK_IDS);
  const views = auditedIn(db, batch).map((b) => businessView(db, b, batch, library)).sort((a, b) => b.outreachScore - a.outreachScore);

  // Images the pages show are copied in, so the report folder stands on its own.
  const fileHref = (slug: string) => (path: string) => {
    if (!existsSync(path)) return null;
    const target = join(dir, 'files', slug);
    mkdirSync(target, { recursive: true });
    copyFileSync(path, join(target, basename(path)));
    return `../files/${slug}/${basename(path)}`;
  };

  writeFileSync(join(dir, 'master.csv'), csv(views.map(masterRow), MASTER_COLUMNS));
  writeFileSync(join(dir, 'index.html'), indexHtml(batch, views, views.some((v) => v.topAreApproved)));
  for (const v of views) writeFileSync(join(dir, 'businesses', `${v.business.slug}.html`), businessHtml(batch, v, fileHref(v.business.slug)));

  writeFileSync(join(dir, 'TOP25.md'), topMarkdown(batch, views, 25));

  const auditedIds = new Set(views.map((v) => v.business.id));
  const others = (db.prepare('SELECT * FROM businesses ORDER BY region, name').all() as Business[]).filter((b) => !auditedIds.has(b.id));
  const excluded = others.map((b) => ({
    slug: b.slug,
    name: b.name,
    town: b.town ?? '',
    region: b.region ?? '',
    activity: b.activity ?? '',
    website: b.website ?? '',
    source: b.source,
    reason:
      b.status === 'excluded'
        ? (b.exclude_reason ?? 'excluded').replace(/_/g, ' ')
        : b.status === 'candidate'
          ? 'not yet checked'
          : db.prepare('SELECT 1 FROM batch_members WHERE batch = ? AND business_id = ?').get(batch, b.id)
            ? 'in the batch but the audit did not complete (site blocked or failed)'
            : contactReady(db, b.id)
              ? 'qualified with contacts, not selected for this batch'
              : 'qualified, held for a later batch (contacts not yet checked)',
    google_rating: b.google_rating ?? '',
    google_review_count: b.google_review_count ?? '',
  }));
  writeFileSync(join(dir, 'excluded.csv'), csv(excluded, ['slug', 'name', 'town', 'region', 'activity', 'website', 'source', 'reason', 'google_rating', 'google_review_count']));

  const stages = stageCounts(db, batch);
  writeFileSync(join(dir, 'SUMMARY.md'), summaryMd(db, batch, views, stages, opts));
  return { dir, audited: views.length, excluded: excluded.length, stages };
}
