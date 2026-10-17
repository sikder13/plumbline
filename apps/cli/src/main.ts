#!/usr/bin/env -S npx tsx
import { execFileSync, spawn } from 'node:child_process';
import { join } from 'node:path';
import { Command } from 'commander';
import { ROOT, db } from '@plumbline/core';
import { CHECK_IDS } from '@plumbline/checks';
import { loadLibraryRaw, validateLibrary } from '@plumbline/impact';
import { exportIfClear } from './approve.ts';
import { auditBatch, type RunKind } from './audit.ts';
import { calibrate, writeCalibration } from './calibrate.ts';
import { aiCommand, aiSummary, brandCommand, contactsCommand, evaluateStoredCommand, costCommand, discoverCommand, purgeCommand, qualifyCommand } from './commands.ts';
import { writeReport } from '@plumbline/report';
import { registerPreview } from './preview.ts';
import { seed } from './seed.ts';
import { selectBatch } from './select.ts';
import { registerWave } from './wave.ts';

/** Limits of this build that anyone reading a report should know. */
const UNCERTAIN = [
  'Speed (C20) is measured with Lighthouse under simulated phone conditions, several sites at a time on one machine. The scores are comparable between the two runs but should be read as indicative, not as what every visitor sees.',
  'For businesses found through Google Places, the activity is the search phrase that found them. A few are not tour operators at all (a reserve, a car park). They are best rejected in the review app.',
  'In the AI finding (C37), the other names counted come partly from answer text and are candidates until confirmed in the AI tab.',
  'OpenAI answers were limited to one web search each to stay inside the budget.',
  'newzealand.com and Rezdy storefronts refuse automated requests (403). That is recorded as a block and not worked around, so contact and price comparisons against those listings were not made.',
  'A contact form is counted when it is present with an email or message field. It was not submitted, so "working" is not proven.',
  'Inner pages are read at the phone size only, and at most eight per site in this batch.',
];

const program = new Command().name('plumb').description('Audit small business websites and keep only what can be proven.');

program
  .command('seed')
  .description('Import the researched operators from inputs/')
  .action(() => {
    const r = seed(db());
    console.log(`Imported ${r.imported} businesses: ${r.seed20} with a dossier, ${r.withoutWebsite} without a website.`);
  });

function runCommand(name: string, kind: RunKind, description: string) {
  program
    .command(name)
    .description(description)
    .requiredOption('--batch <name>', 'batch name')
    .option('--source <source>', 'when the batch is empty, fill it from this source (seed20, master76, discovered)')
    .option('--only <slugs>', 'comma separated slugs')
    .option('--inner <n>', 'inner pages per site', (v) => Number(v))
    .option('--concurrency <n>', 'sites collected at once', (v) => Number(v))
    .option('--speed <n>', 'sites measured for speed at once', (v) => Number(v))
    .option('--force', 'run again even when this run already exists')
    .action(async (o: { batch: string; source?: string; only?: string; inner?: number; concurrency?: number; speed?: number; force?: boolean }) => {
      const s = await auditBatch(db(), { aiSummary, batch: o.batch, kind, source: o.source, only: o.only?.split(',').map((x) => x.trim()), innerPages: o.inner, concurrency: o.concurrency, speedConcurrency: o.speed, force: o.force });
      console.log(`${name} ${o.batch}: ${s.done} done, ${s.blocked} blocked, ${s.failed} failed, ${s.skipped} already done. New findings ${s.findings}, reproduced ${s.reproduced}, resolved ${s.resolved}.`);
      for (const n of s.notReady) console.log(`  not ready: ${n}`);
    });
}

runCommand('audit', 'A', 'Run A: collect, measure and record candidate findings');
runCommand('confirm', 'B', 'Run B: repeat at least 60 minutes after run A and mark what reproduces');
runCommand('recheck', 'recheck', 'Re-verify reproduced and approved findings on the day of sending');

program
  .command('discover')
  .description('Find businesses with Google Places Text Search')
  .requiredOption('--pack <pack>', 'industry pack', 'tourism')
  .requiredOption('--country <code>', 'country', 'NZ')
  .option('--extra', 'run the extra activities (jet boat, scenic tours, food tours, stargazing, cave tours)')
  .option('--max <n>', 'stop after this many queries', (v) => Number(v))
  .action((o: { extra?: boolean; max?: number }) => discoverCommand(db(), o));

program.command('qualify').description('Decide which candidates qualify').action(() => qualifyCommand(db()));

program
  .command('contacts')
  .description('Find published emails, owners and seconds, and run the consent check')
  .option('--only <slugs>', 'comma separated slugs')
  .option('--concurrency <n>', 'sites read at once', (v) => Number(v))
  .option('--force', 'read again businesses already checked')
  .option('--limit <n>', 'read only the first n in batch order', (v) => Number(v))
  .action((o: { only?: string; concurrency?: number; force?: boolean; limit?: number }) => contactsCommand(db(), o));

program
  .command('brand')
  .description('Capture the brand pack for businesses in a batch that do not have one yet')
  .requiredOption('--batch <name>', 'batch name')
  .option('--force', 'capture again')
  .action((o: { batch: string; force?: boolean }) => brandCommand(db(), o));

