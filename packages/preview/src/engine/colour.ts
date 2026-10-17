import type { PaletteFamily } from '../types.ts';
import type { EngineName, EnginePalette } from './schema.ts';

/**
 * Colour arithmetic for the engine palettes: contrast as WCAG measures it, and OKLCH, where a
 * colour can be made lighter or darker without its hue drifting.
 */

export type Rgb = [number, number, number];
export interface Oklch {
  l: number;
  c: number;
  h: number;
}

export function parseHex(hex: string): Rgb {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`"${hex}" is not a hex colour`);
  const s = m[1]!.length === 3 ? [...m[1]!].map((c) => c + c).join('') : m[1]!;
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

export function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
}

const lin = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const unlin = (c: number) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map(lin) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The WCAG contrast ratio of two colours, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

export function toOklch(hex: string): Oklch {
  const [r, g, b] = parseHex(hex).map(lin) as Rgb;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = (Math.atan2(B, A) * 180) / Math.PI;
  return { l: L, c: Math.hypot(A, B), h: h < 0 ? h + 360 : h };
}

function oklchToRgb({ l: L, c, h }: Oklch): [number, number, number] {
  const A = c * Math.cos((h * Math.PI) / 180);
  const B = c * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}

/** An OKLCH colour as hex, its chroma lowered until it fits in sRGB. */
export function fromOklch(o: Oklch): string {
  let c = o.c;
  for (let i = 0; i < 40; i++) {
    const rgb = oklchToRgb({ ...o, c });
    if (rgb.every((v) => v >= -0.0005 && v <= 1.0005)) return toHex(rgb.map((v) => unlin(Math.max(0, Math.min(1, v)))) as Rgb);
    c *= 0.9;
  }
  return toHex(oklchToRgb({ ...o, c: 0 }).map((v) => unlin(Math.max(0, Math.min(1, v)))) as Rgb);
}

/** Moves a colour's lightness, keeping its hue, until it reaches the contrast asked for against a ground. */
export function toContrast(hex: string, ground: string, ratio: number): string {
  if (contrastRatio(hex, ground) >= ratio) return hex;
  const o = toOklch(hex);
  const darker = luminance(ground) > 0.18;
  for (let step = 1; step <= 100; step++) {
    const l = darker ? o.l - step * 0.01 : o.l + step * 0.01;
    if (l <= 0 || l >= 1) break;
    const next = fromOklch({ ...o, l });
    if (contrastRatio(next, ground) >= ratio) return next;
  }
  return darker ? '#000000' : '#ffffff';
}

/** What a glance would call a palette, from its accent and its dark ground. */
export function familyOf(accent: string, deep: string): PaletteFamily {
  const a = toOklch(accent);
  const d = toOklch(deep);
  if (d.l < 0.2 && d.c < 0.03 && a.c < 0.06) return 'night';
  if (a.c < 0.05) return d.h >= 200 && d.h < 280 && d.c > 0.02 ? 'alpine' : 'stone';
  const h = a.h;
  if (h >= 70 && h < 110) return 'gold';
  if (h >= 110 && h < 175) return 'forest';
  if (h >= 175 && h < 215) return a.l > 0.7 ? 'alpine' : 'ocean';
  if (h >= 215 && h < 275) return 'ocean';
  if (h >= 275 || h < 20) return 'vine';
  return 'clay';
}

/** How each engine sets its grounds: how light and how tinted the paper is, how dark the deep ground. */
const TEMPER: Record<EngineName, { paper: Oklch; soft: { l: number; c: number }; deep: { l: number; c: number; h?: number; fixed?: boolean }; ink: { l: number; c: number } }> = {
  fishing: { paper: { l: 0.968, c: 0.006, h: 240 }, soft: { l: 0.925, c: 0.018 }, deep: { l: 0.2, c: 0.05, h: 250 }, ink: { l: 0.2, c: 0.03 } },
  paddle: { paper: { l: 0.978, c: 0.01, h: 200 }, soft: { l: 0.935, c: 0.03 }, deep: { l: 0.27, c: 0.05 }, ink: { l: 0.23, c: 0.035 } },
  stay: { paper: { l: 0.965, c: 0.014, h: 80 }, soft: { l: 0.92, c: 0.022 }, deep: { l: 0.25, c: 0.035 }, ink: { l: 0.22, c: 0.02 } },
  // A clinic's dark ground is a calm ink blue whatever the logo: a brown or olive one reads as muddy.
  physio: { paper: { l: 0.985, c: 0.004, h: 220 }, soft: { l: 0.95, c: 0.022 }, deep: { l: 0.26, c: 0.04, h: 252, fixed: true }, ink: { l: 0.22, c: 0.025 } },
};

