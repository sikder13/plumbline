/** The data one preview page is built from. Written by `plumb preview build`, read by apps/previews. */

export interface Picture {
  width: number;
  height: number;
  alt: string;
  /** One entry per format, best first. */
  sources: { type: string; srcset: string }[];
  fallback: string;
  /** Average colour of the image, shown while it loads. */
  colour: string;
  /** CSS object-position for crops, when the content file sets one. */
  position: string | null;
}

export interface FindingCard {
  check: string;
  title: string;
  /** The library's impact sentence with any outside statistic removed. */
  sentence: string;
  fix: string;
  measuredNz: string;
  pageUrl: string | null;
  /** The evidence: a screenshot with the problem boxed, and what was seen in words. */
  shots: { image: { src: string; width: number; height: number } | null; seen: string | null }[];
  score: number;
}

export interface Strength {
  text: string;
  source: string;
}

export interface SecondCheck {
  score: string | null;
  aiReadiness: string | null;
  crawlerAccess: string | null;
  /** Said only when the second tool found none. */
  brokenLinks?: string;
  findings: string[];
}

export interface PageData {
  slug: string;
  token: string;
  /** The path the page is served at: slug and token. */
  path: string;
  name: string;
  domain: string;
  design: string;
  /** Design specific content, taken as it is from the content file. */
  demo: unknown;
  images: Record<string, Picture>;
  /** A short silent loop of the business's own footage for the top of the page, where it has any. */
  video: string | null;
  findings: FindingCard[];
  strengths: Strength[];
  /** The stored Google rating, for a design that shows it. */
  rating: { value: string; count: number } | null;
  secondCheck: SecondCheck | null;
  reply: { email: string; subject: string; call: string };
  builtAtNz: string;
}

/** previews/content/<slug>/content.json */
export interface ContentFile {
  design: string;
  /** Set when the business was prepared as part of a wave: its findings are then stated and ordered as the wave's are, and its photographs are read from the folder the wave was researched into. A recipe page always is. */
  wave?: boolean;
  /** For a wave's business: findings of the second tool to list under the second check although they ranked below the approved ones. By finding id, in the order to show them. Each must have held when we opened its pages ourselves. */
  secondCheckAlso?: number[];
  /** For a wave's business: a line to set after the second check's findings, for something the second tool raised as an observation and a person confirmed on the pages. Each is a whole sentence, as it is put to the owner. */
  secondCheckNotes?: string[];
  /** The business name as it should read on the page, when the stored name carries extra words. */
  name?: string;
  /** `quality` (20 to 60, 48 unless given) sets how hard a photograph is compressed: a busy one at the top of a page may need less to load in time. */
  images: Record<string, { file: string; alt: string; widths?: number[]; position?: string; quality?: number; crop?: { left: number; top: number; width: number; height: number } }>;
  /** A short loop cut from the business's own film, under previews/content/<slug>/. */
  video?: { file: string };
  /** Awards and certifications shown on the business's own site, each with the page it is shown on. */
  strengths?: Strength[];
  demo: unknown;
}

/** A page put together from the section library: previews/recipes/<slug>.json. */

export const PALETTE_FAMILIES = ['ocean', 'forest', 'vine', 'clay', 'stone', 'night', 'gold', 'alpine'] as const;
export type PaletteFamily = (typeof PALETTE_FAMILIES)[number];

/** The colours of one page, taken from the business's own site. The family is what a glance would call it. */
export interface Palette {
  family: PaletteFamily;
  /** The page ground and the words on it. */
  paper: string;
  ink: string;
  /** A tinted ground for a second band. */
  soft: string;
  /** The dark band and the words on it. */
  deep: string;
  onDeep: string;
  /** The one colour that marks the action. */
  accent: string;
  onAccent: string;
}

export const TYPE_PAIRS = ['playfair-nunito', 'dmserif-figtree', 'newsreader-opensans', 'bebas-karla', 'montserrat-opensans', 'figtree-newsreader', 'playfairitalic-karla', 'karla-karla', 'dmserifitalic-nunito', 'montserratlight-figtree'] as const;
export type TypePairId = (typeof TYPE_PAIRS)[number];

