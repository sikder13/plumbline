import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import { HostLimiter, Polite } from '@plumbline/fetch';
import { Renderer } from '@plumbline/render';
import { parseCsv } from '../batch.ts';
import { toCsv } from '../pull.ts';
import { BOOK_DIRECT_GAP_MS, bookDirectPaths, type CandidateRow } from './discover.ts';
import { bookingFacts, emailsOnPage, fullSignal, greetingNamesOn, locationCount, phoneFacts, pickEmail, pickPages, sellsWebOrMarketing, visibleText, type FoundAddress, type SitePage } from './site.ts';
import { mxCheck, syntaxOk, type VerifyStatus } from './verify.ts';

/** The day in New Zealand, which is the day the address was seen for the people who will write to it. */
export function nzDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export interface ContactRow {
  slug: string;
  list: string;
  name: string;
  town: string;
  region: string;
  website: string;
  home_url: string;
  pages_read: number;
  emails_found: string;
  email: string;
  email_source_url: string;
  email_seen_on: string;
  email_how: string;
  verify_status: VerifyStatus | '';
  mx_hosts: string;
  verify_flags: string;
  greeting_names: string;
  phone_shown: string;
  phone_shown_on: string;
  tel_href: string;
  tel_works: string;
  booking_engine: string;
  booking_engine_kind: string;
  booking_url: string;
  booking_on: string;
  ota_links: string;
  engines: string;
  full_signal: string;
  full_signal_url: string;
  web_trade: boolean;
  locations: number;
  rendered: boolean;
  rating: string;
  rating_count: string;
  place_id: string;
  flags: string;
  gate: string;
  detail: string;
}

export const CONTACT_COLUMNS: (keyof ContactRow)[] = ['slug', 'list', 'name', 'town', 'region', 'website', 'home_url', 'pages_read', 'emails_found', 'email', 'email_source_url', 'email_seen_on', 'email_how', 'verify_status', 'mx_hosts', 'verify_flags', 'greeting_names', 'phone_shown', 'phone_shown_on', 'tel_href', 'tel_works', 'booking_engine', 'booking_engine_kind', 'booking_url', 'booking_on', 'ota_links', 'engines', 'full_signal', 'full_signal_url', 'web_trade', 'locations', 'rendered', 'rating', 'rating_count', 'place_id', 'flags', 'gate', 'detail'];

interface Cached {
  pages: (Omit<SitePage, 'html'> & { file: string | null })[];
  rendered: boolean;
  at: string;
}

const MAX_PAGES = 6;

/** Reads up to six pages of one site, from the cache when it was read before. */
async function readSite(polite: Polite, renderer: Renderer, renderLimit: <T>(fn: () => Promise<T>) => Promise<T>, c: CandidateRow, dir: string): Promise<{ pages: SitePage[]; rendered: boolean; error: string | null }> {
  const index = join(dir, 'pages.json');
  if (existsSync(index)) {
    const cached = JSON.parse(readFileSync(index, 'utf8')) as Cached;
    return { pages: cached.pages.map((p) => ({ ...p, html: p.file && existsSync(join(dir, p.file)) ? readFileSync(join(dir, p.file), 'utf8') : '' })), rendered: cached.rendered, error: null };
  }
  mkdirSync(dir, { recursive: true });
  const pages: SitePage[] = [];
  const get = async (url: string, role: string) => {
    const r = await polite.get(url, { maxRedirects: 6, timeoutMs: 25_000, maxBytes: 2_500_000 });
    const ok = r.status !== null && r.status >= 200 && r.status < 300;
    const page: SitePage = { url, finalUrl: r.finalUrl, status: r.status, html: ok && /<[a-z!]/i.test(r.body) ? r.body : '', role };
    pages.push(page);
    return { page, error: r.error ?? null };
  };
  let { page: home, error } = await get(c.website, 'home');
  if (!home.html && error !== 'robots') {
    // One more way in: the other scheme, or the address without its path.
    const u = new URL(c.website);
    const alt = u.pathname.length > 1 ? `${u.protocol}//${u.host}/` : `${u.protocol === 'https:' ? 'http:' : 'https:'}//${u.host}/`;
    pages.pop();
    ({ page: home, error } = await get(alt, 'home'));
  }
  let rendered = false;
  if (home.html) {
    for (const p of pickPages(home.html, home.finalUrl, MAX_PAGES - 1)) await get(p.url, p.role);
  }
  // A site that builds its words in the browser shows nothing to a plain request: open the homepage and the contact page in a browser.
  const found = pages.flatMap((p) => (p.html ? emailsOnPage(p.html, p.finalUrl) : []));
  const thin = !home.html || visibleText(cheerio.load(home.html)).length < 500;
  if (!found.length && thin && error !== 'robots') {
    rendered = true;
    await renderLimit(async () => {
      const targets = [{ url: home.html ? home.finalUrl : c.website, role: 'home' }];
      for (const t of targets.slice(0, 2)) {
        let html = '';
        const cap = await renderer
          .render({
            url: t.url,
            viewport: 'mobile',
            onPage: async (pg) => {
              html = await pg.content();
            },
          })
          .catch(() => null);
        if (cap?.ok && html) {
          pages.push({ url: t.url, finalUrl: cap.finalUrl, status: cap.status, html, role: `${t.role}-rendered` });
          if (t.role === 'home') {
            const contact = pickPages(html, cap.finalUrl, 2).find((p) => p.role === 'contact');
            if (contact) targets.push({ url: contact.url, role: 'contact' });
          }
        }
      }
    });
  }
  const cached: Cached = { pages: pages.map((p, i) => ({ url: p.url, finalUrl: p.finalUrl, status: p.status, role: p.role, file: p.html ? `${i}.html` : null })), rendered, at: new Date().toISOString() };
  pages.forEach((p, i) => p.html && writeFileSync(join(dir, `${i}.html`), p.html));
  writeFileSync(index, JSON.stringify(cached, null, 1));
  return { pages, rendered, error: home.html ? null : (error ?? `homepage answered ${home.status}`) };
}

