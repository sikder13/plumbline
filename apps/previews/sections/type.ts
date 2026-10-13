import type { TypePairId } from '@plumbline/preview/types';

export interface TypePair {
  /** The face the headlines are set in, and how. */
  display: string;
  weight: number;
  italic?: boolean;
  upper?: boolean;
  tracking: string;
  leading: number;
  /** How large the face runs against the others: a narrow face is set bigger, a wide one smaller. */
  scale: number;
  body: string;
  /** Font files to fetch first, by file stem under /fonts. */
  fonts: string[];
}

const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';

/** Ten pairings from the faces we serve ourselves. A page names one, and no two pages of a kind share it. */
export const TYPE: Record<TypePairId, TypePair> = {
  'playfair-nunito': { display: `'Playfair Display', ${SERIF}`, weight: 500, tracking: '-0.015em', leading: 1.02, scale: 1, body: `'Nunito Sans', ${SANS}`, fonts: ['playfair-display-latin-wght-normal', 'nunito-sans-latin-wght-normal'] },
  'dmserif-figtree': { display: `'DM Serif Display', ${SERIF}`, weight: 400, tracking: '-0.01em', leading: 1, scale: 1.04, body: `'Figtree', ${SANS}`, fonts: ['dm-serif-display-latin-400-normal', 'figtree-latin-wght-normal'] },
  'newsreader-opensans': { display: `'Newsreader', ${SERIF}`, weight: 400, tracking: '-0.02em', leading: 1, scale: 1.06, body: `'Open Sans', ${SANS}`, fonts: ['newsreader-latin-wght-normal', 'open-sans-latin-wght-normal'] },
  'bebas-karla': { display: `'Bebas Neue', Impact, ${SANS}`, weight: 400, upper: true, tracking: '0.01em', leading: 0.9, scale: 1.34, body: `'Karla', ${SANS}`, fonts: ['bebas-neue-latin-400-normal', 'karla-latin-wght-normal'] },
  'montserrat-opensans': { display: `'Montserrat', ${SANS}`, weight: 800, upper: true, tracking: '-0.02em', leading: 0.96, scale: 0.84, body: `'Open Sans', ${SANS}`, fonts: ['montserrat-latin-wght-normal', 'open-sans-latin-wght-normal'] },
  'figtree-newsreader': { display: `'Figtree', ${SANS}`, weight: 700, tracking: '-0.035em', leading: 0.98, scale: 0.98, body: `'Newsreader', ${SERIF}`, fonts: ['figtree-latin-wght-normal', 'newsreader-latin-wght-normal'] },
  'playfairitalic-karla': { display: `'Playfair Display', ${SERIF}`, weight: 400, italic: true, tracking: '-0.02em', leading: 1.04, scale: 1.02, body: `'Karla', ${SANS}`, fonts: ['playfair-display-latin-wght-italic', 'karla-latin-wght-normal'] },
  'karla-karla': { display: `'Karla', ${SANS}`, weight: 700, tracking: '-0.045em', leading: 0.96, scale: 1, body: `'Karla', ${SANS}`, fonts: ['karla-latin-wght-normal'] },
  'dmserifitalic-nunito': { display: `'DM Serif Display', ${SERIF}`, weight: 400, italic: true, tracking: '-0.01em', leading: 1.02, scale: 1.04, body: `'Nunito Sans', ${SANS}`, fonts: ['dm-serif-display-latin-400-italic', 'nunito-sans-latin-wght-normal'] },
  'montserratlight-figtree': { display: `'Montserrat', ${SANS}`, weight: 300, tracking: '-0.04em', leading: 1, scale: 0.92, body: `'Figtree', ${SANS}`, fonts: ['montserrat-latin-wght-normal', 'figtree-latin-wght-normal'] },
};
