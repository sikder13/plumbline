import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Command } from 'commander';
import pLimit from 'p-limit';
import { db, paths, utcIso, type Db } from '@plumbline/core';
import { aiSummary, indexMentions, openAiAsk, perplexityAsk, plan, runPlan } from '@plumbline/ai';
import { limits, loadPrices, record, spent } from '@plumbline/budget';
import { CHECK_IDS } from '@plumbline/checks';
import { publishedEmails } from '@plumbline/contacts';
import { latestBatch } from '@plumbline/export';
import { loadLibrary } from '@plumbline/impact';
import { Polite } from '@plumbline/fetch';
import { Renderer, type PageCapture } from '@plumbline/render';
import { agencySigns, bookingLinks, factPageUrls, importWave, pageDir, pagePrices, readPage, savedHtml, settleAi, statedActivities, tradingFlags, videosIn, waveDir, waveMembers, type WaveEntry, type WaveMember } from '@plumbline/wave';
import { storedHomepage } from './commands.ts';
import { parseCsv } from './csv.ts';

/** Reads a wave list: one row per business with its order, its status ("wave 2" or "reserve") and its slug. */
export function readWaveList(text: string): WaveEntry[] {
  return parseCsv(text).map((r) => ({ slug: r.slug ?? '', position: Number(r.order), status: /^reserve/i.test(r.status ?? '') ? ('reserve' as const) : ('wave' as const) })).filter((e) => e.slug && Number.isFinite(e.position));
}

export function waveImport(d: Db, o: { name: string; file: string }): void {
  const r = importWave(d, o.name, readWaveList(readFileSync(o.file, 'utf8')));
  const members = waveMembers(d, o.name, ['wave', 'reserve']);
  console.log(`${o.name}: ${members.filter((m) => m.wave_status === 'wave').length} businesses and ${members.filter((m) => m.wave_status === 'reserve').length} reserves stored.`);
  for (const slug of r.unknown) console.log(`  not in the database: ${slug}`);
}

function members(d: Db, wave: string, only?: string, reserves = false): WaveMember[] {
  const wanted = only ? new Set(only.split(',').map((s) => s.trim())) : null;
  return waveMembers(d, wave, reserves || wanted ? ['wave', 'reserve'] : ['wave']).filter((b) => !wanted || wanted.has(b.slug));
}

/** What the reading of one page turned up, kept beside the page so a person can check each item against it. */
function summarise(page: PageCapture) {
  const html = savedHtml(page);
  return {
    url: page.url,
    finalUrl: page.finalUrl,
    status: page.status,
    title: page.meta.title,
    readAt: page.capturedAtUtc,
    words: page.text.split(/\s+/).filter(Boolean).length,
    trading: tradingFlags(page),
    agency: agencySigns(page, html),
    generator: page.meta.generator,
    emails: publishedEmails(page),
    booking: bookingLinks(page),
    prices: pagePrices(page),
    videos: videosIn(html, page.finalUrl),
  };
}

function writeText(slug: string, page: PageCapture): void {
  const dir = pageDir(slug, page.url);
  if (!existsSync(dir)) return;
  writeFileSync(join(dir, 'text.txt'), [`URL: ${page.finalUrl}`, `Read: ${page.capturedAtUtc}`, `Title: ${page.meta.title}`, `Description: ${page.meta.description ?? ''}`, '', page.text].join('\n'));
}

async function readAndKeep(renderer: Renderer, slug: string, url: string, screenshots = false): Promise<PageCapture> {
  const page = await readPage(renderer, slug, url, { screenshots });
  writeText(slug, page);
  return page;
}

