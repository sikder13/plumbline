# RELAY OPENSIGN-01: first ten Open Sign businesses, researched and built

Save as: ~/nahl-clients-projects/plumbline-open-sign/inputs/RELAY-OPENSIGN-01.md
Session: ONE new Claude Code session, Opus, in a NEW checkout at ~/nahl-clients-projects/plumbline-open-sign (branch feat/open-sign). Never the main plumbline folder, never an NZ worktree.

UD is asleep. Work unattended, in order. Stop where it says stop. Keep `data/open-sign/STATUS.md` and work from it instead of re-reading this file. Do not ask questions; take the plain reading and write what you decided in the report.

## Part 0. Setup and standing rules

1. `git clone git@github.com:sikder13/plumbline.git ~/nahl-clients-projects/plumbline-open-sign && cd there && git checkout -b feat/open-sign origin/main`. Symlink `.env` from `~/nahl-clients-projects/plumbline/.env` (it holds GOOGLE_MAPS_API_KEY, restricted to Places API (New), quota 300 requests a day). `pnpm install`.
2. Confirm `data/` is gitignored. Add it if not. Prospect data, assets, caches and the TSV are never committed.
3. Expect `data/open-sign/raw/inbiz-2026-09.tsv` (9,128 rows, tab separated, cp1252, 24 columns: Original_control_number, Corporation_type, Creation_date, ..., Corporation_Name, Corporation_address_1, Corporation_city, Corporation_state, Corporation_zip_code, Agent_name, ..., Corporation_type_desc). If missing, stop and report.
4. Read before writing code: the Wine Hopper page source, `docs/PREMIUM-STANDARD.md`, `reports/nz-tourism-1/wave-3/INSPIRATION.md`, the three strongest wave 3 pages, the visit beacon, the pricing tab, and how demo pages deploy to nahltech.com/demo/<slug>-<token>. Reuse all plumbing unchanged.
5. Standing rules: no AI traces in commits, code, comments or file names; never squash, rebase, force push or reset --hard; keys only in .env, never printed; never commit prospect data; do not deploy and do not touch Vercel (live NZ pages are being read); never fire the beacon from tests or screenshots; no new web research beyond what Part 2 allows; budget 6 hours wall clock, then stop and report wherever you are.

## Part 1. Lead pull: `leads pull --campaign open-sign`

Read the TSV with a script, never into context. Keep: Corporation_type_desc in (Domestic Limited Liability Company, Domestic For-Profit Corporation), Corporation_state IN, Creation_date within 90 days of today.

Trade dictionary `config/open-sign/trades.yml`, 250 or more words, grouped: food, beauty, cleaning, trades, auto, care_fitness, repair_retail. Include the Spanish words that appear in Indiana business names (taqueria, panaderia, carniceria, pupuseria, tienda, lavanderia, barberia). Each hit sets `trade_group`.

Exclusions on the name, with the reason written to the pool file: liquor, bar, pub, tavern, lounge, club, vape, smoke, tobacco, hemp, cbd, cannabis, casino, gaming, lending, loan, finance, credit, pawn, adult. Noise: logistics, trucking, freight, transport, hauling, holdings, properties, investments, consulting, marketing, wholesale, distribution, supply, rental, realty, real estate, payroll, capital, ventures. Franchise list `config/open-sign/franchises.yml`, 80 or more names, dropped.

`owner_is_agent` is true unless Agent_name matches a formation service (registered agent, agents inc, service center, entity protect, corporation agents).

Name score, used only to order enrichment: trade word present 2, owner_is_agent 1, city present 1, filed in the last 45 days 1, trade_group in food or beauty or trades 1.

Write `data/open-sign/leads/_pool.csv` (every row with keep or drop reason) and `_candidates.csv` (kept rows, name score descending). Expected on this file: 1,000 to 1,300 candidates. Under 600 or over 2,500 means the dictionary is wrong; fix it first.

## Part 2. Enrich and research the top 140 candidates

Places API (New), quota is 300 calls a day, so at most 140 candidates tonight (one Text Search each, one Place Details only when the name match is 0.8 or better by token set ratio). Field mask only: id, displayName, formattedAddress, addressComponents, nationalPhoneNumber, websiteUri, googleMapsUri, rating, userRatingCount, regularOpeningHours, photos, businessStatus, primaryType, primaryTypeDisplayName, editorialSummary, reviews. Cache every response in `data/open-sign/cache/places/<slug>.json`; never repeat a call. Stop and report on any quota or billing error.

Bucket each enriched lead:
- A: profile found, websiteUri empty, businessStatus OPERATIONAL.
- B: profile found, websiteUri empty, not operational or match under 0.8.
- C: profile found with websiteUri. Append to `data/open-sign/campaign-b-queue.csv` with the URL and go no further with it.
- D: no profile.

Lead score for bucket A, one point each: userRatingCount 1 to 15; hours present; 4 or more photos; phone present; owner_is_agent; trade_group in food, beauty or trades; filed in the last 45 days. Write `_scored.csv`.

Take the top 10 by score, then by Creation_date newest first. Ties broken toward a spread of trades (no more than 4 food, no more than 3 of any other group). Reserve the next 5 as alternates.

For each of the 10, one public web search only: the business name plus city. Purpose: find their Facebook page URL, any "now open" article, a posted menu or price list. Record the URLs. Do not log in anywhere, do not scrape Facebook; one plain fetch of the Facebook URL is allowed, and if it returns a login wall, record "login wall" and move on. Download up to 10 Google photos per lead into `data/open-sign/assets/<slug>/` at max 2000px wide. No photos, no download, never stock.