export interface Swatch {
  hex: string;
  /** How much of the logo or photos it covers, 0 to 1. */
  share: number;
  from: 'logo' | 'site' | 'photo';
}

/**
 * The page's colours from the business's own: the most colourful substantial colour of the logo is
 * the accent (or of the site, or of the photos, in that order), and the grounds are set in its hue.
 * Every pair of words and ground is then moved until it passes AA.
 */
export function paletteFrom(engine: EngineName, swatches: Swatch[], family?: PaletteFamily): EnginePalette {
  const t = TEMPER[engine];
  const vivid = (s: Swatch) => {
    const o = toOklch(s.hex);
    return o.c >= 0.06 && o.l > 0.25 && o.l < 0.85 && s.share >= 0.02;
  };
  const order: Swatch['from'][] = ['logo', 'site', 'photo'];
  let accentSwatch: Swatch | undefined;
  for (const from of order) {
    const pool = swatches.filter((s) => s.from === from && vivid(s)).sort((a, b) => b.share * toOklch(b.hex).c - a.share * toOklch(a.hex).c);
    if (pool[0]) {
      accentSwatch = pool[0];
      break;
    }
  }
  // Their colour, in its own hue, made vivid enough to carry the action: a dusty logo colour reads as a disabled button.
  const own = accentSwatch ? toOklch(accentSwatch.hex) : { l: 0.55, c: 0.12, h: t.deep.h ?? 240 };
  const accentRaw = fromOklch({ l: Math.min(Math.max(own.l, 0.5), 0.72), c: Math.max(own.c, 0.14), h: own.h });
  const a = toOklch(accentRaw);
  // A dark colour of their own, where the logo has one with a hue, sets the deep ground; otherwise the accent's hue does.
  const darkOwn = swatches.filter((s) => s.from !== 'photo' && toOklch(s.hex).l < 0.4 && toOklch(s.hex).c > 0.03).sort((x, y) => y.share - x.share)[0];
  const deepHue = t.deep.fixed ? t.deep.h! : darkOwn ? toOklch(darkOwn.hex).h : (t.deep.h ?? a.h);
  const deep = fromOklch({ l: t.deep.l, c: t.deep.fixed ? t.deep.c : Math.min(t.deep.c, darkOwn ? toOklch(darkOwn.hex).c : t.deep.c), h: deepHue });
  const paper = fromOklch({ l: t.paper.l, c: t.paper.c, h: engine === 'stay' ? t.paper.h : a.h });
  const soft = fromOklch({ l: t.soft.l, c: t.soft.c, h: a.h });
  const ink = toContrast(fromOklch({ l: t.ink.l, c: t.ink.c, h: deepHue }), soft, 7);
  const onDeep = toContrast(fromOklch({ l: 0.96, c: 0.012, h: a.h }), deep, 7);
  // The accent fills buttons. Its words are white or ink, whichever passes; failing both, the accent is deepened until white does.
  let accent = accentRaw;
  let onAccent = contrastRatio('#ffffff', accent) >= 4.5 ? '#ffffff' : contrastRatio(ink, accent) >= 4.5 ? ink : '';
  if (!onAccent) {
    accent = toContrast(accent, '#ffffff', 4.5);
    onAccent = '#ffffff';
  }
  // The accent as a line or words on the light grounds.
  const accentInk = toContrast(toContrast(accent, paper, 4.5), soft, 4.5);
  return {
    family: family ?? familyOf(accent, deep),
    paper,
    ink,
    soft,
    deep,
    onDeep,
    accent,
    onAccent,
    accentInk,
    from: swatches.slice(0, 8).map((s) => `${s.hex} ${s.from} ${(s.share * 100).toFixed(0)}%`),
  };
}

/** Every pair of words and ground the engines use, with its contrast. All must reach 4.5. */
export function paletteChecks(p: EnginePalette): { pair: string; ratio: number; ok: boolean }[] {
  const pairs: [string, string, string][] = [
    ['ink on paper', p.ink, p.paper],
    ['ink on soft', p.ink, p.soft],
    ['onDeep on deep', p.onDeep, p.deep],
    ['onAccent on accent', p.onAccent, p.accent],
    ['accentInk on paper', p.accentInk, p.paper],
    ['accentInk on soft', p.accentInk, p.soft],
  ];
  return pairs.map(([pair, a, b]) => ({ pair, ratio: Math.round(contrastRatio(a, b) * 100) / 100, ok: contrastRatio(a, b) >= 4.5 }));
}
