import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as cheerio from 'cheerio';
import { HostLimiter, Polite } from '@plumbline/fetch';
import { BOOK_DIRECT_GAP_MS } from '../discover.ts';
import { engineOf } from '../engines.ts';
import { Shooter, type Visit } from '../sweep/browser.ts';
import { allowHost } from '../sweep/config.ts';

/** One finding to prove again: the link or page the sweep flagged, as a visitor meets it. */
export interface ProofTarget {
  slug: string;
  flag: 'booking_link_broken' | 'main_nav_404' | 'not_secure' | 'cert_failure';
  /** The page the control sits on. */
  page: string;
  /** The words of the control, as the sweep read them. */
  linkText: string;
  /** Where the control goes. For not_secure and cert_failure, the page itself. */
  target: string;
  /** The sweep's picture of the same finding. */
  sweepShot: string | null;
}

export interface Proof extends ProofTarget {
  checkedAt: string;
  status: number | null;
  finalUrl: string;
  error: string | null;
  security: string | null;
  /** What the page says: its title and its first words. */
  says: string;
  holds: boolean;
  why: string;
  shotNow: string | null;
  shotSweep: string | null;
  /** Book controls a visitor sees on the page, with where each goes (for not_secure: the control on the http page). */
  controls: { text: string; href: string }[];
}

const MISSING = /\b(?:404|not found|can['’]?t be found|cannot be found|could not be found|can['’]?t (?:seem to )?find|doesn['’]?t exist|does not exist|no longer exists|page you(?:['’]re| are| were) looking for|something went wrong|error|no booking page|nothing was found)\b/i;

/**
 * Whether a booking or menu link is still broken, judged by what a visitor sees. The page must say it
 * is missing, and either answer with an error status or be a short page: a link that answers 404 but
 * shows a working booking form is not broken to the person who taps it. A page the browser cannot open
 * at all is broken.
 */
export function stillBroken(p: { status: number | null; getStatus: number | null; error?: string | null; title: string; text: string; frameText?: string }): { holds: boolean; bad: boolean; missing: boolean } {
  const bad = (p.status !== null && p.status >= 400) || (p.getStatus !== null && p.getStatus >= 400);
  const missing = MISSING.test(`${p.title} ${p.text.slice(0, 1500)} ${(p.frameText ?? '').slice(0, 1500)}`);
  const short = p.text.replace(/\s+/g, ' ').trim().length < 1500;
  return { holds: !!p.error || (missing && (bad || short)), bad, missing };
}

/** The visible Book controls on a rendered page: links and buttons whose words ask to book or reserve. */
export function bookControls(html: string, base: string): { text: string; href: string }[] {
  const $ = cheerio.load(html);
  const out = new Map<string, { text: string; href: string }>();
  $('a, button').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim() || ($(el).attr('aria-label') ?? '') || ($(el).find('img').attr('alt') ?? '');
    if (!/\b(?:book|bookings?|reserv|availability)\b/i.test(text) || text.length > 40) return;
    const raw = $(el).attr('href') ?? '';
    let href: string;
    try {
      href = raw ? new URL(raw, base).toString() : '';
    } catch {
      href = raw;
    }
    if (!out.has(`${text}|${href}`)) out.set(`${text}|${href}`, { text, href });
  });
  return [...out.values()];
}

/**
 * Step 1 of a page batch: every finding fetched and photographed again, now. A finding holds only if
 * it shows again: the link still fails, the menu page is still missing, Chrome still warns or still
 * says "Not secure" on the page that carries the Book control.
 */
