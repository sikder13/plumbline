# Book Direct run 02: sweep of 1,000 NZ sites for broken doors

Relay: RELAY-BOOKDIRECT-02. Branch feat/book-direct in ~/nahl-clients-projects/plumbline-book-direct. No pages, no emails, nothing deployed, Vercel not touched, no visit beacon fired. Prospect data stays in data/book-direct/ and previews/ (both gitignored). This report names businesses but holds no email address.

**Nothing here is a lead.** Every row in FLAGGED.csv is "flagged, unchecked" until UD and Claude have looked at its screenshot.

## The short version

- 1,000 new sites were discovered (100 per industry) and all 1,000 were read. 915 were checked in the browser; 44 are closed to us by robots.txt, 40 turned out not to be eligible (platform pages, faith screen, chains, one listing in England), and 1 timed out.
- **225 of the 915 checked sites carry at least one flag**, each with a 390 x 844 screenshot taken after the page loaded. They are flagged, unchecked.
- The strongest flags are real and plain on the pictures: 9 broken booking links (404s and 500s, a dead Kitomba page, a dead Dentalhub page) and 12 sites down (4 Wix "domain not connected" pages, 2 homepages answering 404, an expired domain, a parked domain, a WordPress error, a Cloudflare 521, and two that forward to Booking.com or an affiliate robot check).
- **hours_mismatch is over the 15% line**: 95 flags, 28% of the 341 sites where both the site and Google give hours. Many are real but small (30 to 60 minutes). 79 sites are flagged for hours alone. See section 7.
- ZeroBounce had 0 credits, so every flagged address is `needs_verifier`.
- **One rule broken by accident, now fixed:** a few pages on Bookme and Booking.com were requested through redirects and Book links before a host block went in (decision 20).

## 1. Sites by industry

| Industry | Discovered | Skipped (registry) | Excluded at crawl | Closed by robots.txt | Checked | Flagged (of checked) |
|---|---|---|---|---|---|---|
| Accommodation | 100 | 10 | 6 | 1 | 92 | 18 (20%) |
| Allied health | 100 | 16 | 1 | 2 | 97 | 25 (26%) |
| Dental | 100 | 0 | 1 | 1 | 98 | 37 (38%) |
| Trades and property | 100 | 0 | 2 | 6 | 92 | 18 (20%) |
| Hospitality | 100 | 0 | 13 | 5 | 82 | 19 (23%) |
| Hair and beauty | 100 | 0 | 3 | 4 | 93 | 37 (40%) |
| Tourism operators | 100 | 0 | 4 | 6 | 90 | 15 (17%) |
| Vets and pet care | 100 | 0 | 1 | 13 | 86 | 15 (17%) |
| Fitness and wellness | 100 | 0 | 4 | 3 | 93 | 21 (23%) |
| Auto and home services | 100 | 0 | 5 | 3 | 92 | 20 (22%) |
| **All** | **1,000** | **26** | **40** | **44** | **915** | **225 (25%)** |

