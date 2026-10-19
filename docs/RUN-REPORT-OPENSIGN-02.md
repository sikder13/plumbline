# Open Sign run 02: report

Relay: RELAY-OPENSIGN-02. Branch feat/open-sign in ~/nahl-clients-projects/plumbline-open-sign. Nothing deployed, Vercel not touched, no visit report sent from any check or screenshot.

## The short version

- **Ten pages built, all PASS.** Every gate passes on all ten and every review score is 8 or more after three rounds, so none is HOLD.
- **The sweep found far more than the filings did.** 1,902 Indianapolis profiles from 108 searches; 336 survived the filters into bucket A (run 01 found 4 from 140 filings). Only 2 of the 336 are new filings, so this campaign is now mostly about established businesses without a website, not new ones.
- **Places calls: 755 in run 02, 992 today with run 01's 237, against a ceiling of 1,950.** No quota error.
- **No Facebook or Instagram found for any of the ten** (one web search each; no Facebook fetch was needed).
- **The blind template check found seven shared parts** across the fourteen Open Sign pages (heroes, call buttons, hours band, close, label face, page order); no page copied a reference. Each was rebuilt once on twelve pages, three of them from batch 01, and all fourteen pass the gates again.

## Sweep

`pnpm plumb leads sweep --campaign open-sign --city indianapolis`: 18 terms across 6 areas of 8 km (downtown, north, east, south, west, northeast), paged to 60 results per query, with the relay's field mask. Pages cached under data/open-sign/cache/sweep/indianapolis/, Details under data/open-sign/cache/sweep/details/.

| | |
|---|---|
| Queries (term x area) | 108 |
| Result pages fetched | 321 |
| Results | 5,550 |
| Unique profiles | 1,902 |
| Bucket A | 336 |

Drops, applied in the relay's order (each profile counted once, at its first reason):

| Reason | Profiles |
|---|---|
| Has a website (all appended to data/open-sign/campaign-b-queue.csv with URL, source and trade) | 1,389 |
| Not operational | 0 |
| Rating count under 3 or over 150 | 168 |
| Franchise (151 names in config/open-sign/franchises.yml, 28 added tonight, plus any store number) | 4 |
| Faith screen (name or primary type) | 5 |

Bucket A by group: beauty 160, food 73, auto and home 103.

Bucket A by area (each profile counted in the first area whose search returned it, so downtown, searched first, is inflated): downtown 131, north 41, east 62, south 25, west 55, northeast 22.

Place Details: 336 calls, one per bucket A lead (all of them fit under the 1,200 cap, so the 5 to 60 rating count priority never had to cut anything).

New filings (INBiz cross-check, same street number and a name match of 0.8 or more): **2 of 336**.
- Epiphany Braids (beauty, Indianapolis, filed in September 2026; score 6 with 3 reviews, so behind the other score 6 leads on rating count).
- Honest Mann's Tire & Auto (auto, Indianapolis, filed in September 2026; score 4).

Score spread in bucket A (out of 8): 7: 1, 6: 73, 5: 99, 4: 111, 3: 40, 2: 10, 1: 1, 0: 1. Written to data/open-sign/leads/_sweep_scored.csv.

### Calls and cost

| | Calls |
|---|---|
| Text Search (sweep pages) | 321 |
| Place Details (bucket A) | 336 |
| Photo files (up to 10 for each of the ten) | 98 |
| Run 02 total | 755 |
| Run 01 earlier the same Pacific day | 237 (140 Text Search, 71 Details, 26 photos) |
| Today | 992 of the 1,950 ceiling (quota 2,000) |

Estimated cost at list price: Text Search Enterprise 321 x $0.035 = $11.24 (price from prices.json); Details with reviews and editorial summary (Enterprise + Atmosphere) 336 x about $0.025 = about $8.40; photos 98 x about $0.007 = about $0.69. **About $20 at list price.** The Details and photo prices are not in prices.json and are from memory of Google's published list, not checked tonight (no web research allowed for it); they should be added to prices.json. Each of these SKUs has 1,000 free calls a month, and this checkout's ledgers show 461 Text Search, 407 Details and 124 photos this month, so **the bill should be $0 if nothing else used the key this month**. The key is shared with the main checkout, whose usage I cannot see from here.

## The ten

Picked by score, then rating count, at most 4 per group, none from batch 01 or the campaign B queue. Ten alternates in data/open-sign/batches/batch-02/ALTERNATES.csv (nine beauty, one taquería, all score 6).

