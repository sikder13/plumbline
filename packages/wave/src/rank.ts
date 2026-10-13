/**
 * Orders one business's findings by how much they would matter to its owner: lost bookings and
 * broken contact first, then speed, then security, then search and AI, then the rest.
 */

export type OwnerGroup = 'bookings and contact' | 'speed' | 'security' | 'search and AI' | 'other';

const ORDER: OwnerGroup[] = ['bookings and contact', 'speed', 'security', 'search and AI', 'other'];

const BY_CHECK: Record<string, OwnerGroup> = {
  // A visitor cannot book, cannot reach the business, or meets something plainly broken or out of date.
  C01_placeholder_text: 'bookings and contact',
  C03_stale_dated_notice: 'bookings and contact',
  C04_seasonal_mismatch: 'bookings and contact',
  C06_broken_images: 'bookings and contact',
  C10_broken_contact_links: 'bookings and contact',
  C11_dead_navigation: 'bookings and contact',
  C12_broken_internal_links: 'bookings and contact',
  C13_no_action_above_fold: 'bookings and contact',
  C14_no_price_visible: 'bookings and contact',
  C15_contact_details_missing: 'bookings and contact',
  C16_booking_hard_to_reach: 'bookings and contact',
  C23_not_mobile_friendly: 'bookings and contact',
  C38_inconsistent_contact_details: 'bookings and contact',
  C60_conflicting_facts: 'bookings and contact',
  C61_price_differs_from_listing: 'bookings and contact',
  T01_no_online_booking: 'bookings and contact',
  T02_booking_system_not_linked: 'bookings and contact',
  T03_platform_dependency: 'bookings and contact',
  CM_missing_page: 'bookings and contact',
  C20_slow_mobile: 'speed',
  C05_possible_compromise: 'security',
  C05b_hidden_injected_content: 'security',
  C40_insecure_connection: 'security',
  C41_outdated_platform: 'security',
  C31_no_structured_data: 'search and AI',
  C33_robots_blocks_search_or_ai: 'search and AI',
  C36_thin_homepage: 'search and AI',
  C37_not_named_by_ai: 'search and AI',
  CM_orphan_page: 'search and AI',
  CM_leftover_page: 'search and AI',
  CM_thin_page: 'search and AI',
  CM_no_meta_description: 'search and AI',
  CM_no_main_heading: 'search and AI',
  CM_no_structured_data: 'search and AI',
};

/** What each kind of Crawlmouse finding is called in lists. The sentence itself is Crawlmouse's own. */
export const CRAWLMOUSE_TITLES: Record<string, string> = {
  CM_missing_page: 'A link leads to a missing page',
  CM_orphan_page: 'A page is not linked from anywhere',
  CM_leftover_page: 'A leftover page is live',
  CM_thin_page: 'A page has very little text',
  CM_no_meta_description: 'Pages have no meta description',
  CM_no_main_heading: 'Pages have no main heading',
  CM_no_structured_data: 'Pages carry no structured data',
};

export interface Rankable {
  id: number;
  check_id: string;
  source: string;
  status: string;
  severity: number;
  score: number;
  title: string;
  detail: string;
}

/** A page nobody can reach is a lost booking when it is the booking or contact page, and a search matter otherwise. */
export function groupOf(f: Pick<Rankable, 'check_id' | 'title'>): OwnerGroup {
  if (f.check_id === 'CM_orphan_page' && /\b(book|booking|bookings|contact|reservations?|enquir)/i.test(f.title)) return 'bookings and contact';
  return BY_CHECK[f.check_id] ?? 'other';
}

const bare = (url: string) => url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '').toLowerCase();

/** The Plumbline finding a Crawlmouse finding repeats, if any: the same missing structured data, or the same broken address. */
export function repeats<T extends Rankable>(f: T, all: T[]): T | null {
  if (f.source !== 'crawlmouse') return null;
  const own = all.filter((x) => x.source !== 'crawlmouse' && x.id !== f.id);
  if (f.check_id === 'CM_no_structured_data') return own.find((x) => x.check_id === 'C31_no_structured_data') ?? null;
  if (f.check_id !== 'CM_missing_page') return null;
  const urls = ((JSON.parse(f.detail || '{}') as { examples?: { url: string }[] }).examples ?? []).map((e) => bare(e.url));
  return own.find((x) => /^C1[012]_/.test(x.check_id) && urls.some((u) => x.detail.toLowerCase().includes(u))) ?? null;
}

export interface Ranked<T> {
  finding: T;
  group: OwnerGroup;
  /** Place in the order, from 1. */
  place: number;
  /** One of the three to five put forward for this business. */
  kept: boolean;
  /** Why a finding was left out of the order: it repeats another one. */
  repeatOf: number | null;
}

const MAX_KEPT = 5;
const MIN_KEPT = 3;
/** A fourth or fifth finding is put forward only when it is at least this severe. */
const WORTH_ADDING = 3;

/**
 * Ranks the findings that can be put to an owner: those reproduced or approved. The top three
 * are kept, and a fourth and fifth when they are severe enough to earn the place.
 */
export function rankFindings<T extends Rankable>(findings: T[]): Ranked<T>[] {
  const live = findings.filter((f) => f.status === 'reproduced' || f.status === 'approved');
  const repeated = new Map(live.map((f) => [f.id, repeats(f, live)?.id ?? null]));
  const ordered = live
    .filter((f) => repeated.get(f.id) === null)
    .map((f) => ({ finding: f, group: groupOf(f) }))
    .sort((a, b) => ORDER.indexOf(a.group) - ORDER.indexOf(b.group) || b.finding.severity - a.finding.severity || b.finding.score - a.finding.score || a.finding.id - b.finding.id);
  const out: Ranked<T>[] = ordered.map((r, i) => ({ ...r, place: i + 1, kept: i < MIN_KEPT || (i < MAX_KEPT && r.finding.severity >= WORTH_ADDING), repeatOf: null }));
  // A fifth is kept only when the fourth is: the kept findings are always the first few in order.
  const firstLeftOut = out.findIndex((r) => !r.kept);
  if (firstLeftOut >= 0) for (const r of out.slice(firstLeftOut)) r.kept = false;
  for (const f of live) if (repeated.get(f.id) !== null) out.push({ finding: f, group: groupOf(f), place: out.length + 1, kept: false, repeatOf: repeated.get(f.id)! });
  return out;
}
