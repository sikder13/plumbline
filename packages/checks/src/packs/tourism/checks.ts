import { BOOKING_WORDS, fingerprintUrl, type SiteData } from '@plumbline/collect';
import { okHomes, okInner, pagesInOrder, pathOf, siteFinding } from '../../helpers.ts';
import type { Check } from '../../types.ts';

const SOCIAL = /(^|\.)(facebook\.com|instagram\.com|twitter\.com|x\.com|youtube\.com|tiktok\.com|linkedin\.com|pinterest\.[a-z.]+|tripadvisor\.[a-z.]+|google\.[a-z.]+|g\.page|goo\.gl|maps\.app\.goo\.gl|newzealand\.com|qualmark\.co\.nz|tiaki\.nz|doc\.govt\.nz|metservice\.com)$/;
const SHOP_TECH = /^(woocommerce|shopify|ecwid|bigcommerce|wix bookings|bookly|amelia|easy appointments|opencart|magento|prestashop)$/i;

/**
 * Ways a visitor might book that the fingerprints do not name: a booking-worded link to another
 * site that is not social media, an online shop, or a payment provider on the page.
 */
export function otherBookingRoutes(site: SiteData): string[] {
  const out: string[] = [];
  const own = new URL(okHomes(site)[0]?.finalUrl ?? site.homepageUrl).hostname.replace(/^www\./, '');
  for (const page of pagesInOrder(site)) {
    for (const l of page.links) {
      if (!l.visible || !/^https?:/.test(l.href) || !BOOKING_WORDS.test(l.text)) continue;
      let host: string;
      try {
        host = new URL(l.href).hostname.replace(/^www\./, '');
      } catch {
        continue;
      }
      if (host === own) continue;
      if (SOCIAL.test(host)) continue;
      out.push(`"${l.text}" goes to ${host}`);
    }
    for (const src of page.meta.iframes) {
      try {
        const host = new URL(src).hostname;
        if (/book|reserv|ticket|checkout|avail/i.test(src) && !SOCIAL.test(host)) out.push(`embedded frame ${host}`);
      } catch {
        // A frame without a usable address tells us nothing.
      }
    }
    for (const host of page.requestHosts) if (/(^|\.)(stripe\.com|paypal\.com|windcave\.com|paymentexpress\.com|afterpay\.com|laybuy\.com)$/.test(host)) out.push(`payment provider ${host}`);
  }
  for (const t of site.technologies) if (SHOP_TECH.test(t.name)) out.push(`${t.name} on the site`);
  return [...new Set(out)];
}

export function bookingSystemsOnSite(site: SiteData): string[] {
  return [...new Set(site.booking.filter((b) => b.kind === 'system').map((b) => b.system))];
}

export function firesNoOnlineBooking(site: SiteData): boolean {
  return !site.blocked && okHomes(site).length > 0 && bookingSystemsOnSite(site).length === 0 && otherBookingRoutes(site).length === 0;
}

export const T01_no_online_booking: Check = {
  id: 'T01_no_online_booking',
  pack: 'tourism',
  tier: 'rule',
  evidenceSpec: 'page',
  appliesTo: ({ site }) => !site.blocked && okHomes(site).length > 0,
  evaluate({ site }) {
    if (!firesNoOnlineBooking(site)) return [];
    const bookWords = pagesInOrder(site)
      .flatMap((p) => p.links.filter((l) => l.visible && BOOKING_WORDS.test(l.text)).map((l) => `"${l.text}" on ${pathOf(p.finalUrl)} goes to ${pathOf(l.href)}`))
      .slice(0, 6);
    return [
      siteFinding(
        this.id,
        site,
        'No online booking was found on the site',
        { pagesRead: [...okHomes(site), ...okInner(site)].map((p) => p.finalUrl).filter((u, i, a) => a.indexOf(u) === i), bookingWordedLinks: bookWords },
        `No booking system, shop or payment step was found on the homepage or the ${okInner(site).length} other pages read. ${bookWords.length ? `Booking buttons lead to: ${bookWords.join('; ')}.` : 'There are no booking buttons.'}`,
        'booking',
      ),
    ];
  },
};

