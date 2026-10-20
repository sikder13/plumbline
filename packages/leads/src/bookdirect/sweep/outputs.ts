import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { HostLimiter, Polite } from '@plumbline/fetch';
import { ROOT } from '@plumbline/core';
import { parseCsv } from '../../batch.ts';
import { toCsv } from '../../pull.ts';
import { nzDate } from '../contacts.ts';
import { BOOK_DIRECT_GAP_MS } from '../discover.ts';
import { hostOfUrl } from '../filters.ts';
import { Shooter } from './browser.ts';
import { CHECKS, checkLabel, flagRank, type CheckResult, type SiteChecks } from './checks.ts';
import { sweepPaths, type SweepCandidate } from './discover.ts';
import { isPlaceholderEmail, type Gathered } from './gather.ts';
import { AUDIT_VERSION, Registry } from './registry.ts';
import { LIST_INDUSTRY, relay01V2, seedRegistryFromRelay01 } from './relay01.ts';
import { loadChecks, loadGathered, verifyFlagged, type EmailVerdict } from './run.ts';

export interface DoorRow {
  domain: string;
  industry: string;
  business: string;
  town: string;
  website: string;
  flags: string;
  strongest_flag: string;
  strongest_detail: string;
  evidence_url: string;
  screenshot: string;
  emails: string;
  verify_status: string;
  phone: string;
  tel_link_status: string;
  linkedin: string;
  names: string;
  booking_engine: string;
  ota_links: string;
  google_phone: string;
  google_hours: string;
  rating: string;
  rating_count: string;
  notes: string;
}

export const FLAGGED_COLUMNS: (keyof DoorRow)[] = ['industry', 'business', 'town', 'website', 'flags', 'strongest_flag', 'strongest_detail', 'evidence_url', 'screenshot', 'emails', 'verify_status', 'phone', 'tel_link_status', 'linkedin', 'names', 'booking_engine', 'ota_links', 'google_phone', 'google_hours', 'rating', 'rating_count', 'notes', 'domain'];
export const CLEAN_COLUMNS: (keyof DoorRow)[] = ['industry', 'business', 'town', 'website', 'emails', 'verify_status', 'phone', 'tel_link_status', 'linkedin', 'names', 'booking_engine', 'ota_links', 'google_phone', 'google_hours', 'rating', 'rating_count', 'notes', 'domain'];

const ownDomain = (email: string, website: string) => {
  const d = email.split('@')[1] ?? '';
  const h = hostOfUrl(website);
  return !!d && (d === h || h.endsWith(`.${d}`) || d.endsWith(`.${h}`));
};

/** A named person's address on the business's own domain first, then the business's own domain, then the rest. */
export function orderEmails(g: Gathered): Gathered['emails'] {
  const generic = /^(?:info|admin|office|reception|hello|bookings?|reservations?|enquir\w*|contact|mail|sales|team|stay|clinic|accounts?)@/i;
  const rank = (e: Gathered['emails'][number]) => (ownDomain(e.email, g.candidate.website) ? 0 : 2) + (generic.test(e.email) ? 1 : 0) + (e.mxOk === false ? 10 : 0);
  return g.emails.filter((e) => !isPlaceholderEmail(e.email)).sort((a, b) => rank(a) - rank(b));
}

