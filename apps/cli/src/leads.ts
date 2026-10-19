import { join } from 'node:path';
import type { Command } from 'commander';
import { campaignPaths, pullLeads } from '@plumbline/leads';

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
  return leads;
}
