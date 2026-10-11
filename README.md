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

`.env` holds the API keys and the two budget limits. It is never committed. `prices.json` holds the provider prices the spending ledger uses, each with the page it was read from and the date.

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
| `export --business <slug>` | Writes the bundle for one business. Refuses unless every approved finding passes the five gates and every benchmark source behind it is verified. |
| `library-commit` | Commits the verified flags set in the review app, with the message "Mark impact sources verified". |
| `calibrate --batch <name>` | Compares findings for the first 20 with `calibration/truth.json` and writes `calibration/REPORT.md`. |

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
impact/library.yaml  client-facing impact and fix sentences
calibration/         truth file and calibration report for the first 20
fixtures/            pages used by the tests
migrations/          SQL migrations
```

Storage is local: SQLite at `data/plumbline.db`, captures and evidence images under `data/`. `data/`, `reports/`, `exports/` and `inputs/` are not committed.

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

Notes on the choices:

- TypeScript is held at 6.0.3. The latest release is 7.0.2, which the linter's parser does not yet support.
- `simple-wappalyzer` ships fingerprint data under the GPL. It is used for internal analysis only and its data is not redistributed.
- Link status is checked through the polite fetcher, not `linkinator`, because the two second spacing per host must hold for every request.
- Each Lighthouse run happens in its own process. Lighthouse keeps timing state for the whole process, so runs sharing one process corrupt each other.

## Development

```
pnpm lint
pnpm build     # validates the impact library against the checks, then typechecks
pnpm test
```
