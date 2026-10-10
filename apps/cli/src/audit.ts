import pLimit from 'p-limit';
import { minutesBetween, config, utcIso, type Business, type Db } from '@plumbline/core';
import { brandDir, captureBrand, saveBrandPack, voiceSamples, type BrandCapture } from '@plumbline/brand';
import { CHECK_IDS, evaluateSite, recordRecheck, recordRunA, recordRunB, type AiSummary } from '@plumbline/checks';
import { collectSite, collectSpeed, loadSite, type SiteData } from '@plumbline/collect';
import { Polite } from '@plumbline/fetch';
import { loadLibrary } from '@plumbline/impact';
import { Renderer } from '@plumbline/render';

export type RunKind = 'A' | 'B' | 'recheck';

export interface AuditOptions {
  batch: string;
  kind: RunKind;
  /** Restrict to these slugs. */
  only?: string[];
  /** When the batch has no members yet, fill it from businesses with this source or status. */
  source?: string;
  innerPages?: number;
  concurrency?: number;
  speedConcurrency?: number;
  force?: boolean;
  brand?: boolean;
  aiSummary?: (db: Db, business: Business, batch: string) => AiSummary | null;
  log?: (line: string) => void;
}

export interface AuditSummary {
  attempted: number;
  done: number;
  blocked: number;
  failed: number;
  skipped: number;
  notReady: string[];
  findings: number;
  reproduced: number;
  resolved: number;
}

export function batchMembers(db: Db, batch: string): Business[] {
  return db.prepare('SELECT b.* FROM businesses b JOIN batch_members m ON m.business_id = b.id WHERE m.batch = ? ORDER BY b.id').all(batch) as Business[];
}

export function fillBatch(db: Db, batch: string, source?: string): number {
  const rows = (source
    ? db.prepare("SELECT id FROM businesses WHERE source = ? AND website IS NOT NULL AND status != 'excluded'").all(source)
    : db.prepare("SELECT id FROM businesses WHERE status IN ('qualified', 'audited') AND website IS NOT NULL").all()) as { id: number }[];
  const ins = db.prepare('INSERT OR IGNORE INTO batch_members (batch, business_id) VALUES (?, ?)');
  db.transaction(() => rows.forEach((r) => ins.run(batch, r.id)))();
  return rows.length;
}

interface RunRow {
  id: number;
  status: string;
  started_at: string;
  finished_at: string | null;
}

function lastRun(db: Db, businessId: number, batch: string, kind: RunKind): RunRow | undefined {
  return db.prepare("SELECT id, status, started_at, finished_at FROM runs WHERE business_id = ? AND batch = ? AND kind = ? AND status IN ('done', 'blocked') ORDER BY id DESC LIMIT 1").get(businessId, batch, kind) as RunRow | undefined;
}

