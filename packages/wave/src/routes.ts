import * as cheerio from 'cheerio';
import { fingerprintUrl } from '@plumbline/collect';
import type { PageCapture } from '@plumbline/render';

/** Booking and reservation systems the fingerprints do not carry, by the host their widgets load from. */
const MORE_BOOKING_HOSTS: [RegExp, string][] = [
  [/(^|\.)eveve\.com$/, 'Eveve'],
  [/(^|\.)resdiary\.com$/, 'ResDiary'],
  [/(^|\.)lodgify\.com$/, 'Lodgify'],
  [/(^|\.)bokun\.io$/, 'Bókun'],
  [/(^|\.)ibisnz\.com$/, 'IBIS'],
  [/(^|\.)rtbslive\.com$/, 'RTBS'],
  [/(^|\.)bookit\.co\.nz$/, 'Bookit'],
  [/(^|\.)resbook\.[a-z.]+$/, 'ResBook'],
  [/(^|\.)nowbookit\.com$/, 'Now Book It'],
  [/(^|\.)opentable\.[a-z.]+$/, 'OpenTable'],
];

function systemAt(url: string): string | null {
  const f = fingerprintUrl(url);
  if (f?.kind === 'system') return f.system;
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  return MORE_BOOKING_HOSTS.find(([re]) => re.test(host))?.[1] ?? null;
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return '';
  }
}

const BOOKING_FORM = /\b(book(ing|ings)?|reserv(e|ation|ations)|enquir(y|e|ies)|inquir(y|e|ies))\b/i;
const BOOKING_PAGE = /(^|[/_-])(book|booking|bookings|reserve|reservation|reservations)([/_.-]|$)/i;

/** Forms on a page that a visitor could use: one worded for a booking or an enquiry, and one with a box to write a message in. */
function formsOn(html: string): { booking: boolean; message: boolean } {
  if (!html) return { booking: false, message: false };
  const $ = cheerio.load(html);
  let booking = false;
  let message = false;
  $('form').each((_, el) => {
    const form = $(el);
    if (form.find('input:not([type=hidden]):not([type=search]), textarea, select').length < 2) return;
    if (form.find('textarea').length) message = true;
    const words = `${form.attr('id') ?? ''} ${form.attr('class') ?? ''} ${form.attr('action') ?? ''} ${form.text()} ${form.prevAll('h1, h2, h3').first().text()}`;
    if (BOOKING_FORM.test(words)) booking = true;
  });
  return { booking, message };
}

/**
 * Every way to book or enquire found on the business's own pages, in words a reader can check.
 * A finding that says the site takes no booking is wrong when any of these exists.
 */
export function bookingRoutesOn(pages: PageCapture[], html: (p: PageCapture) => string): string[] {
  const out = new Set<string>();
  for (const p of pages) {
    for (const url of [...p.links.map((l) => l.href), ...p.meta.iframes, ...p.meta.scripts, ...p.requestHosts.map((h) => `https://${h}/`)]) {
      const system = systemAt(url);
      if (system) out.add(`${system} on ${p.finalUrl}`);
    }
    const forms = formsOn(html(p));
    if (forms.booking) out.add(`a booking or enquiry form on ${p.finalUrl}`);
    else if (forms.message) out.add(`a contact form with a message box on ${p.finalUrl}`);
    if (p.ok && p.status === 200 && BOOKING_PAGE.test(pathOf(p.finalUrl))) out.add(`a booking page of their own at ${p.finalUrl}`);
  }
  return [...out];
}

/** Ways to get in touch on the homepage itself: email and phone links wherever they sit, and a form to write a message in. */
export function contactRoutesOn(homes: PageCapture[], html: (p: PageCapture) => string): string[] {
  const out = new Set<string>();
  const where = (l: PageCapture['links'][number]) => (l.inNav ? ' in the menu' : l.inFooter ? ' in the footer' : '');
  for (const p of homes) {
    for (const l of p.links) {
      if (/^mailto:/i.test(l.raw)) out.add(`an email link${where(l)}`);
      if (/^tel:/i.test(l.raw)) out.add(`a phone link${where(l)}`);
    }
    if (formsOn(html(p)).message) out.add('a contact form on the homepage');
  }
  return [...out];
}

const AGE_GATE = /\b(over (the age of )?18|under 18|18 years|legal drinking age|are you (over|of legal))\b/i;

/** Whether the homepage opens by asking the visitor's age, so that its first screen is the question and not the site. */
export function opensBehindAgeGate(homes: PageCapture[]): boolean {
  return homes.some((p) => AGE_GATE.test(p.text.slice(0, 400)));
}