Write `data/open-sign/batches/batch-01/<slug>/RESEARCH.md` for each of the 10:
1. Identity: legal name, trading name on Google, filing date, owner name if owner_is_agent, address, county, phone, Google Maps link, Facebook link or "not found".
2. What they are: primary type, editorial summary if any, hours, what the photos show (count, subjects, best four by size and sharpness).
3. What customers say: themes from the Google reviews, two or three lines, research only, never quoted on the page.
4. Findings, three plain lines each with its source: what a customer sees today when they search this business (profile only, no site), what is missing or weak on the profile (no hours, few photos, no menu, no description), and the one thing the demo page gives them that the profile cannot.
5. Signals and score, with the points listed.
6. Their own words: every phrase we can honestly attribute to them (profile description, editorial summary, menu names, sign text visible in photos). The page uses only these.

Also `batch-01/LEADS.csv` (slug, legal name, trading name, trade group, city, county, zip, filing date, phone, address, hours yes or no, photo count, score, Google link, Facebook link, email empty, planned demo URL, status) and `batch-01/BATCH-README.md` for UD: what each file is, that the email column is his to fill from the Facebook About section, and that only a published email is ever used.

STOP CHECK: if fewer than 10 bucket A leads reach score 3, build what you have and say so in the report.

## Part 3. Design research (once, 30 minutes, before any page)

Reuse `reports/nz-tourism-1/wave-3/INSPIRATION.md`. Add `reports/open-sign/INSPIRATION-LOCAL.md` with 10 current award-level references for local businesses: restaurants and cafes, barbers and salons, trades and home services, auto, fitness and care. Awwwards, the Framer gallery, Godly, Siteinspire. Note for each the pattern worth borrowing: hero treatment, how hours and location are shown, how a menu or service list is laid out, the one signature interaction, typography. Patterns and philosophy only, never assets, code or layouts.

The bar, in UD's words: better than any agency using Framer. Wave 3 pages are the reference, not wave 4 engines. Each page is designed from the business, not from a template.

## Part 4. Build the ten pages the wave 3 way

For each business, in this order, three pages in parallel at most:

1. Concept: from RESEARCH.md, one line that says what this page is (a Wabash coffee shop at 6 am, a barber who posts every cut, a roofer who answers the phone). One signature interaction built only from real facts: an hours strip that knows the current day, a menu board from their posted menu, a service list in their own words, a gallery from their own photos, a map and call block. Never invented times, prices, claims or reviews. If facts are thin, the signature is typographic and still honest.
2. Brief at the top of the page recipe: mood in three words, headline in their words (five words or fewer), hero choice (photo if at least one image is 1800px wide and sharp, otherwise typographic), signature interaction, references used, type pair and palette (palette from their photos and sign colours, WCAG AA checked).
3. Build it bespoke. No section library for anything visible. The library is only plumbing: beacon, tab switch, pricing tab.
4. Pricing tab, identical on every page: Website, up to 3 pages (home, services or menu, contact), US$500. Monthly care US$40: hosting, edits, hours and menu changes, security updates. Deposit US$200 to start, balance when the site goes live, live within one week of the deposit. Extra pages, booking, ordering and Google profile work priced separately. The only Nahl action is one line: "Reply to Udaay's email". No call booking button. Footer: Nahl Technologies Inc., 6902 Challenge Ln, Indianapolis, IN 46250.
5. Their actions: call button to their real phone, directions to their real Google Maps link, hours as published. Nothing else.
6. Motion and gates from PREMIUM-STANDARD.md: performance 85 or more, LCP under 2.5 s, CLS under 0.05, TBT under 200 ms, accessibility 95 or more, no sideways scroll at 360 and 1440, working links, prefers-reduced-motion respected. Copy scan: no dash characters inside sentences, no placeholder text, no AI words (empower, leverage, unlock, transform, harness, cutting-edge, innovative, world-class, solutions, forward-thinking), no claims not in RESEARCH.md section 6.
7. Review: three rounds on the ten criteria plus "would an Awwwards jury shortlist this", judged from 390px and 1440px screenshots next to Wine Hopper and the best wave 3 page. Target 9 on every criterion, never below 8. Three rounds maximum; a page still under 8 after three is marked HOLD, not rebuilt a fourth time.
8. Blind template check: one reviewer subagent, once for all ten pages together, sees each page next to Wine Hopper and two random wave 3 pages, and answers one question: does any part look like it came from the same template as another page? Rebuild only the parts that get a yes, once.
9. Output per lead folder: the built page, `preview-mobile.png` (390), `preview-desktop.png` (1440), the recipe with the brief, and `EMAIL-INPUTS.md` (trading name, city, filing date and source, the three findings in plain words, the demo URL, the one fact that makes this business specific).

Planned demo URL: nahltech.com/demo/<slug>-<token>, same token scheme and beacon as NZ. Build locally only. Deploy happens after UD says "deploy approved".

Token rules for this part: screenshots not recordings, except one 20 second phone recording of the weakest page for UD; status file instead of re-reading; one line printed per business per step; the single reviewer subagent above and no others.

## Part 5. Commit and report

Commit code, configs, docs, the two inspiration files and this relay to feat/open-sign in small human-reading commits. No PR; UD opens it.

Write `data/open-sign/RUN-REPORT-01.md` and copy it to `docs/RUN-REPORT-OPENSIGN-01.md`:
- counts: rows, domestic in window, trade hits, drops by reason, candidates, enriched, buckets A to D, score histogram, campaign B queue size, Places calls made
- the ten leads: trading name, trade, city, score, photo count, Facebook found or not, hours found or not
- per page: concept line, signature interaction, hero type, gate numbers, review scores by round, HOLD or PASS
- contact sheet `previews/review/open-sign/batch-01-contact-sheet.jpg` of the ten first phone screens, plus the one recording
- elapsed time, anything decided alone, and the exact next command to build batch 02 from the alternates and the next 140 enrichments
