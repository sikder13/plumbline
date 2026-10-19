# Open Sign run 01: report

Relay: RELAY-OPENSIGN-01. Branch feat/open-sign in ~/nahl-clients-projects/plumbline-open-sign. Nothing deployed, Vercel not touched, no visit report sent from any check.

## The short version

- **Four pages built, not ten.** Of the 140 businesses looked up on Google tonight, only four have a Google profile that is provably theirs (same name, same street address as the filing), open, and without a website. The relay's stop check applies: I built what there was and say so here.
- **All four pass every gate and every review criterion is 8 or more.** None is HOLD. Gate numbers and scores are below.
- **The name match in the relay was too loose.** Token set ratio over whole names scored different businesses that share trade words as matches (for example "Aguirres Welding and Fabrication" against "Lozano Welding and Fabrication", 0.87). Under the literal rule bucket A held 17 leads; only 4 of them were at the filed address, and the other 13 had a different distinctive name or stood at another address, often in another town. I tightened it (below). That is the main decision I took alone.
- **Places calls: 237 of 300.**

## Counts

| | |
|---|---|
| Rows in the export | 9,128 (all filed 1 to 30 September 2026, so every row was inside 90 days) |
| Domestic LLC or for-profit corporation, Indiana, inside 90 days | 6,994 |
| Trade hits among those | 1,228 |
| Candidates (kept) | 1,196 (expected 1,000 to 1,300) |
| Enriched (one Text Search each) | 140 |
| Bucket A | 4 |
| Bucket B | 93 (84 with no profile that is surely theirs; 9 whose name matched but whose profile is at another address, all older businesses in other towns) |
| Bucket C (has a website) | 14, all appended to data/open-sign/campaign-b-queue.csv |
| Bucket D (no profile) | 29 |
| Campaign B queue | 14 |
| Places calls | 237 of 300: 140 Text Search, 71 Place Details, 26 photo files |

Drops by reason (9,128 rows = 1,196 kept + the rest):

| Reason | Rows |
|---|---|
| No trade word in the name | 4,755 |
| Type not a domestic LLC or for-profit corporation (includes 554 assumed name filings with no type description) | 1,903 |
| State not Indiana | 231 |
| Noise words | 995: holdings 184, properties 118, transport 97, logistics 89, consulting 86, ventures 64, rental 60, investments 57, trucking 52, real estate 38, capital 32, supply 31, realty 30, freight 26, hauling 11, marketing 8, distribution 6, wholesale 4, payroll 2 |
| Excluded trades | 44: club 11, bar 8, smoke 7, liquor 5, lounge 4, finance 3, vape 2, tobacco 1, gaming 1, adult 1, loan 1 |
| Franchises | 4: Speedway, Firestone, Midas, Wendy's |

Score histograms:

| Name score (candidates, orders enrichment) | 6: 481 | 5: 491 | 4: 196 | 3: 26 | 2: 2 |
|---|---|---|---|---|---|

| Lead score (bucket A) | 7: 3 | 5: 1 |
|---|---|---|

The top 140 by name score were all score 6 and all from the newest filings (23 to 30 September): 107 trades, 19 food, 14 beauty. Food and beauty businesses that had a profile mostly already have a website (bucket C) or are not open yet.

## The four leads

| Trading name | Trade | Town | Score | Photos | Facebook | Hours |
|---|---|---|---|---|---|---|
| Haute Ink Tattoo Studio | beauty | Terre Haute | 7 | 10 | not found | yes |
| L & R Flooring | trades | Indianapolis | 7 | 6 | not found | yes |
| The Ranch Landscaping Professionals LLC | trades | Indianapolis | 7 | 10 | not found | yes |
| LV Construction | trades | Goshen | 5 | 0 | not found | yes |

No alternates: no fifth business reached bucket A. Each lead folder (data/open-sign/batches/batch-01/<slug>/) holds RESEARCH.md, BRIEF.md, EMAIL-INPUTS.md, facts.json, preview-mobile.png and preview-desktop.png.

Two things for UD to check by hand before sending:
- **The Ranch**: six of their Google photos carry the printed address indianapolis-landscaper.com, though the profile links no site. If that site is live they belong in campaign B. I did not check it (one search per lead). The same owner also filed Indy Cardenal Concrete Services LLC, and a card on the profile names a sister company, Indy Outdoor Landscaping LLC, at the same address.
- **L & R Flooring**: the profile is older than the LLC (its one review is four years old). It is a trading business that formed an LLC in September, not a brand new opening.

## The pages

