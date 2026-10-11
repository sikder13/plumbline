# Calibration on the first 20

Batch `calib-20`, written 2026-10-11 16:27:32 NZDT.

Truth comes from `calibration/truth.json`, built from the 20 dossiers. A match is a verified dossier problem that Plumbline found. A false finding is anything the dossiers mark as false or unverified. A new finding is something Plumbline found that the dossiers do not list, for UD to judge.

## Totals

| Measure | Count |
|---|---|
| Verified problems that map to a check | 70 |
| Matches | 37 |
| False findings (must be zero) | 0 |
| Missed, with a known reason | 33 |
| Missed, not detected | 0 |
| New findings for UD to judge | 78 |

## By business

| Business | Stage | Matches | False | Missed | New |
|---|---|---|---|---|---|
| target-charters | reproduced | T01, T03 | 0 | C61, C38 | C20, C13, C14, C31, C50 |
| coastal-kayakers | reproduced | C02, C11, C14 | 0 | C70 | C20, C13, C31, C50, C12 |
| trek-lake-okareka | reproduced | C05b, C61 | 0 | C05, C38, C70, C41 | C20, C13, C14, C31, C50 |
| taupo-boating-and-fishing-charters | reproduced | C14, T01, T03, C70 | 0 | C01 | C23, C61, C31, C50 |
| cathedral-cove-kayak-tours | reproduced | C61 | 0 | C36, C15, C33, C03 | C20, C14, C31, C50 |
| spellbound-glowworm-and-cave-tours | reproduced | 0 | 0 | C60 | C20, C13, C61, C31, C50 |
| raglan-boat-charters | reproduced | C04, C14, C03 | 0 | C61 | C20, C31, C50 |
| kahu-kayaks | reproduced | C02 | 0 | C03, C60 | C20, C31, C50 |
| golden-bay-kayaks | reproduced | C60, C14 | 0 | 0 | C10, C20, C23, C50, C12 |
| marlborough-sounds-adventure-company | reproduced | C14 | 0 | C15, C13, C03 | C20, C61, C11, C50, C12 |
| reel-therapy-charters | reproduced | T01, T03, C14 | 0 | 0 | C20, C50 |
| bladen-wines | reproduced | C36 | 0 | 0 | T01, C13, C14, T03, C15, C50 |
| seal-swim-kaikoura | reproduced | 0 | 0 | C61, T01, T03, C03 | C20, C31, C50 |
| okarito-kayaks | reproduced | 0 | 0 | C14, T02, C38, C03, C70 | 0 |
| glacier-valley-eco-tours | reproduced | C14, C02 | 0 | C11 | C50 |
| hokitika-scenic-tours | reproduced | C01, C14 | 0 | 0 | C20, C13, C70, C50 |
| the-seventh-generation-tours | reproduced | C10, T01, T03 | 0 | 0 | C41, C13, C14, C50 |
| pohatu-penguins | reproduced | C02 | 0 | C11 | C20, C14, C10, C50 |
| grey-ridge-vineyard | reproduced | C11, C14 | 0 | C01, T05 | T01, C20, C41, C13, C31, C50 |
| top-of-the-lake-guiding | reproduced | C10, C14, C02, T01 | 0 | C01 | C20, C13, C15, C50 |

## Missed findings and why

