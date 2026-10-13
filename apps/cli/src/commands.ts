import { rmSync } from 'node:fs';
import { join } from 'node:path';
import pLimit from 'p-limit';
import { env, paths, type Business, type Db } from '@plumbline/core';
import { aiSummary, indexMentions, openAiAsk, perplexityAsk, plan, runPlan, type AiPlan } from '@plumbline/ai';
import { brandDir, captureBrand, saveBrandPack, voiceSamples, type BrandCapture } from '@plumbline/brand';
import { limits, loadPrices, spendByProvider, spent } from '@plumbline/budget';
import { CHECK_IDS, applyCheckToStoredRuns, homepageWords, type HomepageWords } from '@plumbline/checks';
import { loadSite } from '@plumbline/collect';
import { loadLibrary } from '@plumbline/impact';
import { contactReady, findContacts, openAiPeopleModel } from '@plumbline/contacts';
import { TOURISM_ACTIVITIES, TOURISM_EXTRA_ACTIVITIES, discover, qualify } from '@plumbline/discover';
import { Polite } from '@plumbline/fetch';
import { Renderer } from '@plumbline/render';
import { batchMembers } from './audit.ts';
import { parseCsv } from './csv.ts';
import { rank } from './select.ts';

export async function discoverCommand(db: Db, opts: { extra?: boolean; max?: number }): Promise<void> {
  const r = await discover(db, { activities: opts.extra ? TOURISM_EXTRA_ACTIVITIES : TOURISM_ACTIVITIES, maxQueries: opts.max, totalCap: opts.extra ? 300 : undefined });
  console.log(`Discovery: ${r.queries} queries run, ${r.skipped} already done, ${r.added} new businesses, ${r.matchedExisting} matched to known ones, ${r.duplicates} duplicates. Stopped: ${r.stoppedBy}.`);
}

export async function qualifyCommand(db: Db): Promise<void> {
  const r = await qualify(db, new Polite());
  console.log(`Qualified ${r.qualified}.`);
  for (const [reason, n] of Object.entries(r.excluded).sort((a, b) => b[1] - a[1])) console.log(`  excluded ${n}: ${reason}`);
  const total = db.prepare("SELECT COUNT(*) AS n FROM businesses WHERE status = 'qualified'").get() as { n: number };
  console.log(`Qualified in total: ${total.n}.`);
}

/** Contacts from the supplied research. They keep their source and are never marked confirmed here. */
export function importResearchContacts(db: Db): number {
  const rows = db.prepare("SELECT id, seed FROM businesses WHERE source IN ('seed20', 'master76') AND seed IS NOT NULL").all() as { id: number; seed: string }[];
  const ins = db.prepare('INSERT INTO contacts (business_id, role, name, name_confirmed, title, email, email_source_url, phone, contact_form_url, source_url, source_quote, captured_at) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)');
  let n = 0;
  db.transaction(() => {
    for (const row of rows) {
      const s = JSON.parse(row.seed) as Record<string, string>;
      db.prepare("DELETE FROM contacts WHERE business_id = ? AND source_quote LIKE 'input research:%'").run(row.id);
      const at = new Date().toISOString();
      const email = /[^\s;,()]+@[^\s;,()]+\.[a-z]{2,}/i.exec(s.email ?? '')?.[0];
      const emailSource = /https?:\/\/[^\s;,)]+/.exec(s.email_source_url ?? '')?.[0] ?? null;
      // An email from research is kept only when the research says where it is published.
      if (email && emailSource) {
        ins.run(row.id, 'general', null, null, email.toLowerCase(), emailSource, s.phone || null, /https?:\/\/\S+/.exec(s.contact_form_url ?? '')?.[0] ?? null, emailSource, `input research: ${(s.email_source_url ?? '').slice(0, 200)}`, at);
        n += 1;
      }
      if (s.owner_names && !/^(unconfirmed|unknown|not found|none)/i.test(s.owner_names)) {
        // Only the list of names before the first full stop is read. Notes after it ("Site photo caption: ...") are not owners.
        const names = s.owner_names.replace(/\(.*?\)/g, ' ').split(/\.\s/)[0]!.split(/;|\band\b|&|,/).map((x) => x.replace(/\s+/g, ' ').replace(/\.$/, '').trim()).filter((x) => /^[A-ZĀĒĪŌŪ][\p{L}'’.-]+(?: [A-ZĀĒĪŌŪ][\p{L}'’.-]+){0,3}$/u.test(x));
        for (const [i, name] of names.slice(0, 2).entries()) {
          ins.run(row.id, i === 0 ? 'owner' : 'second', name, i === 0 ? 'owner' : 'co-owner', null, null, null, null, /https?:\/\/[^\s;,)]+/.exec(s.owner_source_url ?? '')?.[0] ?? null, `input research: ${s.owner_names.slice(0, 200)}`, at);
          n += 1;
        }
      }
    }
  })();
  return n;
}