/** Reads the homepage and the pages that say who runs the business, how to reach it and what it costs. */
export async function waveCollect(d: Db, o: { name: string; only?: string; pages?: number; reserves?: boolean }): Promise<void> {
  const todo = members(d, o.name, o.only, o.reserves).filter((b) => b.website);
  const polite = new Polite();
  const renderer = new Renderer(polite);
  await renderer.start();
  const limit = pLimit(5);
  await Promise.all(
    todo.map((b) =>
      limit(async () => {
        try {
          const home = await readAndKeep(renderer, b.slug, b.website!);
          if (!home.ok) return void console.log(`${b.slug}: homepage not read (${home.blocked ?? home.error ?? home.status})`);
          const pages = [home];
          for (const url of factPageUrls(home, o.pages ?? 10)) {
            const p = await readAndKeep(renderer, b.slug, url);
            if (p.ok) pages.push(p);
          }
          const collected = { slug: b.slug, website: b.website, readAt: utcIso(), pages: pages.map(summarise) };
          mkdirSync(waveDir(b.slug), { recursive: true });
          writeFileSync(join(waveDir(b.slug), 'collected.json'), JSON.stringify(collected, null, 2));
          const count = (pick: (p: (typeof collected.pages)[number]) => unknown[]) => collected.pages.reduce((n, p) => n + pick(p).length, 0);
          console.log(`${b.slug}: ${pages.length} pages; trading signs ${count((p) => p.trading)}, agency signs ${count((p) => p.agency)}, emails ${count((p) => p.emails)}, booking links ${count((p) => p.booking)}, prices ${count((p) => p.prices)}, videos ${count((p) => p.videos)}`);
        } catch (e) {
          console.log(`${b.slug}: failed, ${(e as Error).message.slice(0, 160)}`);
        }
      }),
    ),
  );
  await renderer.stop();
  console.log(`Pages are kept under ${join(paths.data, 'wave')}.`);
}

/** Reads further pages for one business, such as its page on the company register. */
export async function waveRead(d: Db, o: { business: string; urls: string[]; screenshots?: boolean }): Promise<void> {
  if (!d.prepare('SELECT 1 FROM businesses WHERE slug = ?').get(o.business)) throw new Error(`no business with slug ${o.business}`);
  const renderer = new Renderer(new Polite());
  await renderer.start();
  try {
    for (const url of o.urls) {
      const p = await readAndKeep(renderer, o.business, url, o.screenshots);
      console.log(`${url}: ${p.ok ? `${p.status}, ${p.text.split(/\s+/).filter(Boolean).length} words, kept in ${pageDir(o.business, url)}` : `not read (${p.blocked ?? p.error ?? p.status})`}`);
    }
  } finally {
    await renderer.stop();
  }
}

/**
 * Asks AI tools who to book each business's own activities with, through both providers, three
 * runs each. Pass 1 asks each question once and pass 2, at least an hour later, the other two
 * times, which is what lets a finding built on the answers count as reproduced.
 */
