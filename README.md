# Plumbline

Plumbline audits small business websites and produces findings that are proven, dated and re-checked before anyone outside the team sees them.

This repository is private. It holds prospect data and must never be made public.

## The principle

A finding nobody can prove is never shown. Every finding passes five gates before it can leave the machine:

1. **Evidence.** A screenshot crop with the problem boxed, the exact URL, the visible text, the viewport, and the time in UTC and New Zealand time.
2. **Reproduced.** The finding appears in two runs at least 60 minutes apart. Numeric checks use the median of three measurements per run, and both runs must cross the threshold.
3. **Visible.** Only what a visitor can see counts. Text hidden by CSS, screen-reader-only text, `noscript`, `template` and `aria-hidden` content never counts.
4. **Approved.** Each finding is approved in the review app before any client sees it.
5. **Fresh.** The finding was re-verified within 24 hours of export.

Findings come in three tiers: `measured` (a tool produced the fact), `rule` (a fixed rule over measured facts) and `judgment` (needs a person).

Checks are grouped in packs. The core pack applies to every website. An industry pack adds checks, listing sources and discovery queries for one kind of business. The first industry pack is `tourism`, for New Zealand. A new pack is a new folder under `packages/checks/src/packs/` and does not change the core.

## Setup

Requirements: Node 22.19 or later (Lighthouse 13 needs it) and pnpm 12.

```
nvm use
pnpm install
pnpm exec playwright install chromium
cp .env.example .env    # then fill in the keys
```

`.env` holds the API keys, the two budget limits, the call booking link for preview pages (`CAL_LINK`) and the read-only access to the visit table (`DEMO_VISITS_URL`, `DEMO_VISITS_READ_KEY`). It is never committed. `prices.json` holds the provider prices the spending ledger uses, each with the page it was read from and the date.

## Commands

All commands run as `pnpm plumb <command>`.

**Discovery and contacts**

| Command | What it does |
|---|---|
| `seed` | Imports the researched operators from `inputs/`. |
| `discover --pack tourism --country NZ` | Finds businesses with Google Places Text Search, one query per region and activity. |
| `qualify` | Decides which candidates qualify, and records why the others do not. |
| `contacts` | Reads up to six pages per business for published emails, owner and second-in-command names, and runs the consent check. |
| `batch --name <name> --size <n>` | Chooses the businesses for a batch from those ready for audit. |

**Auditing**

| Command | What it does |
|---|---|
| `audit --batch <name>` | Run A: collects, measures and records candidate findings, and captures the brand pack. |
| `confirm --batch <name>` | Run B, at least 60 minutes after run A. Marks what reproduces. |
| `ai --batch <name>` | Asks AI tools the questions a visitor asks. Shows the cost estimate first; `--estimate` stops there. |
| `recheck --batch <name>` | Re-verifies reproduced and approved findings on the day of sending. |

**Review and output**

| Command | What it does |
|---|---|
| `review` | Starts the local review app on http://127.0.0.1:4310. |
| `report --batch <name>` | Writes `reports/<name>/`: `master.csv`, `index.html`, a page per business, `excluded.csv` and `SUMMARY.md`. |
| `export --business <slug>` | Writes the bundle for one business. Refuses unless every approved finding passes the five gates and every benchmark source behind it is verified. A business on the suppression list is refused before any gate is looked at. |
| `library-commit` | Commits the verified flags set in the review app, with the message "Mark impact sources verified". |
| `calibrate --batch <name>` | Compares findings for the first 20 with `calibration/truth.json` and writes `calibration/REPORT.md`. |

**Preview pages**

A preview page is one private page per business: a redesigned homepage built from the business's own photos and words, the approved findings with their evidence, our offer, and a way to reply. The pages are served at `https://nahltech.com/demo/<slug>-<token>/`. The main site forwards `/demo/` to a separate Vercel project, `nahl-previews`, which is deployed from this machine.

