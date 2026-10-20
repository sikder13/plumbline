/**
 * Book Direct finding classes and their tiers (RELAY-BOOKDIRECT-01, Part 3). Tiers 1 to 4 may lead an
 * email; tiers 6 and 7 are hygiene, recorded and never a lead. Every finding carries the measured
 * value and the page it was measured on.
 */
export type FindingClass = 'ota_only_booking' | 'book_cta_dead' | 'no_first_screen_cta' | 'tel_link_dead' | 'slow_mobile' | 'no_prices_or_hours' | 'not_mobile_layout' | 'hygiene_footer_year' | 'hygiene_no_https';

export interface Finding {
  cls: FindingClass;
  tier: number;
  value: string;
  evidenceUrl: string;
}

export type Sector = 'accommodation' | 'allied_health' | 'dental' | 'trades';

export function sectorOf(list: string): Sector {
  return list === 'A' ? 'accommodation' : list === 'B' ? 'allied_health' : list === 'C' ? 'dental' : 'trades';
}

export interface BookLanding {
  text: string;
  href: string;
  /** dead: no target, a non-200 answer, or the contact page instead of the engine. */
  outcome: 'ok' | 'no_target' | 'not_200' | 'contact_page' | 'unknown';
  status: number | null;
  landedOn: string;
  detail: string;
  /** The own engine or marketplace the link reached, when it reached one. */
  engine?: string;
}

export interface AuditFacts {
  list: string;
  homeUrl: string;
  /** The own engine named anywhere on the site (Seekom, Cliniko...), or "" when none. */
  ownEngine: string;
  otaLinks: string[];
  /** The page that carries the first OTA link. */
  otaOn: string;
  landings: BookLanding[];
  firstScreen: { checked: boolean; controls: string[] };
  phone: { shownOnHome: string | null; telLinksOnHome: string[]; firstTelWorks: boolean | null };
  speed: { measured: boolean; pages: { url: string; lcpS: number | null; runs: number }[]; error: string | null };
  pricesFound: boolean;
  hoursFound: boolean;
  layout: { viewportMeta: string | null; scrollWidth: number; innerWidth: number; movesSideways: boolean };
  hygiene: { footerYear: number | null; https: boolean };
}

export const SLOW_LCP_S = 4.0;
export const VERY_SLOW_LCP_S = 6.0;

