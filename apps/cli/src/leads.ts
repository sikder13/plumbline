import { join } from 'node:path';
import type { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { campaignPaths, enrich, pickBatch, pullLeads, writeEnriched, type PoolRow } from '@plumbline/leads';

function readCandidates(campaign: string): PoolRow[] {
  const [head, ...lines] = readFileSync(join(campaignPaths(campaign).leads, '_candidates.csv'), 'utf8').trim().split('\n');
  const cols = head!.split(',');
  return lines.map((line) => {
    const cells: string[] = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (q) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { cells.push(cur); cur = ''; } else cur += ch;
    }
    cells.push(cur);
    const r = Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? '']));
    return { ...r, owner_is_agent: r.owner_is_agent === 'true', keep: r.keep === 'true', name_score: Number(r.name_score) } as unknown as PoolRow;
  });
}

/** Lead lists for a campaign, built from public filings rather than from discovery searches. */
export function registerLeads(program: Command): Command {
  const leads = program.command('leads').description('Lead lists for a campaign from public business filings');
  leads
    .command('pull')
    .description('Read the filings export and write data/<campaign>/leads/_pool.csv and _candidates.csv')
    .requiredOption('--campaign <name>', 'campaign folder under config/ and data/')
    .option('--file <path>', 'the export to read (default: the newest .tsv under data/<campaign>/raw/)')
    .action((opts: { campaign: string; file?: string }) => {
      const file = opts.file ?? join(campaignPaths(opts.campaign).raw, 'inbiz-2026-09.tsv');
      const s = pullLeads(opts.campaign, file);
      console.log(`rows ${s.rows}, domestic Indiana in window ${s.domesticInWindow}, trade hits ${s.tradeHits}, candidates ${s.candidates}`);
      console.log(`by group: ${Object.entries(s.byGroup).map(([g, n]) => `${g} ${n}`).join(', ')}`);
      for (const [why, n] of Object.entries(s.drops).sort((a, b) => b[1] - a[1])) console.log(`  dropped ${n}: ${why}`);
      if (s.candidates < 600 || s.candidates > 2500) process.exitCode = 1;
    });
  leads
    .command('enrich')
    .description('Look up the top candidates on Google Places (cached), bucket them and score bucket A')
    .requiredOption('--campaign <name>', 'campaign folder under config/ and data/')
    .option('--limit <n>', 'how many candidates, from the top', '140')
    .option('--ceiling <n>', 'Places calls allowed today, all kinds together', '300')
    .action(async (opts: { campaign: string; limit: string; ceiling: string }) => {
      const r = await enrich(opts.campaign, readCandidates(opts.campaign), { limit: Number(opts.limit), ceiling: Number(opts.ceiling), log: console.log });
      writeEnriched(opts.campaign, r.rows);
      const count = (b: string) => r.rows.filter((x) => x.bucket === b).length;
      console.log(`enriched ${r.rows.length}, A ${count('A')}, B ${count('B')}, C ${count('C')}, D ${count('D')}, Places calls this run ${r.calls}`);
      if (r.stopped) {
        console.log(`STOPPED: ${r.stopped}`);
        process.exitCode = 2;
      }
    });
  leads
    .command('pick')
    .description('Pick the ten to build and five alternates from _scored.csv, download their Google photos and write the batch folder')
    .requiredOption('--campaign <name>', 'campaign folder under config/ and data/')
    .requiredOption('--batch <name>', 'batch folder, such as batch-01')
    .option('--ceiling <n>', 'Places calls allowed today, all kinds together', '300')
    .action(async (opts: { campaign: string; batch: string; ceiling: string }) => {
      const r = await pickBatch(opts.campaign, opts.batch, { ceiling: Number(opts.ceiling), log: console.log });
      console.log(`picked ${r.picked.length}, alternates ${r.alternates.map((a) => a.slug).join(', ')}, Places calls this run ${r.calls}`);
      if (r.stopped) {
        console.log(`STOPPED: ${r.stopped}`);
        process.exitCode = 2;
      }
    });
  return leads;
}
