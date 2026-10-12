// Copies the font files the designs use out of the installed font packages and writes the
// @font-face rules for them. The fonts are served from our own address, so no page calls a font host.
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(app, 'public', 'fonts');

const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
// Māori macrons live in the extended set, which a page fetches only when it uses one.
const LATIN_EXT = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

/** [family, package, file stem, weight range, styles] */
const FONTS = [
  ['Figtree', '@fontsource-variable/figtree', 'figtree', 'wght', '300 900', ['normal']],
  ['Newsreader', '@fontsource-variable/newsreader', 'newsreader', 'wght', '200 800', ['normal', 'italic']],
  ['Open Sans', '@fontsource-variable/open-sans', 'open-sans', 'wght', '300 800', ['normal']],
  ['Playfair Display', '@fontsource-variable/playfair-display', 'playfair-display', 'wght', '400 900', ['normal', 'italic']],
  ['Montserrat', '@fontsource-variable/montserrat', 'montserrat', 'wght', '100 900', ['normal']],
  ['Karla', '@fontsource-variable/karla', 'karla', 'wght', '200 800', ['normal']],
  ['Nunito Sans', '@fontsource-variable/nunito-sans', 'nunito-sans', 'wght', '200 1000', ['normal']],
  ['DM Serif Display', '@fontsource/dm-serif-display', 'dm-serif-display', '400', '400', ['normal', 'italic']],
  ['Bebas Neue', '@fontsource/bebas-neue', 'bebas-neue', '400', '400', ['normal']],
  ['Shadows Into Light', '@fontsource/shadows-into-light', 'shadows-into-light', '400', '400', ['normal']],
];

mkdirSync(out, { recursive: true });
let css = '/* Written by scripts/fonts.mjs. */\n';
for (const [family, pkg, stem, axis, weight, styles] of FONTS) {
  for (const style of styles) {
    for (const [subset, range] of [['latin', LATIN], ['latin-ext', LATIN_EXT]]) {
      const name = `${stem}-${subset}-${axis}-${style}.woff2`;
      const from = join(app, 'node_modules', pkg, 'files', name);
      if (!existsSync(from)) continue;
      copyFileSync(from, join(out, name));
      css += `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};font-display:swap;src:url(/demo/fonts/${name}) format('woff2');unicode-range:${range}}\n`;
    }
  }
}
writeFileSync(join(app, 'app', 'fonts.css'), css);
