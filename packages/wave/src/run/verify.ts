import * as cheerio from 'cheerio';
import { domainOf } from '@plumbline/core';
import { greetingNames, nameForms, type WaveRow } from './list.ts';

export interface PageRead {
  ok: boolean;
  status: number | null;
  finalUrl: string;
  html: string;
  text: string;
  via: 'http' | 'browser';
  error?: string;
}

/** Reads a page the plain way (HTTP) or as a browser shows it. Returns null when the way is not available. */
export type Reader = (url: string, via: 'http' | 'browser') => Promise<PageRead | null>;

/** Cloudflare hides an address as hex: the first byte is the key, the rest is the address xor the key. */
export function decodeCfEmail(hex: string): string {
  const key = parseInt(hex.slice(0, 2), 16);
  let out = '';
  for (let i = 2; i + 1 < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
  return out;
}

const ADDRESS = /[a-z0-9._%+'-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi;

/** The visible words of a page's source, without scripts and styles. */
export function textOf(html: string): string {
  const $ = cheerio.load(html);
  $('script, style, noscript, template').remove();
  return $.root().text().replace(/\s+/g, ' ').trim();
}

/** Every email address a page's source shows: plain, in a mailto link, hidden by Cloudflare, or spelled with "at" and "dot". */
export function emailsInSource(html: string): string[] {
  const found = new Set<string>();
  const add = (s: string) => {
    for (const m of s.matchAll(ADDRESS)) found.add(m[0].toLowerCase().replace(/^[.'-]+|[.'-]+$/g, ''));
  };
  const $ = cheerio.load(html);
  $('[data-cfemail]').each((_, e) => add(decodeCfEmail($(e).attr('data-cfemail') ?? '')));
  $('a[href]').each((_, e) => {
    const href = $(e).attr('href') ?? '';
    const cf = href.match(/email-protection#([0-9a-f]+)/i);
    if (cf) add(decodeCfEmail(cf[1]!));
    else if (/^mailto:/i.test(href)) {
      try {
        add(decodeURIComponent(href.slice(7).split('?')[0]!));
      } catch {
        add(href.slice(7));
      }
    }
  });
  add($.root().text());
  add(html);
  // "name [at] domain [dot] co [dot] nz" and the like.
  const spelled = textOf(html).replace(/\s*[[({]\s*at\s*[\])}]\s*/gi, '@').replace(/\s*[[({]\s*dot\s*[\])}]\s*/gi, '.');
  add(spelled);
  return [...found];
}

const flat = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[-\u2010-\u2015]/g, ' ')
    .toLowerCase();

/** Whether one of the forms of a name stands as a word in the text. */
export function nameOnText(text: string, forms: string[]): boolean {
  const body = ` ${flat(text).replace(/[^\p{L}\p{N}']+/gu, ' ')} `;
  return forms.some((f) => body.includes(` ${flat(f).replace(/[^\p{L}\p{N}']+/gu, ' ').trim()} `));
}

export interface FactCheck {
  checkedAt: string;
  site: { ok: boolean; status: number | null; finalUrl: string; via: 'http' | 'browser'; movedTo: string | null };
  email: { address: string; sourceUrl: string; found: boolean; via: 'http' | 'browser' | null; seenOnPage: string[] };
  owners: { sourceUrl: string; names: { name: string; found: boolean }[]; via: 'http' | 'browser' | null; read: boolean };
  changed: string[];
}

async function firstThat(read: Reader, url: string, test: (p: PageRead) => boolean): Promise<{ page: PageRead | null; found: boolean; via: 'http' | 'browser' | null }> {
  const plain = await read(url, 'http');
  if (plain?.ok && test(plain)) return { page: plain, found: true, via: 'http' };
  const browser = await read(url, 'browser');
  if (browser?.ok && test(browser)) return { page: browser, found: true, via: 'browser' };
  const page = browser?.ok ? browser : plain?.ok ? plain : (browser ?? plain);
  return { page, found: false, via: page?.via ?? null };
}

/** The address in a list cell that may carry a note after it: "https://x.co.nz/ (guest testimonial)". */
export const urlIn = (cell: string): string => /https?:\/\/[^\s)]+/i.exec(cell)?.[0] ?? cell.trim();

/** Checks the list's facts for one business against the live site, with plain HTTP and string matching. Nothing is guessed or replaced. */
export async function verifyFacts(row: WaveRow, read: Reader, now: Date = new Date()): Promise<FactCheck> {
  const changed: string[] = [];

  const home = await firstThat(read, row.website, () => true);
  const homePage = home.page;
  const siteOk = !!homePage?.ok && homePage.status !== null && homePage.status >= 200 && homePage.status < 300;
  const moved = siteOk && domainOf(homePage!.finalUrl) !== domainOf(row.website) ? homePage!.finalUrl : null;
  if (!siteOk) changed.push(`the site does not answer (${homePage?.status ?? homePage?.error ?? 'no answer'})`);
  if (moved) changed.push(`the site now answers on another address: ${moved}`);

  let email: FactCheck['email'] = { address: row.email, sourceUrl: row.emailSourceUrl, found: false, via: null, seenOnPage: [] };
  if (!row.email) changed.push('the list has no email address');
  else if (!row.emailSourceUrl) changed.push('the list names no page for the email address');
  else {
    const want = row.email.toLowerCase();
    const r = await firstThat(read, urlIn(row.emailSourceUrl), (p) => emailsInSource(p.html).includes(want));
    email = { address: row.email, sourceUrl: row.emailSourceUrl, found: r.found, via: r.found ? r.via : null, seenOnPage: r.found || !r.page ? [] : emailsInSource(r.page.html).slice(0, 4) };
    if (!r.found) changed.push(r.page?.ok ? `${row.email} no longer appears on ${row.emailSourceUrl}` : `${row.emailSourceUrl} could not be read to find ${row.email}`);
  }

  const names = greetingNames(row.greeting);
  let owners: FactCheck['owners'] = { sourceUrl: row.ownerSource1, names: names.map((name) => ({ name, found: false })), via: null, read: false };
  if (!names.length) changed.push('the list has no greeting names');
  else if (!row.ownerSource1) changed.push('the list names no page for the owners');
  else {
    const forms = new Map(names.map((n) => [n, nameForms(n, row.ownerNames)]));
    const allFound = (p: PageRead) => names.every((n) => nameOnText(p.text || textOf(p.html), forms.get(n)!));
    const r = await firstThat(read, urlIn(row.ownerSource1), allFound);
    const text = r.page?.ok ? r.page.text || textOf(r.page.html) : '';
    owners = { sourceUrl: row.ownerSource1, names: names.map((name) => ({ name, found: !!text && nameOnText(text, forms.get(name)!) })), via: r.via, read: !!r.page?.ok };
    for (const n of owners.names) if (!n.found) changed.push(r.page?.ok ? `${n.name} does not appear on ${row.ownerSource1}` : `${row.ownerSource1} could not be read to find ${n.name}`);
  }

  return {
    checkedAt: now.toISOString(),
    site: { ok: siteOk, status: homePage?.status ?? null, finalUrl: homePage?.finalUrl ?? row.website, via: homePage?.via ?? 'http', movedTo: moved },
    email,
    owners,
    changed,
  };
}