function rowOf(g: Gathered, c: SiteChecks | null, verdicts: Map<string, EmailVerdict>, flagged: CheckResult[]): DoorRow {
  const emails = orderEmails(g);
  const tel = g.phones.tel[0];
  const strongest = flagged[0];
  const notes: string[] = [];
  if (g.excluded) notes.push(`excluded: ${g.excluded}`);
  if (c?.home?.slowRender) notes.push(`slow_render: homepage took ${Math.round((c.home.loadMs ?? 0) / 1000)} s to settle`);
  for (const r of c?.results ?? []) if (r.result === 'unproven') notes.push(`unproven ${r.check}: ${r.detail}`);
  for (const r of c?.results ?? []) if (r.result === 'unknown' && r.detail) notes.push(`${r.check} unknown: ${r.detail}`);
  if (flagged.length > 1) notes.push(...flagged.slice(1).map((r) => `${r.check}: ${r.detail}`));
  const vs = emails.map((e) => {
    const v = verdicts.get(e.email);
    if (v) return `${e.email}: ${v.status}${v.flags.length ? ` (${v.flags.join(', ')})` : ''}`;
    return `${e.email}: ${e.mxOk === true ? 'mx_only' : e.mxOk === false ? `no_mail_server (${e.mxError})` : (e.mxError ?? 'not checked')}${e.mxOk === true && flagged.length ? '; needs_verifier' : ''}`;
  });
  return {
    domain: g.domain,
    industry: g.candidate.industry,
    business: g.candidate.name,
    town: g.candidate.town,
    website: g.homeUrl || g.candidate.website,
    flags: flagged.map((r) => r.check).join(';'),
    strongest_flag: strongest?.check ?? '',
    strongest_detail: strongest?.detail ?? '',
    evidence_url: strongest?.evidenceUrl ?? '',
    screenshot: strongest?.shot ? relative(ROOT, strongest.shot) : '',
    emails: emails.map((e) => `${e.email} (${e.on}, ${g.seenOn})`).join('; '),
    verify_status: vs.join('; '),
    phone: [...new Set(g.phones.shown.map((p) => p.shown))].slice(0, 3).join(', '),
    tel_link_status: tel ? `tel link (${tel.shown}) on ${tel.on}` : g.phones.shown.length ? 'number shown, no tel link on the pages read' : 'no number and no tel link found',
    linkedin: g.linkedin.map((l) => `${l.url} (${l.on})`).join('; '),
    names: g.names.map((n) => `${n.name} (${n.role}; ${n.url})`).join(' | '),
    booking_engine: c ? c.engine || (c.onlineBookingHow ? c.onlineBookingHow : 'none found') : g.engines.join(';'),
    ota_links: g.ota.map((o) => o.url).join(' '),
    google_phone: g.candidate.phone,
    google_hours: g.candidate.hours,
    rating: String(g.candidate.rating ?? ''),
    rating_count: String(g.candidate.rating_count ?? ''),
    notes: notes.join(' | '),
  };
}

export interface DoorSweepSummary {
  sweep: string;
  discovered: Record<string, number>;
  skippedByRegistry: number;
  gathered: Record<string, number>;
  excluded: Record<string, number>;
  homeUnread: Record<string, number>;
  checked: Record<string, number>;
  contact: { sites: number; withEmail: number; withTel: number; withLinkedin: number; withNamedPerson: number };
  flags: Record<string, number>;
  unproven: Record<string, number>;
  unknown: Record<string, number>;
  flaggedSites: number;
  flaggedByIndustry: Record<string, number>;
  slowRenders: number;
  requests: { pages: number; bookingFollows: number; browserVisits: number };
  zeroBounce: { credits: number | null; checked: number };
  sheets: string[];
  relay01: { sites: number; wouldFlag: Record<string, number>; anyWouldFlag: number };
  top20: { business: string; town: string; industry: string; flag: string; evidence: string; email: string; detail: string; shot: string }[];
}

const inc = (o: Record<string, number>, k: string, n = 1) => (o[k] = (o[k] ?? 0) + n);

