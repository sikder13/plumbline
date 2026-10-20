# Book Direct run 01: report

Relay: RELAY-BOOKDIRECT-01. Branch feat/book-direct in ~/nahl-clients-projects/plumbline-book-direct. No pages, no emails, nothing deployed, Vercel not touched, no visit beacon fired. Prospect data is in data/book-direct/ (gitignored); this report names businesses but holds no email address.

## The short version

- **217 qualified leads**: 108 accommodation (List A) and 109 allied health (List B), from 240 audited. The target was 60 and the budget 80, so List C was not run.
- **The contact gate holds up.** 81% of candidates publish an email on their own site, and 99% of those pass syntax and MX. The 108 addresses ZeroBounce checked came back with none invalid.
- **Most leads qualify on phone speed alone.** 88% of the sites measured take over 4 s to show their main content on a phone (median 8.8 s). Only 55 of the 217 qualify on a booking-path finding: a dead Book link, OTA-only booking, or no Book or Call control on the first phone screen. Those 55 are the strongest emails. For the rest, speed is better used as the day 4 follow-up.
- **Add ZeroBounce credits before any send.** 118 qualified leads are `needs_verifier`. The account's 100 free credits (plus 9 refunded "unknowns") are used up.
- Places calls: 558 of the 1,500 cap. Lighthouse: 775 runs on 301 pages for 239 leads; 1 lead could not be measured.

## 1. Funnel per list

| | A accommodation | B allied health |
|---|---|---|
| Places found (unique) | 2,557 | 1,509 |
| With their own website | 1,914 (75%) | 1,305 (86%) |
| Candidates after the filters | 1,064 | 699 |
| Site read | 1,014 (95% of candidates) | 666 (95%) |
| **Published email on their own site** | **847 (80% of candidates)** | **579 (83%)** |
| Email verified (syntax and MX) | 839 (99% of those with an email) | 571 (99%) |
| Audited (best first, budget stop) | 120 | 120 |
| With a tier 1 to 3 finding | 111 (92% of audited) | 110 (92%) |
| **Qualified** | **108 (90% of audited)** | **109 (91%)** |

Read the last three rows with care. The audit took the most likely leads first (those with a booking path and nothing saying they are full), so 90% is an upper bound for the 1,012 leads not yet audited. Of the leads that passed the gate, 77 in A and 81 in B have no booking engine or link at all, so the reserve will qualify at a lower rate.

Candidates dropped before the gate, A / B: no website 559 / 174, rating count outside the band 556 / 214, off-target type 191 / 191, directory or social site 83 / 29, chain 76 / 93, hospital or public body 15 / 40, duplicate site 11 / 65, already emailed or suppressed 1 / 3.

Stopped at the gate, A / B: no published email 217 / 120 (of which 50 / 33 had sites that could not be read), MX failed 7 / 4, more than four location pages 1 / 4.

Audited but not qualified, A / B: no tier 1 to 3 finding 9 / 10. Excluded type: 3 in A (Casino Court Motor Lodge on the word "casino", a vineyard cottage, a motel with a bar) and 1 in B (Central Lakes Physio and Pilates, which books through Habit Health). UD may want Casino Court back: it is a motel.

## 2. Lead finding mix (qualified)

| Lead finding | A | B | All |
|---|---|---|---|
| slow_mobile (mobile LCP over 4 s) | 64 | 74 | 138 |
| no_first_screen_cta | 25 | 28 | 53 |
| tel_link_dead | 18 | 6 | 24 |
| book_cta_dead | 0 | 1 | 1 |
| ota_only_booking | 1 | 0 | 1 |

Counting second findings too, 55 qualified leads carry a booking-path finding. 108 of the 138 that lead with speed are over 6 s (tier 2).

## 3. Booking engine mix

Qualified leads: Cliniko 55, Seekom 1, STAAH 6, Little Hotelier 6, Halaxy 0. Other: Gensolve 26, Free Online Booking 21, SiteMinder 18, Preno 12, iBex 12, Channex 9, Splose 6, SwiftBook 5, PracSuite 4, SmartBooking 3, Newbook 3, Timely 2, Jane 2, and 12 more with one each. None: 13 Book links to a page with no named engine (flagged `no_engine_generic_link`), and 1 OTA only.

