import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { Polite } from '@plumbline/fetch';
import type { PageCapture } from '@plumbline/render';
import { download, heroEligible, measure, photoKind, type Photo } from '../assets.ts';
import { imageUrlsIn, type FoundImage } from '../extract.ts';
import { dominantColours, type Colour } from './colours.ts';
import { ownWords, type OwnWord } from './words.ts';

export interface ImageOut {
  url: string;
  pageUrl: string;
  alt: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
  kind: Photo['kind'] | null;
  /** Set for the largest twelve, which are saved at full size. */
  file: string | null;
}

export interface AssetsIndex {
  slug: string;
  at: string;
  dir: string;
  images: ImageOut[];
  largest: ImageOut[];
  logo: { file: string | null; sourceUrl: string | null; colours: Colour[]; note: string | null };
  bestPhoto: { url: string; file: string | null; width: number; height: number; colours: Colour[] } | null;
  words: OwnWord[];
}

const KEEP = 12;
const MAX_FETCHED = 100;
const EXT: Record<string, string> = { jpeg: 'jpg', png: 'png', webp: 'webp', avif: 'avif', gif: 'gif' };

export interface HarvestInput {
  polite: Polite;
  slug: string;
  dir: string;
  homeUrl: string;
  pages: PageCapture[];
  htmlOf: (p: PageCapture) => string;
  /** The logo the brand capture saved, if it found one. */
  logo: { path: string | null; sourceUrl: string | null };
  at: string;
}

/** Saves what the design phase works from: every image with its size, the largest twelve in full, the logo, the colours, and the business's own words. */
export async function harvestAssets(input: HarvestInput): Promise<AssetsIndex> {
  const { polite, dir, pages } = input;
  mkdirSync(join(dir, 'images'), { recursive: true });
  const ok = pages.filter((p) => p.ok);
  const homePath = new URL(input.homeUrl).pathname.replace(/\/$/, '');
  const ordered = [...ok.filter((p) => new URL(p.finalUrl).pathname.replace(/\/$/, '') === homePath && p.viewport === 'desktop'), ...ok.filter((p) => !(new URL(p.finalUrl).pathname.replace(/\/$/, '') === homePath && p.viewport === 'desktop'))];

  const found = new Map<string, FoundImage>();
  for (const p of ordered) for (const f of imageUrlsIn(input.htmlOf(p), p.finalUrl)) if (!found.has(f.url)) found.set(f.url, f);

  const photos: Photo[] = [];
  const images: ImageOut[] = [];
  const kept: { photo: Photo; body: Buffer; out: ImageOut }[] = [];
  for (const f of [...found.values()].slice(0, MAX_FETCHED)) {
    let url = f.url;
    let body = await download(polite, url, 25_000_000);
    if (!body && f.asFound !== f.url) {
      url = f.asFound;
      body = await download(polite, url, 25_000_000);
    }
    const out: ImageOut = { url, pageUrl: f.pageUrl, alt: f.alt, width: null, height: null, bytes: body?.length ?? null, kind: null, file: null };
    images.push(out);
    if (!body) continue;
    try {
      const m = await measure(body);
      if (!m.width || !m.height) continue;
      const photo: Photo = { url, pageUrl: f.pageUrl, alt: f.alt, bytes: body.length, ...m, kind: 'photo', file: null };
      photo.kind = photoKind(photo);
      Object.assign(out, { width: m.width, height: m.height, kind: photo.kind });
      photos.push(photo);
      kept.push({ photo, body, out });
      kept.sort((a, b) => b.photo.width * b.photo.height - a.photo.width * a.photo.height);
      if (kept.length > KEEP) kept.length = KEEP;
    } catch {
      // A file that cannot be read as a picture keeps its row without a size.
    }
  }
  for (const [i, k] of kept.entries()) {
    const file = join(dir, 'images', `${String(i + 1).padStart(2, '0')}-${k.photo.width}x${k.photo.height}.${EXT[k.photo.format] ?? 'img'}`);
    writeFileSync(file, k.body);
    k.out.file = file;
  }

  // The logo: the one the brand capture saved, or else an image in the header that says it is one.
  let logo: AssetsIndex['logo'] = { file: null, sourceUrl: input.logo.sourceUrl, colours: [], note: null };
  let logoBytes: Buffer | null = null;
  let logoSource = input.logo.sourceUrl;
  if (input.logo.path && existsSync(input.logo.path)) {
    const file = join(dir, `logo${extname(input.logo.path) || '.img'}`);
    copyFileSync(input.logo.path, file);
    logoBytes = readFileSync(file);
    logo.file = file;
  } else {
    const home = ordered[0];
    const img = home?.images.find((i) => i.inHeader && /logo/i.test(`${i.src} ${i.alt ?? ''}`)) ?? home?.images.find((i) => i.inHeader && i.naturalWidth >= 40);
    if (img) {
      const body = await download(polite, img.currentSrc || img.src, 10_000_000);
      if (body) {
        logoSource = img.currentSrc || img.src;
        const ext = extname(new URL(logoSource).pathname) || '.img';
        logo.file = join(dir, `logo${ext}`);
        writeFileSync(logo.file, body);
        logoBytes = body;
      }
    }
  }
  if (logoBytes) {
    try {
      logo = { ...logo, sourceUrl: logoSource, colours: await dominantColours(logoBytes, 5, { logo: true }) };
    } catch (e) {
      logo.note = `colours not read from the logo: ${(e as Error).message.slice(0, 80)}`;
    }
  } else logo.note = 'no logo found';

  // The best photo: the first one fit for the top of a page, else the largest photograph.
  const best = heroEligible(photos)[0] ?? photos.filter((p) => p.kind === 'photo').sort((a, b) => b.width * b.height - a.width * a.height)[0];
  let bestPhoto: AssetsIndex['bestPhoto'] = null;
  if (best) {
    const saved = kept.find((k) => k.photo === best);
    const body = saved?.body ?? (await download(polite, best.url, 25_000_000));
    bestPhoto = { url: best.url, file: saved?.out.file ?? null, width: best.width, height: best.height, colours: body ? await dominantColours(body, 5).catch(() => []) : [] };
  }

  const index: AssetsIndex = {
    slug: input.slug,
    at: input.at,
    dir,
    images,
    largest: kept.map((k) => k.out),
    logo,
    bestPhoto,
    words: ownWords(ok, input.homeUrl),
  };
  writeFileSync(join(dir, 'assets.json'), JSON.stringify(index, null, 1));
  return index;
}