| Command | What it does |
|---|---|
| `preview recheck` | Re-verifies the approved findings behind every preview page and the Crawlmouse sentences. Run it within 24 hours of sending. With `--wave <name> --batch <letter>` it re-verifies what that batch's email drafts use and marks each draft "ready" (good for 24 hours) or "needs edit (recheck)" with the line named: a finding that no longer reproduces, or whose sentence has changed, or a list of findings that cannot be read. A speed line whose figures a new run has only nudged (they agree within 30%, and the page is still on the same side of the speed bar) still holds, and the new figures are set beside the status. A draft on hold stays on hold, a status a person wrote ("sent", or an edit they asked for) is kept, and a business that has since been suppressed is not looked at again and its draft is held. |
| `preview emails --wave <name>` | Runs the writing rules over the email drafts in `reports/<batch>/<wave>/emails/`: 120 to 170 words from the greeting to the call to action (the sign-off, signature and footer under it are the same in every email and are not counted), no dash and no hyphen inside a sentence, no exclamation mark or hype, a subject under 60 characters that asks nothing, the demo link on a line of its own with no trailing slash, which must be the business's own page (any other address has to be one the shared wording holds), a source for every number in the subject and the body, and as many numbered lines as the draft lists findings. A suppressed business is named, and its draft must not be sent. The wording every email shares (the line that introduces us, the lines around the demo link, and the offer, call to action, signature and footer) is kept once in `emails/_shared.md`; a draft marks its place with `[[INTRO]]`, `[[DEMO LINES: <link>]]` and `[[CLOSING]]`, and `--fill` puts it in. |
| `preview variety --wave <name>` | Checks the recipes of a wave against the variety rules, using the groups in `previews/batches.json`. |
| `preview ai` | Asks the hand-written questions in `previews/content/<slug>/questions.json` through both providers, three runs each. Shows the estimate first; `--estimate` stops there. |
| `preview crawlmouse` | Re-opens the example pages behind each Crawlmouse sentence and keeps only the sentences that still hold. |
| `preview build [slug]` | Builds the pages into `previews/out/`. With a slug, `--only` or `--wave <name>`, only those pages are made again; the site is always written out whole. With `--batches A,B` the site carries the pages that have a design of their own and the recipe pages of those batches only, so a page still being worked on is never deployed. The batches are remembered in `previews/live-batches.json`, and a later build that names none publishes the same ones again. A business suppressed since its page was made is left out of the site. Needs `CAL_LINK` in `.env`; `--draft` builds without it for looking at locally. |
| `preview data [slug]` | Gathers what a page shows and prepares its photographs without writing the pages out. Safe to run for several businesses at once, and enough for looking at a page in `next dev`. |
| `preview check` | Runs the quality gates and saves screenshots to `previews/review/`. `--live` checks the pages at their real address. The gates include the visit report: nothing in a page's first three seconds on screen, then one view with its own token (answered locally, so a check is never counted as a visit). Every browser a gate opens, and the speed measurement, answers or blocks the visit report, so a check is never counted as a visit. |
| `preview deploy` | `vercel build`, then `vercel deploy --prebuilt --prod`, from `previews/out/`. With `--preview` it goes to a preview address and the live pages are left alone. |
| `preview visits` | Shows who has opened their page: first and last view, view count, findings tab, reply or call. |
| `preview remove <slug>` | Takes one page down and deploys the site without it. Its content file is deleted, or its recipe is set aside under `previews/recipes/removed/`, so the page is not built again. |

What goes where:

- `apps/previews/sections/` is the section library that later pages are laid out from. A page is a recipe, `previews/recipes/<slug>.json`: a five line brief (mood in three words, headline of at most five of their own words, the hero, the pinned story's subject, three layout patterns), a palette with its family, a pair of faces, the one action with the address their own site sends a visitor to, the photographs, and the sections in order, each in one of its variants. The sections are `hero` (photo, split, type, frame), `story`, the pinned scroll story (wipe, stack, rail, words), `rows`, the swipe row (tall, wide, plain, round), `wipes` (pair, band, trio), `numbers` (row, band, list), `words` (quote, letter, columns), `list` (ruled, questions, steps) and `visit` (card, split, plain); the floating action is a pill, a dock or a stack. A photograph that fills a slot taller than itself asks for a file large enough to stay sharp there; an image may set its own `quality`, and a hero may be set in two tones (`treat: duotone`) when its photograph is small or dated. A recipe is refused when its headline runs past five words, a section names a photograph it does not list, a menu link has no target, or words would be hard to read on their ground. A figure taken from Google must say so beside it, with the month it was measured (`"source": "Google, October 2026"` on a figure, `noteSource` on the note under the hero's action), and a Google rating in running text is refused, since no source can stand beside it there. Words quoted from a site lose any dash set off by spaces, but a range of prices or of opening hours is written with "to" and stays a range. The photographs are read from `data/wave/<slug>/`. `packages/preview/src/recipe.ts` also holds the variety rules for a wave: no two pages share a hero, a pair of faces and a palette family; two businesses of one kind or one place share at most one of the three; no page is laid out like a wave 1 page.
- `apps/previews/` holds the page code: one design per business under `designs/`, the shared bar and findings tab, and our own offer in `lib/offer.ts`. No business content is in it. A page made to order has a design of its own there too. `loop` is one: a day told as a route, with a line that draws itself across the opening photograph, a loop the visitor travels by scrolling, places picked onto a card, a departures board, and a photograph at a time on a line of stops.
- `previews/content/<slug>/` holds what was read from the business's own site: `content.json` (the words and prices on the page, and which design it uses), `facts.json` and `html/` (the saved pages every number is traced to), `raw/` (their photos) and, for a business whose stored AI questions asked about the wrong trade, `questions.json`. A content file that says `"wave": true` is for a business prepared as part of a wave: its page states each finding in the wave's words and order and carries the wave's second check, as a recipe page does, and its photographs are read from `data/wave/<slug>/`.
- `previews/out/` is the generated site and `previews/review/` the screenshots and gate reports. Nothing under `previews/` is committed.

