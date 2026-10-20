import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as cheerio from 'cheerio';
import { phonesIn } from '@plumbline/collect';
import type { FetchResult, Polite } from '@plumbline/fetch';
import { engineOf, isBookWords } from '../engines.ts';
import { hostOfUrl } from '../filters.ts';
import { pickPages, visibleText, type SitePage } from '../site.ts';

export interface CrawlPage {
  url: string;
  finalUrl: string;
  status: number | null;
  redirects: string[];
  error: string | null;
  contentType: string;
  role: string;
  /** The words of the menu link that led here, when a main-menu item did. */
  label: string;
  inMenu: boolean;
  file: string | null;
  fetchedAt: string;
}

export interface MenuItem {
  label: string;
  url: string;
}

export interface SiteCrawl {
  domain: string;
  website: string;
  at: string;
  /** Every try at the homepage, in order: Google's address, then the other scheme or the bare host. */
  homeTries: CrawlPage[];
  pages: CrawlPage[];
  menu: MenuItem[];
}

const TLS = /CERT|SSL|TLS|SELF_SIGNED|UNABLE_TO_VERIFY|UNABLE_TO_GET_ISSUER|HOSTNAME_MISMATCH|ALTNAME/i;
export const isTlsError = (e: string | null | undefined): boolean => !!e && TLS.test(e);

function abs(href: string, base: string): string | null {
  try {
    const u = new URL(href, base);
    if (!/^https?:$/.test(u.protocol)) return null;
    u.hash = '';
    return u.toString();
  } catch {
    return null;
  }
}

const sameSite = (a: string, b: string) => {
  const x = hostOfUrl(a);
  const y = hostOfUrl(b);
  return !!x && x === y;
};

const NOT_A_PAGE = /\.(pdf|jpe?g|png|gif|webp|svg|docx?|xlsx?|zip|mp4|mp3|ics)(\?|$)/i;

/**
 * The main menu as the homepage's code lays it out: the links of the first navigation block that has
 * at least two links to the site's own pages, outside the footer. The top level comes first.
 */
export function menuItems(html: string, homeUrl: string, max = 24): MenuItem[] {
  const $ = cheerio.load(html);
  const blocks = $('nav, [role="navigation"], header, [class*="menu" i], [id*="menu" i], [class*="nav" i], [id*="nav" i]')
    .toArray()
    .filter((el) => !$(el).closest('footer').length && !/footer/i.test(`${$(el).attr('class') ?? ''} ${$(el).attr('id') ?? ''}`));
  for (const el of blocks) {
    const links = $(el)
      .find('a[href]')
      .toArray()
      .map((a) => ({ label: $(a).text().replace(/\s+/g, ' ').trim(), url: abs($(a).attr('href') ?? '', homeUrl), depth: $(a).parentsUntil(el, 'ul,ol').length }))
      .filter((l): l is { label: string; url: string; depth: number } => !!l.url && !!l.label && l.label.length <= 40 && sameSite(l.url, homeUrl) && !NOT_A_PAGE.test(l.url) && !isEmailProtection(l.url));
    const own = [...new Map(links.map((l) => [l.url.replace(/\/$/, ''), l])).values()].filter((l) => l.url.replace(/\/$/, '') !== homeUrl.replace(/\/$/, ''));
    if (own.length < 2) continue;
    return own
      .sort((a, b) => a.depth - b.depth)
      .slice(0, max)
      .map(({ label, url }) => ({ label, url }));
  }
  return [];
}

/** The menu words the main-menu check cares about: Rooms, Rates, Book, Services, Treatments, Menu, Contact, About. */
export const KEY_MENU = /\b(?:rooms?|accommodation|units|suites|rates|tariffs?|prices?|pricing|fees|book(?:ing|ings)?|reservations?|reserve|services?|treatments?|therapies|menus?|food|contact|get\s+in\s+touch|about|our\s+story|meet\s+the\s+team|enquir(?:e|y|ies))\b/i;

