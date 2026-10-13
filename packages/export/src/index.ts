import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { config, nzTime, paths, utcIso, type Business, type Db } from '@plumbline/core';
import { CHECK_IDS } from '@plumbline/checks';
import { usableName } from '@plumbline/contacts';
import { loadLibrary, unverifiedSources, type ImpactEntry } from '@plumbline/impact';
import { businessView, type BusinessView, type FindingView } from '@plumbline/report';

export interface GateFailure {
  findingId: number | null;
  check: string | null;
  gate: 'evidence' | 'reproduced' | 'visible' | 'approved' | 'fresh' | 'sources' | 'nothing_to_export' | 'suppressed';
  reason: string;
}

/** The five gates for one finding, plus the rule that every benchmark source behind it is verified. */
export function gateFailures(f: FindingView, entry: ImpactEntry, now: Date): GateFailure[] {
  const fail = (gate: GateFailure['gate'], reason: string): GateFailure => ({ findingId: f.id, check: f.checkId, gate, reason });
  const out: GateFailure[] = [];

  if (!f.evidence.length) out.push(fail('evidence', 'no evidence is recorded'));
  for (const e of f.evidence) {
    if (!e.excerpt) out.push(fail('evidence', 'an evidence item has no visible text or result'));
    if (!e.captured_at_utc || !e.captured_at_nz) out.push(fail('evidence', 'an evidence item has no UTC and NZ time'));
    if (e.kind !== 'ai' && !e.url) out.push(fail('evidence', 'an evidence item has no URL'));
    if (e.kind === 'element' && (!e.path || !existsSync(e.path))) out.push(fail('evidence', 'the screenshot crop for an element is missing'));
  }
  if (!f.reproduced) out.push(fail('reproduced', 'the finding was not seen in two runs at least 60 minutes apart'));
  // Collection only ever records what the visibility helper passed. An element finding without a viewport was not collected that way.
  if (f.evidence.some((e) => e.kind === 'element' && !e.viewport)) out.push(fail('visible', 'an element finding has no viewport, so visibility cannot be shown'));
  if (f.status !== 'approved') out.push(fail('approved', `the finding is ${f.status}, not approved`));
  if (!f.lastVerifiedAt) out.push(fail('fresh', 'the finding has never been re-verified'));
  else {
    const hours = (now.getTime() - new Date(f.lastVerifiedAt).getTime()) / 3_600_000;
    if (hours > config.fresh.maxAgeHours) out.push(fail('fresh', `last verified ${hours.toFixed(1)} hours ago; the limit is ${config.fresh.maxAgeHours}. Run plumb recheck.`));
  }
  for (const s of unverifiedSources(entry)) out.push(fail('sources', `benchmark source not verified by UD: ${s.publisher} ${s.year} (${s.url})`));
  return out;
}

export interface ExportResult {
  ok: boolean;
  dir: string | null;
  failures: GateFailure[];
  exported: number;
}

export function latestBatch(db: Db, businessId: number): string | null {
  return (db.prepare('SELECT batch FROM runs WHERE business_id = ? ORDER BY id DESC LIMIT 1').get(businessId) as { batch: string } | undefined)?.batch ?? null;
}

/**
 * Writes the bundle a preview page is built from. It refuses, and writes nothing, unless every
 * approved finding passes all five gates and every benchmark source behind it is verified.
 */
export function exportBusiness(db: Db, slug: string, opts: { batch?: string; now?: Date; outRoot?: string } = {}): ExportResult {
  const b = db.prepare('SELECT * FROM businesses WHERE slug = ?').get(slug) as Business | undefined;
  if (!b) throw new Error(`no business with slug ${slug}`);
  const batch = opts.batch ?? latestBatch(db, b.id);
  if (!batch) throw new Error(`${slug} has not been audited`);
  const now = opts.now ?? new Date();
  const library = loadLibrary(CHECK_IDS);
  const view: BusinessView = businessView(db, b, batch, library);
  const approved = view.findings.filter((f) => f.status === 'approved');
  const failures: GateFailure[] = approved.flatMap((f) => gateFailures(f, library.get(f.checkId)!, now));
  if (!approved.length) failures.push({ findingId: null, check: null, gate: 'nothing_to_export', reason: 'no finding has been approved for this business' });
  if (failures.length) {
    db.prepare('INSERT INTO exports (business_id, path, gates, at) VALUES (?, ?, ?, ?)').run(b.id, '', JSON.stringify({ ok: false, failures }), utcIso(now));
    return { ok: false, dir: null, failures, exported: 0 };
  }

  const dir = join(opts.outRoot ?? paths.exports, slug);
  mkdirSync(join(dir, 'evidence'), { recursive: true });
  mkdirSync(join(dir, 'brand'), { recursive: true });
  const copy = (path: string | null, sub: string): string | null => {
    if (!path || !existsSync(path)) return null;
    copyFileSync(path, join(dir, sub, basename(path)));
    return `${sub}/${basename(path)}`;
  };
  const top = approved.slice(0, 3).map((f) => f.id);
  const bundle = {
    exported_at_utc: utcIso(now),
    exported_at_nz: nzTime(now),
    batch,
    business: { slug: b.slug, name: b.name, website: b.website, town: b.town, region: b.region, activity: b.activity, pack: b.pack },
    contacts: {
      owner: view.owner ? { name: usableName(view.owner.name, view.owner.name_confirmed), confirmed: !!view.owner.name_confirmed, source: view.owner.source_url } : null,
      second: view.second ? { name: usableName(view.second.name, view.second.name_confirmed), role: view.second.title, source: view.second.source_url } : null,
      email: view.email,
      email_source_url: view.emailSource,
      phone: view.phone,
    },
    findings: approved.map((f) => ({
      check: f.checkId,
      title: f.title,
      tier: f.tier,
      severity: f.severity,
      score: f.score,
      top3: top.includes(f.id),
      page_url: f.pageUrl,
      last_verified_at: f.lastVerifiedAt,
      impact: f.impact.impact,
      fix: f.impact.fix,
      basis: f.impact.basis,
      sources: f.impact.sources.map((s) => ({ publisher: s.publisher, year: s.year, url: s.url, quote: s.quote })),
      evidence: f.evidence.map((e) => ({ kind: e.kind, url: e.url, viewport: e.viewport, text: e.excerpt, image: copy(e.path, 'evidence'), captured_at_utc: e.captured_at_utc, captured_at_nz: e.captured_at_nz })),
    })),
    brand: view.brand
      ? { logo: copy(view.brand.logo_path, 'brand'), logo_source_url: view.brand.logo_source_url, hero: copy(view.brand.hero_path, 'brand'), colours: JSON.parse(view.brand.colors), fonts: JSON.parse(view.brand.fonts), images: JSON.parse(view.brand.hero_images), voice: JSON.parse(view.brand.voice_samples) }
      : null,
  };
  writeFileSync(join(dir, 'bundle.json'), JSON.stringify(bundle, null, 2));
  db.prepare('INSERT INTO exports (business_id, path, gates, at) VALUES (?, ?, ?, ?)').run(b.id, dir, JSON.stringify({ ok: true, findings: approved.map((f) => f.id) }), utcIso(now));
  return { ok: true, dir, failures: [], exported: approved.length };
}