export async function waveAi(d: Db, o: { name: string; batch?: string; only?: string; estimate?: boolean; pass?: number; approvedAboveAsk?: boolean }): Promise<void> {
  const list = members(d, o.name, o.only);
  if (!list.length) throw new Error(`no businesses in ${o.name}`);
  const batch = o.batch ?? latestBatch(d, list[0]!.id);
  if (!batch) throw new Error(`${list[0]!.slug} has not been audited`);
  const pass = o.pass === 1 || o.pass === 2 ? o.pass : undefined;
  const p = plan(d, { homepage: (b) => storedHomepage(d, b.id), stated: (b) => statedActivities(d, b.id), businesses: list, batch, brandQuestions: 0, pass });
  for (const b of list) {
    const questions = p.items.filter((i) => i.businessIds.includes(b.id)).map((i) => i.question.question);
    console.log(`${b.slug}:${questions.length ? '' : ' no question'}`);
    for (const q of questions) console.log(`  ${q}`);
  }
  for (const u of p.unasked) console.log(`not asked, ${u.slug}: ${u.reason}`);
  const calls = { openai: p.toRun.filter((t) => t.provider === 'openai').length, perplexity: p.toRun.filter((t) => t.provider === 'perplexity').length };
  const already = spent(d);
  const lim = limits();
  console.log(`${p.items.length} questions. To ask now: ${calls.openai} OpenAI at about $${p.perCall.openai.toFixed(4)} = $${p.estimateUsd.openai.toFixed(2)}, ${calls.perplexity} Perplexity at about $${p.perCall.perplexity.toFixed(4)} = $${p.estimateUsd.perplexity.toFixed(2)}; ${p.cached} answers already stored.`);
  console.log(`Estimate $${p.totalUsd.toFixed(2)}. Spent so far $${already.toFixed(2)}, after this about $${(already + p.totalUsd).toFixed(2)}. Ask line $${lim.askAbove.toFixed(2)}, hard total $${lim.total.toFixed(2)}.`);
  if (o.estimate) return;
  if (p.toRun.length) {
    if (already + p.totalUsd > lim.total) throw new Error(`Refused: the estimate would pass the hard total of $${lim.total.toFixed(2)}.`);
    if (already + p.totalUsd > lim.askAbove && !o.approvedAboveAsk) throw new Error(`Stopped to ask: the estimate would pass the ask line of $${lim.askAbove.toFixed(2)}.`);
    // The estimate goes into the ledger before the first call. It carries no cost of its own: each call records its own.
    for (const provider of ['openai', 'perplexity'] as const) {
      if (calls[provider]) record(d, { provider, operation: 'ai_estimate', units: { step: `${o.name} activity questions${pass ? `, pass ${pass}` : ''}`, calls: calls[provider], estimate_usd: Number(p.estimateUsd[provider].toFixed(4)) }, estimatedUsd: 0, actualUsd: 0 });
    }
    const prices = loadPrices();
    const r = await runPlan(d, p, { asks: { openai: openAiAsk(prices), perplexity: perplexityAsk(prices) }, approvedAboveAsk: o.approvedAboveAsk });
    console.log(`Asked ${r.asked}, failed ${r.failed}, cost $${r.spentUsd.toFixed(4)}. Spent in total $${spent(d).toFixed(4)}.${r.stopped ? ` Stopped: ${r.stopped.message}` : ''}`);
  }
  console.log(`Indexed ${indexMentions(d, batch, list.map((b) => b.id))} mentions.`);
  if (pass === 1) return void console.log('Pass 1 is stored. Run pass 2 at least 60 minutes from now; the check is settled after it.');
  const library = loadLibrary(CHECK_IDS);
  for (const b of list) {
    const ai = aiSummary(d, b, batch);
    const s = settleAi(d, library, b, batch, ai, utcIso());
    const verdict = s.finding === 'recorded' ? 'finding' : s.strengths ? 'strength' : s.finding === 'dropped' ? 'earlier finding dropped' : 'neither';
    console.log(`${b.slug}: ${ai ? `named in ${ai.namedIn} of ${ai.questions} answers (${ai.asked.map((q) => `${q.namedIn}/${q.answers}`).join(', ')})` : 'no answers'}: ${verdict}`);
  }
}

export function registerWave(program: Command): void {
  const wave = program.command('wave').description('Prepare a hand-picked list of businesses: facts with their sources, findings and the pack');

  wave
    .command('import')
    .description('Store a wave list: order, status and slug for each business')
    .requiredOption('--name <name>', 'wave name')
    .requiredOption('--file <path>', 'the list as a CSV file')
    .action((o: { name: string; file: string }) => waveImport(db(), o));

  wave
    .command('collect')
    .description('Read the pages that say who runs each business, how to reach it and what it costs')
    .requiredOption('--name <name>', 'wave name')
    .option('--only <slugs>', 'comma separated slugs')
    .option('--pages <n>', 'pages per site besides the homepage', (v) => Number(v))
    .option('--reserves', 'read the reserves too')
    .action((o: { name: string; only?: string; pages?: number; reserves?: boolean }) => waveCollect(db(), o));

  wave
    .command('read <urls...>')
    .description('Read further pages for one business and keep them with the rest')
    .requiredOption('--business <slug>', 'business slug')
    .option('--screenshots', 'keep screenshots of each page')
    .action((urls: string[], o: { business: string; screenshots?: boolean }) => waveRead(db(), { ...o, urls }));

  wave
    .command('ai')
    .description("Ask AI tools who to book each business's own activities with. Shows the cost estimate first.")
    .requiredOption('--name <name>', 'wave name')
    .option('--batch <name>', 'batch the findings belong to (the newest one by default)')
    .option('--only <slugs>', 'comma separated slugs')
    .option('--estimate', 'show the questions and the estimate, and stop')
    .option('--pass <n>', '1 asks each question once; 2, at least 60 minutes later, asks the remaining runs', (v) => Number(v))
    .option('--approved-above-ask', 'UD has approved spending between the ask line and the total')
    .action((o: { name: string; batch?: string; only?: string; estimate?: boolean; pass?: number; approvedAboveAsk?: boolean }) => waveAi(db(), o));
}