/** Stage 3: the files UD reads. Nothing here opens a business's site except to photograph the contact sheets' sources, which are already on disk. */
export async function writeSweepOutputs(sweep: string, opts: { log?: (l: string) => void } = {}): Promise<DoorSweepSummary> {
  const sp = sweepPaths(sweep);
  const log = opts.log ?? (() => undefined);
  const gathered = loadGathered(sweep);
  const cands = parseCsv(readFileSync(join(sp.dir, '_candidates.csv'), 'utf8')) as unknown as SweepCandidate[];
  const pool = existsSync(join(sp.dir, '_pool.csv')) ? (parseCsv(readFileSync(join(sp.dir, '_pool.csv'), 'utf8')) as unknown as SweepCandidate[]) : [];
  const checks = new Map(gathered.map((g) => [g.domain, loadChecks(sweep, g.domain)]));
  const flaggedOf = (g: Gathered) => (checks.get(g.domain)?.results ?? []).filter((r) => r.result === 'flag').sort((a, b) => flagRank(a) - flagRank(b));

  // Single-address checks for flagged sites only.
  const flaggedEmails = gathered.filter((g) => flaggedOf(g).length).flatMap((g) => orderEmails(g).filter((e) => e.mxOk).map((e) => e.email));
  const zb = await verifyFlagged(sweep, [...new Set(flaggedEmails)], { log });

  const flaggedRows: { row: DoorRow; rank: number; g: Gathered; top: CheckResult }[] = [];
  const cleanRows: DoorRow[] = [];
  const s: DoorSweepSummary = { sweep, discovered: {}, skippedByRegistry: pool.filter((r) => r.reason === 'in_registry').length, gathered: {}, excluded: {}, homeUnread: {}, checked: {}, contact: { sites: 0, withEmail: 0, withTel: 0, withLinkedin: 0, withNamedPerson: 0 }, flags: {}, unproven: {}, unknown: {}, flaggedSites: 0, flaggedByIndustry: {}, slowRenders: 0, requests: { pages: 0, bookingFollows: 0, browserVisits: 0 }, zeroBounce: { credits: zb.credits, checked: zb.checked }, sheets: [], relay01: { sites: 0, wouldFlag: {}, anyWouldFlag: 0 }, top20: [] };
  for (const c of cands) inc(s.discovered, c.industry);
  const registry = new Registry();
  seedRegistryFromRelay01(registry);
  const today = nzDate();
  for (const g of gathered) {
    const ind = g.candidate.industry;
    inc(s.gathered, ind);
    s.requests.pages += g.homeTries.length + g.pages.length;
    s.requests.bookingFollows += g.follows.filter((f) => !g.pages.some((p) => p.url === f.url) && f.error !== 'robots').length;
    if (g.excluded) inc(s.excluded, g.excluded.split(':')[0]!.split(' (')[0]!);
    if (!g.homeUrl) inc(s.homeUnread, ind);
    const c = checks.get(g.domain);
    const flagged = flaggedOf(g);
    if (c?.home) inc(s.checked, ind);
    if (c?.home?.slowRender) s.slowRenders++;
    if (!g.excluded && c?.home) {
      s.contact.sites++;
      if (g.emails.length) s.contact.withEmail++;
      if (g.phones.tel.length) s.contact.withTel++;
      if (g.linkedin.length) s.contact.withLinkedin++;
      if (g.names.length) s.contact.withNamedPerson++;
    }
    for (const r of c?.results ?? []) {
      if (r.result === 'flag') inc(s.flags, r.check);
      if (r.result === 'unproven') inc(s.unproven, r.check);
      if (r.result === 'unknown') inc(s.unknown, r.check);
    }
    const shotsDir = join(sp.shots, g.domain);
    if (existsSync(shotsDir)) s.requests.browserVisits += readdirSync(shotsDir).filter((f) => /^(?:home|.*-page|booking_link_broken|main_nav_404|main_nav_404-menu)\.png$/.test(f)).length;
    const row = rowOf(g, c ?? null, zb.verdicts, flagged);
    if (flagged.length) {
      s.flaggedSites++;
      inc(s.flaggedByIndustry, ind);
      flaggedRows.push({ row, rank: flagRank(flagged[0]!), g, top: flagged[0]! });
    } else cleanRows.push(row);
    const outcome = g.excluded ? `excluded: ${g.excluded}` : !c?.home ? `not checked: ${(c as { error?: string } | null)?.error ?? g.homeError ?? 'no browser visit'}` : flagged.length ? `flagged (unchecked): ${flagged.map((r) => r.check).join(';')}` : 'clean';
    registry.record({ domain: g.domain, business: g.candidate.name, industry: ind, first_audited: g.seenOn, last_audited: today, audit_version: String(AUDIT_VERSION), outcome });
  }
  flaggedRows.sort((a, b) => a.rank - b.rank || a.row.industry.localeCompare(b.row.industry) || a.row.business.localeCompare(b.row.business));
  writeFileSync(join(sp.dir, 'FLAGGED.csv'), toCsv(flaggedRows.map((x) => x.row), FLAGGED_COLUMNS));
  writeFileSync(join(sp.dir, 'CLEAN.csv'), toCsv(cleanRows.sort((a, b) => a.industry.localeCompare(b.industry) || a.business.localeCompare(b.business)), CLEAN_COLUMNS));

  // Relay 01's sites, checked again from the cache and marked version 2.
  const r01 = await relay01V2();
  writeFileSync(join(sp.data, 'registry', 'relay01-v2.csv'), toCsv(r01, ['domain', 'business', 'industry', 'wouldFlag', 'detail', 'notApplicable']));
  s.relay01.sites = r01.length;
  for (const r of r01) {
    for (const f of r.wouldFlag.split(';').filter(Boolean)) inc(s.relay01.wouldFlag, f);
    if (r.wouldFlag) s.relay01.anyWouldFlag++;
    const prev = registry.get(r.domain);
    registry.record({ domain: r.domain, business: r.business, industry: r.industry || LIST_INDUSTRY[r.industry] || '', first_audited: prev?.first_audited, last_audited: today, audit_version: String(AUDIT_VERSION), outcome: `${prev?.outcome?.split(' | v2')[0] ?? 'relay 01'} | v2 from cache: ${r.wouldFlag ? `unproven ${r.wouldFlag} (no picture without fetching again)` : 'nothing found on the checks the cache allows'}` });
  }
  registry.save();

  s.top20 = flaggedRows.slice(0, 20).map((x) => ({ business: x.row.business, town: x.row.town, industry: x.row.industry, flag: x.top.check, evidence: x.top.evidenceUrl, email: x.row.verify_status.split('; ')[0] ?? 'no email', detail: x.top.detail, shot: x.row.screenshot }));

  // Contact sheets: the strongest flag of every flagged site, twenty to a sheet.
  const out = sp.previews;
  mkdirSync(out, { recursive: true });
  for (const f of readdirSync(out).filter((f) => f.startsWith(`sweep-${sweep}-flags`))) rmSync(join(out, f));
  const polite = new Polite(new HostLimiter(BOOK_DIRECT_GAP_MS));
  const shooter = new Shooter(polite);
  try {
    for (let i = 0, n = 1; i < flaggedRows.length; i += 20, n++) {
      const part = flaggedRows.slice(i, i + 20);
      const file = join(out, `sweep-${sweep}-flags-${String(n).padStart(2, '0')}.jpg`);
      await shooter.sheet(
        part.map((x, k) => ({ file: x.top.shot ?? '', label: [`${i + k + 1}. ${x.row.business}`, `${x.row.town} · ${x.row.industry}`, checkLabel(x.top.check)] })),
        file,
        `Book Direct sweep ${sweep}: flagged, unchecked. Sheet ${n} of ${Math.ceil(flaggedRows.length / 20)} (${i + 1} to ${i + part.length} of ${flaggedRows.length}), strongest flag first`,
      );
      s.sheets.push(relative(ROOT, file));
    }
  } finally {
    await shooter.stop();
  }
  writeFileSync(join(sp.dir, 'README.md'), sweepReadme(sweep, s));
  writeFileSync(join(sp.dir, '_summary.json'), JSON.stringify(s, null, 1));
  return s;
}

