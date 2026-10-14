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
  // Faces added for the wave 3 pages, each made to order.
  ['Fraunces', '@fontsource-variable/fraunces', 'fraunces', 'wght', '100 900', ['normal', 'italic']],
  ['Instrument Sans', '@fontsource-variable/instrument-sans', 'instrument-sans', 'wght', '400 700', ['normal']],
  ['Bricolage Grotesque', '@fontsource-variable/bricolage-grotesque', 'bricolage-grotesque', 'wght', '200 800', ['normal']],
  ['Space Grotesk', '@fontsource-variable/space-grotesk', 'space-grotesk', 'wght', '300 700', ['normal']],
  ['Syne', '@fontsource-variable/syne', 'syne', 'wght', '400 800', ['normal']],
  ['Unbounded', '@fontsource-variable/unbounded', 'unbounded', 'wght', '200 900', ['normal']],
  ['Manrope', '@fontsource-variable/manrope', 'manrope', 'wght', '200 800', ['normal']],
  ['Inter Tight', '@fontsource-variable/inter-tight', 'inter-tight', 'wght', '100 900', ['normal']],
  ['Cormorant Garamond', '@fontsource-variable/cormorant-garamond', 'cormorant-garamond', 'wght', '300 700', ['normal', 'italic']],
  ['Bodoni Moda', '@fontsource-variable/bodoni-moda', 'bodoni-moda', 'wght', '400 900', ['normal', 'italic']],
  ['EB Garamond', '@fontsource-variable/eb-garamond', 'eb-garamond', 'wght', '400 800', ['normal', 'italic']],
  ['Literata', '@fontsource-variable/literata', 'literata', 'wght', '200 900', ['normal', 'italic']],
  ['Oswald', '@fontsource-variable/oswald', 'oswald', 'wght', '200 700', ['normal']],
  ['Epilogue', '@fontsource-variable/epilogue', 'epilogue', 'wght', '100 900', ['normal']],
  ['Schibsted Grotesk', '@fontsource-variable/schibsted-grotesk', 'schibsted-grotesk', 'wght', '400 900', ['normal']],
  ['Familjen Grotesk', '@fontsource-variable/familjen-grotesk', 'familjen-grotesk', 'wght', '400 700', ['normal']],
  ['Hanken Grotesk', '@fontsource-variable/hanken-grotesk', 'hanken-grotesk', 'wght', '100 900', ['normal']],
  ['Plus Jakarta Sans', '@fontsource-variable/plus-jakarta-sans', 'plus-jakarta-sans', 'wght', '200 800', ['normal']],
  ['Sora', '@fontsource-variable/sora', 'sora', 'wght', '100 800', ['normal']],
  ['Outfit', '@fontsource-variable/outfit', 'outfit', 'wght', '100 900', ['normal']],
  ['Red Hat Display', '@fontsource-variable/red-hat-display', 'red-hat-display', 'wght', '300 900', ['normal']],
  ['Work Sans', '@fontsource-variable/work-sans', 'work-sans', 'wght', '100 900', ['normal']],
  ['Lora', '@fontsource-variable/lora', 'lora', 'wght', '400 700', ['normal', 'italic']],
  ['Crimson Pro', '@fontsource-variable/crimson-pro', 'crimson-pro', 'wght', '200 900', ['normal', 'italic']],
  ['JetBrains Mono', '@fontsource-variable/jetbrains-mono', 'jetbrains-mono', 'wght', '100 800', ['normal']],
  ['Martian Mono', '@fontsource-variable/martian-mono', 'martian-mono', 'wght', '100 800', ['normal']],
  ['Caveat', '@fontsource-variable/caveat', 'caveat', 'wght', '400 700', ['normal']],
  ['Roboto Slab', '@fontsource-variable/roboto-slab', 'roboto-slab', 'wght', '100 900', ['normal']],
  ['Bitter', '@fontsource-variable/bitter', 'bitter', 'wght', '100 900', ['normal', 'italic']],
  ['Petrona', '@fontsource-variable/petrona', 'petrona', 'wght', '100 900', ['normal', 'italic']],
  ['Antonio', '@fontsource-variable/antonio', 'antonio', 'wght', '100 700', ['normal']],
  ['League Spartan', '@fontsource-variable/league-spartan', 'league-spartan', 'wght', '100 900', ['normal']],
  ['Geologica', '@fontsource-variable/geologica', 'geologica', 'wght', '100 900', ['normal']],
  ['DM Sans', '@fontsource-variable/dm-sans', 'dm-sans', 'wght', '100 1000', ['normal', 'italic']],
  ['IBM Plex Sans', '@fontsource-variable/ibm-plex-sans', 'ibm-plex-sans', 'wght', '100 700', ['normal']],
  ['Libre Franklin', '@fontsource-variable/libre-franklin', 'libre-franklin', 'wght', '100 900', ['normal']],
  ['Alegreya', '@fontsource-variable/alegreya', 'alegreya', 'wght', '400 900', ['normal', 'italic']],
  ['Gelasio', '@fontsource-variable/gelasio', 'gelasio', 'wght', '400 700', ['normal', 'italic']],
  ['Big Shoulders Display', '@fontsource-variable/big-shoulders-display', 'big-shoulders-display', 'wght', '100 900', ['normal']],
  ['Cinzel', '@fontsource-variable/cinzel', 'cinzel', 'wght', '400 900', ['normal']],
  ['Darker Grotesque', '@fontsource-variable/darker-grotesque', 'darker-grotesque', 'wght', '300 900', ['normal']],
  ['Source Serif 4', '@fontsource-variable/source-serif-4', 'source-serif-4', 'wght', '200 900', ['normal', 'italic']],
  ['Onest', '@fontsource-variable/onest', 'onest', 'wght', '100 900', ['normal']],
  ['Instrument Serif', '@fontsource/instrument-serif', 'instrument-serif', '400', '400', ['normal', 'italic']],
  ['Young Serif', '@fontsource/young-serif', 'young-serif', '400', '400', ['normal']],
  ['Gloock', '@fontsource/gloock', 'gloock', '400', '400', ['normal']],
  ['DM Mono', '@fontsource/dm-mono', 'dm-mono', '400', '400', ['normal']],
  ['DM Mono', '@fontsource/dm-mono', 'dm-mono', '500', '500', ['normal']],
  ['Space Mono', '@fontsource/space-mono', 'space-mono', '400', '400', ['normal']],
  ['Space Mono', '@fontsource/space-mono', 'space-mono', '700', '700', ['normal']],
  ['Anton', '@fontsource/anton', 'anton', '400', '400', ['normal']],
  ['Abril Fatface', '@fontsource/abril-fatface', 'abril-fatface', '400', '400', ['normal']],
  ['Zilla Slab', '@fontsource/zilla-slab', 'zilla-slab', '500', '500', ['normal']],
  ['Zilla Slab', '@fontsource/zilla-slab', 'zilla-slab', '700', '700', ['normal']],
  ['Italiana', '@fontsource/italiana', 'italiana', '400', '400', ['normal']],
  ['Rozha One', '@fontsource/rozha-one', 'rozha-one', '400', '400', ['normal']],
  ['Yeseva One', '@fontsource/yeseva-one', 'yeseva-one', '400', '400', ['normal']],
  ['Marcellus', '@fontsource/marcellus', 'marcellus', '400', '400', ['normal']],
  ['Tenor Sans', '@fontsource/tenor-sans', 'tenor-sans', '400', '400', ['normal']],
  ['Fragment Mono', '@fontsource/fragment-mono', 'fragment-mono', '400', '400', ['normal']],
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
    // So do two weights of a face that comes as one file a weight. The usual weight keeps the plain name.
    const macrons = `${stem}-macrons-${axis === 'wdth' ? 'wdth-' : ''}${/^\d+$/.test(axis) && axis !== '400' ? `${axis}-` : ''}${style}.woff2`;
    await cut(extended, join(out, macrons), MACRONS, held);
    css += `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};font-display:swap;src:url(/demo/fonts/${macrons}) format('woff2');unicode-range:${MACRON_RANGE}}\n`;
  }
}
writeFileSync(join(app, 'app', 'fonts.css'), css);