Gates, final run on the built site (mobile Lighthouse, median of 3; limits: performance 85, accessibility 95, LCP under 2.5 s, CLS under 0.05, TBT under 200 ms):

| Page | Performance | Accessibility | LCP | CLS | TBT | Sideways scroll at 360 and 1440 | Links | Reduced motion | Visit report | Copy scan | Result |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Haute Ink (haute) | 98 | 100 | 2.33 s | 0.000 | 47 ms | none | 11 working, 0 broken | nothing moves | one view, own token, nothing early | clean | PASS |
| L & R Flooring (plank) | 98 | 100 | 2.18 s | 0.001 | 47 ms | none | 11 working, 0 broken | nothing moves | one view, own token, nothing early | clean | PASS |
| The Ranch (mow) | 99 | 100 | 2.10 s | 0.000 | 52 ms | none | 10 working, 0 broken | nothing moves | one view, own token, nothing early | clean | PASS |
| LV Construction (column) | 99 | 100 | 1.66 s | 0.000 | 99 ms | none | 10 working, 0 broken | nothing moves | one view, own token, nothing early | clean | PASS |

axe found no serious or critical issue on either tab at 390 or 1440 on any page. Every hero photo is under 54 KB at the width a phone fetches (Haute Ink 35 KB, The Ranch 48 KB for the phone crop, L & R 13 KB).

Review scores, out of 10, by round (first screen, type, images, layout, calls to action, copy length, motion, polish, brand fit, boutique agency, Awwwards shortlist). Full notes in previews/review/open-sign/REVIEW-ROUNDS.md.

| Page | Round 1 | Round 2 | Round 3 | Result |
|---|---|---|---|---|
| Haute Ink (haute) | 9 9 8 9 9 9 8 8 9 9 8 | 9 9 8 9 9 9 8 8 9 9 8 | 9 9 9 9 9 9 9 9 9 9 8 | PASS |
| L & R Flooring (plank) | 8 9 7 8 9 9 8 8 9 8 7 | 9 9 8 9 9 9 8 9 9 9 8 | 9 9 8 9 9 9 8 9 9 9 8 | PASS |
| The Ranch (mow) | 9 9 6 9 9 9 8 7 9 8 8 | 9 9 8 9 9 9 8 8 9 9 8 | 9 9 8 9 9 9 9 9 9 9 8 | PASS |
| LV Construction (column) | 8 9 8 8 9 9 7 7 8 8 7 | 9 9 8 8 9 9 8 9 8 8 8 | 9 9 8 8 9 9 8 9 8 8 8 | PASS |

Where a page stays at 8, the limit is the material: phone snapshots of floors and yards, and no photos or logo at all for LV.

Blind template check (one reviewer agent, once, all four pages beside Wine Hopper and two random wave 3 pages): no page looked cloned from a reference, but every page shared parts with another new page (the closing block, the section headers, the hero buttons, the label typeface, the floating bar, the phone hero). Each part was rebuilt once; the table is in REVIEW-ROUNDS.md.

Concept, signature and hero per page:

| Page | Concept | Signature | Hero |
|---|---|---|---|
| Haute Ink | The studio's first issue: their sharpest piece as the cover, their name as the masthead | The book: their nine other pieces one at a time, index on desktop, swipe on a phone; turns its first three pages once | Photo (cicada, 2000 x 2667). The masthead turns from ink to paper where it crosses the cover's edge |
| L & R Flooring | Floors laid row by row, close enough to see the seams; their logo's "Residential & Commercial" as the headline | Look closer: a lens over each floor that shows it at its own full pixels, by pointer, finger or arrow keys; sweeps once | Photo (plank in four tones, cropped to the floor, 2000 x 1080), laid in strips on arrival |
| The Ranch | An east side yard crew told by the lawn | Mowed in stripes: their ten services, one stripe each in their lawn's two greens, cut up and back as they arrive | Photo (striped lawn, 2000 x 1125), full bleed |
| LV Construction | A Goshen builder with only a name, a number and a week online, so the week is the picture | The week: seven columns of 24 hours, six filled, Sunday empty, today marked with the Indiana time now | Typographic: their initials as a monogram on concrete (no photos exist) |

Pricing tab: the same on all four. Website up to 3 pages US$500, monthly care US$40, US$200 deposit, balance on going live, live within a week, extras priced separately, one line "Reply to Udaay's email", footer Nahl Technologies Inc., 6902 Challenge Ln, Indianapolis, IN 46250. No call booking button.

Contact sheet: previews/review/open-sign/batch-01-contact-sheet.jpg (the four first phone screens).
Recording: previews/review/open-sign/batch-01-weakest-lv-construction-390.webm (LV Construction, the page with the most 8s; phone width, recorded over 20 seconds of scrolling; no ffprobe on this machine to confirm its exact length).