export const T02_booking_system_not_linked: Check = {
  id: 'T02_booking_system_not_linked',
  pack: 'tourism',
  tier: 'rule',
  evidenceSpec: 'page',
  appliesTo: ({ site }) => !site.blocked && okHomes(site).length > 0 && site.listings.some((l) => l.kind === 'booking_system'),
  evaluate({ site }) {
    const storefronts = site.listings.filter((l) => l.kind === 'booking_system' && l.status !== 'error');
    const onSite = new Set(site.booking.map((b) => b.system));
    const missing = storefronts.filter((l) => !onSite.has(l.platform));
    if (!missing.length) return [];
    // A storefront only counts when it could be opened, or when robots.txt alone kept us from opening it.
    const confirmed = missing.filter((l) => l.status === 'fetched');
    if (!confirmed.length) return [];
    const s = confirmed[0]!;
    return [
      siteFinding(
        this.id,
        site,
        `A ${s.platform} booking page exists but the site does not link to it`,
        { storefront: s.url, platform: s.platform, storefrontName: s.name, pagesRead: okInner(site).length + 1 },
        `${s.platform} storefront ${s.url} is live${s.name ? ` ("${s.name}")` : ''}. No link, widget or script for ${s.platform} was found on the homepage or the ${okInner(site).length} other pages read.`,
        `storefront|${s.platform}`,
      ),
    ];
  },
};

export const T03_platform_dependency: Check = {
  id: 'T03_platform_dependency',
  pack: 'tourism',
  tier: 'rule',
  evidenceSpec: 'page',
  appliesTo: ({ site }) => firesNoOnlineBooking(site),
  evaluate({ site }) {
    const platforms = new Map<string, string>();
    for (const l of site.listings) if (l.kind === 'booking_platform' && l.status !== 'error') platforms.set(l.platform, l.url);
    for (const b of site.booking) if (b.kind === 'platform' && b.system !== 'Tripadvisor') platforms.set(b.system, b.url);
    for (const p of pagesInOrder(site)) {
      for (const l of p.links) {
        const f = fingerprintUrl(l.href);
        if (l.visible && f?.kind === 'platform' && f.system !== 'Tripadvisor') platforms.set(f.system, l.href);
      }
    }
    if (!platforms.size) return [];
    const list = [...platforms.entries()];
    return [
      siteFinding(
        this.id,
        site,
        `Sold on ${list.map(([n]) => n).join(', ')} while the site itself cannot take a booking`,
        { platforms: list.map(([platform, url]) => ({ platform, url })) },
        `Booking platforms selling this business: ${list.map(([n, u]) => `${n} (${u})`).join('; ')}. No online booking was found on the business's own site.`,
        'platforms',
      ),
    ];
  },
};

const MONTH = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\b\.?/i;
const SEASON = /\b(all year|year[- ]round|every day|daily|7 days|seven days|open (?:mon|tue|wed|thu|fri|sat|sun|daily|every)|mon(?:day)?s?\s*(?:-|–|to)\s*(?:fri|sat|sun)|weekends?|public holidays|season(?:al|s)?|summer|winter|spring|autumn|closed (?:on|from|for|during|until)|opening hours|hours)\b/i;
const TIME = /\b(?:[01]?\d|2[0-3])(?:[:.][0-5]\d)?\s?(?:am|pm)\b|\b(?:[01]?\d|2[0-3]):[0-5]\d\b|\b(?:depart(?:s|ures?|ing)?|leaves?|start(?:s|ing)?|check[- ]?in) (?:at|time|from|times)\b|\b(?:morning|afternoon|evening|sunset|sunrise|dawn|dusk|twilight)\b/i;

export const T05_season_info_missing: Check = {
  id: 'T05_season_info_missing',
  pack: 'tourism',
  tier: 'rule',
  evidenceSpec: 'page',
  appliesTo: ({ site }) => !site.blocked && okHomes(site).length > 0,
  evaluate({ site }) {
    for (const p of pagesInOrder(site)) {
      // Copyright lines and review dates mention months without saying when the business operates.
      const text = p.blocks.filter((b) => !b.inFooter).map((b) => b.text).join('\n');
      if (MONTH.test(text) || SEASON.test(text) || TIME.test(text)) return [];
    }
    return [
      siteFinding(
        this.id,
        site,
        'The site does not say when the business operates',
        { pagesRead: okInner(site).length + 1 },
        `No months, season, opening days or departure times were found on the homepage or the ${okInner(site).length} other pages read.`,
        'season',
      ),
    ];
  },
};
