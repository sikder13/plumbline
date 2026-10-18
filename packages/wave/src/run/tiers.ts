/**
 * Findings of a wave run: the kinds there are, the tier of each, the one sentence each is said in,
 * and the rules that filter and rank them. No sentence about a finding is written anywhere else.
 */

export type Tier = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const TIER_NAMES: Record<Tier, string> = {
  1: 'booking or contact broken',
  2: 'compliance',
  3: 'speed',
  4: 'phone fit',
  5: 'visible leftovers a visitor finds embarrassing',
  6: 'hygiene, never leads',
  7: 'minor, never leads and never in a subject',
};

export interface Facts {
  label?: string;
  page?: string;
  title?: string;
  count?: number;
  of?: number;
  score?: number;
  seconds?: number;
  product?: string;
  version?: string;
  since?: string;
  year?: string;
  season?: string;
  what?: string;
  noun?: string;
  text?: string;
  system?: string;
  kind?: string;
}

/** Hyphens and dashes become spaces, so a sentence never holds one. */
export const noDash = (s: string): string => s.replace(/[\u2010-\u2015\u2212-]+/g, ' ').replace(/\s+/g, ' ').trim();

/** How a page is named in a sentence: "homepage", or the last words of its address. */
export function pageName(url: string | undefined): string {
  if (!url) return 'homepage';
  try {
    const path = new URL(url).pathname.replace(/\/$/, '').replace(/\.(?:html?|php)$/i, '');
    if (!path) return 'homepage';
    return `${noDash(decodeURIComponent(path.split('/').pop() ?? '').replace(/_/g, ' '))} page`;
  } catch {
    return 'homepage';
  }
}

const q = (s: string | undefined) => `"${noDash(s ?? 'link').replace(/"/g, '')}"`;
const here = (f: Facts) => f.page ?? 'homepage';
/** "The \"Book\" link", or "A link" when the link has no words on it. */
const linkRef = (f: Facts) => (f.label && !/^link$/i.test(f.label) ? `The ${q(f.label)} link` : 'A link');
const n = (count: number | undefined, one: string, many: string) => ((count ?? 1) === 1 ? one : many);

/** "None of the 7 pages we read has X", "3 of the 7 pages we read lack X", or for a single page "Your homepage has no X". */
function lacking(f: Facts, what: string): string {
  const count = f.count ?? 1;
  const of = f.of ?? 1;
  if (of <= 1) return `Your homepage has no ${what.replace(/^a /, '')}.`;
  if (count >= of) return `None of the ${of} pages we read has ${what}.`;
  return `${count} of the ${of} pages we read ${count === 1 ? 'has' : 'have'} no ${what.replace(/^a /, '')}.`;
}

export type FindingType =
  | 'no_way_to_book'
  | 'book_button_missing'
  | 'book_link_broken'
  | 'book_button_section_missing'
  | 'book_button_contact'
  | 'form_not_loading'
  | 'contact_link_broken'
  | 'dead_menu_booking'
  | 'booking_page_unlinked'
  | 'booking_system_not_linked'
  | 'physio_testimonials'
  | 'slow_phone'
  | 'phone_sideways'
  | 'phone_wider'
  | 'phone_no_action'
  | 'hello_world'
  | 'template_post'
  | 'demo_page'
  | 'coming_soon_page'
  | 'maintenance_page'
  | 'blank_page'
  | 'placeholder_text'
  | 'copy_of_address'
  | 'passed_notice'
  | 'covid_wording'
  | 'stale_copyright'
  | 'last_updated'
  | 'broken_images'
  | 'broken_link'
  | 'social_link_broken'
  | 'dead_menu_item'
  | 'outdated_software'
  | 'no_description'
  | 'no_heading'
  | 'no_structured_data';

interface Kind {
  tier: Tier;
  /** Place among the kinds of its tier: lower is said first. */
  order: number;
  sentence: (f: Facts) => string;
}