export async function contactsCommand(db: Db, opts: { only?: string; concurrency?: number; force?: boolean; limit?: number }): Promise<void> {
  if (!env().NZBN_API_KEY) console.log('NZBN_API_KEY is not set: the register lookup is skipped, so no name is marked confirmed.');
  console.log(`Imported ${importResearchContacts(db)} contacts from the supplied research.`);
  let todo = db.prepare("SELECT * FROM businesses WHERE status = 'qualified' AND website IS NOT NULL").all() as Business[];
  if (opts.only) todo = todo.filter((b) => opts.only!.split(',').includes(b.slug));
  // With a limit, the businesses most likely to go into a batch are read first: the same order the batch is chosen in.
  if (opts.limit !== undefined) todo = rank(todo, opts.limit);
  if (!opts.force) todo = todo.filter((b) => !db.prepare('SELECT 1 FROM consent_checks WHERE business_id = ?').get(b.id));
  const polite = new Polite();
  const renderer = new Renderer(polite);
  await renderer.start();
  const model = openAiPeopleModel();
  const counts: Record<string, number> = {};
  const limit = pLimit(opts.concurrency ?? 6);
  let n = 0;
  await Promise.all(
    todo.map((b) =>
      limit(async () => {
        try {
          const r = await findContacts(db, polite, renderer, b, { model, log: console.log });
          counts[r.outcome] = (counts[r.outcome] ?? 0) + 1;
          if (++n % 10 === 0 || n === todo.length) console.log(`[${n}/${todo.length}] ${b.slug}: ${r.outcome}, ${r.emails.length} emails, ${r.people.length} people`);
        } catch (e) {
          counts.error = (counts.error ?? 0) + 1;
          console.log(`[${++n}/${todo.length}] ${b.slug}: error ${(e as Error).message.slice(0, 120)}`);
        }
      }),
    ),
  );
  await renderer.stop();
  const ready = (db.prepare("SELECT id FROM businesses WHERE status = 'qualified'").all() as { id: number }[]).filter((b) => contactReady(db, b.id)).length;
  console.log(`Contacts: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ') || 'nothing to do'}. Ready for audit: ${ready}.`);
}

/** Qualified businesses that passed the consent check and have an email or a contact form. */
export function readyBusinesses(db: Db): Business[] {
  return (db.prepare("SELECT * FROM businesses WHERE status IN ('qualified', 'audited') AND website IS NOT NULL ORDER BY id").all() as Business[]).filter((b) => contactReady(db, b.id));
}

/** What a business's homepage says, from the newest run that read it. */
export function storedHomepage(db: Db, businessId: number): HomepageWords | null {
  const runs = db.prepare("SELECT id FROM runs WHERE business_id = ? AND status = 'done' ORDER BY id DESC LIMIT 5").all(businessId) as { id: number }[];
  for (const r of runs) {
    const home = loadSite(r.id)?.homepage;
    const page = home?.desktop?.ok ? home.desktop : home?.mobile?.ok ? home.mobile : null;
    if (page) return homepageWords(page);
  }
  return null;
}

export function describePlan(p: AiPlan): string {
  const lim = limits();
  return [
    `Businesses covered: ${p.businesses} (only those that passed contacts and the consent check)`,
    `Questions: ${p.shared} shared by town and activity, ${p.brand} about single businesses`,
    `Answers wanted: ${p.callsPerProvider} per provider, 3 runs per question; ${p.cached} already stored and reused`,
    `To ask now: ${p.toRun.filter((t) => t.provider === 'openai').length} OpenAI at about $${p.perCall.openai.toFixed(4)} each = $${p.estimateUsd.openai.toFixed(2)}`,
    `            ${p.toRun.filter((t) => t.provider === 'perplexity').length} Perplexity at about $${p.perCall.perplexity.toFixed(4)} each = $${p.estimateUsd.perplexity.toFixed(2)}`,
    `Estimate for this run: $${p.totalUsd.toFixed(2)}`,
    `Ask line $${lim.askAbove.toFixed(2)}, hard total $${lim.total.toFixed(2)}`,
  ].join('\n');
}

export async function aiCommand(db: Db, opts: { batch: string; estimate?: boolean; brand?: number; approvedAboveAsk?: boolean; limit?: number; provider?: string; pass?: number }): Promise<void> {
  const members = new Set(batchMembers(db, opts.batch).map((b) => b.id));
  const businesses = readyBusinesses(db).filter((b) => members.size === 0 || members.has(b.id));
  const providers = opts.provider ? ([opts.provider] as ('openai' | 'perplexity')[]) : undefined;
  const p = plan(db, { homepage: (b) => storedHomepage(db, b.id), businesses, batch: opts.batch, brandQuestions: opts.brand ?? 2, providers, pass: opts.pass === 1 || opts.pass === 2 ? opts.pass : undefined });
  if (opts.limit !== undefined) p.toRun = p.toRun.slice(0, opts.limit);
  const already = spent(db);
  console.log(describePlan(p));
  for (const u of p.unasked) console.log(`  ${u.slug}: ${u.reason}`);
  console.log(`Spent so far: $${already.toFixed(2)}. After this run: about $${(already + p.totalUsd).toFixed(2)}.`);
  if (opts.estimate) return;
  if (!p.toRun.length) {
    console.log(`Nothing to ask. Indexed ${indexMentions(db, opts.batch)} mentions.`);
    return;
  }
  const lim = limits();
  if (opts.limit === undefined && already + p.totalUsd > lim.total) throw new Error(`Refused: the estimate would pass the hard total of $${lim.total.toFixed(2)}.`);
  if (opts.limit === undefined && already + p.totalUsd > lim.askAbove && !opts.approvedAboveAsk) throw new Error(`Stopped to ask: the estimate would pass the ask line of $${lim.askAbove.toFixed(2)}.`);
  const prices = loadPrices();
  const r = await runPlan(db, p, { asks: { openai: openAiAsk(prices), perplexity: perplexityAsk(prices) }, approvedAboveAsk: opts.approvedAboveAsk });
  console.log(`Asked ${r.asked}, failed ${r.failed}, cost $${r.spentUsd.toFixed(4)}.${r.stopped ? ` Stopped: ${r.stopped.message}` : ''}`);
  console.log(`Indexed ${indexMentions(db, opts.batch)} mentions.`);
}

