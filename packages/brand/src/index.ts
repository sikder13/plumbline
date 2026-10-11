import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from 'playwright';
import { paths, utcIso, wordCount, type Db, type Viewport } from '@plumbline/core';
import type { PageCapture } from '@plumbline/render';

const SCRIPT = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'inpage-brand.js'), 'utf8');

export interface BrandColour {
  hex: string;
  role: 'background' | 'text' | 'accent' | 'button';
  share: number;
}

export interface BrandImage {
  url: string;
  alt: string;
  width: number;
  height: number;
}

export interface BrandFonts {
  body: string | null;
  headings: string | null;
  buttons: string | null;
  webFonts: string[];
  sources: string[];
}

export interface VoiceSample {
  quote: string;
  url: string;
}

interface RawBrand {
  logo: { type: 'img' | 'svg'; src: string; markup: string; alt: string } | null;
  colours: BrandColour[];
  fonts: BrandFonts;
  pictures: { hero: (BrandImage & { background: boolean }) | null; others: BrandImage[] };
}

export interface BrandCapture {
  viewport: Viewport;
  logoPath: string | null;
  logoSourceUrl: string | null;
  colours: BrandColour[];
  fonts: BrandFonts;
  hero: BrandImage | null;
  heroPath: string | null;
  images: BrandImage[];
}

const EXT_BY_TYPE: Record<string, string> = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/svg+xml': '.svg', 'image/gif': '.gif', 'image/avif': '.avif', 'image/x-icon': '.ico' };

async function download(page: Page, url: string, dir: string, name: string): Promise<string | null> {
  try {
    const res = await page.context().request.get(url, { timeout: 20_000 });
    if (!res.ok()) return null;
    const type = (res.headers()['content-type'] ?? '').split(';')[0]!.trim();
    const ext = EXT_BY_TYPE[type] ?? (extname(new URL(url).pathname).slice(0, 5) || '.img');
    const body = await res.body();
    if (body.length > 15_000_000) return null;
    const file = join(dir, `${name}${ext}`);
    writeFileSync(file, body);
    return file;
  } catch {
    return null;
  }
}

/** Reads the brand from the live homepage. The visibility helper must already be on the page. */
export async function captureBrand(page: Page, viewport: Viewport, dir: string): Promise<BrandCapture> {
  mkdirSync(dir, { recursive: true });
  const raw = (await page.evaluate(SCRIPT)) as RawBrand;
  let logoPath: string | null = null;
  let logoSourceUrl: string | null = null;
  if (raw.logo?.type === 'svg') {
    logoPath = join(dir, `logo-${viewport}.svg`);
    writeFileSync(logoPath, raw.logo.markup);
    logoSourceUrl = `${page.url()} (inline SVG in the header)`;
  } else if (raw.logo?.src) {
    logoSourceUrl = raw.logo.src;
    if (raw.logo.src.startsWith('data:')) {
      const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(raw.logo.src);
      if (m) {
        logoPath = join(dir, `logo-${viewport}${EXT_BY_TYPE[m[1]!] ?? '.img'}`);
        writeFileSync(logoPath, m[2] ? Buffer.from(m[3]!, 'base64') : decodeURIComponent(m[3]!));
        logoSourceUrl = `${page.url()} (embedded image in the header)`;
      }
    } else {
      logoPath = await download(page, raw.logo.src, dir, `logo-${viewport}`);
    }
  }
  const hero = raw.pictures.hero ? { url: raw.pictures.hero.url, alt: raw.pictures.hero.alt, width: raw.pictures.hero.width, height: raw.pictures.hero.height } : null;
  const heroPath = hero ? await download(page, hero.url, dir, `hero-${viewport}`) : null;
  return {
    viewport,
    logoPath,
    logoSourceUrl,
    colours: raw.colours,
    fonts: raw.fonts,
    hero,
    heroPath,
    images: raw.pictures.others.map((p) => ({ url: p.url, alt: p.alt, width: p.width, height: p.height })),
  };
}

const VALUES = /\b(family|families|local|locals|passion|passionate|love|proud|pride|owned|operated|small groups?|personal|personalised|friendly|care|caring|guarantee|sustainab|conservation|kaitiaki|manaaki|whānau|whanau|heritage|generations?|since|experience[ds]?|safe|safety|unforgettable|unique|authentic|hand[- ]?crafted|award|welcome|believe|promise|mission|story|dream|adventure|home)\b/i;
const FIRST_PERSON = /\b(we|our|us|i|my)\b/i;

/** Short lines, 4 to 15 words, that say what the business stands for. */
export function voiceSamples(pages: PageCapture[], max = 5): VoiceSample[] {
  const scored: { quote: string; url: string; score: number }[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    for (const block of page.blocks) {
      if (block.inNav || block.inFooter) continue;
      for (const sentence of block.text.split(/(?<=[.!?])\s+|\n+/)) {
        const quote = sentence.replace(/\s+/g, ' ').trim();
        const words = wordCount(quote);
        if (words < 4 || words > 15 || /[$@]|\bhttps?:|\d{3,}/.test(quote)) continue;
        const key = quote.toLowerCase();
        if (seen.has(key)) continue;
        let score = 0;
        if (VALUES.test(quote)) score += 2;
        if (FIRST_PERSON.test(quote)) score += 2;
        if (block.heading) score += 1;
        if (score < 3) continue;
        seen.add(key);
        scored.push({ quote, url: page.finalUrl, score });
      }
    }
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, max).map(({ quote, url }) => ({ quote, url }));
}

export function brandDir(slug: string): string {
  return join(paths.brand, slug);
}

export function saveBrandPack(db: Db, businessId: number, desktop: BrandCapture | null, mobile: BrandCapture | null, voice: VoiceSample[]): void {
  const main = desktop ?? mobile;
  if (!main) return;
  const other = main === desktop ? mobile : null;
  const hero = main.hero ?? other?.hero ?? null;
  const images = [...(hero ? [{ ...hero, hero: true }] : []), ...main.images.map((i) => ({ ...i, hero: false }))];
  db.prepare(
    `INSERT INTO brand_packs (business_id, logo_path, logo_source_url, colors, fonts, hero_images, hero_path, voice_samples, captured_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (business_id) DO UPDATE SET logo_path = excluded.logo_path, logo_source_url = excluded.logo_source_url, colors = excluded.colors,
       fonts = excluded.fonts, hero_images = excluded.hero_images, hero_path = excluded.hero_path, voice_samples = excluded.voice_samples, captured_at = excluded.captured_at`,
  ).run(
    businessId,
    main.logoPath ?? other?.logoPath ?? null,
    main.logoSourceUrl ?? other?.logoSourceUrl ?? null,
    JSON.stringify(main.colours),
    JSON.stringify({ desktop: desktop?.fonts ?? null, mobile: mobile?.fonts ?? null }),
    JSON.stringify(images),
    main.heroPath ?? other?.heroPath ?? null,
    JSON.stringify(voice),
    utcIso(),
  );
}
