import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { previewPaths } from './paths.ts';
import { HERO_VARIANTS, PALETTE_FAMILIES, TYPE_PAIRS, type ContentFile, type Recipe, type Section } from './types.ts';

const colour = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'a colour is written as #rrggbb');
const text = z.string().trim().min(1);
const item = z.object({ image: text.optional(), name: text, meta: text.optional(), price: text.nullable().optional(), text: text.optional(), href: text.optional() });
const image = z.object({ file: text, alt: z.string(), widths: z.array(z.number()).optional(), position: text.optional(), quality: z.number().min(20).max(60).optional(), crop: z.object({ left: z.number(), top: z.number(), width: z.number(), height: z.number() }).optional() });

const section = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('hero'), variant: z.enum(HERO_VARIANTS), place: text, lines: z.array(text).min(1).max(4), sub: text.optional(), note: text.optional(), align: z.enum(['low', 'high', 'centre']).optional(), panel: z.enum(['arch', 'strip', 'tall', 'round']).optional(), ambience: z.enum(['film', 'drift', 'still']).optional(), ground: z.enum(['paper', 'soft', 'deep']).optional(), scale: z.number().min(0.6).max(1.3).optional(), scaleWide: z.number().min(0.6).max(1.3).optional(), treat: z.enum(['duotone']).optional() }),
  z.object({ kind: z.literal('story'), variant: z.enum(['wipe', 'stack', 'rail', 'words']), id: text.optional(), subject: text, heading: text, steps: z.array(z.object({ image: text.optional(), label: text, text })).min(3, 'a pinned story has three to five steps').max(5, 'a pinned story has three to five steps') }),
  z.object({ kind: z.literal('rows'), variant: z.enum(['tall', 'wide', 'plain', 'round']), id: text.optional(), heading: text, lead: text.optional(), button: text.optional(), cue: text, items: z.array(item).min(1) }),
  z.object({ kind: z.literal('wipes'), variant: z.enum(['pair', 'band', 'trio']), images: z.array(text).min(1).max(3), heading: text.optional(), text: text.optional() }),
  z.object({ kind: z.literal('numbers'), variant: z.enum(['row', 'band', 'list']), heading: text.optional(), items: z.array(z.object({ value: text, label: text, source: text.optional() })).min(1).max(4) }),
  z.object({ kind: z.literal('words'), variant: z.enum(['quote', 'letter', 'columns']), id: text.optional(), heading: text.optional(), quote: text.optional(), paragraphs: z.array(text), names: text.optional(), image: text.optional() }),
  z.object({ kind: z.literal('list'), variant: z.enum(['ruled', 'questions', 'steps']), id: text.optional(), heading: text, lead: text.optional(), items: z.array(item).min(1) }),
  z.object({ kind: z.literal('visit'), variant: z.enum(['card', 'split', 'plain']), id: text.optional(), heading: text, address: z.array(text).min(1), hours: z.array(z.object({ label: text, value: text })).optional(), notes: z.array(text).optional(), image: text.optional() }),
]);

const schema = z.object({
  brief: z.object({ mood: text, headline: text, hero: text, story: text, patterns: z.array(text) }),
  name: text.optional(),
  palette: z.object({ family: z.enum(PALETTE_FAMILIES), paper: colour, ink: colour, soft: colour, deep: colour, onDeep: colour, accent: colour, onAccent: colour }),
  type: z.enum(TYPE_PAIRS),
  action: z.object({ label: text, href: text, variant: z.enum(['pill', 'dock', 'stack']) }),
  call: z.object({ tel: text, display: text }),
  email: z.string().email(),
  nav: z.array(z.object({ label: text, href: text })),
  images: z.record(z.string(), image),
  video: z.object({ file: text }).optional(),
  strengths: z.array(z.object({ text, source: text })).optional(),
  sections: z.array(section).min(1),
});

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** How far apart two colours are for a reader, from 1 (the same) to 21 (black on white). */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** Words on each ground a page uses must be readable: the contrast a small line of text needs. */
const READABLE = 4.5;

