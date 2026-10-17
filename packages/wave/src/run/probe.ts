import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';
import { domainOf } from '@plumbline/core';
import type { Polite } from '@plumbline/fetch';
import type { PageCapture } from '@plumbline/render';
import { sameAddress } from '../pages.ts';
import { BOOKING_PATHS, pageSaysMissing } from './booking.ts';

export interface UnlinkedPage {
  url: string;
  title: string;
  status: number;
  pagesRead: number;
}

const fingerprint = (title: string, body: string) => `${title.trim().toLowerCase()}|${Math.round(body.length / 200)}`;

/**
 * Booking and enquiry pages at the usual addresses that load, are not a catch-all answer, and that
 * none of the pages we read links to. A site that answers every address with the same page is left out.
 */
export async function unlinkedBookingPages(polite: Polite, siteUrl: string, pages: PageCapture[]): Promise<UnlinkedPage[]> {
  const origin = new URL(siteUrl).origin;
  const nonsense = `/${createHash('sha1').update(siteUrl).digest('hex').slice(0, 10)}-no-such-page`;
  const baseline = await polite.get(origin + nonsense, { maxRedirects: 3, timeoutMs: 20_000, maxBytes: 200_000 });
  const catchAll = baseline.status !== null && baseline.status >= 200 && baseline.status < 300 ? fingerprint(cheerio.load(baseline.body)('title').first().text(), baseline.body) : null;
  const out: UnlinkedPage[] = [];
  for (const path of BOOKING_PATHS) {
    const res = await polite.get(origin + path, { maxRedirects: 3, timeoutMs: 20_000, maxBytes: 200_000 });
    if (res.status === null || res.status < 200 || res.status >= 300) continue;
    const $ = cheerio.load(res.body);
    const title = $('title').first().text().trim();
    if (pageSaysMissing(res.status, title, $('h1').first().text().trim())) continue;
    if (catchAll && fingerprint(title, res.body) === catchAll) continue;
    // A path that sends the visitor somewhere else is that other page's business.
    if (!sameAddress(res.finalUrl, origin + path) && new URL(res.finalUrl).pathname.replace(/\/$/, '') !== path) continue;
    if (pages.some((p) => p.links.some((l) => sameAddress(l.href, res.finalUrl)))) continue;
    if (out.some((o) => sameAddress(o.url, res.finalUrl))) continue;
    out.push({ url: res.finalUrl, title, status: res.status, pagesRead: pages.length });
  }
  return out;
}

export interface FormRef {
  pageUrl: string;
  kind: 'frame' | 'form';
  url: string;
}

const NOT_A_FORM = /(?:youtube|youtu\.be|vimeo|google\.com\/maps|maps\.google|facebook\.com\/plugins|instagram\.com|tripadvisor|spotify|soundcloud)/i;

/** Frames and form targets that carry an enquiry or booking form from somewhere else than the page itself. */
export function formRefs(pages: { url: string; html: string }[]): FormRef[] {
  const out: FormRef[] = [];
  const add = (r: FormRef) => out.some((o) => o.url === r.url) || out.push(r);
  for (const { url, html } of pages) {
    const $ = cheerio.load(html);
    $('iframe').each((_, e) => {
      const src = $(e).attr('src') ?? $(e).attr('data-src') ?? '';
      if (!src || NOT_A_FORM.test(src) || /^about:|^javascript:/i.test(src)) return;
      try {
        const abs = new URL(src, url).toString();
        if (domainOf(abs) !== domainOf(url) || /form|book|enquir|contact/i.test(abs)) add({ pageUrl: url, kind: 'frame', url: abs });
      } catch {
        // An address that cannot be read is not something to open.
      }
    });
    $('form[action]').each((_, e) => {
      const action = $(e).attr('action') ?? '';
      if (!action || action.startsWith('#') || /^javascript:|^mailto:/i.test(action) || $(e).find('input, textarea, select').length < 2) return;
      try {
        const abs = new URL(action, url).toString();
        if (domainOf(abs) !== domainOf(url)) add({ pageUrl: url, kind: 'form', url: abs });
      } catch {
        // Same as above.
      }
    });
  }
  return out;
}

export interface FormState extends FormRef {
  status: number | null;
  finalUrl: string;
  /** The address does not answer or says it is not found: the form cannot load. */
  broken: boolean;
  error: string | null;
}

/** Opens each form address once. A form that is posted to answers 405 to a plain request, which is not a fault. */
export async function checkForms(polite: Polite, refs: FormRef[], max = 6): Promise<FormState[]> {
  const out: FormState[] = [];
  for (const r of refs.slice(0, max)) {
    const res = await polite.get(r.url, { maxRedirects: 4, timeoutMs: 20_000, maxBytes: 100_000 });
    const gone = res.status === 404 || res.status === 410;
    const unreachable = res.status === null && !!res.error && res.error !== 'robots' && /ENOTFOUND|ECONNREFUSED|EAI_AGAIN|CERT|certificate|ECONNRESET/i.test(res.error);
    out.push({ ...r, status: res.status, finalUrl: res.finalUrl, broken: gone || unreachable, error: res.error ?? null });
  }
  return out;
}