export const HERO_VARIANTS = ['photo', 'split', 'type', 'frame'] as const;
export type HeroVariant = (typeof HERO_VARIANTS)[number];

export interface HeroSection {
  kind: 'hero';
  variant: HeroVariant;
  /** Where the business is, in a few words. */
  place: string;
  /** The headline, a line to each entry: their own words, five at most. */
  lines: string[];
  sub?: string;
  /** One small line under the action, such as an award shown on their site. */
  note?: string;
  /** Where the note's figure comes from and when it was measured, as in "Google, October 2026". */
  noteSource?: string;
  /** Where the headline sits on a full photograph. */
  align?: 'low' | 'high' | 'centre';
  /** The shape of the photograph beside a typographic headline. */
  panel?: 'arch' | 'strip' | 'tall' | 'round';
  /** What moves behind the headline: their own film, a slow push in on the photograph, or nothing. */
  ambience?: 'film' | 'drift' | 'still';
  /** The ground the words sit on, when they do not sit on the photograph. */
  ground?: 'paper' | 'soft' | 'deep';
  /** Sets the headline a little larger or smaller, for a long word or a short line. */
  scale?: number;
  /** The same for a wide screen, when the headline wants a different size there. */
  scaleWide?: number;
  /** Sets the photograph in two tones, the page's dark colour and white: for an old or small photograph that would look dated in its own colours. */
  treat?: 'duotone';
}

export interface StorySection {
  kind: 'story';
  variant: 'wipe' | 'stack' | 'rail' | 'words';
  id?: string;
  /** What the story is about, in a word or two: kept for the variety check and the brief. */
  subject: string;
  heading: string;
  steps: { image?: string; label: string; text: string }[];
}

export interface RowItem {
  image?: string;
  name: string;
  meta?: string;
  /** Shown only when their own pages agree on it. */
  price?: string | null;
  text?: string;
  href?: string;
}

export interface RowsSection {
  kind: 'rows';
  variant: 'tall' | 'wide' | 'plain' | 'round';
  id?: string;
  heading: string;
  lead?: string;
  /** The words on each card's link, and the hint that the row can be dragged. */
  button?: string;
  cue: string;
  items: RowItem[];
}

export interface WipesSection {
  kind: 'wipes';
  variant: 'pair' | 'band' | 'trio';
  images: string[];
  heading?: string;
  text?: string;
}

export interface NumbersSection {
  kind: 'numbers';
  variant: 'row' | 'band' | 'list';
  heading?: string;
  items: { value: string; label: string; source?: string }[];
}

export interface WordsSection {
  kind: 'words';
  variant: 'quote' | 'letter' | 'columns';
  id?: string;
  heading?: string;
  quote?: string;
  paragraphs: string[];
  names?: string;
  image?: string;
}

export interface ListSection {
  kind: 'list';
  variant: 'ruled' | 'questions' | 'steps';
  id?: string;
  heading: string;
  lead?: string;
  items: RowItem[];
}

export interface VisitSection {
  kind: 'visit';
  variant: 'card' | 'split' | 'plain';
  id?: string;
  heading: string;
  address: string[];
  hours?: { label: string; value: string }[];
  notes?: string[];
  image?: string;
}

export type Section = HeroSection | StorySection | RowsSection | WipesSection | NumbersSection | WordsSection | ListSection | VisitSection;
export type SectionKind = Section['kind'];

/** The five lines of art direction a page is built to. */
export interface Brief {
  /** Three words. */
  mood: string;
  /** Their own words, five at most. */
  headline: string;
  hero: string;
  story: string;
  /** The three layout patterns the page leans on. */
  patterns: string[];
}

export interface Recipe {
  brief: Brief;
  /** The business name as it should read on the page, when the stored name carries extra words. */
  name?: string;
  palette: Palette;
  type: TypePairId;
  /** The one thing the page asks for, with the address their own site sends a visitor to. */
  action: { label: string; href: string; variant: 'pill' | 'dock' | 'stack' };
  call: { tel: string; display: string };
  email: string;
  nav: { label: string; href: string }[];
  images: ContentFile['images'];
  /** A short loop cut from the business's own film. */
  video?: { file: string };
  strengths?: Strength[];
  sections: Section[];
}
