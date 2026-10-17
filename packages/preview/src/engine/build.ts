import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { nzTime } from '@plumbline/core';
import { buildPicture } from '../build.ts';
import type { ContentFile, PageData, Picture } from '../types.ts';
import { gradePhoto, heroFor, MIN_WIDTH } from './photos.ts';
import { ENGINE_TYPE_PAIRS, EngineConfig, engineLook, type EngineDemo, type HeroKind } from './schema.ts';

/** What the pipeline learnt of each picked photo, kept beside the graded files. */
export interface GradedIndex {
  [id: string]: { width: number; height: number; sharpness: number | null; wideAt: string; tallAt: string };
}

const WIDTHS = { heroWide: [640, 960, 1440, 1920, 2400], heroTall: [480, 750, 960], wide: [640, 960, 1440, 1800], tall: [480, 750, 960] };

/**
 * Grades every picked photo into `<media>/graded/` and writes the index the page build reads. The
 * hero photo is cut taller for phones. `sharpness` maps a photo file to its measure, where known.
 */
export async function gradeEnginePhotos(config: EngineConfig, media: string, sharpness: Record<string, number> = {}): Promise<GradedIndex> {
  const out = join(media, 'graded');
  const index: GradedIndex = {};
  for (const pick of config.photos) {
    const g = await gradePhoto(config.engine, pick, join(media, pick.file), out, config.palette.deep, pick.id === config.hero.photo ? 'hero' : 'other');
    index[pick.id] = { width: g.width, height: g.height, sharpness: sharpness[pick.file] ?? null, wideAt: g.wideAt, tallAt: g.tallAt };
  }
  writeFileSync(join(out, 'index.json'), JSON.stringify(index, null, 2));
  return index;
}

function readIndex(media: string): GradedIndex {
  const file = join(media, 'graded', 'index.json');
  if (!existsSync(file)) throw new Error(`${file} does not exist. Grade the photos first (plumb engine photos).`);
  return JSON.parse(readFileSync(file, 'utf8')) as GradedIndex;
}

/** The hero the photos allow, and why it differs from the one asked for. */
export function resolveHero(config: EngineConfig, index: GradedIndex): { kind: HeroKind; note: string | null } {
  const id = config.hero.photo;
  const p = id ? index[id] : undefined;
  return heroFor(config.look.hero, p ? { width: p.width, height: p.height, sharpness: p.sharpness ?? undefined } : null);
}

/** Photos smaller than their place on the page are dropped from it, never stretched. */
function usable(config: EngineConfig, index: GradedIndex): Set<string> {
  const ok = new Set<string>();
  for (const pick of config.photos) {
    const p = index[pick.id];
    if (p && p.width >= MIN_WIDTH.small && (p.sharpness === null || p.sharpness >= 0.8)) ok.add(pick.id);
  }
  return ok;
}

/** The settings as the page reads them. Photos that cannot be shown are taken out, and the sections that named them go without. */
export function engineDemo(config: EngineConfig, index: GradedIndex): EngineDemo {
  const hero = resolveHero(config, index);
  const ok = usable(config, index);
  const keep = (id: string | undefined) => (id && ok.has(id) ? id : undefined);
  const c: EngineConfig = {
    ...config,
    hero: { ...config.hero, photo: hero.kind === 'type' ? undefined : keep(config.hero.photo) },
    story: config.story && { ...config.story, steps: config.story.steps.map((s) => ({ ...s, photo: keep(s.photo) })) },
    gallery: config.gallery.filter((id) => ok.has(id)),
  };
  return { ...c, heroKind: hero.kind, heroNote: hero.note, pair: ENGINE_TYPE_PAIRS[config.engine][config.look.type]! };
}

/**
 * The image entries of the content file: each photo the page shows, as its wide and tall crops. The
 * hero goes under the names the page route preloads. A photo the page does not show is not made.
 */
export function engineImageSpecs(config: EngineConfig, demo: EngineDemo, index: GradedIndex): ContentFile['images'] {
  const images: ContentFile['images'] = {};
  const shown = new Set([...(demo.story?.steps.map((s) => s.photo) ?? []), ...(demo.offers?.items.map((i) => i.photo) ?? []), ...(demo.people?.items.map((i) => i.photo) ?? []), ...(demo.signature?.kind === 'rooms' ? demo.signature.units.map((u) => u.photo) : []), ...demo.gallery].filter((x): x is string => !!x));
  for (const pick of config.photos) {
    if (demo.heroKind !== 'type' && pick.id === demo.hero.photo) {
      images.hero = { file: `graded/${pick.id}-wide.jpg`, alt: pick.alt, widths: WIDTHS.heroWide, quality: 50, position: index[pick.id]?.wideAt };
      // A split hero frames the photo on phones too, so it keeps its wide crop there.
      if (demo.heroKind === 'photo') images.heroPhone = { file: `graded/${pick.id}-tall.jpg`, alt: pick.alt, widths: WIDTHS.heroTall, quality: 42, position: index[pick.id]?.tallAt };
      continue;
    }
    if (!shown.has(pick.id)) continue;
    images[pick.id] = { file: `graded/${pick.id}-wide.jpg`, alt: pick.alt, widths: WIDTHS.wide, quality: 48, position: index[pick.id]?.wideAt };
    images[`${pick.id}Phone`] = { file: `graded/${pick.id}-tall.jpg`, alt: pick.alt, widths: WIDTHS.tall, quality: 48, position: index[pick.id]?.tallAt };
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