| Business | Group | Score | Rating | Reviews | Photos on Google | Facebook | Instagram | New filing |
|---|---|---|---|---|---|---|---|---|
| Biz On Fletcher | beauty | 7 | 4.6 | 60 | 10+ | not found | not found | no |
| Players Way Barbershop | beauty | 6 | 4.8 | 93 | 10+ | not found | not found | no |
| MISS FOOD Restaurant | food | 6 | 4.7 | 60 | 10+ | not found | not found | no |
| La Reyna Bakery | food | 6 | 4.3 | 59 | 10+ | not found | not found | no |
| Roatan Barbershop & Salon | beauty | 6 | 4.4 | 57 | 10+ | not found | not found | no |
| Alexiva Bakery | food | 6 | 4.6 | 56 | 10+ | not found | not found | no |
| Craig's Hair Care | beauty | 6 | 4.9 | 55 | 10+ | not found | not found | no |
| El Tajin Taquería & Birriería | food | 6 | 4.7 | 49 | 10+ | not found | not found | no |
| TURBO TIRE SHOP | auto | 5 | 4.3 | 60 | 10+ | not found | not found | no |
| South Indy Auto Repair | auto | 5 | 4.9 | 56 | 8 | not found | not found | no |

Players Way's 93 reviews is outside the 5 to 60 band, so it lost that point and still scored 6. Auto and home filled only 2 of its 4 places because its next leads scored lower than the remaining food and beauty ones.

Each lead folder (data/open-sign/batches/batch-02/<slug>/) holds facts.json, RESEARCH.md (six sections), BRIEF.md, recipe.json, EMAIL-INPUTS.md, preview-mobile.png, preview-desktop.png and page/ (the built page). LEADS.csv carries the extra columns new_filing, rating, rating_count, facebook_url, instagram_url and an empty email. BATCH-README.md explains the folder.

For UD to check by hand before sending:
- **Players Way**: the sign on the building reads "Barber & Beauty Lounge". The Google name and type pass the faith screen, which the relay defines on those, so the lead stays; the page never uses the word.
- **South Indy Auto Repair**: its Manta listing (first person, so counted as their words) says "by appointment"; the page uses Google's hours only.
- **Photos**: where a business posted few photos of its own, customer photos are used and each is credited to its poster on the page. Photos showing children were left out (Players Way's was swapped, Roatan's deck has adult cuts only).

## The pages

Gates, final run on the built site holding all fourteen Open Sign pages (mobile Lighthouse, median of 3; limits: performance 85, accessibility 95, LCP under 2.5 s, CLS under 0.05, TBT under 200 ms). Batch 01 was re-checked too, because the template check rebuild touched three of its pages:

| Page | Performance | Accessibility | LCP | CLS | TBT | Sideways scroll at 360 and 1440 | Links | Reduced motion | Visit report | Copy scan | Result |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Biz On Fletcher (cottage) | 99 | 100 | 2.03 s | 0.001 | 50 ms | none | 9 working, 0 broken | nothing moves | one view, own token, nothing early | clean | PASS |
| Players Way (letterboard) | 99 | 100 | 2.18 s | 0.000 | 48 ms | none | 10 working, 0 broken | nothing moves | one view, own token, nothing early | clean | PASS |
| South Indy Auto Repair (ticket) | 99 | 100 | 2.26 s | 0.000 | 44 ms | none | 10 working, 0 broken | nothing moves | one view, own token, nothing early | clean | PASS |
| Craig's Hair Care (panorama) | 100 | 100 | 1.80 s | 0.000 | 42 ms | none | 10 working, 0 broken | nothing moves | one view, own token, nothing early | clean | PASS |
| MISS FOOD (plate) | 100 | 100 | 1.73 s | 0.000 | 44 ms | none | 9 working, 0 broken | nothing moves | one view, own token, nothing early | clean | PASS |
| La Reyna Bakery (shelf) | 99 | 100 | 2.10 s | 0.000 | 44 ms | none | 9 working, 0 broken | nothing moves | one view, own token, nothing early | clean | PASS |
| Alexiva Bakery (tier) | 99 | 100 | 2.18 s | 0.000 | 50 ms | none | 9 working, 0 broken | nothing moves | one view, own token, nothing early | clean | PASS |
| El Tajin (mesa) | 99 | 100 | 2.18 s | 0.000 | 44 ms | none | 10 working, 0 broken | nothing moves | one view, own token, nothing early | clean | PASS |
| TURBO TIRE SHOP (bay) | 100 | 100 | 1.81 s | 0.000 | 42 ms | none | 11 working, 0 broken | nothing moves | one view, own token, nothing early | clean | PASS |
| Roatan (deck) | 100 | 100 | 1.81 s | 0.000 | 42 ms | none | 10 working, 0 broken | nothing moves | one view, own token, nothing early | clean | PASS |
| Haute Ink (haute, batch 01) | 98 | 100 | 2.33 s | 0.000 | 43 ms | none | 11 working, 0 broken | nothing moves | one view, own token, nothing early | clean | PASS |
| L & R Flooring (plank, batch 01) | 98 | 100 | 2.18 s | 0.001 | 42 ms | none | 11 working, 0 broken | nothing moves | one view, own token, nothing early | clean | PASS |
| The Ranch (mow, batch 01) | 99 | 100 | 2.10 s | 0.000 | 42 ms | none | 10 working, 0 broken | nothing moves | one view, own token, nothing early | clean | PASS |
| LV Construction (column, batch 01) | 99 | 100 | 1.66 s | 0.000 | 86 ms | none | 10 working, 0 broken | nothing moves | one view, own token, nothing early | clean | PASS |