function saveObservations(db: Db, site: SiteData): void {
  const ins = db.prepare('INSERT INTO observations (run_id, business_id, collector, page_url, viewport, value, at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const page = db.prepare('INSERT INTO pages (run_id, business_id, url, final_url, viewport, role, http_status, title, capture_path, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const id = site.business.id;
  db.transaction(() => {
    for (const [role, p] of [['homepage', site.homepage.mobile], ['homepage', site.homepage.desktop], ...site.inner.map((x) => ['inner', x] as const)] as const) {
      if (!p) continue;
      page.run(site.runId, id, p.url, p.finalUrl, p.viewport, role, p.status, p.meta.title, p.dir, p.capturedAtUtc);
      ins.run(site.runId, id, 'page_summary', p.finalUrl, p.viewport, JSON.stringify({ words: p.text.split(/\s+/).filter(Boolean).length, links: p.links.length, images: p.images.length, consoleErrors: p.consoleErrors.slice(0, 10), failedRequests: p.failedRequests.length, mixedContent: p.mixedContent.slice(0, 10), layout: p.layout }), p.capturedAtUtc);
    }
    const at = site.finishedAt;
    const put = (collector: string, value: unknown) => ins.run(site.runId, id, collector, site.homepageUrl, null, JSON.stringify(value), at);
    put('robots', { ...site.robots, body: site.robots.body.slice(0, 4000) });
    put('lighthouse', site.lighthouse);
    put('axe', site.axe);
    put('technologies', { technologies: site.technologies, eol: site.eol });
    put('booking', site.booking);
    put('structured_data', site.structuredData);
    put('sitemap', site.sitemap);
    put('https', site.https);
    put('links', site.links.map((l) => ({ url: l.url, internal: l.internal, status: l.status, error: l.error })));
    put('listings', site.listings);
    if (site.errors.length) put('errors', site.errors);
  })();
  const up = db.prepare(
    `INSERT INTO listings (business_id, url, platform, status, name, phone, email, prices, rating, review_count, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (business_id, url) DO UPDATE SET status = excluded.status, name = excluded.name, phone = excluded.phone, email = excluded.email, prices = excluded.prices, rating = excluded.rating, review_count = excluded.review_count, fetched_at = excluded.fetched_at`,
  );
  for (const l of site.listings) up.run(id, l.url, l.platform, l.status, l.name, l.phones[0] ?? null, l.emails[0] ?? null, JSON.stringify(l.prices.slice(0, 20)), l.rating, l.reviewCount, site.finishedAt);
}

/** Collects, measures and evaluates every business in a batch for one kind of run. */
export async function auditBatch(db: Db, opts: AuditOptions): Promise<AuditSummary> {
  const log = opts.log ?? ((l: string) => console.log(l));
  const library = loadLibrary(CHECK_IDS);
  if (opts.kind === 'A' && batchMembers(db, opts.batch).length === 0) log(`batch ${opts.batch}: added ${fillBatch(db, opts.batch, opts.source)} businesses`);
  let members = batchMembers(db, opts.batch);
  if (opts.only?.length) members = members.filter((b) => opts.only!.includes(b.slug));
  const summary: AuditSummary = { attempted: 0, done: 0, blocked: 0, failed: 0, skipped: 0, notReady: [], findings: 0, reproduced: 0, resolved: 0 };

  const todo: { business: Business; runA?: RunRow }[] = [];
  for (const b of members) {
    if (!b.website) continue;
    if (!opts.force && opts.kind !== 'recheck' && lastRun(db, b.id, opts.batch, opts.kind)) {
      summary.skipped += 1;
      continue;
    }
    if (opts.kind === 'B') {
      const a = lastRun(db, b.id, opts.batch, 'A');
      if (!a?.finished_at) {
        summary.notReady.push(`${b.slug}: no finished run A`);
        continue;
      }
      const gap = minutesBetween(a.finished_at, new Date());
      if (gap < config.reproduce.minGapMinutes) {
        summary.notReady.push(`${b.slug}: run A finished ${gap.toFixed(0)} minutes ago, needs ${config.reproduce.minGapMinutes}`);
        continue;
      }
      todo.push({ business: b, runA: a });
    } else todo.push({ business: b });
  }
  if (!todo.length) return summary;

  const polite = new Polite();
  const renderer = new Renderer(polite);
  await renderer.start();
  const sites: { business: Business; site: SiteData; runA?: RunRow; brand: Partial<Record<'mobile' | 'desktop', BrandCapture>> }[] = [];
  const limit = pLimit(opts.concurrency ?? 5);
  let n = 0;

  await Promise.all(
    todo.map(({ business, runA }) =>
      limit(async () => {
        summary.attempted += 1;
        // A run that was collected but never recorded, because the process stopped, is picked up again.
        const stale = db.prepare("SELECT id, started_at FROM runs WHERE business_id = ? AND batch = ? AND kind = ? AND status = 'running' ORDER BY id DESC LIMIT 1").get(business.id, opts.batch, opts.kind) as { id: number; started_at: string } | undefined;
        const saved = stale && minutesBetween(stale.started_at, new Date()) < 180 ? loadSite(stale.id) : null;
        if (stale && saved && !opts.force) {
          saved.lighthouse = { mobile: null, desktop: null };
          sites.push({ business, site: saved, runA, brand: {} });
          log(`[${++n}/${todo.length}] resumed ${business.slug} from the pages already collected`);
          return;
        }
        db.prepare("UPDATE runs SET status = 'failed', error = 'interrupted', finished_at = ? WHERE business_id = ? AND batch = ? AND kind = ? AND status = 'running'").run(utcIso(), business.id, opts.batch, opts.kind);
        const runId = Number(db.prepare("INSERT INTO runs (business_id, batch, kind, status, started_at) VALUES (?, ?, ?, 'running', ?)").run(business.id, opts.batch, opts.kind, utcIso()).lastInsertRowid);
        const brand: Partial<Record<'mobile' | 'desktop', BrandCapture>> = {};
        try {
          const site = await collectSite(polite, renderer, business, {
            runId,
            kind: opts.kind,
            innerPages: opts.innerPages,
            listingUrls: opts.kind === 'A' ? (JSON.parse(business.listing_urls || '[]') as string[]) : [],
            onHomepage: opts.brand === false || opts.kind !== 'A' ? undefined : async (page, _cap, viewport) => {
              brand[viewport] = await captureBrand(page, viewport, brandDir(business.slug));
            },
          });
          sites.push({ business, site, runA, brand });
          log(`[${++n}/${todo.length}] collected ${business.slug}${site.blocked ? ` (${site.blocked})` : `: ${site.inner.length + 1} pages, ${site.links.length} links`}`);
        } catch (e) {
          summary.failed += 1;
          db.prepare("UPDATE runs SET status = 'failed', error = ?, finished_at = ? WHERE id = ?").run((e as Error).message.slice(0, 500), utcIso(), runId);
          log(`[${++n}/${todo.length}] FAILED ${business.slug}: ${(e as Error).message.slice(0, 160)}`);
        }
      }),
    ),
  );
  await renderer.stop();

  // Speed is measured with nothing else loading the machine, so the numbers are comparable between runs.
  const speedLimit = pLimit(opts.speedConcurrency ?? 3);
  let m = 0;
  await Promise.all(
    sites.map(({ site, business }) =>
      speedLimit(async () => {
        if (!site.blocked) await collectSpeed(polite, site);
        log(`[${++m}/${sites.length}] speed ${business.slug}: mobile ${site.lighthouse.mobile?.median.performance ?? 'n/a'}, desktop ${site.lighthouse.desktop?.median.performance ?? 'n/a'}`);
      }),
    ),
  );

  for (const { business, site, runA, brand } of sites) {
    try {
      // Listings are fetched once, in run A, and carried into later runs.
      if (opts.kind !== 'A') {
        const a = runA ?? lastRun(db, business.id, opts.batch, 'A');
        site.listings = (a && loadSite(a.id)?.listings) || [];
      }
      saveObservations(db, site);
      const ai = opts.aiSummary?.(db, business, opts.batch) ?? null;
      const { findings, errors } = evaluateSite(site, business.pack, new Date(), ai);
      for (const e of errors) log(`  check error ${business.slug}: ${e}`);
      if (opts.kind === 'A') {
        const r = await recordRunA(db, library, site, opts.batch, findings);
        summary.findings += r.candidates;
        if (opts.brand !== false && (brand.desktop || brand.mobile)) {
          const pages = [site.homepage.desktop, site.homepage.mobile, ...site.inner.filter((p) => /about|story|team|who-we-are/i.test(p.finalUrl))].filter((p): p is NonNullable<typeof p> => !!p && p.ok);
          saveBrandPack(db, business.id, brand.desktop ?? null, brand.mobile ?? null, voiceSamples(pages));
        }
      } else if (opts.kind === 'B') {
        const r = await recordRunB(db, library, site, opts.batch, findings, runA!.finished_at!);
        summary.reproduced += r.reproduced;
        summary.findings += r.newInB;
      } else {
        const r = await recordRecheck(db, site, opts.batch, findings);
        summary.reproduced += r.reproduced;
        summary.resolved += r.resolved;
      }
      db.prepare('UPDATE runs SET status = ?, error = ?, finished_at = ? WHERE id = ?').run(site.blocked ? 'blocked' : 'done', site.blocked ?? (site.errors.join(' | ').slice(0, 500) || null), site.finishedAt, site.runId);
      if (site.blocked) summary.blocked += 1;
      else {
        summary.done += 1;
        db.prepare("UPDATE businesses SET status = 'audited' WHERE id = ? AND status = 'qualified'").run(business.id);
      }
    } catch (e) {
      summary.failed += 1;
      db.prepare("UPDATE runs SET status = 'failed', error = ?, finished_at = ? WHERE id = ?").run((e as Error).message.slice(0, 500), utcIso(), site.runId);
      log(`  FAILED to record ${business.slug}: ${(e as Error).message.slice(0, 200)}`);
    }
  }
  return summary;
}
