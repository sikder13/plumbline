import type { Command } from 'commander';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { auditCsv, auditVerified, bookDirectPaths, captureContacts, discover, gatherAll, qualifyAll, Registry, seedRegistryFromRelay01, sweepDiscover, type ListId } from '@plumbline/leads';

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
    .option('--cap <n>', 'Places calls allowed in this run, every list together (a sweep defaults to 2000)')
    .action(async (opts: { campaign: string; list?: string; sweep?: string; reaudit?: boolean; cap?: string }) => {
      if (opts.campaign !== 'book-direct') throw new Error('discover is for --campaign book-direct');
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
    .option('--stage <stage>', 'gather (network reads only), check (browser and checks), report (outputs only), or all', 'all')
    .option('--parallel <n>', 'sites read at once (each host still gets one request a second)', '24')
    .option('--browsers <n>', 'pages open in the browser at once', '8')
    .option('--only <domains>', 'comma separated domains')
    .option('--refresh', 'read the sites again instead of using the saved reads')
    .action(async (opts: { campaign: string; sweep: string; stage: string; parallel: string; browsers: string; only?: string; refresh?: boolean }) => {
      if (opts.campaign !== 'book-direct') throw new Error('sweep is for --campaign book-direct');
      const only = opts.only?.split(',').map((s) => s.trim().toLowerCase().replace(/^www\./, ''));
      if (opts.stage === 'gather' || opts.stage === 'all') {
        const started = Date.now();
        const g = await gatherAll(opts.sweep, { parallel: Number(opts.parallel), only, refresh: opts.refresh, log: console.log });
        console.log(`gathered ${g.length} sites in ${Math.round((Date.now() - started) / 1000)} s`);
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