"Skipped (registry)" counts Places results that were already in the registry (relay 01's audited sites), passed over before any fetch. Every one of the 1,000 discovered sites was read (crawled); a plain request could not read 115 homepages (53 robots.txt, 44 firewalls answering 429, 12 answering 403, 6 errors), and 81 of those were read from the browser instead. Excluded at crawl or after: 24 platform, directory or group pages, 10 faith screen, 5 chains, 1 listing outside New Zealand. One site timed out in the browser.

Dental and hair and beauty run highest because the hours and competitor checks apply to them most.

## 2. Contact capture (915 checked sites)

| | Sites | Share |
|---|---|---|
| A published email on the site | 768 | 84% |
| An email on the business's own domain | 494 | 54% |
| A working tel: link | 605 | 66% |
| A LinkedIn link on their own site | 33 | 4% |
| A named person (owner, manager, practitioner, host) | 239 | 26% |

1,063 addresses were found, each with its page and the date seen (20 October 2026, NZ date). 1,051 have a mail server and 9 do not (the own_email_dead check). Of the 225 flagged sites, 173 publish an email.

## 3. Flags by check (flagged, unchecked)

| Check | Flagged | Where it applies | Unproven (no picture) | Unknown |
|---|---|---|---|---|
| booking_link_broken | 9 | 497 sites with a booking link | 0 | 64 |
| site_down_or_broken | 12 | 915 | 0 | 46 |
| not_secure | 33 | 926 | 0 | 20 |
| main_nav_404 | 2 | 740 sites with a main menu | 0 | 0 |
| ota_only_booking | 2 | 99 accommodation | 0 | 0 |
| own_email_dead | 7 | 778 sites with an email | 3 | 0 |
| phone_mismatch | 31 | 827 with a phone on both sides | 6 | 0 |
| hours_mismatch | 95 | 341 with hours on both sides | 33 | 0 |
| no_online_booking_vs_competitors | 47 | 364 clinics, salons and studios | 0 | 29 |
| not_mobile | 12 | 925 | 0 | 20 |

**225 sites have at least one flag.** "Unproven" means a check found something but its picture could not show it, so it is not a flag. "Unknown" means the check could not run: robots.txt, a firewall that refused the browser, or a booking page we may not open.

## 4. The 20 strongest flagged sites

Ranked by flag strength as the relay orders it (booking link broken, site down, not secure on a booking page, menu 404 on Book or Rates, OTA-only, dead email, then the rest). Email status is the best published address: `mx_only` means syntax and mail server checked, still `needs_verifier`.

1. Super Lawn Mowing and Gardening, Dunedin, auto and home: booking link broken. "Book a job" opens a "Page not found". http://lawn-mowing-services.co.nz/book-a-job/ (mx_only)
2. Dental@105, Hastings, dental: booking link broken, 404. https://dentalat105.co.nz/book-an-appointment/ (mx_only)
3. Whakatane Dental Centre, Whakatāne, dental: booking link broken, Dentalhub page 404. http://apac.dentalhub.online/soe/new/Whakatane%20Dental?pid=NZWHB01 (mx_only, gmail)
4. Asia Pacific Yoga, Taupō, fitness: booking link broken, 404. https://asiapacificyoga.com/ytt/nov-2026-200-hour-yoga-teacher-training/ (mx_only, gmail)
5. House of Wellness, Tauranga, fitness: booking link broken, 404. https://www.houseofwellness.nz/meditate/ (mx_only)
6. RSM Massage NZ, Dunedin, fitness: booking link broken, 404. https://rsm-massage.co.nz/product/hot-stone-massage/ (mx_only, gmail)
7. Tranquillo Beauty Clinic, Tauranga, hair and beauty: booking link broken, Kitomba says "no booking page at this address". https://apps.kitomba.com/bookings/tranquillo/login (mx_only)
8. Somtum Thai Timaru, Timaru, hospitality: booking link broken, reservation page 500. https://somtumthai.co.nz/online/reservation (no email)
9. Discovery Jet, Windwhistle, tourism: booking link broken, 404. https://www.discoveryjet.co.nz/blank (no email)
10. Classic Motel, Hamilton, accommodation: site down. The domain forwards to an affiliate robot check. http://classicmotel-hamilton.co.nz/ (no email)
11. The Views Accommodation, Dunedin, accommodation: site down. The website sends visitors to a Booking.com search. https://roome.site/ (no email)
12. Alexandra Health Ltd, Alexandra, allied health: site down, "domain has expired". https://www.alexandrahealth.co.nz/ (no email)
13. Simply Feet Podiatry, Oamaru, allied health: site down, Wix "domain isn't connected". https://simplyfeet.co.nz/ (no email)
14. AbFab Cleaning Services, Nelson, auto and home: site down, Wix "domain isn't connected". https://abfabcleaning.co.nz/ (no email)
15. Kiwi Tyres and Auto, Auckland, auto and home: site down, parked domain. http://kiwityre.co.nz/ (no email)
16. MowNua Property Services, Levin, auto and home: site down, Wix "domain isn't connected". https://www.mownua.co.nz/ (no email)
17. Nitas Beauty, Rotorua, hair and beauty: site down, Cloudflare 521 "web server is down". https://www.nitasbeauty.co.nz/ (no email)
18. Tatoa Beyond (Hamilton), Hamilton, hair and beauty: site down, Wix "domain isn't connected". https://tatoahamilton.co.nz/ (no email)
19. The Fringe, Te Anau, hair and beauty: site down, homepage 404. http://www.thefringeteanau.co.nz/ (no email)
20. Uk-11 cafe & curry, Hastings, hospitality: site down, WordPress critical error. https://uk11cafecurry.com/ (no email)

Rows 8 to 20 have no email: Somtum Thai and Discovery Jet publish none on the pages read, and a site that is down shows none. Next in line are the not_secure sites (28 served over plain http, 3 with a booking or contact page on http, 2 with an invalid certificate), then 2 menu 404s, 2 OTA-only motels and 7 dead addresses (for example `info@havelocknorthholidaypark co.nz`, missing its dot on the page, and `admin@goldenpawa.co.nz` for goldenpaws.co.nz).

## 5. Contact sheets

Twelve sheets, twenty sites each, strongest flag first, numbered as in FLAGGED.csv:
`previews/review/book-direct/sweep-nz-1000-flags-01.jpg` to `previews/review/book-direct/sweep-nz-1000-flags-12.jpg`.
Each tile is the proof of a site's strongest flag: the evidence is written above the page, and the proven item is outlined in red. Every flag's proof is in `data/book-direct/sweep/nz-1000/shots/<domain>/<check>.png`.

## 6. Calls, cost, requests and time

- **Google Places:** 384 Text Search calls (fields at the Enterprise tier, as in relay 01), cap 2,000. 355 came from the first pass and 29 from reruns after the filters were tightened; every other rerun read the cache (361 cached reads). At list price, 384 x US$0.035 = **US$13.44**. This month's 1,000 free calls were already used by relay 01 (558) and Open Sign (461), so assume the full amount.
- **Plain requests:** 5,613 page requests (homepages and up to seven more pages a site) and 539 booking-link requests, at one request a second per host, robots.txt respected, plus one robots.txt per host.
- **Browser:** about 3,000 page loads. The first check run was stopped at about 300 sites and restarted, every site ran in the full run, and the hours, phone, layout and competitor checks ran again on stored reads.
- **Elapsed:** started 23:14 EDT, report committed 02:29 EDT: **3 h 15 min** of the 6-hour budget.
- **Tokens:** about 0.55 million by the session counter, one session, no helper agents.

## 7. Decisions made alone, and suspicious volume

**hours_mismatch is over the 15% line.** It flags 95 of the 341 sites where both sides give hours (28%), or 10% of all checked sites. The rule is the relay's: a contradiction on two days or more, which I read as one side closed and the other open, or a time 30 minutes or more apart. Many are real but small. Three examples:
- Cielo Hair & Beauty (Tauranga): the site says Monday to Friday 9 am to 6 pm; Google says Monday 10 to 5 and Wednesday and Friday 9 to 5. A clear contradiction.
- Bodycare Clinic Forrest Hill (Auckland): Google says Friday opens at 12:00 am and Thursday at 9:30; the site says 8:30 both days. Google is wrong, which is embarrassing and real.
- Garden City Dental (Christchurch): the site closes at 9 pm and Google at 9:30 pm, on three days. True, but nobody is embarrassed by half an hour.
With a stricter bar (open versus closed, or a time an hour or more apart), 66 of the 95 remain. Pages that give a second branch's hours (The Tooth Company Smales Farm shows its new Grey Lynn practice's hours) are a known false reading. Recommendation: use the stricter bar and treat hours as a second finding, never the lead.