axe found no serious or critical issue at 390 or 1440 on any page. On the way there: La Reyna's swipe shelves were not reachable from the keyboard and Turbo's street line was 4.45:1 on its blue (both fixed after the first gate run); after the rebuild, MISS FOOD's small gold label was 3.2:1 on the olive (brightened) and LV's Directions link timed out once reaching Google Maps from here (passed on the re-run, nothing changed).

Review scores, out of 10, by round (first screen, type, images, layout, calls to action, copy length, motion, polish, brand fit, boutique agency, Awwwards shortlist). Full notes in previews/review/open-sign/REVIEW-ROUNDS-02.md. The three rounds came before the blind check; its rebuilds changed parts, not scores, and were checked by screenshot and by the gates.

| Page | Round 1 | Round 2 | Round 3 | Result |
|---|---|---|---|---|
| Biz On Fletcher (cottage) | 8 9 9 9 9 9 9 8 9 9 8 | 9 9 9 9 9 9 9 9 9 9 8 | 9 9 9 9 9 9 9 9 9 9 8 | PASS |
| Players Way (letterboard) | 9 9 8 9 9 9 8 8 9 9 8 | 9 9 9 9 9 9 8 8 9 8 8 | 9 9 9 9 9 9 8 9 9 9 8 | PASS |
| South Indy Auto Repair (ticket) | 9 9 8 8 9 9 8 7 9 8 8 | 9 9 9 9 9 9 8 9 9 9 8 | 9 9 9 9 9 9 8 9 9 9 8 | PASS |
| Craig's Hair Care (panorama) | 9 9 8 8 9 9 8 8 8 8 7 | 9 9 8 9 9 9 9 9 9 9 8 | 9 9 8 9 9 9 9 9 9 9 8 | PASS |
| MISS FOOD (plate) | 9 9 8 9 9 9 8 7 9 9 8 | 9 9 9 9 9 9 9 9 9 9 8 | 9 9 9 9 9 9 9 9 9 9 8 | PASS |
| La Reyna Bakery (shelf) | 9 9 8 9 9 9 8 8 9 9 8 | 9 9 9 9 9 9 8 8 9 9 8 | 9 9 9 9 9 9 8 9 9 9 8 | PASS |
| Alexiva Bakery (tier) | 9 9 8 9 9 9 8 8 9 9 8 | 9 9 8 9 9 9 9 9 9 9 8 | 9 9 8 9 9 9 9 9 9 9 8 | PASS |
| El Tajin (mesa) | 9 9 8 9 9 9 9 7 9 9 8 | 9 9 9 9 9 9 9 9 9 9 9 | 9 9 9 9 9 9 9 9 9 9 9 | PASS |
| TURBO TIRE SHOP (bay) | 8 8 8 9 9 9 9 7 9 8 8 | 9 9 8 9 9 9 9 9 9 9 8 | 9 9 8 9 9 9 9 9 9 9 8 | PASS |
| Roatan (deck) | 9 9 8 9 9 9 8 8 9 9 8 | 9 9 8 9 9 9 9 8 9 9 8 | 9 9 8 9 9 9 9 9 9 9 8 | PASS |

Where a page stays at 8, the limit is the material (phone snapshots of a room, cakes on counters, a parking lot, mirror selfies of cuts) or a signature that plays on scroll rather than in the hand.

Concept, signature and hero per page:

