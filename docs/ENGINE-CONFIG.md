# Engine settings

A wave 4 page is one settings file rendered by one of four page engines: `fishing`, `paddle`, `stay` or `physio`. The schema is `packages/preview/src/engine/schema.ts` (zod); this page explains it. The bar every engine is held to is [PREMIUM-STANDARD.md](PREMIUM-STANDARD.md).

Rules that hold for every field:

- Every fact carries `source`, the address of the page it was read from. Words in `text`, `lines`, `title` and `value` are the business's own, trimmed but not reworded, with dashes inside sentences turned into commas or "to". Labels (`label`, `heading` of a section that has no heading of theirs) may be ours.
- No number may appear that is not on their site: the copy gate compares every figure on the page with their own text. Counts the visitor sets (nights, guests) are written as words.
- A section whose data is missing is left out of the file and is not drawn. Nothing is filled with placeholder text. A list that needs more items than the business states (for example a signature with one item) is left out too.
- No testimonials, reviews, review quotes or rating widgets on a physio page, ever. On other engines, a stated Google rating may sit in the hero facts at its true value; review quotes are never used.

## Where the files live

| | Real pages (next relay) | Sample pages (this branch) |
|---|---|---|
| Settings | `previews/content/<slug>/engine.json` | `data/wave-4/design-samples/<slug>/config.json` |
| Photos | `data/wave/<slug>/photos/` | `data/wave-4/design-samples/<slug>/photos/` |
| Graded crops | `data/wave/<slug>/graded/` | `data/wave-4/design-samples/<slug>/graded/` |

A content folder with `engine.json` is picked up by `plumb preview build` like any other page (`loadContent` in `packages/preview/src/build.ts`): the settings become the page's content, the graded crops its images, and its look (hero, type pair, palette family) is recorded for the variety rules. Run `plumb engine grade <slug>` before building.

## Commands

- `plumb engine pull --list inputs/NZ-WAVE-4-LIST.csv --only <slugs>`: reads each homepage (text, links, logo, colours, photos) into `data/wave-4/design-samples/<slug>/`. No database, no audit.
- `plumb engine palette <slug> --engine <name>`: writes `palette.json` from the logo, the site's colours and the photos, and prints any pair that fails AA (none should).
- `plumb engine photos <slug>`: ranks their photos by width, sharpness and detail, marks where each may go (hero, framed, small), and writes a numbered sheet for choosing by eye.
- `plumb engine grade <slug>`: for a real page, scores, grades and cuts its picked photos and chooses the hero.
- `plumb engine build [--only <slugs>]`: grades the picked photos, writes the page data and builds the local sample site in `previews/engine-samples/site/`.
- `plumb engine variety`: the variety rules across waves 1 to 4 and Wine Hopper.
- `plumb engine gates [--only <slugs>]`: the gates of the standard on the sample site, including the type scale, signature labels and pacing.
- `plumb engine shots --out <dir> [--only <slugs> | --url <address>]`: phone screenshots, 390 wide JPEG, first three screens and one mid page. The visit report is answered inside the browser and never sent.

## Fields

| Field | Required | What it holds |
|---|---|---|
| `engine` | yes | `fishing`, `paddle`, `stay` or `physio` |
| `concept` | yes | the one idea of the page, a short line of their own words and facts |
| `slug`, `name`, `domain` | yes | as in the wave list; `name` as the page reads |
| `wordmark` | no | a shorter name for the mark and footer |
| `place` | yes | `town`, optional `region`, `source` |
| `look.hero` | yes | `photo`, `split` or `type`. The engine may change it: see below |
| `look.type` | yes | one of the engine's three type pairs (table below) |
| `look.family` | yes | the palette family: `ocean`, `forest`, `vine`, `clay`, `stone`, `night`, `gold`, `alpine` |
| `palette` | yes | from `plumb engine palette`: `paper`, `ink`, `soft`, `deep`, `onDeep`, `accent`, `onAccent`, `accentInk`, `family`, `from` |
| `contact.booking` | no | their booking system, `href` exactly as their site links it (a stale date parameter may be dropped), `label` |
| `contact.phone` | no | `display` as their site writes it, `tel` as `tel:+64…` |
| `contact.email` | no | their published address |
| `contact.address`, `contact.hours` | no | as they state them |
| `hero.lines` | yes | the headline, one to five lines, their words |
| `hero.sub` | no | one sentence of theirs under the headline |
| `hero.facts` | no | up to four `{ label, value, source }` |
| `hero.photo` | no | the id of the hero photo, if a person chose one |
| `hero.inset` | no | for a typographic hero, the photo shown as an inset |
| `intro` | no | `heading` and a `quote` of theirs, set large |
| `band` | no | three or more of their words for a moving band (fish, places, rooms) |
| `photos` | no | the picked photos: `id`, `file` (under the photo folder), `alt`, `focus` [x, y] from 0 to 1, `source` |
| `story` | no | the pinned scroll story: `heading` and three or four `steps` of `title`, `text`, optional `mark` (a time or distance they state) and `photo` |
| `signature` | no | one signature interaction (below) |
| `offers` | no | `heading` and two or more `items` (`name`, `text`, `meta`, `price`, `photo`) |
| `people` | no | `heading` and `items` (`name`, `role`, `text`, `photo`) |
| `practical` | no | `heading` and two or more `{ label, text }` |
| `gallery` | no | photo ids in order; each photo is used once on a page |
| `close` | yes | `heading` and an optional `line` of theirs |

