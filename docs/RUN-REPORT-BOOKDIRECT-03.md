# Book Direct run 03: fifteen demo pages, built locally

Relay: RELAY-BOOKDIRECT-03. Branch feat/book-direct in ~/nahl-clients-projects/plumbline-book-direct. Pages are built into `previews/out/site` on this machine only. Nothing deployed, Vercel not touched, no email written or sent, no visit beacon fired from tests or screenshots (the gates answer the beacon locally). Prospect data stays in `data/book-direct/` and `previews/` (both gitignored). This report names businesses but holds no email address.

## The short version

- **Fifteen pages built**, every one for a business that publishes an email on its own site. All fifteen PASS every gate; none HOLD. Lowest scores: performance 98, accessibility 100, LCP 2.33 s, CLS 0.034, TBT 108 ms. Review scores 8.5 to 9 at both widths.
- **Every finding but one held on a fresh fetch.** Mission Health's "Book An Appointment" link still answers 404, but a visitor sees a working booking form, so it was dropped and St Georges Kennels took its place.
- **Engines:** nine pages link Book to the business's own working engine or page (Timely, Zenoti, Cloudbeds, Cliniko, NowBookIt, Little Hotelier, SiteMinder, their own reservation form, their own trips page); two use a working second link on their own site; four use a Book section with phone and email, because their engine is dead or absent.
- Somtum Thai and Discovery Jet: no email on a browser refetch, skipped.
- ZeroBounce had no credits: every address is `mx_only` (syntax and mail server).

## 1. The fifteen

| # | Page | Town | Finding | Status |
|---|---|---|---|---|
| 1 | Super Lawn Mowing and Gardening Dunedin | Dunedin | booking_link_broken | PASS |
| 2 | Dental@105 | Hastings | booking_link_broken | PASS |
| 3 | Whakatane Dental Centre | Whakatāne | booking_link_broken | PASS |
| 4 | Asia Pacific Yoga | Taupō | booking_link_broken | PASS |
| 5 | House of Wellness | Tauranga | booking_link_broken | PASS |
| 6 | RSM Massage NZ | Dunedin | booking_link_broken;main_nav_404 | PASS |
| 7 | Tranquillo Beauty Clinic | Tauranga | booking_link_broken | PASS |
| 8 | Adventure South NZ | Christchurch | main_nav_404 | PASS |
| 9 | Henderson Valley Tyre Centre | Auckland | cert_failure | PASS |
| 10 | Takapuna Motor Lodge | Auckland | not_secure | PASS |
| 11 | Bodycare Clinic Forrest Hill | Auckland | not_secure | PASS |
| 12 | The Comm Whakatane | Whakatāne | not_secure | PASS |
| 13 | Greymouth Motel | Greymouth | not_secure | PASS |
| 14 | Central Park Motor Lodge | Christchurch | not_secure | PASS |
| 15 | St Georges Boarding Kennels and Cattery | Havelock North | not_secure | PASS |

## 2. Re-proof

Every finding was fetched again on 20 October 2026, 8:12 to 8:19 pm NZ time, and photographed at 390 x 844 after full load. The full record (link text, page, target, status, what the page says, both pictures, time) is `data/book-direct/batches/book-direct-01/REPROOF.md`.