const fmtEmails = (xs: FoundAddress[]) => xs.map((x) => `${x.email} (${x.how}, ${x.sourceUrl})`).join('; ');

export interface ContactsSummary {
  candidates: number;
  reachable: number;
  withEmail: number;
  mxOk: number;
  passed: number;
  rejected: Record<string, number>;
  rendered: number;
}

/**
 * Part 2, the gate: every candidate's own site is read (six pages at most, one request a second per
 * host), its published addresses are gathered with their pages, one is picked and checked for syntax
 * and MX. No address, or an address that fails, stops the candidate here.
 */
export async function captureContacts(opts: { lists?: string[]; parallel?: number; log?: (l: string) => void } = {}): Promise<{ rows: ContactRow[]; summary: ContactsSummary }> {
  const p = bookDirectPaths();
  const log = opts.log ?? (() => undefined);
  const all = parseCsv(readFileSync(join(p.leads, '_candidates.csv'), 'utf8')) as unknown as CandidateRow[];
  const cands = all.filter((c) => !opts.lists || opts.lists.includes(c.list));
  const polite = new Polite(new HostLimiter(BOOK_DIRECT_GAP_MS));
  const renderer = new Renderer(polite);
  const limit = pLimit(opts.parallel ?? 16);
  const renderLimit = pLimit(3);
  const mxCache = new Map<string, Promise<{ ok: boolean; hosts: string[]; error: string | null }>>();
  const seenOn = nzDate();
  const rows: ContactRow[] = [];
  let done = 0;
  try {
    await Promise.all(
      cands.map((c) =>
        limit(async () => {
          const dir = join(p.data, 'cache', 'sites', c.slug);
          let site: Awaited<ReturnType<typeof readSite>>;
          try {
            site = await readSite(polite, renderer, renderLimit, c, dir);
          } catch (e) {
            site = { pages: [], rendered: false, error: (e as Error).message.slice(0, 120) };
          }
          const pages = site.pages.filter((x) => x.html);
          const home = pages.find((x) => x.role.startsWith('home'));
          const found: FoundAddress[] = [];
          for (const pg of pages) for (const f of emailsOnPage(pg.html, pg.finalUrl)) if (!found.some((x) => x.email === f.email)) found.push(f);
          const chosen = pickEmail(found, home?.finalUrl ?? c.website, c.list === 'C');
          const booking = bookingFacts(pages);
          const phone = phoneFacts(pages);
          const full = fullSignal(pages);
          const greet = greetingNamesOn(pages);
          const web = home ? sellsWebOrMarketing(home.html) : false;
          const locations = home ? locationCount(home.html, home.finalUrl) : 0;
          let verify: VerifyStatus | '' = '';
          let mxHosts = '';
          const vflags: string[] = [];
          let gate = 'passed';
          let detail = '';
          if (!home) {
            gate = 'no_published_email';
            detail = `site not read: ${site.error ?? 'no answer'}`;
          } else if (web) {
            gate = 'web_or_marketing_business';
          } else if (locations > 4) {
            gate = 'chain_or_franchise';
            detail = `${locations} location pages linked from the homepage`;
          } else if (!chosen) {
            gate = 'no_published_email';
            detail = `no address on ${pages.length} page(s) read`;
          } else if (!syntaxOk(chosen.email)) {
            gate = 'invalid_email';
            verify = 'invalid';
            detail = 'syntax';
          } else {
            const domain = chosen.email.split('@')[1]!;
            if (!mxCache.has(domain)) mxCache.set(domain, mxCheck(chosen.email));
            const mx = await mxCache.get(domain)!;
            mxHosts = mx.hosts.join(' ');
            if (!mx.ok) {
              gate = 'invalid_email';
              verify = 'invalid';
              detail = `MX: ${mx.error}`;
            } else {
              // The single-address check is spent later, on the leads that reach qualification (100 credits).
              verify = 'mx_only';
              vflags.push('needs_verifier');
            }
          }
          const row: ContactRow = {
            slug: c.slug,
            list: c.list,
            name: c.name,
            town: c.town,
            region: c.region,
            website: c.website,
            home_url: home?.finalUrl ?? '',
            pages_read: pages.length,
            emails_found: fmtEmails(found),
            email: chosen?.email ?? '',
            email_source_url: chosen?.sourceUrl ?? '',
            email_seen_on: chosen ? seenOn : '',
            email_how: chosen?.how ?? '',
            verify_status: verify,
            mx_hosts: mxHosts,
            verify_flags: vflags.join(';'),
            greeting_names: greet.map((g) => `${g.name} (${g.role}; ${g.url})`).join(' | '),
            phone_shown: phone.shown ?? '',
            phone_shown_on: phone.shownOn ?? '',
            tel_href: phone.telHref ?? '',
            tel_works: phone.telWorks === null ? 'no tel link' : phone.telWorks ? 'yes' : 'no number',
            booking_engine: booking.engine,
            booking_engine_kind: booking.engineKind,
            booking_url: booking.bookingUrl,
            booking_on: booking.bookingOn,
            ota_links: booking.otaLinks.join(' '),
            engines: booking.engines.join(';'),
            full_signal: full?.phrase ?? '',
            full_signal_url: full?.url ?? '',
            web_trade: web,
            locations,
            rendered: site.rendered,
            rating: String(c.rating ?? ''),
            rating_count: String(c.rating_count ?? ''),
            place_id: c.place_id,
            flags: c.flags,
            gate,
            detail,
          };
          rows.push(row);
          if (++done % 25 === 0) log(`contacts: ${done}/${cands.length}`);
        }),
      ),
    );
  } finally {
    await renderer.stop();
  }
  rows.sort((a, b) => a.list.localeCompare(b.list) || a.slug.localeCompare(b.slug));
  // Rows of lists not read this time are kept as they were.
  const file = join(p.leads, '_contacts.csv');
  const kept = existsSync(file) && opts.lists ? (parseCsv(readFileSync(file, 'utf8')) as unknown as ContactRow[]).filter((r) => !opts.lists!.includes(r.list)) : [];
  const out = [...kept, ...rows];
  writeFileSync(file, toCsv(out, CONTACT_COLUMNS));
  writeFileSync(join(p.leads, '_verified.csv'), toCsv(out.filter((r) => r.gate === 'passed'), CONTACT_COLUMNS));
  writeFileSync(join(p.leads, '_rejected.csv'), toCsv(out.filter((r) => r.gate !== 'passed').map((r) => ({ slug: r.slug, list: r.list, name: r.name, town: r.town, website: r.website, reason: r.gate, detail: r.detail })), ['slug', 'list', 'name', 'town', 'website', 'reason', 'detail']));
  const rejected: Record<string, number> = {};
  for (const r of rows.filter((x) => x.gate !== 'passed')) rejected[r.gate] = (rejected[r.gate] ?? 0) + 1;
  return {
    rows,
    summary: { candidates: cands.length, reachable: rows.filter((r) => r.home_url).length, withEmail: rows.filter((r) => r.email).length, mxOk: rows.filter((r) => r.verify_status === 'mx_only').length, passed: rows.filter((r) => r.gate === 'passed').length, rejected, rendered: rows.filter((r) => r.rendered).length },
  };
}
