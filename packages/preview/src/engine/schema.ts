import { z } from 'zod';
import { PALETTE_FAMILIES } from '../types.ts';

/**
 * The settings of one page rendered by a page engine. Everything the page says about the business
 * is in here, and every fact carries the address it was read from. The engine adds nothing of its
 * own but labels and links: a section whose data is missing is not shown.
 *
 * docs/ENGINE-CONFIG.md describes each field.
 */

export const ENGINES = ['fishing', 'paddle', 'stay', 'physio'] as const;
export type EngineName = (typeof ENGINES)[number];

export const HERO_KINDS = ['photo', 'split', 'type'] as const;
export type HeroKind = (typeof HERO_KINDS)[number];

export interface TypePair {
  display: string;
  text: string;
  /** Font files to fetch first, by file stem under /demo/fonts. */
  preload: string[];
}

/** Three pairs of faces for each engine, every one with a serif headline. No pair is shared with another engine or with any earlier page. */
export const ENGINE_TYPE_PAIRS: Record<EngineName, Record<string, TypePair>> = {
  fishing: {
    'bitter-hanken': { display: 'Bitter', text: 'Hanken Grotesk', preload: ['bitter-latin-wght-normal', 'hanken-grotesk-latin-wght-normal'] },
    'robotoslab-intertight': { display: 'Roboto Slab', text: 'Inter Tight', preload: ['roboto-slab-latin-wght-normal', 'inter-tight-latin-wght-normal'] },
    'alegreya-librefranklin': { display: 'Alegreya', text: 'Libre Franklin', preload: ['alegreya-latin-wght-normal', 'libre-franklin-latin-wght-normal'] },
  },
  paddle: {
    'fraunces-instrumentsans': { display: 'Fraunces', text: 'Instrument Sans', preload: ['fraunces-latin-wght-normal', 'instrument-sans-latin-wght-normal'] },
    'literata-sora': { display: 'Literata', text: 'Sora', preload: ['literata-latin-wght-normal', 'sora-latin-wght-normal'] },
    'instrumentserif-dmsans': { display: 'Instrument Serif', text: 'DM Sans', preload: ['instrument-serif-latin-400-normal', 'dm-sans-latin-wght-normal'] },
  },
  stay: {
    'cormorant-manrope': { display: 'Cormorant Garamond', text: 'Manrope', preload: ['cormorant-garamond-latin-wght-normal', 'manrope-latin-wght-normal'] },
    'youngserif-worksans': { display: 'Young Serif', text: 'Work Sans', preload: ['young-serif-latin-400-normal', 'work-sans-latin-wght-normal'] },
    'gloock-outfit': { display: 'Gloock', text: 'Outfit', preload: ['gloock-latin-400-normal', 'outfit-latin-wght-normal'] },
  },
  physio: {
    'lora-plusjakarta': { display: 'Lora', text: 'Plus Jakarta Sans', preload: ['lora-latin-wght-normal', 'plus-jakarta-sans-latin-wght-normal'] },
    'sourceserif-onest': { display: 'Source Serif 4', text: 'Onest', preload: ['source-serif-4-latin-wght-normal', 'onest-latin-wght-normal'] },
    'crimsonpro-geologica': { display: 'Crimson Pro', text: 'Geologica', preload: ['crimson-pro-latin-wght-normal', 'geologica-latin-wght-normal'] },
  },
};

/** The page an item was read from. */
const Source = z.url();

/** Their own words, as their page has them. */
const Quote = z.object({ text: z.string().min(1), source: Source });
export type Quote = z.infer<typeof Quote>;

/** A short fact: a label of ours and a value of theirs. */
const Fact = z.object({ label: z.string().min(1), value: z.string().min(1), source: Source });
export type Fact = z.infer<typeof Fact>;

const Hex = z.string().regex(/^#[0-9a-f]{6}$/i);

export const EnginePalette = z.object({
  family: z.enum(PALETTE_FAMILIES),
  paper: Hex,
  ink: Hex,
  soft: Hex,
  deep: Hex,
  onDeep: Hex,
  accent: Hex,
  onAccent: Hex,
  /** The accent where it sits on paper as text or a line: the accent itself, or a deeper shade of it that passes AA. */
  accentInk: Hex,
  /** The colours it was made from, for people. */
  from: z.array(z.string()).default([]),
});
export type EnginePalette = z.infer<typeof EnginePalette>;

/** One of their photographs, chosen for the page. The pipeline grades it and cuts the phone and desktop crops. */
const PhotoPick = z.object({
  id: z.string().regex(/^[a-z][a-zA-Z0-9]*$/),
  /** The file under the business's photo folder. */
  file: z.string().min(1),
  alt: z.string().min(1),
  /** Where the subject is, as fractions of the width and height. Crops centre on it. */
  focus: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]).default([0.5, 0.5]),
  /** The address it was found on. */
  source: Source,
});
export type PhotoPick = z.infer<typeof PhotoPick>;

const Step = z.object({ title: z.string().min(1), text: z.string().min(1), source: Source, photo: z.string().optional(), mark: z.string().optional() });

