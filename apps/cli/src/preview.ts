import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Command } from 'commander';
import { db, env, nzTime, paths, type Business, type Db } from '@plumbline/core';
import { Polite } from '@plumbline/fetch';
import { limits, spent } from '@plumbline/budget';
import { latestBatch } from '@plumbline/export';
import { BASE_PATH, LIMITS, WAVE1_LAYOUTS, draftAfterRecheck, fillDraft, fixedBlocks, numbersIn, parseDraft, scanEmail, withStatus, askCorrected, buildPage, layoutOf, loadPlan, loadRecipe, lookOf, pagesToPublish, recipeSlugs, varietyIssues, checkPage, contentDir, correctedQuestions, correctedSummary, forgetToken, planCorrected, previewPaths, readVisits, removeGenerated, serveSite, summarise, tokenFor, verifyCrawlmouse, type Dropped, type GateReport, type PageData } from '@plumbline/preview';
import { aiSummary } from '@plumbline/ai';
import { speedRuns, statedSentence, waveMembers } from '@plumbline/wave';
import { waveBatch, waveCrawlmouse } from './wave.ts';
import { businessSuppressed, suppressionList } from './approve.ts';
import { auditBatch } from './audit.ts';

function business(d: Db, slug: string): Business {
  const b = d.prepare('SELECT * FROM businesses WHERE slug = ?').get(slug) as Business | undefined;
  if (!b) throw new Error(`no business with slug ${slug}`);
  return b;
}

/** The businesses that have a preview: every folder under previews/content/ with a content file, and every recipe. */
export function previewSlugs(only?: string): string[] {
  if (only) return only.split(',').map((s) => s.trim()).filter(Boolean);
  // A folder under previews/content/ may be a link to another working copy's folder, so each is followed.
  const designed = existsSync(previewPaths.content) ? readdirSync(previewPaths.content).filter((name) => existsSync(join(contentDir(name), 'content.json'))) : [];
  return [...new Set([...designed, ...recipeSlugs()])].sort();
}

interface FindingState {
  id: number;
  check_id: string;
  title: string;
  status: string;
  last_verified_at: string | null;
}

function approvedFindings(d: Db, businessId: number, batch: string): FindingState[] {
  return d.prepare("SELECT id, check_id, title, status, last_verified_at FROM findings WHERE business_id = ? AND batch = ? AND status IN ('approved', 'resolved') ORDER BY score DESC, id").all(businessId, batch) as FindingState[];
}

/** Re-verifies every approved finding behind the preview pages and says which ones no longer hold. */
export async function previewRecheck(d: Db, opts: { only?: string; concurrency?: number }): Promise<void> {
  const slugs = previewSlugs(opts.only);
  if (!slugs.length) throw new Error('no preview businesses found under previews/content/');
  const byBatch = new Map<string, Business[]>();
  for (const slug of slugs) {
    const b = business(d, slug);
    const batch = latestBatch(d, b.id);
    if (!batch) throw new Error(`${slug} has not been audited`);
    byBatch.set(batch, [...(byBatch.get(batch) ?? []), b]);
  }
  for (const [batch, members] of byBatch) {
    const before = new Map(members.map((b) => [b.id, new Set(approvedFindings(d, b.id, batch).filter((f) => f.status === 'approved').map((f) => f.id))]));
    const s = await auditBatch(d, { aiSummary, batch, kind: 'recheck', only: members.map((b) => b.slug), concurrency: opts.concurrency });
    console.log(`recheck ${batch}: ${s.done} done, ${s.blocked} blocked, ${s.failed} failed. Still true ${s.reproduced}, no longer true ${s.resolved}.`);
    for (const b of members) {
      const now = approvedFindings(d, b.id, batch);
      const dropped = now.filter((f) => f.status === 'resolved' && before.get(b.id)!.has(f.id));
      const kept = now.filter((f) => f.status === 'approved');
      const oldest = kept.map((f) => f.last_verified_at).filter((x): x is string => !!x).sort()[0];
      console.log(`  ${b.slug}: ${kept.length} findings hold${oldest ? `, oldest check ${nzTime(oldest)}` : ''}${dropped.length ? `, dropped ${dropped.length}` : ''}`);
      for (const f of dropped) console.log(`    dropped ${f.check_id}: ${f.title}`);
    }
  }
  await previewCrawlmouse(opts);
  console.log('Run "pnpm plumb preview build" and "pnpm plumb preview deploy" to put the result on the pages.');
}