- **Held (15 of 16 checked):** the seven broken booking links (Super Lawn, Dental@105, Whakatane Dental, Asia Pacific Yoga, House of Wellness, RSM Massage, Tranquillo), the Adventure South menu 404, the Henderson Valley Tyre certificate failure (ERR_CERT_DATE_INVALID, Chrome's full-page warning), and "Not secure" on the six http pages with a Book control.
- **Did not hold: Mission Health.** The link answers HTTP 404 but renders a working booking form ("Select a service", ACC Acupuncture, ACC Physiotherapy). The first re-proof counted the status code and passed it; on building the page I looked at the picture, saw the form, and changed the rule so that what the visitor sees decides it (it is now a tested function). Dropped with both pictures in `DROPPED.md`.
- **Substitution:** St Georges Boarding Kennels (not_secure, "Book Online Now!" on the http homepage, 59 ratings), the first reserve.

## 3. Who was skipped, and why

From `DROPPED.md`:
- No email on their own site: Somtum Thai Timaru, Discovery Jet (both fetched again in a browser: still none; Discovery Jet's only address is a form placeholder), Greengables B&B, Rua@Bluff (the only address is the Bluff Oyster Festival's), Cypress Court Motel.
- not_secure but no Book control on the http page: Albany Rosedale Motel, Amax Laser Clinic, Levin Plumbing & Gas, Veterinary Health Centre Whakatāne, All About Tyres, Wadestown Veterinary Clinic.
- Reserves held but not needed: Kylies Beauty Clinic, Cromwell Chiropractic.

## 4. Engine situation per page

| # | Page | Book goes to | Kind |
|---|---|---|---|
| 1 | Super Lawn Mowing and Gardening | Book section: a text with their four asks, call, email | Fallback (book a job page gone) |
| 2 | Dental@105 | Book section: call and email reception | Fallback (booking page gone) |
| 3 | Whakatane Dental Centre | Book section: call and email | Fallback (Dentalhub page 404) |
| 4 | Asia Pacific Yoga | Their working training pages; the two broken trainings go to the Book section | Working second link, part fallback |
| 5 | House of Wellness | Their Classes & Timetable page | Working second link |
| 6 | RSM Massage NZ | Timely, bookings.gettimely.com/rsmmassage | Their engine |
| 7 | Tranquillo Beauty Clinic | Zenoti, tranquillo.zenoti.com | Their engine (the dead link was Kitomba) |
| 8 | Adventure South NZ | Their Guaranteed Trips page | Their own page |
| 9 | Henderson Valley Tyre Centre | Book section: call, directions, email | Fallback (no engine) |
| 10 | Takapuna Motor Lodge | Cloudbeds, hotels.cloudbeds.com/reservation/ybJR6y | Their engine |
| 11 | Bodycare Clinic | Cliniko, one page per branch (Forrest Hill, Northcote) | Their engine |
| 12 | The Comm. Whakatane | NowBookIt, venue 8613 | Their engine |
| 13 | Greymouth Motel | Little Hotelier, book-directonline.com/properties/greymouthmoteldirect | Their engine |
| 14 | Central Park Motor Lodge | SiteMinder, book-directonline.com/properties/centralparkmotorlodgedirect | Their engine |
| 15 | St Georges Kennels and Cattery | Their reservation form over https (sgk.co.nz/reserveform.php) | Their own form |

Each fallback page says in its findings tab that the live rebuild connects Book to whichever engine they choose. The gates opened every Book target on the final build: all answered below 400 (section 5).

## 5. Gates

Gates per page, three Lighthouse runs (median), mobile: performance 90 or more, accessibility 95 or more, LCP under 2.5 s, CLS under 0.05, TBT under 200 ms; no sideways scroll at 360, 390, 768 and 1280; axe contrast; every link (the Book link against the real target); no placeholder text; no dashes in copy; every figure traced to their site; NZ phone numbers; an email link; no testimonials on health pages. Logs: `data/book-direct/batches/book-direct-01/gates-round*.log`.

| # | Page | Perf | A11y | LCP | CLS | TBT | Overflow | Links | Copy | Result |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Super Lawn Mowing and Gardening Dunedin | 99 | 100 | 1.66 s | 0.000 | 91 ms | none | 14/14 | clean | PASS |
| 2 | Dental@105 | 99 | 100 | 2.03 s | 0.034 | 44 ms | none | 16/16 | clean | PASS |
| 3 | Whakatane Dental Centre | 99 | 100 | 1.88 s | 0.000 | 46 ms | none | 13/13 | clean | PASS |
| 4 | Asia Pacific Yoga | 99 | 100 | 2.11 s | 0.000 | 70 ms | none | 26/26 | clean | PASS |
| 5 | House of Wellness | 98 | 100 | 2.25 s | 0.000 | 46 ms | none | 17/17 | clean | PASS |
| 6 | RSM Massage NZ | 99 | 100 | 1.81 s | 0.000 | 108 ms | none | 16/16 | clean | PASS |
| 7 | Tranquillo Beauty Clinic | 100 | 100 | 1.73 s | 0.000 | 44 ms | none | 19/19 | clean | PASS |
| 8 | Adventure South NZ | 98 | 100 | 2.33 s | 0.000 | 53 ms | none | 24/24 | clean | PASS |
| 9 | Henderson Valley Tyre Centre | 99 | 100 | 1.65 s | 0.014 | 93 ms | none | 12/12 | clean | PASS |
| 10 | Takapuna Motor Lodge | 100 | 100 | 1.66 s | 0.000 | 48 ms | none | 18/18 | clean | PASS |
| 11 | Bodycare Clinic Forrest Hill | 99 | 100 | 2.03 s | 0.000 | 48 ms | none | 16/16 | clean | PASS |
| 12 | The Comm Whakatane | 100 | 100 | 1.65 s | 0.000 | 52 ms | none | 15/15 | clean | PASS |
| 13 | Greymouth Motel | 99 | 100 | 1.96 s | 0.000 | 50 ms | none | 16/16 | clean | PASS |
| 14 | Central Park Motor Lodge | 99 | 100 | 2.11 s | 0.000 | 45 ms | none | 20/20 | clean | PASS |
| 15 | St Georges Boarding Kennels and Cattery | 99 | 100 | 1.81 s | 0.009 | 90 ms | none | 15/15 | clean | PASS |

Lows across the fifteen: performance 98, accessibility 100, LCP 2.33 s, CLS 0.034, TBT 108 ms.

Four rounds. Round 1 was stopped after seven pages once every page had changed (the findings tab gained the engine note); its failures were a URL with hyphens between digits in Asia Pacific Yoga's finding, white labels on see-through circles on Bodycare (contrast), and "Dental@105105" run together in a footer. Round 2 ran all fifteen: ten passed, and five failed on things now fixed (text message links the checker did not know, Takapuna's sideways photo strip not reachable by keyboard, Tranquillo's after-hours note inside its list of hours, The Comm's "Estd 1894" not in its content). Round 3 passed those five and RSM's new desktop hero; round 4 passed the three pages whose text face changed (section 7). Logs: `gates-round1.log` to `gates-round4.log` in the batch folder; per page `previews/review/book-direct/batch-01/<slug>/gates.json`.