export async function reproveAll(targets: ProofTarget[], dir: string, opts: { log?: (l: string) => void } = {}): Promise<Proof[]> {
  const polite = new Polite(new HostLimiter(BOOK_DIRECT_GAP_MS));
  const sh = new Shooter(polite);
  const out: Proof[] = [];
  try {
    for (const t of targets) {
      const folder = join(dir, t.slug, 'proof');
      mkdirSync(folder, { recursive: true });
      const shotSweep = t.sweepShot && existsSync(t.sweepShot) ? join(folder, `sweep-${t.flag}.png`) : null;
      if (shotSweep) copyFileSync(t.sweepShot!, shotSweep);
      const checkedAt = new Date().toISOString();
      const shot = join(folder, `now-${t.flag}.png`);
      let v: Visit;
      let get: { status: number | null; finalUrl: string; error: string | null } = { status: null, finalUrl: t.target, error: null };
      if (t.flag === 'booking_link_broken' || t.flag === 'main_nav_404') {
        if (allowHost(new URL(t.target).hostname)) {
          const r = await polite.get(t.target, { maxRedirects: 8, timeoutMs: 25_000, maxBytes: 1_000_000 });
          get = { status: r.status, finalUrl: r.finalUrl, error: r.error ?? null };
        }
        v = await sh.visit(t.target, { shot, banner: [`"${t.linkText}" on ${t.page}`, `${t.target}: ${new Date(checkedAt).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' })} NZ time`], html: true, frames: true });
      } else {
        v = await sh.visit(t.target, { shot, banner: [t.flag === 'cert_failure' ? 'Chrome on a phone, opening the site' : 'Chrome shows: ⚠ Not secure', `${t.target}: ${new Date(checkedAt).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' })} NZ time`], html: true });
      }
      const says = `${v.title} | ${v.text.replace(/\s+/g, ' ').trim().slice(0, 200)}`;
      const status = v.status ?? get.status;
      let holds = false;
      let why = '';
      if (t.flag === 'booking_link_broken' || t.flag === 'main_nav_404') {
        const { holds: broken, bad, missing } = stillBroken({ status, getStatus: get.status, error: v.error, title: v.title, text: v.text, frameText: v.frames.map((f) => f.text).join(' ') });
        holds = broken;
        why = holds ? `${v.error ? `the browser cannot open it (${v.error})` : `answers ${status}`}${missing ? ', and the page says it is missing' : ''}` : `${bad ? `answers ${status}, but the page shows` : `opened with ${status}:`} ${says.slice(0, 160)}`;
      } else if (t.flag === 'cert_failure') {
        holds = !!v.certError;
        why = holds ? `Chrome refuses the certificate (${v.certError})` : 'the certificate is accepted now';
      } else {
        holds = v.security === 'insecure' || v.security === 'insecure-broken';
        why = holds ? `Chrome's address bar: ${v.security}` : `Chrome's address bar: ${v.security ?? 'not reported'}`;
      }
      const controls = v.html ? bookControls(v.html, v.finalUrl) : [];
      if (t.flag === 'not_secure' && holds && !controls.length) {
        holds = false;
        why = `${why}, but no Book control is on the page`;
      }
      // A certificate failure is proven by Chrome's own warning, taken before the browser was let past it.
      const warning = shot.replace(/\.png$/, '-warning.png');
      const shotNow = t.flag === 'cert_failure' && existsSync(warning) ? warning : existsSync(shot) ? shot : existsSync(warning) ? warning : null;
      const p: Proof = { ...t, checkedAt, status, finalUrl: v.finalUrl, error: v.error ?? v.certError, security: v.security, says, holds: holds && !!shotNow, why: shotNow ? why : `${why} (no picture)`, shotNow, shotSweep, controls };
      out.push(p);
      opts.log?.(`${t.slug} ${t.flag}: ${p.holds ? 'HOLDS' : 'does not hold'}: ${p.why}`);
    }
  } finally {
    await sh.stop();
  }
  writeFileSync(join(dir, 'reproof.json'), JSON.stringify(out, null, 1));
  return out;
}

/** Engines named by the addresses a site links to. */
export function enginesIn(urls: string[]): string[] {
  return [...new Set(urls.map((u) => engineOf(u)?.name).filter((x): x is string => !!x))];
}
