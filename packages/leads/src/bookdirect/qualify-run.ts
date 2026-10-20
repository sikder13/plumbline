import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pLimit from 'p-limit';
import { env, requireEnv, slugify } from '@plumbline/core';
import { HostLimiter, Polite } from '@plumbline/fetch';
import { Renderer } from '@plumbline/render';
import { parseCsv } from '../batch.ts';
import { CallLedger, QuotaStop } from '../enrich.ts';
import { toCsv } from '../pull.ts';
import { bookControlsInFold, type AuditRecord } from './audit.ts';
import { findingsOf, leadFindings } from './classes.ts';
import type { ContactRow } from './contacts.ts';
import { BOOK_DIRECT_GAP_MS, PLACES_CAP, bookDirectPaths, type CandidateRow } from './discover.ts';
import { hostIn, hostOfUrl, loadDiscoverConfig, priorContactReason } from './filters.ts';
import { loadPriorContact } from './prior.ts';
import { excludedType, qualifyReason, roomToSell, type QualifyInput } from './qualify.ts';
import { leadsReadme } from './readme.ts';
import { verdictOf, zeroBounceCheck, type SingleCheck, type VerifyStatus } from './verify.ts';

export const QUALIFIED_COLUMNS = ['list', 'business', 'town', 'website', 'email', 'email_source_url', 'email_seen_on', 'verify_status', 'greeting_names', 'booking_engine', 'booking_url', 'ota_links', 'lead_finding', 'lead_value', 'lead_evidence_url', 'second_finding', 'lcp_mobile_s', 'first_screen_cta', 'competitors_book_online', 'rating', 'rating_count', 'score', 'flags'] as const;

interface Competitor {
  name: string;
  website: string;
  bookOnFirstScreen: boolean | null;
  how: string;
}

function readRecords(): Map<string, AuditRecord> {
  const dir = join(bookDirectPaths().data, 'audit');
  const out = new Map<string, AuditRecord>();
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const r = JSON.parse(readFileSync(join(dir, f), 'utf8')) as AuditRecord;
    // The tiers are applied again to the stored measurements, so a rule corrected after a lead was audited still counts.
    r.findings = findingsOf(r.facts);
    out.set(r.slug, r);
  }
  return out;
}

