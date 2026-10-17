import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { nzTime } from '@plumbline/core';
import { buildPicture } from '../build.ts';
import type { ContentFile, PageData, Picture } from '../types.ts';
import sharp from 'sharp';
import { gradePhoto, heroFor, MIN_SCORE, MIN_WIDTH, sharpnessScore } from './photos.ts';
import { ENGINE_TYPE_PAIRS, EngineConfig, engineLook, type EngineDemo, type HeroKind } from './schema.ts';

/** What the pipeline learnt of each picked photo, and which it chose for the hero and its inset. */
export interface GradedIndex {
  photos: Record<string, { width: number; height: number; score: number; wideAt: string; tallAt: string; bandAt: string | null; phoneQuality?: number }>;
  /** The photo of a photo or split hero, when one qualifies. */
  hero: string | null;
  /** For a typographic hero: their best remaining photo, shown as an inset. */
  inset: string | null;
}

const WIDTHS = { heroWide: [640, 960, 1440, 1920, 2400], heroTall: [480, 750, 960, 1170], heroBand: [480, 750, 1000, 1200, 1600], wide: [640, 960, 1440, 1800], tall: [480, 750, 960] };

/** Every photo the settings place somewhere other than the hero. */
function placed(config: EngineConfig): Set<string> {
  return new Set([...(config.story?.steps.map((s) => s.photo) ?? []), ...(config.offers?.items.map((i) => i.photo) ?? []), ...(config.people?.items.map((i) => i.photo) ?? []), ...(config.signature?.kind === 'rooms' ? config.signature.units.map((u) => u.photo) : []), ...config.gallery].filter((x): x is string => !!x));
}

/**
 * The hero photo: the one the settings name if it is sharp and at least 1200 px wide, otherwise
 * their best such photo not shown elsewhere on the page, full bleed ones first, then the sharpest.
 * With none, the typographic hero gets their best remaining photo as an inset.
 */
export function chooseHero(config: EngineConfig, measured: GradedIndex['photos']): { hero: string | null; inset: string | null } {
  const qualifies = (id: string) => !!measured[id] && measured[id]!.width >= MIN_WIDTH.hero && measured[id]!.score >= MIN_SCORE.hero;
  const elsewhere = placed(config);
  const free = config.photos.map((p) => p.id).filter((id) => !elsewhere.has(id) && measured[id]);
  const rank = (id: string) => {
    const m = measured[id]!;
    return (m.width >= MIN_WIDTH.fullBleed && m.height >= 1080 ? 10 : 0) + Math.min(m.score, 3000) / 1000 + Math.min(m.width, 3000) / 3000;
  };
  const named = config.hero.photo;
  const hero = named && qualifies(named) ? named : (free.filter(qualifies).sort((a, b) => rank(b) - rank(a))[0] ?? null);
  if (hero) return { hero, inset: null };
  const insets = [...(named ? [named] : []), ...free].filter((id) => measured[id]!.width >= MIN_WIDTH.small && measured[id]!.score >= MIN_SCORE.any);
  return { hero: null, inset: insets.sort((a, b) => (a === named ? -1 : b === named ? 1 : rank(b) - rank(a)))[0] ?? null };
}

/**
 * Grades every picked photo into `<media>/graded/` and writes the index the page build reads. Each
 * photo is scored for sharpness first; the hero is chosen on those scores and cut three ways (wide
 * for desktop, tall for a full bleed phone screen, a band for a split hero across a phone). Logs the
 * score of every photo picked.
 */