- **target-charters** C61_price_differs_from_listing (Site from $200 per person, newzealand.com Adult $135.) Reason: The newzealand.com listing answers automated requests with 403. That is a block and is not worked around, so the listing could not be read.
- **target-charters** C38_inconsistent_contact_details (Site email is a personal xtra address, newzealand.com shows sales@.) Reason: The newzealand.com listing answers automated requests with 403. That is a block and is not worked around, so the listing could not be read.
- **coastal-kayakers** C70_reviews_not_shown (5.0 from 289 reviews not shown.) Reason: The site shows TripAdvisor award badges and a testimonial, so the check stays quiet by design.
- **trek-lake-okareka** C05_possible_compromise (Czech betting article with a link to betzoid.com on the homepage.) Reason: The Czech text is in the page code but hidden from visitors (a block one pixel high), so it is reported under C05b, not as visible content.
- **trek-lake-okareka** C38_inconsistent_contact_details (021 292 2233 on the site, 07 362 8185 on newzealand.com.) Reason: The newzealand.com listing answers automated requests with 403. That is a block and is not worked around, so the listing could not be read.
- **trek-lake-okareka** C70_reviews_not_shown (4.8 from 857 TripAdvisor reviews, no score on the homepage.) Reason: The site shows a TripAdvisor sign image, so the check stays quiet by design.
- **trek-lake-okareka** C41_outdated_platform (WordPress 6.2.14.) Reason: The 6.2 branch still receives security releases (6.2.14 is one), so it is not past end of life by the table's rule.
- **taupo-boating-and-fishing-charters** C01_placeholder_text (Stray text aaaaaaaaaaaaiii on About and Find Us.) Reason: The stray text was not found as visible text on the 13 pages read in a browser.
- **cathedral-cove-kayak-tours** C36_thin_homepage (97 visible words.) Reason: In a browser the homepage shows about 340 words. The dossier's text fetch was refused and saw 97.
- **cathedral-cove-kayak-tours** C15_contact_details_missing (No phone, email or address on the homepage.) Reason: In a browser the homepage shows a freephone number and an email address.
- **cathedral-cove-kayak-tours** C33_robots_blocks_search_or_ai (robots.txt disallows the tour pages.) Reason: robots.txt as served on 10 October 2026 disallows only system folders, not the tour pages.
- **cathedral-cove-kayak-tours** C03_stale_dated_notice (Yes we are open banner from the border closures.) Reason: The banner carries no date and no COVID word, so no rule can date it.
- **spellbound-glowworm-and-cave-tours** C60_conflicting_facts (Homepage prices differ from tour pages; over 30 years against 35+.) Reason: The check compares founding years only. Prices that differ between two pages of the same site are not paired automatically.
- **raglan-boat-charters** C61_price_differs_from_listing (newzealand.com $65/$40 against $75/$46 on the site.) Reason: The newzealand.com listing answers automated requests with 403. That is a block and is not worked around, so the listing could not be read.
- **kahu-kayaks** C03_stale_dated_notice (Vaccine pass rule for RED and ORANGE levels.) Reason: The vaccine pass wording was not visible on the pages read in a browser.
- **kahu-kayaks** C60_conflicting_facts (Swingers Delight NZ $260 pp on the homepage, from NZ$200 on the tours page.) Reason: The check compares founding years only.
- **marlborough-sounds-adventure-company** C15_contact_details_missing (No phone, email or address on the MSAC homepage.) Reason: In a browser the homepage footer shows an email address.
- **marlborough-sounds-adventure-company** C13_no_action_above_fold (No booking button on the MSAC homepage.) Reason: In a browser the first phone screen shows Book Now and Enquire now.
- **marlborough-sounds-adventure-company** C03_stale_dated_notice (Prices valid until 31 August 2024, on nzseakayaking.com.) Reason: That line is on the second website, nzseakayaking.com. The audit covers the main site, marlboroughsounds.co.nz.
- **seal-swim-kaikoura** C61_price_differs_from_listing (Site $110, Bookme and newzealand.com $179.) Reason: No listing that prices this business in NZ dollars could be read and matched by name.
- **seal-swim-kaikoura** T01_no_online_booking (Only a plain-text email, no link to their RTBS engine.) Reason: In a browser the site shows a BOOK NOW link to its RTBS booking engine.
- **seal-swim-kaikoura** T03_platform_dependency (Sold on Bookme.) Reason: Depends on T01, which does not fire because the site links to its booking engine.
- **seal-swim-kaikoura** C03_stale_dated_notice (November 14 earthquake road-closure notice from 2016.) Reason: The notice gives a day and month with no year, so its age cannot be measured.
- **okarito-kayaks** C14_no_price_visible (No prices on the homepage.) Reason: In a browser the homepage shows prices (from $150 and from $80 per person).
- **okarito-kayaks** T02_booking_system_not_linked (okarito.rezdy.com sells 6 products, the site does not link to it.) Reason: In a browser the site links to okarito.rezdy.com from Book buttons.
- **okarito-kayaks** C38_inconsistent_contact_details (0800 652 748 on the site, +64 3 753 4014 on listings.) Reason: The newzealand.com listing answers automated requests with 403. That is a block and is not worked around, so the listing could not be read.
- **okarito-kayaks** C03_stale_dated_notice (Forecast box showing Friday 19 August.) Reason: The dates carry no year, so their age cannot be measured.
- **okarito-kayaks** C70_reviews_not_shown (241 TripAdvisor reviews not surfaced.) Reason: The site shows three testimonials, so the check stays quiet by design.
- **glacier-valley-eco-tours** C11_dead_navigation (A More menu item with no link.) Reason: The More item is not a link, so there is no address to measure.
- **pohatu-penguins** C11_dead_navigation (24 hour Pohatu package links to #.) Reason: Only reported if that link sits in the homepage menu.
- **grey-ridge-vineyard** C01_placeholder_text (index.php shown as the first heading or link.) Reason: index.php is the address behind the logo link. It is not shown as text in a browser.
- **grey-ridge-vineyard** T05_season_info_missing (No opening hours on the site.) Reason: In a browser the homepage shows opening hours (Monday to Saturday 10am to 5pm, Sunday 1 to 5pm).
- **top-of-the-lake-guiding** C01_placeholder_text (photography-hike.html shown as link text.) Reason: The links to photography-hike.html show other text or none. The file name is not shown as text in a browser.

## New findings for UD to judge

**target-charters**
- C20_slow_mobile (The page is slow on a phone): Mobile speed score 31 out of 100, main content after 11.0 s
- C13_no_action_above_fold (No way to book or contact on the first phone screen): The first phone screen has no way to book or get in touch
- C14_no_price_visible (No price is visible): No price is shown on the homepage
- C31_no_structured_data (No business structured data): The homepage has no structured data describing the business
- C50_accessibility_failures (Serious accessibility failures): 1 serious accessibility failure on the homepage

**coastal-kayakers**
- C20_slow_mobile (The page is slow on a phone): Mobile speed score 20 out of 100, main content after 14.0 s
- C13_no_action_above_fold (No way to book or contact on the first phone screen): The first phone screen has no way to book or get in touch
- C31_no_structured_data (No business structured data): The homepage has no structured data describing the business
- C50_accessibility_failures (Serious accessibility failures): 4 serious accessibility failures on the homepage
- C12_broken_internal_links (Internal links end in an error): 1 internal link ends in an error page

**trek-lake-okareka**
- C20_slow_mobile (The page is slow on a phone): Mobile speed score 34 out of 100, main content after 9.9 s
- C13_no_action_above_fold (No way to book or contact on the first phone screen): The first phone screen has no way to book or get in touch
- C14_no_price_visible (No price is visible): No price is shown on the homepage
- C31_no_structured_data (No business structured data): The homepage has no structured data describing the business
- C50_accessibility_failures (Serious accessibility failures): 3 serious accessibility failures on the homepage

**taupo-boating-and-fishing-charters**
- C23_not_mobile_friendly (The page does not fit a phone screen): The homepage does not fit a phone screen
- C61_price_differs_from_listing (Price differs between site and listing): Prices on the site do not match the lovetaupo.com listing
- C31_no_structured_data (No business structured data): The homepage has no structured data describing the business
- C50_accessibility_failures (Serious accessibility failures): 4 serious accessibility failures on the homepage

**cathedral-cove-kayak-tours**
- C20_slow_mobile (The page is slow on a phone): Mobile speed score 41 out of 100, main content after 4.6 s
- C14_no_price_visible (No price is visible): No price is shown on the homepage
- C31_no_structured_data (No business structured data): The homepage has no structured data describing the business
- C50_accessibility_failures (Serious accessibility failures): 3 serious accessibility failures on the homepage

**spellbound-glowworm-and-cave-tours**
- C20_slow_mobile (The page is slow on a phone): Mobile speed score 39 out of 100, main content after 4.9 s
- C13_no_action_above_fold (No way to book or contact on the first phone screen): The first phone screen has no way to book or get in touch
- C61_price_differs_from_listing (Price differs between site and listing): Prices on the site do not match the Bookme listing
- C31_no_structured_data (No business structured data): The homepage has no structured data describing the business
- C50_accessibility_failures (Serious accessibility failures): 2 serious accessibility failures on the homepage

**raglan-boat-charters**
- C20_slow_mobile (The page is slow on a phone): Mobile speed score 28 out of 100, main content after 8.6 s
- C31_no_structured_data (No business structured data): The homepage has no structured data describing the business
- C50_accessibility_failures (Serious accessibility failures): 7 serious accessibility failures on the homepage

**kahu-kayaks**
- C20_slow_mobile (The page is slow on a phone): Mobile speed score 26 out of 100, main content after 21.1 s
- C31_no_structured_data (No business structured data): The homepage has no structured data describing the business
- C50_accessibility_failures (Serious accessibility failures): 5 serious accessibility failures on the homepage

**golden-bay-kayaks**
- C10_broken_contact_links (A contact link is broken): The phone link is broken
- C20_slow_mobile (The page is slow on a phone): Mobile speed score 27 out of 100, main content after 9.9 s
- C23_not_mobile_friendly (The page does not fit a phone screen): The homepage does not fit a phone screen
- C50_accessibility_failures (Serious accessibility failures): 4 serious accessibility failures on the homepage
- C12_broken_internal_links (Internal links end in an error): 1 internal link ends in an error page

**marlborough-sounds-adventure-company**
- C20_slow_mobile (The page is slow on a phone): Mobile speed score 29 out of 100, main content after 9.3 s
- C61_price_differs_from_listing (Price differs between site and listing): Prices on the site do not match the book.marlboroughnz.com listing
- C11_dead_navigation (Menu items lead nowhere): 1 menu item leads nowhere: "About"
- C50_accessibility_failures (Serious accessibility failures): 4 serious accessibility failures on the homepage
- C12_broken_internal_links (Internal links end in an error): 1 internal link ends in an error page

**reel-therapy-charters**
- C20_slow_mobile (The page is slow on a phone): Mobile speed score 43 out of 100, main content after 8.0 s
- C50_accessibility_failures (Serious accessibility failures): 1 serious accessibility failure on the homepage

**bladen-wines**
- T01_no_online_booking (No online booking on the site): No online booking was found on the site
- C13_no_action_above_fold (No way to book or contact on the first phone screen): The first phone screen has no way to book or get in touch
- C14_no_price_visible (No price is visible): No price is shown on the homepage
- T03_platform_dependency (Sold on booking platforms but not on the site): Sold on Expedia while the site itself cannot take a booking
- C15_contact_details_missing (No phone or email on the homepage): The homepage shows no phone number or email
- C50_accessibility_failures (Serious accessibility failures): 2 serious accessibility failures on the homepage

**seal-swim-kaikoura**
- C20_slow_mobile (The page is slow on a phone): Mobile speed score 17 out of 100, main content after 20.3 s
- C31_no_structured_data (No business structured data): The homepage has no structured data describing the business
- C50_accessibility_failures (Serious accessibility failures): 7 serious accessibility failures on the homepage

**glacier-valley-eco-tours**
- C50_accessibility_failures (Serious accessibility failures): 2 serious accessibility failures on the homepage

**hokitika-scenic-tours**
- C20_slow_mobile (The page is slow on a phone): Mobile speed score 47 out of 100, main content after 9.9 s
- C13_no_action_above_fold (No way to book or contact on the first phone screen): The first phone screen has no way to book or get in touch
- C70_reviews_not_shown (Strong reviews are not shown on the site): 5 from 48 reviews on Google, none shown on the site
- C50_accessibility_failures (Serious accessibility failures): 2 serious accessibility failures on the homepage

**the-seventh-generation-tours**
- C41_outdated_platform (The site software is past end of life): PHP 8.1.34 is past its end of life (2025-12-31)
- C13_no_action_above_fold (No way to book or contact on the first phone screen): The first phone screen has no way to book or get in touch
- C14_no_price_visible (No price is visible): No price is shown on the homepage
- C50_accessibility_failures (Serious accessibility failures): 1 serious accessibility failure on the homepage

**pohatu-penguins**
- C20_slow_mobile (The page is slow on a phone): Mobile speed score 36 out of 100, main content after 19.0 s
- C14_no_price_visible (No price is visible): No price is shown on the homepage
- C10_broken_contact_links (A contact link is broken): The phone link is broken
- C50_accessibility_failures (Serious accessibility failures): 8 serious accessibility failures on the homepage

**grey-ridge-vineyard**
- T01_no_online_booking (No online booking on the site): No online booking was found on the site
- C20_slow_mobile (The page is slow on a phone): Mobile speed score 44 out of 100, main content after 6.6 s
- C41_outdated_platform (The site software is past end of life): PHP 5.4.45 is past its end of life (2018-12-31)
- C13_no_action_above_fold (No way to book or contact on the first phone screen): The first phone screen has no way to book or get in touch
- C31_no_structured_data (No business structured data): The homepage has no structured data describing the business
- C50_accessibility_failures (Serious accessibility failures): 4 serious accessibility failures on the homepage

**top-of-the-lake-guiding**
- C20_slow_mobile (The page is slow on a phone): Mobile speed score 41 out of 100, main content after 5.1 s
- C13_no_action_above_fold (No way to book or contact on the first phone screen): The first phone screen has no way to book or get in touch
- C15_contact_details_missing (No phone or email on the homepage): The homepage shows no phone number or email
- C50_accessibility_failures (Serious accessibility failures): 4 serious accessibility failures on the homepage