/* The signature interactions. Each engine has its own three; a page shows one. */

const TripBoard = z.object({
  kind: z.literal('tripboard'),
  heading: z.string().min(1),
  trips: z
    .array(
      z.object({
        name: z.string().min(1),
        target: z.string().optional(),
        duration: z.string().optional(),
        /** The length of the trip's bar, from a figure they state: its price, or its length. Never a figure of our own. */
        bar: z.number().positive().optional(),
        departs: z.string().optional(),
        price: z.string().optional(),
        group: z.string().optional(),
        source: Source,
      }),
    )
    .min(2),
  /** What the bars measure, when the trips have them. */
  barOf: z.enum(['price', 'length']).optional(),
  note: Quote.optional(),
});
const Seasons = z.object({
  kind: z.literal('seasons'),
  heading: z.string().min(1),
  species: z.array(z.object({ name: z.string().min(1), months: z.array(z.number().int().min(1).max(12)).optional(), where: z.string().optional(), note: z.string().optional(), source: Source })).min(2),
});
const Day = z.object({
  kind: z.literal('day'),
  heading: z.string().min(1),
  steps: z.array(z.object({ time: z.string().optional(), text: z.string().min(1), source: Source })).min(3),
});
const Route = z.object({
  kind: z.literal('route'),
  heading: z.string().min(1),
  trip: z.string().min(1),
  stops: z.array(z.object({ name: z.string().min(1), note: z.string().optional(), source: Source })).min(2),
  facts: z.array(Fact).optional(),
});
const Chooser = z.object({
  kind: z.literal('chooser'),
  heading: z.string().min(1),
  trips: z.array(z.object({ name: z.string().min(1), text: z.string().optional(), duration: z.string().optional(), level: z.string().optional(), price: z.string().optional(), source: Source })).min(2),
});
const Conditions = z.object({
  kind: z.literal('conditions'),
  heading: z.string().min(1),
  items: z.array(z.object({ label: z.string().min(1), text: z.string().min(1), source: Source })).min(2),
});
const Rooms = z.object({
  kind: z.literal('rooms'),
  heading: z.string().min(1),
  units: z.array(z.object({ name: z.string().min(1), text: z.string().optional(), sleeps: z.string().optional(), price: z.string().optional(), photo: z.string().optional(), source: Source })).min(2),
});
const Builder = z.object({
  kind: z.literal('builder'),
  heading: z.string().min(1),
  /** What can be stayed in, in their words. One is enough. */
  units: z.array(z.object({ name: z.string().min(1), price: z.string().optional(), source: Source })).min(1),
  /** The most nights the builder offers. Not a rule of theirs: just how far the control goes. */
  maxNights: z.number().int().min(2).max(14).default(7),
  /** The most guests the builder offers, only as they state it. */
  maxGuests: z.number().int().min(1).max(12).optional(),
});
const Around = z.object({
  kind: z.literal('around'),
  heading: z.string().min(1),
  places: z.array(z.object({ name: z.string().min(1), distance: z.string().optional(), /** For the ring only: how far, in minutes or kilometres as they state it. */ reach: z.number().positive().optional(), note: z.string().optional(), source: Source })).min(3),
});
const FirstVisit = z.object({
  kind: z.literal('firstVisit'),
  heading: z.string().min(1),
  steps: z.array(z.object({ title: z.string().min(1), text: z.string().min(1), source: Source })).min(3),
});
const Acc = z.object({
  kind: z.literal('acc'),
  heading: z.string().min(1),
  points: z.array(z.object({ title: z.string().min(1), text: z.string().min(1), source: Source })).min(2),
});
export const BODY_AREAS = ['head', 'neck', 'shoulder', 'back', 'hip', 'knee', 'ankle', 'hand', 'whole'] as const;
const Treats = z.object({
  kind: z.literal('treats'),
  heading: z.string().min(1),
  areas: z.array(z.object({ area: z.enum(BODY_AREAS), name: z.string().min(1), source: Source })).min(3),
});

export const Signature = z.discriminatedUnion('kind', [TripBoard, Seasons, Day, Route, Chooser, Conditions, Rooms, Builder, Around, FirstVisit, Acc, Treats]);
export type Signature = z.infer<typeof Signature>;
export type SignatureKind = Signature['kind'];

export const ENGINE_SIGNATURES: Record<EngineName, SignatureKind[]> = {
  fishing: ['tripboard', 'seasons', 'day'],
  paddle: ['route', 'chooser', 'conditions'],
  stay: ['rooms', 'builder', 'around'],
  physio: ['firstVisit', 'acc', 'treats'],
};

const Item = z.object({ name: z.string().min(1), text: z.string().optional(), meta: z.string().optional(), price: z.string().optional(), photo: z.string().optional(), source: Source });