## Elapsed and decisions

Started 02:35 EDT, report written 04:17 EDT: 1 h 42 min, inside the 6 hour budget.

Decisions I made alone (each also in data/open-sign/STATUS.md):
1. **Name match.** The relay's token set ratio of 0.8 over whole names matched different businesses that share trade words. Mine takes the token set ratio over each name's distinctive words (trade words, generic words like "services", and the town left out), and one shared surname or place word is not enough. Cost if wrong: a few true matches fall to bucket B.
2. **Bucket A needs the same street address.** Nine name matches were older businesses in other towns (an "Enhanced Beauty" in Huntington for a filing in Columbia City, a 337 review halal restaurant in Indianapolis for a filing in Crown Point). Bucket A now also needs the profile's street number to equal the filing's. Cost if wrong: a real lead that moved is missed.
3. **Place Details only for a likely A.** The search result already gives the website and status, so Details are fetched only for a profile that matches, is open and has no website. 55 Details calls were made under the first, loose rule before I caught it, many for other businesses' profiles; the cache keeps them and nothing is called twice.
4. **Fewer than 10 in bucket A**, so all four are built; the spread caps (4 food, 3 of any other group) cut nothing.
5. **"City present"** in the name score read as the filing having a city, which the search needs.
6. **The 554 rows with type code 26 and no description** (assumed names) were dropped as not one of the two kept types.
7. **Photos.** Only photos the business itself posted, plus one by a named person on L & R's profile, credited on the page. Six of The Ranch's photos were left out: they carry printed banners and look like stock. Logos are not used as photos. Every page credits who posted its photos, as Google asks.
8. **The Ranch's services** come from a business card photographed on their own profile, for a sister company of the same owner at the same address. I counted it as sign text in their photos and say so on the page ("As listed on the card photographed on their Google profile"). Cost if wrong: one list to remove.
9. **The checkout.** The folder already held a pnpm init stub and SSH had no key, so I cloned over HTTPS into a scratch folder and moved .git in. data/ and inputs/ stay as UD made them; reports/ and previews/ are local to this checkout.
10. **Committed copies.** inputs/ and reports/ are gitignored, so the relay and the two inspiration files are committed as copies under docs/open-sign/.
11. **A deploy from this checkout would replace the live NZ site.** previews/out/site here holds only the four Open Sign pages. Before "deploy approved", the Open Sign pages need merging into the main folder's site (or the main folder's pages building here), not a plain `plumb preview deploy` from this checkout.
12. **The visit report** was never sent: every check and screenshot marked the browser as ours and answered /api/demo-visit locally, and the gate server rewrites the page's script to post to itself.

## Checks on the code

- Tests: 627 of 627 pass (`pnpm test`), including new tests for the filings reader, name classes, the name match, bucketing, scoring, the pick, the Indiana hours, the copy scan and US phone links. `pnpm lint` and both typechecks are clean.
- The final whole branch review was mine, not a fresh reviewer's: the relay allows one reviewer agent, and it went to the blind template check. Worth a second pair of eyes before the PR.
- Deferred, not fixed: the CSS scoper in packages/preview/src/styles.ts cuts a `url(...)` at its first closing bracket, so an inline SVG with brackets or quotes inside breaks the rest of a stylesheet. LV's grain image is encoded around it. The commit "Never pick a lead that an earlier batch already holds" also carries the removal of an unused component (MowDay.tsx) that was staged at the time.

## Next: batch 02

There are no alternates. The next 140 enrichments are candidates 141 to 280, all still name score 6. On a new Places day (after 03:00 EDT), from ~/nahl-clients-projects/plumbline-open-sign:

```
pnpm plumb leads enrich --campaign open-sign --limit 280 --ceiling 300 && pnpm plumb leads pick --campaign open-sign --batch batch-02
```

The first 140 come from the cache at no cost; candidates 141 to 280 cost one search each, plus Details for likely A leads and up to 10 photos each, inside the 300 ceiling. `leads pick` skips any lead already in batch-01. The pages are then designed by hand from each RESEARCH.md as tonight (content in previews/content/<slug>/, design in apps/previews/designs/), and built and checked with:

```
pnpm plumb leads pages --campaign open-sign --batch batch-02 --site && pnpm plumb leads check --campaign open-sign --batch batch-02
```

Expect about four bucket A leads per 140 on these filings. To get more per day, the dictionary or name score could favour food and beauty storefronts over trades, which is a choice for UD.
