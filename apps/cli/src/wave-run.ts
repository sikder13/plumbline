import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Command } from 'commander';
import pLimit from 'p-limit';
import { paths } from '@plumbline/core';
import {
  buildFactPack,
  factPackLines,
  isSuppressed,
  loadCrawlmouse,
  readSuppression,
  summaryLines,
  waveRows,
  type FactPack,
  type OwnWord,
  type RunMeasured,
  type WaveRow,
} from '@plumbline/wave';
import { parseCsv } from './csv.ts';

export interface WaveRunOptions {
  wave: string;
  batch: string;
  file?: string;
  only?: string;
  parallel: number;
  /** Do not open any site: work from the results already stored. */
  rankOnly?: boolean;
  /** Measure phone speed again and nothing else. */
  speedOnly?: boolean;
  reserves?: boolean;
}

/** inputs/NZ-WAVE-4-LIST.csv for "wave-4", and inputs/crawlmouse-wave4/crawlmouse for its Crawlmouse summaries. */
export function waveFiles(wave: string, file?: string) {
  return {
    list: file ?? join(paths.inputs, `NZ-${wave.toUpperCase()}-LIST.csv`),
    crawlmouse: join(paths.inputs, `crawlmouse-${wave.replace(/-/g, '')}`),
    data: join(paths.data, wave),
  };
}

export function readRows(o: { wave: string; file?: string }): WaveRow[] {
  return waveRows(parseCsv(readFileSync(waveFiles(o.wave, o.file).list, 'utf8')));
}

const WORKER = join(dirname(fileURLToPath(import.meta.url)), 'wave-run-worker.ts');

/** One business in a process of its own, so a crash or a hang touches nobody else. Returns the one line the worker printed. */
function runWorker(o: WaveRunOptions, slug: string): Promise<{ line: string; ok: boolean }> {
  return new Promise((resolve) => {
    const args = ['--import', 'tsx', WORKER, '--wave', o.wave, '--slug', slug, ...(o.file ? ['--file', o.file] : []), ...(o.speedOnly ? ['--speed-only'] : [])];
    const child = spawn(process.execPath, args, { cwd: paths.root, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d: Buffer) => (out += d.toString()));
    child.stderr.on('data', (d: Buffer) => (err += d.toString()));
    const timer = setTimeout(() => child.kill('SIGKILL'), 25 * 60_000);
    child.on('close', (code) => {
      clearTimeout(timer);
      const line = out.trim().split('\n').pop() ?? '';
      if (code === 0 && line) return resolve({ line, ok: true });
      resolve({ line: `${slug}: FAILED (exit ${code}) ${err.trim().split('\n').pop()?.slice(0, 160) ?? ''}`, ok: false });
    });
  });
}

function storedResult(data: string, slug: string): RunMeasured | null {
  const file = join(data, slug, 'result.json');
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as RunMeasured) : null;
}

function storedWords(data: string, slug: string): OwnWord[] {
  const file = join(data, 'assets', slug, 'assets.json');
  return existsSync(file) ? ((JSON.parse(readFileSync(file, 'utf8')) as { words?: OwnWord[] }).words ?? []) : [];
}

/**
 * The whole wave in one command, with no AI: every business is measured in a process of its own,
 * then the findings are filtered and ranked by rule, and a fact pack is written for each.
 */
