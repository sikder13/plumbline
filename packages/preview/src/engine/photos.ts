import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { fromOklch, parseHex, toHex, toOklch, type Swatch } from './colour.ts';
import type { EngineName, HeroKind, PhotoPick } from './schema.ts';

/** The photo pipeline: their best photos picked by size and sharpness, graded to one look, and cut for phones and desktops at their own pixels. */

/**
 * The least width a photo needs for each place. A photo hero needs 1200 px (a phone at 3x is about
 * 1170 px wide); a full bleed one 1800 px. Framed photos inside the page need 640.
 */
export const MIN_WIDTH = { fullBleed: 1800, hero: 1200, framed: 1000, small: 640 } as const;
/** Below this, a photo is plainly soft (the measure of `packages/wave/src/assets.ts`). */
export const MIN_SHARPNESS = 0.8;
/**
 * Sharpness as the variance of a Laplacian over the photo scaled to 800 px wide (`sharpnessScore`).
 * Under 150 a photo is soft and is not used anywhere; a hero needs 300. Sharpness beats size.
 */
export const MIN_SCORE = { any: 150, hero: 300 } as const;

/** The variance of a Laplacian over a greyscale copy 800 px wide: how much fine edge the photo holds. */
export async function sharpnessScore(file: string): Promise<number> {
  const { data } = await sharp(file)
    .rotate()
    .resize({ width: 800, withoutEnlargement: true })
    .greyscale()
    .convolve({ width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0], scale: 1, offset: 128 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let sum = 0;
  let squares = 0;
  for (const v of data) {
    const x = v - 128;
    sum += x;
    squares += x * x;
  }
  const n = data.length || 1;
  return Math.round((squares / n - (sum / n) ** 2) * 10) / 10;
}

export interface Candidate {
  file: string;
  url: string;
  alt: string;
  width: number;
  height: number;
  sharpness: number;
  entropy: number;
  /** Where it may go: a full bleed hero, a framed photo, a small one, or nowhere. */
  fit: 'hero' | 'framed' | 'small' | 'none';
  score: number;
}

/** Their own photos, best first: width counts most, then sharpness, then how much is in the picture. */
export function rankPhotos(photos: { file: string | null; url: string; alt: string; width: number; height: number; sharpness: number; entropy: number; kind: string }[]): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const p of photos) {
    if (!p.file || p.kind !== 'photo') continue;
    // The same photo served at two sizes is one photo.
    const key = `${p.width}x${p.height}:${p.entropy}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const soft = p.sharpness < MIN_SHARPNESS;
    const fit = soft ? 'none' : p.width >= MIN_WIDTH.hero && p.width / p.height >= 1.2 ? 'hero' : p.width >= MIN_WIDTH.framed ? 'framed' : p.width >= MIN_WIDTH.small ? 'small' : 'none';
    // Width decides where a photo may go; the sharpness score, measured when it is graded, can still turn it down.
    const score = Math.min(p.width, 3000) / 3000 + Math.min(p.sharpness, 4) / 8 + p.entropy / 16;
    out.push({ file: p.file, url: p.url, alt: p.alt, width: p.width, height: p.height, sharpness: p.sharpness, entropy: p.entropy, fit, score: Math.round(score * 1000) / 1000 });
  }
  return out.sort((a, b) => b.score - a.score);
}

/**
 * The hero the photo allows. A photo hero is the default: any sharp photo at least 1200 px wide gets
 * one. At 1800 px or wider, and with the height for a phone crop at 2x (1080 px), it may run full
 * bleed; otherwise it is framed in the split hero on desktop and runs the full width of a phone. A
 * soft photo, or none at least 1200 px wide, leaves the typographic hero. `asked` only chooses between
 * full bleed and split where both are allowed; it never turns a photo hero down.
 */
export function heroFor(asked: HeroKind, photo: { width: number; height?: number; score?: number | null } | null): { kind: HeroKind; note: string | null } {
  if (!photo) return { kind: 'type', note: asked === 'type' ? null : 'no photo was chosen for the hero' };
  if (photo.score !== undefined && photo.score !== null && photo.score < MIN_SCORE.hero) return { kind: 'type', note: `the best photo is soft (sharpness ${photo.score}, under ${MIN_SCORE.hero})` };
  if (photo.width < MIN_WIDTH.hero) return { kind: 'type', note: `the best photo is ${photo.width} px wide, under ${MIN_WIDTH.hero}` };
  const fullBleed = photo.width >= MIN_WIDTH.fullBleed && (photo.height === undefined || photo.height >= 1080);
  if (!fullBleed) return { kind: 'split', note: asked === 'photo' ? `the photo is ${photo.width}x${photo.height ?? '?'}: framed on desktop, full width on a phone` : null };
  return { kind: asked === 'split' ? 'split' : 'photo', note: asked === 'type' ? 'a sharp photo at least 1200 px wide: a photo hero is the default' : null };
}

/** One grade per engine, the same for every photo on a page: contrast, saturation, warmth. */
const GRADE: Record<EngineName, { contrast: number; saturation: number; brightness: number; warmth: number; tint: number }> = {
  fishing: { contrast: 1.08, saturation: 0.94, brightness: 1.0, warmth: -0.02, tint: 0.07 },
  paddle: { contrast: 1.04, saturation: 1.02, brightness: 1.03, warmth: 0, tint: 0.05 },
  stay: { contrast: 1.04, saturation: 0.92, brightness: 1.02, warmth: 0.035, tint: 0.06 },
  physio: { contrast: 1.03, saturation: 0.9, brightness: 1.04, warmth: 0.01, tint: 0.04 },
};

export interface Cut {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The largest crop of the given shape that holds the focus point as near its middle as the photo allows. */
export function cropAround(width: number, height: number, ratio: number, focus: [number, number]): Cut {
  let w = width;
  let h = Math.round(width / ratio);
  if (h > height) {
    h = height;
    w = Math.round(height * ratio);
  }
  const left = Math.round(Math.max(0, Math.min(width - w, focus[0] * width - w / 2)));
  const top = Math.round(Math.max(0, Math.min(height - h, focus[1] * height - h / 2)));
  return { left, top, width: w, height: h };
}

/** The shapes a photo is cut to. The hero's phone crop is close to the box it fills, about square, so no pixel is sent that is not shown. */
export const SHAPES = { heroWide: 16 / 9, heroTall: 4 / 5, heroBand: 4 / 3, wide: 3 / 2, tall: 4 / 5 } as const;

export interface Graded {
  id: string;
  wide: string;
  tall: string;
  /** For a hero only: the crop a split hero runs across a phone's full width. */
  band: string | null;
  width: number;
  height: number;
  /** Where the focus point falls inside each crop, as CSS object-position. */
  wideAt: string;
  tallAt: string;
  bandAt: string | null;
  /** The sharpness score of the source, from `sharpnessScore`. */
  score: number;
}

function at(cut: Cut, width: number, height: number, focus: [number, number]): string {
  const x = Math.max(0, Math.min(1, (focus[0] * width - cut.left) / cut.width));
  const y = Math.max(0, Math.min(1, (focus[1] * height - cut.top) / cut.height));
  return `${Math.round(x * 100)}% ${Math.round(y * 100)}%`;
}

/**
 * Grades one photo and writes its two crops as high quality JPEGs, from which the page's AVIF and
 * WebP sizes are made. A crop is never enlarged: its pixels are the photo's own.
 */
export async function gradePhoto(engine: EngineName, pick: PhotoPick, source: string, outDir: string, deep: string, role: 'hero' | 'other'): Promise<Graded> {
  if (!existsSync(source)) throw new Error(`photo ${source} does not exist`);
  mkdirSync(outDir, { recursive: true });
  const g = GRADE[engine];
  const meta = await sharp(source).rotate().metadata();
  const width = meta.autoOrient?.width ?? meta.width ?? 0;
  const height = meta.autoOrient?.height ?? meta.height ?? 0;
  const wide = join(outDir, `${pick.id}-wide.jpg`);
  const tall = join(outDir, `${pick.id}-tall.jpg`);
  const made = `${source}|${statSync(source).mtimeMs}|${JSON.stringify(pick.focus)}|${deep}|${role}|${JSON.stringify(g)}|${JSON.stringify(SHAPES)}`;
  const madeFile = join(outDir, `${pick.id}.made`);

  const [r, gg, b] = parseHex(deep);
  const graded = async () => {
    // Contrast about the middle grey, a little less colour, a touch of warmth or cool, then the page's deep colour laid softly into the shadows.
    const base = sharp(source)
      .rotate()
      .linear(g.contrast, -(128 * (g.contrast - 1)))
      .modulate({ saturation: g.saturation, brightness: g.brightness })
      .recomb([
        [1 + g.warmth, 0, 0],
        [0, 1, 0],
        [0, 0, 1 - g.warmth],
      ]);
    const buf = await base.toBuffer();
    return sharp(buf).composite([{ input: { create: { width, height, channels: 4, background: { r, g: gg, b, alpha: g.tint } } }, blend: 'soft-light' }]);
  };
  const shapes = role === 'hero' ? [SHAPES.heroWide, SHAPES.heroTall] : [SHAPES.wide, SHAPES.tall];
  const [wideCut, tallCut] = shapes.map((ratio) => cropAround(width, height, ratio, pick.focus)) as [Cut, Cut];
  // A photo already close to the wide shape keeps all of itself.
  const wideKeep = Math.abs(width / height - shapes[0]!) < 0.18 ? { left: 0, top: 0, width, height } : wideCut;
  const bandCut = role === 'hero' ? cropAround(width, height, SHAPES.heroBand, pick.focus) : null;
  const bandFile = role === 'hero' ? join(outDir, `${pick.id}-band.jpg`) : null;
  const score = await sharpnessScore(source);
  const result: Graded = { id: pick.id, wide, tall, band: bandFile, width, height, wideAt: at(wideKeep, width, height, pick.focus), tallAt: at(tallCut, width, height, pick.focus), bandAt: bandCut ? at(bandCut, width, height, pick.focus) : null, score };
  if (existsSync(madeFile) && readFileSync(madeFile, 'utf8') === made && existsSync(wide) && existsSync(tall) && (!bandFile || existsSync(bandFile))) return result;
  const full = await (await graded()).toBuffer();
  await sharp(full).extract(wideKeep).jpeg({ quality: 92, mozjpeg: true }).toFile(wide);
  await sharp(full).extract(tallCut).jpeg({ quality: 92, mozjpeg: true }).toFile(tall);
  if (bandCut && bandFile) await sharp(full).extract(bandCut).jpeg({ quality: 92, mozjpeg: true }).toFile(bandFile);
  writeFileSync(madeFile, made);
  return result;
}

/** The colours of a picture, biggest share first: colourful ones by hue, the rest by lightness. Transparent pixels are left out. */
export async function swatchesOf(file: string, from: Swatch['from']): Promise<Swatch[]> {
  const { data, info } = await sharp(file).rotate().resize(96, 96, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bins = new Map<string, { n: number; r: number; g: number; b: number }>();
  let total = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3]! < 200) continue;
    const [r, g, b] = [data[i]!, data[i + 1]!, data[i + 2]!];
    const o = toOklch(toHex([r, g, b]));
    const key = o.c >= 0.04 ? `h${Math.floor(o.h / 20)}l${Math.floor(o.l / 0.2)}` : `n${Math.floor(o.l / 0.12)}`;
    const bin = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bin.n++;
    bin.r += r;
    bin.g += g;
    bin.b += b;
    bins.set(key, bin);
    total++;
  }
  if (!total) return [];
  return [...bins.values()]
    .map((x) => ({ hex: toHex([x.r / x.n, x.g / x.n, x.b / x.n]), share: x.n / total, from }))
    .filter((s) => s.share >= 0.01)
    .sort((a, b) => b.share - a.share);
}

/** A colour for a photo's empty frame while it loads: its average, a little darker. */
export function placeholderOf(hex: string): string {
  const o = toOklch(hex);
  return fromOklch({ ...o, l: Math.max(0.2, o.l - 0.08) });
}