/** The fixed tier rules. Booking classes come first, so a lead's strongest finding is its booking path. */
export function findingsOf(f: AuditFacts, now: Date = new Date()): Finding[] {
  const sector = sectorOf(f.list);
  const out: Finding[] = [];

  if (sector === 'accommodation' && !f.ownEngine && f.otaLinks.length) {
    out.push({ cls: 'ota_only_booking', tier: 1, value: `no own booking engine; the site links to ${f.otaLinks.map(otaName).filter((v, i, a) => a.indexOf(v) === i).join(', ')}`, evidenceUrl: f.otaOn || f.homeUrl });
  }

  const dead = f.landings.find((l) => l.outcome === 'no_target' || l.outcome === 'not_200' || (l.outcome === 'contact_page' && (!!f.ownEngine || f.otaLinks.length > 0)));
  if (dead) {
    const how = dead.outcome === 'no_target' ? 'does nothing when tapped' : dead.outcome === 'not_200' ? `answers ${dead.status ?? 'no response'}` : `opens the contact page${f.ownEngine ? ` instead of ${f.ownEngine}` : ''}`;
    out.push({ cls: 'book_cta_dead', tier: 1, value: `"${dead.text}" ${how}${dead.detail ? ` (${dead.detail})` : ''}`, evidenceUrl: f.homeUrl });
  }

  if (f.firstScreen.checked && f.firstScreen.controls.length === 0) {
    out.push({ cls: 'no_first_screen_cta', tier: 2, value: 'no Book, Call or Book Appointment control on the first screen at 390 x 844', evidenceUrl: f.homeUrl });
  }

  const telDead = f.phone.firstTelWorks === false || (!!f.phone.shownOnHome && f.phone.telLinksOnHome.length === 0);
  if (telDead) {
    const value = f.phone.firstTelWorks === false ? `the first tel: link carries no number (${f.phone.telLinksOnHome[0] ?? 'tel:'})` : `${f.phone.shownOnHome} is shown on the homepage but is not a tap-to-call link`;
    out.push({ cls: 'tel_link_dead', tier: sector === 'accommodation' || sector === 'trades' ? 2 : 3, value, evidenceUrl: f.homeUrl });
  }

  if (f.speed.measured) {
    const slowest = [...f.speed.pages].filter((p) => p.lcpS !== null).sort((a, b) => b.lcpS! - a.lcpS!)[0];
    if (slowest && slowest.lcpS! > SLOW_LCP_S) out.push({ cls: 'slow_mobile', tier: slowest.lcpS! > VERY_SLOW_LCP_S ? 2 : 3, value: `mobile LCP ${slowest.lcpS!.toFixed(1)} s (Lighthouse mobile, simulated throttling, median of ${slowest.runs})`, evidenceUrl: slowest.url });
  }

  if ((sector === 'allied_health' || sector === 'dental') && !f.pricesFound && !f.hoursFound) {
    out.push({ cls: 'no_prices_or_hours', tier: 4, value: 'no prices and no opening hours on the pages read', evidenceUrl: f.homeUrl });
  }

  const noViewport = !f.layout.viewportMeta || !/width\s*=\s*device-width/i.test(f.layout.viewportMeta);
  const tooWide = f.layout.movesSideways && f.layout.scrollWidth > f.layout.innerWidth * 1.2;
  if (noViewport || tooWide) {
    const booking = out.some((x) => x.cls === 'ota_only_booking' || x.cls === 'book_cta_dead' || x.cls === 'no_first_screen_cta');
    const value = noViewport ? (f.layout.viewportMeta ? `viewport is fixed (${f.layout.viewportMeta})` : 'no viewport meta tag') : `the page is ${f.layout.scrollWidth} px wide on a ${f.layout.innerWidth} px screen`;
    out.push({ cls: 'not_mobile_layout', tier: booking ? 2 : 3, value, evidenceUrl: f.homeUrl });
  }

  if (f.hygiene.footerYear !== null && f.hygiene.footerYear < now.getFullYear() - 1) out.push({ cls: 'hygiene_footer_year', tier: 7, value: `footer says ${f.hygiene.footerYear}`, evidenceUrl: f.homeUrl });
  if (!f.hygiene.https) out.push({ cls: 'hygiene_no_https', tier: 6, value: 'served without https', evidenceUrl: f.homeUrl });

  return out.sort((a, b) => a.tier - b.tier || ORDER.indexOf(a.cls) - ORDER.indexOf(b.cls));
}

const ORDER: FindingClass[] = ['ota_only_booking', 'book_cta_dead', 'no_first_screen_cta', 'tel_link_dead', 'slow_mobile', 'not_mobile_layout', 'no_prices_or_hours', 'hygiene_no_https', 'hygiene_footer_year'];

function otaName(url: string): string {
  const h = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  })();
  if (/booking\.com/.test(h)) return 'Booking.com';
  if (/expedia/.test(h)) return 'Expedia';
  if (/agoda/.test(h)) return 'Agoda';
  if (/airbnb/.test(h)) return 'Airbnb';
  if (/hotels\.com/.test(h)) return 'Hotels.com';
  return h;
}

/** A lead finding: tier 1 to 3, with a measured value and an evidence address. Tier 4 may lead an email but never qualifies on its own. */
export function leadFindings(fs: Finding[]): Finding[] {
  return fs.filter((x) => x.tier >= 1 && x.tier <= 3 && x.value && x.evidenceUrl);
}

/** First-screen controls that count: Book, Book now, Book appointment, Check availability, Call, or a tap-to-call or engine link. */
export const CALL_WORDS = /^\W*(?:call(?:\s+(?:us|now|today|the clinic|\d[\d\s]+))?|phone(?:\s+us)?|ring(?:\s+us)?|tap to call)\W*$/i;
