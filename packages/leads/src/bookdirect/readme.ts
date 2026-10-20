/** data/book-direct/leads/README.md: what each file and column means, and what to check by hand before any send. */
export function leadsReadme(s: { qualified: number; needsVerifier: number; zeroBounceChecked: number; generatedAt: string }): string {
  return `# Book Direct leads (RELAY-BOOKDIRECT-01)

Generated ${s.generatedAt} by \`pnpm plumb leads qualify --campaign book-direct\`. Prospect data: never commit this folder.

## Files

- \`QUALIFIED.csv\`: ${s.qualified} leads that pass every "room to sell" rule, best first (score, then rating count).
- \`REJECTED.csv\`: every other candidate, with the one reason that stopped it. \`not_audited\` is not a rejection: the lead passed the contact gate but the audit stopped at the budget before reaching it. Those leads are the reserve for the next run (\`pnpm plumb wave run --wave book-direct-1 --audit-only --max <n>\`, then \`leads qualify\`).
- \`_candidates.csv\`: every candidate from discovery (Google Places and holidayparks.co.nz), with its list letter.
- \`_pool_A.csv\`, \`_pool_B.csv\`: every place discovery saw, kept or dropped, with the reason.
- \`_contacts.csv\`: what Part 2 read on each site: every address found with its page, the one picked, names, phone, booking engine, OTA links, "already full" words.
- \`_verified.csv\`: the leads that passed the contact gate. \`_audit.csv\`: the audit, one row per lead.
- \`_competitors.csv\`: for allied health, the three same-town clinics and whether each shows a Book control on the first phone screen.

## QUALIFIED.csv columns

| Column | Meaning |
|---|---|
| list | A accommodation, B allied health |
| business, town, website | From the Google profile; the town is Google's locality |
| email | The address picked, published on the business's own site |
| email_source_url | The page the address was read on |
| email_seen_on | The day it was read, New Zealand date |
| verify_status | valid (ZeroBounce valid, or a role address ZeroBounce accepts), catch_all (domain accepts everything, allowed but flagged), mx_only (syntax and MX checked only; not single-address checked) |
| greeting_names | Owner or manager names as the site prints them, with their role and page. Read by pattern, so check by hand |
| booking_engine | The engine detected (Seekom, STAAH, Cliniko...), "generic" for a Book link to a page with no named engine, "OTA only" when the only booking path is an OTA |
| booking_url | The engine or booking link found |
| ota_links | Booking.com, Expedia, Agoda, Airbnb or Hotels.com links on the site |
| lead_finding | The strongest finding class: ota_only_booking, book_cta_dead, no_first_screen_cta, tel_link_dead, slow_mobile, not_mobile_layout |
| lead_value | What was measured, in words |
| lead_evidence_url | The page it was measured on |
| second_finding | The next finding, if any (tier 1 to 4) |
| lcp_mobile_s | The slowest mobile LCP measured (Lighthouse mobile preset, simulated throttling; a run over 4 s is the median of three), or not_measured |
| first_screen_cta | The Book, Call or Book Appointment controls seen on the first 390 by 844 screen, or none |
| competitors_book_online | Allied health: how many of three same-town clinics show a Book control on the first phone screen |
| rating, rating_count | Google rating and number of ratings |
| score | Room to sell, 0 to 10: +3 ota_only_booking, +3 book_cta_dead, +2 no_first_screen_cta, +2 slow_mobile over 6 s (+1 at 4 to 6 s), +1 tel_link_dead, +1 two or more competitors book online, +1 10 to 150 ratings, -2 needs_verifier |
| flags | needs_verifier, catch_all_domain, role_address, top10_member, no_engine_generic_link (a Book link but no named engine), js_site (read in a browser); then the score's points |

## Check by hand before any send

1. **Greeting names.** They come from fixed patterns ("Your hosts Mike and Nans", "Jane Doe, Principal Physiotherapist"). Confirm each on its page; an empty cell means use no name.
2. **needs_verifier rows** (${s.needsVerifier} of the qualified). Only ${s.zeroBounceChecked} single-address checks were possible tonight (the ZeroBounce account had 100 credits). Every needs_verifier address must be checked before it is sent to.
3. **The lead finding.** Re-check it within 24 hours of the send, as the campaign requires. A dead Book link or a slow page can change overnight.
4. **top10_member** rows: Top 10 parks are kept as the relay asks; confirm the park is independently owned.
5. **no_engine_generic_link** rows: the Book link goes to a page with no named engine (often an enquiry form). The campaign's first waves are for businesses with an engine; decide whether these stay.
`;
}
