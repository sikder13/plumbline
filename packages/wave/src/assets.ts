import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { hostOf } from '@plumbline/core';
import { userAgent, type Polite } from '@plumbline/fetch';
import type { FoundImage, FoundVideo } from './extract.ts';

/** Photos and videos a business already has, measured so the best can be chosen for a page built around them. */

export type PhotoKind = 'photo' | 'logo' | 'map' | 'screenshot' | 'icon' | 'third party';

export interface Measured {
  width: number;
  height: number;
  format: string;
  hasAlpha: boolean;
  /** Spread of a Laplacian over the picture at a common size: higher is crisper. */
  sharpness: number;
  /** How much the tones vary. A flat graphic scores low, a photograph high. */
  entropy: number;
}

export interface Photo extends Measured {
  url: string;
  pageUrl: string;
  alt: string;
  bytes: number;
  kind: PhotoKind;
  /** Where the picture is kept, for the larger ones. */
  file: string | null;
}

export async function measure(image: Buffer): Promise<Measured> {
  const meta = await sharp(image).metadata();
  const stats = await sharp(image).resize({ width: 1024, withoutEnlargement: true }).greyscale().stats();
  return { width: meta.width ?? 0, height: meta.height ?? 0, format: meta.format ?? 'unknown', hasAlpha: !!meta.hasAlpha, sharpness: Math.round(stats.sharpness * 100) / 100, entropy: Math.round(stats.entropy * 100) / 100 };
}

const LOGO = /logo|brand|badge|icon|favicon|sprite|qualmark|trip-?advisor|award|certificate|stamp|emblem|payment|visa|mastercard/i;
const MAP = /(^|[^a-z])maps?([^a-z]|$)|staticmap|location-map|route-map/i;
const SCREENSHOT = /screen[-_ ]?(shot|grab|cap)|mock-?up/i;

/** Widgets, review sites, booking systems, maps and video hosts serve pictures onto a page that are not the business's own. */
const NOT_THEIR_OWN = /(^|\.)(elfsight\.com|tripadvisor\.[a-z.]+|google(usercontent)?\.com|gstatic\.com|googleapis\.com|facebook\.com|fbcdn\.net|cdninstagram\.com|instagram\.com|ytimg\.com|vimeocdn\.com|rezdy\.com|fareharbor\.com|bookme\.co\.nz|qualmark\.co\.nz|newzealand\.com|trustpilot\.com|gravatar\.com|paypal(objects)?\.com|stripe\.com)$/i;

/** What a picture is, from where it is served, its name, its caption and its make-up. Only a photo can go at the top of a page. */
export function photoKind(p: Pick<Photo, 'url' | 'alt' | 'width' | 'height' | 'format' | 'hasAlpha' | 'entropy'>): PhotoKind {
  const words = `${decodeURIComponent(p.url.split('?')[0]!.split('/').slice(-2).join(' '))} ${p.alt}`;
  if (NOT_THEIR_OWN.test(hostOf(p.url) ?? '')) return 'third party';
  if (p.width < 400 && p.height < 400) return 'icon';
  if (SCREENSHOT.test(words)) return 'screenshot';
  if (MAP.test(words)) return 'map';
  if (LOGO.test(words) || p.format === 'gif' || (p.format === 'png' && p.hasAlpha) || p.entropy < 4.5) return 'logo';
  return 'photo';
}

/**
 * The crispness floor only removes pictures that are plainly soft. Calm water and open sky score
 * low however sharp they are, so the last word is a person's, from the sheet.
 */
export const HERO = { minWidth: 1800, minRatio: 1.2, maxRatio: 3.5, minSharpness: 0.8 };

const onHomepage = (p: Photo) => {
  try {
    return new URL(p.pageUrl).pathname.replace(/\/$/, '') === '';
  } catch {
    return false;
  }
};

/**
 * Every photo fit for a full-width opening picture: at least 1800 px wide, wider than tall, crisp,
 * and a photograph rather than a logo, map or screenshot. Those the business shows on its own
 * homepage come first, then the crispest. Which three are best is for a person to say: a crisp
 * photo of a sleeping bag is still a photo of a sleeping bag.
 */
export function heroEligible(photos: Photo[]): Photo[] {
  const seen = new Set<string>();
  return photos
    .filter((p) => p.kind === 'photo' && p.width >= HERO.minWidth && p.width / p.height >= HERO.minRatio && p.width / p.height <= HERO.maxRatio && p.sharpness >= HERO.minSharpness)
    .sort((a, b) => Number(onHomepage(b)) - Number(onHomepage(a)) || b.sharpness - a.sharpness || b.width - a.width)
    .filter((p) => {
      // One photo can be on the site under several addresses.
      const key = `${p.width}x${p.height}:${p.bytes}`;
      return seen.has(key) ? false : !!seen.add(key);
    });
}