/** Re-opens the example pages behind each Crawlmouse sentence and keeps only the sentences that still hold. */
export async function previewCrawlmouse(opts: { only?: string }): Promise<void> {
  const polite = new Polite();
  for (const slug of previewSlugs(opts.only)) {
    const v = await verifyCrawlmouse(polite, slug);
    if (!v) continue;
    console.log(`  ${slug}: Crawlmouse ${v.findings.filter((f) => f.verified).length} of ${v.findings.length} sentences still hold`);
    for (const f of v.findings.filter((x) => !x.verified)) console.log(`    dropped "${f.text}": ${f.reason}`);
  }
}

/** Where the email drafts of a wave are kept. Like every report, they stay out of the repository. */
export function emailsDir(findingsBatch: string, wave: string): string {
  return join(paths.reports, findingsBatch, wave, 'emails');
}

/** Each finding a draft may use, as it stands now: its status, the sentence it would be put in today, and when it was last checked. */
function findingsNow(d: Db, businessId: number, findingsBatch: string): Map<number, { status: string; sentence: string; verifiedAt: string | null }> {
  const runs = speedRuns(d, businessId, findingsBatch);
  const rows = d.prepare('SELECT id, check_id, status, title, detail, last_verified_at FROM findings WHERE business_id = ? AND batch = ?').all(businessId, findingsBatch) as { id: number; check_id: string; status: string; title: string; detail: string; last_verified_at: string | null }[];
  return new Map(rows.map((r) => [r.id, { status: r.status, sentence: statedSentence({ checkId: r.check_id, title: r.title, detail: JSON.parse(r.detail || '{}') as Record<string, unknown> }, runs), verifiedAt: r.last_verified_at }]));
}

/**
 * Before a batch of emails goes out: every finding its drafts use is verified again, and each draft
 * is marked ready, or as needing an edit with the line named. A ready draft is good for 24 hours.
 */
export async function previewRecheckBatch(d: Db, o: { wave: string; batch: string; concurrency?: number }): Promise<void> {
  const slugs = loadPlan().batches[o.batch];
  if (!slugs?.length) throw new Error(`previews/batches.json names no batch ${o.batch}`);
  const all = waveMembers(d, o.wave);
  const members = all.filter((b) => slugs.includes(b.slug));
  const findingsBatch = waveBatch(d, all);
  const s = await auditBatch(d, { aiSummary, batch: findingsBatch, kind: 'recheck', only: members.map((b) => b.slug), concurrency: o.concurrency });
  console.log(`recheck ${findingsBatch}: ${s.done} done, ${s.blocked} blocked, ${s.failed} failed. Still true ${s.reproduced}, no longer true ${s.resolved}.`);
  await waveCrawlmouse(d, { name: o.wave, batch: findingsBatch, only: members.map((b) => b.slug).join(',') });
  const now = new Date();
  for (const b of members) {
    const file = join(emailsDir(findingsBatch, o.wave), `${b.slug}.md`);
    if (!existsSync(file)) {
      console.log(`${b.slug}: no draft at ${file}`);
      continue;
    }
    const text = readFileSync(file, 'utf8');
    const draft = parseDraft(text);
    const r = draftAfterRecheck(draft, findingsNow(d, b.id, findingsBatch), now);
    const line = r.status === 'ready' ? `ready, rechecked ${nzTime(now)}. Send within 24 hours.` : r.status === 'needs edit' ? `needs edit: ${r.notes.join('; ')}` : `${draft.statusLine.split(' | ')[0]}${r.notes.length ? ` | ${r.notes.join('; ')}` : ''}`;
    writeFileSync(file, withStatus(text, line));
    console.log(`${b.slug}: ${line}`);
  }
}

