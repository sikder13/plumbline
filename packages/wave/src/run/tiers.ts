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
  5: 'visible leftovers',
  6: 'outdated software',
  7: 'minor search items',
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
const n = (count: number | undefined, one: string, many: string) => ((count ?? 1) === 1 ? one : many);

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
  | 'seasonal_notice'
  | 'stale_copyright'
  | 'broken_images'
  | 'broken_link'
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
  book_link_broken: { tier: 1, order: 2, sentence: (f) => `The ${q(f.label)} link on your ${here(f)} opens a page that is not found.` },
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
  phone_no_action: { tier: 4, order: 2, sentence: () => 'The first phone screen of your homepage has no button to book, call or email.' },
  hello_world: { tier: 5, order: 1, sentence: () => 'The default "Hello world!" post is still live on your website.' },
  template_post: { tier: 5, order: 2, sentence: (f) => `A template blog post titled ${q(f.title)} is still live on your website.` },
  demo_page: { tier: 5, order: 3, sentence: (f) => `A page titled ${q(f.title)} is still live on your website.` },
  coming_soon_page: { tier: 5, order: 4, sentence: () => 'A "coming soon" page is still live on your website.' },
  maintenance_page: { tier: 5, order: 5, sentence: (f) => `A page titled ${q(f.title)} is still live on your website.` },
  blank_page: { tier: 5, order: 6, sentence: (f) => `${n(f.count, 'A blank page', `${f.count} blank pages`)} titled ${q(f.title)} ${n(f.count, 'is', 'are')} still live on your website.` },
  placeholder_text: { tier: 5, order: 7, sentence: (f) => `Placeholder text, ${q(f.text)}, is showing on your ${here(f)}.` },
  copy_of_address: { tier: 5, order: 8, sentence: (f) => `${f.count ?? 1} of your pages ${n(f.count, 'has a web address', 'have web addresses')} that ${n(f.count, 'starts', 'start')} with copy of, so the address names a different page from its content.` },
  passed_notice: { tier: 5, order: 9, sentence: (f) => `A notice about a date that has passed is still showing on your ${here(f)}.` },
  seasonal_notice: { tier: 5, order: 10, sentence: (f) => `A ${f.season ?? 'seasonal'} message is still showing on your ${here(f)}, out of season.` },
  stale_copyright: { tier: 5, order: 11, sentence: (f) => `The footer on your ${here(f)} still says ${f.year ?? 'an old year'}.` },
  broken_images: { tier: 5, order: 12, sentence: (f) => `${n(f.count, '1 image', `${f.count} images`)} on your ${here(f)} ${n(f.count, 'does', 'do')} not load.` },
  broken_link: { tier: 5, order: 13, sentence: (f) => `The ${q(f.label)} link on your ${here(f)} opens a page that is not found.` },
  dead_menu_item: { tier: 5, order: 14, sentence: (f) => `The menu item ${q(f.label)} on your ${here(f)} leads nowhere.` },
  outdated_software: { tier: 6, order: 1, sentence: (f) => `Your website runs ${noDash(f.product ?? 'software')} ${f.version ?? ''}, which has had no support since ${f.since ?? 'an earlier date'}.`.replace(/\s+,/, ',') },
  no_description: { tier: 7, order: 1, sentence: (f) => (f.of && f.of > 1 ? `${f.count} of the ${f.of} pages we read have no description for search results.` : 'Your homepage has no description for search results.') },
  no_heading: { tier: 7, order: 2, sentence: (f) => (f.of && f.of > 1 ? `${f.count} of the ${f.of} pages we read have no main heading.` : 'Your homepage has no main heading.') },
  no_structured_data: { tier: 7, order: 3, sentence: (f) => (f.of && f.of > 1 ? `${f.count} of the ${f.of} pages we read carry no structured data describing the business.` : 'Your homepage carries no structured data describing the business.') },
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
}

export interface RankedFinding extends RawFinding {
  sentence: string;
  tier: Tier;
  place: number;
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
  const agency = ctx.agencies.find((a) => a.length >= 4 && text.includes(a.toLowerCase()));
  if (agency) return `names a web agency (${agency})`;
  return null;
}

/**
 * Filters, removes duplicates, ranks by tier and keeps three. A minor search item (tier 7) is only
 * ever third; where fewer than two better findings exist it is not put forward at all.
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
    kept.push({ ...f, sentence: sentenceFor(f.type, f.facts), tier: KINDS[f.type].tier, place: 0 });
  }
  kept.sort((a, b) => a.tier - b.tier || KINDS[a.type].order - KINDS[b.type].order || (a.source === b.source ? 0 : a.source === 'plumbline' ? -1 : 1));
  const unique: RankedFinding[] = [];
  for (const f of kept) {
    const twin = unique.find((u) => u.key === f.key || u.sentence === f.sentence);
    if (twin) dropped.push({ type: f.type, key: f.key, reason: `duplicate of a ${TIER_NAMES[twin.tier]} item` });
    else unique.push(f);
  }
  const major = unique.filter((f) => f.tier < 7);
  const minor = unique.filter((f) => f.tier === 7);
  const top = major.slice(0, 3);
  if (top.length === 2 && minor.length) top.push(minor[0]!);
  top.forEach((f, i) => (f.place = i + 1));
  return { top, rest: unique.filter((f) => !top.includes(f)), dropped };
}

export const recommendation = (top: RankedFinding[]): 'BUILD' | 'RESERVE' => (top.some((f) => f.tier <= 5) ? 'BUILD' : 'RESERVE');