At least one of booking, phone or email is required. The main button is the first of booking, phone, email.

### The hero the photos allow

The photos decide the hero; `look.hero` only chooses between full bleed and split where both are allowed.

- Every picked photo is scored for sharpness (variance of a Laplacian on an 800 px wide copy). Under 150 it is not used anywhere; a hero needs 300. `plumb engine build` (and `plumb engine grade`) logs each score, and `graded/index.json` keeps them with the hero and inset chosen.
- The hero photo is `hero.photo` if it is sharp and at least 1200 px wide; otherwise their best such photo not used elsewhere on the page, full bleed ones first.
- 1800 px or wider and 1080 px high: `photo` (full bleed). 1200 to 1800 px, or wide and shallow: `split` (a panel on desktop, a full width 4:3 band on a phone). Below 1200 px or soft: `type`.
- A typographic hero shows `hero.inset` (or, if left out, their best remaining sharp photo) as an inset.
- The hero's phone image is encoded at the highest quality (42 down to 34) that keeps it within 54 KB at 750 px, recorded as `phoneQuality` in the index.
- The build reports any change from `look.hero` (`heroNote`), and the variety rules use the hero actually shown.

### Type pairs

| Engine | Pairs (display with text) |
|---|---|
| fishing | `bigshoulders-hanken`, `unbounded-intertight`, `bricolage-librefranklin` |
| paddle | `fraunces-instrumentsans`, `sora-literata`, `instrumentserif-dmsans` |
| stay | `cormorant-manrope`, `youngserif-worksans`, `gloock-outfit` |
| physio | `plusjakarta-lora`, `onest-sourceserif`, `geologica-crimsonpro` |

No pair is used by any earlier page or by another engine (`plumb engine variety` checks this against every design in the repository and the wave 2 library).

### Signatures

| Engine | `kind` | Data |
|---|---|---|
| fishing | `tripboard` | `trips[]`: `name`, `target`, `duration`, `departs`, `price`, `group`, `bar` (the bar's length from a figure they state: price or length), `barOf`, `note` |
| fishing | `seasons` | `species[]`: `name`, `months` (1 to 12, only as they state), `where`, `note` |
| fishing | `day` | `steps[]`: `time` (as they state), `text` |
| paddle | `route` | `trip`, `stops[]` (`name`, `note`), `facts`. The stops in order on a plain rule, labelled not to scale |
| paddle | `chooser` | `trips[]`: `name`, `text`, `duration`, `level`, `price`. Ends at their booking link or a prepared email |
| paddle | `conditions` | `items[]`: `label`, `text` (their own rules) |
| stay | `rooms` | `units[]`: `name`, `text`, `sleeps`, `price`, `photo` (the view from it) |
| stay | `builder` | `units[]` (`name`, `price`), `maxNights`, `maxGuests` (only as they state). Ends at booking, email or phone |
| stay | `around` | `places[]`: `name`, `distance` (their words), `reach` (orders the groups only), `note`. A list by distance on a phone; rings beside it from 600 px |
| physio | `firstVisit` | `steps[]`: `title`, `text` |
| physio | `acc` | `points[]`: `title` (a plain question), `text` (their words only) |
| physio | `treats` | `areas[]`: `area` (`head`, `neck`, `shoulder`, `back`, `hip`, `knee`, `ankle`, `hand`, `whole`), `name` (their wording). Found by part of the body; no drawing |

Every signature plays once when first in view (at most 2.4 s), stops at the visitor's first touch or key, and does nothing with reduced motion asked for.