/** The images a section names, whatever its kind. */
function imagesIn(s: Section): string[] {
  if (s.kind === 'wipes') return s.images;
  if (s.kind === 'story') return s.steps.flatMap((x) => (x.image ? [x.image] : []));
  if (s.kind === 'rows' || s.kind === 'list') return s.items.flatMap((x) => (x.image ? [x.image] : []));
  if (s.kind === 'words' || s.kind === 'visit') return s.image ? [s.image] : [];
  return [];
}

/** Everything wrong with a recipe, in words. An empty list means it can be built. */
export function checkRecipe(input: unknown): string[] {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return parsed.error.issues.map((i) => `${i.path.join('.') || 'recipe'}: ${i.message}`);
  const r = parsed.data as Recipe;
  const out: string[] = [];
  const p = r.palette;
  for (const [words_, ground, name] of [[p.ink, p.paper, 'ink on paper'], [p.ink, p.soft, 'ink on soft'], [p.onDeep, p.deep, 'onDeep on deep'], [p.onAccent, p.accent, 'onAccent on accent']] as const) {
    const c = contrast(words_, ground);
    if (c < READABLE) out.push(`${name} has a contrast of ${c.toFixed(1)}; ${READABLE} is needed`);
  }
  if (words(r.brief.mood.replace(/,/g, ' ')) !== 3) out.push('the mood is three words');
  if (r.brief.patterns.length !== 3) out.push('the brief names three layout patterns');
  const heroes = r.sections.filter((s) => s.kind === 'hero');
  if (heroes.length !== 1 || r.sections[0]!.kind !== 'hero') out.push('one hero, and it comes first');
  for (const h of heroes) {
    const n = words(h.lines.join(' '));
    if (n > 5) out.push(`the headline is ${n} words; five at most`);
  }
  if (r.sections.filter((s) => s.kind === 'story').length > 1) out.push('one pinned story a page');
  if (!r.images.hero) out.push('no image called "hero"');
  for (const s of r.sections) for (const key of imagesIn(s)) if (!r.images[key]) out.push(`${s.kind} names an image "${key}" that the recipe does not list`);
  const ids = new Set(['top', ...r.sections.flatMap((s) => ('id' in s && s.id ? [s.id] : []))]);
  for (const n of r.nav) if (!n.href.startsWith('#') || !ids.has(n.href.slice(1))) out.push(`the menu links to ${n.href}, which no section carries`);
  if (!/^(https:\/\/|mailto:|tel:\+64)/.test(r.action.href)) out.push(`the action must open a web address, an email or a phone number, not "${r.action.href}"`);
  if (!/^tel:\+64[2-9]\d{7,9}$/.test(r.call.tel)) out.push(`the phone number ${r.call.tel} is not in the form tel:+64...`);
  return out;
}

export function recipeFile(slug: string): string {
  return join(previewPaths.root, 'recipes', `${slug}.json`);
}

/** The businesses that have a recipe. */
export function recipeSlugs(): string[] {
  const dir = join(previewPaths.root, 'recipes');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
}

/** Reads a recipe and refuses one that does not hold together. */
export function loadRecipe(slug: string): Recipe {
  const file = recipeFile(slug);
  if (!existsSync(file)) throw new Error(`${file} does not exist`);
  const recipe = JSON.parse(readFileSync(file, 'utf8')) as unknown;
  const problems = checkRecipe(recipe);
  if (problems.length) throw new Error(`${slug}: the recipe is refused. ${problems.join('; ')}`);
  return recipe as Recipe;
}

/** A recipe as the build reads any page: its photos and film to prepare, and the rest for the recipe design to lay out. */
export function recipeContent(recipe: Recipe): ContentFile {
  return { design: 'recipe', name: recipe.name, images: recipe.images, video: recipe.video, strengths: recipe.strengths, demo: recipe };
}

export function lookOf(recipe: Recipe): { hero: string; type: string; family: string } {
  const hero = recipe.sections.find((s) => s.kind === 'hero');
  return { hero: hero?.variant ?? 'none', type: recipe.type, family: recipe.palette.family };
}