The gates, per page: Lighthouse on a phone as the median of three runs (performance 85 or more, accessibility 95 or more, largest contentful paint under 2.5 s, layout shift under 0.05, total blocking time under 200 ms); no serious or critical axe issue; no sideways scroll at 360, 390 and 430 px; every link tested; no dash, no banned word, and every number traced to a stored measurement, to the business's own saved pages, or to our offer.

On a finding card the library's impact sentence is shown without any sentence that leans on an outside figure, and the stored title and evidence carry the measured facts. A stored "not named by AI" finding is replaced by the corrected questions where a business has them, and is shown only if those still return no mention.

The pages move. A design's opening (the picture settling, the headline rising line by line) is plain CSS, so it runs with the first paint. Everything else is a motion layer that is fetched after the page has painted: content and photographs arriving as they are scrolled to, numbers counting up once, buttons that give under a press, one section per page that holds still while the visitor scrolls through a sequence, and on large screens smooth scrolling and photographs that travel a little slower than the page. With reduced motion asked for, every state simply appears.

Fonts are prepared by `apps/previews/scripts/fonts.mjs`: a face a design sets at one weight is cut down to that weight, and Māori macrons come from a small file holding just those letters, so one word like Kāpiti does not pull in a family's whole extended set. A face can also be held at one width with its weight left free, which is how Archivo's wide cut for headlines is made.

Each page reports a visit to `https://nahltech.com/api/demo-visit` only after it has been on screen for three seconds, which a link scanner never reaches. It sends the page token and one of `view`, `tab_findings` or `cta_click`, and nothing else. A visitor with Do Not Track or Global Privacy Control set is not counted.

**Waves**

A wave is a hand-picked list of businesses prepared for outreach together. For each one the facts we would put in front of its owner are stored one by one, each with the page it was read on, the words that state it and the day it was checked.

| Command | What it does |
|---|---|
| `wave import --name <wave> --file <csv>` | Stores the list: order, status ("wave" or "reserve") and slug for each row. |
| `wave collect --name <wave>` | Reads the homepage and the pages that say who runs each business, how to reach it and what it costs. Reports signs of a sale or closure, agency credits, published emails, booking links, prices and videos. |
| `wave read --business <slug> <urls...>` | Reads further pages for one business, such as its page on the company register. |
| `wave facts --name <wave>` | Stores each business's research file. Refuses a file unless every quote in it is on the saved copy of its page, each confirmed name has sources on two sites, and a published email names the page that shows it. `--check` stores nothing. |
| `wave assets --name <wave>` | Measures every photo, picks the best three for the top of a page (at least 1800 px wide, crisp, not a logo, map or screenshot), and looks up videos, logo, colours and fonts. |
| `wave ai --name <wave>` | Asks AI tools who to book each business's own activities with, both providers, three runs each. Shows the questions and the estimate first; `--estimate` stops there. `--pass 1`, then `--pass 2` an hour later, lets a finding count as reproduced. |
| `wave crawlmouse --name <wave>` | Opens the example pages behind every Crawlmouse sentence again, finds which page links to a missing one, and stores what still holds as findings with the source "crawlmouse". |
| `wave set --name <wave> --business <slug> --status <status> --note <reason>` | Records a decision on one row: "dropped" with the reason, or a reserve brought in as "wave". The row stays in the list. |
| `wave approve --name <wave>` | Decides every finding of the wave by rule and writes each decision, with the rule and the reason, to `data/wave/<wave>-approvals.csv`. `--apply` stores them. |
| `wave pack --name <wave> --file <csv>` | Writes `reports/<batch>/<WAVE>-PACK.md`, one section of at most 70 lines for each business in list order, and the same data as `reports/<batch>/<wave>/<slug>.json`. Only findings approved in the review app go in. |