/** Captures the brand pack for businesses in a batch that do not have one yet. */
export async function brandCommand(db: Db, opts: { batch: string; force?: boolean }): Promise<void> {
  const todo = batchMembers(db, opts.batch).filter((b) => b.website && (opts.force || !db.prepare('SELECT 1 FROM brand_packs WHERE business_id = ?').get(b.id)));
  const polite = new Polite();
  const renderer = new Renderer(polite);
  await renderer.start();
  const limit = pLimit(4);
  let done = 0;
  await Promise.all(
    todo.map((b) =>
      limit(async () => {
        const parts: Partial<Record<'mobile' | 'desktop', BrandCapture>> = {};
        const pages = [];
        for (const viewport of ['desktop', 'mobile'] as const) {
          const cap = await renderer.render({ url: b.website!, viewport, onPage: async (page) => void (parts[viewport] = await captureBrand(page, viewport, brandDir(b.slug))) });
          if (cap.ok) pages.push(cap);
        }
        if (parts.desktop || parts.mobile) {
          saveBrandPack(db, b.id, parts.desktop ?? null, parts.mobile ?? null, voiceSamples(pages));
          done += 1;
        }
      }),
    ),
  );
  await renderer.stop();
  console.log(`Brand packs captured: ${done} of ${todo.length} still missing in ${opts.batch}.`);
}

/** Runs one check over the stored runs of a batch. Nothing is fetched. */
export async function evaluateStoredCommand(db: Db, opts: { batch: string; check: string }): Promise<void> {
  const library = loadLibrary(CHECK_IDS);
  const run = db.prepare("SELECT id FROM runs WHERE business_id = ? AND batch = ? AND kind = ? AND status = 'done' ORDER BY id DESC LIMIT 1");
  let candidates = 0;
  let reproduced = 0;
  const fired: string[] = [];
  for (const b of batchMembers(db, opts.batch)) {
    const a = run.get(b.id, opts.batch, 'A') as { id: number } | undefined;
    const second = run.get(b.id, opts.batch, 'B') as { id: number } | undefined;
    const r = await applyCheckToStoredRuns(db, library, opts.check, opts.batch, a ? loadSite(a.id) : null, second ? loadSite(second.id) : null);
    candidates += r.candidates;
    reproduced += r.reproduced;
    if (db.prepare('SELECT 1 FROM findings WHERE business_id = ? AND batch = ? AND check_id = ?').get(b.id, opts.batch, opts.check)) fired.push(b.slug);
  }
  console.log(`${opts.check} on ${opts.batch}: ${candidates} new candidate(s), ${reproduced} reproduced. Fires for: ${fired.join(', ') || 'no business'}.`);
}

export function costCommand(db: Db): void {
  const lim = limits();
  console.log('provider        calls   estimated     actual');
  for (const r of spendByProvider(db)) console.log(`${r.provider.padEnd(14)} ${String(r.calls).padStart(6)}  $${r.estimated.toFixed(4).padStart(9)}  $${r.actual.toFixed(4).padStart(9)}`);
  console.log(`Total spent: $${spent(db).toFixed(4)}. Ask line $${lim.askAbove.toFixed(2)}, hard total $${lim.total.toFixed(2)}.`);
}

/** Deletes everything held about one business: rows, captures, evidence, brand files and exports. */
export function purgeCommand(db: Db, slug: string): void {
  const b = db.prepare('SELECT id FROM businesses WHERE slug = ?').get(slug) as { id: number } | undefined;
  if (!b) throw new Error(`no business with slug ${slug}`);
  const runs = db.prepare('SELECT id FROM runs WHERE business_id = ?').all(b.id) as { id: number }[];
  for (const r of runs) rmSync(join(paths.captures, String(r.id)), { recursive: true, force: true });
  rmSync(join(paths.evidence, slug), { recursive: true, force: true });
  rmSync(brandDir(slug), { recursive: true, force: true });
  rmSync(join(paths.exports, slug), { recursive: true, force: true });
  db.prepare('DELETE FROM businesses WHERE id = ?').run(b.id);
  console.log(`Purged ${slug}: ${runs.length} runs and all files.`);
}

export { aiSummary, parseCsv };
