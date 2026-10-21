# Haute Ink v2: report

Relay: RELAY-HAUTE-INK-V2 (UD, 21 October 2026). Branch feat/open-sign in ~/nahl-clients-projects/plumbline-open-sign, main merged in first (it fast-forwarded). One page, the sample homepage "The wall", at the existing token haute-ink-tattoo-studio-zfy8pj. Nothing deployed, no email, no PR, nothing merged. No visit report was sent from any gate, screenshot or recording: every browser was marked as ours and the report was answered locally.

## The short version

- **PASS.** Every gate passes, and the review scores 9 overall at both 390 and 1440 (no quality under 8), in one round plus fixes found while recording.
- **Accent: #E7CC7D**, the median of the gold ring's pixels in their logo file. Inside the logo's circle, gold is 59% of the saturated pixels and jade 25% (at saturation 0.25 and up). Jade only leads when the smeared crop outside the circle is counted, which is not part of the logo.
- **Display face: Clash Display**, loaded from Fontshare's own files and self hosted (600 for headlines, 700 for the artists' initials). Inter 400 to 500 for text, JetBrains Mono 400 for eyebrows and tags.
- **Photos: the ten in data/open-sign/assets/haute-ink-tattoo-studio/**, all ten in the work rows, each in one row only. No instagram/ folder, no cover photo file, no storefront photo. The logo file gave the dagger mark (traced, see below).
- **Reduced for lack of photos:** the artist cards (no photo is attributed to an artist, so each is their mark on a dark field with the artist's initial) and Find us (no storefront photo, so no card image). The work section runs in full: two rows, ten photos.

## What was built

- **Sample mode, general.** A content file with `"sample": true` renders the design alone: no strip, no tabs, no price, none of our actions. After the build the framework's scripts are taken out (`staticSample`, packages/preview/src/sample.ts), so the page is static HTML with three small scripts of its own, and its fonts move into its own folder. The visit report is a script inside the page (`visitScript`) on the same terms as every other page: our own browsers and Do Not Track send nothing, the `nahl-own` flag is taken out of the address, one view after three seconds on screen, counted from the first touch or two seconds after load. Tests: packages/preview/src/sample.test.ts (8).
- **Sample gates** (`SAMPLE_GATES`): performance 90, accessibility 95, best practices 95, LCP under 2.5 s and inside the h1, CLS under 0.05, TBT under 200 ms, sideways scroll at 360, 390, 768, 1280 and 1440, at most 60 KB of script gzipped, email and directions links required, no testimonials. Lighthouse now also reports best practices, its console errors and the largest paint's element (Lighthouse 13 keeps it in its LCP breakdown).
- **Images:** a content file can ask for WebP with a JPEG fallback (`formats: ["webp", "jpeg"]`). The wall uses 400, 800 and 1200 px; the largest file is 207 KB. The cicada photo, their sharpest, is compressed a little harder to stay under 220 KB.
- **The design:** apps/previews/designs/wall.tsx, wall.css and wall.motion.js (the canvas, reveals, tilt and rows, hand written, inlined). Registered in the variety table as Clash Display with Inter; no other page uses Clash Display.
- **Faces:** scripts/fonts.mjs fetches Clash Display once from Fontshare into apps/previews/assets/fonts, which is ignored by git. The repository is public and Fontshare's licence lets a site serve the files but not pass them on.

## Gates (final build, mobile Lighthouse, median of 3)

| Gate | Result | Bar |
|---|---|---|
| Performance | 99 | 90 |
| Accessibility | 100 | 95 |
| Best practices | 100 | 95 |
| LCP | 1.95 s, the headline (`h1#wall-title`, the word "location.") in all three runs | under 2.5 s, the headline |
| CLS | 0.000 | under 0.05 |
| TBT | 0 ms | under 200 ms |
| Script, gzipped | 5.7 KB (three scripts inside the page, no files) | under 60 KB |
| Sideways scroll at 360, 390, 768, 1280, 1440 | none (the work rows scroll inside themselves by design) | none |
| Links | 21 of 21 resolve (13 different): four Instagram profiles 200, email valid, phone dialable, Directions 200, in-page anchors all found, nahltech.com 200 | all |
| axe at 390 and 1440 | no serious or critical issue | none |
| Reduced motion | 0 animations running; canvas, rows and tilt off, the mark shown still | nothing moves |
| Visit report | nothing in the first 4 s, one view, own token | as on every page |
| Copy scan | clean (no dashes in sentences, no placeholder, no AI words, no figure outside their facts) | clean |
| Images | WebP with JPEG fallback, largest 207 KB, lazy below the fold, each card at its photo's own shape (no stretching, no crop) | under 220 KB |
| Contrast | secondary bone on ink 7.99, on panels 7.62; bone on ink 17.41; gold on ink and ink on gold 12.57 | AA |
| Canvas cost | phone at 4x slower CPU: mean 0.20 ms a frame, 95th percentile 0.7 ms; the first frame only is 7.9 ms (canvas warm up). Pauses offscreen and in a hidden tab | under 4 ms |
| Variety | Clash Display used by no other page (Open Sign, wave 3, Wine Hopper, Book Direct); the type pair test passes | differs |
| Tests, lint, typecheck | 715 of 715, clean, clean | |

The four Instagram links were opened by the link gate only to read their status (200), as in run 02. Nothing was read or kept from Instagram or Facebook.

## Review

Recorded on the final build. 390: the first screen, top to bottom, back to the artists, three swipes along their cards, then Book from the bar. 1440: the pointer over the first screen (strokes and mark follow it), over an artist card (tilt and lift), the work rows with one arrow step, down to the footer, then Book from the bar. Recordings show no pointer, so a small white ring stands in for it at 1440.

| Quality | 390 | 1440 |
|---|---|---|
| Scale and restraint | 9 | 9 |
| The eyebrow system | 9 | 9 |
| One accent used sparingly | 9 | 9 |
| Image-led cards | 8 | 8 |
| The rail | 9 | 9 |
| Outline text over live motion | 9 | 9 |
| Dark glass | 8 | 8 |
| **Overall** | **9** | **9** |

The two 8s: the artist cards are led by their mark and initial, not photos, because no photo is attributed to an artist; and the glass is real but quiet (the bar, and the Book panel softening their mark behind it). A photo of each artist's own work, or a storefront photo, would lift both.

Desktop alignment: everything sits on the 12 column grid with 24 px gutters (hero text in 7 columns, the mark against the right edge; three artist cards of 4 columns; Book 5 and 7 with four buttons of 3; Find us 6 and 6; footer 6 and 6). Jumps from the bar land 64 px above each eyebrow, so every section fits under the bar at 1440 by 900. No floating panels after round one (the Book panel now lines up with its eyebrow and headline). Small text in a large field is limited to the 12 px eyebrows and tags, which is the eyebrow system.

Fixed while reviewing: the Book panel floated above its headline; Directions floated mid column; the first artist jump cut off the cards' names; a tap flashed a highlight on buttons; the work rows could not be dragged on a phone; a 404 for a tab icon cost best practices 4 points (now a small icon of their mark); one 13 ms frame when the traced mark was cached (now drawn each frame).

Files, all in previews/review/open-sign/haute-ink-v2/ (not in git, as all of previews/):
- recording-390.webm (25 s), recording-1440.webm (25 s)
- preview-390.png, preview-1440.png
- section-01-studio-1440.png, section-02-artists-1440.png, section-03-work-1440.png, section-04-book-1440.png, section-05-find-us-1440.png, section-06-footer-1440.png

Gate screenshots and gates.json are in previews/review/open-sign/haute-ink-tattoo-studio/.

## Decided alone

1. **Headline.** Their new location line does not fit two lines at 112 px in Clash Display (three lines at 1440, five at 390). The headline is its first clause, "Your brand / new location.", with "new" in gold and "location." in outline, and the rest of the line follows as the body line, "To see your long-time favorite artists.", so the whole line reads in order on the first screen.
2. **Gold, not jade,** by the pixel count above.
3. **The bar's left side is the hero's top left** (mark at 40 px and "Haute Ink"), not a second copy of it.
4. **The mark** was traced from logo.png with potrace in a scratch folder (not a repository dependency). The trace, its script and the tab icon are in data/open-sign/assets/haute-ink-tattoo-studio/mark/ and the path sits in the content file, both out of git, since it is their artwork.
5. **The Find us headline is the street's name as the relay writes it** (number and direction left off), with a full stop.
6. **Initials for the two handle-only artists** are the first letter of the handle as shown, not a guess at a name.
7. **"LGBTQ+ owned & operated."** (their words) is not on the page: no section in the relay has a place for it.
8. **Work cards carry no tag**, since no photo is attributed to an artist.
9. **Each row repeats once, hidden from screen readers,** so it can loop; every photo is in one row only.
10. **Added beyond the relay:** a pause button on the work rows (moving content needs a way to stop it), a finger drag on the rows, the phone number under the address, the shop's handle as the Book panel's first line, a small counter on the artist cards, and click reports on Message the shop, Email, Call and Directions as on other pages.
11. **The previous design (haute) stays in the repository** and its content is kept beside the new one as previews/content/haute-ink-tattoo-studio/content-seal.json, so going back is one file.
12. **Recordings are scripted scrolls**: headless Chrome ignored synthesized touch gestures, so the page and the artist rail are scrolled from the page itself.

## Fixed after the report

Every built page shipped its photos' `.made` notes, which name folders on this machine (73 files in this checkout's site, 68 in main's built site). All five site builds now copy the framework's output through one filter, `servedFile` in packages/preview/src/build.ts, with a test. The Open Sign site rebuilt here has none left and keeps all 502 images. The main preview and engine builds use the same copy but were not rebuilt here, since their data is not in this checkout; main's built site keeps its notes until it is rebuilt from code with this change.

## Deploy (not done)

The page's folder is self contained: the page, its 6 fonts and 56 images, no framework files. To put it in the next deploy from main's built site, replacing the Haute Ink page at the same token, run this after main's site is built and before it is deployed (a later rebuild of main's site would bring back the old page until this branch is merged):

```
rsync -a --delete ~/nahl-clients-projects/plumbline-open-sign/previews/out/site/demo/haute-ink-tattoo-studio-zfy8pj/ ~/nahl-clients-projects/plumbline/previews/out/site/demo/haute-ink-tattoo-studio-zfy8pj/
```

## Elapsed

Started 10:25 EDT, report pushed at 11:24 EDT, inside the 4 hour budget.