export async function gradeEnginePhotos(config: EngineConfig, media: string, log: (line: string) => void = () => undefined): Promise<GradedIndex> {
  const out = join(media, 'graded');
  const measured: GradedIndex['photos'] = {};
  for (const pick of config.photos) {
    const file = join(media, pick.file);
    const meta = await sharp(file).rotate().metadata();
    measured[pick.id] = { width: meta.autoOrient?.width ?? meta.width ?? 0, height: meta.autoOrient?.height ?? meta.height ?? 0, score: await sharpnessScore(file), wideAt: '50% 50%', tallAt: '50% 50%', bandAt: null };
  }
  const { hero, inset } = chooseHero(config, measured);
  for (const pick of config.photos) {
    const g = await gradePhoto(config.engine, pick, join(media, pick.file), out, config.palette.deep, pick.id === hero ? 'hero' : 'other');
    measured[pick.id] = { width: g.width, height: g.height, score: g.score, wideAt: g.wideAt, tallAt: g.tallAt, bandAt: g.bandAt };
    const use = g.score < MIN_SCORE.any ? 'soft, not used' : pick.id === hero ? 'hero' : pick.id === inset ? 'inset' : 'page';
    log(`  ${pick.id} ${pick.file} ${g.width}x${g.height} sharpness ${g.score} (${use})`);
  }
  // The phone hero is the page's largest paint: it gets the highest quality that keeps it within its byte budget.
  if (hero && measured[hero]) measured[hero]!.phoneQuality = await phoneQuality(join(out, `${hero}-tall.jpg`), join(out, `${hero}-band.jpg`), measured[hero]!.width >= MIN_WIDTH.fullBleed && measured[hero]!.height >= 1080);
  const index: GradedIndex = { photos: measured, hero, inset };
  writeFileSync(join(out, 'index.json'), JSON.stringify(index, null, 2));
  return index;
}

/** At most this many bytes for the hero at the width a phone fetches (750 px), so it paints in time on a slow connection. */
const PHONE_HERO_BYTES = 54 * 1024;

async function phoneQuality(tall: string, band: string, fullBleed: boolean): Promise<number> {
  const file = fullBleed ? tall : band;
  const sized = await sharp(file).resize({ width: 750, withoutEnlargement: true }).toBuffer();
  for (const q of [42, 40, 38, 36]) {
    const bytes = (await sharp(sized).sharpen({ sigma: 0.55, m1: 0.6, m2: 1.2 }).avif({ quality: q, effort: 5 }).toBuffer()).length;
    if (bytes <= PHONE_HERO_BYTES) return q;
  }
  return 34;
}

function readIndex(media: string): GradedIndex {
  const file = join(media, 'graded', 'index.json');
  if (!existsSync(file)) throw new Error(`${file} does not exist. Grade the photos first (plumb engine grade).`);
  const index = JSON.parse(readFileSync(file, 'utf8')) as GradedIndex;
  if (!index.photos) throw new Error(`${file} was graded by an older engine. Grade the photos again.`);
  return index;
}

/** The hero the photos allow, and why it differs from the one asked for. */
export function resolveHero(config: EngineConfig, index: GradedIndex): { kind: HeroKind; note: string | null } {
  const p = index.hero ? index.photos[index.hero] : undefined;
  return heroFor(config.look.hero, p ? { width: p.width, height: p.height, score: p.score } : null);
}

/** Photos that are soft or smaller than their place on the page are dropped from it, never stretched. */
function usable(config: EngineConfig, index: GradedIndex): Set<string> {
  const ok = new Set<string>();
  for (const pick of config.photos) {
    const p = index.photos[pick.id];
    if (p && p.width >= MIN_WIDTH.small && p.score >= MIN_SCORE.any) ok.add(pick.id);
  }
  return ok;
}

/** The settings as the page reads them. Photos that cannot be shown are taken out, and the sections that named them go without. */
export function engineDemo(config: EngineConfig, index: GradedIndex): EngineDemo {
  const hero = resolveHero(config, index);
  const ok = usable(config, index);
  const keep = (id: string | undefined | null) => (id && ok.has(id) ? id : undefined);
  const c: EngineConfig = {
    ...config,
    hero: { ...config.hero, photo: hero.kind === 'type' ? undefined : (index.hero ?? undefined), inset: hero.kind === 'type' ? keep(index.inset) : undefined },
    story: config.story && { ...config.story, steps: config.story.steps.map((s) => ({ ...s, photo: keep(s.photo) })) },
    offers: config.offers && { ...config.offers, items: config.offers.items.map((i) => ({ ...i, photo: keep(i.photo) })) },
    people: config.people && { ...config.people, items: config.people.items.map((i) => ({ ...i, photo: keep(i.photo) })) },
    gallery: config.gallery.filter((id) => ok.has(id)),
  };
  return { ...c, heroKind: hero.kind, heroNote: hero.note, pair: ENGINE_TYPE_PAIRS[config.engine][config.look.type]! };
}

