import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Command } from 'commander';
import pLimit from 'p-limit';
import { db, domainOf, paths, utcIso, type Db } from '@plumbline/core';
import { aiSummary, indexMentions, openAiAsk, perplexityAsk, plan, runPlan } from '@plumbline/ai';
import { brandDir, captureBrand, saveBrandPack, voiceSamples, type BrandCapture, type BrandColour, type BrandFonts, type BrandImage } from '@plumbline/brand';
import { limits, loadPrices, record, spent } from '@plumbline/budget';
import { CHECK_IDS } from '@plumbline/checks';
import { publishedEmails } from '@plumbline/contacts';
import { loadLibrary } from '@plumbline/impact';
import { Polite } from '@plumbline/fetch';
import { allPages, loadSite } from '@plumbline/collect';
import { Renderer, type PageCapture } from '@plumbline/render';
import {
  Research,
  agencySigns,
  bookingLinks,
  checkResearch,
  collectPhotos,
  contactSheet,
  factPageUrls,
  fullSize,
  heroCandidates,
  heroEligible,
  imageUrlsIn,
  importWave,
  loadCrawlmouse,
  ownPages,
  pageDir,
  pagePrices,
  readPage,
  savedHtml,
  savedPages,
  setFacts,
  setWaveStatus,
  settleAi,
  statedActivities,
  storeCrawlmouse,
  storeResearch,
  tradingFlags,
  verifyCrawlmouse,
  videoDetails,
  videosIn,
  waveDir,
  waveMembers,
  writePack,
  type FoundImage,
  type FoundVideo,
  type Photo,
  type WaveEntry,
  type WaveMember,
  type WaveStatus,
} from '@plumbline/wave';
import { approveWave } from './approve.ts';
import { storedHomepage } from './commands.ts';
import { parseCsv } from './csv.ts';
import { registerWaveRun } from './wave-run.ts';

/** Reads a wave list: one row per business with its order, its status ("wave 2" or "reserve") and its slug. */
export function readWaveList(text: string): WaveEntry[] {
  const status = (raw: string) => (/^reserve/i.test(raw) ? ('reserve' as const) : /^dropped/i.test(raw) ? ('dropped' as const) : ('wave' as const));
  return parseCsv(text).map((r) => ({ slug: r.slug ?? '', position: Number(r.order), status: status(r.status ?? '') })).filter((e) => e.slug && e.position > 0 && Number.isFinite(e.position));
}

export function waveImport(d: Db, o: { name: string; file: string }): void {
  const r = importWave(d, o.name, readWaveList(readFileSync(o.file, 'utf8')));
  const members = waveMembers(d, o.name, ['wave', 'reserve']);
  console.log(`${o.name}: ${members.filter((m) => m.wave_status === 'wave').length} businesses and ${members.filter((m) => m.wave_status === 'reserve').length} reserves stored.`);
  for (const slug of r.unknown) console.log(`  not in the database: ${slug}`);
}

/**
 * The batch a wave's findings belong to: the one named, or else the newest batch in which every
 * business of the wave has a finished run. Every wave command uses the same one, so the questions,
 * the Crawlmouse findings, the review app and the pack all speak of the same findings.
 */
export function waveBatch(d: Db, list: WaveMember[], named?: string): string {
  if (named) return named;
  const rows = d.prepare(`SELECT batch, MAX(id) AS last, COUNT(DISTINCT business_id) AS n FROM runs WHERE status = 'done' AND business_id IN (${list.map(() => '?').join(',') || 'NULL'}) GROUP BY batch ORDER BY last DESC`).all(...list.map((b) => b.id)) as { batch: string; n: number }[];
  const shared = rows.find((r) => r.n === list.length);
  if (!shared) throw new Error('no batch holds a finished run for every business of the wave. Name one with --batch.');
  return shared.batch;
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
  const batch = waveBatch(d, members(d, o.name), o.batch);
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
    console.log(`${b.slug}: ${ai ? `named in ${ai.asked.map((q) => `${q.namedIn} of ${q.answers}`).join(' and ')} answers` : 'no answers'}: ${verdict}`);
  }
}

