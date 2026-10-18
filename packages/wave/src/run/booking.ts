import * as cheerio from 'cheerio';
import { domainOf } from '@plumbline/core';
import { fingerprintHost } from '@plumbline/collect';
import type { Polite } from '@plumbline/fetch';
import type { PageCapture } from '@plumbline/render';
import { sameAddress } from '../pages.ts';

export interface SystemHit {
  system: string;
  kind: 'system' | 'platform' | 'form' | 'builder';
  how: 'link' | 'iframe' | 'script' | 'html';
  url: string;
  pageUrl: string;
}

/** Booking systems recognised in a page's source by what they put there. Hosts are matched on every link, frame and script address. */
const HTML_SIGNS: { system: string; kind: SystemHit['kind']; test: RegExp }[] = [
  { system: 'Rezdy', kind: 'system', test: /rezdy\.com/i },
  { system: 'FareHarbor', kind: 'system', test: /fareharbor\.com/i },
  { system: 'Checkfront', kind: 'system', test: /checkfront\.(?:com|co\.uk)/i },
  { system: 'Bookeo', kind: 'system', test: /bookeo\.com/i },
  { system: 'Little Hotelier', kind: 'system', test: /littlehotelier\.com|thebookingbutton\.com|direct-book\.com/i },
  { system: 'Bookit', kind: 'system', test: /bookit\.(?:co\.nz|com)/i },
  { system: 'ResOnline', kind: 'system', test: /resonline\.com/i },
  { system: 'SiteMinder', kind: 'system', test: /siteminder\.com/i },
  { system: 'Cliniko', kind: 'system', test: /cliniko\.com/i },
  { system: 'Gensolve', kind: 'system', test: /gensolve\.(?:com|co\.nz|net)/i },
  { system: 'Squarespace Scheduling', kind: 'system', test: /squarespacescheduling\.com|acuityscheduling\.com|squarespace\.com\/schedul/i },
  { system: 'FishingBooker', kind: 'platform', test: /fishingbooker\.com/i },
  { system: 'Bookme', kind: 'platform', test: /bookme\.co\.nz/i },
  { system: 'Airbnb', kind: 'platform', test: /airbnb\.(?:com|co\.nz)/i },
  { system: 'Booking.com', kind: 'platform', test: /booking\.com\/hotel/i },
  { system: 'Rafting Bookings', kind: 'system', test: /raftingbookings\.co\.nz/i },
  { system: 'Wufoo form', kind: 'form', test: /wufoo\.com/i },
  { system: 'Jotform', kind: 'form', test: /jotform\.com/i },
  { system: 'Google Forms', kind: 'form', test: /docs\.google\.com\/forms|forms\.gle/i },
];

export function bookingSystemsIn(sources: { url: string; html: string }[]): SystemHit[] {
  const hits: SystemHit[] = [];
  const seen = new Set<string>();
  const add = (system: string, kind: SystemHit['kind'], how: SystemHit['how'], url: string, pageUrl: string) => {
    if (seen.has(system)) return;
    seen.add(system);
    hits.push({ system, kind, how, url: url.slice(0, 200), pageUrl });
  };
  for (const { url: pageUrl, html } of sources) {
    const $ = cheerio.load(html);
    const refs: { value: string; how: SystemHit['how'] }[] = [
      ...$('a[href]').toArray().map((e) => ({ value: $(e).attr('href') ?? '', how: 'link' as const })),
      ...$('iframe[src], iframe[data-src]').toArray().map((e) => ({ value: $(e).attr('src') ?? $(e).attr('data-src') ?? '', how: 'iframe' as const })),
      ...$('script[src]').toArray().map((e) => ({ value: $(e).attr('src') ?? '', how: 'script' as const })),
    ];
    for (const r of refs) {
      let host = '';
      try {
        host = new URL(r.value, pageUrl).hostname;
      } catch {
        continue;
      }
      const fp = fingerprintHost(host);
      const named = HTML_SIGNS.find((s) => s.test.test(host + new URL(r.value, pageUrl).pathname));
      if (fp) add(fp.system, fp.kind, r.how, r.value, pageUrl);
      else if (named) add(named.system, named.kind, r.how, r.value, pageUrl);
    }
    for (const s of HTML_SIGNS) if (s.test.test(html)) add(s.system, s.kind, 'html', s.system, pageUrl);
    // Wix Bookings sells through pages of the site itself, so it is a link to one of them on a Wix site, not a word in the code.
    if (/wix\.com website builder|static\.parastorage\.com|wixstatic\.com/i.test(html) && $('a[href*="/booking-calendar"], a[href*="/book-online"], a[href*="/service-page/"]').length) {
      add('Wix Bookings', 'builder', 'link', 'Wix Bookings', pageUrl);
    }
  }
  return hits;
}