**no_online_booking_vs_competitors** flags 13% of the clinics, salons and studios it applies to, so it is under the line but the weakest check: it can only say no booking link was found on the pages read. Ai Dunedin Thai Massage is a "choose your branch" page whose branch pages may book; check each by hand.

No other check is near 15%.

**Decisions**

1. **Centres.** The relay says relay 01 had 26 centres; its config has 27, because Auckland is three search circles. All 27 were kept, plus the 11 new ones: 38 in all.
2. **The registry's relay 01 rows.** The 240 sites relay 01 audited went in as version 1. Relay 01 also read about 1,440 other sites only to find an email. They were never audited, so they stayed out of the registry and remained eligible; 26 Places results were skipped as already in it.
3. **Relay 01's 240, checked again from the cache.** Their saved pages, the audit's measurements and the Book links it followed went through the new checks with no site fetched again. A flag needs a picture, and none can be taken without fetching, so 25 sites that would flag are recorded as unproven in `registry/relay01-v2.csv`, and every row is marked version 2. They are 10 phone, 9 not secure, 2 menu 404, 2 layout, and one each of dead email (`stay@kingsgatemotel.conz`), OTA-only (Charleston Motor Camp) and broken booking link (Mission Health). Hours cannot be compared, because relay 01 did not ask Google for hours. To photograph them: `pnpm plumb leads discover --campaign book-direct --sweep relay01-proof --from-relay01 would-flag --reaudit && pnpm plumb leads sweep-check --campaign book-direct --sweep relay01-proof`.
4. **Spreading the 1,000.** Each industry's 100 is split evenly over its terms (34, 33 and 33, for example). Each term visits the 38 centres in its own rotated order and takes a few sites per centre at most (5 for a 25-site term), so the largest centre gave 46 sites.
5. **Faith screen.** Excluded by Google type or by whole word in the name: bars, pubs, taverns, breweries, wineries, vineyards, wine and cellar-door tours, cocktail and liquor businesses, hookah and vaping, tobacco, casinos, pawn shops, adult and erotic businesses, cannabis, and licensed clubs (hospitality only). "Bar" is fine after brow, lash, nail, juice, sushi, espresso and similar. At the crawl, a restaurant or tour whose homepage title says wine bar, cocktail bar, craft beer or "bar and restaurant" was also dropped.
6. **Not the owner's own site.** A "website" that is a booking platform, ordering app, listing site, regional tourism page or Facebook was excluded, at discovery or after it: TuckerFox, edan.io, jany.io, traveleto, inn.fan, Acuity, Schedulista, SimplyBook, a council directory, and homepages that forward to Facebook or a franchise group's page. Sites on free hosts (Weebly, Strikingly, Vercel) are the owners' own and stayed.
7. **Types.** A "tourist attraction" counts only when its name says it runs trips, so reserves and walking tracks are out. Garden centres, shops, car yards and pet shops are out.
8. **booking_link_broken** means 404, 410 or 5xx, unreachable, a "page not found", or an engine page saying the account is inactive. Each one is confirmed in the browser before it is flagged. A 401, 403 or 429 (firewalls), robots.txt, and Book links that are script hooks (`/.lightbox-header`, pop-ups) are unknown.
9. **not_secure** is Chrome's own address-bar state, which the new headless Chrome reports. That covers plain http and invalid certificates. Current Chrome no longer marks pages with mixed content as "Not secure" (it upgrades or blocks the content), so that case only flags a contact or booking page served over http. Relay 01's campaign called SSL hygiene; relay 02 lists it as a check, so it is flagged and left to UD.
10. **site_down_or_broken** means an error answer, a registrar's or host's placeholder (only on a short page, so "new menu coming soon" does not count), a parked domain (including ad links inside a frame), a page with nothing on it after loading, or a homepage that forwards to an off-limits site or a near-empty page elsewhere. A firewall that refuses only the browser is unknown, and so is a drop in our own connection (two sites hit one and were checked again).
11. **main_nav_404** covers main-menu labels of four words or fewer that name rooms, rates, booking, services, treatments, a menu, contact or about. The page must also show as missing in the browser. The menu picture is at desktop width.
12. **phone_mismatch** means Google's number appears nowhere on the pages read, however it is written there: +64 or 0, spaces, brackets, run together, or with the area code left off. A second number on Google is still a flag; UD decides whether that matters.
13. **hours_mismatch** uses Google's hours as the listing words them, and the site's hours only where a page gives them once and clearly. Office, reception, staffed, kitchen, meal, parking, holiday, seasonal and class hours are left out. Accommodation is not compared, because the site gives reception or cafe hours.
14. **own_email_dead** means a published address whose domain has no mail server. Template addresses (`info@mydomain.com`) and addresses run into the next word are ignored.
15. **no_online_booking_vs_competitors.** "Same trade" is the search term, with dentists as one trade and hair salons with barbers as another. Rivals are the three nearest in this sweep, all within 30 km. Any booking link other than the contact page counts as booking online. The rendered homepage is also read for a script-added Book button before anything is flagged. Walk-in businesses that say "no bookings" are left out.
16. **not_mobile** means sideways scroll over 20 px (the proof is taken pushed fully right), no viewport tag with a desktop-width layout, or sentence text under 11 px as shown. Menus, buttons and footers do not count as body text.
17. **Pictures** are 390 x 844 at one pixel per CSS pixel, taken after the load event, network idle and 3 seconds more, 60 seconds at most (139 homepages took over 30 and are noted `slow_render`). Pop-ups covering most of the screen are hidden first. When the phone layout hides the item, the desktop layout is used.
18. **Contacts from the browser.** 81 homepages a plain request could not read were read from the browser instead. A site known only from its homepage that way is unknown for the competitor check.
19. **The check run was restarted once.** Reviewing the first 300 results showed false readings: Google's "Open 24 hours" read wrongly, text size counting menus, pop-ups over proofs, phone formats. The checks were fixed and every site was checked again. Each site was opened in the browser about twice, still at one request a second per host.
20. **Off-limits hosts, an accident and its fix.** Before 01:25 EDT the sweep requested 5 Bookme pages (a motel's "deals" links, read as booking links) and loaded a few Bookme and Booking.com pages in the browser: a Book-link check, and one "website" (roome.site) that forwards to a Booking.com search. Nothing was taken from them. Now the fetcher checks every redirect hop, the browser refuses any page or frame on Booking.com, Bookme, Yellow, Neighbourly, LinkedIn or a travel agent, and links to them are recorded, never opened. No LinkedIn, Yellow or Neighbourly page was ever requested.
21. **ZeroBounce had 0 credits** (checked at the start and again at the report). Every flagged address is `needs_verifier`. `.env` still holds the dead first ZEROBOUNCE_API_KEY line noted in relay 01.

## 8. The next 1,000

From ~/nahl-clients-projects/plumbline-book-direct:

```
pnpm plumb leads discover --campaign book-direct --sweep nz-2000 && pnpm plumb leads sweep-check --campaign book-direct --sweep nz-2000
```

Discovery skips every domain in `data/book-direct/registry/audited.csv`, which now holds 1,240 (relay 01's 240 and these 1,000), plus the suppression list and earlier waves. It reuses the cached searches and pays only for new result pages, against a fresh 2,000-call cap for the new sweep. `sweep-check` reads, checks, photographs and writes FLAGGED.csv, CLEAN.csv, the contact sheets and the registry for `nz-2000`. Add ZeroBounce credits first, or the flagged addresses stay `needs_verifier`.

## Files and checks

- `data/book-direct/sweep/nz-1000/`:
  - FLAGGED.csv (225 rows, strongest first) and CLEAN.csv (775 rows, contacts kept, excluded and robots-blocked sites included with the reason in `notes`);
  - README.md (each file, and what to check by hand);
  - shots/, sites/ (per-site reads and check results), and _candidates.csv, _pool.csv, _summary.json.
- `data/book-direct/registry/audited.csv` (1,240 rows, never deleted from) and `registry/relay01-v2.csv`.
- Code is in `packages/leads/src/bookdirect/sweep/`, behind the commands `leads discover --sweep`, `leads sweep-check` (stages gather, check, competitors, recheck, report) and the off-limits host filter in `packages/fetch`. `pnpm lint` and `pnpm typecheck` are clean, and `pnpm test` passes 699 of 699, 22 of them new for the sweep. No reviewer agent was used.