/** The first few of those, taken when no person has chosen. */
export function heroCandidates(photos: Photo[], count = 3): Photo[] {
  return heroEligible(photos).slice(0, count);
}

async function download(polite: Polite, url: string, maxBytes: number, range?: string): Promise<Buffer | null> {
  const host = hostOf(url);
  if (!host || !(await polite.robots.allows(url))) return null;
  await polite.limiter.acquire(host);
  try {
    const res = await fetch(url, { headers: { 'user-agent': userAgent('desktop'), accept: '*/*', ...(range ? { range } : {}) }, signal: AbortSignal.timeout(30_000), redirect: 'follow' });
    if (!res.ok) return null;
    const length = Number(res.headers.get('content-length') ?? 0);
    if (!range && length > maxBytes) return null;
    const body = Buffer.from(await res.arrayBuffer());
    return body.length > maxBytes ? null : body;
  } catch {
    return null;
  }
}

const EXT: Record<string, string> = { jpeg: 'jpg', png: 'png', webp: 'webp', avif: 'avif', gif: 'gif' };

/**
 * Fetches each picture once, at its largest, and measures it. A picture whose large version is
 * not there is fetched at the address the page used. Pictures 1200 px wide or more are kept.
 */
export async function collectPhotos(polite: Polite, found: (FoundImage & { asFound?: string })[], dir: string, opts: { max?: number; keepFromWidth?: number } = {}): Promise<Photo[]> {
  const out: Photo[] = [];
  mkdirSync(dir, { recursive: true });
  for (const f of found.slice(0, opts.max ?? 80)) {
    let url = f.url;
    let body = await download(polite, url, 25_000_000);
    if (!body && f.asFound && f.asFound !== f.url) {
      url = f.asFound;
      body = await download(polite, url, 25_000_000);
    }
    if (!body) continue;
    let m: Measured;
    try {
      m = await measure(body);
    } catch {
      continue;
    }
    if (!m.width || !m.height) continue;
    const photo: Photo = { url, pageUrl: f.pageUrl, alt: f.alt, bytes: body.length, ...m, kind: 'photo', file: null };
    photo.kind = photoKind(photo);
    if (m.width >= (opts.keepFromWidth ?? 1200) && photo.kind === 'photo') {
      photo.file = join(dir, `${String(out.length + 1).padStart(3, '0')}.${EXT[m.format] ?? 'img'}`);
      writeFileSync(photo.file, body);
    }
    out.push(photo);
  }
  return out;
}

/**
 * A sheet for a person to choose from by number, two pictures to a row in the order given. Each
 * picture is shown whole, and beside it a piece from its middle at full size, where softness shows.
 */
export async function contactSheet(photos: Photo[], file: string): Promise<string | null> {
  const withFiles = photos.filter((p) => p.file);
  if (!withFiles.length) return null;
  const w = 480;
  const h = 270;
  const side = h;
  const tiles = await Promise.all(
    withFiles.map(async (p) => {
      const whole = await sharp(p.file!).resize(w, h, { fit: 'cover' }).jpeg({ quality: 76 }).toBuffer();
      const piece = await sharp(p.file!).extract({ left: Math.max(0, Math.floor((p.width - side) / 2)), top: Math.max(0, Math.floor((p.height - side) / 2)), width: Math.min(side, p.width), height: Math.min(side, p.height) }).jpeg({ quality: 88 }).toBuffer();
      return { whole, piece };
    }),
  );
  const cell = w + side;
  const cols = Math.min(2, tiles.length);
  const rows = Math.ceil(tiles.length / cols);
  await sharp({ create: { width: cols * cell, height: rows * h, channels: 3, background: '#222' } })
    .composite(tiles.flatMap((t, i) => [{ input: t.whole, left: (i % cols) * cell, top: Math.floor(i / cols) * h }, { input: t.piece, left: (i % cols) * cell + w, top: Math.floor(i / cols) * h }]))
    .jpeg({ quality: 82 })
    .toFile(file);
  return file;
}

export interface VideoInfo extends FoundVideo {
  title: string | null;
  seconds: number | null;
  /** The best picture size on offer: "1080p", or the frame size of a file. */
  quality: string | null;
  bytes: number | null;
  note: string | null;
}