/** The sheet that holds the wording every email of a wave shares. It is filled in once, by hand. */
const FIXED_SHEET = `# The wording every email of this wave shares

Each block below is pasted in once. "preview emails --fill" then puts it into every draft where the draft marks its place.

## INTRO
(the line that introduces us, as in the wave 1 emails)

## DEMO LINES
(the lines around the demo link, as in the wave 1 emails, with {link} on a line of its own where the link goes)

## CLOSING
(the offer, the call to action, the signature and the footer, word for word as in the wave 1 emails)
`;

/** Runs the writing rules over the drafts of a wave, or of one batch of it, and prints what each breaks. With `fill`, the shared wording is put in first. */
export function previewEmails(d: Db, o: { wave: string; batch?: string; fill?: boolean }): void {
  const all = waveMembers(d, o.wave);
  const findingsBatch = waveBatch(d, all);
  const sheet = join(emailsDir(findingsBatch, o.wave), '_shared.md');
  if (!existsSync(sheet)) {
    mkdirSync(emailsDir(findingsBatch, o.wave), { recursive: true });
    writeFileSync(sheet, FIXED_SHEET);
  }
  const blocks = fixedBlocks(readFileSync(sheet, 'utf8'));
  if (o.fill && !Object.keys(blocks).length) console.log(`Nothing to fill in: ${sheet} still holds its notes.`);
  const only = o.batch ? (loadPlan().batches[o.batch] ?? []) : null;
  let broken = 0;
  for (const b of all.filter((x) => !only || only.includes(x.slug))) {
    const file = join(emailsDir(findingsBatch, o.wave), `${b.slug}.md`);
    if (!existsSync(file)) {
      console.log(`${b.slug}: no draft`);
      continue;
    }
    if (o.fill) writeFileSync(file, fillDraft(readFileSync(file, 'utf8'), blocks));
    const draft = parseDraft(readFileSync(file, 'utf8'));
    // A number may be stated when the pack holds it or a finding the draft uses carries it.
    const pack = join(paths.reports, findingsBatch, o.wave, `${b.slug}.json`);
    const sources = `${existsSync(pack) ? readFileSync(pack, 'utf8') : ''}\n${draft.findings.map((f) => f.sentence).join('\n')}\n${Object.values(blocks).join('\n')}`;
    const issues = scanEmail(draft, new Set(numbersIn(sources).map((n) => n.token)));
    broken += issues.length ? 1 : 0;
    console.log(`${b.slug}: ${draft.statusLine || 'no status'} | to ${draft.to} | "${draft.subject}"${issues.length ? '' : ' | clean'}`);
    for (const i of issues) console.log(`  ${i.kind}: ${i.text}`);
  }
  if (broken) process.exitCode = 1;
}

const REPLY_EMAIL = 'udaay@nahltech.com';
const SITE_ADDRESS = 'https://nahltech.com';
const VERCEL_PROJECT = 'nahl-previews';

const VERCEL_JSON = {
  framework: null,
  buildCommand: '',
  installCommand: '',
  outputDirectory: 'site',
  cleanUrls: true,
  // The main site drops a trailing slash before it forwards, so the pages must answer without one.
  trailingSlash: false,
  headers: [
    { source: '/(.*)', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }, { key: 'Referrer-Policy', value: 'no-referrer' }, { key: 'X-Content-Type-Options', value: 'nosniff' }] },
    { source: '/demo/(_next/static|fonts)/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
    { source: '/(.*)/(img|evidence)/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000' }] },
  ],
};

/**
 * Moves the framework's scripts to after the first paint. The page is complete without them: they
 * add the tabs and the reveals. Fetched early, they compete with the photo at the top for a slow
 * phone connection.
 */