export const KINDS: Record<FindingType, Kind> = {
  no_way_to_book: { tier: 1, order: 0, sentence: (f) => `Your website shows prices for ${f.noun ?? 'tours'} but gives no way to book or enquire.` },
  book_button_missing: { tier: 1, order: 1, sentence: (f) => `The ${q(f.label)} button on your ${here(f)} opens a page that is not found.` },
  book_link_broken: { tier: 1, order: 2, sentence: (f) => `${linkRef(f)} on your ${here(f)} opens a page that is not found.` },
  book_button_section_missing: { tier: 1, order: 3, sentence: (f) => `The ${q(f.label)} button on your ${here(f)} jumps to a section that is not on the page.` },
  book_button_contact: { tier: 1, order: 4, sentence: (f) => `The ${q(f.label)} button on your ${here(f)} opens your contact page, not a booking page.` },
  form_not_loading: { tier: 1, order: 5, sentence: (f) => `The ${f.what ?? 'enquiry form'} on your ${here(f)} does not load.` },
  contact_link_broken: { tier: 1, order: 6, sentence: (f) => `The ${f.kind ?? 'contact'} link on your ${here(f)} does not work.` },
  dead_menu_booking: { tier: 1, order: 7, sentence: (f) => `The menu item ${q(f.label)} on your ${here(f)} leads nowhere.` },
  booking_page_unlinked: { tier: 1, order: 8, sentence: (f) => `Your ${pageName(f.page).replace(/ page$/, '')} page is live, but nothing on your site links to it.` },
  booking_system_not_linked: { tier: 1, order: 9, sentence: (f) => `Your ${f.system ? `${noDash(f.system)} ` : 'online '}booking system is not linked from your website.` },
  physio_testimonials: { tier: 2, order: 1, sentence: (f) => `Your homepage shows ${f.what ?? 'testimonials from clients'}.` },
  slow_phone: { tier: 3, order: 1, sentence: (f) => `Your homepage scores ${f.score ?? 0} out of 100 on a phone, and its main content appears after ${f.seconds ?? 0} seconds.` },
  phone_sideways: { tier: 4, order: 1, sentence: () => 'Your homepage scrolls sideways on a phone.' },
  phone_wider: { tier: 4, order: 2, sentence: () => 'Your homepage is wider than a phone screen.' },
  phone_no_action: { tier: 4, order: 3, sentence: () => 'The first phone screen of your homepage has no button to book, call or email.' },
  hello_world: { tier: 5, order: 1, sentence: () => 'The default "Hello world!" post is still live on your website.' },
  template_post: { tier: 5, order: 2, sentence: (f) => `A template blog post titled ${q(f.title)} is still live on your website.` },
  demo_page: { tier: 5, order: 3, sentence: (f) => `A page titled ${q(f.title)} is still live on your website.` },
  coming_soon_page: { tier: 5, order: 4, sentence: () => 'A "coming soon" page is still live on your website.' },
  maintenance_page: { tier: 5, order: 5, sentence: (f) => `A page titled ${q(f.title)} is still live on your website.` },
  blank_page: { tier: 6, order: 6, sentence: (f) => `${n(f.count, 'A blank page', `${f.count} blank pages`)} called ${q(f.title)} ${n(f.count, 'is', 'are')} still live on your website.` },
  placeholder_text: { tier: 5, order: 7, sentence: (f) => `Placeholder text, ${q(f.text)}, is showing on your ${here(f)}.` },
  copy_of_address: { tier: 5, order: 8, sentence: (f) => `${f.count ?? 1} of your pages ${n(f.count, 'has a web address', 'have web addresses')} that ${n(f.count, 'starts', 'start')} with copy of, so the address names a different page from its content.` },
  passed_notice: { tier: 5, order: 9, sentence: (f) => `A notice about a date that has passed is still showing on your ${here(f)}.` },
  broken_images: { tier: 5, order: 10, sentence: (f) => `${n(f.count, '1 image', `${f.count} images`)} on your ${here(f)} ${n(f.count, 'does', 'do')} not load.` },
  covid_wording: { tier: 6, order: 11, sentence: (f) => `COVID wording is still showing on your ${here(f)}.` },
  stale_copyright: { tier: 7, order: 0, sentence: (f) => `The footer on your ${here(f)} still says ${f.year ?? 'an old year'}.` },
  broken_link: { tier: 5, order: 13, sentence: (f) => `${linkRef(f)} on your ${here(f)} opens a page that is not found.` },
  dead_menu_item: { tier: 5, order: 14, sentence: (f) => `The menu item ${q(f.label)} on your ${here(f)} leads nowhere.` },
  social_link_broken: { tier: 6, order: 15, sentence: (f) => `The ${f.kind ?? 'social'} link on your ${here(f)} does not work.` },
  last_updated: { tier: 7, order: 0, sentence: (f) => `Your ${here(f)} shows a last updated date from ${f.year ?? 'long ago'}.` },
  outdated_software: { tier: 6, order: 1, sentence: (f) => `Your website runs ${noDash(f.product ?? 'software')} ${f.version ?? ''}, which has had no support since ${f.since ?? 'an earlier date'}.`.replace(/\s+,/, ',') },
  no_description: { tier: 7, order: 2, sentence: (f) => lacking(f, 'a description for search results') },
  no_heading: { tier: 7, order: 3, sentence: (f) => lacking(f, 'a main heading') },
  no_structured_data: { tier: 7, order: 4, sentence: (f) => lacking(f, 'structured data describing the business') },
};