/** A main-menu label the check cares about, in four words or fewer: "Rooms", "Hotel Rooms", "Book Now", "Contact Us". */
export function isKeyMenu(label: string): boolean {
  const t = label.replace(/[^\p{L}\p{N}&\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  return !!t && t.split(' ').length <= 4 && !/email|protected/i.test(label) && KEY_MENU.test(t);
}

/** Cloudflare's hidden-address links answer 404 to anything that does not run the page: never a page or a booking link. */
export const isEmailProtection = (url: string): boolean => /\/cdn-cgi\/l\/email-protection/i.test(url);

const SERVICES = /\b(?:services?|treatments?|rooms?|accommodation|units|suites|menus?|prices?|pricing|rates|tariffs?|classes|timetable)\b/i;

/**
 * The pages to read after the homepage, seven at most: key main-menu items first (Rooms, Rates, Book,
 * Services, Treatments, Menu, Contact, About), then contact, about, book and services pages found
 * anywhere on the homepage, then the rest of the main menu in its own order.
 */
export function crawlPlan(homeHtml: string, homeUrl: string, menu: MenuItem[], max = 7): { url: string; role: string; label: string; inMenu: boolean }[] {
  const out: { url: string; role: string; label: string; inMenu: boolean }[] = [];
  const seen = new Set<string>([homeUrl.replace(/\/$/, '')]);
  const add = (url: string, role: string, label: string, inMenu: boolean) => {
    const key = url.replace(/\/$/, '');
    if (seen.has(key) || out.length >= max) return;
    seen.add(key);
    out.push({ url, role, label, inMenu });
  };
  const roleOf = (label: string, url: string) => {
    const hay = `${label} ${url}`;
    if (/contact|get in touch|enquir|find us/i.test(hay)) return 'contact';
    if (/about|our story|team/i.test(hay)) return 'about';
    if (/book|reserv|availab|appointment/i.test(hay)) return 'book';
    if (SERVICES.test(hay)) return 'services';
    return 'menu';
  };
  for (const m of menu.filter((x) => isKeyMenu(x.label))) add(m.url, roleOf(m.label, m.url), m.label, true);
  const menuUrls = new Map(menu.map((m) => [m.url.replace(/\/$/, ''), m.label]));
  for (const p of pickPages(homeHtml, homeUrl, 6)) add(p.url, p.role, menuUrls.get(p.url.replace(/\/$/, '')) ?? '', menuUrls.has(p.url.replace(/\/$/, '')));
  const $ = cheerio.load(homeHtml);
  $('a[href]').each((_, a) => {
    const url = abs($(a).attr('href') ?? '', homeUrl);
    const text = $(a).text().replace(/\s+/g, ' ').trim();
    if (url && sameSite(url, homeUrl) && !NOT_A_PAGE.test(url) && SERVICES.test(`${text} ${new URL(url).pathname.replace(/[-_/]+/g, ' ')}`)) add(url, 'services', menuUrls.get(url.replace(/\/$/, '')) ?? '', menuUrls.has(url.replace(/\/$/, '')));
  });
  for (const m of menu) add(m.url, roleOf(m.label, m.url), m.label, true);
  return out;
}

const pageOf = (r: FetchResult, role: string, label = '', inMenu = false): CrawlPage => ({
  url: r.url,
  finalUrl: r.finalUrl,
  status: r.status,
  redirects: r.redirects,
  error: r.error ?? null,
  contentType: r.headers['content-type'] ?? '',
  role,
  label,
  inMenu,
  file: null,
  fetchedAt: new Date().toISOString(),
});

const isHtml = (r: FetchResult) => r.status !== null && /<[a-z!]/i.test(r.body.slice(0, 5000)) && !/^(?:image|application\/(?:pdf|json|octet))/i.test(r.headers['content-type'] ?? '');

export interface LoadedSite extends SiteCrawl {
  /** The pages with their HTML, for pages that answered with HTML. */
  html: Map<string, string>;
}

/** Reads one site, eight pages at most, one request a second per host, robots.txt respected. Raw HTML is kept in the cache. */
export async function crawlSite(polite: Polite, c: { domain: string; website: string }, cacheDir: string, opts: { refresh?: boolean } = {}): Promise<LoadedSite> {
  const dir = join(cacheDir, c.domain);
  const index = join(dir, 'pages.json');
  if (!opts.refresh && existsSync(index)) {
    const cached = JSON.parse(readFileSync(index, 'utf8')) as SiteCrawl;
    const html = new Map<string, string>();
    for (const p of [...cached.homeTries, ...cached.pages]) if (p.file && existsSync(join(dir, p.file))) html.set(p.file, readFileSync(join(dir, p.file), 'utf8'));
    return { ...cached, html };
  }
  mkdirSync(dir, { recursive: true });
  const html = new Map<string, string>();
  let n = 0;
  const keep = (page: CrawlPage, r: FetchResult) => {
    if (isHtml(r)) {
      page.file = `${n++}.html`;
      html.set(page.file, r.body);
      writeFileSync(join(dir, page.file), r.body);
    }
    return page;
  };
  const get = (url: string) => polite.get(url, { maxRedirects: 8, timeoutMs: 25_000, maxBytes: 2_500_000 });
  const homeTries: CrawlPage[] = [];
  let website = c.website;
  if (!/^https?:\/\//i.test(website)) website = `http://${website}`;
  let r = await get(website);
  homeTries.push(keep(pageOf(r, 'home'), r));
  const ok = (x: FetchResult) => x.status !== null && x.status >= 200 && x.status < 400 && isHtml(x);
  if (!ok(r) && r.error !== 'robots') {
    const u = new URL(website);
    const alts = [u.pathname.length > 1 ? `${u.protocol}//${u.host}/` : null, `${u.protocol === 'https:' ? 'http:' : 'https:'}//${u.host}/`].filter((x): x is string => !!x);
    for (const alt of alts) {
      r = await get(alt);
      homeTries.push(keep(pageOf(r, 'home'), r));
      if (ok(r)) break;
    }
  }
  const home = homeTries.find((p) => p.file && p.status !== null && p.status < 400) ?? null;
  const pages: CrawlPage[] = [];
  let menu: MenuItem[] = [];
  if (home) {
    const homeHtml = html.get(home.file!)!;
    menu = menuItems(homeHtml, home.finalUrl);
    for (const t of crawlPlan(homeHtml, home.finalUrl, menu)) {
      const x = await get(t.url);
      pages.push(keep(pageOf(x, t.role, t.label, t.inMenu), x));
    }
  }
  const crawl: SiteCrawl = { domain: c.domain, website: c.website, at: new Date().toISOString(), homeTries, pages, menu };
  writeFileSync(index, JSON.stringify(crawl, null, 1));
  return { ...crawl, html };
}

/** The homepage try that answered, if any. */
export function homeOf(site: SiteCrawl): CrawlPage | null {
  return site.homeTries.find((p) => p.file && p.status !== null && p.status < 400) ?? null;
}

/** All pages with HTML, as the relay 01 extractors expect them. */
export function sitePages(site: LoadedSite): SitePage[] {
  const home = homeOf(site);
  const out: SitePage[] = [];
  if (home?.file) out.push({ url: home.url, finalUrl: home.finalUrl, status: home.status, html: site.html.get(home.file) ?? '', role: 'home' });
  for (const p of site.pages) if (p.file && p.status !== null && p.status < 400) out.push({ url: p.url, finalUrl: p.finalUrl, status: p.status, html: site.html.get(p.file) ?? '', role: p.role });
  return out.filter((p) => p.html);
}

export interface BookingLink {
  url: string;
  text: string;
  on: string;
  how: 'link' | 'iframe' | 'form' | 'script';
  engine: string;
  engineKind: string;
}

/** Every booking, appointment or check-availability address on the pages read: Book words, an engine's link, frame or form. */
export function bookingLinks(pages: SitePage[]): BookingLink[] {
  const out = new Map<string, BookingLink>();
  for (const p of pages) {
    const $ = cheerio.load(p.html);
    const add = (raw: string, text: string, how: BookingLink['how']) => {
      if (/^(?:tel|mailto|sms|javascript):/i.test(raw.trim())) return;
      const url = abs(raw, p.finalUrl);
      if (!url || isEmailProtection(url)) return;
      const e = engineOf(url);
      if (e?.kind === 'ota') return;
      const words = how === 'link' && isBookWords(text);
      if (!e && !words) return;
      // A link into the page it sits on is a jump to a section, not a booking address.
      if (!e && url.split('#')[0]!.replace(/\/$/, '') === p.finalUrl.split('#')[0]!.replace(/\/$/, '')) return;
      const key = url.replace(/\/$/, '');
      if (!out.has(key)) out.set(key, { url, text: text.slice(0, 60), on: p.finalUrl, how, engine: e?.name ?? '', engineKind: e?.kind ?? 'words' });
    };
    $('a[href]').each((_, a) => add($(a).attr('href') ?? '', $(a).text().replace(/\s+/g, ' ').trim() || ($(a).attr('aria-label') ?? '') || ($(a).attr('title') ?? ''), 'link'));
    $('iframe[src], iframe[data-src]').each((_, f) => add($(f).attr('src') ?? $(f).attr('data-src') ?? '', '', 'iframe'));
    $('form[action]').each((_, f) => add($(f).attr('action') ?? '', '', 'form'));
  }
  return [...out.values()];
}

/** Outbound links to an online travel agent a visitor can follow: not review badges, not widgets. */
export function otaLinks(pages: SitePage[]): { name: string; url: string; on: string; text: string }[] {
  const out = new Map<string, { name: string; url: string; on: string; text: string }>();
  for (const p of pages) {
    const $ = cheerio.load(p.html);
    $('a[href]').each((_, a) => {
      const url = abs($(a).attr('href') ?? '', p.finalUrl);
      if (!url) return;
      const e = engineOf(url);
      if (e?.kind !== 'ota' || /flexiproduct|[?&]product=rw|\/widget|badge|\/reviews?\b|review/i.test(url)) return;
      if ($(a).find('img').length && !$(a).text().trim() && /review|award|badge|rating/i.test(`${$(a).find('img').attr('alt') ?? ''} ${$(a).find('img').attr('src') ?? ''}`)) return;
      if (!out.has(url)) out.set(url, { name: e.name, url, on: p.finalUrl, text: $(a).text().replace(/\s+/g, ' ').trim().slice(0, 60) });
    });
  }
  return [...out.values()];
}

/** A form that takes dates or guests: the site's own availability search. */
export function hasAvailabilityForm(pages: SitePage[]): string | null {
  for (const p of pages) {
    const $ = cheerio.load(p.html);
    const form = $('form')
      .toArray()
      .find((f) => $(f).find('input[type="date"], input[name*="arriv" i], input[name*="check" i], input[name*="date" i], input[name*="night" i], select[name*="night" i], input[name*="guest" i], select[name*="adult" i], input[name*="adult" i]').length > 0 && !/search|newsletter|subscribe|login/i.test($(f).attr('action') ?? ''));
    if (form) return p.finalUrl;
  }
  return null;
}

/** LinkedIn addresses the site itself links to. */
export function linkedinLinks(pages: SitePage[]): { url: string; on: string }[] {
  const out = new Map<string, { url: string; on: string }>();
  for (const p of pages) {
    const $ = cheerio.load(p.html);
    $('a[href*="linkedin.com" i]').each((_, a) => {
      const url = abs($(a).attr('href') ?? '', p.finalUrl);
      if (!url || !/^https?:\/\/([a-z]{2,3}\.)?(www\.)?linkedin\.com\/(?:company|in|school|showcase)\//i.test(url) || /shareArticle|sharing|share\?/i.test(url)) return;
      const key = url.replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
      if (!out.has(key)) out.set(key, { url: url.replace(/[?#].*$/, ''), on: p.finalUrl });
    });
  }
  return [...out.values()];
}

/** A New Zealand number as its national digits: +64 3 123 4567 and (03) 123 4567 are both 031234567. */
export function nzDigits(raw: string): string {
  let d = raw.replace(/[^\d+]/g, '');
  if (d.startsWith('+64')) d = `0${d.slice(3)}`;
  else if (d.startsWith('0064')) d = `0${d.slice(4)}`;
  else if (d.startsWith('64') && d.length >= 10) d = `0${d.slice(2)}`;
  d = d.replace(/\D/g, '');
  if (d.length >= 8 && !d.startsWith('0')) d = `0${d}`;
  return d;
}

export interface SitePhone {
  shown: string;
  digits: string;
  on: string;
}

/** The numbers a visitor sees on the pages read, and the tel: links, each with its page. */
export function phonesOnSite(pages: SitePage[]): { shown: SitePhone[]; tel: SitePhone[] } {
  const shown = new Map<string, SitePhone>();
  const tel = new Map<string, SitePhone>();
  for (const p of pages) {
    const $ = cheerio.load(p.html);
    $('a[href^="tel:" i]').each((_, a) => {
      const raw = decodeURIComponent(($(a).attr('href') ?? '').slice(4));
      const d = nzDigits(raw);
      if (d.length >= 8 && !tel.has(d)) tel.set(d, { shown: raw.trim(), digits: d, on: p.finalUrl });
    });
    for (const x of phonesIn(visibleText($))) {
      const d = nzDigits(x);
      if (d.length < 8 || d.length > 11 || !/^0[2-9]/.test(d)) continue;
      if (!shown.has(d)) shown.set(d, { shown: x.trim(), digits: d, on: p.finalUrl });
    }
  }
  return { shown: [...shown.values()], tel: [...tel.values()] };
}