program
  .command('ai')
  .description('Ask AI tools the questions a visitor asks. Shows the cost estimate first.')
  .requiredOption('--batch <name>', 'batch name')
  .option('--estimate', 'show the estimate and stop')
  .option('--brand <n>', 'neutral questions about each business (0, 1 or 2)', (v) => Number(v))
  .option('--limit <n>', 'ask only the first n questions', (v) => Number(v))
  .option('--provider <name>', 'openai or perplexity only')
  .option('--pass <n>', '1 asks each question once; 2, at least 60 minutes later, asks the remaining runs', (v) => Number(v))
  .option('--approved-above-ask', 'UD has approved spending between the ask line and the total')
  .action((o: { batch: string; estimate?: boolean; brand?: number; limit?: number; provider?: string; approvedAboveAsk?: boolean; pass?: number }) => aiCommand(db(), o));

program
  .command('batch')
  .description('Choose the businesses for a batch from those ready for audit')
  .requiredOption('--name <name>', 'batch name')
  .option('--size <n>', 'how many businesses', (v) => Number(v), 160)
  .action((o: { name: string; size: number }) => {
    const r = selectBatch(db(), o.name, o.size);
    console.log(`Batch ${o.name}: ${r.total} businesses (${r.seeded} from the supplied research, ${r.discovered} discovered) across ${r.regions} regions.`);
  });

program
  .command('report')
  .description('Write the internal report for a batch')
  .requiredOption('--batch <name>', 'batch name')
  .option('--calibration <name>', 'calibration batch to summarise', 'calib-20')
  .action((o: { batch: string; calibration: string }) => {
    const c = calibrate(db(), o.calibration);
    const t = c.totals;
    const r = writeReport(db(), o.batch, {
      calibration: `On the first 20 (batch \`${o.calibration}\`): ${t.matches} of ${t.verified} verified dossier problems matched, ${t.falseFindings} false findings, ${t.missedExplained} missed with a known reason, ${t.missed - t.missedExplained} missed and not detected, ${t.fresh} new findings for UD to judge. Details are in calibration/REPORT.md.`,
      uncertain: UNCERTAIN,
    });
    console.log(`Report for ${o.batch}: ${r.audited} audited businesses, ${r.excluded} not audited. ${r.dir}/index.html`);
  });

program
  .command('export')
  .description('Write the bundle for one business, if every finding passes the gates')
  .requiredOption('--business <slug>', 'business slug')
  .option('--batch <name>', 'batch name')
  .action((o: { business: string; batch?: string }) => {
    const r = exportIfClear(db(), o.business, { batch: o.batch });
    if (r.ok) return void console.log(`Exported ${r.exported} findings to ${r.dir}`);
    console.error(`Export refused for ${o.business}:`);
    for (const f of r.failures) console.error(`  ${f.check ?? ''} [${f.gate}] ${f.reason}`);
    process.exitCode = 1;
  });

program
  .command('review')
  .description('Start the local review app on 127.0.0.1')
  .option('--port <n>', 'port', '4310')
  .action((o: { port: string }) => {
    const app = join(ROOT, 'apps', 'review');
    console.log(`Review app: http://127.0.0.1:${o.port}  (local only, stop with Ctrl+C)`);
    const child = spawn(join(app, 'node_modules', '.bin', 'next'), ['dev', '-H', '127.0.0.1', '-p', o.port], { cwd: app, stdio: 'inherit', env: { ...process.env, PLUMBLINE_ROOT: ROOT, NEXT_TELEMETRY_DISABLED: '1' } });
    child.on('exit', (code) => process.exit(code ?? 0));
  });

program
  .command('library-commit')
  .description('Commit the verified flags UD set in the review app')
  .action(() => {
    const errors = validateLibrary(loadLibraryRaw(), CHECK_IDS);
    if (errors.length) throw new Error(`impact library is invalid:\n  ${errors.join('\n  ')}`);
    const git = (...args: string[]) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
    if (!git('status', '--porcelain', '--', 'impact/library.yaml').trim()) return void console.log('impact/library.yaml has no changes to commit.');
    // Only verified flags may differ. Any other edit to the library is refused here.
    const changed = git('diff', '-U0', '--', 'impact/library.yaml').split('\n').filter((l) => /^[+-](?![+-])/.test(l));
    const other = changed.filter((l) => !/^[+-]\s+verified_by_ud: (true|false)\s*$/.test(l));
    if (other.length) throw new Error(`impact/library.yaml has changes other than verified flags:\n  ${other.slice(0, 5).join('\n  ')}`);
    git('commit', '-m', 'Mark impact sources verified', '--', 'impact/library.yaml');
    console.log(`Committed ${changed.length / 2} verified flag change(s).`);
  });

program
  .command('evaluate')
  .description('Run one check over the stored runs of a batch, without fetching anything')
  .requiredOption('--batch <name>', 'batch name')
  .requiredOption('--check <id>', 'check id')
  .action((o: { batch: string; check: string }) => evaluateStoredCommand(db(), o));

program.command('cost').description('Show the spending ledger').action(() => costCommand(db()));

program
  .command('purge')
  .description('Delete everything held about one business')
  .requiredOption('--business <slug>', 'business slug')
  .action((o: { business: string }) => purgeCommand(db(), o.business));

program
  .command('calibrate')
  .description('Compare findings for the first 20 with the dossier truth and write calibration/REPORT.md')
  .requiredOption('--batch <name>', 'batch name')
  .action((o: { batch: string }) => {
    const c = writeCalibration(db(), o.batch);
    const t = c.totals;
    console.log(`Calibration ${o.batch}: ${t.matches} of ${t.verified} verified problems matched, ${t.falseFindings} false, ${t.missedExplained} missed with a reason, ${t.missed - t.missedExplained} missed undetected, ${t.fresh} new.`);
    for (const r of c.rows) for (const f of r.falseFindings) console.log(`  FALSE ${r.slug} ${f.check}: ${f.title}`);
  });

registerPreview(program);
registerWave(program);

await program.parseAsync();
