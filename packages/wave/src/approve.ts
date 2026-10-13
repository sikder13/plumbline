/**
 * Approves a business's findings by rule, so nobody reviews them one by one. A finding is first
 * tested against the reasons to reject it, what is left is ranked by what it costs the owner, and
 * the first few are approved. Every decision carries the rule that made it.
 */

import { speedIn, statedSentence, steadySpeed, type SpeedRun } from './stated.ts';

export interface ApprovalFinding {
  id: number;
  checkId: string;
  source: string;
  status: string;
  /** How the fact was established: measured, rule or judgment. */
  tier: string;
  severity: number;
  score: number;
  title: string;
  detail: Record<string, unknown>;
  lastVerifiedAt: string | null;
  evidence: { kind: string; path: string | null; excerpt: string | null }[];
}

/** What is known about the business that a finding can be tested against. */
export interface ApprovalContext {
  slug: string;
  now: Date;
  /** Ways to book found anywhere on the site: third-party systems, and forms of the site's own that take a booking. */
  bookingRoutes: string[];
  /** Ways to get in touch found on the homepage: email and phone links, a contact form. */
  contactRoutes: string[];
  /** Names of an agency or designer credited on the site. */
  agencyNames: string[];
  /** The homepage opens behind an age gate, so what was measured on its first screen is the gate. */
  ageGate: boolean;
  /** Phone speed on each run, oldest first: the median of that run's measurements. */
  speedRuns: SpeedRun[];
  /** Findings an independent reviewer flagged, by id, with the reason given. */
  flagged: Map<number, string>;
}

export interface Rejection {
  rule: string;
  reason: string;
}

const HOURS = 3_600_000;
const BOOKING_CLAIMS = new Set(['T01_no_online_booking', 'T03_platform_dependency']);
const CONTACT_CLAIMS = new Set(['C15_contact_details_missing']);
/** Checks that read the first screen, the words or the controls of the homepage. Behind an age gate they read the gate, or the gate among the rest. */
const READS_FIRST_SCREEN = new Set(['C13_no_action_above_fold', 'C14_no_price_visible', 'C15_contact_details_missing', 'C36_thin_homepage', 'C50_accessibility_failures']);
const AGENCY_WORDS = /\b(agency|web ?designer|web ?developer|website by|site by|designed by|built by|developed by)\b/i;
/** An unlinked page matters to the owner only when it is one visitors need in order to buy. */
const NEEDED_PAGE = /\b(book|booking|bookings|reservations?|tours?|trips?|packages?|products?|shop|tastings?|hire|rentals?)\b/i;

/** A page with fewer words than this has nothing on it for a visitor to miss. */
const EMPTY_PAGE_WORDS = 50;

/**
 * Whether our own reading of the pages bears out a count given in the sentence. The sentence may
 * say "72 of 102 pages"; what we measured is the share of the pages we read ourselves. When ours
 * is under half of theirs, or every other page we read was fine, the count is theirs and not ours.
 */
function bornOut(f: ApprovalFinding): boolean {
  const measured = String(f.detail.measured ?? '');
  if (/\bThe \d+ other pages we read all (have one|carry some)\b/.test(measured)) return false;
  const claimed = /\b(\d+) of (\d+) pages\b/.exec(f.title);
  const ours = /\bon the (\d+ )?example pages?, nor on (\d+) of the (\d+) other pages we read\b/.exec(measured);
  if (!claimed || !ours) return true;
  const examples = Number(ours[1] ?? 1);
  const share = (examples + Number(ours[2])) / (examples + Number(ours[3]));
  return share >= (Number(claimed[1]) / Number(claimed[2])) / 2;
}

/** Two runs disagree when either the score or the time to main content differs by more than this share. */
export const SPEED_TOLERANCE = 0.3;
const apart = (a: number, b: number) => Math.abs(a - b) / Math.max(a, b, 1) > SPEED_TOLERANCE;
const disagree = (a: SpeedRun, b: SpeedRun) => apart(a.performance, b.performance) || apart(a.lcpMs, b.lcpMs);

/** Whether the last two speed runs disagree, so that a third is needed before the finding can be judged. */
export function needsThirdSpeedRun(runs: SpeedRun[]): boolean {
  return runs.length === 2 && disagree(runs[0]!, runs[1]!);
}

