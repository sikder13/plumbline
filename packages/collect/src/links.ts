import pLimit from 'p-limit';
import { config, normalizeUrl, sameSite } from '@plumbline/core';
import type { Polite } from '@plumbline/fetch';
import type { PageCapture, PageLink } from '@plumbline/render';
import type { LinkSighting, LinkStatus } from './types.ts';

export interface ContactLinkProblem {
  link: PageLink;
  kind: 'mailto' | 'tel' | 'whatsapp' | 'messenger' | 'scheme';
  problem: string;
}

const EMAIL_OK = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

/** Checks the form of one link. Returns null when there is nothing wrong with it. */
export function contactLinkProblem(link: Pick<PageLink, 'raw' | 'href'>): Omit<ContactLinkProblem, 'link'> | null {
  const raw = link.raw.trim();
  const lower = raw.toLowerCase();

  if (lower.startsWith('mailto:')) {
    const address = decodeURIComponent(raw.slice(7).split('?')[0] ?? '').trim();
    if (!address) return { kind: 'mailto', problem: 'The email link has no address.' };
    const bad = address.split(/[,;]/).map((a) => a.trim()).filter((a) => a && !EMAIL_OK.test(a));
    if (bad.length) return { kind: 'mailto', problem: `The email link holds "${bad[0]}", which is not an email address.` };
    return null;
  }
  if (lower.startsWith('tel:')) {
    const number = decodeURIComponent(raw.slice(4)).trim();
    const digits = number.replace(/\D/g, '');
    if (!digits) return { kind: 'tel', problem: 'The phone link has no number.' };
    if (digits.length < 7) return { kind: 'tel', problem: `The phone link holds "${number}", which is too short to dial.` };
    if (/[a-z]{3,}/i.test(number.replace(/ext\.?|x/gi, ''))) return { kind: 'tel', problem: `The phone link holds "${number}", which is not a phone number.` };
    return null;
  }
  if (/^https?:\/\/https?(:|\/|%3a)/i.test(raw) || /^https?:\/\/https?$/i.test(raw) || /^https?:\/\/Http/.test(raw)) {
    return { kind: 'scheme', problem: `The link address repeats the scheme: "${raw.slice(0, 80)}".` };
  }
  if (/^https?:\/\/(www\.)?m\.me(\/|$)/i.test(raw)) {
    const rest = raw.replace(/^https?:\/\/(www\.)?m\.me\/?/i, '');
    if (!rest || /^https?:|^www\.|facebook\.com/i.test(rest)) return { kind: 'messenger', problem: `The Messenger link is malformed: "${raw.slice(0, 80)}".` };
    return null;
  }
  if (/^https?:\/\/(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)(\/|$)/i.test(raw) || lower.startsWith('whatsapp:')) {
    const digits = /^https?:\/\/wa\.me\//i.test(raw) ? (raw.replace(/^https?:\/\/wa\.me\//i, '').split(/[/?]/)[0] ?? '').replace(/\D/g, '') : (/phone=([^&]*)/i.exec(raw)?.[1] ?? '').replace(/\D/g, '');
    if (digits.length < 7) return { kind: 'whatsapp', problem: `The WhatsApp link has no usable phone number: "${raw.slice(0, 80)}".` };
    return null;
  }
  return null;
}

export function contactLinkProblems(page: PageCapture): ContactLinkProblem[] {
  const out: ContactLinkProblem[] = [];
  for (const link of page.links) {
    if (!link.visible) continue;
    const p = contactLinkProblem(link);
    if (p) out.push({ link, ...p });
  }
  return out;
}

const SKIP_EXT = /\.(jpe?g|png|gif|webp|svg|ico|css|js|woff2?|ttf|mp4|mov|zip)(\?|$)/i;

/** Status of each distinct visible link, internal ones first, within the caps. */
export async function checkLinks(polite: Polite, pages: PageCapture[], homepageUrl: string): Promise<LinkStatus[]> {
  const byUrl = new Map<string, LinkStatus>();
  const known = new Map<string, number | null>();
  for (const page of pages) {
    known.set(normalizeUrl(page.url) ?? page.url, page.status);
    known.set(normalizeUrl(page.finalUrl) ?? page.finalUrl, page.status);
  }

  for (const page of pages) {
    for (const link of page.links) {
      if (!link.visible) continue;
      const url = normalizeUrl(link.href);
      if (!url || SKIP_EXT.test(url)) continue;
      const sighting: LinkSighting = { pageUrl: page.finalUrl, viewport: page.viewport, text: link.text, selector: link.selector, box: link.box, inNav: link.inNav || link.inHeader, raw: link.raw };
      const existing = byUrl.get(url);
      if (existing) {
        if (existing.seen.length < 5) existing.seen.push(sighting);
        continue;
      }
      byUrl.set(url, { url, internal: sameSite(url, homepageUrl), status: null, error: null, finalUrl: url, skipped: null, seen: [sighting] });
    }
  }

  const all = [...byUrl.values()];
  const internal = all.filter((l) => l.internal).slice(0, config.links.maxInternal);
  const external = all.filter((l) => !l.internal).slice(0, config.links.maxExternal);
  const limit = pLimit(6);

  await Promise.all(
    [...internal, ...external].map((link) =>
      limit(async () => {
        if (known.has(link.url) && known.get(link.url) !== null) {
          link.status = known.get(link.url)!;
          return;
        }
        if (link.internal && !(await polite.robots.allows(link.url))) {
          link.skipped = 'robots';
          return;
        }
        const res = await polite.status(link.url);
        link.status = res.status;
        link.error = res.error ?? null;
        link.finalUrl = res.finalUrl;
      }),
    ),
  );
  return [...internal, ...external];
}

/** A status that means the page is really gone, not a server turning away an automated request. */
export function isBrokenStatus(status: number | null): boolean {
  return status === 404 || status === 410 || (status !== null && status >= 500 && status !== 503);
}