| Page | Concept | Signature | Hero |
|---|---|---|---|
| Biz On Fletcher (cottage) | A salon in a restored cottage: see the house, then walk in through the door with their line on the glass | Walk in: three photos (door glass, floor, chair), each opening out of a window into the next as you scroll; pinned on desktop | Photo (the cottage, 2000 x 1500) across the screen behind cream window bars, a plaque hung across its foot; Marcellus and Alegreya |
| Players Way (letterboard) | A barbershop told on a felt letterboard, in the words Google uses for them | The board: their services set letter by letter on felt as it comes into view; the week on a second board, the address on a third | Photo (red front, 2000 x 2667) with the name on a framed felt board hung over it; Oswald and Bitter |
| South Indy Auto Repair (ticket) | A red steel shop introduced on a work order, in their own words, with the day's stamp | The work order: every field one of their facts, stamped OPEN NOW or CLOSED from the Indiana clock | Photo (red building in its field, 2000 x 2667) beside the work order; Roboto Slab and Martian Mono |
| Craig's Hair Care (panorama) | Custom barbering since 1974, shown the way a regular sees the long room | Look around: one wide photo of the room to drag or arrow end to end; pans once on its own | Photo (front with BARBER sign, 2000 x 946) as a long band under the name; Zilla Slab and Hanken Grotesk |
| MISS FOOD (plate) | A Caribbean kitchen with no menu online: the plates are the menu | The plate wheel: four plates on a turning table, drag or arrows bring the next to the front | Photo (shrimp tray, 2000 x 1500) cut as one round plate on olive, parting the name; Young Serif and Instrument Sans |
| La Reyna Bakery (shelf) | A west side panadería: the page is their glass case | The case: two glass shelves of trays sliding past in opposite directions as you scroll; swipe rows on a phone | Photo (tray of conchas, 2000 x 1300) with the name as a round pink box sticker on it; Abril Fatface and Work Sans |
| Alexiva Bakery (tier) | An Eastside panadería under a red BAKERY sign, open till nine | Tiers: three cakes stacking into a tiered cake as you scroll; a neon OPEN at the close, lit only while they are open | Sign first: BAKERY glowing red over the name, the photo (filled pastries, 2000 x 2667) in an arched window; Yeseva One and Sora |
| El Tajin (mesa) | A taquería open seven days: the page is their table | The table: six plates set down from the table's edges when it first shows; a plate lifts under the pointer on desktop | Photo (seafood spread, 2000 x 1333) filling the screen, the name and an order ticket on it; Bricolage Grotesque and Fraunces |
| TURBO TIRE SHOP (bay) | A blue tire shop that opens like its roll-up doors | The bays: three photos behind roll-up doors that lift slat by slat as each arrives | Photo (blue building, 2000 x 1500) under the name on a blue fascia, revealed by a door lifting on arrival; Syne and Familjen Grotesk |
| Roatan Barbershop & Salon (deck) | A barbershop in the blue, white and red of its own shirts | The deck: five cuts as a stack of cards to drag, swipe or flick with a button | Typographic first: the name, then the photo (their shirts and cap, 2000 x 1511) as a tilted card on a band of their three colours; Rozha One and Outfit |

Variety: ten new type pairs, none used by batch 01, Wine Hopper, wave 3 or the wave 4 engines (all registered in packages/preview/src/engine/variety.ts, where a test fails on any repeat). Ten palettes taken from each business's own photos and signs, ten different heroes, ten different floating call bars and ten different closes.

Pricing tab: the same on all ten as on batch 01 (website up to 3 pages US$500, care US$40 a month, US$200 deposit, live within a week, "Reply to Udaay's email" as the only action, footer with 6902 Challenge Ln).

Contact sheet: previews/review/open-sign/batch-02-contact-sheet.jpg (the ten first phone screens).
Recording: previews/review/open-sign/batch-02-weakest-turbo-tire-shop-390.webm (TURBO TIRE SHOP, the page with the lowest first round and the thinnest photos; phone width, 20 seconds of scrolling; no ffprobe on this machine to confirm the exact length).
Contact sheet for batch 01 redone too (previews/review/open-sign/batch-01-contact-sheet.jpg), since its calls changed.

## Blind template check

One reviewer agent, once, all fourteen Open Sign pages (batch 01 and 02) under shuffled letters beside Wine Hopper and the two wave 3 pages from run 01's check, no build notes. Verdict: no page cloned from a reference (the closest was LV Construction borrowing Wine Hopper's heavy wide sans with monospace labels), but **seven parts were shared across new pages**, mostly because the pages were built fast from one habit: the phone hero (photo band, then name, then two buttons), the call and directions pair, the desktop 55/45 split, the light hours band, the centred sign close, a monospace label face, and the page order (hero, one gallery, hours band, close).