/** The business's own pages already held: those read for the wave, and those of its newest audit run. Pages kept from other sites are left out. */
function knownPages(d: Db, b: WaveMember): PageCapture[] {
  const run = d.prepare("SELECT id FROM runs WHERE business_id = ? AND status = 'done' ORDER BY id DESC LIMIT 1").get(b.id) as { id: number } | undefined;
  const site = run ? loadSite(run.id) : null;
  return ownPages([...savedPages(b.slug), ...(site ? allPages(site) : [])], b.website);
}

/** Opens the example pages behind every Crawlmouse sentence again and stores what still holds as findings. */
export async function waveCrawlmouse(d: Db, o: { name: string; batch?: string; only?: string }): Promise<void> {
  const list = members(d, o.name, o.only);
  const batch = waveBatch(d, members(d, o.name), o.batch);
  const renderer = new Renderer(new Polite());
  await renderer.start();
  const limit = pLimit(4);
  try {
    await Promise.all(
      list.map((b) =>
        limit(async () => {
          const summary = loadCrawlmouse(b.slug, b.website);
          if (!summary) return void console.log(`${b.slug}: no Crawlmouse summary`);
          try {
            const results = await verifyCrawlmouse(renderer, b.slug, summary, knownPages(d, b));
            const checkedAt = utcIso();
            mkdirSync(waveDir(b.slug), { recursive: true });
            writeFileSync(join(waveDir(b.slug), 'crawlmouse.json'), JSON.stringify({ checkedAt, summary: { ...summary, findings_plain: undefined }, results }, null, 2));
            const n = storeCrawlmouse(d, b, batch, results, { auditedAt: summary.audited_at, auditId: summary.audit_id, pagesRead: summary.pages_read, coveragePct: summary.coverage_pct, confidence: summary.confidence, checkedAt });
            console.log(`${b.slug}: ${n.stored} of ${results.length} Crawlmouse sentences hold${n.unread ? `, ${n.unread} could not be checked` : ''}${n.gone ? `, ${n.gone} earlier finding(s) no longer in the summary` : ''}${summary.note ? ` (note: ${summary.note})` : ''}`);
            for (const r of results) console.log(r.confirmed ? `  kept "${r.text}"\n       ${r.measured}` : `  ${r.undecided ? 'not checked' : 'dropped'} "${r.text}"\n       ${r.reason}`);
          } catch (e) {
            console.log(`${b.slug}: failed, ${(e as Error).message.slice(0, 200)}`);
          }
        }),
      ),
    );
  } finally {
    await renderer.stop();
  }
}

/** Stores each business's research file, once every quote in it has been found on the saved copy of its page. */
export function waveFacts(d: Db, o: { name: string; only?: string; check?: boolean }): void {
  let refused = 0;
  for (const b of members(d, o.name, o.only)) {
    const file = join(waveDir(b.slug), 'facts.json');
    if (!existsSync(file)) {
      console.log(`${b.slug}: no research file at ${file}`);
      continue;
    }
    const parsed = Research.safeParse(JSON.parse(readFileSync(file, 'utf8')));
    const pages = savedPages(b.slug);
    const problems = !parsed.success ? parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) : parsed.data.slug !== b.slug ? [`the file is for ${parsed.data.slug}`] : checkResearch(parsed.data, pages);
    if (problems.length || !parsed.success) {
      refused += 1;
      console.log(`${b.slug}: not stored, ${problems.length} problem(s)`);
      for (const p of problems) console.log(`  ${p}`);
      continue;
    }
    if (!o.check) storeResearch(d, b, parsed.data, pages, utcIso());
    const r = parsed.data;
    console.log(`${b.slug}: ${o.check ? 'passes the checks' : 'stored'}. ${r.trading.status}; people ${r.people.status}${r.people.address_as ? ` (${r.people.address_as})` : ''}; email ${r.email.published ? 'published' : 'NOT published'}; ${r.location.town}, ${r.location.region}; booking ${r.booking.system ?? 'none'}; ${r.prices.length} prices, ${r.price_conflicts.length} conflicts; agency ${r.agency.name ?? 'none found'}`);
  }
  if (refused) process.exitCode = 1;
}

/** How many photos the sheet a person chooses from holds. */
const SHEET = 12;

function storePhotos(d: Db, businessId: number, photos: Photo[], heroes: Photo[], at: string): void {
  setFacts(d, businessId, 'photo', photos.map((p) => ({ label: p.url, value: { width: p.width, height: p.height, format: p.format, bytes: p.bytes, kind: p.kind, sharpness: p.sharpness, alt: p.alt, file: p.file }, sourceUrl: p.pageUrl, flag: heroes.includes(p) ? `hero ${heroes.indexOf(p) + 1}` : null })), at);
}

