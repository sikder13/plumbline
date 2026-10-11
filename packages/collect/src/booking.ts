import type { PageCapture } from '@plumbline/render';
import type { BookingSignal } from './types.ts';

export interface BookingFingerprint {
  system: string;
  kind: 'system' | 'platform';
  host: RegExp;
}

/** Booking systems an operator runs themselves. */
export const BOOKING_SYSTEMS: BookingFingerprint[] = [
  { system: 'FareHarbor', kind: 'system', host: /(^|\.)fareharbor\.com$/ },
  { system: 'Rezdy', kind: 'system', host: /(^|\.)rezdy\.com$/ },
  { system: 'Bookeo', kind: 'system', host: /(^|\.)bookeo\.com$/ },
  { system: 'Checkfront', kind: 'system', host: /(^|\.)checkfront\.(com|co\.uk)$/ },
  { system: 'Peek', kind: 'system', host: /(^|\.)peek\.com$/ },
  { system: 'TrekkSoft', kind: 'system', host: /(^|\.)trekksoft\.com$/ },
  { system: 'Xola', kind: 'system', host: /(^|\.)xola\.(com|app)$/ },
  { system: 'Ventrata', kind: 'system', host: /(^|\.)ventrata\.com$/ },
  { system: 'Bookit', kind: 'system', host: /(^|\.)bookit\.co\.nz$/ },
  { system: 'RTBS', kind: 'system', host: /(^|\.)(rtbs\.nz|rtbslive\.com|rtbs\.co\.nz)$/ },
  { system: 'IBIS', kind: 'system', host: /(^|\.)(ibisnz\.com|ibis\.co\.nz|ibistechnology\.com)$/ },
  { system: 'Bokun', kind: 'system', host: /(^|\.)bokun\.(io|is)$/ },
  { system: 'Rezgo', kind: 'system', host: /(^|\.)rezgo\.com$/ },
  { system: 'ResBook', kind: 'system', host: /(^|\.)resbook\.(net|com)$/ },
  { system: 'Booking Boss', kind: 'system', host: /(^|\.)bookingboss\.com$/ },
  { system: 'Regiondo', kind: 'system', host: /(^|\.)regiondo\.(com|net)$/ },
  { system: 'Beyonk', kind: 'system', host: /(^|\.)beyonk\.com$/ },
  { system: 'TicketingHub', kind: 'system', host: /(^|\.)ticketinghub\.com$/ },
  { system: 'Roller', kind: 'system', host: /(^|\.)roller\.(app|software)$/ },
  { system: 'Acuity', kind: 'system', host: /(^|\.)(acuityscheduling\.com|as\.me)$/ },
  { system: 'Calendly', kind: 'system', host: /(^|\.)calendly\.com$/ },
  { system: 'Square', kind: 'system', host: /(^|\.)(squareup\.com|square\.site)$/ },
  { system: 'Eventbrite', kind: 'system', host: /(^|\.)eventbrite\.(com|co\.nz)$/ },
  { system: 'Humanitix', kind: 'system', host: /(^|\.)humanitix\.com$/ },
  { system: 'Seekom', kind: 'system', host: /(^|\.)seekom\.com$/ },
  { system: 'Little Hotelier', kind: 'system', host: /(^|\.)(littlehotelier\.com|thebookingbutton\.com|direct-book\.com)$/ },
  { system: 'Cloudbeds', kind: 'system', host: /(^|\.)cloudbeds\.com$/ },
  { system: 'Mews', kind: 'system', host: /(^|\.)mews\.com$/ },
  { system: 'Experience Bank', kind: 'system', host: /(^|\.)experiencebank\.com$/ },
  { system: 'Zaui', kind: 'system', host: /(^|\.)zaui\.(net|com)$/ },
  { system: 'Rezexpert', kind: 'system', host: /(^|\.)rezexpert\.com$/ },
  { system: 'Now Book It', kind: 'system', host: /(^|\.)nowbookit\.com$/ },
  { system: 'ResDiary', kind: 'system', host: /(^|\.)resdiary\.com$/ },
  { system: 'Tock', kind: 'system', host: /(^|\.)exploretock\.com$/ },
  { system: 'Shopify', kind: 'system', host: /(^|\.)myshopify\.com$/ },
];