export interface Cta {
  text: string;
  href: string;
  raw: string;
  hasHandler: boolean;
}

const cleanText = (t: string) => t.replace(/[\ue000-\uf8ff\u200b-\u200d\ufeff]/g, '').replace(/\s+/g, ' ').trim();
const CTA_WORDS = /^\W*(?:book(?:ing|ings)?|reserve|enquire|enquiry|inquire|inquiry)\b|\b(?:book now|book online|enquire now|make an? (?:booking|enquiry|reservation)|check availability)\b/i;

/** The Book, Book now and Enquire links on a page: short link words that start with one of those, once for each address and words. */
export function ctaLinks(page: PageCapture): Cta[] {
  const out: Cta[] = [];
  for (const l of page.links) {
    const text = cleanText(l.text);
    if (!text || text.split(' ').length > 6 || !CTA_WORDS.test(text)) continue;
    if (out.some((o) => o.text.toLowerCase() === text.toLowerCase() && o.href === l.href)) continue;
    out.push({ text, href: l.href, raw: l.raw, hasHandler: l.hasHandler });
  }
  return out;
}

export type LandingProblem = 'contact_page' | 'not_found' | 'missing_anchor' | null;

export interface Landing {
  text: string;
  href: string;
  kind: 'page' | 'anchor' | 'mailto' | 'tel' | 'script';
  status: number | null;
  finalUrl: string | null;
  landsOn: string;
  problem: LandingProblem;
  system: string | null;
  error: string | null;
}

