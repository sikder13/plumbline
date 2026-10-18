import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { domainOf } from '@plumbline/core';
import { emailsIn, parseDate, phonesIn } from '@plumbline/collect';
import type { PageCapture } from '@plumbline/render';

/** What the homepage shows that the ranking rules ask about. */
export interface HomeFacts {
  /** The pages its main menu links to (addresses as they were linked). */
  menu: string[];
  /** The homepage shows a phone number, an email address or a link to a contact page. */
  contact: boolean;
  /** "Last updated" lines on pages we read that give a date more than a year old. */
  lastUpdated: { url: string; text: string }[];
}

const LAST_UPDATED = /\blast (?:updated|modified|edited)\b[:\s]*([^\n]{0,40})/i;

/** The pages in the main menu, the homepage's way to be reached, and out of date "last updated" lines. All read from captures already made. */
export function homeFacts(pages: PageCapture[], homepageUrl: string, now: Date = new Date()): HomeFacts {
  const ok = pages.filter((p) => p.ok);
  const path = (u: string) => new URL(u).pathname.replace(/\/$/, '');
  const homes = ok.filter((p) => path(p.finalUrl) === path(homepageUrl) && domainOf(p.finalUrl) === domainOf(homepageUrl));
  const menu: string[] = [];
  for (const h of homes) {
    for (const l of h.links) {
      if (!l.inNav || !/^https?:/i.test(l.href) || domainOf(l.href) !== domainOf(homepageUrl)) continue;
      const url = l.href.split('#')[0]!;
      if (!menu.includes(url)) menu.push(url);
    }
  }
  const contact = homes.some(
    (h) => h.links.some((l) => /^(?:mailto|tel):/i.test(l.raw) || (domainOf(l.href) === domainOf(homepageUrl) && /contact|get[- ]in[- ]touch|enquir/i.test(`${l.text} ${path(l.href)}`))) || phonesIn(h.text).length > 0 || emailsIn(h.text).length > 0,
  );
  const lastUpdated: HomeFacts['lastUpdated'] = [];
  for (const p of ok) {
    const m = LAST_UPDATED.exec(p.text);
    if (!m || lastUpdated.some((x) => x.url === p.finalUrl)) continue;
    const d = parseDate(m[1]!);
    const year = /\b(19|20)\d{2}\b/.exec(m[1]!)?.[0];
    const old = d ? d.date.getTime() < now.getTime() - 365 * 86_400_000 : !!year && Number(year) <= now.getFullYear() - 2;
    if (old) lastUpdated.push({ url: p.finalUrl, text: m[0].replace(/\s+/g, ' ').trim() });
  }
  return { menu, contact, lastUpdated };
}

/** The captures a run kept for a business, from disk. */
export function loadCaptures(dir: string): PageCapture[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((name) => join(dir, name, 'capture.json'))
    .filter((f) => existsSync(f))
    .map((f) => JSON.parse(readFileSync(f, 'utf8')) as PageCapture);
}