/**
 * The three photos for the top of a page are a person's choice. Without --pick this lays the
 * photos fit for it out on a sheet, numbered from 1 along the rows. With --pick it marks the
 * chosen ones, best first, in place of the ones taken automatically.
 */
export async function waveHero(d: Db, o: { name: string; only?: string; business?: string; pick?: string }): Promise<void> {
  for (const b of members(d, o.name, o.business ?? o.only)) {
    const file = join(waveDir(b.slug), 'assets.json');
    if (!existsSync(file)) {
      console.log(`${b.slug}: no photos measured yet. Run plumb wave assets first.`);
      continue;
    }
    const held = JSON.parse(readFileSync(file, 'utf8')) as { at: string; photos: Photo[]; heroes: string[]; chosenByHand?: boolean; videos?: (FoundVideo & Record<string, unknown>)[] };
    // Pictures and videos found on pages of other sites kept for this business are not its own.
    const own = domainOf(b.website);
    const assets = { ...held, photos: held.photos.filter((p) => domainOf(p.pageUrl) === own), videos: (held.videos ?? []).filter((v) => domainOf(v.pageUrl) === own) };
    const outside = held.photos.length - assets.photos.length + ((held.videos ?? []).length - assets.videos.length);
    if (outside) {
      const kept = assets.heroes.map((u) => assets.photos.find((p) => p.url === u)).filter((p): p is Photo => !!p);
      storePhotos(d, b.id, assets.photos, kept, assets.at);
      setFacts(d, b.id, 'video', assets.videos.map((v) => ({ label: v.url, value: { kind: v.kind, how: v.how, title: v.title ?? null, seconds: v.seconds ?? null, quality: v.quality ?? null, note: v.note ?? null }, sourceUrl: v.pageUrl })), assets.at);
      writeFileSync(file, JSON.stringify({ ...assets, heroes: kept.map((p) => p.url) }, null, 2));
      console.log(`${b.slug}: left out ${outside} picture(s) or video(s) found on pages of other sites`);
    }
    const eligible = heroEligible(assets.photos).slice(0, SHEET);
    if (o.pick !== undefined && o.business) {
      const picked = o.pick.split(',').map((n) => eligible[Number(n) - 1]).filter((p): p is Photo => !!p);
      storePhotos(d, b.id, assets.photos, picked, assets.at);
      writeFileSync(file, JSON.stringify({ ...assets, heroes: picked.map((p) => p.url), chosenByHand: true }, null, 2));
      console.log(`${b.slug}: ${picked.length} hero photo(s) marked: ${picked.map((p) => `${p.width}x${p.height} ${p.url}`).join(' ; ') || 'none'}`);
      continue;
    }
    const sheet = await contactSheet(eligible, join(waveDir(b.slug), 'hero-check.jpg'));
    console.log(`${b.slug}: ${eligible.length} photo(s) fit for the top of a page${sheet ? `, laid out in ${sheet} (two to a row, numbered along the rows)` : ''}`);
    for (const [i, p] of eligible.entries()) console.log(`  ${i + 1}. ${p.width}x${p.height}, crispness ${p.sharpness}, on ${p.pageUrl}: ${p.url}`);
  }
}