/** Credits left on the ZeroBounce account. The key is never printed. */
async function zeroBounceCredits(key: string): Promise<number> {
  try {
    const r = await fetch(`https://api.zerobounce.net/v2/getcredits?api_key=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(20_000) });
    const j = (await r.json()) as { Credits?: string | number };
    return Number(j.Credits ?? 0);
  } catch {
    return 0;
  }
}

/**
 * Three same-town clinics for an allied health lead, from the candidates file first (one extra
 * Places search for the town when there are fewer than three), and whether each shows a Book
 * control on the first phone screen.
 */
async function competitorsFor(lead: ContactRow, cands: CandidateRow[], records: Map<string, AuditRecord>, deps: { renderer: Renderer; ledger: CallLedger; cacheDir: string; directories: string[]; renderLimit: <T>(fn: () => Promise<T>) => Promise<T> }): Promise<Competitor[]> {
  const town = lead.town.toLowerCase();
  const own = hostOfUrl(lead.website);
  const pool = cands.filter((c) => c.list === 'B' && c.town.toLowerCase() === town && hostOfUrl(c.website) !== own);
  // Clinics already measured tonight first.
  pool.sort((a, b) => Number(records.has(b.slug)) - Number(records.has(a.slug)) || Number(b.rating_count) - Number(a.rating_count));
  const picked: { name: string; website: string; slug?: string }[] = pool.slice(0, 3).map((c) => ({ name: c.name, website: c.website, slug: c.slug }));
  if (picked.length < 3) {
    const file = join(deps.cacheDir, `town-${slugify(lead.town)}.json`);
    let places: { displayName?: { text: string }; websiteUri?: string; businessStatus?: string }[] = [];
    if (existsSync(file)) places = (JSON.parse(readFileSync(file, 'utf8')) as { places?: typeof places }).places ?? [];
    else {
      try {
        deps.ledger.take('competitors', lead.town);
        const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': requireEnv('GOOGLE_MAPS_API_KEY'), 'x-goog-fieldmask': 'places.id,places.displayName,places.websiteUri,places.businessStatus' },
          body: JSON.stringify({ textQuery: `physiotherapy in ${lead.town}, New Zealand`, pageSize: 10, regionCode: 'NZ', languageCode: 'en' }),
          signal: AbortSignal.timeout(30_000),
        });
        const j = (await res.json()) as { places?: typeof places };
        writeFileSync(file, JSON.stringify(j, null, 1));
        places = j.places ?? [];
      } catch (e) {
        if (!(e instanceof QuotaStop)) throw e;
      }
    }
    for (const pl of places) {
      if (picked.length >= 3) break;
      const h = hostOfUrl(pl.websiteUri);
      if (!h || h === own || pl.businessStatus !== 'OPERATIONAL' || hostIn(h, deps.directories) || picked.some((x) => hostOfUrl(x.website) === h)) continue;
      picked.push({ name: pl.displayName?.text ?? h, website: pl.websiteUri! });
    }
  }
  const out: Competitor[] = [];
  for (const c of picked) {
    const rec = c.slug ? records.get(c.slug) : undefined;
    if (rec && rec.facts.firstScreen.checked) {
      out.push({ name: c.name, website: c.website, bookOnFirstScreen: rec.bookOnFirstScreen, how: 'audited tonight' });
      continue;
    }
    const file = join(deps.cacheDir, `${hostOfUrl(c.website)}.json`);
    if (existsSync(file)) {
      out.push(JSON.parse(readFileSync(file, 'utf8')) as Competitor);
      continue;
    }
    const comp = await deps.renderLimit(async () => {
      const cap = await deps.renderer.render({ url: c.website, viewport: 'mobile' }).catch(() => null);
      return { name: c.name, website: c.website, bookOnFirstScreen: cap?.ok ? bookControlsInFold(cap).length > 0 : null, how: cap?.ok ? 'first phone screen read' : `not read (${cap?.blocked ?? cap?.error ?? 'error'})` };
    });
    writeFileSync(file, JSON.stringify(comp));
    out.push(comp);
  }
  return out;
}

export interface Funnel {
  list: string;
  placesFound: number;
  withOwnWebsite: number;
  candidates: number;
  siteRead: number;
  withPublishedEmail: number;
  emailVerified: number;
  audited: number;
  withLeadFinding: number;
  qualified: number;
}

export interface QualifySummary {
  funnels: Funnel[];
  qualified: number;
  zeroBounce: { creditsBefore: number; checked: number; fromCache: number; results: Record<string, number> };
  competitorRenders: number;
  placesCalls: number;
  findingMix: Record<string, number>;
  engineMix: Record<string, number>;
  needsVerifier: number;
  notMeasured: number;
  lighthouse: { leadsMeasured: number; pagesMeasured: number; runs: number };
}

export async function qualifyAll(opts: { zeroBounceMax?: number; log?: (l: string) => void } = {}): Promise<QualifySummary> {
  const p = bookDirectPaths();
  const log = opts.log ?? (() => undefined);
  const cfg = loadDiscoverConfig();
  const prior = loadPriorContact(cfg.priorContact);
  const cands = parseCsv(readFileSync(join(p.leads, '_candidates.csv'), 'utf8')) as unknown as CandidateRow[];
  const byslug = new Map(cands.map((c) => [c.slug, c]));
  const contacts = parseCsv(readFileSync(join(p.leads, '_contacts.csv'), 'utf8')) as unknown as ContactRow[];
  const records = readRecords();
  const cacheDir = join(p.data, 'cache', 'competitors');
  const zbDir = join(p.data, 'cache', 'zerobounce');
  mkdirSync(cacheDir, { recursive: true });
  mkdirSync(zbDir, { recursive: true });
  const ledger = new CallLedger(p.ledger, PLACES_CAP);
  const callsBefore = ledger.total();

  // Competitors, allied health only, for leads that were audited.
  const polite = new Polite(new HostLimiter(BOOK_DIRECT_GAP_MS));
  const renderer = new Renderer(polite);
  const renderLimit = pLimit(4);
  const competitors = new Map<string, Competitor[]>();
  const homeFiles = () => readdirSync(cacheDir).filter((f) => !f.startsWith('town-')).length;
  const rendersBefore = homeFiles();
  try {
    const bLeads = contacts.filter((c) => c.list === 'B' && c.gate === 'passed' && records.has(c.slug));
    await Promise.all(
      bLeads.map(async (lead) => {
        competitors.set(lead.slug, await competitorsFor(lead, cands, records, { renderer, ledger, cacheDir, directories: cfg.directories, renderLimit }));
      }),
    );
  } finally {
    await renderer.stop();
  }
  const renders = homeFiles() - rendersBefore;
  writeFileSync(join(p.leads, '_competitors.csv'), toCsv([...competitors.entries()].flatMap(([slug, cs]) => cs.map((c) => ({ lead: slug, competitor: c.name, website: c.website, book_on_first_screen: c.bookOnFirstScreen === null ? 'not read' : c.bookOnFirstScreen ? 'yes' : 'no', how: c.how }))), ['lead', 'competitor', 'website', 'book_on_first_screen', 'how']));
  log(`competitors: ${competitors.size} clinics checked`);

  const inputOf = (c: ContactRow, status: VerifyStatus | '', flags: string[]): QualifyInput => {
    const rec = records.get(c.slug);
    const cand = byslug.get(c.slug);
    const comps = competitors.get(c.slug);
    return {
      list: c.list,
      name: c.name,
      primaryType: cand?.primary_type ?? '',
      verifyStatus: status,
      verifyFlags: flags,
      bookingEngineKind: rec?.facts.ownEngine ? 'own' : c.booking_engine_kind,
      otaLinks: rec?.facts.otaLinks.length ? rec.facts.otaLinks : c.ota_links ? c.ota_links.split(' ') : [],
      telPath: !!(c.tel_href || c.phone_shown),
      findings: rec?.findings ?? [],
      fullSignal: c.full_signal,
      excluded: excludedType(c.name, cand?.primary_type ?? ''),
      prior: priorContactReason(prior, { name: c.name, town: c.town, website: c.website, emails: [c.email] }),
      ratingCount: Number(c.rating_count) || 0,
      competitorsBookOnline: comps ? comps.filter((x) => x.bookOnFirstScreen).length : null,
      audited: !!rec,
    };
  };

  // First pass with the MX check only, to rank who gets the single-address checks.
  const passed = contacts.filter((c) => c.gate === 'passed');
  const first = passed
    .map((c) => ({ c, q: inputOf(c, c.verify_status as VerifyStatus, c.verify_flags ? c.verify_flags.split(';') : []) }))
    .filter((x) => qualifyReason(x.q) === null)
    .map((x) => ({ ...x, s: roomToSell({ ...x.q, verifyFlags: [] }).score }))
    .sort((a, b) => b.s - a.s || b.q.ratingCount - a.q.ratingCount);

  const key = env().ZEROBOUNCE_API_KEY ?? '';
  const checks = new Map<string, SingleCheck>();
  const zb = { creditsBefore: 0, checked: 0, fromCache: 0, results: {} as Record<string, number> };
  for (const { c } of first) {
    const f = join(zbDir, `${c.email.replace(/[^a-z0-9@._-]/gi, '_')}.json`);
    if (existsSync(f)) {
      checks.set(c.slug, JSON.parse(readFileSync(f, 'utf8')) as SingleCheck);
      zb.fromCache++;
    }
  }
  if (key) {
    zb.creditsBefore = await zeroBounceCredits(key);
    let budget = Math.min(zb.creditsBefore, opts.zeroBounceMax ?? zb.creditsBefore);
    for (const { c } of first) {
      if (budget <= 0) break;
      if (checks.has(c.slug)) continue;
      const r = await zeroBounceCheck(c.email, key);
      if (r.status === 'error' && /credit/i.test(r.error ?? '')) break;
      checks.set(c.slug, r);
      writeFileSync(join(zbDir, `${c.email.replace(/[^a-z0-9@._-]/gi, '_')}.json`), JSON.stringify(r));
      zb.checked++;
      budget--;
    }
  }
  for (const r of checks.values()) zb.results[`${r.status}${r.subStatus ? `/${r.subStatus}` : ''}`] = (zb.results[`${r.status}${r.subStatus ? `/${r.subStatus}` : ''}`] ?? 0) + 1;
  log(`zerobounce: ${zb.checked} checked now, ${zb.fromCache} from cache, credits before ${zb.creditsBefore}`);

  // Final pass.
  const qualified: (Record<(typeof QUALIFIED_COLUMNS)[number], string | number> & { _rank: number; _count: number })[] = [];
  const rejected: { list: string; business: string; town: string; website: string; email: string; reason: string; detail: string }[] = [];
  const finalStatus = new Map<string, { status: VerifyStatus | ''; flags: string[] }>();
  for (const c of contacts) {
    if (c.gate !== 'passed') {
      rejected.push({ list: c.list, business: c.name, town: c.town, website: c.website, email: c.email, reason: c.gate, detail: c.detail });
      continue;
    }
    let status = c.verify_status as VerifyStatus;
    let flags = c.verify_flags ? c.verify_flags.split(';') : [];
    const check = checks.get(c.slug);
    if (check) {
      const v = verdictOf(check);
      if (v.status !== 'mx_only') {
        status = v.status;
        flags = [...flags.filter((x) => x !== 'needs_verifier'), ...v.flags];
      }
    }
    if (/^(?:info|admin|bookings?|reservations|enquiries|hello|reception|stay|office)@/.test(c.email) && !flags.includes('role_address')) flags.push('role_address');
    finalStatus.set(c.slug, { status, flags });
    const q = inputOf(c, status, flags);
    const reason = qualifyReason(q);
    const rec = records.get(c.slug);
    if (reason) {
      const detail = reason === 'invalid_email' ? flags.filter((x) => x.startsWith('zerobounce')).join(';') : reason === 'already_full' ? `"${c.full_signal}" (${c.full_signal_url})` : reason === 'excluded_business_type' ? (q.excluded ?? '') : reason === 'no_lead_finding' || reason === 'only_tier4_finding' ? (rec?.findings.map((f) => `${f.cls}/${f.tier}`).join(' ') ?? '') : '';
      rejected.push({ list: c.list, business: c.name, town: c.town, website: c.website, email: c.email, reason, detail });
      continue;
    }
    const lf = leadFindings(q.findings);
    const lead = lf[0]!;
    const second = q.findings.find((f) => f !== lead && f.tier <= 4);
    const { score, points } = roomToSell(q);
    const lcp = rec?.facts.speed.measured ? Math.max(...rec.facts.speed.pages.map((x) => x.lcpS ?? 0)).toFixed(1) : 'not_measured';
    const allFlags = [...flags, ...(c.flags ? c.flags.split(';') : []), ...(c.booking_engine_kind === 'generic' && !rec?.facts.ownEngine ? ['no_engine_generic_link'] : []), ...(String(c.rendered) === 'true' ? ['js_site'] : [])];
    qualified.push({
      list: c.list,
      business: c.name,
      town: c.town,
      website: c.website,
      email: c.email,
      email_source_url: c.email_source_url,
      email_seen_on: c.email_seen_on,
      verify_status: status,
      greeting_names: c.greeting_names,
      booking_engine: rec?.facts.ownEngine || (c.booking_engine === 'none' && q.otaLinks.length ? 'OTA only' : c.booking_engine),
      booking_url: c.booking_url,
      ota_links: q.otaLinks.join(' '),
      lead_finding: lead.cls,
      lead_value: lead.value,
      lead_evidence_url: lead.evidenceUrl,
      second_finding: second ? `${second.cls}: ${second.value}` : '',
      lcp_mobile_s: lcp,
      first_screen_cta: rec?.facts.firstScreen.checked ? rec.facts.firstScreen.controls.join('; ') || 'none' : 'not checked',
      competitors_book_online: q.competitorsBookOnline ?? '',
      rating: c.rating,
      rating_count: c.rating_count,
      score,
      flags: [...new Set(allFlags)].filter(Boolean).join(';') + (points.length ? ` | ${points.join(', ')}` : ''),
      _rank: score,
      _count: Number(c.rating_count) || 0,
    });
  }
  qualified.sort((a, b) => b._rank - a._rank || b._count - a._count);
  writeFileSync(join(p.leads, 'QUALIFIED.csv'), toCsv(qualified, [...QUALIFIED_COLUMNS]));
  writeFileSync(join(p.leads, 'REJECTED.csv'), toCsv(rejected, ['list', 'business', 'town', 'website', 'email', 'reason', 'detail']));

  // The funnel per list.
  const funnels: Funnel[] = [];
  for (const list of [...new Set(contacts.map((c) => c.list))].sort()) {
    const poolFile = join(p.leads, `_pool_${list}.csv`);
    const pool = existsSync(poolFile) ? parseCsv(readFileSync(poolFile, 'utf8')) : [];
    const cs = contacts.filter((c) => c.list === list);
    const verified = cs.filter((c) => c.gate === 'passed' && ['valid', 'catch_all', 'mx_only', 'unknown'].includes(finalStatus.get(c.slug)?.status ?? ''));
    const audited = cs.filter((c) => records.has(c.slug));
    funnels.push({
      list,
      placesFound: pool.length,
      withOwnWebsite: pool.filter((r) => !['no_website', 'directory_or_social_website', 'not_operational'].includes(r.reason ?? '')).length,
      candidates: cs.length,
      siteRead: cs.filter((c) => c.home_url).length,
      withPublishedEmail: cs.filter((c) => c.email).length,
      emailVerified: verified.length,
      audited: audited.length,
      withLeadFinding: audited.filter((c) => leadFindings(records.get(c.slug)!.findings).length).length,
      qualified: qualified.filter((q) => q.list === list).length,
    });
  }
  const findingMix: Record<string, number> = {};
  for (const q of qualified) findingMix[String(q.lead_finding)] = (findingMix[String(q.lead_finding)] ?? 0) + 1;
  const engineMix: Record<string, number> = {};
  for (const q of qualified) {
    const e = String(q.booking_engine);
    const k = ['Seekom', 'STAAH', 'Little Hotelier', 'Cliniko', 'Halaxy'].includes(e) ? e : e === 'OTA only' || e === 'none' ? 'none (OTA only)' : e === 'generic' ? 'none (generic Book link)' : `other: ${e}`;
    engineMix[k] = (engineMix[k] ?? 0) + 1;
  }
  const recs = [...records.values()];
  const summary: QualifySummary = {
    funnels,
    qualified: qualified.length,
    zeroBounce: zb,
    competitorRenders: renders,
    placesCalls: ledger.total() - callsBefore,
    findingMix,
    engineMix,
    needsVerifier: qualified.filter((q) => String(q.flags).includes('needs_verifier')).length,
    notMeasured: recs.filter((r) => !r.facts.speed.measured).length,
    lighthouse: { leadsMeasured: recs.filter((r) => r.facts.speed.measured).length, pagesMeasured: recs.reduce((n, r) => n + r.facts.speed.pages.length, 0), runs: recs.reduce((n, r) => n + r.facts.speed.pages.reduce((m, x) => m + x.runs, 0), 0) },
  };
  writeFileSync(join(p.leads, '_summary.json'), JSON.stringify(summary, null, 2));
  writeFileSync(join(p.leads, 'README.md'), leadsReadme({ qualified: summary.qualified, needsVerifier: summary.needsVerifier, zeroBounceChecked: zb.checked + zb.fromCache, generatedAt: new Date().toISOString() }));
  return summary;
}
