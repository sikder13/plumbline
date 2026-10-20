import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pLimit from 'p-limit';
import { env } from '@plumbline/core';
import { HostLimiter, Polite } from '@plumbline/fetch';
import { BOOK_DIRECT_GAP_MS } from '../discover.ts';
import { engineOf } from '../engines.ts';
import { bookingLinks } from './crawl.ts';
import { verdictOf, zeroBounceCheck, type VerifyStatus } from '../verify.ts';
import { BROWSER_GONE, Shooter } from './browser.ts';
import { checkHours, checkPhone, checkSite, notMobile, notMobileProof, type CheckId, type CheckResult, type SiteChecks } from './checks.ts';
import { sweepPaths } from './discover.ts';
import { applyLateExclusions, type Gathered } from './gather.ts';

export function loadGathered(sweep: string): Gathered[] {
  const dir = sweepPaths(sweep).sites;
  return readdirSync(dir)
    .filter((f) => f.endsWith('.gather.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as Gathered);
}

export function loadChecks(sweep: string, domain: string): SiteChecks | null {
  const f = join(sweepPaths(sweep).sites, `${domain}.checks.json`);
  return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as SiteChecks) : null;
}

const saveChecks = (sweep: string, c: SiteChecks) => writeFileSync(join(sweepPaths(sweep).sites, `${c.domain}.checks.json`), JSON.stringify(c, null, 1));

/** Stage 2: every gathered site that is not excluded, through the browser and the checks. Saved per site. */
export async function checkAll(sweep: string, opts: { browsers?: number; only?: string[]; refresh?: boolean; log?: (l: string) => void } = {}): Promise<SiteChecks[]> {
  const sp = sweepPaths(sweep);
  const log = opts.log ?? (() => undefined);
  applyLateExclusions(sweep);
  let sites = loadGathered(sweep).filter((g) => !g.excluded);
  if (opts.only) sites = sites.filter((g) => opts.only!.includes(g.domain));
  const polite = new Polite(new HostLimiter(BOOK_DIRECT_GAP_MS));
  const shooter = new Shooter(polite);
  const limit = pLimit(opts.browsers ?? 8);
  const out: SiteChecks[] = [];
  let done = 0;
  const started = Date.now();
  try {
    await Promise.all(
      sites.map((g) =>
        limit(async () => {
          const prev = opts.refresh ? null : loadChecks(sweep, g.domain);
          if (prev) {
            out.push(prev);
            done++;
            return;
          }
          // A fresh check starts from an empty picture folder, so no proof from an earlier rule lingers.
          if (opts.refresh) rmSync(join(sp.shots, g.domain), { recursive: true, force: true });
          let c: SiteChecks;
          try {
            c = await withTimeout(checkSite(g, shooter, sp.shots, sp.crawlCache), 6 * 60_000);
          } catch (e) {
            // A browser that went away (a stopped run) leaves the site unchecked, to be done on the next run.
            if (BROWSER_GONE.test((e as Error).message)) return;
            c = { domain: g.domain, checkedAt: new Date().toISOString(), home: null, homeShot: null, hasOnlineBooking: false, onlineBookingHow: '', engine: '', results: [], error: (e as Error).message.slice(0, 200) } as SiteChecks;
          }
          saveChecks(sweep, c);
          // The browser may have read contacts a plain request could not.
          if (g.readBy) writeFileSync(join(sp.sites, `${g.domain}.gather.json`), JSON.stringify(g, null, 1));
          out.push(c);
          const flags = c.results.filter((r) => r.result === 'flag').map((r) => r.check);
          done++;
          if (flags.length || done % 20 === 0) log(`[${done}/${sites.length}, ${Math.round((Date.now() - started) / 60000)} min] ${g.domain}: ${flags.join(', ') || 'no flag'}`);
        }),
      ),
    );
  } finally {
    await shooter.stop();
  }
  return out;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timed out after ${ms / 1000} s`)), ms).unref())]);
}

/** Runs named checks again on the stored reads, replacing their earlier results: hours and phone everywhere, not_mobile where it flagged. */
export async function recheckAll(sweep: string, checks: CheckId[], opts: { browsers?: number; only?: string[]; log?: (l: string) => void } = {}): Promise<number> {
  const sp = sweepPaths(sweep);
  const supported: CheckId[] = ['hours_mismatch', 'phone_mismatch', 'not_mobile'];
  const bad = checks.filter((c) => !supported.includes(c));
  if (bad.length) throw new Error(`recheck supports ${supported.join(', ')}, not ${bad.join(', ')}`);
  let sites = loadGathered(sweep).filter((g) => !g.excluded);
  if (opts.only) sites = sites.filter((g) => opts.only!.includes(g.domain));
  const shooter = new Shooter(new Polite(new HostLimiter(BOOK_DIRECT_GAP_MS)));
  const limit = pLimit(opts.browsers ?? 8);
  let n = 0;
  try {
    await Promise.all(
      sites.map((g) =>
        limit(async () => {
          const c = loadChecks(sweep, g.domain);
          if (!c?.home) return;
          // not_mobile is measured again only where it flagged: the homepage is opened once more for it.
          const nmBefore = c.results.find((r) => r.check === 'not_mobile');
          const redoNm = checks.includes('not_mobile') && (nmBefore?.result === 'flag' || nmBefore?.result === 'unproven');
          c.results = c.results.filter((r) => !checks.includes(r.check) || (r.check === 'not_mobile' && !redoNm));
          // The pictures of the checks run again go first, so a check that no longer flags leaves no proof behind.
          for (const k of checks) if (k !== 'not_mobile' || redoNm) for (const f of [`${k}.png`, `${k}-desktop.png`]) rmSync(join(sp.shots, g.domain, f), { force: true });
          if (redoNm) {
            const home = await shooter.visit(c.home.finalUrl || c.home.url, { measure: true, shot: join(sp.shots, g.domain, 'home-recheck.png') });
            const nm = home.measure ? notMobile(home.measure) : null;
            c.results.push(nm ? await notMobileProof(home, nm, shooter, join(sp.shots, g.domain)) : ({ check: 'not_mobile', result: home.measure ? 'pass' : 'unknown', evidenceUrl: home.finalUrl, http: home.measure ? `sideways ${home.measure.scrollX} px; median sentence text ${home.measure.medianFontPx} px` : (home.error ?? ''), detail: '', shot: null, more: [] } as CheckResult));
          }
          const fail = (check: CheckId) => (e: Error) => ({ check, result: 'unknown', evidenceUrl: '', http: '', detail: e.message, shot: null, more: [] }) as CheckResult;
          if (checks.includes('phone_mismatch')) c.results.push(await withTimeout(checkPhone(g, shooter, join(sp.shots, g.domain)), 4 * 60_000).catch(fail('phone_mismatch')));
          if (checks.includes('hours_mismatch')) c.results.push(await withTimeout(checkHours(g, shooter, join(sp.shots, g.domain), sp.crawlCache), 4 * 60_000).catch((e: Error) => ({ check: 'hours_mismatch', result: 'unknown', evidenceUrl: '', http: '', detail: e.message, shot: null, more: [] }) as CheckResult));
          saveChecks(sweep, c);
          n++;
          const f = c.results.filter((r) => checks.includes(r.check) && r.result === 'flag');
          if (f.length) opts.log?.(`recheck ${g.domain}: ${f.map((r) => r.check).join(', ')}`);
        }),
      ),
    );
  } finally {
    await shooter.stop();
  }
  return n;
}

const COMPETITOR_INDUSTRIES = ['allied-health', 'dental', 'hair-beauty', 'fitness'];
const RIVAL_KM = 30;

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Check 9, once every site is read: a clinic, practice, salon or studio with no online booking at all,
 * while at least two of its three nearest same-trade candidates have it. The site's contact or book
 * page is photographed with the three rivals named.
 */
export async function competitorPass(sweep: string, opts: { log?: (l: string) => void } = {}): Promise<number> {
  const sp = sweepPaths(sweep);
  const gathered = loadGathered(sweep).filter((g) => !g.excluded);
  const checks = new Map(gathered.map((g) => [g.domain, loadChecks(sweep, g.domain)]));
  const polite = new Polite(new HostLimiter(BOOK_DIRECT_GAP_MS));
  const shooter = new Shooter(polite);
  let flagged = 0;
  try {
    for (const g of gathered) {
      const c = checks.get(g.domain);
      if (!c || !c.home) continue;
      c.results = c.results.filter((r) => r.check !== 'no_online_booking_vs_competitors');
      const push = (r: Partial<CheckResult> & Pick<CheckResult, 'result'>) => c.results.push({ check: 'no_online_booking_vs_competitors', evidenceUrl: '', http: '', detail: '', shot: null, more: [], ...r });
      if (!COMPETITOR_INDUSTRIES.includes(g.candidate.industry)) push({ result: 'not_applicable' });
      else if (c.hasOnlineBooking) push({ result: 'pass', detail: `books online: ${c.onlineBookingHow}` });
      else if (!g.candidate.lat) push({ result: 'unknown', detail: 'no location on the Google listing' });
      else if (!g.homeUrl) push({ result: 'unknown', detail: 'only the homepage could be read (a plain request was refused), too little to say the site has no booking at all' });
      else if (c.home.blocked || (c.home.status !== null && [401, 403, 429].includes(c.home.status))) push({ result: 'unknown', detail: `the browser could not see the homepage (${c.home.blocked ? 'robots.txt' : `a firewall answered ${c.home.status}`})` });
      else {
        const here = { lat: Number(g.candidate.lat), lng: Number(g.candidate.lng) };
        // Rivals are the three nearest of the same trade, all within 30 km: further away is not where this customer shops.
        const peers = gathered
          .filter((x) => x.domain !== g.domain && x.candidate.industry === g.candidate.industry && x.candidate.trade === g.candidate.trade && x.candidate.lat && checks.get(x.domain)?.home)
          .map((x) => ({ x, d: km(here, { lat: Number(x.candidate.lat), lng: Number(x.candidate.lng) }), c: checks.get(x.domain)! }))
          .sort((a, b) => a.d - b.d)
          .slice(0, 3)
          .filter((p) => p.d <= RIVAL_KM);
        const withBooking = peers.filter((p) => p.c.hasOnlineBooking);
        const named = peers.map((p) => `${p.x.candidate.name} (${p.x.candidate.town}, ${p.d.toFixed(1)} km): ${p.c.hasOnlineBooking ? p.c.onlineBookingHow.split(' ').slice(0, 3).join(' ') : 'no online booking'}`);
        // A booking button a script adds shows only in the browser: the rendered homepage is read before anything is flagged.
        const rendered = peers.length >= 3 && withBooking.length >= 2 ? await shooter.visit(c.home.finalUrl || c.home.url, { html: true, frames: true }) : null;
        const late = rendered?.html ? [...bookingLinks([{ url: rendered.finalUrl, finalUrl: rendered.finalUrl, status: rendered.status, html: rendered.html, role: 'home' }]).filter((b) => !/contact|enquir|get-in-touch/i.test(b.url)), ...rendered.frames.filter((f) => engineOf(f.url))] : [];
        const walkIn = rendered?.text && /\bno bookings?\b|\bwalk[- ]?ins? only\b|\bno appointments? (?:needed|necessary|required)\b|\bwalk[- ]?in (?:grooming|service|barber|clinic) only\b/i.exec(rendered.text);
        if (walkIn) push({ result: 'not_applicable', detail: `a walk-in business: the homepage says "${walkIn[0]}"`, http: named.join(' | ') });
        else if (peers.length < 3) push({ result: 'not_applicable', detail: `fewer than three ${g.candidate.trade} candidates within ${RIVAL_KM} km`, http: named.join(' | ') });
        else if (withBooking.length < 2) push({ result: 'pass', detail: `no online booking, but ${withBooking.length} of the 3 nearest have it`, http: named.join(' | ') });
        else if (late.length) push({ result: 'pass', detail: `the homepage, once its scripts ran, has a booking link: ${'url' in late[0]! ? late[0]!.url : ''}`, http: named.join(' | ') });
        else if (!rendered?.html || (rendered.status !== null && [401, 403, 429].includes(rendered.status))) push({ result: 'unknown', detail: `the homepage could not be opened in the browser to look for a booking button (${rendered?.error ?? 'no page'})`, http: named.join(' | ') });
        else {
          const page = g.pages.find((p) => p.role === 'contact' && p.status === 200) ?? g.pages.find((p) => p.role === 'book' && p.status === 200);
          const url = page?.finalUrl ?? c.home.finalUrl;
          const dir = join(sp.shots, g.domain);
          const v = await shooter.visit(url, { shot: join(dir, 'competitor-page.png') });
          const lines = ['No online booking found on this site; nearby rivals book online', ...peers.map((p) => `${p.x.candidate.name}, ${p.d.toFixed(1)} km: ${p.c.hasOnlineBooking ? p.c.onlineBookingHow.replace(/^booking link /, 'booking link ').slice(0, 60) : 'no online booking'}`)];
          const shot = v.shot ? await shooter.write(readFileSync(v.shot), join(dir, 'no_online_booking_vs_competitors.png'), lines) : null;
          push({ result: shot ? 'flag' : 'unproven', evidenceUrl: url, http: named.join(' | '), detail: `no booking engine, widget or booking link on the ${g.pages.length + 1} pages read; ${withBooking.length} of the 3 nearest ${g.candidate.trade} candidates book online`, shot });
          if (shot) flagged++;
          opts.log?.(`competitor: ${g.domain} flagged`);
        }
      }
      saveChecks(sweep, c);
    }
  } finally {
    await shooter.stop();
  }
  return flagged;
}

export interface EmailVerdict {
  email: string;
  status: VerifyStatus;
  flags: string[];
  checkedAt: string;
}

/**
 * Single-address checks, for flagged sites only, while credits last. With none, every flagged address
 * stays at syntax and MX with `needs_verifier`. Results are cached per address.
 */
export async function verifyFlagged(sweep: string, flaggedEmails: string[], opts: { log?: (l: string) => void } = {}): Promise<{ credits: number | null; checked: number; verdicts: Map<string, EmailVerdict> }> {
  const sp = sweepPaths(sweep);
  const dir = join(sp.data, 'cache', 'zerobounce');
  const verdicts = new Map<string, EmailVerdict>();
  for (const e of flaggedEmails) {
    const f = join(dir, `${e}.json`);
    if (existsSync(f)) {
      const c = JSON.parse(readFileSync(f, 'utf8')) as Parameters<typeof verdictOf>[0];
      const v = verdictOf(c);
      verdicts.set(e, { email: e, status: v.status, flags: v.flags, checkedAt: c.checkedAt });
    }
  }
  const key = env().ZEROBOUNCE_API_KEY ?? '';
  if (!key) return { credits: null, checked: 0, verdicts };
  let credits = await (async (): Promise<number | null> => {
    try {
      const r = (await (await fetch(`https://api.zerobounce.net/v2/getcredits?api_key=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(20_000) })).json()) as { Credits?: string | number };
      return Number(r.Credits ?? 0);
    } catch {
      return null;
    }
  })();
  opts.log?.(`ZeroBounce credits: ${credits ?? 'unknown'}`);
  let checked = 0;
  for (const e of flaggedEmails) {
    if (verdicts.has(e) || !credits || credits <= 0) continue;
    const c = await zeroBounceCheck(e, key);
    if (c.error) continue;
    writeFileSync(join(dir, `${e}.json`), JSON.stringify(c, null, 1));
    const v = verdictOf(c);
    verdicts.set(e, { email: e, status: v.status, flags: v.flags, checkedAt: c.checkedAt });
    checked++;
    if (c.status !== 'unknown') credits--;
  }
  return { credits, checked, verdicts };
}