/** Filter 1: the first reason to reject a finding, or null when it survives. */
export function rejectionFor(f: ApprovalFinding, ctx: ApprovalContext): Rejection | null {
  if (ctx.flagged.has(f.id)) return { rule: 'F4 independent check', reason: ctx.flagged.get(f.id)?.trim() || 'flagged, with no reason given' };

  if (f.status !== 'reproduced' && f.status !== 'approved') return { rule: 'F1.1 did not reproduce', reason: `status is ${f.status}` };
  if (!f.lastVerifiedAt || ctx.now.getTime() - new Date(f.lastVerifiedAt).getTime() > 24 * HOURS) return { rule: 'F1.1 did not reproduce', reason: 'not re-checked within the last 24 hours' };
  const ai = f.evidence.some((e) => e.kind === 'ai');
  if (!f.title.trim() || (ai ? !f.evidence.some((e) => e.excerpt?.trim()) : !f.evidence.some((e) => e.path))) return { rule: 'F1.1 no screenshot or measured value', reason: ai ? 'no stored answers behind it' : 'no screenshot behind it' };

  if (BOOKING_CLAIMS.has(f.checkId) && ctx.bookingRoutes.length) return { rule: 'F1.2 a way to book exists', reason: `the site has ${ctx.bookingRoutes.slice(0, 3).join('; ')}` };
  if (CONTACT_CLAIMS.has(f.checkId) && ctx.contactRoutes.length) return { rule: 'F1.2 a way to get in touch exists', reason: `the homepage has ${ctx.contactRoutes.slice(0, 3).join('; ')}` };

  const words = `${f.title} ${JSON.stringify(f.detail)} ${f.evidence.map((e) => e.excerpt ?? '').join(' ')}`;
  const named = ctx.agencyNames.find((n) => n.trim().length >= 4 && words.toLowerCase().includes(n.toLowerCase()));
  if (named || AGENCY_WORDS.test(f.title)) return { rule: 'F1.3 names or blames an agency', reason: named ? `mentions ${named}` : 'the finding speaks of whoever built the site' };

  if (f.tier === 'judgment') return { rule: 'F1.4 inference, not measurement', reason: 'a person has to judge it' };
  if (ctx.ageGate && READS_FIRST_SCREEN.has(f.checkId)) return { rule: 'F1.4 inference, not measurement', reason: 'the homepage opens behind an age gate, so what was measured was the gate, or the gate with the page' };
  if (f.source === 'crawlmouse') {
    if (typeof f.detail.caution === 'string' && f.detail.caution.trim()) return { rule: 'F1.4 inference, not measurement', reason: `its source says to check first: ${f.detail.caution.trim()}` };
    if (!bornOut(f)) return { rule: 'F1.4 inference, not measurement', reason: 'the count in the sentence is not borne out by the pages we read ourselves' };
  }

  if (f.checkId === 'CM_missing_page') {
    const examples = (f.detail.examples as { linkedFrom?: unknown[] }[] | undefined) ?? [];
    if (!examples.some((e) => (e.linkedFrom ?? []).length > 0)) return { rule: 'F1.5 no page links to the missing page', reason: 'none of their pages was found linking to it' };
  }
  if (f.checkId === 'CM_orphan_page') {
    if (!NEEDED_PAGE.test(f.title)) return { rule: 'F1.6 unlinked page visitors do not need', reason: 'not a booking, tour or product page' };
    const pages = (f.detail.examples as { words?: number }[] | undefined) ?? [];
    if (pages.length && pages.every((e) => (e.words ?? 0) < EMPTY_PAGE_WORDS)) return { rule: 'F1.6 unlinked page visitors do not need', reason: `the page has fewer than ${EMPTY_PAGE_WORDS} words on it, so there is nothing there for a visitor to miss` };
  }

  if (f.checkId === 'C20_slow_mobile') {
    const runs = ctx.speedRuns.slice(-3);
    if (runs.length < 2) return { rule: 'F1.7 unstable speed', reason: 'fewer than two speed runs to compare' };
    if (needsThirdSpeedRun(runs)) return { rule: 'F1.7 unstable speed', reason: 'two runs disagree by more than 30% and no third run has been made' };
    if (runs.length === 3) {
      // With three runs the median stands when at least two of them agree with each other.
      if (disagree(runs[0]!, runs[1]!) && disagree(runs[1]!, runs[2]!) && disagree(runs[0]!, runs[2]!)) return { rule: 'F1.7 unstable speed', reason: 'three runs and no two of them agree within 30%' };
    }
  }
  return null;
}