const NOT_FOUND = /\bnot found\b|\b404\b|\bpage (?:doesn'?t|does not) exist\b|\bno longer (?:exists|available)\b/i;

export function pageSaysMissing(status: number | null, title: string, h1: string): boolean {
  return status === 404 || status === 410 || (status !== null && status >= 200 && status < 300 && NOT_FOUND.test(`${title} ${h1}`));
}

const CONTACT_PATH = /\/(?:contact|contact[-_ ]?us|contact[-_]me|get[-_]in[-_]touch|reach[-_]us|enquir(?:e|y)[-_]?(?:now|us)?)\/?(?:\.html?)?$/i;

/** Opens one Book or Enquire link the way a visitor would, without sending anything, and says where it ends up. */
export async function followCta(polite: Polite, homeUrl: string, homeHtml: string, cta: Cta): Promise<Landing> {
  const base = { text: cta.text, href: cta.raw || cta.href, status: null as number | null, finalUrl: null as string | null, system: null as string | null, error: null as string | null };
  const raw = cta.raw.trim();
  if (/^mailto:/i.test(raw)) return { ...base, kind: 'mailto', landsOn: 'an email', problem: null };
  if (/^tel:/i.test(raw)) return { ...base, kind: 'tel', landsOn: 'a phone call', problem: null };
  if (/^javascript:/i.test(raw) || raw === '#' || raw === '') return { ...base, kind: 'script', landsOn: 'a script on the page', problem: null };

  let target: URL;
  try {
    target = new URL(cta.href);
  } catch {
    return { ...base, kind: 'script', landsOn: 'an address that cannot be read', problem: null, error: 'bad address' };
  }
  const here = new URL(homeUrl);
  if (target.hash && target.hash.length > 1 && sameAddress(target.toString().split('#')[0]!, here.toString().split('#')[0]!)) {
    const id = decodeURIComponent(target.hash.slice(1));
    const $ = cheerio.load(homeHtml);
    const exists = $('[id]').toArray().some((e) => $(e).attr('id') === id) || $('a[name]').toArray().some((e) => $(e).attr('name') === id);
    return { ...base, kind: 'anchor', status: 200, finalUrl: target.toString(), landsOn: exists ? 'a section of the same page' : 'a section that does not exist on the page', problem: exists ? null : 'missing_anchor' };
  }

  const res = await polite.get(target.toString(), { maxRedirects: 5, timeoutMs: 20_000, maxBytes: 400_000 });
  if (res.status === null) {
    // A booking system's own robots.txt may not allow it to be opened. Where the link goes is still plain from its address.
    const host = target.hostname.replace(/^www\./, '');
    const known = fingerprintHost(target.hostname)?.system ?? HTML_SIGNS.find((s) => s.test.test(host))?.system ?? null;
    const reason = res.error === 'robots' ? 'not opened, its robots.txt does not allow it' : (res.error ?? 'no answer');
    return { ...base, kind: 'page', finalUrl: res.finalUrl, system: known, landsOn: known ?? `a page on ${host}`, problem: null, error: reason };
  }
  const $ = cheerio.load(res.body);
  const title = $('title').first().text().trim();
  const h1 = $('h1').first().text().trim();
  const fp = fingerprintHost(new URL(res.finalUrl).hostname);
  const onPage = bookingSystemsIn([{ url: res.finalUrl, html: res.body }])[0];
  const system = fp?.system ?? onPage?.system ?? null;
  const common = { ...base, kind: 'page' as const, status: res.status, finalUrl: res.finalUrl, system, error: null };
  if (pageSaysMissing(res.status, title, h1)) return { ...common, landsOn: 'a page that is not found', problem: 'not_found' };
  if (system) return { ...common, landsOn: `${system}`, problem: null };
  const sameSite = domainOf(res.finalUrl) === domainOf(homeUrl);
  const contact = sameSite && (CONTACT_PATH.test(new URL(res.finalUrl).pathname) || /^\s*contact\b/i.test(title));
  if (contact) return { ...common, landsOn: 'the contact page', problem: /^\W*(?:book|reserve)/i.test(cta.text) ? 'contact_page' : null };
  return { ...common, landsOn: sameSite ? 'another page on the site' : `a page on ${new URL(res.finalUrl).hostname.replace(/^www\./, '')}`, problem: null };
}

/** How a site takes bookings, in one line: the systems found, or the plain ways in. */
export function bookingPath(systems: SystemHit[], landings: Landing[], homeLinks: PageCapture['links']): string {
  const real = systems.filter((s) => s.kind === 'system' || s.kind === 'builder');
  if (real.length) return real.map((s) => s.system).join(' + ');
  // A link to a review site is not a way to book.
  const platforms = systems.filter((s) => s.kind === 'platform' && !['Tripadvisor', 'Booking.com', 'Expedia'].includes(s.system));
  if (platforms.length) return platforms.map((s) => s.system).join(' + ');
  const ways = new Set<string>();
  for (const l of homeLinks) {
    if (/^mailto:/i.test(l.raw)) ways.add('mailto');
    if (/^tel:/i.test(l.raw)) ways.add('tel');
  }
  if (landings.some((l) => l.landsOn === 'the contact page')) ways.add('contact page');
  return ways.size ? `${[...ways].join(' and ')} only` : 'none found';
}

export const BOOKING_PATHS = ['/book', '/booking', '/bookings', '/book-now', '/book-online', '/online-booking', '/online-bookings', '/reservations', '/enquire', '/availability'];

const BOOKISH = /\b(?:book(?:ing|ings)?|reserv\w*|enquir\w*|availab\w*|accommodation|accomodation|rooms?|stay|rates|tariff|prices?|appointment|gift[ -]?(?:voucher|card)s?|contact)\b/i;
/** Whether a link or page is part of how a visitor books, asks about a booking or pays. */
export const bookingish = (text: string): boolean => BOOKISH.test(text.replace(/[-_/]+/g, ' '));