/** Platforms that sell on the operator's behalf and take a commission. */
export const BOOKING_PLATFORMS: BookingFingerprint[] = [
  { system: 'Viator', kind: 'platform', host: /(^|\.)viator\.com$/ },
  { system: 'GetYourGuide', kind: 'platform', host: /(^|\.)getyourguide\.(com|co\.nz|co\.uk)$/ },
  { system: 'Bookme', kind: 'platform', host: /(^|\.)bookme\.co\.nz$/ },
  { system: 'FishingBooker', kind: 'platform', host: /(^|\.)fishingbooker\.com$/ },
  { system: 'Klook', kind: 'platform', host: /(^|\.)klook\.com$/ },
  { system: 'Expedia', kind: 'platform', host: /(^|\.)expedia\.(com|co\.nz)$/ },
  { system: 'Airbnb', kind: 'platform', host: /(^|\.)airbnb\.(com|co\.nz)$/ },
  { system: 'Tripadvisor', kind: 'platform', host: /(^|\.)tripadvisor\.(com|co\.nz|com\.au|co\.uk)$/ },
  { system: 'GrabOne', kind: 'platform', host: /(^|\.)grabone\.co\.nz$/ },
  { system: 'Everything New Zealand', kind: 'platform', host: /(^|\.)everythingnewzealand\.com$/ },
  { system: 'Experience Oz', kind: 'platform', host: /(^|\.)experienceoz\.(com\.au|co\.nz)$/ },
  { system: 'Backpacker Deals', kind: 'platform', host: /(^|\.)backpackerdeals\.com$/ },
];

const ALL = [...BOOKING_SYSTEMS, ...BOOKING_PLATFORMS];

export function fingerprintHost(host: string): BookingFingerprint | null {
  const h = host.toLowerCase();
  return ALL.find((f) => f.host.test(h)) ?? null;
}

export function fingerprintUrl(url: string): BookingFingerprint | null {
  try {
    return fingerprintHost(new URL(url).hostname);
  } catch {
    return null;
  }
}

/** Words on a link or button that mean a visitor can book or pay from here. */
export const BOOKING_WORDS = /\b(book(ing|ings)?( (now|online|here|today|a|your|this|direct|tour|trip|charter))?|check availability|availability|reserve (now|online|today|your|a (spot|place|seat|table|tour|trip))|reservations|make a reservation|buy (tickets?|now|online)|get tickets|tickets|add to cart|add to basket|checkout|gift vouchers?|purchase)\b/i;
export const ENQUIRY_WORDS = /\b(enquir(e|y|ies)|inquir(e|y|ies)|contact( us)?|get in touch|email us|message us|call( us| now)?|phone|text us|whatsapp|request a quote|ask a question)\b/i;

export function bookingSignals(pages: PageCapture[]): BookingSignal[] {
  const out: BookingSignal[] = [];
  const seen = new Set<string>();
  const add = (s: BookingSignal) => {
    const key = `${s.system}|${s.how}|${s.pageUrl}|${s.visibleLink}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(s);
  };
  for (const page of pages) {
    for (const link of page.links) {
      const f = fingerprintUrl(link.href);
      if (f) add({ system: f.system, kind: f.kind, url: link.href, pageUrl: page.finalUrl, how: 'link', visibleLink: link.visible });
    }
    for (const src of page.meta.iframes) {
      const f = fingerprintUrl(src);
      if (f) add({ system: f.system, kind: f.kind, url: src, pageUrl: page.finalUrl, how: 'iframe', visibleLink: false });
    }
    for (const src of page.meta.scripts) {
      const f = fingerprintUrl(src);
      if (f) add({ system: f.system, kind: f.kind, url: src, pageUrl: page.finalUrl, how: 'script', visibleLink: false });
    }
    for (const host of page.requestHosts) {
      const f = fingerprintHost(host);
      if (f && f.kind === 'system') add({ system: f.system, kind: f.kind, url: `https://${host}/`, pageUrl: page.finalUrl, how: 'script', visibleLink: false });
    }
  }
  return out;
}
