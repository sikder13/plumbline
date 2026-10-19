import { join } from 'node:path';
import type { Command } from 'commander';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { db } from '@plumbline/core';
import { BASE_PATH, buildOpenSignPage, checkOpenSignPage, numbersIn, previewPaths, serveSite, type PageData } from '@plumbline/preview';
import { scriptsAfterPaint, VERCEL_JSON } from './preview.ts';
import { registerBookDirectLeads } from './book-direct.ts';
import { campaignPaths, enrich, pickBatch, pickSweepBatch, pullLeads, sweep, writeEnriched, type PoolRow } from '@plumbline/leads';

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
  leads
    .command('sweep')
    .description('Find businesses already on Google with no website: every trade term in every area of a city, filtered, scored, all cached')
    .requiredOption('--campaign <name>', 'campaign folder under config/ and data/')
    .requiredOption('--city <id>', 'a city in config/<campaign>/sweep.yml, such as indianapolis')
    .option('--ceiling <n>', 'Places calls allowed today, every ledger of the campaign together', '1950')
    .option('--details-cap <n>', 'Place Details calls at most', '1200')
    .action(async (opts: { campaign: string; city: string; ceiling: string; detailsCap: string }) => {
      const { summary: s } = await sweep(opts.campaign, { city: opts.city, ceiling: Number(opts.ceiling), detailsCap: Number(opts.detailsCap), log: console.log });
      console.log(JSON.stringify(s, null, 2));
      if (s.stopped) {
        console.log(`STOPPED: ${s.stopped}`);
        process.exitCode = 2;
      }
    });
  leads
    .command('sweep-pick')
    .description('Pick ten and ten alternates from _sweep_scored.csv, download their Google photos and write the batch folder')
    .requiredOption('--campaign <name>', 'campaign folder under config/ and data/')
    .requiredOption('--batch <name>', 'batch folder, such as batch-02')
    .option('--ceiling <n>', 'Places calls allowed today, every ledger of the campaign together', '1950')
    .action(async (opts: { campaign: string; batch: string; ceiling: string }) => {
      const r = await pickSweepBatch(opts.campaign, opts.batch, { ceiling: Number(opts.ceiling), log: console.log });
      console.log(`picked ${r.picked.length}, alternates ${r.alternates.map((a) => a.slug).join(', ')}, Places calls this run ${r.calls}`);
      if (r.stopped) {
        console.log(`STOPPED: ${r.stopped}`);
        process.exitCode = 2;
      }
    });
  leads
    .command('pages')
    .description('Build the page data of a batch from previews/content/<slug>/content.json; with --site, also write the static site')
    .requiredOption('--campaign <name>', 'campaign folder under config/ and data/')
    .requiredOption('--batch <name>', 'batch folder, such as batch-01')
    .option('--only <slugs>', 'comma separated slugs')
    .option('--site', 'run the framework build and write previews/out/site/')
    .action(async (opts: { campaign: string; batch: string; only?: string; site?: boolean }) => {
      // Several batches may be named, comma separated: the site then carries all of their pages.
      const dirs = opts.batch.split(',').map((b) => join(campaignPaths(opts.campaign).batches, b.trim()));
      const wanted = opts.only ? new Set(opts.only.split(',')) : null;
      const inBatches = (withData: boolean) => dirs.flatMap((d) => readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory() && existsSync(withData ? join(previewPaths.data, `${e.name}.json`) : join(previewPaths.content, e.name, 'content.json'))).map((e) => e.name));
      const slugs = inBatches(false).filter((x) => !wanted || wanted.has(x));
      const staged = join(previewPaths.out, 'staged');
      for (const slug of slugs) {
        const data = await buildOpenSignPage(db(), opts.campaign, slug, { replyEmail: 'udaay@nahltech.com' });
        // In development the photographs are served from the app's public folder.
        const link = join(previewPaths.app, 'public', data.path);
        mkdirSync(join(previewPaths.app, 'public'), { recursive: true });
        // A page with no photographs still has a folder, so the link never dangles.
        mkdirSync(join(previewPaths.out, 'assets', data.path), { recursive: true });
        const linked = (() => {
          try {
            return lstatSync(link).isSymbolicLink();
          } catch {
            return false;
          }
        })();
        if (!linked) symlinkSync(join(previewPaths.out, 'assets', data.path), link);
        console.log(`${slug}: ${BASE_PATH}/${data.path}/ ${Object.keys(data.images).length} images`);
      }
      if (!opts.site) return;
      // The site holds the named batches' pages only. A deploy has to be merged with the New Zealand site first.
      const pages = inBatches(true);
      rmSync(staged, { recursive: true, force: true });
      mkdirSync(staged, { recursive: true });
      for (const slug of pages) cpSync(join(previewPaths.data, `${slug}.json`), join(staged, `${slug}.json`));
      const app = previewPaths.app;
      execFileSync(process.execPath, [join(app, 'scripts', 'fonts.mjs')], { cwd: app, stdio: 'inherit' });
      execFileSync(join(app, 'node_modules', '.bin', 'next'), ['build'], { cwd: app, stdio: 'inherit', env: { ...process.env, PREVIEWS_DATA: staged, NEXT_TELEMETRY_DISABLED: '1' } });
      const served = join(previewPaths.site, BASE_PATH);
      rmSync(previewPaths.site, { recursive: true, force: true });
      cpSync(join(app, 'out'), served, { recursive: true, dereference: true });
      for (const f of readdirSync(staged)) {
        const page = JSON.parse(readFileSync(join(staged, f), 'utf8')) as { path: string };
        for (const e of readdirSync(served)) if (/-[a-z0-9]{6}$/.test(e) && !pages.some((p) => e.startsWith(`${p}-`))) rmSync(join(served, e), { recursive: true, force: true });
        cpSync(join(previewPaths.out, 'assets', page.path), join(served, page.path), { recursive: true, filter: (from) => !from.endsWith('.made') });
        const html = join(served, page.path, 'index.html');
        writeFileSync(html, scriptsAfterPaint(readFileSync(html, 'utf8')));
      }
      writeFileSync(join(previewPaths.site, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
      writeFileSync(join(previewPaths.out, 'vercel.json'), JSON.stringify(VERCEL_JSON, null, 2));
      console.log(`Built ${pages.length} page(s) into ${previewPaths.site}. Not deployed.`);
    });
  leads
    .command('check')
    .description('Run the quality gates on the built pages of a batch, served from this machine; the visit report is answered locally')
    .requiredOption('--campaign <name>', 'campaign folder under config/ and data/')
    .requiredOption('--batch <name>', 'batch folder, such as batch-01')
    .option('--only <slugs>', 'comma separated slugs')
    .option('--runs <n>', 'Lighthouse runs per page', '3')
    .action(async (opts: { campaign: string; batch: string; only?: string; runs: string }) => {
      const dirs = opts.batch.split(',').map((b) => join(campaignPaths(opts.campaign).batches, b.trim()));
      const folderOf = (slug: string) => dirs.map((d) => join(d, slug)).find((f) => existsSync(f))!;
      const staged = join(previewPaths.out, 'staged');
      const wanted = opts.only ? new Set(opts.only.split(',')) : null;
      const inBatch = (slug: string) => dirs.some((d) => existsSync(join(d, slug)));
      const pages = readdirSync(staged).map((f) => JSON.parse(readFileSync(join(staged, f), 'utf8')) as PageData).filter((p) => inBatch(p.slug) && (!wanted || wanted.has(p.slug)));
      const offer = readFileSync(join(previewPaths.app, 'lib', 'offer.ts'), 'utf8');
      const { server, base } = await serveSite(previewPaths.site, 4321, { quiet: true });
      const summary: Record<string, unknown>[] = [];
      try {
        for (const page of pages) {
          console.log(`${page.slug}: ${base}${BASE_PATH}/${page.path}/`);
          // Figures the page may show: its own facts, our offer, clock hours and the counts and numbers of its own lists.
          const allowed = new Set([...numbersIn(JSON.stringify(page.demo)).map((n) => n.token), ...numbersIn(offer.slice(offer.indexOf('OPEN_SIGN'))).map((n) => n.token), '30', ...Array.from({ length: 24 }, (_, i) => String(i + 1)), ...Array.from({ length: 20 }, (_, i) => String(i + 1).padStart(2, '0'))]);
          const report = await checkOpenSignPage(page, { base, allowed, shotsDir: join(previewPaths.review, 'open-sign', page.slug), previewDir: folderOf(page.slug), lighthouseRuns: Number(opts.runs), log: console.log });
          mkdirSync(join(previewPaths.review, 'open-sign', page.slug), { recursive: true });
          writeFileSync(join(previewPaths.review, 'open-sign', page.slug, 'gates.json'), JSON.stringify(report, null, 2));
          const l = report.lighthouse;
          console.log(`  performance ${l.performance}, accessibility ${l.accessibility}, LCP ${((l.lcpMs ?? 0) / 1000).toFixed(2)} s, CLS ${l.cls?.toFixed(3)}, TBT ${Math.round(l.tbtMs ?? 0)} ms, beacon ${report.beacon.ok ? 'ok' : 'FAIL'}, ${report.failures.length ? `${report.failures.length} failure(s)` : 'PASS'}`);
          for (const f of report.failures) console.log(`    ${f}`);
          summary.push({ slug: page.slug, lighthouse: { ...l, runs: undefined }, failures: report.failures });
        }
      } finally {
        server.close();
      }
      writeFileSync(join(previewPaths.review, 'open-sign', `gates-${opts.batch.replace(/,/g, '+')}${opts.only ? '-part' : ''}.json`), JSON.stringify(summary, null, 2));
      if (summary.some((x) => (x.failures as string[]).length)) process.exitCode = 1;
    });
  registerBookDirectLeads(leads);
  return leads;
}
