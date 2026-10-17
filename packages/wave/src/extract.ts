import * as cheerio from 'cheerio';
import { foldName, normalizeUrl, sameSite } from '@plumbline/core';
import { BOOKING_SYSTEMS, BOOKING_PLATFORMS, fingerprintUrl, prices } from '@plumbline/collect';
import type { PageCapture } from '@plumbline/render';

/** Everything here reads a saved page and reports what is on it. Deciding what it means is left to a person. */

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

export type TradingFlagKind = 'for sale' | 'closed' | 'under new management' | 'new owners' | 'taking a break';

export interface TradingFlag {
  kind: TradingFlagKind;
  quote: string;
  url: string;
}

/** Things a business sells are "for sale" too. Those sentences say nothing about the business itself. */
const GOODS = /\b(wines?|vouchers?|gifts?|merchandise|prints?|books?|products?|bottles?|honey|oils?|art|paintings?|tickets?|cards?|clothing|gear|equipment|photos?)\b/i;

const TRADING: [TradingFlagKind, RegExp][] = [
  ['for sale', /\bfor sale\b/i],
  ['closed', /\b(?:permanently closed|now closed|closed (?:down|permanently|indefinitely|until further notice)|we (?:are|have) (?:now )?closed|closed for (?:the )?(?:season|winter|summer|business|good)|ceased (?:trading|operating|operations)|no longer (?:operating|trading|running|taking bookings|in business))\b/i],
  ['under new management', /\bunder new (?:management|ownership)\b/i],
  ['new owners', /\bnew owners?\b|\bchanged hands\b|\b(?:has|have) (?:been )?(?:sold|taken over)\b|\b(?:bought|purchased|took over) the (?:business|company|boat|winery|vineyard)\b/i],
  ['taking a break', /\btaking a (?:break|season off|year off)\b|\bon (?:a )?(?:hiatus|sabbatical)\b|\btemporarily (?:closed|unavailable)\b|\bnot (?:operating|running|taking bookings) (?:this|for the|until)\b/i],
];

