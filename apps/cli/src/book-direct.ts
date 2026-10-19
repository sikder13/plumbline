import type { Command } from 'commander';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { auditCsv, auditVerified, bookDirectPaths, captureContacts, discover, qualifyAll, type ListId } from '@plumbline/leads';

const LISTS = ['A', 'B', 'C', 'D'];

/** Book Direct: the contact-first lead feed (RELAY-BOOKDIRECT-01). */
export function registerBookDirectLeads(leads: Command): void {
  leads
    .command('discover')
    .description('Book Direct Part 1: Google Places in every centre (and holidayparks.co.nz for list A), filtered, all cached; writes data/book-direct/leads/_candidates.csv')
    .requiredOption('--campaign <name>', 'campaign, book-direct')
    .requiredOption('--list <letter>', 'A accommodation, B allied health, C dental, D emergency trades')
    .option('--cap <n>', 'Places calls allowed in this run, every list together', '1500')
    .action(async (opts: { campaign: string; list: string; cap: string }) => {
      if (opts.campaign !== 'book-direct') throw new Error('discover is for --campaign book-direct');
      const list = opts.list.toUpperCase();
      if (!LISTS.includes(list)) throw new Error(`--list must be one of ${LISTS.join(', ')}`);
      const { summary } = await discover(list as ListId, { cap: Number(opts.cap), log: console.log });
      console.log(JSON.stringify(summary, null, 2));
      if (summary.stopped) {
        console.log(`STOPPED: ${summary.stopped}`);
        process.exitCode = 2;
      }
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
    });
}

/** Part 3: `wave run --wave book-direct-1 --audit-only` audits the leads that passed the contact gate. */
export async function bookDirectAudit(o: { only?: string; parallel: number; speed?: boolean }): Promise<void> {
  const started = Date.now();
  const { records } = await auditVerified({ parallel: o.parallel, lighthouseParallel: 4, only: o.only?.split(','), speed: o.speed !== false, log: console.log });
  writeFileSync(join(bookDirectPaths().leads, '_audit.csv'), auditCsv(records));
  console.log(`${records.length} audited in ${Math.round((Date.now() - started) / 1000)} s; ${records.filter((r) => !r.facts.speed.measured).length} without a speed measurement`);
}