What is read for a wave is kept under `data/wave/<slug>/`: `pages/` (the source, the visible text and, for evidence, screenshots of each page), `collected.json`, the research file `facts.json`, `photos/` and `crawlmouse.json`.

The question put to AI tools comes from the business's own homepage: "Who should I book a <activity> with in or near <town>, New Zealand? Name specific operators." A business with two clear activities gets a question for each. The stored category is never used, because for a business found by search it is only the search that found it. No answer naming the business, while the answers name others, is a finding. Most answers naming it is a strength.

Findings of a wave are approved by rule, not one by one. A finding is rejected when it did not reproduce in the last 24 hours or has no screenshot; when it says the site takes no booking or gives no way to get in touch and a booking system, a booking or enquiry form, a contact form or a booking page exists anywhere on the site; when it names whoever built the site; when it rests on an inference (a judgment, a first screen that was an age question, a count our own reading did not bear out); when it is a broken link no page sends visitors to, or an unlinked page visitors do not need; when its speed runs disagree by more than 30% and a third run does not settle them; or when another finding has the same cause. What is left is ranked: lost bookings or contact, then speed (main content after 4 s or a score under 50), then security and trust, then search and AI. The top three are approved, and a fourth and fifth when they cost bookings or speed. Every approved finding then goes, with its evidence, to a reviewer who has not seen the reasoning: put the verdicts in `data/wave/<wave>-review-verdicts.json` (`{"<finding id>": {"verdict": "ok" or "flag", "reason": "..."}}`) and run the command again. A flagged finding is rejected and the next one moves up, to be checked in turn. A verdict is kept with the sentence it was given on: a pass holds only for that sentence, a flag against the finding holds however it is reworded, and a flag marked `"scope": "sentence"` lapses once the wording has changed. What is put to the owner is the stated sentence, not always the stored one: phone speed is the median of the last three runs, each measure on its own; the first phone screen is said to lack "a button to book, call or email" and no more; a phone link that has lost its plus sign is said not to dial from overseas, and not to be broken; and a sentence that came from Crawlmouse is said in terms of what we read ourselves (the link that leads to the missing page, our own count of pages; a sentence about unlinked pages names only the pages that load and that nothing links to). An approval is stored only once it has passed that check, and it stands for the sentence that was passed: when a finding comes to read differently, its approval by rule is taken back until the new sentence has been looked at. A speed sentence whose figures a new run has only nudged counts as the same sentence. An approval a person gave stands. A business left with fewer than two approved findings is marked weak. Slugs, addresses and domains listed in `data/suppression.csv` are skipped, as is a business we excluded or one whose own site refuses unsolicited messages; `preview build`, `preview data`, `preview emails`, `preview recheck --wave` and `export` read the same list. The sheet may be a bare list, or have headings: the columns `slug`, `domain` and `email` or `emails` are read (several entries in a cell are set apart by semicolons), and any other column, such as `date` or `reason`, is a note for people. A domain covers every address at it and the business whose own site is on it.

In the review app, "Wave 2 only" shows the businesses of a wave in list order. Each business's findings are ranked for its owner (lost bookings and broken contact first, then speed, then security, then search and AI) and the three to five put forward are marked. Crawlmouse findings sit beside Plumbline's own, each with Crawlmouse's sentence, what we measured when we opened the pages again, and the screenshots. A re-check of Plumbline's findings leaves findings from another tool alone.

**Housekeeping**

| Command | What it does |
|---|---|
| `cost` | Shows the spending ledger. |
| `purge --business <slug>` | Deletes everything held about one business. |

## Money

Every paid API call goes through the ledger in `packages/budget`. Before a paid step the estimate is printed. A step that would take the running total above `BUDGET_ASK_ABOVE_USD` stops and asks. Nothing can take the total above `BUDGET_TOTAL_USD`. After each call the actual cost is recorded from the token and call counts the provider reports.