Everyone who passed the gate (1,410), top engines. A: Free Online Booking 121, SiteMinder 98, iBex 76, Preno 46, SwiftBook 38, STAAH 37, Little Hotelier 35, Channex 25, Newbook 19, Smart GMS 17, Seekom 11; generic link 115; none 86. B: Cliniko 200, Gensolve 129, Splose 23, Nookal 15, PracticeHub 13, PracSuite 9; generic link 69; none 81. Halaxy and Noterro did not appear on any NZ clinic site read. Seekom is rarer than the campaign assumed; Free Online Booking and iBex are the common NZ motel engines.

## 4. Top 20 qualified, by score

| # | Business | Town | List | Lead finding and value | Email |
|---|---|---|---|---|---|
| 1 | Mission Health (Physiotherapy and Acupuncture Clinic) | Hamilton | B | book_cta_dead: "Book An Appointment" answers 404 (checked again by hand) | catch_all |
| 2 | Elias Wellness Center | Auckland | B | no_first_screen_cta | valid |
| 3 | Seven Physio & Acupuncture | Auckland | B | no_first_screen_cta | catch_all |
| 4 | Beaches Nelson | Nelson | A | no_first_screen_cta (screenshot checked) | valid |
| 5 | Accommodation Gateway Motel | Palmerston North | A | no_first_screen_cta | valid |
| 6 | Bellano Motel | Christchurch | A | no_first_screen_cta (screenshot checked) | valid |
| 7 | Mariner Suites | Oamaru | A | no_first_screen_cta | valid |
| 8 | Waterfront Motels | Blenheim | A | no_first_screen_cta | valid |
| 9 | Consultancy House Clinic | Dunedin | B | no_first_screen_cta | valid |
| 10 | Ashleigh Court Motel Christchurch | Christchurch | A | no_first_screen_cta | valid |
| 11 | Adelaide Motel | Wellington | A | no_first_screen_cta | valid |
| 12 | Back In Action Physio (Greerton) | Tauranga | B | no_first_screen_cta | catch_all |
| 13 | Refresh Physio | Wellington | B | no_first_screen_cta | valid |
| 14 | The Rehab Studio | Auckland | B | no_first_screen_cta | valid |
| 15 | Craig Dalton Osteopathy | Wellington | B | no_first_screen_cta | catch_all |
| 16 | PhysioAction Milford | Auckland | B | no_first_screen_cta | catch_all |
| 17 | Sports Clinic | Christchurch | B | no_first_screen_cta | valid |
| 18 | Kayla Drinkwater Physio (KD Physio) | Dunedin | B | no_first_screen_cta | valid |
| 19 | Wilson Osteopathy | Tauranga | B | no_first_screen_cta | valid |
| 20 | FRAME Osteopathy | Christchurch | B | no_first_screen_cta | valid |

no_first_screen_cta means no Book, Call or Book Appointment control on the first 390 by 844 screen. Every row above also has a second finding, usually phone speed over 6 s. Scores: 8 for #1, 7 for #2 and #3, 6 for the rest. The one OTA-only lead (Charleston Motor Camp and Holiday Park, whose own Book Now page sends visitors to Airbnb and Booking.com) ranks 68th with a score of 4.

## 5. Verification

Of the 217 qualified: 68 valid, 31 catch-all (allowed, flagged), 9 unknown (greylisted), and 109 MX-checked only. That makes **118 `needs_verifier`**. The top 100 by score are all single-checked except 2 unknowns. Across the 108 ZeroBounce checks: 25 valid, 42 role addresses accepted (info@, bookings@), 30 role addresses on catch-all domains, 1 catch-all, 1 forwarder, 9 greylisted, 0 invalid.

**Yes, add credits before any send.** The account has 0 left. Every lead below row 100 needs a check, and the campaign wants every address re-checked before it is sent. ZeroBounce does not charge for "unknown" results. Also, `.env` holds two `ZEROBOUNCE_API_KEY` lines: the first is refused by ZeroBounce, the second works. Delete the first so nobody uses it by mistake.

## 6. Calls and cost

