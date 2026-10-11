import type { Tier } from '@plumbline/core';

export interface CheckMeta {
  id: string;
  pack: 'core' | 'tourism';
  tier: Tier;
  title: string;
}

/** Every check Plumbline can report. Each needs a module and an impact library entry. */
export const CHECKS: CheckMeta[] = [
  { id: 'C01_placeholder_text', pack: 'core', tier: 'measured', title: 'Placeholder or template text is visible' },
  { id: 'C02_stale_copyright', pack: 'core', tier: 'measured', title: 'Copyright year is out of date' },
  { id: 'C03_stale_dated_notice', pack: 'core', tier: 'rule', title: 'A notice about a past date is still showing' },
  { id: 'C04_seasonal_mismatch', pack: 'core', tier: 'rule', title: 'A seasonal message is showing out of season' },
  { id: 'C05_possible_compromise', pack: 'core', tier: 'judgment', title: 'Content that does not belong to the business' },
  { id: 'C05b_hidden_injected_content', pack: 'core', tier: 'judgment', title: 'Hidden content that does not belong to the business' },
  { id: 'C06_broken_images', pack: 'core', tier: 'measured', title: 'Images fail to load' },
  { id: 'C10_broken_contact_links', pack: 'core', tier: 'measured', title: 'A contact link is broken' },
  { id: 'C11_dead_navigation', pack: 'core', tier: 'measured', title: 'Menu items lead nowhere' },
  { id: 'C12_broken_internal_links', pack: 'core', tier: 'measured', title: 'Internal links end in an error' },
  { id: 'C13_no_action_above_fold', pack: 'core', tier: 'rule', title: 'No way to book or contact on the first phone screen' },
  { id: 'C14_no_price_visible', pack: 'core', tier: 'rule', title: 'No price is visible' },
  { id: 'C15_contact_details_missing', pack: 'core', tier: 'rule', title: 'No phone or email on the homepage' },
  { id: 'C16_booking_hard_to_reach', pack: 'core', tier: 'measured', title: 'Booking is hard to reach' },
  { id: 'C20_slow_mobile', pack: 'core', tier: 'measured', title: 'The page is slow on a phone' },
  { id: 'C23_not_mobile_friendly', pack: 'core', tier: 'measured', title: 'The page does not fit a phone screen' },
  { id: 'C31_no_structured_data', pack: 'core', tier: 'measured', title: 'No business structured data' },
  { id: 'C33_robots_blocks_search_or_ai', pack: 'core', tier: 'measured', title: 'robots.txt blocks search or AI readers' },
  { id: 'C36_thin_homepage', pack: 'core', tier: 'measured', title: 'The homepage says very little' },
  { id: 'C37_not_named_by_ai', pack: 'core', tier: 'measured', title: 'AI tools name others and not this business' },
  { id: 'C38_inconsistent_contact_details', pack: 'core', tier: 'rule', title: 'Contact details differ between site and listing' },
  { id: 'C40_insecure_connection', pack: 'core', tier: 'measured', title: 'The connection is not secure' },
  { id: 'C41_outdated_platform', pack: 'core', tier: 'measured', title: 'The site software is past end of life' },
  { id: 'C50_accessibility_failures', pack: 'core', tier: 'measured', title: 'Serious accessibility failures' },
  { id: 'C60_conflicting_facts', pack: 'core', tier: 'judgment', title: 'The same fact appears with different values' },
  { id: 'C61_price_differs_from_listing', pack: 'core', tier: 'rule', title: 'Price differs between site and listing' },
  { id: 'C70_reviews_not_shown', pack: 'core', tier: 'rule', title: 'Strong reviews are not shown on the site' },
  { id: 'T01_no_online_booking', pack: 'tourism', tier: 'rule', title: 'No online booking on the site' },
  { id: 'T02_booking_system_not_linked', pack: 'tourism', tier: 'rule', title: 'The booking system is not linked from the site' },
  { id: 'T03_platform_dependency', pack: 'tourism', tier: 'rule', title: 'Sold on booking platforms but not on the site' },
  { id: 'T05_season_info_missing', pack: 'tourism', tier: 'rule', title: 'No season or departure times shown' },
];

export const CHECK_IDS = CHECKS.map((c) => c.id);