export const TIERS = ['lost bookings or contact', 'speed', 'security and trust', 'search and AI', 'other'] as const;
export type OwnerTier = (typeof TIERS)[number];

/** Each check's tier, and its place within the tier: how directly it costs the owner a booking. */
const PLACE: Record<string, [OwnerTier, number]> = {
  C10_broken_contact_links: ['lost bookings or contact', 1],
  CM_missing_page: ['lost bookings or contact', 2],
  C12_broken_internal_links: ['lost bookings or contact', 3],
  C11_dead_navigation: ['lost bookings or contact', 4],
  C16_booking_hard_to_reach: ['lost bookings or contact', 5],
  C13_no_action_above_fold: ['lost bookings or contact', 6],
  T02_booking_system_not_linked: ['lost bookings or contact', 7],
  T01_no_online_booking: ['lost bookings or contact', 8],
  T03_platform_dependency: ['lost bookings or contact', 9],
  CM_orphan_page: ['lost bookings or contact', 10],
  C23_not_mobile_friendly: ['lost bookings or contact', 12],
  C15_contact_details_missing: ['lost bookings or contact', 13],
  C14_no_price_visible: ['lost bookings or contact', 14],
  C20_slow_mobile: ['speed', 1],
  C41_outdated_platform: ['security and trust', 1],
  C40_insecure_connection: ['security and trust', 2],
  C05_possible_compromise: ['security and trust', 3],
  C05b_hidden_injected_content: ['security and trust', 4],
  C03_stale_dated_notice: ['security and trust', 5],
  C01_placeholder_text: ['security and trust', 5],
  C06_broken_images: ['security and trust', 6],
  C04_seasonal_mismatch: ['security and trust', 7],
  C61_price_differs_from_listing: ['security and trust', 8],
  C38_inconsistent_contact_details: ['security and trust', 9],
  CM_leftover_page: ['security and trust', 10],
  C02_stale_copyright: ['security and trust', 11],
  C37_not_named_by_ai: ['search and AI', 1],
  CM_no_meta_description: ['search and AI', 2],
  C33_robots_blocks_search_or_ai: ['search and AI', 3],
  C31_no_structured_data: ['search and AI', 4],
  CM_no_structured_data: ['search and AI', 5],
  CM_no_main_heading: ['search and AI', 6],
  C36_thin_homepage: ['search and AI', 7],
  CM_thin_page: ['search and AI', 8],
};

/** A speed finding counts as a speed problem only past these marks. Short of them it ranks with the rest. */
export const SPEED_BAR = { lcpMs: 4000, performance: 50 };

const slow = (m: SpeedRun) => m.lcpMs > SPEED_BAR.lcpMs || m.performance < SPEED_BAR.performance;

/**
 * Whether two speed sentences say the same thing: their figures agree as two runs of one page
 * would, and both stand on the same side of the marks that make a page slow. Every new run nudges
 * the median, and a sentence that has only been nudged has not changed.
 */
export function sameSpeed(a: string, b: string): boolean {
  const x = speedIn(a);
  const y = speedIn(b);
  return !!x && !!y && !disagree(x, y) && slow(x) === slow(y);
}

export function tierOf(f: ApprovalFinding, ctx: ApprovalContext): { tier: OwnerTier; place: number } {
  if (f.checkId === 'C20_slow_mobile') {
    const m = steadySpeed(ctx.speedRuns) ?? { performance: Number(f.detail.performance ?? 100), lcpMs: Number(f.detail.lcpMs ?? 0) };
    return slow(m) ? { tier: 'speed', place: 1 } : { tier: 'other', place: 1 };
  }
  // A price missing from the homepage but shown on another page costs far less than no price anywhere.
  if (f.checkId === 'C14_no_price_visible' && ((f.detail.pricesFoundOn as unknown[] | undefined) ?? []).length) return { tier: 'other', place: 2 };
  const p = PLACE[f.checkId];
  return p ? { tier: p[0], place: p[1] } : { tier: 'other', place: 50 };
}

const byTier = (a: { tier: OwnerTier; place: number; f: ApprovalFinding }, b: { tier: OwnerTier; place: number; f: ApprovalFinding }) =>
  TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) || a.place - b.place || b.f.severity - a.f.severity || b.f.score - a.f.score || a.f.id - b.f.id;

