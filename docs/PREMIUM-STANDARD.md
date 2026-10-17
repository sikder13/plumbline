# The Premium Standard

Every wave 4 page is rendered by one of four engines (fishing, paddle, stay, physio) from a settings file. This page is the bar each engine is built and gated to. It is drawn from the Wine Hopper page (`apps/previews/designs/loop.tsx`), the three wave 3 designs that beat it blind (`clearing`, `haul` and `skyline`), and two blind comparisons of the engines against Wine Hopper. Each rule can be checked by a script or by looking at one screenshot. The reference look is the stay engine's: their own photo first, a serif headline on a warm ground, then the facts as chips.

## 1. Type

| Role | Phone (390) | Desktop (1280+) | Notes |
|---|---|---|---|
| H1, the hero line | clamp(46px, 13.5vw, 64px) / 0.98, fitted to its longest line | clamp(64px, 5.8vw, 112px) | display face, a serif in every engine |
| H2 | clamp(34px, 9.4vw, 54px) / 1.0 | clamp(44px, 5vw, 96px) | display face |
| H3, labels, figures | 28 px at most | 36 px at most | never a display size |
| Intro (lede) and body | 17 to 22 px / 1.5 | 18 to 24 px / 1.5 | text face, 60 to 72 characters a line on desktop |
| Label | 12 px at least, 14 px in a signature section | 12 to 14 px | |

- Only H1, H2 and the hero line use display sizes. A paragraph is never set as a headline: the intro is a short heading and a lede at reading size.
- Two families per page from the engine's three pairs, every pair with a serif display face; self hosted woff2, at most two files preloaded.
- Figures in times, prices, lengths and distances use tabular numerals.
- **Gate** (`plumb engine gates`, "type"): at 390 and 1280, running text (a paragraph, item or definition of 60 characters or more) is at most 22 px on a phone and 24 px on desktop, and at most about 72 characters a line; any other text outside H1 and H2 is at most 28 px and 36 px.

## 2. Spacing and grounds

- 8 px base. Side gutter 24 px on a phone, 40 px at 768, 56 px at 1100 and up. Sections 96 px apart on a phone, 128 to 160 px on desktop.
- The ground is warm in every engine (paper about OKLCH 0.97 L, hue 80 to 88), with a soft second ground and one deep ground for the story and the close. One accent colour, from their logo, for the action.

## 3. The hero

- **A photo hero is the default.** It is used whenever their best photo is sharp (sharpness score 300 or more, section 6) and at least 1200 px wide; a phone at 3x needs about 1170 px.
- **1800 px or wider** (and 1080 px high, for the phone crop at 2x): full bleed is allowed. On a phone the photo fills the top of the screen and the words sit below it on the warm ground; on desktop the photo fills one half.
- **1200 to 1800 px**: the split editorial hero. On desktop the photo sits in a panel beside the words, never stretched; on a phone it runs the full width, as a 4:3 band.
- **Below 1200 px, or no sharp photo**: the typographic hero only.
- The composition is the same in every engine: their own photo first; then the serif headline, one sentence of theirs, the action; then the facts as chips (a ruled grid of label and value). The action is always in the first phone screen.
- **Typographic hero**: display type set big and tight (clamp(56px, 17vw, 84px) on a phone, up to 150 px on desktop) on a surface made from their palette (the warm paper, a soft light from the accent, a fine grain); their best real photo as a strong inset (beside the words on desktop, the first scroll reveal on a phone); a quiet line of their facts (town, season, hours), each with its source in the settings.
- **No clip art.** No illustrations, icon sets or decorative drawings in any hero or signature section: no suns, waves, gauges, needles, figures or icons on buttons. The only graphics allowed there are their photos and plain rules, and diagrams whose every mark is a fact they state.
- The photo opens from a window (clip 1.4 s) and drifts from 1.07 to 1 over 9 s; the headline rises line by line (below).

## 4. Motion and pacing

| Movement | Duration | Easing |
|---|---|---|
| Headline mask rise | 1.0 s, stagger 0.16 s | cubic-bezier(0.16, 1, 0.3, 1) |
| Content entering (`data-reveal`) | 0.6 s, 16 px rise | cubic-bezier(0.22, 1, 0.36, 1) |
| Photo wipe (`data-wipe`) | clip 0.8 s, scale 1.14 to 1 over 1.0 s | cubic-bezier(0.22, 1, 0.36, 1) |
| State change inside a section | 0.35 to 0.5 s | cubic-bezier(0.16, 1, 0.3, 1) |
| Press | spring, stiffness 520, damping 32, scale 0.97 | |
| Signature self demonstration | at most 2.4 s, once | per step 0.3 to 0.6 s |

