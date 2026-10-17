# The Premium Standard

Every wave 4 page is rendered by one of four engines (fishing, paddle, stay, physio) from a settings file. This page is the bar each engine is built and gated to. It is drawn from the Wine Hopper page (`apps/previews/designs/loop.tsx`) and the three wave 3 designs that beat it blind (`clearing`, `haul` and `skyline`). Each rule can be checked by a script or by looking at one screenshot.

## 1. Type

| Role | Phone (390) | Desktop (1280+) | Notes |
|---|---|---|---|
| Label | 12 px, tracked +0.08em, caps or mono | 12 to 13 px | never below 12 px |
| Body | 17 px / 1.5 | 18 px / 1.55 | weight 400 to 450 |
| Lead | 20 to 22 px / 1.35 | 24 to 28 px | one per section at most |
| H3 | 24 to 28 px / 1.1 | 28 to 34 px | |
| H2 | clamp(40px, 11vw, 52px) / 0.98 | clamp(56px, 5.6vw, 96px) | tracking -0.02em to -0.04em |
| H1 | clamp(46px, 13.5vw, 64px) / 0.94 | clamp(80px, 8.6vw, 168px) | four lines at most on a phone |

- Two families per page from the engine's three pairs, self hosted woff2, at most two files preloaded. No third face except a mono for labels, and only if the pair has none.
- Line length: body 30 to 38 characters on a phone (it falls out of the size), at most 62ch on desktop. Leads at most 34ch. A headline line at most 14 characters on a phone.
- No word is cut by a container at 360 px. No orphan of one short word on the last line of a headline (`text-wrap: balance` on headings, `pretty` on paragraphs).

## 2. Spacing rhythm

- 8 px base. Steps used: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 160.
- Side gutter 20 px at 360, 24 px at 390, 40 px at 768, 56 px at 1280.
- Section padding 96 px top and bottom on a phone, 128 to 160 px on desktop. Inside a section: heading to lead 16 px, lead to content 40 px (phone) or 56 px (desktop).
- Two or three grounds for the whole page (paper, a soft tint, one deep). A ground changes only at a section edge.

## 3. Hero

- First phone screen holds: the business's name, a headline in their own words, one line of their real facts (trips, rooms, hours or place), and the primary action. Nothing else competes.
- Three variants in every engine: `photo` (full bleed), `split` (editorial: words on a ground beside or above a framed photo), `type` (typographic, no photo needed).
- Photo hero only from a photo at least 1800 px wide, sharpness at least 0.8 on the measure in `packages/wave/src/assets.ts`. Otherwise the engine switches to `type` by itself.
- Crops: one for desktop (about 16:9 or wider) and one for phones (about 4:5 to 9:16), each around the subject's focus point, each from the source's own pixels. A crop is never drawn larger than its pixels at 2x on a phone or 1x on desktop.
- Overlay: a gradient only where the words sit, at most 0.62 opacity behind text, the subject left clear. Words over a photo pass AA against the darkest and the lightest pixel under them (checked on the graded file).
- Masked headline reveal: each line is clipped (`overflow: hidden`) and its words rise from 108% to 0 over 1.0 s on cubic-bezier(0.16, 1, 0.3, 1), starting at 0.12 s, each line 0.16 s after the last. Pure CSS, so it runs before any script. The photo drifts from scale 1.07 to 1 over 9 s.
- The hero photo is the largest paint: preloaded with `fetchpriority="high"`, phone and desktop sources split by media query.

## 4. Motion

| Movement | Duration | Easing |
|---|---|---|
| Headline mask rise | 1.0 s, stagger 0.16 s | cubic-bezier(0.16, 1, 0.3, 1) |
| Content entering (`data-reveal`) | 0.6 s, 16 px rise | cubic-bezier(0.22, 1, 0.36, 1) |
| Photo wipe (`data-wipe`) | clip 0.8 s, scale 1.14 to 1 over 1.0 s | cubic-bezier(0.22, 1, 0.36, 1) |
| State change inside a device | 0.35 to 0.5 s | cubic-bezier(0.16, 1, 0.3, 1) |
| Press | spring, stiffness 520, damping 32, scale 0.97 | |
| Line drawing | 0.9 to 1.2 s | cubic-bezier(0.45, 0, 0.75, 1) |
| Signature self demonstration | at most 2.4 s, once | per step 0.4 s |