## Client-facing copy

The impact and fix sentences shown with each finding come only from `impact/library.yaml`. No client-facing sentence is written in code. The build fails if an entry is missing a field, runs over 35 words, contains a dash or a banned word, cites a benchmark without a URL, year and quote, or if a check has no entry.

## Polite fetching

- robots.txt is honoured (RFC 9309), cached for 24 hours at most. A 5xx answer is treated as disallow-all and a 4xx answer as allow-all.
- One request every 2 seconds per host, at most 25 pages per site, same host only. External links get a status check only.
- The user agent is the ordinary Chromium one plus `PlumblineAudit/1.0 (+https://nahltech.com)`.
- If robots.txt disallows the homepage, the site is not fetched.

## Layout

```
apps/cli/            the plumb command
apps/review/         local review app (Next.js, 127.0.0.1 only)
apps/previews/       preview pages (Next.js, written out as plain files)
packages/core/       types, schemas, config, time helpers, database
packages/budget/     spending ledger and estimates
packages/discover/   finding and qualifying businesses
packages/fetch/      robots, polite fetching, rate limits
packages/render/     Playwright, scrolling, visibility helper, screenshots
packages/collect/    collectors
packages/contacts/   published emails, owner and second-in-command names, consent check
packages/brand/      brand pack capture
packages/checks/     engine; packs/core, packs/tourism
packages/evidence/   crops and boxes
packages/impact/     library loader and validator
packages/ai/         AI answer runs
packages/report/     the batch report
packages/export/     per-business bundle for preview pages
packages/preview/    preview page data, images, corrected AI questions, gates and visits
packages/wave/       a hand-picked list: facts with their sources, Crawlmouse findings, ranking, approval by rule
impact/library.yaml  client-facing impact and fix sentences
calibration/         truth file and calibration report for the first 20
fixtures/            pages used by the tests
migrations/          SQL migrations
```

Storage is local: SQLite at `data/plumbline.db`, captures and evidence images under `data/`. `data/`, `reports/`, `exports/`, `inputs/` and `previews/` are not committed.

## Pinned versions

Checked against the registry on 10 October 2026 and pinned exactly.

| Package | Version |
|---|---|
| Node | 22.23.1 |
| pnpm | 12.11.2 |
| typescript | 6.0.3 |
| playwright | 1.64.0 |
| lighthouse | 13.5.0 |
| chrome-launcher | 1.2.2 |
| @axe-core/playwright | 4.13.0 |
| simple-wappalyzer | 1.1.106 |
| @marbec/web-auto-extractor | 2.2.1 |
| @adobe/structured-data-validator | 1.7.0 |
| better-sqlite3 | 13.0.3 |
| sharp | 0.35.5 |
| cheerio | 1.2.0 |
| franc | 6.2.0 |
| tldts | 7.4.18 |
| undici | 8.11.2 |
| p-limit | 7.3.3 |
| zod | 4.6.5 |
| yaml | 2.9.1 |
| commander | 15.0.0 |
| next | 16.4.0 |
| react, react-dom | 19.3.0 |
| vitest | 5.0.3 |
| eslint | 10.12.0 |
| typescript-eslint | 8.71.1 |
| tsx | 4.23.15 |
| @fontsource and @fontsource-variable font packages | 5.3.0 |
| motion | 14.1.0 |
| lenis | 1.3.26 |
| subset-font | 2.9.0 |

Notes on the choices:

- TypeScript is held at 6.0.3. The latest release is 7.0.2, which the linter's parser does not yet support.
- `simple-wappalyzer` ships fingerprint data under the GPL. It is used for internal analysis only and its data is not redistributed.
- Link status is checked through the polite fetcher, not `linkinator`, because the two second spacing per host must hold for every request.
- The preview pages set type in free fonts served from our own address: Figtree, Newsreader, Open Sans, Playfair Display, Montserrat, Karla, DM Serif Display, Bebas Neue, Nunito Sans and Shadows Into Light. Where a business licenses a paid font, the nearest of these stands in for it.
- Each Lighthouse run happens in its own process. Lighthouse keeps timing state for the whole process, so runs sharing one process corrupt each other.

## Development

```
pnpm lint
pnpm build     # validates the impact library against the checks, then typechecks
pnpm test
```