export async function waveRun(o: WaveRunOptions): Promise<void> {
  const started = Date.now();
  const files = waveFiles(o.wave, o.file);
  const only = o.only ? new Set(o.only.split(',').map((s) => s.trim())) : null;
  const all = readRows(o);
  const rows = all.filter((r) => (!only || only.has(r.slug)) && (o.reserves !== false || r.status === 'wave'));
  const reportDir = join(paths.reports, o.batch, o.wave);
  mkdirSync(reportDir, { recursive: true });
  mkdirSync(files.data, { recursive: true });

  const suppressionFile = join(paths.data, 'suppression.csv');
  const suppressed = existsSync(suppressionFile) ? readSuppression(readFileSync(suppressionFile, 'utf8')) : new Set<string>();
  const blocked = new Map<string, string>();
  for (const r of rows) if (isSuppressed(suppressed, r.slug, [r.email], r.website)) blocked.set(r.slug, 'on the suppression list');

  if (!o.rankOnly) {
    const todo = rows.filter((r) => !blocked.has(r.slug));
    console.log(`${o.wave}: measuring ${todo.length} businesses, ${o.parallel} at a time${blocked.size ? `; ${blocked.size} skipped (suppressed)` : ''}`);
    const limit = pLimit(o.parallel);
    let done = 0;
    await Promise.all(
      todo.map((r) =>
        limit(async () => {
          let res = await runWorker(o, r.slug);
          if (!res.ok) res = await runWorker(o, r.slug);
          console.log(`[${++done}/${todo.length}] ${res.line}`);
        }),
      ),
    );
  }

  const packs: FactPack[] = [];
  for (const r of rows) {
    const m = blocked.has(r.slug) ? null : storedResult(files.data, r.slug);
    const cm = loadCrawlmouse(r.slug, r.website, files.crawlmouse);
    const pack = buildFactPack(r, m, { words: storedWords(files.data, r.slug), blocked: blocked.get(r.slug) ?? null, crawlmouseAiAccess: cm?.ai_crawler_access ?? null });
    packs.push(pack);
    writeFileSync(join(reportDir, `${r.slug}.json`), JSON.stringify(pack, null, 2));
    writeFileSync(join(reportDir, `${r.slug}.md`), `${factPackLines(pack).join('\n')}\n`);
  }
  const summaryFile = join(reportDir, `${o.wave.toUpperCase()}-SUMMARY.md`);
  writeFileSync(summaryFile, `${summaryLines(packs).join('\n')}\n`);

  const count = (k: FactPack['recommendation']) => packs.filter((p) => p.recommendation === k).length;
  console.log(`${packs.length} businesses: ${count('BUILD')} BUILD, ${count('RESERVE')} RESERVE, ${count('BLOCKED')} BLOCKED. Took ${Math.round((Date.now() - started) / 1000)} s. Paid spend $0.00.`);
  for (const p of packs.filter((x) => x.blocked)) console.log(`  blocked ${p.slug}: ${p.blocked}`);
  for (const p of packs.filter((x) => x.flags.facts_changed.length)) console.log(`  facts_changed ${p.slug}: ${p.flags.facts_changed.join('; ').slice(0, 220)}`);
  for (const p of packs.filter((x) => x.flags.faith.length)) console.log(`  faith ${p.slug}: ${p.flags.faith.map((f) => `${f.topic} ${f.url}`).join('; ')}`);
  console.log(`Summary: ${summaryFile}`);
}

export function registerWaveRun(wave: Command): void {
  wave
    .command('run')
    .description('Measure, rank and write the fact packs for a whole wave, with no AI and no paid calls')
    .requiredOption('--wave <name>', 'wave name, for example wave-4 (reads inputs/NZ-WAVE-4-LIST.csv)')
    .option('--batch <name>', 'folder under reports/ for the packs', 'nz-tourism-1')
    .option('--file <path>', 'the wave list, when it is not at the usual place')
    .option('--only <slugs>', 'comma separated slugs')
    .option('--parallel <n>', 'businesses measured at once', (v) => Number(v), 5)
    .option('--rank-only', 'open no site: rank and write the packs from the stored results')
    .option('--speed-only', 'measure phone speed again and nothing else')
    .option('--no-reserves', 'leave the reserve rows out')
    .action((o: { wave: string; batch: string; file?: string; only?: string; parallel: number; rankOnly?: boolean; speedOnly?: boolean; reserves?: boolean }) => waveRun(o));
}
