// Prepares the font files the designs use from the installed font packages and writes the
// @font-face rules for them. The fonts are served from our own address, so no page calls a font host.
//
// Two things keep them small. A face a design sets at one weight only is cut down to that weight.
// And Māori macrons, which live in each family's large extended file, are lifted out into a file of
// their own that holds just those ten letters.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(app, 'public', 'fonts');

const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const MACRONS = 'āēīōūĀĒĪŌŪ';
const MACRON_RANGE = 'U+0100-0101,U+0112-0113,U+012A-012B,U+014C-014D,U+016A-016B';
// Everything a page here can ask of the Latin file: printable ASCII, Latin-1, and the usual punctuation.
const LATIN_TEXT = [...Array(95).keys()].map((i) => String.fromCodePoint(32 + i)).join('') + [...Array(96).keys()].map((i) => String.fromCodePoint(160 + i)).join('') + '‘’“”–—…•·→€™';

/** [family, package, file stem, axis, weight range, styles, what to hold still: the one weight a design uses, or another axis by name] */
const FONTS = [
  ['Figtree', '@fontsource-variable/figtree', 'figtree', 'wght', '300 900', ['normal']],
  ['Newsreader', '@fontsource-variable/newsreader', 'newsreader', 'wght', '200 800', ['normal', 'italic'], 400],
  ['Open Sans', '@fontsource-variable/open-sans', 'open-sans', 'wght', '300 800', ['normal']],
  ['Playfair Display', '@fontsource-variable/playfair-display', 'playfair-display', 'wght', '400 900', ['normal', 'italic']],
  ['Montserrat', '@fontsource-variable/montserrat', 'montserrat', 'wght', '100 900', ['normal']],
  ['Karla', '@fontsource-variable/karla', 'karla', 'wght', '200 800', ['normal']],
  ['Nunito Sans', '@fontsource-variable/nunito-sans', 'nunito-sans', 'wght', '200 1000', ['normal']],
  ['DM Serif Display', '@fontsource/dm-serif-display', 'dm-serif-display', '400', '400', ['normal', 'italic']],
  ['Bebas Neue', '@fontsource/bebas-neue', 'bebas-neue', '400', '400', ['normal']],
  ['Shadows Into Light', '@fontsource/shadows-into-light', 'shadows-into-light', '400', '400', ['normal']],
  ['Archivo', '@fontsource-variable/archivo', 'archivo', 'wght', '100 900', ['normal']],
  // The same face held at its widest, for headlines. The weight is left free.
  ['Archivo Expanded', '@fontsource-variable/archivo', 'archivo', 'wdth', '100 900', ['normal'], { wdth: 125 }],
  ['Chivo Mono', '@fontsource-variable/chivo-mono', 'chivo-mono', 'wght', '100 900', ['normal']],
];

mkdirSync(out, { recursive: true });

/** Writes a cut-down copy of a font. It is made afresh each time, so a changed rule here is never masked by an older file. */
async function cut(from, to, text, held) {
  const options = { targetFormat: 'woff2', ...(held ? { variationAxes: held } : {}) };
  writeFileSync(to, await subsetFont(readFileSync(from), text, options));
}

let css = '/* Written by scripts/fonts.mjs. */\n';
for (const [family, pkg, stem, axis, range, styles, pin] of FONTS) {
  const held = typeof pin === 'number' ? { wght: pin } : pin;
  const weight = typeof pin === 'number' ? String(pin) : range;
  for (const style of styles) {
    const files = join(app, 'node_modules', pkg, 'files');
    const latin = join(files, `${stem}-latin-${axis}-${style}.woff2`);
    const extended = join(files, `${stem}-latin-ext-${axis}-${style}.woff2`);
    if (!existsSync(latin)) continue;
    const name = `${stem}-latin-${axis}-${style}.woff2`;
    if (held) await cut(latin, join(out, name), LATIN_TEXT, held);
    else copyFileSync(latin, join(out, name));
    css += `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};font-display:swap;src:url(/demo/fonts/${name}) format('woff2');unicode-range:${LATIN}}\n`;
    if (!existsSync(extended)) continue;
    // Two cuts of one face each keep macrons of their own.
    const macrons = `${stem}-macrons-${axis === 'wdth' ? 'wdth-' : ''}${style}.woff2`;
    await cut(extended, join(out, macrons), MACRONS, held);
    css += `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};font-display:swap;src:url(/demo/fonts/${macrons}) format('woff2');unicode-range:${MACRON_RANGE}}\n`;
  }
}
writeFileSync(join(app, 'app', 'fonts.css'), css);
