import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Command } from 'commander';
import { db, env, nzTime, type Business, type Db } from '@plumbline/core';
import { Polite } from '@plumbline/fetch';
import { limits, spent } from '@plumbline/budget';
import { latestBatch } from '@plumbline/export';
import { BASE_PATH, LIMITS, askCorrected, buildPage, checkPage, contentDir, correctedQuestions, correctedSummary, forgetToken, planCorrected, previewPaths, readVisits, removeGenerated, serveSite, summarise, tokenFor, verifyCrawlmouse, type Dropped, type GateReport, type PageData } from '@plumbline/preview';
import { aiSummary } from '@plumbline/ai';
import { auditBatch } from './audit.ts';

function business(d: Db, slug: string): Business {
  const b = d.prepare('SELECT * FROM businesses WHERE slug = ?').get(slug) as Business | undefined;
  if (!b) throw new Error(`no business with slug ${slug}`);
  return b;
}

/** The businesses that have a preview: every folder under previews/content/ with a content file. */
export function previewSlugs(only?: string): string[] {
  if (only) return only.split(',').map((s) => s.trim()).filter(Boolean);
  if (!existsSync(previewPaths.content)) return [];
  return readdirSync(previewPaths.content, { withFileTypes: true }).filter((e) => e.isDirectory() && existsSync(join(contentDir(e.name), 'content.json'))).map((e) => e.name).sort();
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

/** Builds the data, the pages and the folder that is deployed. Everything lands under previews/out/. */
export async function previewBuild(d: Db, opts: { only?: string; draft?: boolean }): Promise<void> {
  const slugs = previewSlugs(opts.only);
  if (!slugs.length) throw new Error('no preview businesses found under previews/content/');
  const call = env().CAL_LINK;
  if (!call && !opts.draft) throw new Error('CAL_LINK is not set in .env. It holds the link behind "Book a 15 minute call". Use --draft to build without it; a draft cannot be deployed.');
  const dropped: (Dropped & { slug: string })[] = [];
  for (const slug of slugs) {
    const r = await buildPage(d, slug, { replyEmail: REPLY_EMAIL, callLink: call || `mailto:${REPLY_EMAIL}?subject=${encodeURIComponent('15 minute call')}` });
    console.log(`${slug}: /${r.data.path}/  ${r.data.findings.length} findings, ${Object.keys(r.data.images).length} images${r.dropped.length ? `, ${r.dropped.length} dropped` : ''}`);
    for (const x of r.dropped) {
      console.log(`  dropped ${x.check}: ${x.title} (${x.reason})`);
      dropped.push({ slug, ...x });
    }
    for (const w of r.warnings) console.log(`  warning ${w}`);
  }
  mkdirSync(previewPaths.out, { recursive: true });
  writeFileSync(join(previewPaths.out, 'dropped.json'), JSON.stringify(dropped, null, 2));

  const app = previewPaths.app;
  execFileSync(process.execPath, [join(app, 'scripts', 'fonts.mjs')], { cwd: app, stdio: 'inherit' });
  execFileSync(join(app, 'node_modules', '.bin', 'next'), ['build'], { cwd: app, stdio: 'inherit', env: { ...process.env, PREVIEWS_DATA: previewPaths.data, NEXT_TELEMETRY_DISABLED: '1' } });

  // The host serves the site folder as it is, so the pages sit under the same path they are reached at.
  const served = join(previewPaths.site, BASE_PATH);
  rmSync(previewPaths.site, { recursive: true, force: true });
  cpSync(join(app, 'out'), served, { recursive: true });
  const assets = join(previewPaths.out, 'assets');
  for (const page of readdirSync(previewPaths.data).map((f) => JSON.parse(readFileSync(join(previewPaths.data, f), 'utf8')) as PageData)) {
    if (existsSync(join(assets, page.path))) cpSync(join(assets, page.path), join(served, page.path), { recursive: true, filter: (from) => !from.endsWith('.made') });
    const html = join(served, page.path, 'index.html');
    writeFileSync(html, scriptsAfterPaint(readFileSync(html, 'utf8')));
  }
  writeFileSync(join(previewPaths.site, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  writeFileSync(join(previewPaths.out, 'vercel.json'), JSON.stringify(VERCEL_JSON, null, 2));
  if (opts.draft && !call) writeFileSync(draftMarker(), 'Built without CAL_LINK.\n');
  else rmSync(draftMarker(), { force: true });
  console.log(`Built ${readdirSync(previewPaths.data).length} page(s) into ${previewPaths.site}${opts.draft && !call ? ' (draft: no call link)' : ''}`);
}

function pages(only?: string): PageData[] {
  if (!existsSync(previewPaths.data)) throw new Error('nothing is built yet. Run plumb preview build.');
  const wanted = only ? new Set(only.split(',').map((x) => x.trim())) : null;
  return readdirSync(previewPaths.data).map((f) => JSON.parse(readFileSync(join(previewPaths.data, f), 'utf8')) as PageData).filter((p) => !wanted || wanted.has(p.slug));
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
    .description('Re-verify the approved findings behind every preview page')
    .option('--only <slugs>', 'comma separated slugs')
    .option('--concurrency <n>', 'sites collected at once', (v) => Number(v))
    .action((o: { only?: string; concurrency?: number }) => previewRecheck(db(), o));

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
    .command('build')
    .description('Build the pages into previews/out/ from the database and previews/content/')
    .option('--only <slugs>', 'comma separated slugs')
    .option('--draft', 'build without CAL_LINK, for looking at the pages locally')
    .action((o: { only?: string; draft?: boolean }) => previewBuild(db(), o));

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
