import { CHECKS } from './ids.ts';
import { C13_no_action_above_fold, C14_no_price_visible, C15_contact_details_missing, C16_booking_hard_to_reach } from './packs/core/action-checks.ts';
import { C01_placeholder_text, C02_stale_copyright, C03_stale_dated_notice, C04_seasonal_mismatch, C05_possible_compromise, C36_thin_homepage, C60_conflicting_facts } from './packs/core/content-checks.ts';
import { C06_broken_images, C10_broken_contact_links, C11_dead_navigation, C12_broken_internal_links } from './packs/core/link-checks.ts';
import { C37_not_named_by_ai, C38_inconsistent_contact_details, C61_price_differs_from_listing, C70_reviews_not_shown } from './packs/core/source-checks.ts';
import { C20_slow_mobile, C23_not_mobile_friendly, C31_no_structured_data, C33_robots_blocks_search_or_ai, C40_insecure_connection, C41_outdated_platform, C50_accessibility_failures } from './packs/core/technical-checks.ts';
import { T01_no_online_booking, T02_booking_system_not_linked, T03_platform_dependency, T05_season_info_missing } from './packs/tourism/checks.ts';
import type { Check } from './types.ts';

export const CORE_PACK: Check[] = [
  C01_placeholder_text,
  C02_stale_copyright,
  C03_stale_dated_notice,
  C04_seasonal_mismatch,
  C05_possible_compromise,
  C06_broken_images,
  C10_broken_contact_links,
  C11_dead_navigation,
  C12_broken_internal_links,
  C13_no_action_above_fold,
  C14_no_price_visible,
  C15_contact_details_missing,
  C16_booking_hard_to_reach,
  C20_slow_mobile,
  C23_not_mobile_friendly,
  C31_no_structured_data,
  C33_robots_blocks_search_or_ai,
  C36_thin_homepage,
  C37_not_named_by_ai,
  C38_inconsistent_contact_details,
  C40_insecure_connection,
  C41_outdated_platform,
  C50_accessibility_failures,
  C60_conflicting_facts,
  C61_price_differs_from_listing,
  C70_reviews_not_shown,
];

export const TOURISM_PACK: Check[] = [T01_no_online_booking, T02_booking_system_not_linked, T03_platform_dependency, T05_season_info_missing];

export const PACKS: Record<string, Check[]> = { core: CORE_PACK, tourism: TOURISM_PACK };

/** The core pack plus the industry pack for this business. */
export function checksFor(pack: string): Check[] {
  return [...CORE_PACK, ...(pack !== 'core' ? (PACKS[pack] ?? []) : [])];
}

export function checkById(id: string): Check | undefined {
  return [...CORE_PACK, ...TOURISM_PACK].find((c) => c.id === id);
}

/** Fails when the list of check ids and the modules disagree, in either direction. */
export function registryProblems(): string[] {
  const problems: string[] = [];
  const modules = new Map([...CORE_PACK, ...TOURISM_PACK].map((c) => [c.id, c]));
  for (const meta of CHECKS) {
    const m = modules.get(meta.id);
    if (!m) problems.push(`${meta.id}: listed but has no module`);
    else if (m.pack !== meta.pack || m.tier !== meta.tier) problems.push(`${meta.id}: module says ${m.pack}/${m.tier}, list says ${meta.pack}/${meta.tier}`);
  }
  for (const id of modules.keys()) if (!CHECKS.some((c) => c.id === id)) problems.push(`${id}: module is not in the list`);
  return problems;
}