/** Findings in the order they are put to the owner: by tier, then by how directly each costs a booking. */
export function ownerOrder<T extends Pick<ApprovalFinding, 'id' | 'checkId' | 'severity' | 'score' | 'detail'>>(findings: T[], speedRuns: SpeedRun[]): T[] {
  const ctx = { speedRuns } as ApprovalContext;
  return findings
    .map((f) => ({ f: f as unknown as ApprovalFinding, ...tierOf(f as unknown as ApprovalFinding, ctx) }))
    .sort(byTier)
    .map((r) => r.f as unknown as T);
}

/** Findings that come from one cause. Of each group the clearer one is kept. */
function rootCause(f: ApprovalFinding): string {
  if (f.checkId === 'T03_platform_dependency') return 'T01_no_online_booking';
  if (f.checkId === 'CM_no_structured_data') return 'C31_no_structured_data';
  return f.checkId;
}

const bare = (url: string) => url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '').toLowerCase();
/** Where a link was found, and what was written about it, is not the address that is broken. */
const NOT_THE_ADDRESS = new Set(['foundOn', 'pageUrl', 'linkedFrom', 'measured', 'sentence']);

/** The addresses a finding says are broken. */
function brokenAddresses(value: unknown, out: Set<string> = new Set()): Set<string> {
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value)) out.add(bare(value));
  } else if (Array.isArray(value)) {
    for (const v of value) brokenAddresses(v, out);
  } else if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) if (!NOT_THE_ADDRESS.has(key)) brokenAddresses(v, out);
  }
  return out;
}
const addressesIn = (f: ApprovalFinding) => brokenAddresses(f.detail);

export interface Decision {
  findingId: number;
  slug: string;
  checkId: string;
  title: string;
  /** The finding in the words it is put to the owner in. */
  sentence: string;
  decision: 'approve' | 'reject';
  rule: string;
  tier: OwnerTier;
  reason: string;
}

export interface ApprovalOptions {
  /** A finding that is approved whenever it survives the first filter, whatever its rank. */
  always?: (f: ApprovalFinding) => boolean;
}

/**
 * Decides every finding of one business. Filter 1 rejects, Filter 2 ranks what is left, Filter 3
 * approves the first three, and a fourth and fifth when they cost bookings or speed.
 */
export function decideFindings(findings: ApprovalFinding[], ctx: ApprovalContext, opts: ApprovalOptions = {}): Decision[] {
  const out: Decision[] = [];
  const say = (f: ApprovalFinding, decision: Decision['decision'], rule: string, reason: string) => out.push({ findingId: f.id, slug: ctx.slug, checkId: f.checkId, title: f.title, sentence: statedSentence(f, ctx.speedRuns), decision, rule, tier: tierOf(f, ctx).tier, reason });

  const survivors: ApprovalFinding[] = [];
  for (const f of findings) {
    const r = rejectionFor(f, ctx);
    if (r) say(f, 'reject', r.rule, r.reason);
    else survivors.push(f);
  }

  const ranked = survivors
    .map((f) => ({ f, ...tierOf(f, ctx) }))
    .sort(byTier);

  // Filter 1.8: one finding for each cause. A broken address reported twice is kept where the link to it is shown.
  const kept: typeof ranked = [];
  for (const r of ranked) {
    const twin = kept.find((k) => rootCause(k.f) === rootCause(r.f)) ?? (/^(C1[012]_|CM_missing_page)/.test(r.f.checkId) ? kept.find((k) => /^(C1[012]_|CM_missing_page)/.test(k.f.checkId) && [...addressesIn(k.f)].some((u) => addressesIn(r.f).has(u))) : undefined);
    if (twin) say(r.f, 'reject', 'F1.8 same cause as another finding', `same cause as finding ${twin.f.id}, which is kept`);
    else kept.push(r);
  }

  let open = true;
  for (const [i, r] of kept.entries()) {
    const early = TIERS.indexOf(r.tier) <= 1;
    const take = open && (i < 3 || (i < 5 && early));
    if (!take) open = false;
    if (take) say(r.f, 'approve', i < 3 ? 'F3 top three' : 'F3 fourth or fifth, costing bookings or speed', `ranked ${i + 1} of ${kept.length}`);
    else if (opts.always?.(r.f)) say(r.f, 'approve', 'F3 always approved when it survives', `ranked ${i + 1} of ${kept.length}`);
    else say(r.f, 'reject', 'F3 not in the top three', `ranked ${i + 1} of ${kept.length}`);
  }
  return out;
}

/** A business with fewer than two approved findings is still built, but its email is held. */
export function isWeak(decisions: Decision[]): boolean {
  return decisions.filter((d) => d.decision === 'approve').length < 2;
}
