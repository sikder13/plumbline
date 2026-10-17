import sharp from 'sharp';

export interface Colour {
  hex: string;
  share: number;
}

const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/**
 * The most common colours of an image, as hex. Colours are grouped by the top four bits of each
 * channel, and a group close to one already chosen is folded into it so the five are distinct.
 * For a logo, near white and transparent pixels are the background and are left out.
 */
export async function dominantColours(image: Buffer, count = 5, opts: { logo?: boolean } = {}): Promise<Colour[]> {
  const { data, info } = await sharp(image).resize(96, 96, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const groups = new Map<number, { n: number; r: number; g: number; b: number }>();
  let total = 0;
  for (let i = 0; i < info.width * info.height; i++) {
    const [r, g, b, a] = [data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!, data[i * 4 + 3]!];
    if (a < 128) continue;
    if (opts.logo && r > 238 && g > 238 && b > 238) continue;
    total += 1;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const grp = groups.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    grp.n += 1;
    grp.r += r;
    grp.g += g;
    grp.b += b;
    groups.set(key, grp);
  }
  const ranked = [...groups.values()].sort((x, y) => y.n - x.n).map((g) => ({ n: g.n, r: g.r / g.n, g: g.g / g.n, b: g.b / g.n }));
  const chosen: { n: number; r: number; g: number; b: number }[] = [];
  for (const c of ranked) {
    const near = chosen.find((k) => Math.hypot(k.r - c.r, k.g - c.g, k.b - c.b) < 48);
    if (near) near.n += c.n;
    else if (chosen.length < count) chosen.push({ ...c });
  }
  return chosen.sort((x, y) => y.n - x.n).map((c) => ({ hex: hex(c.r, c.g, c.b), share: total ? Math.round((c.n / total) * 1000) / 1000 : 0 }));
}