export const sentenceFor = (type: FindingType, facts: Facts): string => {
  const s = KINDS[type].sentence(facts).replace(/\s+/g, ' ').trim();
  return noDash(s).replace(/\s+([,.])/g, '$1');
};

export interface RawFinding {
  type: FindingType;
  facts: Facts;
  /** What was measured, in plain words. */
  measured: string;
  evidenceUrl: string;
  /** For a missing page, the page of theirs that links to it. */
  linkedFrom?: string;
  /** Findings with the same key are one problem seen twice. */
  key: string;
  source: 'plumbline' | 'crawlmouse';
  checkId?: string;
  /** Crawlmouse items: false when opening the example pages today did not show it. */
  reproduced?: boolean;
  /** A missing page that none of their pages links to. */
  unlinked?: boolean;
  /** Speed items: false when the two runs disagree or could not be made. */
  steady?: boolean;
  measuredAt: string;
  /** A tier other than the kind's own: hygiene on a page nobody is sent to, or on a jobs or terms page. */
  tier?: Tier;
  /** The page on which a visitor meets it. */
  page?: string;
  /** That page is the homepage or a page in the main menu. */
  onMain?: boolean;
  /** How big the measured problem is, for ordering findings of one tier: seconds lost, pixels too wide, pages affected. */
  size?: number;
}

export interface RankedFinding extends RawFinding {
  sentence: string;
  tier: Tier;
  place: number;
  /** Tier 7 items are never put in a subject line. */
  subjectOk: boolean;
}

export interface Dropped {
  type: FindingType;
  key: string;
  reason: string;
}

export interface RankContext {
  /** Names and hosts of whoever built the site. A finding that carries one is dropped. */
  agencies: string[];
}

/** Why a finding is filtered out before ranking, or null when it stays. */
export function dropReason(f: RawFinding, ctx: RankContext): string | null {
  if (f.reproduced === false) return 'does not reproduce today';
  if (f.unlinked) return 'a missing page that nothing links to';
  if (f.steady === false) return 'speed unstable or unavailable';
  const text = `${f.measured} ${f.evidenceUrl} ${f.linkedFrom ?? ''} ${Object.values(f.facts).join(' ')}`.toLowerCase();
  const agency = ctx.agencies.find((a) => a.trim().length >= 3 && new RegExp(`\\b${a.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(text));
  if (agency) return `names a web agency (${agency})`;
  return null;
}

/**
 * Filters, removes duplicates and ranks by tier, then keeps three. Nothing from tier 6 or 7 leads,
 * and a tier 7 item is only ever third. Within a tier an item that sits on the homepage or in the
 * main menu comes first, then the kinds in their order, then the bigger measurement.
 */
export function rankRunFindings(raw: RawFinding[], ctx: RankContext): { top: RankedFinding[]; rest: RankedFinding[]; dropped: Dropped[] } {
  const dropped: Dropped[] = [];
  const kept: RankedFinding[] = [];
  for (const f of raw) {
    const reason = dropReason(f, ctx);
    if (reason) {
      dropped.push({ type: f.type, key: f.key, reason });
      continue;
    }
    const tier = f.tier ?? KINDS[f.type].tier;
    kept.push({ ...f, sentence: sentenceFor(f.type, f.facts), tier, place: 0, subjectOk: tier <= 6 });
  }
  const main = (f: RankedFinding) => (f.onMain === false ? 1 : 0);
  kept.sort((a, b) => a.tier - b.tier || main(a) - main(b) || KINDS[a.type].order - KINDS[b.type].order || (b.size ?? 1) - (a.size ?? 1) || (a.source === b.source ? 0 : a.source === 'plumbline' ? -1 : 1));
  const unique: RankedFinding[] = [];
  for (const f of kept) {
    const twin = unique.find((u) => u.key === f.key || u.sentence === f.sentence);
    if (twin) dropped.push({ type: f.type, key: f.key, reason: `duplicate of a ${TIER_NAMES[twin.tier]} item` });
    else unique.push(f);
  }
  const top: RankedFinding[] = [];
  if (unique.some((f) => f.tier <= 5)) {
    for (const f of unique) {
      if (top.length === 3) break;
      if (f.tier === 7 && top.length < 2) continue;
      top.push(f);
    }
  }
  top.forEach((f, i) => (f.place = i + 1));
  return { top, rest: unique.filter((f) => !top.includes(f)), dropped };
}

/**
 * BUILD only when the lead finding is tier 1 to 4, or a tier 5 item on the homepage or in the main
 * menu. Everything else is RESERVE.
 */
export function recommendation(top: RankedFinding[]): 'BUILD' | 'RESERVE' {
  const lead = top[0];
  if (!lead) return 'RESERVE';
  return lead.tier <= 4 || (lead.tier === 5 && lead.onMain === true) ? 'BUILD' : 'RESERVE';
}
