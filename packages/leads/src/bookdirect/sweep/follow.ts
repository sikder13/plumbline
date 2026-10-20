import * as cheerio from 'cheerio';
import type { Polite } from '@plumbline/fetch';
import { engineOf } from '../engines.ts';
import { visibleText } from '../site.ts';
import type { BookingLink, CrawlPage } from './crawl.ts';

/** Words on an engine's page that say the account behind it is gone. */
export const INACTIVE = /\b(?:account (?:is |has been )?(?:inactive|suspended|disabled|deactivated|expired|closed|cancell?ed|not active)|(?:property|business|clinic|practice|venue|account|company|hotel|organi[sz]ation|booking page|page|site|location)\s+(?:could not be|cannot be|can'?t be|was not|wasn'?t|is not|not)\s+found|no longer (?:available|active|accepting (?:online )?bookings|taking (?:online )?bookings|in use)|online bookings? (?:is |are )?(?:currently )?(?:unavailable|disabled|not available|turned off|not enabled|not activated)|(?:subscription|trial) (?:has )?(?:expired|ended)|this booking (?:page|site|link) is (?:not|no longer)|invalid (?:property|hotel|account|business|clinic)(?: id| code)?|property (?:is )?(?:not|no longer) (?:active|available|live)|bookings are not (?:currently )?(?:available|enabled))\b/i;
/** A page that says it is missing. */
export const MISSING = /\b(?:page not found|404|not found|page (?:doesn'?t|does not|cannot be|could not be) (?:exist|found)|no longer exists|this page (?:isn'?t|is not) available|error 404|oops)\b/i;

export interface Follow {
  url: string;
  text: string;
  on: string;
  engine: string;
  how: string;
  status: number | null;
  finalUrl: string;
  redirects: string[];
  error: string | null;
  title: string;
  h1: string;
  sample: string;
  /** Static reading: inactive words, a missing page, or nothing. */
  says: 'inactive' | 'missing' | '';
  saysText: string;
  checkedAt: string;
}

const norm = (u: string) => u.replace(/#.*$/, '').replace(/\/$/, '');

/**
 * Follows a site's booking addresses the way a visitor's browser would, sending nothing: engine links
 * first, then the site's own Book links, six at most. A page already read in the crawl is not fetched again.
 */
export async function followBooking(polite: Polite, links: BookingLink[], crawled: CrawlPage[], html: Map<string, string>): Promise<Follow[]> {
  const ordered = [...links.filter((l) => l.engine), ...links.filter((l) => !l.engine)].slice(0, 6);
  const out: Follow[] = [];
  for (const l of ordered) {
    const seen = crawled.find((p) => norm(p.url) === norm(l.url) || norm(p.finalUrl) === norm(l.url));
    let status: number | null;
    let finalUrl: string;
    let redirects: string[];
    let error: string | null;
    let body: string;
    if (seen) {
      ({ status, finalUrl, redirects, error } = seen);
      body = seen.file ? (html.get(seen.file) ?? '') : '';
    } else {
      let r = await polite.get(l.url, { maxRedirects: 8, timeoutMs: 25_000, maxBytes: 1_500_000 });
      if ((r.status !== null && r.status >= 500) || (r.status === null && r.error && !['robots', 'ENOTFOUND'].includes(r.error))) {
        await new Promise((res) => setTimeout(res, 3000));
        r = await polite.get(l.url, { maxRedirects: 8, timeoutMs: 25_000, maxBytes: 1_500_000 });
      }
      ({ status, finalUrl, redirects } = r);
      error = r.error ?? null;
      body = r.body;
    }
    const $ = cheerio.load(body || '<html></html>');
    const title = $('title').first().text().replace(/\s+/g, ' ').trim().slice(0, 120);
    const h1 = $('h1').first().text().replace(/\s+/g, ' ').trim().slice(0, 120);
    const text = body ? visibleText($) : '';
    let says: Follow['says'] = '';
    let saysText = '';
    const inactive = INACTIVE.exec(`${title}\n${h1}\n${text.slice(0, 4000)}`);
    if (inactive) {
      says = 'inactive';
      saysText = inactive[0];
    } else if (status !== null && status >= 200 && status < 300 && MISSING.test(`${title} ${h1}`) && text.length < 3000) {
      says = 'missing';
      saysText = (h1 || title).slice(0, 80);
    }
    out.push({ url: l.url, text: l.text, on: l.on, engine: l.engine || (engineOf(finalUrl)?.name ?? ''), how: l.how, status, finalUrl, redirects, error, title, h1, sample: text.slice(0, 300), says, saysText, checkedAt: new Date().toISOString() });
  }
  return out;
}