/** Measures every photo on the pages kept for each business, picks the best for the top of a page, and looks up its videos, logo, colours and fonts. */
export async function waveAssets(d: Db, o: { name: string; only?: string; max?: number; keepFrom?: number }): Promise<void> {
  const polite = new Polite();
  const renderer = new Renderer(polite);
  await renderer.start();
  const limit = pLimit(4);
  try {
    await Promise.all(
      members(d, o.name, o.only).map((b) =>
        limit(async () => {
          try {
            const brand: Partial<Record<'mobile' | 'desktop', BrandCapture>> = {};
            const live: PageCapture[] = [];
            for (const viewport of ['desktop', 'mobile'] as const) {
              const cap = await renderer.render({ url: b.website!, viewport, onPage: async (page) => void (brand[viewport] = await captureBrand(page, viewport, brandDir(b.slug))) });
              if (cap.ok) live.push(cap);
            }
            // Only the business's own pages count: a photo on a tourism listing or a news article is not theirs.
            const pages = ownPages(savedPages(b.slug), b.website);
            if (brand.desktop || brand.mobile) saveBrandPack(d, b.id, brand.desktop ?? null, brand.mobile ?? null, voiceSamples([...live, ...pages.filter((p) => /about|story|team|who-we-are/i.test(p.finalUrl))]));
            const pack = d.prepare('SELECT logo_path, logo_source_url, colors, fonts, hero_images FROM brand_packs WHERE business_id = ?').get(b.id) as { logo_path: string | null; logo_source_url: string | null; colors: string; fonts: string; hero_images: string } | undefined;

            const found = new Map<string, FoundImage>();
            const add = (f: FoundImage) => void (found.has(f.url) || found.set(f.url, f));
            const home = pages.filter((p) => new URL(p.finalUrl).pathname === '/');
            for (const p of [...home, ...pages.filter((x) => !home.includes(x))]) for (const f of imageUrlsIn(savedHtml(p), p.finalUrl)) add(f);
            for (const i of JSON.parse(pack?.hero_images ?? '[]') as BrandImage[]) if (/^https?:/.test(i.url)) add({ url: fullSize(i.url), asFound: i.url, alt: i.alt, pageUrl: b.website! });
            const max = o.max ?? 80;
            const photos = await collectPhotos(polite, [...found.values()], join(waveDir(b.slug), 'photos'), { max, keepFromWidth: o.keepFrom });
            // Photos a person chose earlier stay chosen, as long as they are still on the site.
            const before = existsSync(join(waveDir(b.slug), 'assets.json')) ? (JSON.parse(readFileSync(join(waveDir(b.slug), 'assets.json'), 'utf8')) as { heroes?: string[]; chosenByHand?: boolean }) : {};
            const chosen = before.chosenByHand ? (before.heroes ?? []).map((u) => photos.find((p) => p.url === u)).filter((p): p is Photo => !!p) : [];
            const heroes = before.chosenByHand ? chosen : heroCandidates(photos, 3);
            const sheet = await contactSheet(heroEligible(photos).slice(0, SHEET), join(waveDir(b.slug), 'hero-check.jpg'));

            const videos = new Map<string, FoundVideo>();
            for (const p of pages) for (const v of videosIn(savedHtml(p), p.finalUrl)) if (!videos.has(v.url)) videos.set(v.url, v);
            const details = [];
            for (const v of [...videos.values()].slice(0, 8)) details.push(await videoDetails(polite, v));

            const at = utcIso();
            storePhotos(d, b.id, photos, heroes, at);
            setFacts(d, b.id, 'video', details.map((v) => ({ label: v.url, value: { kind: v.kind, how: v.how, title: v.title, seconds: v.seconds, quality: v.quality, note: v.note }, sourceUrl: v.pageUrl })), at);
            setFacts(d, b.id, 'logo', pack?.logo_path || pack?.logo_source_url ? [{ value: { file: pack.logo_path, from: pack.logo_source_url }, sourceUrl: b.website }] : [], at);
            setFacts(d, b.id, 'colour', (JSON.parse(pack?.colors ?? '[]') as BrandColour[]).map((c) => ({ label: c.role, value: { hex: c.hex, share: c.share }, sourceUrl: b.website })), at);
            const fonts = (JSON.parse(pack?.fonts ?? '{}') as { desktop?: BrandFonts | null; mobile?: BrandFonts | null }).desktop ?? (JSON.parse(pack?.fonts ?? '{}') as { mobile?: BrandFonts | null }).mobile;
            setFacts(d, b.id, 'font', fonts ? [{ value: { headings: fonts.headings, body: fonts.body, buttons: fonts.buttons, webFonts: fonts.webFonts }, sourceUrl: b.website }] : [], at);
            writeFileSync(join(waveDir(b.slug), 'assets.json'), JSON.stringify({ at, photos, heroes: heroes.map((h) => h.url), chosenByHand: !!before.chosenByHand, videos: details, sheet }, null, 2));
            if (found.size > max) console.log(`${b.slug}: ${found.size - max} more pictures were found and not fetched (the limit is ${max}; raise it with --max)`);
            const big = photos.filter((p) => p.kind === 'photo' && p.width >= 1800).length;
            console.log(`${b.slug}: ${photos.length} pictures measured, ${big} photos at least 1800 px wide, ${heroes.length} hero picks${heroes.length ? ` (${heroes.map((h) => `${h.width}x${h.height}`).join(', ')})` : ''}; ${details.length} videos${details.length ? ` (${details.map((v) => `${v.kind}${v.seconds ? ` ${v.seconds}s` : ''}${v.quality ? ` ${v.quality}` : ''}`).join(', ')})` : ''}; logo ${pack?.logo_path ? 'kept' : 'not found'}`);
          } catch (e) {
            console.log(`${b.slug}: failed, ${(e as Error).message.slice(0, 200)}`);
          }
        }),
      ),
    );
  } finally {
    await renderer.stop();
  }
}