/** The page as a sequence of sections and their variants. */
export function layoutOf(recipe: Recipe): string {
  return recipe.sections.map((s) => `${s.kind}:${s.variant}`).join(' > ');
}

export interface Placed {
  slug: string;
  /** The kinds and places a business shares with others, such as "wineries" or "Kaikōura". */
  groups: string[];
  recipe: Recipe;
}

/**
 * The variety rules for a wave. No two pages share a hero, a type pair and a palette family. Two
 * businesses of one kind or one place may share one of the three and never two. And no page is
 * laid out like a wave 1 page.
 */
export function varietyIssues(pages: Placed[], wave1: { name: string; layout: string }[]): string[] {
  const out: string[] = [];
  const named = (a: ReturnType<typeof lookOf>, shared: string[]) => shared.map((k) => (k === 'hero' ? `a hero (${a.hero})` : k === 'type' ? `a type pair (${a.type})` : `a palette family (${a.family})`));
  const join3 = (parts: string[]) => (parts.length === 3 ? `${parts[0]}, ${parts[1]} and ${parts[2]}` : parts.join(' and '));
  for (const [i, a] of pages.entries()) {
    for (const b of pages.slice(i + 1)) {
      const [la, lb] = [lookOf(a.recipe), lookOf(b.recipe)];
      const shared = (['hero', 'type', 'family'] as const).filter((k) => la[k] === lb[k]);
      const group = a.groups.find((g) => b.groups.includes(g));
      if (shared.length === 3) out.push(`${a.slug} and ${b.slug} share ${join3(named(la, shared))}`);
      else if (group && shared.length === 2) out.push(`${a.slug} and ${b.slug} are both ${group} and must differ at a glance: they share ${join3(named(la, shared))}`);
    }
    const layout = layoutOf(a.recipe);
    const twin = wave1.find((w) => w.layout === layout);
    if (twin) out.push(`${a.slug} is laid out like the wave 1 page for ${twin.name} (${layout})`);
  }
  return out;
}

/** The wave 1 pages, each with a design of its own, set down as the nearest sequence of library sections. */
export const WAVE1_LAYOUTS: { name: string; layout: string }[] = [
  { name: 'waterline', layout: 'hero:photo > story:wipe > rows:tall > wipes:band > words:letter > list:questions > visit:card' },
  { name: 'label', layout: 'hero:photo > story:stack > wipes:pair > list:ruled > rows:wide > words:letter > visit:split' },
  { name: 'journal', layout: 'hero:photo > list:ruled > words:letter > numbers:band > story:rail > visit:plain' },
  { name: 'coastal', layout: 'hero:photo > story:rail > rows:wide > words:letter > list:steps > visit:plain' },
];

export type Batches = Record<string, string[]>;

/** The order the pages of a wave are built in, and the kinds and places each business shares with others: previews/batches.json. */
export interface WavePlan {
  batches: Batches;
  groups: Record<string, string[]>;
}

export function loadPlan(): WavePlan {
  const file = join(previewPaths.root, 'batches.json');
  if (!existsSync(file)) throw new Error(`${file} does not exist. It holds the build order and the groups for the variety check.`);
  return JSON.parse(readFileSync(file, 'utf8')) as WavePlan;
}

/**
 * The pages a deploy carries: every built page that has a design of its own, and the built recipe
 * pages of the batches named. A recipe page of a later batch may be built already, to be looked
 * at, and is left out until its batch passes.
 */
export function pagesToPublish(built: string[], designed: string[], order: Batches, batches: string[]): string[] {
  const wanted = new Set(designed);
  for (const b of batches) {
    if (!order[b]) throw new Error(`previews/batches.json names no batch ${b}`);
    for (const slug of order[b]) wanted.add(slug);
  }
  return built.filter((slug) => wanted.has(slug)).sort();
}

export function batchOf(order: Batches, slug: string): string | null {
  return Object.entries(order).find(([, slugs]) => slugs.includes(slug))?.[0] ?? null;
}
