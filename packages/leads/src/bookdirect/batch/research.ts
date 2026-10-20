import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { HostLimiter, Polite } from '@plumbline/fetch';
import { sharpnessScore } from '@plumbline/preview';
import { BOOK_DIRECT_GAP_MS } from '../discover.ts';
import { Shooter } from '../sweep/browser.ts';
import { allowUrl } from '../sweep/config.ts';
import { crawlPlan, menuItems } from '../sweep/crawl.ts';

export interface SitePhoto {
  file: string;
  url: string;
  alt: string;
  width: number;
  height: number;
  sharpness: number;
  page: string;
}

/** Image addresses a rendered page shows, with the largest each offers: img, srcset and CSS backgrounds. */
const COLLECT = (): { url: string; alt: string; w: number; h: number }[] => {
  const out: { url: string; alt: string; w: number; h: number }[] = [];
  const best = (img: HTMLImageElement) => {
    const set = (img.getAttribute('srcset') ?? img.getAttribute('data-srcset') ?? '')
      .split(',')
      .map((s) => s.trim().split(/\s+/))
      .filter((p) => p[0])
      .map((p) => ({ u: p[0]!, w: parseInt(p[1] ?? '0', 10) || 0 }))
      .sort((a, b) => b.w - a.w)[0];
    return set?.u ?? img.currentSrc ?? img.src ?? img.getAttribute('data-src') ?? '';
  };
  for (const img of [...document.images]) {
    const u = best(img);
    if (u) out.push({ url: new URL(u, location.href).href, alt: img.alt ?? '', w: img.naturalWidth, h: img.naturalHeight });
  }
  for (const el of [...document.querySelectorAll<HTMLElement>('[style*="background"], section, header, div')].slice(0, 4000)) {
    const bg = getComputedStyle(el).backgroundImage;
    const m = /url\(["']?([^"')]+)["']?\)/.exec(bg);
    if (m && !/^data:/.test(m[1]!)) out.push({ url: new URL(m[1]!, location.href).href, alt: '', w: 0, h: 0 });
  }
  return out;
};

const NOT_PHOTO = /logo|icon|favicon|sprite|badge|award|tripadvisor|qualmark|booking\.com|facebook|instagram|google|map|placeholder|spinner|loader|pixel|payment|visa|mastercard|eftpos|afterpay|svg$|\.gif(\?|$)/i;

/**
 * Step 2's raw material for one business: the words of its pages and its own photos. Up to `max`
 * photos are kept, each at most 2000 px wide, scored for sharpness. Only the business's own site is
 * opened; images it shows from a booking engine or a stock host are not taken.
 */
export async function gatherResearch(slug: string, urls: string[], outDir: string, assetsDir: string, opts: { max?: number; log?: (l: string) => void } = {}): Promise<{ texts: { url: string; title: string; text: string }[]; photos: SitePhoto[] }> {
  const polite = new Polite(new HostLimiter(BOOK_DIRECT_GAP_MS));
  const sh = new Shooter(polite);
  const texts: { url: string; title: string; text: string }[] = [];
  const found = new Map<string, { url: string; alt: string; page: string }>();
  mkdirSync(outDir, { recursive: true });
  const queue = [...new Map(urls.filter((u) => !/checkout|cart|my-account/i.test(u)).map((u) => [u.replace(/^https?:\/\//, '').replace(/\/$/, ''), u])).values()];
  try {
    for (let k = 0; k < queue.length; k++) {
      const u = queue[k]!;
      const v = await sh.visit(u, { html: true, collect: COLLECT });
      if (v.error || v.blocked) {
        texts.push({ url: u, title: '', text: `(not read: ${v.error})` });
        continue;
      }
      texts.push({ url: v.finalUrl, title: v.title, text: v.text });
      // A short list is topped up from the rendered homepage's own menu: about, services or rooms, contact.
      if (k === 0 && queue.length < 4 && v.html) {
        for (const t of crawlPlan(v.html, v.finalUrl, menuItems(v.html, v.finalUrl), 8)) {
          const key = t.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
          if (queue.length >= 4 || /checkout|cart|my-account/i.test(t.url) || queue.some((q) => q.replace(/^https?:\/\//, '').replace(/\/$/, '') === key)) continue;
          if (['about', 'services', 'contact', 'book'].includes(t.role)) queue.push(t.url);
        }
      }
      const imgs = (v.collected as ReturnType<typeof COLLECT> | null) ?? [];
      for (const i of imgs) if (!found.has(i.url.split('?')[0]!) && !NOT_PHOTO.test(`${i.url} ${i.alt}`) && allowUrl(i.url)) found.set(i.url.split('?')[0]!, { url: i.url, alt: i.alt, page: v.finalUrl });
    }
  } finally {
    await sh.stop();
  }
  writeFileSync(join(outDir, 'pages.txt'), texts.map((t) => `=== ${t.url}\n${t.title}\n\n${t.text.slice(0, 6000)}\n`).join('\n'));
  // Download, keep the larger ones, cap at 2000 px.
  rmSync(assetsDir, { recursive: true, force: true });
  mkdirSync(assetsDir, { recursive: true });
  const photos: SitePhoto[] = [];
  let n = 0;
  for (const f of found.values()) {
    if (photos.length >= (opts.max ?? 12) * 2) break;
    const buf = await rawImage(polite, f.url);
    if (!buf) continue;
    try {
      const meta = await sharp(buf).metadata();
      if (!meta.width || !meta.height || meta.width < 600 || meta.height < 400) continue;
      const ratio = meta.width / meta.height;
      if (ratio > 4 || ratio < 0.3) continue;
      const file = join(assetsDir, `photo-${String(++n).padStart(2, '0')}.jpg`);
      await sharp(buf).rotate().resize({ width: 2000, withoutEnlargement: true }).jpeg({ quality: 90 }).toFile(file);
      const out = await sharp(file).metadata();
      photos.push({ file, url: f.url, alt: f.alt, width: out.width ?? 0, height: out.height ?? 0, sharpness: await sharpnessScore(file), page: f.page });
    } catch {
      continue;
    }
  }
  // The best `max` by width then sharpness are kept; the rest are removed.
  photos.sort((a, b) => Number(b.sharpness >= 150) - Number(a.sharpness >= 150) || b.width - a.width || b.sharpness - a.sharpness);
  const keep = photos.slice(0, opts.max ?? 12);
  for (const p of photos.slice(opts.max ?? 12)) rmSync(p.file, { force: true });
  writeFileSync(join(outDir, 'photos.json'), JSON.stringify(keep, null, 1));
  opts.log?.(`${slug}: ${texts.length} pages read, ${found.size} images seen, ${keep.length} photos kept (${keep.filter((p) => p.width >= 1200 && p.sharpness >= 300).length} hero-grade)`);
  return { texts, photos: keep };
}

/** One image, as bytes, under robots.txt and the per-host gap. */
async function rawImage(polite: Polite, url: string): Promise<Buffer | null> {
  try {
    if (!(await polite.robots.allows(url))) return null;
    await polite.limiter.acquire(new URL(url).host);
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 PlumblineAudit/1.0 (+https://nahltech.com)' }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}