export const EngineConfig = z
  .object({
    engine: z.enum(ENGINES),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    /** The name as the page reads. */
    name: z.string().min(1),
    /** A short form of the name for the mark at the top, where the full one is long. */
    wordmark: z.string().optional(),
    domain: z.string().min(1),
    place: z.object({ town: z.string().min(1), region: z.string().optional(), source: Source }),
    look: z.object({ hero: z.enum(HERO_KINDS), type: z.string(), family: z.enum(PALETTE_FAMILIES) }),
    palette: EnginePalette,
    contact: z.object({
      phone: z.object({ display: z.string().min(1), tel: z.string().regex(/^tel:\+64[2-9]\d{7,9}$/), source: Source }).optional(),
      email: z.object({ address: z.email(), source: Source }).optional(),
      /** Their own booking path, exactly as their site links it. */
      booking: z.object({ href: z.url(), label: z.string().min(1), source: Source }).optional(),
      address: z.object({ text: z.string().min(1), source: Source }).optional(),
      hours: z.object({ rows: z.array(z.object({ label: z.string().min(1), value: z.string().min(1) })).min(1), source: Source }).optional(),
    }),
    hero: z.object({
      /** The headline, a line to each entry, in their own words. */
      lines: z.array(z.string().min(1)).min(1).max(5),
      source: Source,
      sub: Quote.optional(),
      facts: z.array(Fact).max(4).default([]),
      /** The photo for the hero, if a person chose one. Without it, or if it is soft or under 1200 px, the engine chooses their best sharp photo, or sets the typographic hero. */
      photo: z.string().optional(),
      /** For a typographic hero: a photo of theirs shown as an inset. The engine chooses one when this is left out. */
      inset: z.string().optional(),
    }),
    intro: z.object({ heading: z.string().optional(), quote: Quote }).optional(),
    /** A run of their own words for a moving band: the fish they target, the places they go, the rooms they have. */
    band: z.object({ items: z.array(z.string().min(1)).min(3), source: Source }).optional(),
    photos: z.array(PhotoPick).default([]),
    story: z.object({ heading: z.string().min(1), steps: z.array(Step).min(3).max(4) }).optional(),
    signature: Signature.optional(),
    offers: z.object({ heading: z.string().min(1), items: z.array(Item).min(2) }).optional(),
    practical: z.object({ heading: z.string().min(1), items: z.array(z.object({ label: z.string().min(1), text: z.string().min(1), source: Source })).min(2) }).optional(),
    people: z.object({ heading: z.string().min(1), items: z.array(z.object({ name: z.string().min(1), role: z.string().min(1), text: z.string().optional(), photo: z.string().optional(), source: Source })).min(1) }).optional(),
    /** Photos laid out after the signature, in order. Each photo is used once on a page. */
    gallery: z.array(z.string()).default([]),
    close: z.object({ heading: z.string().min(1), line: Quote.optional() }),
  })
  .superRefine((c, ctx) => {
    const pairs = ENGINE_TYPE_PAIRS[c.engine];
    if (!pairs[c.look.type]) ctx.addIssue({ code: 'custom', path: ['look', 'type'], message: `${c.look.type} is not a type pair of the ${c.engine} engine (${Object.keys(pairs).join(', ')})` });
    if (c.signature && !ENGINE_SIGNATURES[c.engine].includes(c.signature.kind)) ctx.addIssue({ code: 'custom', path: ['signature', 'kind'], message: `${c.signature.kind} is not a signature of the ${c.engine} engine` });
    if (!c.contact.booking && !c.contact.phone && !c.contact.email) ctx.addIssue({ code: 'custom', path: ['contact'], message: 'a page needs one of their own ways to book: a booking link, a phone or an email' });
    const ids = new Set(c.photos.map((p) => p.id));
    const named = [c.hero.photo, c.hero.inset, ...(c.story?.steps.map((s) => s.photo) ?? []), ...(c.offers?.items.map((i) => i.photo) ?? []), ...(c.people?.items.map((i) => i.photo) ?? []), ...(c.signature?.kind === 'rooms' ? c.signature.units.map((u) => u.photo) : []), ...c.gallery].filter((x): x is string => !!x);
    for (const id of named) if (!ids.has(id)) ctx.addIssue({ code: 'custom', path: ['photos'], message: `the photo "${id}" is named but not picked` });
    const twice = named.filter((id, i) => named.indexOf(id) !== i);
    if (twice.length) ctx.addIssue({ code: 'custom', path: ['photos'], message: `each photo is used once on a page: ${[...new Set(twice)].join(', ')} appear more than once` });
  });
export type EngineConfig = z.infer<typeof EngineConfig>;
export type EngineConfigInput = z.input<typeof EngineConfig>;

/** The settings as the page reads them: checked, with the hero the photos allow. */
export interface EngineDemo extends EngineConfig {
  heroKind: HeroKind;
  pair: TypePair;
  /** Why the hero differs from the one asked for, when it does. */
  heroNote: string | null;
}

/** How the page looks at a glance, for the variety rules. */
export function engineLook(c: Pick<EngineConfig, 'look'>, heroKind: HeroKind = c.look.hero): { hero: string; type: string; family: string } {
  return { hero: heroKind, type: c.look.type, family: c.look.family };
}