- **Google Places:** 558 calls, all Text Search with Enterprise fields. List A: 375 (216 result pages for 108 queries, plus 159 park look-ups). List B: 178 (108 queries). Competitor check: 5 town searches. At list price that is 558 x $0.035 = **$19.53**. The first 1,000 such calls each month are free. The Open Sign checkout recorded 461 this month, so at least 19 of tonight's calls are past the free tier (about $0.67), and up to $19.53 if the main checkout used Places in October too. I cannot see its usage from here.
- **ZeroBounce:** 108 checks on the account's free credits, $0.
- **Lighthouse:** local only. 775 runs on 301 pages for 239 leads: one run per page, plus two more and the median of three whenever the first run was over 4 s. One lead could not be measured (its page painted nothing), so its slow_mobile cannot lead. Four runs went at a time on a 12-core machine whose load reached about 10, which can push simulated LCP up. 21 leads sit within 0.5 s of the 4 s line and 24 within 0.5 s of 6 s. Re-measure any speed sentence before it is sent, as the campaign's 24-hour re-check already requires.
- **Other checks:** 120 clinics got the competitor check, mostly from clinics audited tonight, plus 24 more homepages opened at 390. 111 JavaScript-only sites were opened in a browser at the contact step.

Two cautions on the finding wording. An iPhone can turn a plain phone number into a link by itself, so a tel_link_dead email should say "not set up as a tap-to-call link", not "broken". And no_first_screen_cta was read after the page loaded; a Book bar that appears only after scrolling is not on the first screen, which is what the finding says.

## 7. Decisions made alone

1. **Where the inputs were.** The relay and CAMPAIGN.md were in `~/inputs/` (with an empty `~/data/book-direct/`), not in the checkout. I copied both into the checkout's `inputs/` (gitignored). The checkout, branch and `.env` link already existed. The main checkout was only read (the suppression list and wave lists); nothing outside this checkout was changed.
2. **Spending ZeroBounce after the audit, not before.** The account had 100 credits for 1,410 addresses. Every address got the syntax and MX check before the audit. The single-address checks went to the best-ranked leads after it, because checking in the relay's order would have spent them on leads that never qualify. A lead with no single check stays `mx_only` with `needs_verifier` (score -2).
3. **Business type.** Places returns pubs, restaurants, venues, gyms and massage shops for these terms. List A keeps motels, lodging, B&Bs, holiday parks, campgrounds and guest houses; a hotel, resort or hostel stays only when its name says motel, lodge, inn, B&B or holiday park. List B keeps a physiotherapist or chiropractor Google type, or physio, chiro or osteo in the name. 191 dropped in each list. Lists C and D got the same kind of check (dental; locks, plumbing, electrical, glazing, drains) but were not run.
4. **Chains.** I used the relay's names plus a few of my own (Mercure, Rydges, Copthorne, Jucy, YHA, Bella Vista and similar; Active+ and Back in Motion for clinics). Also dropped: a website shared by more than four Google profiles, a homepage linking more than four location pages, and a clinic that books through Habit Health. Asure and Golden Chain motels are kept, since both are groups of independently owned motels. Heritage and Scenic are matched only by their group names, so an independent "Heritage Motel" stays. Top 10 parks are kept and flagged; none reached the qualified list.
5. **Already emailed.** Every row of the wave 1 to 4 lists counts, sent or reserve, plus Wine Hopper's domain and the shared suppression list. They are matched on domain, address, and name plus town. 4 candidates were dropped this way.
6. **1,763 candidates against 300 to 600 expected.** Each search returns up to 60 places per term per centre, and most NZ motels and clinics have their own site. I kept them all and controlled the cost at the audit instead (decision 14).
7. **holidayparks.co.nz.** All 231 park pages were read, one request a second. 181 parks matched a Google profile: 72 by website domain from the searches, and 109 more by one Places search per unmatched park (159 searches; 50 found no match).
8. **Which addresses count.** Email links come first, then Cloudflare-protected addresses, then visible text on any of the six pages read, then "info [at] x [dot] nz" writing. Addresses only in hidden structured data are not counted (1 in a sample of 25 rejects), because the email footer says the address is published on their site. An address at a web designer's credited domain is never taken. 111 sites that show almost no text to a plain request were opened in a browser (homepage and contact page).
9. **"Already full."** The first pass took guest reviews ("despite being fully booked") and holiday peaks ("fully booked over Christmas") for full signals. I narrowed it to the business's own words about now, which cut the matches from 27 to 17.
10. **Engines.** The first list missed the engines NZ motels and clinics mostly use (Free Online Booking, iBex, Channex, SwiftBook, Smart GMS, Bookings247, PracSuite and others). A Booking.com review badge was also read as a booking path, which made one motel look OTA-only. I added the engines, counted OTA links only when a visitor can follow them, and audited all 240 again with their stored speed kept. An engine that a Book link reaches also counts as the lead's engine. A Book link to a page with no named engine counts as a booking link for rule 2, as Part 2 lists generic "book now" links; those 13 leads are flagged `no_engine_generic_link`.
11. **Dead Book controls.** A Book link with no target, or one pointing at a section the page does not have, is tapped once through the page (never a control inside a form). It is dead only if nothing opens within 3 seconds. Middlemore Motel's "Book Now" points at a missing section but a script takes it to SwiftBook; the first rule called it dead, and the tap test was added because of it. A 401, 403 or 429, or an engine page whose robots.txt forbids us, is "unknown", never dead. "Opens the contact page" counts only when the site has an engine or OTA it should have gone to.
12. **Lighthouse.** One run per page; a run over 4 s gets two more, and the median of three is kept. The book or rates page is measured only when the homepage is 6 s or under, because a slower homepage already sets the tier.
13. **Layout rule corrected mid-run.** `initial-scale=1` without `width=device-width`, or a fixed width narrower than the screen, still fits a phone, so neither counts. The tiers are applied again to the stored measurements at qualification.
14. **Where the audit stopped.** The audit took the most likely leads first: a booking path, nothing saying they are full, 10 to 150 ratings, lists A and B in turn. I set one pass of 240. The interim count passed 80 qualified at 92 audited. I let the pass finish so the single-address checks could go to the best 100 of a larger pool, then stopped. The other 1,012 leads that passed the gate are the reserve, listed in REJECTED.csv as `not_audited`.
15. **Same town** for the competitor check is Google's locality, so all of Auckland counts as one town.
16. **`email_seen_on`** is the New Zealand date (20 October 2026).
17. **The Book Direct commands exit explicitly.** An open socket or browser kept the first test run alive after its work was done.
18. **No List C.** Lists A and B gave 217 qualified, well over the 60 that would have triggered it.