## 6. Review

Recordings, a 20-second scroll per page at each width: `previews/review/book-direct/batch-01/<slug>-390.webm` and `<slug>-1440.webm`. Contact sheets, first screens, labelled: `previews/review/book-direct/batch-01/contact-sheet-390.jpg` and `contact-sheet-1440.jpg`. Full-page pictures per page and width: `previews/review/book-direct/batch-01/<slug>/full-390.png` and `full-1440.png`.

Judged against the best wave 3 page and Wine Hopper, desktop as hard as mobile. Target 9, never below 8. No page fell below 8, so none needed a rebuild round and none is on HOLD; several were refined after the first review (RSM, Greymouth and Henderson desktop heroes, Central Park's crop, Takapuna's stamp, Tranquillo's hours).

| # | Page | 390 | 1440 | Note |
|---|---|---|---|---|
| 1 | Super Lawn Mowing and Gardening Dunedin | 9 | 9 | "Just txt us" carried through: their four asks become a text composer. |
| 2 | Dental@105 | 8.5 | 8.5 | Warm team photo and three chairs; the services list is plain. |
| 3 | Whakatane Dental Centre | 8.5 | 8.5 | "Catering for cowards" and the week drawn to scale; the desktop hero is type only. |
| 4 | Asia Pacific Yoga | 9 | 9 | Their own photo and the training calendar with the broken runs marked. |
| 5 | House of Wellness | 9 | 8.5 | Full-bleed studio and the ways in; desktop sections a little long. |
| 6 | RSM Massage NZ | 8.5 | 8.5 | A letter from Bex; desktop hero rebuilt in round 2 as salutation and letter side by side. |
| 7 | Tranquillo Beauty Clinic | 9 | 9 | Arch photo and treatment index in their blush and teal. |
| 8 | Adventure South NZ | 9 | 9 | Their mountains full bleed and the departures ledger at their prices. |
| 9 | Henderson Valley Tyre Centre | 8.5 | 8.5 | A forecourt sign, open state live; no photos to use. |
| 10 | Takapuna Motor Lodge | 8.5 | 8.5 | Postcard hero and four ways to stay; their photos are only 660 px. |
| 11 | Bodycare Clinic Forrest Hill | 8.5 | 8.5 | Their three circles of care, and a Cliniko page per branch. |
| 12 | The Comm Whakatane | 9 | 9 | Pub poster, the pint that pours, the menu board at their prices. |
| 13 | Greymouth Motel | 8.5 | 8.5 | One sunset photo carried as the palette; the guest count. |
| 14 | Central Park Motor Lodge | 8.5 | 8.5 | Their minutes on foot or by car; their sign as the photo. |
| 15 | St Georges Boarding Kennels and Cattery | 8.5 | 8.5 | Typographic; three doors in and the drop-off window live. |

## 7. Variety

Two checks. First, no two pages, across this batch and every earlier page that records its look (Wine Hopper, Golden Bay Kayaks, Grey Ridge, Kaewa, Coromandel Ocean), share a hero treatment, a type pair and a palette family (`data/book-direct/batches/book-direct-01/VARIETY.txt`). Second, no type pair of the fifteen is used by any earlier page made to order or any page engine: the repository's register holds 55 earlier pairs (wave 1, Wine Hopper, waves 2 and 3, Open Sign) and the engines hold 12. That second check caught three: Takapuna had Open Sign's Young Serif and Instrument Sans, Central Park wave 3's Gloock and Familjen Grotesk, and Bodycare an engine's Sora and Literata. They now set Manrope, Schibsted Grotesk and Petrona, were gated again, and all fifteen pairs are added to the register so later pages are held against them.

| # | Page | Hero | Type pair | Palette family |
|---|---|---|---|---|
| 1 | Super Lawn | text thread | Space Grotesk, Lora | forest |
| 2 | Dental@105 | split | Gelasio, Hanken Grotesk | ocean |
| 3 | Whakatane Dental | type | Alegreya, Onest | gold |
| 4 | Asia Pacific Yoga | band | Instrument Serif, Plus Jakarta Sans | alpine |
| 5 | House of Wellness | full bleed | Cormorant Garamond, Work Sans | clay |
| 6 | RSM Massage | letter | Caveat, Red Hat Display | night |
| 7 | Tranquillo | arch | Bodoni Moda, Tenor Sans | vine |
| 8 | Adventure South | full bleed | Geologica, JetBrains Mono | alpine |
| 9 | Henderson Valley Tyre | type | Epilogue, Space Mono | night |
| 10 | Takapuna Motor Lodge | postcard | Young Serif, Manrope | ocean |
| 11 | Bodycare Clinic | inset | Sora, Petrona | stone |
| 12 | The Comm. | poster | Anton, Libre Franklin | vine |
| 13 | Greymouth Motel | panorama | Bricolage Grotesque, Crimson Pro | gold |
| 14 | Central Park | sign | Gloock, Schibsted Grotesk | forest |
| 15 | St Georges | type | Unbounded, Zilla Slab | clay |

## 8. Calls, time and tokens

- **Fetches, all GET, robots.txt respected, one request a second per host, only the fifteen businesses' own sites and their own booking-engine links:** 16 re-proofs in the browser (plus Somtum Thai and Discovery Jet refetched for an email), 57 pages read for research with up to 12 photos each, 13 more pages from five of the sites for facts the first read missed, and The Comm's Book page source once to find its NowBookIt link. The gates open every link on each page, the Book targets included.
- **No Places calls, no ZeroBounce, no other web research, no helper agents.**
- **Builds:** the static site was built about a dozen times locally; nothing deployed.
- **Elapsed:** started about 03:07 EDT (re-proof screenshots 03:12), pages built and gated by 05:30, report committed about 05:40 EDT: **about 2 h 35 min** of the 7-hour budget.
- **Tokens:** about 0.85 million in the part of the session after its context was summarised, by the session counter; the earlier part (re-proof, research and the first seven pages) is not in that count. One session, no helper agents.

## 9. Decisions made alone

1. **"These ten" read as these fifteen.** The relay asks for exactly 15 pages and, in the variety rule, says "across these ten". I built fifteen and held the variety rule across all fifteen.
2. **The free first fix names the finding.** The pricing text is the relay's, word for word, except that "the broken booking link" becomes what is broken on that page: "the broken Contact us link" (Adventure South), "the certificate warning" (Henderson Valley Tyre), "the “Not secure” warning" (the six http sites). Everything after the first clause is unchanged.
3. **A link is broken only if the visitor sees it broken** (Mission Health, section 2).
4. **Stock and small photos are not their photos.** Super Lawn's site photos are generic stock (several well-known free stock images); RSM's are soft and look generated; Henderson has none; St Georges' are all under 600 px. Those four pages are typographic. Takapuna's photos are 660 px wide, so they are shown small (a postcard and a strip), never full width.
5. **Gmail and Yahoo addresses count as published business emails** when the business publishes them on its own site (Whakatane Dental, Asia Pacific Yoga, RSM Massage, Central Park Motor Lodge). Flagged in their EMAIL-INPUTS.md.
6. **Rua@Bluff skipped:** the only address on the site belongs to the Bluff Oyster Festival.
7. **Book section fallback** for four pages (Super Lawn, Dental@105, Whakatane Dental, Henderson Valley Tyre), each with a note in the findings tab that the live rebuild connects whichever engine they choose. Asia Pacific Yoga mixes: its two trainings with broken buttons go to the Book section, the others to their own working pages.
8. **Secondary findings in the findings tab** only where the sweep proved one with a picture: St Georges (not mobile) and Bodycare (hours differ from Google). Other secondaries (Takapuna's template Customer Service page, Central Park's "Lorem ipsum" room card) are in EMAIL-INPUTS.md, not on the page.
9. **The gates became campaign aware.** The Open Sign gates now take a set of rules: Book Direct pages are checked at 360, 390, 768 and 1280, must carry an email link, and health pages must carry no testimonials.
10. **The Open Sign build path was reused** (`buildOpenSignPage`, tokens from `ensureToken`, the same static site), with a Book Direct offer tab, so a page goes live the same way as every earlier page once deploy is approved.
11. **Extra pages read from their own sites** for facts the first read missed: Takapuna's four unit pages and Customer Service page, Bodycare's pricing, services and Book Now pages, St Georges' kennel, cattery and location pages, Greymouth's bookings and facilities pages, and The Comm's Book page source (to find its NowBookIt link). Robots.txt checked, one request a second.
12. **One review quote each** on Tranquillo and Adventure South, both quoted on their own homepages, never a widget. No review on any health or dental page.
13. **Copy kept to their words.** Where a business contradicts itself, the page uses neither claim: St Georges' "cat and dog from the same family" offer ($36.50, or 10% off), Bodycare's second set of hours, Central Park's "5-minute drive" against its own "4 minutes drive to CBD".
14. **Type pairs unique against every earlier page and engine,** not only within the fifteen (section 7); three pages changed their text face for it.
