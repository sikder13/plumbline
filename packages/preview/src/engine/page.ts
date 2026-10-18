import type { ImpactEntry } from '@plumbline/impact';
import { nzReadable, plainDates, plainImpact, withoutDashes } from '../build.ts';
import type { FindingCard } from '../types.ts';

/** The parts of a wave's fact pack (reports/<batch>/<wave>/<slug>.json) a page and its email use. */
export interface FactPack {
  slug: string;
  name: string;
  website: string;
  category: string;
  to: { address: string | null; source_url: string | null; on_source_page?: boolean };
  greeting: string | null;
  greeting_names: string[];
  owner_source_url?: string | null;
  findings: PackFinding[];
  flags: { facts_changed: string[]; faith: string[]; security_review: string[]; refuses_unsolicited: string | null; speed: string | null };
  notes?: { csv?: string | null; trading_signs?: string[] };
  phone?: { url: string } | null;
  recheck?: { measured_at: string; fresh_until: string; command: string };
  recommendation: string;
}

export interface PackFinding {
  place: number;
  tier: number;
  type: string;
  sentence: string;
  measured: string;
  evidence_url: string;
  linked_from: string | null;
  measured_at: string;
  source: string;
  on_main_page: boolean;
}

/**
 * The check in the impact library that each kind of finding belongs to, for its fix line, and
 * whether its impact sentence holds for this kind too. A leftover page nobody links to is not seen
 * by visitors, so it keeps the fix but not the impact. Kinds with no check here show neither.
 */
export const PACK_CHECKS: Record<string, { check: string; impact: boolean }> = {
  phone_no_action: { check: 'C13_no_action_above_fold', impact: true },
  phone_wider: { check: 'C23_not_mobile_friendly', impact: true },
  phone_sideways: { check: 'C23_not_mobile_friendly', impact: true },
  placeholder_text: { check: 'C01_placeholder_text', impact: true },
  hello_world: { check: 'C01_placeholder_text', impact: false },
  template_post: { check: 'C01_placeholder_text', impact: false },
  demo_page: { check: 'C01_placeholder_text', impact: false },
  coming_soon_page: { check: 'C01_placeholder_text', impact: false },
  blank_page: { check: 'C01_placeholder_text', impact: false },
  maintenance_page: { check: 'C01_placeholder_text', impact: false },
  stale_copyright: { check: 'C02_stale_copyright', impact: true },
  covid_wording: { check: 'C03_stale_dated_notice', impact: true },
  passed_notice: { check: 'C03_stale_dated_notice', impact: true },
  broken_images: { check: 'C06_broken_images', impact: true },
  contact_link_broken: { check: 'C10_broken_contact_links', impact: true },
  dead_menu_item: { check: 'C11_dead_navigation', impact: true },
  dead_menu_booking: { check: 'C11_dead_navigation', impact: true },
  broken_link: { check: 'C12_broken_internal_links', impact: true },
  book_link_broken: { check: 'C12_broken_internal_links', impact: true },
  book_button_missing: { check: 'C12_broken_internal_links', impact: true },
  book_button_contact: { check: 'C16_booking_hard_to_reach', impact: true },
  booking_page_unlinked: { check: 'C16_booking_hard_to_reach', impact: false },
  booking_system_not_linked: { check: 'T02_booking_system_not_linked', impact: true },
  outdated_software: { check: 'C41_outdated_platform', impact: true },
};

/** Checks whose fix line speaks of the booking system the business already pays for: shown only where it has one. */
const NEEDS_BOOKING_SYSTEM = new Set(['C16_booking_hard_to_reach', 'T02_booking_system_not_linked']);

/** Kinds whose measured words would put on the page what the page must never show, such as a client's testimonial. */
const NOT_QUOTED = new Set(['physio_testimonials']);

/** The phone screen kinds, shown with the first phone screen of the homepage. */
export const PHONE_KINDS = new Set(['phone_no_action', 'phone_wider', 'phone_sideways']);

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

/**
 * What was seen, in the pack's words: the note left for us by the second tool taken off, dashes
 * inside a quoted title set as commas, and ending on a full stop.
 */
export function seenOf(f: PackFinding): string | null {
  if (NOT_QUOTED.has(f.type)) return null;
  let text = f.measured.replace(/\s*Caution from Crawlmouse:.*$/s, '').trim();
  text = text.replace(/^At (\d+) by (\d+) phone screen /, 'On a phone screen $1 by $2 pixels, ');
  // A date stored as 2022-11-28 is written out, and dashes inside a quoted title are set as commas.
  text = withoutDashes(plainDates(text)) ?? '';
  if (!text) return null;
  return /[.!?"]$/.test(text) ? text : `${text}.`;
}

/** The page a finding was measured on: where a broken link sits, or the business's own site for a fact read elsewhere. */
export function measuredOn(f: PackFinding, website: string): string {
  if (f.linked_from) return f.linked_from;
  // A button on the homepage that opens the wrong page was measured on the homepage, not on the page it opens.
  if (/\bon your homepage\b/i.test(f.sentence)) return website;
  if (host(f.evidence_url) && host(f.evidence_url) === host(website)) return f.evidence_url;
  return website;
}

/**
 * The cards of the findings tab: the pack's top findings, in its order and its plain sentences,
 * each with the measured value, the page it was measured on and the time. Up to three.
 */
export async function packCards(pack: FactPack, library: Map<string, ImpactEntry>, image: (f: PackFinding) => Promise<FindingCard['shots'][number]['image']>, opts: { bookingSystem: boolean } = { bookingSystem: false }): Promise<FindingCard[]> {
  const cards: FindingCard[] = [];
  for (const f of [...pack.findings].sort((a, b) => a.place - b.place).slice(0, 3)) {
    const at = PACK_CHECKS[f.type];
    const entry = at ? library.get(at.check) : undefined;
    // A fix that speaks of their booking system is not made to a business that has none.
    const fixHolds = entry && (!NEEDS_BOOKING_SYSTEM.has(entry.check) || opts.bookingSystem);
    cards.push({
      check: `${f.type}-${f.place}`,
      title: withoutDashes(f.sentence)!,
      sentence: entry && at?.impact ? plainImpact(entry.impact) : '',
      fix: fixHolds ? entry.fix : '',
      measuredNz: nzReadable(f.measured_at),
      pageUrl: measuredOn(f, pack.website),
      shots: [{ image: await image(f), seen: seenOf(f) }],
      score: 100 - f.place,
    });
  }
  return cards;
}