/** Reads the length and frame size from the index of an MP4 file, fetching only the parts that hold it. */
export async function mp4Info(read: (start: number, end: number) => Promise<Buffer | null>): Promise<{ seconds: number | null; width: number | null; height: number | null }> {
  const none = { seconds: null, width: null, height: null };
  let offset = 0;
  for (let i = 0; i < 64; i++) {
    const head = await read(offset, offset + 15);
    if (!head || head.length < 8) return none;
    let size = head.readUInt32BE(0);
    const type = head.toString('latin1', 4, 8);
    if (size === 1 && head.length >= 16) size = Number(head.readBigUInt64BE(8));
    if (type === 'moov') {
      const moov = await read(offset, offset + Math.min(size, 6_000_000) - 1);
      if (!moov) return none;
      const mvhd = moov.indexOf('mvhd', 0, 'latin1');
      let seconds: number | null = null;
      if (mvhd >= 0) {
        const v1 = moov[mvhd + 4] === 1;
        const timescale = moov.readUInt32BE(mvhd + (v1 ? 24 : 16));
        const duration = v1 ? Number(moov.readBigUInt64BE(mvhd + 28)) : moov.readUInt32BE(mvhd + 20);
        seconds = timescale ? Math.round(duration / timescale) : null;
      }
      let width: number | null = null;
      let height: number | null = null;
      for (let at = moov.indexOf('tkhd', 0, 'latin1'); at >= 0; at = moov.indexOf('tkhd', at + 4, 'latin1')) {
        const end = at - 4 + moov.readUInt32BE(at - 4);
        if (end > moov.length || end < at + 8) continue;
        const w = moov.readUInt32BE(end - 8) / 65536;
        const h = moov.readUInt32BE(end - 4) / 65536;
        if (w > (width ?? 0)) [width, height] = [Math.round(w), Math.round(h)];
      }
      return { seconds, width, height };
    }
    if (size < 8) return none;
    offset += size;
  }
  return none;
}

/** The length, title and best picture size given in the source of a YouTube watch page. */
export function youtubeInfo(html: string): { title: string | null; seconds: number | null; quality: string | null } {
  const seconds = /"lengthSeconds":"(\d+)"/.exec(html)?.[1];
  const title = /<meta name="title" content="([^"]*)"/.exec(html)?.[1] ?? /<title>([^<]*)<\/title>/.exec(html)?.[1]?.replace(/ - YouTube$/, '') ?? null;
  const heights = [...html.matchAll(/"qualityLabel":"(\d+)p/g)].map((m) => Number(m[1]));
  return { title: title ? title.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"') : null, seconds: seconds ? Number(seconds) : null, quality: heights.length ? `${Math.max(...heights)}p` : null };
}

/** Looks up what can be learnt about one video without playing it. What cannot be read is left empty, with a note. */
export async function videoDetails(polite: Polite, v: FoundVideo): Promise<VideoInfo> {
  const info: VideoInfo = { ...v, title: null, seconds: null, quality: null, bytes: null, note: null };
  try {
    if (v.kind === 'youtube') {
      const page = await polite.get(v.url, { maxBytes: 3_000_000 });
      if (page.status === 200) Object.assign(info, youtubeInfo(page.body));
      else info.note = page.error === 'robots' ? 'robots.txt does not allow reading the video page' : `the video page answered ${page.status ?? 'nothing'}`;
    } else if (v.kind === 'vimeo') {
      const res = await polite.get(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(v.url)}`);
      if (res.status === 200) {
        const j = JSON.parse(res.body) as { title?: string; duration?: number; width?: number; height?: number };
        Object.assign(info, { title: j.title ?? null, seconds: j.duration ?? null, quality: j.height ? `${j.height}p` : null });
      } else info.note = res.error === 'robots' ? 'robots.txt does not allow reading the video details' : `the video details answered ${res.status ?? 'nothing'}`;
    } else if (v.kind === 'file') {
      const head = await polite.status(v.url);
      if (head.status !== 200) info.note = `the file answered ${head.status ?? 'nothing'}`;
      else if (/\.(mp4|m4v|mov)$/i.test(new URL(v.url).pathname)) {
        const m = await mp4Info((start, end) => download(polite, v.url, 8_000_000, `bytes=${start}-${end}`));
        Object.assign(info, { seconds: m.seconds, quality: m.width && m.height ? `${m.width}x${m.height}` : null });
        if (m.seconds === null) info.note = 'the length could not be read from the file';
      } else info.note = 'the length of this kind of file was not read';
    } else info.note = 'Facebook does not give the length without signing in';
  } catch (e) {
    info.note = `could not be read: ${(e as Error).message.slice(0, 80)}`;
  }
  return info;
}