- Libraries (`motion`, `lenis`) load after the first paint. With no script the page is complete and readable.
- Lenis only at 900 px and wider with a fine pointer, `lerp` 0.11. Phones keep native scrolling.
- `prefers-reduced-motion: reduce`: no animation, no smooth scroll, no self demonstration. Pinned sections lay out as a plain vertical sequence with no empty screen height; every device shows its final state.
- A pinned story has 3 or 4 steps, about 90 to 110 svh each, and every step changes something visible on the device itself (not a counter plus a swapped caption). It takes at most 5 seconds of a 30 second scroll.
- Hover effects only under `(hover: hover) and (pointer: fine)`.

## 5. The signature interaction

- One per page, chosen in the settings file from what the business's own site states. Never two.
- Built only from settings data, every item of which carries the address it was read from. No invented times, prices, distances, durations, species, seasons, rooms or treatments. A number on the page that is not in their own text fails the copy gate.
- Missing data hides the section. A signature with fewer than two items is not shown; the engine falls back to the next signature that has data, or to none.
- It shows itself in a passive scroll: on first view it plays once (at most 2.4 s), then waits. Its default state looks different from its other states.
- Operable by keyboard (tabs or radio groups with arrow keys), labelled for screen readers, 44 px targets.
- It ends at the business's real action: their booking link, their phone or a prepared email to their published address.

## 6. Photos

- Picked by the pipeline: their own photos only (no maps, logos, screenshots or third party images), ranked by width, then sharpness, then entropy. A person can override a pick in the settings file.
- Minimum sizes: full bleed 1800 px wide; half width or framed 1000 px; small framed (rooms, trips) 640 px. Smaller photos are not used.
- One grade for every photo on a page: the engine's base curve (contrast, saturation, warmth) plus a 4 to 6% tint of the page's deep colour in the shadows. Never a filter that changes the subject's colours beyond recognition.
- Art direction: each photo has a focus point; phone crops centre on it. Each photo appears once on a page.
- Alt text describes what is in the photo, in plain words, from their caption where they gave one.

## 7. Actions

- The primary action is the business's own: their booking system link exactly as their site uses it; else their phone as `tel:+64…`; else a `mailto:` to their published address with a subject and a short body. Nothing on the page pretends to take a booking.
- The primary action is in the first phone screen, in the sticky bar once the hero has gone by, and at the close. A price stated by them sits beside the action where it applies.
- Phone and email links are checked: `tel:+64` followed by 8 to 10 digits, a valid address. Every outside link opens in a real browser before a page passes.
- The Findings tab keeps our plumbing unchanged (visit report, findings, pricing, Who we are). Its main action is a clear line, "Reply to Udaay's email", with the 15 minute call as the second.

## 8. Performance budget (mobile Lighthouse, median of 3)

- Performance 90 or more, accessibility 95 or more, LCP under 2.5 s, CLS under 0.05, TBT under 200 ms.
- Hero photo at phone width under 140 KB (AVIF, sized to the phone's real width); every other photo lazy and at low fetch priority, so nothing competes with it. Fonts: at most 2 preloaded, each under 60 KB. Inline CSS under 70 KB. No script added beyond `motion` and `lenis`, both after paint.
- No sideways scroll at 360, 390, 768 and 1280. Every image has width and height.
- Contrast AA for every text and ground pair in the palette, proven by the palette script and by axe.

## 9. Words

- Headlines and quotes are the business's own words, with the address each came from. Our words are limited to labels and links ("Book", "Call", "Rooms").
- No placeholder text, no "Lorem", "TBD", "Coming soon", "Title", no empty headings, no template leftovers.
- No dashes inside sentences in the copy; a range is written with "to".

## 10. Beyond Wine Hopper

1. **Every photo graded and art directed.** Wine Hopper showed the site's photos as they came. The engines grade every photo on a page to one look, cut separate phone and desktop crops around a focus point, never draw a photo larger than its own pixels, drop soft or small photos, and switch to the typographic hero by themselves when no photo is big enough.
2. **Every fact provable, colours from their own logo.** Wine Hopper's copy and palette were set by hand. Each engine page is a settings file in which every time, price, trip, room and treatment carries the address it was read from, and every figure on the page is checked against their own text by the copy gate; the palette is computed from their logo and photos with every text pair proven AA in code (and in a test over 144 generated palettes).
3. **A signature that demonstrates itself.** Wine Hopper's day picker waits to be found. Each engine's signature plays once on first view (under 2.4 s), then hands over to the visitor, works by keyboard and with reduced motion, and ends at the business's real booking path, phone or a prepared email. Each engine also holds a stricter speed bar (performance 90, not 85).
