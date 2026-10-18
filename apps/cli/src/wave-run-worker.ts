import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { env } from '@plumbline/core';
import { loadCrawlmouse, measureBusiness, psiRunner, remeasureSpeed } from '@plumbline/wave';
import { readRows, waveFiles } from './wave-run.ts';

/**
 * One business of a wave, measured in this process. The parent starts one of these for each
 * business and reads the single line printed last. Everything else goes to the business's run.log.
 */
async function main(): Promise<void> {
  const arg = (name: string) => {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 ? process.argv[i + 1] : undefined;
  };
  const wave = arg('wave')!;
  const slug = arg('slug')!;
  const files = waveFiles(wave, arg('file'));
  const row = readRows({ wave, file: arg('file') }).find((r) => r.slug === slug);
  if (!row) throw new Error(`${slug} is not in the list`);
  mkdirSync(join(files.data, slug), { recursive: true });
  const logFile = join(files.data, slug, 'run.log');
  const log = (line: string) => appendFileSync(logFile, `${new Date().toISOString()} ${line}\n`);
  const key = env().PAGESPEED_API_KEY;
  const psi = psiRunner(key || undefined);

  if (process.argv.includes('--speed-only')) {
    const s = await remeasureSpeed(row, files.data, psi);
    console.log(`${slug}: speed ${s ? `${s.status}${s.performance !== null ? ` ${s.performance}` : ''}` : 'no stored result'}`);
    return;
  }

  const summary = loadCrawlmouse(slug, row.website, files.crawlmouse);
  const m = await measureBusiness(row, { dataRoot: files.data, crawlmouse: summary, psi, log });
  const held = m.crawlmouse.filter((c) => c.confirmed).length;
  console.log(
    `${slug}: ${m.collection.blocked ? `BLOCKED ${m.collection.blocked}` : `${m.collection.pagesRead} pages`}; facts ${m.facts.changed.length ? `CHANGED ${m.facts.changed.length}` : 'hold'}; speed ${m.speed.status}${m.speed.performance !== null ? ` ${m.speed.performance}` : ''}; booking ${m.booking?.path ?? 'n/a'}; crawlmouse ${held}/${m.crawlmouse.length}${m.faith.length ? `; FAITH ${m.faith.length}` : ''}`,
  );
}

main().catch((e: Error) => {
  console.error(e.stack ?? e.message);
  process.exit(1);
});
