import type { OwnWord } from './words.ts';
import type { FaithFlag } from './screens.ts';
import type { RunMeasured, PhoneScreen } from './findings.ts';
import { buildFindings, otherObservations } from './findings.ts';
import type { WaveRow } from './list.ts';
import { greetingNames } from './list.ts';
import { TIER_NAMES, rankRunFindings, recommendation, type Dropped, type RankedFinding } from './tiers.ts';

export type Recommendation = 'BUILD' | 'RESERVE' | 'BLOCKED';

export interface PackFinding {
  place: number;
  tier: number;
  tier_name: string;
  type: string;
  sentence: string;
  measured: string;
  evidence_url: string;
  linked_from: string | null;
  measured_at: string;
  source: string;
}

export interface FactPack {
  slug: string;
  name: string;
  website: string;
  category: string;
  town: string;
  list: { status: 'wave' | 'reserve'; order: number };
  to: { address: string; source_url: string; on_source_page: boolean };
  greeting: string;
  greeting_names: string[];
  owner_source_url: string;
  findings: PackFinding[];
  also_found: { tier: number; type: string; sentence: string }[];
  /** Measured by the checks and not ranked by the tiers. */
  other_observations: string[];
  strengths: { ai_crawler_access: string; rating: string | null; own_words: { text: string; url: string }[] };
  notes: { csv: string; trading_signs: string[] };
  flags: { facts_changed: string[]; faith: FaithFlag[]; security_review: string[]; refuses_unsolicited: string | null; speed: string };
  booking: { path: string; csv_says: string; links_followed: { text: string; lands_on: string; status: number | null; final_url: string | null }[] };
  phone: PhoneScreen | null;
  pelorus: RunMeasured['pelorus'];
  recheck: { measured_at: string; not_before: string; fresh_until: string; command: string };
  recommendation: Recommendation;
  blocked: string | null;
  dropped: Dropped[];
}

const SEARCH_BOTS = ['Googlebot', 'Bingbot', 'OAI-SearchBot', 'PerplexityBot'];
const NOTABLE = /\b(?:since (?:19|20)\d{2}|(?:over |more than )?\d{1,2}\+? years|family[- ](?:owned|run)|third generation|second generation|award|winners?|qualmark|licensed|certified|qualified|locally owned|owner[- ]operated)\b/i;

/** Sentences in their own words that say something worth keeping, exactly as written. */
export function notableWords(words: OwnWord[], max = 3): { text: string; url: string }[] {
  const out: { text: string; url: string }[] = [];
  for (const w of words.filter((x) => x.kind === 'about' || x.kind === 'hero' || x.kind === 'tagline')) {
    for (const s of w.text.split(/(?<=[.!?])\s+/)) {
      if (NOTABLE.test(s) && s.length <= 220 && !out.some((o) => o.text === s)) out.push({ text: s.trim(), url: w.url });
      if (out.length >= max) return out;
    }
  }
  return out;
}

const addMinutes = (iso: string, m: number) => new Date(new Date(iso).getTime() + m * 60_000).toISOString();

function speedLine(m: RunMeasured): string {
  const s = m.speed;
  if (s.status === 'ok') return `steady: ${s.runs.map((r) => r.performance).join(' and ')}`;
  return `${s.status}: ${s.reason ?? ''}`.trim();
}