- **At most one pinned section per page.** It uses no more than half a screen of scroll per step and two screens in all (`height: 100svh + min(steps x 50svh, 200svh)`).
- **On phones narrower than 600 px nothing is pinned**: the steps follow one another, each revealed as it arrives.
- Libraries (`motion`, `lenis`) load after the first paint. Lenis only at 900 px and wider with a fine pointer, `lerp` 0.11.
- `prefers-reduced-motion: reduce`: no animation, no smooth scroll, no self demonstration, nothing pinned; every section shows its final state.
- The gate checks pacing at 390 and 1280: nothing held on a phone, one held section at most, two screens at most.

## 5. The signature interaction

- One per page, chosen in the settings file from what their own site states, built only from that data, every item with its source. No invented times, prices, distances, durations, species, seasons, rooms or treatments.
- **Every mark encodes their data.** A bar is their price or length; a ring is one of their stated distances; a list item is one of their trips, rooms or conditions. Nothing measures what they do not measure.
- **Readable labels**: horizontal, never turned, and at least 14 px on a phone. Below 600 px the "what's around you" ring is a clean stacked list grouped by the distances they state; from 600 px a ring per distance stands beside the list, labelled level.
- Missing data hides the section; fewer than two items hides it.
- It shows itself in a passive scroll (plays once, at most 2.4 s, then waits), works by keyboard with 44 px targets, and ends at their real action.

## 6. Photos

- **Sharpness beats size.** Each photo is scored as the variance of a Laplacian over a greyscale copy 800 px wide. Under 150 it is soft and is not used anywhere, however large; a hero needs 300. The score of every photo picked is logged by `plumb engine build` and kept in `graded/index.json`.
- Their own photos only: no logos, maps, screenshots, stock graphics or banners with words printed on them.
- Minimum widths: hero 1200 px (full bleed 1800); framed 1000; small 640. Never drawn larger than its pixels.
- One grade per page: the engine's curve (contrast, saturation, warmth) and a 4 to 7% tint of the deep colour in the shadows. Then each size gets a light, even sharpen after it is resized, never before.
- Each photo appears once on a page and has a focus point that every crop centres on.

## 7. Actions

- The primary action is the business's own: their booking link exactly as their site uses it, else their phone as `tel:+64…`, else a prepared `mailto:` to their published address. Nothing pretends to take a booking.
- It is in the first phone screen, in the floating bar after the hero, and at the close, in words alone. A price they state sits beside it where it applies.
- The Findings tab keeps our plumbing; its main action is the line "Reply to Udaay's email", with the 15 minute call second.

## 8. Performance budget (mobile Lighthouse, median of 3)

- Performance 90 or more, accessibility 95 or more, LCP under 2.5 s, CLS under 0.05, TBT under 200 ms.
- Hero photo at the width a phone fetches (750 px) at most 54 KB: the engine picks the highest AVIF quality from 42 down that fits, after the sharpen, and crops it close to the box it fills. Every other photo lazy and at low fetch priority. Fonts: at most 2 preloaded, each under 60 KB. Inline CSS under 70 KB. No script beyond `motion` and `lenis`, both after paint.
- No sideways scroll at 360, 390, 768 and 1280. Contrast AA for every pair in the palette, proven in code and by axe.

## 9. Words

- Headlines and quotes are the business's own words, with the address each came from. Our words are labels and links.
- No placeholder text, no dashes inside sentences, and no figure that is not on their own site.

## 10. Learnt from Wine Hopper

Wine Hopper won every pair of both blind rounds. Each reason it won maps to a rule above:

- A full bleed photograph in the first screen beat a text only hero: section 3 (photo hero by default; the typographic hero only without a sharp 1200 px photo).
- Oversized, confident display type: sections 1 and 3 (big headline, display sizes reserved for H1 and H2).
- One strict palette (red, ink, white): section 2 (one accent from the logo, warm ground, one deep).
- Every device carries real information (the route of pickup times, the loop, the departures board): section 5 (every mark encodes their data; no clip art in section 3).
- Monospace and tabular figures for times: section 1 (tabular numerals).
- Dense pinned sections that change visibly each step: section 4 (half a screen per step, two screens at most, none on a phone).
- No paragraph shouting at headline size, no small labels on curved paths: sections 1 and 5.

## 11. Beyond Wine Hopper

1. **Every photo graded, scored and art directed.** Wine Hopper showed the site's photos as they came. The engines score every photo for sharpness, refuse soft ones however large, grade them to one look, cut separate phone and desktop crops around a focus point, sharpen lightly after resizing, never draw a photo larger than its own pixels, and choose the hero by these rules by themselves.
2. **Every fact provable, colours from their own logo.** Each engine page is a settings file in which every time, price, trip, room and treatment carries the address it was read from, and every figure on the page is checked against their own text by the copy gate; the palette is computed from their logo and photos with every text pair proven AA in code (and in a test over 144 generated palettes).
3. **A signature that demonstrates itself.** Wine Hopper's day picker waits to be found. Each engine's signature plays once on first view (under 2.4 s), then hands over to the visitor, works by keyboard and with reduced motion, and ends at the business's real booking path, phone or a prepared email. Each engine also holds a stricter speed bar (performance 90, not 85) and a type scale gate.