export function sweepReadme(sweep: string, s: DoorSweepSummary): string {
  const checks = CHECKS.map((c) => `- \`${c}\`: ${checkLabel(c)}. ${s.flags[c] ?? 0} flagged, ${s.unproven[c] ?? 0} unproven, ${s.unknown[c] ?? 0} unknown.`).join('\n');
  return `# Book Direct sweep ${sweep}

Every row here is **flagged, unchecked**: not a lead. UD and Claude look at the screenshots before any number is spoken.

## Files

- \`FLAGGED.csv\`: one row per site with at least one flag, strongest flag first. \`screenshot\` is the proof of the strongest flag; every other flag's picture is in the same folder under \`shots/<domain>/<check>.png\`, and \`notes\` lists the other flags, any unproven ones and slow renders.
- \`CLEAN.csv\`: sites read with no flag. Not leads today; they are the registry's record of what was found.
- \`shots/<domain>/\`: \`home.png\` is the homepage at 390 x 844 after it loaded (network idle, then 3 seconds; up to 60 seconds). \`<check>.png\` is the proof of each flag, with the evidence written above the page. \`main_nav_404-menu.png\` shows the menu item on the desktop layout. \`*-page.png\` are the raw pictures the proofs were made from.
- \`sites/<domain>.gather.json\` (what was read: pages and their HTTP answers, booking links followed, addresses and their mail servers, phones, LinkedIn, names) and \`sites/<domain>.checks.json\` (each check's result, evidence URL, HTTP evidence and detail).
- \`_candidates.csv\` (the 1,000 from Google Places, with their Google phone and hours), \`_pool.csv\` (every place seen and why it was or was not kept), \`_discover.json\`, \`_summary.json\`, \`_places_calls.jsonl\`.
- \`../../registry/audited.csv\`: every site the campaign has crawled, never deleted from. \`../../registry/relay01-v2.csv\`: relay 01's 240 sites checked again from the cache.
- Contact sheets: \`previews/review/book-direct/sweep-${sweep}-flags-NN.jpg\`, twenty sites a sheet, strongest flag first, numbered as in FLAGGED.csv.

## The ten checks

${checks}

A flag needs a picture: a check that found something but could not photograph it is \`unproven\` and is not counted. \`unknown\` means the check could not be run (robots.txt, a firewall that refused us, no hours to compare).

## What to check by hand

1. Open each contact sheet. For every tile, say yes or no: would the owner see this on their own phone in ten seconds and be embarrassed by it?
2. \`phone_mismatch\`: a business may list a second number, a mobile or a call-tracking number on Google on purpose. Look at both numbers before calling it a mistake.
3. \`hours_mismatch\`: holiday hours, seasonal hours and kitchen-versus-bar hours can look like a contradiction. The picture shows the hours the site gives; the Google hours are in the note above it.
4. \`not_secure\` on a plain-http site is real in Chrome, but campaign rule: SSL alone was hygiene in relay 01. Decide whether it stays a flag.
5. \`booking_link_broken\` and \`main_nav_404\`: open the evidence URL on a phone. A site fixed since the sweep drops out.
6. Emails: every address is from the business's own site with its page and the date seen. Flagged sites' addresses are \`needs_verifier\` unless ZeroBounce had credits (it had ${s.zeroBounce.credits ?? 'unknown'}).
`;
}