Every part that got a yes was rebuilt once, keeping the one page the reviewer named (South Indy for the heroes, calls and label face; Turbo for the hours band; Craig's for the close and the page order). The rebuild touched twelve pages, three of them from batch 01 (L & R's desktop hero and calls, The Ranch's calls, LV's label face). Now every page has its own call treatment: a neon tube, two full width bars, a round token, two square keys, the number written out, an order ticket, a board tile, price tags, a brick block with a map key, ruled spec lines and a pill with a round arrow. The full table is in previews/review/open-sign/REVIEW-ROUNDS-02.md. The check was not run a second time (the relay allows one).

## Elapsed and decisions

Started 04:27 EDT, report written 06:50 EDT: 2 h 23 min, inside the 5 hour budget.

Decisions I made alone (each also in data/open-sign/STATUS.md):
1. **Ceiling 1,950 for the day, not 1,800 more.** Run 01 had already used 237 calls in the same Pacific quota day, so the sweep counted both ledgers against one ceiling under the raised 2,000 quota. Cost if wrong: none, the day ended at 992.
2. **Area counts** go to the first area whose search returned a profile, so downtown is inflated. Cost: a reporting skew only.
3. **Customer photos** are used where the business posted few, each credited to its poster on the page. Cost if wrong: swap in the business's own photos.
4. **Players Way stays** although its sign says "Lounge": the faith screen is defined on the Google name and type, which pass. The page does not quote the word.
5. **South Indy's Manta listing** counts as their own words (first person); its "by appointment" hours are not used.
6. **No children in photos.** Players Way's child photo was swapped for another cut; Roatan's deck uses adult cuts only.
7. **Pages and check take several batches** (`--batch batch-01,batch-02`), so the built site carries all 14 Open Sign pages and batch 01 stays checkable. One batch works as before.
8. **The blind check references** are the same three as run 01 (Wine Hopper, Nelson Tours and Travel, River T Estate Wines), reused rather than re-drawn, so both checks are comparable.
9. **Details for all 336** in bucket A: the 1,200 cap was never reached, so the rating count priority did not decide anything.
10. **A deploy from this checkout would still replace the live NZ site.** previews/out/site here holds only the 14 Open Sign pages. They need merging with the main folder's site before any deploy.

## Checks on the code

- Tests: 633 of 633 pass (`pnpm test`), including the sweep's drop order, score, new filing match and pick, and the type pair registry (now holding all fourteen Open Sign pairs). `pnpm lint` and the previews typecheck are clean.
- The final whole branch review was mine, not a fresh reviewer's: the one reviewer agent the relay allows went to the blind template check.
- Deferred, not fixed: the CSS scoper still cuts a `url(...)` at its first closing bracket (run 01's note). `_sweep_scored.csv` is one file, so each city's `sweep-pick` must run before the next city's sweep.

## Next: the other cities

From ~/nahl-clients-projects/plumbline-open-sign, one city per Places day is safest (a city sweep is 18 terms x its areas x up to 3 pages, plus Details for its bucket A and photos for its ten). The ceiling counts every call made the same Pacific day (the day turns at 03:00 EDT), so lower it if anything else ran that day. Each city's areas are in config/open-sign/sweep.yml.

```
pnpm plumb leads sweep --campaign open-sign --city fort-wayne --ceiling 1950 && pnpm plumb leads sweep-pick --campaign open-sign --batch batch-03
pnpm plumb leads sweep --campaign open-sign --city evansville --ceiling 1950 && pnpm plumb leads sweep-pick --campaign open-sign --batch batch-04
pnpm plumb leads sweep --campaign open-sign --city south-bend --ceiling 1950 && pnpm plumb leads sweep-pick --campaign open-sign --batch batch-05
pnpm plumb leads sweep --campaign open-sign --city lafayette --ceiling 1950 && pnpm plumb leads sweep-pick --campaign open-sign --batch batch-06
pnpm plumb leads sweep --campaign open-sign --city bloomington --ceiling 1950 && pnpm plumb leads sweep-pick --campaign open-sign --batch batch-07
```

`sweep-pick` skips anything in an earlier batch or the campaign B queue, gives each lead its demo token and downloads up to 10 photos. A sweep stopped by the ceiling resumes from its cache at no cost. The pages are then designed by hand from each RESEARCH.md as tonight and built and checked with:

```
pnpm plumb leads pages --campaign open-sign --batch batch-01,batch-02,batch-03 --site && pnpm plumb leads check --campaign open-sign --batch batch-03 --runs 3
```
