import type { Command } from 'commander';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASE_PATH, previewPaths, quietContext, serveSite, type PageData } from '@plumbline/preview';
import { auditCsv, auditVerified, bookDirectPaths, captureContacts, checkAll, competitorPass, discover, gatherAll, qualifyAll, recheckAll, recordScroll, Registry, relay01Sweep, seedRegistryFromRelay01, Shooter, sweepDiscover, withBrowser, writeSweepOutputs, type CheckId, type ListId } from '@plumbline/leads';
import { HostLimiter, Polite } from '@plumbline/fetch';

const LISTS = ['A', 'B', 'C', 'D'];

/** Book Direct: the contact-first lead feed (RELAY-BOOKDIRECT-01). */
export function registerBookDirectLeads(leads: Command): void {
  leads
    .command('discover')
    .description('Book Direct Part 1: Google Places in every centre (and holidayparks.co.nz for list A), filtered, all cached; writes data/book-direct/leads/_candidates.csv')
    .requiredOption('--campaign <name>', 'campaign, book-direct')
    .option('--list <letter>', 'A accommodation, B allied health, C dental, D emergency trades')
    .option('--sweep <name>', 'a ten-industry sweep instead of a list, for example nz-1000; writes data/book-direct/sweep/<name>/_candidates.csv')
    .option('--reaudit', 'sweep only: keep domains already in the registry as candidates')
    .option('--from-relay01 <which>', "sweep only, with --reaudit: build the sweep from relay 01's audited sites instead of Places, 'all' or 'would-flag'")
    .option('--cap <n>', 'Places calls allowed in this run, every list together (a sweep defaults to 2000)')
    .action(async (opts: { campaign: string; list?: string; sweep?: string; reaudit?: boolean; cap?: string; fromRelay01?: string }) => {
      if (opts.campaign !== 'book-direct') throw new Error('discover is for --campaign book-direct');
      if (opts.sweep && opts.fromRelay01) {
        if (!opts.reaudit) throw new Error("relay 01's sites are all in the registry: pass --reaudit to sweep them again");
        const n = relay01Sweep(opts.sweep, { onlyWouldFlag: opts.fromRelay01 === 'would-flag' });
        console.log(`${n} relay 01 sites written to data/book-direct/sweep/${opts.sweep}/_candidates.csv; no Places calls`);
        process.exit(0);
      }
      if (opts.sweep) {
        const registry = new Registry();
        const added = seedRegistryFromRelay01(registry);
        if (added) {
          registry.save();
          console.log(`registry: ${added} relay 01 sites entered as audit version 1`);
        }
        const { summary } = await sweepDiscover(opts.sweep, { cap: opts.cap ? Number(opts.cap) : undefined, reaudit: opts.reaudit, log: console.log });
        console.log(JSON.stringify(summary, null, 2));
        if (summary.stopped) console.log(`STOPPED: ${summary.stopped}`);
        process.exit(summary.stopped ? 2 : 0);
      }
      if (!opts.list) throw new Error('discover needs --list or --sweep');
      const list = opts.list.toUpperCase();
      if (!LISTS.includes(list)) throw new Error(`--list must be one of ${LISTS.join(', ')}`);
      const { summary } = await discover(list as ListId, { cap: Number(opts.cap ?? '1500'), log: console.log });
      console.log(JSON.stringify(summary, null, 2));
      if (summary.stopped) {
        console.log(`STOPPED: ${summary.stopped}`);
        process.exitCode = 2;
      }
    });
  leads
    .command('sweep-check')
    .description('Book Direct sweep (RELAY-BOOKDIRECT-02): read each candidate site (8 pages at most, 1 request a second per host), follow its booking links, run the ten checks with a screenshot for every flag, and write FLAGGED.csv, CLEAN.csv, the registry and the contact sheets')
    .requiredOption('--campaign <name>', 'campaign, book-direct')
    .requiredOption('--sweep <name>', 'the sweep discovered with `leads discover --sweep`, for example nz-1000')
    .option('--stage <stage>', 'gather (network reads only), check (browser and checks), competitors (the competitor check alone), report (outputs only), recheck, or all', 'all')
    .option('--recheck <checks>', 'with --stage recheck: the checks to run again on the stored reads, for example hours_mismatch')
    .option('--parallel <n>', 'sites read at once (each host still gets one request a second)', '24')
    .option('--browsers <n>', 'pages open in the browser at once', '8')
    .option('--only <domains>', 'comma separated domains')
    .option('--refresh', 'read the sites again instead of using the saved reads')
    .option('--no-competitors', 'with --stage check: leave the competitor check for a later run')
    .action(async (opts: { campaign: string; sweep: string; stage: string; parallel: string; browsers: string; only?: string; refresh?: boolean; recheck?: string; competitors?: boolean }) => {
      if (opts.campaign !== 'book-direct') throw new Error('sweep is for --campaign book-direct');
      const only = opts.only?.split(',').map((s) => s.trim().toLowerCase().replace(/^www\./, ''));
      if (opts.stage === 'gather' || opts.stage === 'all') {
        const started = Date.now();
        const g = await gatherAll(opts.sweep, { parallel: Number(opts.parallel), only, refresh: opts.refresh, log: console.log });
        console.log(`gathered ${g.length} sites in ${Math.round((Date.now() - started) / 1000)} s`);
      }
      if (opts.stage === 'check' || opts.stage === 'all') {
        const started = Date.now();
        const c = await checkAll(opts.sweep, { browsers: Number(opts.browsers), only, refresh: opts.refresh, log: console.log });
        console.log(`checked ${c.length} sites in ${Math.round((Date.now() - started) / 1000)} s`);
        if (opts.competitors !== false) {
          const n = await competitorPass(opts.sweep, { log: console.log });
          console.log(`competitor check: ${n} flagged`);
        }
      }
      if (opts.stage === 'competitors') {
        const n = await competitorPass(opts.sweep, { log: console.log });
        console.log(`competitor check: ${n} flagged`);
      }
      if (opts.stage === 'recheck') {
        const n = await recheckAll(opts.sweep, (opts.recheck ?? '').split(',').filter(Boolean) as CheckId[], { browsers: Number(opts.browsers), only, log: console.log });
        console.log(`rechecked ${n} sites`);
      }
      if (opts.stage === 'report' || opts.stage === 'all') {
        const s = await writeSweepOutputs(opts.sweep, { log: console.log });
        console.log(JSON.stringify({ ...s, top20: undefined }, null, 1));
      }
      process.exit(0);
    });
  leads
    .command('review')
    .description('Book Direct pages: serve the built site here, take full-page and first-screen pictures at 390 and 1440, and with --record the 20 second scroll recordings and the two contact sheets')
    .requiredOption('--campaign <name>', 'campaign, book-direct')
    .requiredOption('--batch <name>', 'batch folder, such as book-direct-01')
    .option('--only <slugs>', 'comma separated slugs')
    .option('--record', 'also record the scrolls and write the contact sheets')
    .action(async (opts: { campaign: string; batch: string; only?: string; record?: boolean }) => {
      const staged = join(previewPaths.out, 'staged');
      const wanted = opts.only?.split(',');
      const order = existsSync(join('data', opts.campaign, 'batches', opts.batch, 'BATCH.csv')) ? readFileSync(join('data', opts.campaign, 'batches', opts.batch, 'BATCH.csv'), 'utf8').split('\n').slice(1).map((l) => l.split(',')[1]).filter(Boolean) : [];
      const pages = readdirSync(staged)
        .map((f) => JSON.parse(readFileSync(join(staged, f), 'utf8')) as PageData)
        .filter((p) => p.campaign === opts.campaign && (!wanted || wanted.includes(p.slug)))
        .sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug));
      const out = join(previewPaths.review, opts.campaign, opts.batch.replace(/^book-direct-/, 'batch-'));
      const { server, base } = await serveSite(previewPaths.site, 4322, { quiet: true });
      try {
        await withBrowser(async (b) => {
          for (const p of pages) {
            const url = `${base}${BASE_PATH}/${p.path}/`;
            for (const width of [390, 1440]) {
              const ctx = await quietContext(b, { viewport: { width, height: width === 390 ? 844 : 900 }, deviceScaleFactor: 1, isMobile: width === 390, hasTouch: width === 390 });
              const page = await ctx.newPage();
              await page.goto(url, { waitUntil: 'networkidle' });
              await page.waitForTimeout(2500);
              await page.screenshot({ path: join(out, p.slug, `first-${width}.png`) });
              await page.evaluate(async () => {
                for (let y = 0; y < document.body.scrollHeight; y += 400) {
                  window.scrollTo(0, y);
                  await new Promise((r) => setTimeout(r, 120));
                }
                window.scrollTo(0, 0);
              });
              await page.waitForTimeout(800);
              await page.screenshot({ path: join(out, p.slug, `full-${width}.png`), fullPage: true });
              await page.goto(`${url}#found`, { waitUntil: 'networkidle' });
              await page.waitForTimeout(800);
              await page.screenshot({ path: join(out, p.slug, `found-${width}.png`), fullPage: true });
              await ctx.close();
            }
            if (opts.record) {
              await recordScroll(b, url, 390, join(out, `${p.slug}-390.webm`));
              await recordScroll(b, url, 1440, join(out, `${p.slug}-1440.webm`));
            }
            console.log(`${p.slug}: ${url}`);
          }
        });
        if (opts.record) {
          const sh = new Shooter(new Polite(new HostLimiter(1000)));
          try {
            for (const width of [390, 1440]) {
              const items = pages.map((p, i) => ({ file: join(out, p.slug, `first-${width}.png`), label: [`${i + 1}. ${p.name}`, `${(p.demo as { town?: string }).town ?? ''}`, `${BASE_PATH}/${p.path}/`] }));
              await sh.sheet(items, join(out, `contact-sheet-${width}.jpg`), `Book Direct batch 01: first screens at ${width} px. Built locally, not deployed.`);
            }
          } finally {
            await sh.stop();
          }
        }
      } finally {
        server.close();
      }
      process.exit(0);
    });
  leads
    .command('contacts')
    .description('Book Direct Part 2, the gate: read each candidate site (6 pages at most, 1 request a second per host), take a published email with its page and date, check syntax and MX')
    .requiredOption('--campaign <name>', 'campaign, book-direct')
    .option('--list <letters>', 'comma separated lists, for example A,B (default: every list in _candidates.csv)')
    .option('--parallel <n>', 'sites read at once (each host still gets one request a second)', '16')
    .action(async (opts: { campaign: string; list?: string; parallel: string }) => {
      if (opts.campaign !== 'book-direct') throw new Error('contacts is for --campaign book-direct');
      const { summary } = await captureContacts({ lists: opts.list?.toUpperCase().split(','), parallel: Number(opts.parallel), log: console.log });
      console.log(JSON.stringify(summary, null, 2));
      process.exit(0);
    });
  leads
    .command('qualify')
    .description('Book Direct Part 4: competitor check, single-address checks on the best leads, the "room to sell" rule and score; writes QUALIFIED.csv, REJECTED.csv and the funnel')
    .requiredOption('--campaign <name>', 'campaign, book-direct')
    .option('--zerobounce-max <n>', 'single-address checks to spend at most (default: every credit left)')
    .action(async (opts: { campaign: string; zerobounceMax?: string }) => {
      if (opts.campaign !== 'book-direct') throw new Error('qualify is for --campaign book-direct');
      const s = await qualifyAll({ zeroBounceMax: opts.zerobounceMax ? Number(opts.zerobounceMax) : undefined, log: console.log });
      console.log(JSON.stringify(s, null, 2));
      process.exit(0);
    });
}

/** Part 3: `wave run --wave book-direct-1 --audit-only` audits the leads that passed the contact gate. */
export async function bookDirectAudit(o: { only?: string; parallel: number; speed?: boolean; max?: string; list?: string; refresh?: boolean }): Promise<void> {
  const started = Date.now();
  const { records } = await auditVerified({ parallel: o.parallel, lighthouseParallel: 4, only: o.only?.split(','), lists: o.list?.toUpperCase().split(','), speed: o.speed !== false, max: o.max ? Number(o.max) : undefined, refresh: o.refresh, log: console.log });
  writeFileSync(join(bookDirectPaths().leads, '_audit.csv'), auditCsv(records));
  console.log(`${records.length} audited in ${Math.round((Date.now() - started) / 1000)} s; ${records.filter((r) => !r.facts.speed.measured).length} without a speed measurement`);
}