/** Writes the pack for a wave from the stored facts and the findings approved in the review app, and prints the hand-back table. */
export function wavePack(d: Db, o: { name: string; batch?: string; file?: string }): void {
  const list = members(d, o.name);
  if (!list.length) throw new Error(`no businesses in ${o.name}`);
  const batch = waveBatch(d, list, o.batch);
  // LinkedIn addresses are filled in by hand in the list itself.
  const rows = o.file && existsSync(o.file) ? parseCsv(readFileSync(o.file, 'utf8')) : [];
  const measured = (d.prepare("SELECT MAX(at) AS at FROM ledger WHERE provider = 'google_places'").get() as { at: string | null }).at;
  // What the independent check said to mind when a finding is worded.
  const verdictFile = join(paths.data, 'wave', `${o.name}-review-verdicts.json`);
  const verdicts = existsSync(verdictFile) ? (JSON.parse(readFileSync(verdictFile, 'utf8')) as Record<string, { verdict: string; note?: string }>) : {};
  const notes = Object.fromEntries(Object.entries(verdicts).filter(([, v]) => v.verdict === 'ok' && v.note).map(([id, v]) => [Number(id), v.note!]));
  const r = writePack(d, o.name, batch, join(paths.reports, batch), (slug) => {
    const row = rows.find((x) => x.slug === slug);
    return { linkedin: row?.linkedin_owner_url, linkedinNotes: row?.linkedin_notes, googleMeasuredOn: measured, notes };
  });
  const yes = (b: boolean) => (b ? 'yes' : 'no');
  console.log('slug | still trading | owner confirmed | email confirmed | approved findings | best hero photo found | own video found');
  for (const p of r.businesses) console.log(`${p.slug} | ${p.trading.status === 'trading' ? 'yes' : p.trading.status} | ${yes(p.people.status === 'confirmed')} | ${yes(!!p.email?.published)} | ${p.findings.length} | ${yes(p.assets.photos.some((x) => x.hero !== null))} | ${yes(p.assets.videos.length > 0)}`);
  console.log(`Pack: ${r.file}`);
  console.log(`Data for each business: ${join(paths.reports, batch, o.name)}`);
}