export function scriptsAfterPaint(html: string): string {
  const sources: string[] = [];
  let out = html.replace(/<script src="([^"]+)" async=""><\/script>/g, (_, src: string) => {
    sources.push(src);
    return '';
  });
  if (!sources.length) return html;
  out = out.replace(/<link rel="preload" as="script"[^>]*\/>/g, '');
  // The scripts start on the visitor's first touch, scroll or key, or two seconds after the page has
  // loaded, whichever comes first. Until they arrive, a tap on a tab is handled here, and the hash it
  // sets is what the page reads when it wakes.
  const loader = `<script>(function(){var s=${JSON.stringify(sources)},done=false,ev=['pointerdown','touchstart','keydown','scroll'];function go(){if(done)return;done=true;ev.forEach(function(n){removeEventListener(n,go,true)});s.forEach(function(u){var e=document.createElement('script');e.src=u;e.async=false;document.body.appendChild(e)})}ev.forEach(function(n){addEventListener(n,go,{capture:true,passive:true})});function later(){setTimeout(go,2000)}if(document.readyState==='complete')later();else addEventListener('load',later);document.addEventListener('click',function(e){var t=e.target&&e.target.closest&&e.target.closest('[role=tab][aria-controls=demo],[role=tab][aria-controls=found]');if(!t||t.hasAttribute('data-live'))return;var id=t.getAttribute('aria-controls');['demo','found'].forEach(function(k){var p=document.getElementById(k),b=document.getElementById('tab-'+k);if(p)p.hidden=k!==id;if(b)b.setAttribute('aria-selected',String(k===id))});history.replaceState(null,'',id==='found'?'#found':location.pathname);scrollTo(0,0)},true)})()</script>`;
  return out.replace('</body>', `${loader}</body>`);
}

function draftMarker(): string {
  return join(previewPaths.out, 'DRAFT');
}

/**
 * Gathers what each page shows and prepares its photographs, without writing the pages out. This
 * is the part of a build that belongs to one business, so several can run side by side, and a
 * page under way can be looked at in `next dev`.
 */
export async function previewData(d: Db, opts: { only?: string; draft?: boolean }): Promise<string | undefined> {
  const slugs = previewSlugs(opts.only);
  if (!slugs.length) throw new Error('no preview businesses found under previews/content/ or previews/recipes/');
  const call = env().CAL_LINK;
  if (!call && !opts.draft) throw new Error('CAL_LINK is not set in .env. It holds the link behind "Book a 15 minute call". Use --draft to build without it; a draft cannot be deployed.');
  const dropped: (Dropped & { slug: string })[] = [];
  const { list } = suppressionList();
  for (const slug of slugs) {
    const why = businessSuppressed(d, business(d, slug), list);
    if (why) {
      // A suppressed business gets no page, and any page it had is not built again.
      console.log(`${slug}: skipped, ${why}`);
      rmSync(join(previewPaths.data, `${slug}.json`), { force: true });
      continue;
    }
    const r = await buildPage(d, slug, { replyEmail: REPLY_EMAIL, callLink: call || `mailto:${REPLY_EMAIL}?subject=${encodeURIComponent('15 minute call')}` });
    console.log(`${slug}: /${r.data.path}/  ${r.data.findings.length} findings, ${Object.keys(r.data.images).length} images${r.dropped.length ? `, ${r.dropped.length} dropped` : ''}`);
    for (const x of r.dropped) {
      console.log(`  dropped ${x.check}: ${x.title} (${x.reason})`);
      dropped.push({ slug, ...x });
    }
    for (const w of r.warnings) console.log(`  warning ${w}`);
  }
  mkdirSync(previewPaths.out, { recursive: true });
  // What was left off the pages is kept for every business, not only the ones made again this time.
  const droppedFile = join(previewPaths.out, 'dropped.json');
  const before = existsSync(droppedFile) ? (JSON.parse(readFileSync(droppedFile, 'utf8')) as (Dropped & { slug: string })[]) : [];
  writeFileSync(droppedFile, JSON.stringify([...before.filter((x) => !slugs.includes(x.slug)), ...dropped], null, 2));
  return call;
}

/**
 * Builds the data, the pages and the folder that is deployed. Everything lands under previews/out/.
 * With `batches`, the site is written out with the pages that have a design of their own and the
 * recipe pages of those batches only, so a page still being worked on is never deployed.
 */