/**
 * The image entries of the content file: each photo the page shows, as its wide and tall crops. The
 * hero goes under the names the page route preloads: a full bleed hero with a tall phone crop, a
 * split hero with one band crop for both. Every size is sharpened lightly after it is resized.
 */
export function engineImageSpecs(config: EngineConfig, demo: EngineDemo, index: GradedIndex): ContentFile['images'] {
  const images: ContentFile['images'] = {};
  const shown = new Set([...placed(demo), ...(demo.hero.inset ? [demo.hero.inset] : [])]);
  for (const pick of config.photos) {
    const at = index.photos[pick.id];
    if (demo.heroKind !== 'type' && pick.id === demo.hero.photo) {
      if (demo.heroKind === 'photo') {
        images.hero = { file: `graded/${pick.id}-wide.jpg`, alt: pick.alt, widths: WIDTHS.heroWide, quality: 52, position: at?.wideAt, sharpen: true };
        images.heroPhone = { file: `graded/${pick.id}-tall.jpg`, alt: pick.alt, widths: WIDTHS.heroTall, quality: at?.phoneQuality ?? 42, position: at?.tallAt, sharpen: true };
      } else images.hero = { file: `graded/${pick.id}-band.jpg`, alt: pick.alt, widths: WIDTHS.heroBand, quality: at?.phoneQuality ?? 42, position: at?.bandAt ?? undefined, sharpen: true };
      continue;
    }
    if (!shown.has(pick.id)) continue;
    images[pick.id] = { file: `graded/${pick.id}-wide.jpg`, alt: pick.alt, widths: WIDTHS.wide, quality: 50, position: at?.wideAt, sharpen: true };
    images[`${pick.id}Phone`] = { file: `graded/${pick.id}-tall.jpg`, alt: pick.alt, widths: WIDTHS.tall, quality: 50, position: at?.tallAt, sharpen: true };
  }
  return images;
}

/** A content file for the page build, from an engine page's settings and its graded photos. */
export function engineContent(raw: unknown, media: string): ContentFile {
  const config = EngineConfig.parse(raw);
  const index = readIndex(media);
  const demo = engineDemo(config, index);
  return { design: config.engine, wave: true, name: config.name, images: engineImageSpecs(config, demo, index), look: engineLook(config, demo.heroKind), demo };
}

export interface SampleOptions {
  /** Where the business's photos are, with `graded/` beside them. */
  media: string;
  /** Where the page's image files go, and the address they are served under. */
  assets: string;
  urlBase: string;
  reply: { email: string; subject: string; call: string };
  token: string;
}

/** Page data for a sample page: the engine's settings, graded photos, and no findings. Nothing is read from or written to the database. */
export async function buildEngineSample(raw: unknown, opts: SampleOptions): Promise<PageData> {
  const config = EngineConfig.parse(raw);
  const index = readIndex(opts.media);
  const demo = engineDemo(config, index);
  const images: Record<string, Picture> = {};
  for (const [key, spec] of Object.entries(engineImageSpecs(config, demo, index))) images[key] = await buildPicture(join(opts.media, spec.file), join(opts.assets, 'img'), `${opts.urlBase}/img`, key, spec);
  return {
    slug: config.slug,
    token: opts.token,
    path: `${config.slug}-${opts.token}`,
    name: config.name,
    domain: config.domain,
    design: config.engine,
    demo,
    images,
    video: null,
    findings: [],
    strengths: [],
    rating: null,
    secondCheck: null,
    reply: opts.reply,
    builtAtNz: nzTime(new Date()),
  };
}