/** Sentences that say the business is for sale, closed, in new hands or resting. */
export function tradingFlags(page: PageCapture): TradingFlag[] {
  const out: TradingFlag[] = [];
  const seen = new Set<string>();
  for (const b of page.blocks) {
    if (b.inNav) continue;
    for (const quote of sentences(b.text)) {
      for (const [kind, re] of TRADING) {
        if (!re.test(quote) || (kind === 'for sale' && GOODS.test(quote))) continue;
        const key = `${kind}|${quote.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ kind, quote: quote.slice(0, 300), url: page.finalUrl });
      }
    }
  }
  return out;
}

export interface AgencySign {
  kind: 'credit' | 'link' | 'author' | 'platform';
  quote: string;
  /** The name given, or the site linked to. */
  agency: string;
  url: string;
}

const CREDIT = /\b(?:web ?site|site|web ?design|design(?:ed)?|develop(?:ed|ment)|built|created|crafted|made|maintained|hosted|powered)(?: (?:and|&) \w+)? by:?\s+([^\n|©.,]{2,50})/i;
/** Outside the footer only a credit that names the website counts: a boat is also "designed by" someone. */
const SITE_CREDIT = /\b(?:web ?site|site|web ?design)(?: (?:and|&) \w+)? by:?\s+([^\n|©.,]{2,50})/i;
const PLATFORMS = /^(weebly|wix|wix\.com|squarespace|wordpress|wordpress\.com|shopify|rocketspark|godaddy|webflow|jimdo|google sites|square|website world|duda|zyro|webnode|strikingly)$/i;
const NOT_AN_AGENCY_HOST = /(^|\.)(facebook\.com|instagram\.com|twitter\.com|x\.com|youtube\.com|youtu\.be|tiktok\.com|linkedin\.com|pinterest\.[a-z.]+|tripadvisor\.[a-z.]+|google\.[a-z.]+|goo\.gl|newzealand\.com|qualmark\.co\.nz|tiaki\.nz|doc\.govt\.nz|weebly\.com|wix\.com|squarespace\.com|wordpress\.(com|org)|shopify\.com|rocketspark\.[a-z.]+|godaddy\.com)$/i;
const BOOKING_NAMES = new Set([...BOOKING_SYSTEMS, ...BOOKING_PLATFORMS].map((b) => foldName(b.system)));

/**
 * Signs that someone other than the owner builds or maintains the site: a credit, a "site by"
 * link, an author name. A site builder is reported as a platform, which is not an agency.
 */
export function agencySigns(page: PageCapture, html: string): AgencySign[] {
  const url = page.finalUrl;
  const own = foldName(new URL(url).hostname.replace(/^www\./, '').split('.')[0]!);
  const credits: AgencySign[] = [];
  const names = new Set<string>();
  const tail = new Set(page.blocks.slice(-5));
  for (const b of page.blocks) {
    const m = b.inFooter ? CREDIT.exec(b.text) : tail.has(b) ? SITE_CREDIT.exec(b.text) : null;
    if (!m) continue;
    const agency = m[1]!.replace(/\s+/g, ' ').trim();
    if (BOOKING_NAMES.has(foldName(agency)) || names.has(foldName(agency))) continue;
    names.add(foldName(agency));
    credits.push({ kind: PLATFORMS.test(agency) ? 'platform' : 'credit', quote: b.text.replace(/\s+/g, ' ').trim().slice(0, 200), agency, url });
  }
  const links: AgencySign[] = [];
  for (const l of page.links) {
    if (!l.inFooter || !/^https?:/i.test(l.href) || sameSite(l.href, url)) continue;
    const host = new URL(l.href).hostname.replace(/^www\./, '');
    if (NOT_AN_AGENCY_HOST.test(host) || fingerprintUrl(l.href)) continue;
    const text = foldName(l.text);
    const credited = [...names].some((n) => n && text && (n.includes(text) || text.includes(n) || foldName(host).includes(n.replace(/ /g, ''))));
    if (!credited && !SITE_CREDIT.test(l.text)) continue;
    if (!links.some((x) => x.agency === host)) links.push({ kind: 'link', quote: l.text.replace(/\s+/g, ' ').trim(), agency: host, url });
  }
  const authors: AgencySign[] = [];
  if (html) {
    const $ = cheerio.load(html);
    const isOwn = (name: string) => {
      const f = foldName(name).replace(/ /g, '');
      return !f || f === 'admin' || f.includes(own) || own.includes(f);
    };
    const meta = $('meta[name="author" i]').attr('content')?.trim();
    if (meta && !isOwn(meta)) authors.push({ kind: 'author', quote: `meta author: ${meta}`, agency: meta, url });
    const seen = new Set<string>();
    $('a[href*="/author/"]').each((_, a) => {
      const name = /\/author\/([^/?#]+)/.exec($(a).attr('href') ?? '')?.[1];
      if (!name || seen.has(name) || isOwn(name)) return;
      seen.add(name);
      authors.push({ kind: 'author', quote: `author page: /author/${name}/`, agency: name, url });
    });
  }
  return [...credits, ...links, ...authors];
}

/** The address of the largest version of a photo, where the address itself says how to ask for it. */
export function fullSize(url: string): string {
  const wix = /^(https?:\/\/static\.wixstatic\.com\/media\/[^/?#]+)\/v1\//.exec(url);
  if (wix) return wix[1]!;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  if (/(^|\.)squarespace(-cdn)?\.com$/.test(u.hostname)) {
    u.searchParams.set('format', '2500w');
    return u.toString();
  }
  if (/^i\d\.wp\.com$/.test(u.hostname)) {
    for (const p of ['resize', 'fit', 'w', 'h', 'crop', 'quality']) u.searchParams.delete(p);
    return u.toString();
  }
  // WordPress and others name a resized copy "photo-300x200.jpg" beside the original "photo.jpg".
  u.pathname = u.pathname.replace(/-\d{2,4}x\d{2,4}(\.[a-z0-9]{3,4})$/i, '$1');
  return u.toString();
}

function largestOf(srcset: string): string | null {
  let best: { url: string; size: number } | null = null;
  for (const part of srcset.split(/,\s+|,(?=\S+\s+\d)/)) {
    const [url, descriptor] = part.trim().split(/\s+/);
    if (!url || url.startsWith('data:')) continue;
    const size = descriptor ? Number(descriptor.replace(/[wx]$/, '')) * (descriptor.endsWith('x') ? 1000 : 1) : 1;
    if (!best || size >= best.size) best = { url, size };
  }
  return best?.url ?? null;
}

export interface FoundImage {
  /** The address of the largest version. */
  url: string;
  /** The address the page itself used, to fall back on when the largest version is not there. */
  asFound: string;
  alt: string;
  pageUrl: string;
}

/** Every photo in the page source, each at the address of its largest version. Icons and tracking pixels are sorted out later, by size. */
export function imageUrlsIn(html: string, pageUrl: string): FoundImage[] {
  const $ = cheerio.load(html);
  const out = new Map<string, FoundImage>();
  const add = (raw: string | null | undefined, alt: string) => {
    if (!raw || raw.startsWith('data:')) return;
    const absolute = normalizeUrl(raw.trim(), pageUrl);
    if (!absolute || /\.svg(\?|$)/i.test(absolute)) return;
    const url = fullSize(absolute);
    if (!out.has(url)) out.set(url, { url, asFound: absolute, alt: alt.replace(/\s+/g, ' ').trim(), pageUrl });
  };
  $('img, picture source, [style*="background"]').each((_, el) => {
    const e = $(el);
    if (el.tagName === 'source') {
      add(largestOf(e.attr('srcset') ?? e.attr('data-srcset') ?? ''), e.parent().find('img').attr('alt') ?? '');
      return;
    }
    if (el.tagName === 'img') {
      const set = e.attr('srcset') ?? e.attr('data-srcset') ?? '';
      add((set && largestOf(set)) || e.attr('data-src') || e.attr('data-lazy-src') || e.attr('src'), e.attr('alt') ?? '');
      return;
    }
    for (const m of (e.attr('style') ?? '').matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) add(m[1], e.attr('aria-label') ?? '');
  });
  add($('meta[property="og:image"]').attr('content'), '');
  return [...out.values()];
}

export interface FoundVideo {
  url: string;
  kind: 'file' | 'youtube' | 'vimeo' | 'facebook';
  how: 'video on the page' | 'embedded' | 'linked';
  pageUrl: string;
}

function videoAddress(raw: string, pageUrl: string): { url: string; kind: FoundVideo['kind'] } | null {
  const url = normalizeUrl(raw, pageUrl);
  if (!url) return null;
  const u = new URL(url);
  const host = u.hostname.replace(/^www\./, '');
  if (/(^|\.)youtube(-nocookie)?\.com$|^youtu\.be$/.test(host)) {
    const id = host === 'youtu.be' ? u.pathname.slice(1).split('/')[0] : (u.searchParams.get('v') ?? /^\/(?:embed|shorts|live|v)\/([^/?]+)/.exec(u.pathname)?.[1]);
    return id && /^[\w-]{6,}$/.test(id) && id !== 'videoseries' ? { url: `https://www.youtube.com/watch?v=${id}`, kind: 'youtube' } : null;
  }
  if (/(^|\.)vimeo\.com$/.test(host)) {
    const id = /(?:^|\/)(\d{6,})(?:$|[/?])/.exec(u.pathname)?.[1];
    return id ? { url: `https://vimeo.com/${id}`, kind: 'vimeo' } : null;
  }
  if (/(^|\.)facebook\.com$|^fb\.watch$/.test(host)) return host === 'fb.watch' || /\/videos\/|\/watch\/?\?v=|\/reel\//.test(u.pathname + u.search) ? { url, kind: 'facebook' } : null;
  return /\.(mp4|webm|mov|m4v|m3u8)$/i.test(u.pathname) ? { url, kind: 'file' } : null;
}

/** The business's own videos: files played on the page, and YouTube, Vimeo or Facebook videos it embeds or links to. */
export function videosIn(html: string, pageUrl: string): FoundVideo[] {
  const $ = cheerio.load(html);
  const out = new Map<string, FoundVideo>();
  const add = (raw: string | undefined, how: FoundVideo['how'], onlyKind?: FoundVideo['kind']) => {
    const v = raw ? videoAddress(raw, pageUrl) : null;
    if (v && (!onlyKind || v.kind === onlyKind) && !out.has(v.url)) out.set(v.url, { ...v, how, pageUrl });
  };
  $('video, iframe, a[href]').each((_, el) => {
    const e = $(el);
    if (el.tagName === 'video') {
      for (const src of [e.attr('src'), ...e.find('source').map((_i, s) => $(s).attr('src')).get()]) add(src, 'video on the page', 'file');
    } else if (el.tagName === 'iframe') add(e.attr('src') ?? e.attr('data-src'), 'embedded');
    else add(e.attr('href'), 'linked');
  });
  return [...out.values()];
}

export interface BookingLink {
  system: string;
  url: string;
  text: string;
  visible: boolean;
  pageUrl: string;
}

/** Links and embedded frames that lead to a known booking system or booking platform. */
export function bookingLinks(page: PageCapture): BookingLink[] {
  const out = new Map<string, BookingLink>();
  for (const l of page.links) {
    const f = fingerprintUrl(l.href);
    if (f && !out.has(l.href)) out.set(l.href, { system: f.system, url: l.href, text: l.text.replace(/\s+/g, ' ').trim(), visible: l.visible, pageUrl: page.finalUrl });
  }
  for (const src of page.meta.iframes) {
    const f = fingerprintUrl(src);
    if (f && !out.has(src)) out.set(src, { system: f.system, url: src, text: 'embedded on the page', visible: true, pageUrl: page.finalUrl });
  }
  return [...out.values()];
}

export interface PagePrice {
  amount: number;
  text: string;
  context: string;
  pageUrl: string;
}

export function pagePrices(page: PageCapture): PagePrice[] {
  return prices(page).map(({ amount, text, context, pageUrl }) => ({ amount, text, context, pageUrl }));
}

function plain(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/[‘’‚′`]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Whether a page shows these words: in its title, its description or its visible text. */
export function quoteOnPage(page: Pick<PageCapture, 'text' | 'meta'>, quote: string): boolean {
  const wanted = plain(quote);
  if (!wanted) return false;
  return [page.meta.title, page.meta.description ?? '', page.text].some((part) => plain(part).includes(wanted));
}

const PAGE_KINDS: RegExp[] = [
  /\b(about|our story|story|team|meet|who we are|crew|our people|owners?|hosts?|guides?|family|history)\b/i,
  /\b(contact|get in touch|find us|location)\b/i,
  /\b(prices?|pricing|rates?|fares?|costs?|book(ing|ings)?|reservations?)\b/i,
  /\b(tours?|trips?|cruises?|charters?|treks?|rides?|tastings?|cellar door|hire|rentals?|packages?|experiences?|activities|walks?|options|fishing|kayak(s|ing)?|restaurant|stay|accommodation)\b/i,
  /\b(gallery|photos?|videos?|media|faqs?)\b/i,
];

/** The pages of a site that say who runs it, how to reach it, what it sells and for how much. */
export function factPageUrls(home: PageCapture, max = 10): string[] {
  const picked = new Map<string, number>();
  const homeKey = home.finalUrl.replace(/\/$/, '');
  for (const l of home.links) {
    const url = normalizeUrl(l.href);
    if (!url || !sameSite(url, home.finalUrl) || /\.(pdf|jpe?g|png|webp|gif|zip|docx?)(\?|$)/i.test(url)) continue;
    const key = url.replace(/\/$/, '');
    if (key === homeKey || /\/(blog|news|tag|category|author|cart|checkout|my-account|wp-content)\//i.test(`${new URL(url).pathname}/`)) continue;
    const words = `${l.text} ${decodeURIComponent(new URL(url).pathname).replace(/[-_/+.]+/g, ' ')}`;
    const rank = PAGE_KINDS.findIndex((re) => re.test(words));
    if (rank < 0) continue;
    if (!picked.has(key) || picked.get(key)! > rank) picked.set(key, rank);
  }
  return [...picked.entries()].sort((a, b) => a[1] - b[1]).slice(0, max).map(([u]) => u);
}