export async function previewBuild(d: Db, opts: { only?: string; draft?: boolean; batches?: string[] }): Promise<void> {
  const call = await previewData(d, opts);

  // The pages that go into the site are staged in a folder of their own, which is what the build reads.
  const built = readdirSync(previewPaths.data).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
  const designed = built.filter((slug) => existsSync(join(contentDir(slug), 'content.json')));
  const publish = opts.batches ? pagesToPublish(built, designed, loadPlan().batches, opts.batches) : built;
  const staged = join(previewPaths.out, 'staged');
  rmSync(staged, { recursive: true, force: true });
  mkdirSync(staged, { recursive: true });
  for (const slug of publish) copyFileSync(join(previewPaths.data, `${slug}.json`), join(staged, `${slug}.json`));

  const app = previewPaths.app;
  execFileSync(process.execPath, [join(app, 'scripts', 'fonts.mjs')], { cwd: app, stdio: 'inherit' });
  execFileSync(join(app, 'node_modules', '.bin', 'next'), ['build'], { cwd: app, stdio: 'inherit', env: { ...process.env, PREVIEWS_DATA: staged, NEXT_TELEMETRY_DISABLED: '1' } });

  // The host serves the site folder as it is, so the pages sit under the same path they are reached at.
  const served = join(previewPaths.site, BASE_PATH);
  rmSync(previewPaths.site, { recursive: true, force: true });
  cpSync(join(app, 'out'), served, { recursive: true, dereference: true });
  // Only what is published belongs in the site. Photographs linked into the app's public folder, for looking at a page in development, are left behind.
  const published = new Set(readdirSync(staged).map((f) => (JSON.parse(readFileSync(join(staged, f), 'utf8')) as PageData).path));
  for (const e of readdirSync(served, { withFileTypes: true })) {
    if (e.isDirectory() && /-[a-z0-9]{6}$/.test(e.name) && !published.has(e.name)) rmSync(join(served, e.name), { recursive: true, force: true });
  }
  const assets = join(previewPaths.out, 'assets');
  for (const page of readdirSync(staged).map((f) => JSON.parse(readFileSync(join(staged, f), 'utf8')) as PageData)) {
    if (existsSync(join(assets, page.path))) cpSync(join(assets, page.path), join(served, page.path), { recursive: true, filter: (from) => !from.endsWith('.made') });
    const html = join(served, page.path, 'index.html');
    writeFileSync(html, scriptsAfterPaint(readFileSync(html, 'utf8')));
  }
  writeFileSync(join(previewPaths.site, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  writeFileSync(join(previewPaths.out, 'vercel.json'), JSON.stringify(VERCEL_JSON, null, 2));
  if (opts.draft && !call) writeFileSync(draftMarker(), 'Built without CAL_LINK.\n');
  else rmSync(draftMarker(), { force: true });
  console.log(`Built ${publish.length} page(s) into ${previewPaths.site}${opts.draft && !call ? ' (draft: no call link)' : ''}`);
}

function pages(only?: string): PageData[] {
  // The pages of the site as it was last written out, which may be fewer than the pages that have data.
  const staged = join(previewPaths.out, 'staged');
  const from = existsSync(staged) ? staged : previewPaths.data;
  if (!existsSync(from)) throw new Error('nothing is built yet. Run plumb preview build.');
  const wanted = only ? new Set(only.split(',').map((x) => x.trim())) : null;
  return readdirSync(from).map((f) => JSON.parse(readFileSync(join(from, f), 'utf8')) as PageData).filter((p) => !wanted || wanted.has(p.slug));
}

/** Runs every quality gate for each page and saves the screenshots for review. */
export async function previewCheck(opts: { only?: string; live?: boolean; base?: string; noLighthouse?: boolean }): Promise<void> {
  const offerText = readFileSync(join(previewPaths.app, 'lib', 'offer.ts'), 'utf8');
  const local = opts.live || opts.base ? null : await serveSite();
  const base = opts.base ?? (opts.live ? SITE_ADDRESS : local!.base);
  const reports: GateReport[] = [];
  try {
    for (const page of pages(opts.only)) {
      console.log(`${page.slug}: ${base}${BASE_PATH}/${page.path}/`);
      const r = await checkPage(page, { base, offerText, skipLighthouse: opts.noLighthouse, log: console.log });
      reports.push(r);
      const lh = r.lighthouse;
      if (!opts.noLighthouse) console.log(`  median: performance ${lh.performance} (needs ${LIMITS.performance}), accessibility ${lh.accessibility} (needs ${LIMITS.accessibility}), LCP ${lh.lcpMs === null ? 'n/a' : `${(lh.lcpMs / 1000).toFixed(2)} s`} (under ${LIMITS.lcpMs / 1000} s), CLS ${lh.cls === null ? 'n/a' : lh.cls.toFixed(3)} (under ${LIMITS.cls}), TBT ${lh.tbtMs === null ? 'n/a' : `${Math.round(lh.tbtMs)} ms`} (under ${LIMITS.tbtMs} ms)`);
      console.log(`  links: ${r.links.filter((l) => l.ok).length} of ${r.links.length} pass; booking ${[...new Set(r.links.filter((l) => l.kind === 'booking').map((l) => l.href))].length}, tel ${r.links.filter((l) => l.kind === 'tel').length}, mailto ${r.links.filter((l) => l.kind === 'mailto').length}`);
      console.log(`  visit report: ${r.beacon.ok ? 'one view after three seconds, with the right token' : 'NOT as expected'}`);
      console.log(r.failures.length ? `  FAILED ${r.failures.length}:` : '  all gates pass');
      for (const f of r.failures) console.log(`    ${f}`);
    }
  } finally {
    local?.server.close();
  }
  mkdirSync(previewPaths.review, { recursive: true });
  writeFileSync(join(previewPaths.review, opts.live || opts.base ? 'gates-live.json' : 'gates-local.json'), JSON.stringify({ at: new Date().toISOString(), base, reports }, null, 2));
  console.log(`Screenshots and the full report are in ${previewPaths.review}`);
  if (reports.some((r) => r.failures.length)) process.exitCode = 1;
}

function vercel(args: string[]): void {
  execFileSync('vercel', args, { cwd: previewPaths.out, stdio: 'inherit' });
}

/** Deploys the built folder from this machine. Nothing is built on the host. With `preview`, it goes to a preview address and the live pages are left alone. */
export function previewDeploy(opts: { preview?: boolean } = {}): void {
  if (!existsSync(join(previewPaths.site, 'robots.txt'))) throw new Error('nothing is built yet. Run plumb preview build.');
  if (existsSync(draftMarker())) throw new Error('the last build was a draft without CAL_LINK. Set CAL_LINK in .env and build again.');
  if (!existsSync(join(previewPaths.out, '.vercel', 'project.json'))) throw new Error(`previews/out is not linked to a Vercel project. Run "vercel link --project ${VERCEL_PROJECT}" in previews/out once.`);
  vercel(['build', ...(opts.preview ? [] : ['--prod']), '--yes']);
  vercel(['deploy', '--prebuilt', ...(opts.preview ? [] : ['--prod']), '--yes']);
}

/** Takes one page down: its generated files go, the address is forgotten, and the site is rebuilt and deployed without it. */
export async function previewRemove(d: Db, slug: string, opts: { deploy?: boolean }): Promise<void> {
  business(d, slug);
  const token = removeGenerated(d, slug);
  forgetToken(d, slug);
  const content = join(contentDir(slug), 'content.json');
  if (existsSync(content)) rmSync(content);
  console.log(`Removed ${slug}${token ? ` (was /${slug}-${token}/)` : ''}. Its content file is deleted so it is not rebuilt; photos and saved pages under ${contentDir(slug)} are kept until "plumb purge".`);
  
  if (opts.deploy === false) return void console.log('Not deployed. The page stays live until the next "plumb preview build" and "plumb preview deploy".');
  if (previewSlugs().length) await previewBuild(d, {});
  else {
    rmSync(previewPaths.site, { recursive: true, force: true });
    mkdirSync(previewPaths.site, { recursive: true });
    writeFileSync(join(previewPaths.site, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  }
  previewDeploy();
}

/** Asks the hand-written questions for the businesses that have them, and prints how each business fares. */
export async function previewAi(d: Db, opts: { only?: string; estimate?: boolean }): Promise<void> {
  const slugs = previewSlugs(opts.only).filter((s) => correctedQuestions(s).length);
  if (!slugs.length) return void console.log('No business has a questions.json under previews/content/.');
  const lim = limits();
  for (const slug of slugs) {
    const b = business(d, slug);
    const questions = correctedQuestions(slug);
    const plan = planCorrected(d, slug, questions);
    const already = spent(d);
    console.log(`${slug}: ${questions.length} question(s), ${plan.toRun.length} answers to ask, ${plan.cached} already stored. Estimate $${plan.totalUsd.toFixed(4)}; spent so far $${already.toFixed(4)} of $${lim.total.toFixed(2)}.`);
    if (opts.estimate) continue;
    if (plan.toRun.length) {
      const r = await askCorrected(d, plan);
      console.log(`  asked ${r.asked}, failed ${r.failed}, cost $${r.spentUsd.toFixed(4)}.${r.stopped ? ` Stopped: ${r.stopped.message}` : ''}`);
    }
    const s = correctedSummary(d, b, questions);
    for (const q of s.questions) {
      console.log(`  "${q.question}"`);
      console.log(`    named in ${q.namedIn} of ${q.answers.length} answers${q.others.length ? `; others named: ${q.others.slice(0, 6).map((o) => `${o.name} (${o.answers})`).join(', ')}` : ''}`);
    }
    console.log(`  ${b.name}: named in ${s.namedIn} of ${s.answers} answers${s.complete ? '' : ' (incomplete: some answers are missing)'}.`);
  }
}

/** Who has opened their page: one line per business, read from the visit table. */
export async function previewVisits(d: Db, opts: { only?: string }): Promise<void> {
  const paths = new Map<string, string>();
  for (const slug of previewSlugs(opts.only)) {
    const token = tokenFor(d, slug);
    if (token) paths.set(`${slug}-${token}`, slug);
  }
  const rows = summarise([...paths.keys()], await readVisits([...paths.keys()]));
  const when = (iso: string | null) => (iso ? nzTime(iso) : 'never');
  console.log('business | token | first view | last view | views | findings tab | reply or call');
  for (const r of rows) console.log(`${paths.get(r.token)} | ${r.token} | ${when(r.firstView)} | ${when(r.lastView)} | ${r.views} | ${r.findingsTab ? 'yes' : 'no'} | ${r.replyOrCall ? 'yes' : 'no'}`);
}

export function registerPreview(program: Command): void {
  const preview = program.command('preview').description('Private demo pages for businesses whose findings are approved');

  preview
    .command('recheck')
    .description('Re-verify the approved findings behind every preview page. With a wave and a batch, re-verify what that batch\'s email drafts use and mark each draft ready or as needing an edit.')
    .option('--only <slugs>', 'comma separated slugs')
    .option('--wave <name>', 'wave name')
    .option('--batch <letter>', 'the batch of the wave, as written in previews/batches.json')
    .option('--concurrency <n>', 'sites collected at once', (v) => Number(v))
    .action((o: { only?: string; wave?: string; batch?: string; concurrency?: number }) => {
      if (o.wave && o.batch) return previewRecheckBatch(db(), { wave: o.wave, batch: o.batch, concurrency: o.concurrency });
      if (o.wave || o.batch) throw new Error('give both --wave and --batch, or neither');
      return previewRecheck(db(), o);
    });

  preview
    .command('emails')
    .description('Run the writing rules over the email drafts of a wave: length, dashes and hyphens, hype, the subject, the link, and a source for every number')
    .requiredOption('--wave <name>', 'wave name')
    .option('--batch <letter>', 'only the drafts of one batch')
    .option('--fill', 'first put the shared wording from emails/_shared.md into each draft where it marks its place')
    .action((o: { wave: string; batch?: string; fill?: boolean }) => previewEmails(db(), o));

  preview
    .command('ai')
    .description('Ask the corrected questions in previews/content/<slug>/questions.json. Shows the cost estimate first.')
    .option('--only <slugs>', 'comma separated slugs')
    .option('--estimate', 'show the estimate and stop')
    .action((o: { only?: string; estimate?: boolean }) => previewAi(db(), o));

  preview
    .command('crawlmouse')
    .description('Re-open the example pages behind each Crawlmouse sentence and keep only what still holds')
    .option('--only <slugs>', 'comma separated slugs')
    .action((o: { only?: string }) => previewCrawlmouse(o));

  preview
    .command('build [slug]')
    .description('Build the pages into previews/out/ from the database, previews/content/ and previews/recipes/. With a slug or a wave, only those pages are made again; the site is always written out whole.')
    .option('--only <slugs>', 'comma separated slugs')
    .option('--wave <name>', 'the businesses of a wave that have a recipe')
    .option('--batches <letters>', 'write the site out with the designed pages and the recipe pages of these batches only (comma separated, as in previews/batches.json)')
    .option('--draft', 'build without CAL_LINK, for looking at the pages locally')
    .action((slug: string | undefined, o: { only?: string; wave?: string; batches?: string; draft?: boolean }) => {
      const d = db();
      const wave = o.wave ? waveMembers(d, o.wave).map((b) => b.slug).filter((s) => recipeSlugs().includes(s)) : null;
      if (wave && !wave.length) throw new Error(`no business of ${o.wave} has a recipe under previews/recipes/`);
      const batches = o.batches?.split(',').map((x) => x.trim()).filter(Boolean);
      return previewBuild(d, { only: slug ?? wave?.join(',') ?? o.only, draft: o.draft, batches });
    });

  preview
    .command('data [slug]')
    .description('Gather what a page shows and prepare its photographs, without writing the pages out. Safe to run for several businesses at once.')
    .option('--only <slugs>', 'comma separated slugs')
    .option('--draft', 'work without CAL_LINK')
    .action(async (slug: string | undefined, o: { only?: string; draft?: boolean }) => void (await previewData(db(), { only: slug ?? o.only, draft: o.draft })));

  preview
    .command('variety')
    .description('Check the recipes of a wave against the variety rules: no two pages alike, businesses of one kind or place clearly different, none laid out like a wave 1 page')
    .requiredOption('--wave <name>', 'wave name')
    .action((o: { wave: string }) => {
      const plan = loadPlan();
      const made = new Set(recipeSlugs());
      const members = waveMembers(db(), o.wave).map((b) => b.slug);
      const pages = members.filter((s) => made.has(s)).map((slug) => ({ slug, groups: plan.groups[slug] ?? [], recipe: loadRecipe(slug) }));
      for (const p of pages) {
        const look = lookOf(p.recipe);
        console.log(`${p.slug}: ${look.hero}, ${look.type}, ${look.family} | ${layoutOf(p.recipe)}`);
      }
      const missing = members.filter((s) => !made.has(s));
      if (missing.length) console.log(`No recipe yet: ${missing.join(', ')}`);
      const issues = varietyIssues(pages, WAVE1_LAYOUTS);
      for (const i of issues) console.log(`PROBLEM ${i}`);
      console.log(issues.length ? `${issues.length} problem(s).` : `${pages.length} page(s), and the variety rules hold.`);
      if (issues.length) process.exitCode = 1;
    });

  preview
    .command('check')
    .description('Run the quality gates and save screenshots to previews/review/')
    .option('--only <slugs>', 'comma separated slugs')
    .option('--live', `check the pages at ${SITE_ADDRESS} rather than the local build`)
    .option('--base <url>', 'check the pages at another address')
    .option('--no-lighthouse', 'skip the speed and accessibility scores')
    .action((o: { only?: string; live?: boolean; base?: string; lighthouse?: boolean }) => previewCheck({ only: o.only, live: o.live, base: o.base, noLighthouse: o.lighthouse === false }));

  preview
    .command('deploy')
    .description('Deploy previews/out/ with vercel build and vercel deploy --prebuilt --prod')
    .option('--preview', 'deploy to a preview address and leave the live pages alone')
    .action((o: { preview?: boolean }) => previewDeploy(o));

  preview
    .command('visits')
    .description('Show who has opened their page: first and last view, view count, findings tab, reply or call')
    .option('--only <slugs>', 'comma separated slugs')
    .action((o: { only?: string }) => previewVisits(db(), o));

  preview
    .command('remove <slug>')
    .description('Take one page down and deploy the site without it')
    .option('--no-deploy', 'remove the files only')
    .action((slug: string, o: { deploy?: boolean }) => previewRemove(db(), slug, o));
}