/** Ranks the findings of one business and sets out its fact pack. A business that cannot be measured is blocked, with the reason. */
export function buildFactPack(row: WaveRow, m: RunMeasured | null, extras: { words: OwnWord[]; blocked?: string | null; crawlmouseAiAccess?: string | null }): FactPack {
  const names = greetingNames(row.greeting);
  const measuredAt = m?.measuredAt ?? new Date().toISOString();
  const blocked = extras.blocked ?? (m ? (m.collection.blocked ? `the site could not be read (${m.collection.blocked.replace(/_/g, ' ')})` : m.refusal ? 'the site refuses unsolicited messages' : null) : 'not measured');
  const raw = m && !m.collection.blocked ? buildFindings(m) : [];
  const { top, rest, dropped } = rankRunFindings(raw, { agencies: m?.agencies ?? [] });
  const wanted = (r: RankedFinding): PackFinding => ({ place: r.place, tier: r.tier, tier_name: TIER_NAMES[r.tier], type: r.type, sentence: r.sentence, measured: r.measured, evidence_url: r.evidenceUrl, linked_from: r.linkedFrom ?? null, measured_at: r.measuredAt, source: r.source });
  const botsBlocked = m?.aiCrawlers.blocked ?? [];
  const aiAccess = m
    ? `${botsBlocked.length ? `robots.txt turns away ${botsBlocked.join(', ')}` : `robots.txt does not turn away ${SEARCH_BOTS.join(', ')}`}${extras.crawlmouseAiAccess ? `; Crawlmouse: ${extras.crawlmouseAiAccess}` : ''}`
    : '';
  const rating = row.reviews && !/^not found$/i.test(row.reviews) ? row.reviews : null;
  const reco: Recommendation = blocked ? 'BLOCKED' : recommendation(top);
  return {
    slug: row.slug,
    name: row.name,
    website: row.website,
    category: row.category,
    town: row.town,
    list: { status: row.status, order: row.order },
    to: { address: row.email, source_url: row.emailSourceUrl, on_source_page: m?.facts.email.found ?? false },
    greeting: row.greeting,
    greeting_names: names,
    owner_source_url: row.ownerSource1,
    findings: top.map(wanted),
    also_found: rest.map((r) => ({ tier: r.tier, type: r.type, sentence: r.sentence })),
    other_observations: m ? otherObservations(m) : [],
    strengths: { ai_crawler_access: aiAccess, rating, own_words: notableWords(extras.words) },
    notes: { csv: row.notes, trading_signs: m?.trading ?? [] },
    flags: {
      facts_changed: m?.facts.changed ?? [],
      faith: m?.faith ?? [],
      security_review: (m?.checks ?? []).filter((c) => c.checkId.startsWith('C05')).map((c) => `${c.checkId}: ${c.title}`),
      refuses_unsolicited: m?.refusal ?? null,
      speed: m ? speedLine(m) : 'not measured',
    },
    booking: { path: m?.booking?.path ?? 'not read', csv_says: row.bookingSystem, links_followed: (m?.booking?.landings ?? []).map((l) => ({ text: l.text, lands_on: l.landsOn, status: l.status, final_url: l.finalUrl })) },
    phone: m?.phone ?? null,
    pelorus: m?.pelorus ?? null,
    recheck: { measured_at: measuredAt, not_before: addMinutes(measuredAt, 60), fresh_until: addMinutes(measuredAt, 24 * 60), command: `pnpm plumb wave run --wave wave-4 --only ${row.slug}` },
    recommendation: reco,
    blocked,
    dropped,
  };
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** The fact pack as a short page: 30 lines or fewer. */
export function factPackLines(p: FactPack): string[] {
  const L: string[] = [];
  L.push(`# ${p.name} (${p.slug}): ${p.recommendation}${p.blocked ? `, ${p.blocked}` : ''}`);
  L.push(`${p.website} | ${p.category}, ${p.town} | list: ${p.list.status} ${p.list.order}`);
  L.push(`To: ${p.to.address} (from ${p.to.source_url}${p.to.on_source_page ? '' : ', NOT FOUND there today'}) | Greeting: ${p.greeting} (owners: ${p.owner_source_url})`);
  if (!p.findings.length) L.push('Findings: none put forward.');
  for (const f of p.findings) {
    L.push(`${f.place}. [tier ${f.tier}] ${f.sentence}`);
    L.push(`   measured: ${clip(f.measured, 200)}`);
    L.push(`   evidence: ${f.evidence_url}${f.linked_from ? ` | linked from: ${f.linked_from}` : ''} | measured ${f.measured_at.slice(0, 10)}`);
  }
  if (p.also_found.length) L.push(`Also found: ${clip(p.also_found.slice(0, 6).map((a) => `${a.type} (tier ${a.tier})`).join(', '), 180)}`);
  if (p.other_observations.length) L.push(`Not ranked: ${clip(p.other_observations.slice(0, 4).join('; '), 220)}`);
  L.push(`Strengths: ${clip(p.strengths.ai_crawler_access || 'not read', 200)}${p.strengths.rating ? ` | rating: ${p.strengths.rating}` : ''}`);
  for (const w of p.strengths.own_words) L.push(`   their words: "${clip(w.text, 180)}" (${w.url})`);
  L.push(`Notes: ${clip(p.notes.csv || 'none', 200)}${p.notes.trading_signs.length ? ` | signs: ${clip(p.notes.trading_signs.join('; '), 200)}` : ''}`);
  const flags: string[] = [];
  if (p.flags.facts_changed.length) flags.push(`facts_changed: ${p.flags.facts_changed.join('; ')}`);
  if (p.flags.faith.length) flags.push(`faith: ${p.flags.faith.map((f) => `${f.topic} on ${f.url} (${f.why})`).join('; ')}`);
  if (p.flags.security_review.length) flags.push(`security review: ${p.flags.security_review.join('; ')}`);
  if (p.flags.refuses_unsolicited) flags.push(`refuses unsolicited messages: "${clip(p.flags.refuses_unsolicited, 120)}"`);
  L.push(`Flags: ${flags.length ? clip(flags.join(' | '), 400) : 'none'}`);
  L.push(`Speed: ${p.flags.speed} | Booking: ${p.booking.path} (list says: ${clip(p.booking.csv_says || 'n/a', 60)}) | Phone screen: ${p.phone ? `${p.phone.actionVisible ? 'action visible' : 'no action'}, ${p.phone.sideways ? 'scrolls sideways' : 'fits'}` : 'not read'}`);
  if (p.pelorus) L.push(`Header only: ${p.pelorus.requests.map((r) => `${r.url} ${r.status ?? r.error}`).join(' | ')}`);
  L.push(`Recheck: not before ${p.recheck.not_before.slice(0, 16)}Z, fresh until ${p.recheck.fresh_until.slice(0, 16)}Z`);
  return L.slice(0, 30);
}

const cell = (s: string) => s.replace(/\|/g, '/').replace(/\s+/g, ' ');

export function summaryLines(packs: FactPack[]): string[] {
  const count = (r: Recommendation) => packs.filter((p) => p.recommendation === r).length;
  const L = ['# Wave 4 summary', '', `${packs.length} businesses: ${count('BUILD')} BUILD, ${count('RESERVE')} RESERVE, ${count('BLOCKED')} BLOCKED.`, '', '| slug | category | list | top finding | tier | recommendation | flags |', '| --- | --- | --- | --- | --- | --- | --- |'];
  for (const p of packs) {
    const top = p.findings[0];
    const flags: string[] = [];
    if (p.flags.facts_changed.length) flags.push('facts_changed');
    if (p.flags.faith.length) flags.push('faith');
    if (p.flags.security_review.length) flags.push('security review');
    if (p.flags.refuses_unsolicited) flags.push('refuses unsolicited');
    if (/^(unstable|unavailable)/.test(p.flags.speed)) flags.push(`speed ${p.flags.speed.split(':')[0]}`);
    if (p.notes.trading_signs.length) flags.push('trading signs');
    if (/for sale|trading not confirmed|sensitive|not confirmed/i.test(p.notes.csv)) flags.push('csv note');
    if (p.blocked) flags.push(`blocked: ${p.blocked}`);
    L.push(`| ${p.slug} | ${p.category} | ${p.list.status} | ${top ? cell(top.sentence) : 'none'} | ${top ? top.tier : ''} | ${p.recommendation} | ${cell(flags.join(', '))} |`);
  }
  return L;
}