## 8. Elapsed and tokens

Started 19:19 EDT, report written 21:48 EDT: **2 h 29 min** of the 5-hour budget. About 0.5 million tokens by the session counter (one session, no helper agents).

## 9. Next: Lists C and D

From ~/nahl-clients-projects/plumbline-book-direct. Add ZeroBounce credits first, or the new leads stay `needs_verifier`:

```
pnpm plumb leads discover --campaign book-direct --list C && pnpm plumb leads discover --campaign book-direct --list D && pnpm plumb leads contacts --campaign book-direct --list C,D && pnpm plumb wave run --wave book-direct-1 --audit-only --list C,D --max 240 && pnpm plumb leads qualify --campaign book-direct
```

Discovery for C and D is 216 queries (8 terms in 27 centres), about 400 to 650 Places calls with paging, inside the 1,500 cap. The Places ledger counts by Pacific day, so a run on another day starts from zero. For more A and B leads from tonight's reserve, without new Places calls: `pnpm plumb wave run --wave book-direct-1 --audit-only --list A,B --max 120 && pnpm plumb leads qualify --campaign book-direct`.

## Files and checks

- data/book-direct/leads/: QUALIFIED.csv (217 rows, best first), REJECTED.csv, README.md (columns and what to check by hand: greeting names, the needs_verifier rows, the finding re-check), plus _candidates, _pool_A and _pool_B, _contacts, _verified, _audit and _competitors. Greeting names were found for 46 of the 217; check each by hand.
- First-screen screenshots at 390 x 844 for every audited lead: data/book-direct/audit/shots/.
- Code: packages/leads/src/bookdirect/ (discovery, contact gate, audit, qualification), commands `leads discover`, `leads contacts`, `leads qualify` and `wave run --audit-only`.
- `pnpm lint` and `pnpm typecheck` are clean, and `pnpm test` passes 677 of 677 (44 new tests for Book Direct). The review of the work was mine; no reviewer agent was used, as the relay asks.
