import { EARLIER_LOOKS, lookIssues } from '../recipe.ts';
import { TYPE_PAIRS, type Look } from '../types.ts';
import { ENGINE_TYPE_PAIRS, type EngineName } from './schema.ts';

/**
 * The variety rule across every wave: no two pages, whichever wave they were made in, share a hero,
 * a pair of faces and a palette family all three. Engine pages hold a stronger rule for their type:
 * no engine pair is any earlier page's pair, and no two engines share a pair. So no engine page can
 * match an earlier page on all three, and only engine pages need to be held against each other.
 */

/** The faces of the earlier pages, display first, by the design or library pair they were set in. */
export const EARLIER_TYPE_PAIRS: { by: string; display: string; text: string }[] = [
  // Wave 1 and Wine Hopper.
  { by: 'coastal', display: 'DM Serif Display', text: 'Karla' },
  { by: 'earth', display: 'Bebas Neue', text: 'Nunito Sans' },
  { by: 'journal', display: 'Playfair Display', text: 'Montserrat' },
  { by: 'label', display: 'Newsreader', text: 'Open Sans' },
  { by: 'waterline', display: 'Figtree', text: 'Figtree' },
  { by: 'loop', display: 'Archivo Expanded', text: 'Archivo' },
  // Wave 2, the section library's pairs.
  { by: 'playfair-nunito', display: 'Playfair Display', text: 'Nunito Sans' },
  { by: 'dmserif-figtree', display: 'DM Serif Display', text: 'Figtree' },
  { by: 'newsreader-opensans', display: 'Newsreader', text: 'Open Sans' },
  { by: 'bebas-karla', display: 'Bebas Neue', text: 'Karla' },
  { by: 'montserrat-opensans', display: 'Montserrat', text: 'Open Sans' },
  { by: 'figtree-newsreader', display: 'Figtree', text: 'Newsreader' },
  { by: 'playfairitalic-karla', display: 'Playfair Display', text: 'Karla' },
  { by: 'karla-karla', display: 'Karla', text: 'Karla' },
  { by: 'dmserifitalic-nunito', display: 'DM Serif Display', text: 'Nunito Sans' },
  { by: 'montserratlight-figtree', display: 'Montserrat', text: 'Figtree' },
  // Wave 2 and 3 pages made to order, by design.
  { by: 'afoot', display: 'Fraunces', text: 'Geologica' },
  { by: 'paddock', display: 'Big Shoulders Display', text: 'Literata' },
  { by: 'fathom', display: 'Instrument Serif', text: 'Onest' },
  { by: 'lineage', display: 'Inter Tight', text: 'Instrument Sans' },
  { by: 'earshot', display: 'Bricolage Grotesque', text: 'Petrona' },
  { by: 'meander', display: 'Gloock', text: 'Familjen Grotesk' },
  { by: 'galaxy', display: 'Bodoni Moda', text: 'Manrope' },
  { by: 'latch', display: 'Epilogue', text: 'Schibsted Grotesk' },
  { by: 'landing', display: 'Anton', text: 'DM Sans' },
  { by: 'haul', display: 'Antonio', text: 'Libre Franklin' },
  { by: 'pour', display: 'Zilla Slab', text: 'Libre Franklin' },
  { by: 'backyard', display: 'League Spartan', text: 'DM Mono' },
  { by: 'sunpath', display: 'Yeseva One', text: 'Outfit' },
  { by: 'lamplight', display: 'Darker Grotesque', text: 'Hanken Grotesk' },
  { by: 'ingrained', display: 'Cormorant Garamond', text: 'Sora' },
  { by: 'settle', display: 'Syne', text: 'Work Sans' },
  { by: 'clearing', display: 'Red Hat Display', text: 'Source Serif 4' },
  { by: 'hush', display: 'Literata', text: 'Plus Jakarta Sans' },
  { by: 'skyline', display: 'Oswald', text: 'IBM Plex Sans' },
  { by: 'aperture', display: 'Plus Jakarta Sans', text: 'Crimson Pro' },
  { by: 'sounder', display: 'Martian Mono', text: 'Inter Tight' },
  { by: 'bearing', display: 'Italiana', text: 'Instrument Sans' },
  { by: 'longline', display: 'Schibsted Grotesk', text: 'IBM Plex Sans' },
  { by: 'wake', display: 'Geologica', text: 'Source Serif 4' },
  { by: 'spin', display: 'DM Sans', text: 'Instrument Sans' },
];

const key = (display: string, text: string) => `${display.toLowerCase()}|${text.toLowerCase()}`;

/** Problems with the engines' own pairs: one that an earlier page used, or one two engines share. */
export function pairIssues(): string[] {
  const out: string[] = [];
  const earlier = new Map(EARLIER_TYPE_PAIRS.map((p) => [key(p.display, p.text), p.by]));
  const mine = new Map<string, string>();
  for (const [engine, pairs] of Object.entries(ENGINE_TYPE_PAIRS) as [EngineName, (typeof ENGINE_TYPE_PAIRS)[EngineName]][]) {
    for (const [id, p] of Object.entries(pairs)) {
      const k = key(p.display, p.text);
      if (earlier.has(k)) out.push(`${engine} pair ${id} (${p.display} with ${p.text}) is the pair of ${earlier.get(k)}`);
      if (mine.has(k)) out.push(`${engine} pair ${id} is also ${mine.get(k)}`);
      mine.set(k, `${engine} ${id}`);
    }
  }
  // Every library pair of wave 2 is written down above.
  for (const id of TYPE_PAIRS) if (!EARLIER_TYPE_PAIRS.some((p) => p.by === id)) out.push(`the library pair ${id} is missing from the earlier pairs`);
  return out;
}

/**
 * Every problem for a set of engine pages, held with any other pages whose look is known (the
 * earlier pages made to order, and any passed in) against the rule across every wave.
 */
export function engineVarietyIssues(pages: { slug: string; look: Look }[], others: { slug: string; look: Look }[] = []): string[] {
  const all = new Map<string, Look>(EARLIER_LOOKS.map((e) => [e.slug, e.look]));
  for (const o of others) all.set(o.slug, o.look);
  for (const p of pages) all.set(p.slug, p.look);
  return [...pairIssues(), ...lookIssues([...all].map(([slug, look]) => ({ slug, look })))];
}
