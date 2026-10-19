Save as: ~/nahl-clients-projects/plumbline-open-sign/inputs/RELAY-OPENSIGN-02.md (committed copy under docs/open-sign/ as before) Session: the same checkout, ~/nahl-clients-projects/plumbline-open-sign, branch feat/open-sign, one Opus session. Read data/open-sign/STATUS.md and docs/RUN-REPORT-OPENSIGN-01.md first; keep working from STATUS.md.

UD is asleep. Work unattended. Same standing rules as RELAY-OPENSIGN-01 Part 0: no AI traces, never squash, keys only in .env, never commit prospect data, do not deploy, do not touch Vercel, never fire the beacon from tests, no web research beyond what is allowed here. Budget 5 hours, then stop and report.

Why this relay exists

Batch 01 showed that new filings rarely have a Google profile yet: 4 bucket A leads from 140. The supply for Open Sign is businesses that already exist on Google with no website. This relay finds them directly. The Places daily quota has been raised to 2,000 by UD. If a call returns a quota error, stop and report.

Part 1. Sweep: leads sweep --campaign open-sign --city indianapolis

Places API (New) Text Search, one query per trade term per area, field mask limited to: id, displayName, formattedAddress, addressComponents, nationalPhoneNumber, websiteUri, googleMapsUri, rating, userRatingCount, businessStatus, primaryType, primaryTypeDisplayName. Page through results (nextPageToken) up to 60 per query. Cache every response under data/open-sign/cache/sweep/. Count calls in STATUS.md and stop at 1,800 for the night.

Areas: Indianapolis split into six location biases so each query covers a different part of the city (downtown, north and Broad Ripple, east, south and Greenwood edge, west and Speedway, northeast and Castleton), radius about 8 km each.

Trade terms, three groups, 18 terms:

beauty: barber shop, hair salon, nail salon, lash studio, braiding salon, tattoo studio
food: taqueria, food truck, bakery, coffee shop, pizza, soul food restaurant
auto and home: auto detailing, tire shop, mechanic, lawn care, pressure washing, house cleaning

That is 18 terms x 6 areas = 108 queries, up to 3 pages each, so at most 324 search calls. Expect several thousand profiles before filtering.

Part 2. Filter and bucket

Drop: websiteUri present (append to data/open-sign/campaign-b-queue.csv with URL and trade, no further calls), businessStatus not OPERATIONAL, userRatingCount under 3 or over 150, any name on config/open-sign/franchises.yml (extend it: add Great Clips, Sport Clips, Supercuts, Fantastic Sams, Regis, Cost Cutters, Jiffy Lube, Valvoline, Take 5, Discount Tire, Firestone, Goodyear, Belle Tire, Tire Barn, Midas, Meineke, Monro, Mr. Clean Car Wash, Crew Carwash, The Lash Lounge, Amazing Lash, Deka Lash, European Wax Center, Waxing the City, Domino's, Papa John's, Little Caesars, Marco's, Jet's, Hungry Howie's, Pizza Hut, Donatos, Crumbl, Nothing Bundt Cakes, Insomnia, Starbucks, Dunkin, Scooter's, 7 Brew, Biggby, Tim Hortons, Qdoba, Chipotle, Taco Bell, Del Taco, Molly Maid, Merry Maids, The Cleaning Authority, Two Maids, MaidPro, TruGreen, Lawn Doctor, Weed Man, Grounds Guys, Fuzzy's, Condado and any name with a store number). Also drop any name or primary type that fails the faith screen (bar, pub, lounge, club, hookah, vape, smoke, liquor, hemp, cbd, dispensary, casino, pawn, adult).

Keep the rest as bucket A. One Place Details call per bucket A lead only, field mask: regularOpeningHours, photos, editorialSummary, reviews. Cap Details at 1,200 calls; if more leads than that, take them in rating-count order, 5 to 60 first.

Cross-check with INBiz: match each bucket A lead's name and street number against data/open-sign/leads/_candidates.csv. A match sets new_filing = true and the filing date. This is a tag, not a filter.

Score, one point each, max 8: userRatingCount 5 to 60; rating 4.3 or better; hours present; 6 or more photos; phone present; editorialSummary present; trade group beauty or food; new_filing. Write data/open-sign/leads/_sweep_scored.csv.

Part 3. Pick ten and research them

Pick ten: top by score, then rating count descending, spread no more than 4 per trade group, none already in batch 01 or the campaign B queue. Reserve ten alternates.

For each of the ten, one public web search only (name plus Indianapolis): find a Facebook or Instagram URL, a posted menu or price list, any article. One plain fetch of the Facebook URL is allowed; a login wall is recorded and left. No logins, no scraping. Download up to 10 photos into data/open-sign/assets/<slug>/ at max 2000px.

Write data/open-sign/batches/batch-02/<slug>/RESEARCH.md with the same six sections as relay 01 (identity, what they are, what customers say for research only, three findings with sources, signals and score, their own words). Section 4 findings for an existing business read as: what a customer sees today (profile only, X reviews, no website), what the profile lacks (no hours, no description, few photos, no menu), what the page gives them (one honest line).

batch-02/LEADS.csv as in relay 01, with added columns new_filing, rating, rating_count, facebook_url, instagram_url, email (empty). batch-02/BATCH-README.md as before.

Part 4. Build the ten pages

Exactly as relay 01 Part 4: concept and one signature interaction from real facts only, bespoke build, same pricing tab ($500 up to 3 pages, $40 a month, $200 deposit, live within a week, reply to Udaay's email as the only Nahl action, footer with 6902 Challenge Ln), their real call and directions links, PREMIUM-STANDARD gates, three review rounds against Wine Hopper and the best wave 3 page (9 target, never below 8, HOLD after three rounds), one blind template check for all ten plus the four batch 01 pages together, previews at 390 and 1440, EMAIL-INPUTS.md per lead. Three pages in parallel at most. Build locally only.

Variety rule: no type pair, palette or hero treatment repeats across batch 01, batch 02, Wine Hopper, wave 3 or the wave 4 engines.

Part 5. Commit and report

Small human-reading commits to feat/open-sign, pushed, no PR. Report at docs/RUN-REPORT-OPENSIGN-02.md and data/open-sign/:

sweep counts: queries run, profiles returned, dropped by reason (website, status, rating count, franchise, faith screen), bucket A total, by trade group and by area, Details calls, total Places calls and estimated cost
how many bucket A leads are also new filings
the ten chosen with score, rating, rating count, photos, Facebook or Instagram found or not
per page: concept, signature interaction, hero type, gates, review rounds, PASS or HOLD
contact sheet previews/review/open-sign/batch-02-contact-sheet.jpg and one 20 second phone recording of the weakest page
anything decided alone, elapsed time, and the exact commands to repeat the sweep for Fort Wayne, Evansville, South Bend, Lafayette and Bloomington