export function registerWave(program: Command): void {
  const wave = program.command('wave').description('Prepare a hand-picked list of businesses: facts with their sources, findings and the pack');

  registerWaveRun(wave);

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
    .option('--batch <name>', 'batch the findings belong to (by default the newest one every business of the wave has a run in)')
    .option('--only <slugs>', 'comma separated slugs')
    .option('--estimate', 'show the questions and the estimate, and stop')
    .option('--pass <n>', '1 asks each question once; 2, at least 60 minutes later, asks the remaining runs', (v) => Number(v))
    .option('--approved-above-ask', 'UD has approved spending between the ask line and the total')
    .action((o: { name: string; batch?: string; only?: string; estimate?: boolean; pass?: number; approvedAboveAsk?: boolean }) => waveAi(db(), o));

  wave
    .command('crawlmouse')
    .description('Open the example pages behind each Crawlmouse sentence again and store what still holds as findings')
    .requiredOption('--name <name>', 'wave name')
    .option('--batch <name>', 'batch the findings belong to (by default the newest one every business of the wave has a run in)')
    .option('--only <slugs>', 'comma separated slugs')
    .action((o: { name: string; batch?: string; only?: string }) => waveCrawlmouse(db(), o));

  wave
    .command('facts')
    .description("Store each business's research file, after finding every quote in it on the saved copy of its page")
    .requiredOption('--name <name>', 'wave name')
    .option('--only <slugs>', 'comma separated slugs')
    .option('--check', 'check the files and store nothing')
    .action((o: { name: string; only?: string; check?: boolean }) => waveFacts(db(), o));

  wave
    .command('assets')
    .description('Measure every photo, pick the best three for the top of a page, and look up videos, logo, colours and fonts')
    .requiredOption('--name <name>', 'wave name')
    .option('--only <slugs>', 'comma separated slugs')
    .option('--max <n>', 'pictures to fetch per business', (v) => Number(v))
    .option('--keep-from <px>', 'keep a copy of every photo at least this wide (1200 unless given), for a business whose photos are all small', (v) => Number(v))
    .action((o: { name: string; only?: string; max?: number; keepFrom?: number }) => waveAssets(db(), o));

  wave
    .command('pack')
    .description('Write the pack for a wave: one section for each business, from the stored facts and the approved findings')
    .requiredOption('--name <name>', 'wave name')
    .option('--batch <name>', 'batch the findings belong to (by default the newest one every business of the wave has a run in)')
    .option('--file <path>', 'the wave list, for the LinkedIn addresses filled in by hand')
    .action((o: { name: string; batch?: string; file?: string }) => wavePack(db(), o));

  wave
    .command('hero')
    .description('Lay out the photos fit for the top of a page on a numbered sheet, or mark the three a person has chosen')
    .requiredOption('--name <name>', 'wave name')
    .option('--only <slugs>', 'comma separated slugs')
    .option('--business <slug>', 'one business, with --pick')
    .option('--pick <numbers>', 'the chosen photos by their number on the sheet, best first, such as 4,1,7. Empty for none.')
    .action((o: { name: string; only?: string; business?: string; pick?: string }) => waveHero(db(), o));

  wave
    .command('set')
    .description('Record a decision on one row of a wave: drop it with the reason, or bring a reserve in')
    .requiredOption('--name <name>', 'wave name')
    .requiredOption('--business <slug>', 'business slug')
    .requiredOption('--status <status>', 'wave, reserve or dropped')
    .option('--note <text>', 'the reason, kept with the row')
    .action((o: { name: string; business: string; status: string; note?: string }) => {
      if (!['wave', 'reserve', 'dropped'].includes(o.status)) throw new Error('status must be wave, reserve or dropped');
      setWaveStatus(db(), o.name, o.business, o.status as WaveStatus, o.note ?? null);
      console.log(`${o.business}: ${o.status}${o.note ? ` (${o.note})` : ''}`);
    });

  wave
    .command('approve')
    .description('Decide every finding of a wave by rule and write the decisions to data/wave/<wave>-approvals.csv')
    .requiredOption('--name <name>', 'wave name')
    .option('--batch <name>', 'batch the findings belong to (by default the newest one every business of the wave has a run in)')
    .option('--only <slugs>', 'comma separated slugs')
    .option('--apply', 'store the decisions: rejections at once, approvals once the independent check has passed them')
    .action((o: { name: string; batch?: string; only?: string; apply?: boolean }) => {
      const d = db();
      const all = members(d, o.name);
      const r = approveWave(d, o.name, members(d, o.name, o.only), waveBatch(d, all, o.batch), { apply: o.apply });
      const count = (pick: (x: (typeof r.decisions)[number]) => boolean) => r.decisions.filter(pick).length;
      const rules = new Map<string, number>();
      for (const x of r.decisions) rules.set(`${x.decision} | ${x.rule}`, (rules.get(`${x.decision} | ${x.rule}`) ?? 0) + 1);
      console.log(`${count((x) => x.decision === 'approve')} approved, ${count((x) => x.decision === 'reject')} rejected. ${r.toReview} approved finding(s) still to go to the independent check.`);
      for (const [rule, n] of [...rules.entries()].sort()) console.log(`  ${String(n).padStart(3)}  ${rule}`);
      if (r.stored) console.log(`Stored: ${r.stored.approved} approved, ${r.stored.rejected} rejected, ${r.stored.waiting} waiting for the independent check.`);
      if (r.suppressed.length) console.log(`On the suppression list, skipped: ${r.suppressed.join(', ')}`);
      if (r.weak.length) console.log(`Weak (fewer than two approved): ${r.weak.join(', ')}`);
      if (r.needSpeedRun.length) console.log(`Speed runs disagree, a third run is needed: ${r.needSpeedRun.join(',')}`);
      console.log(`Decisions: ${r.csv}`);
      console.log(`For the independent check: ${r.packet}`);
    });
}
