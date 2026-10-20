import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import { HostLimiter, Polite } from '@plumbline/fetch';
import { parseCsv } from '../../batch.ts';
import { nzDate } from '../contacts.ts';
import { BOOK_DIRECT_GAP_MS } from '../discover.ts';
import { hasPhrase, hostIn } from '../filters.ts';
import { loadSweepConfig } from './config.ts';
import { bookingFacts, emailsOnPage, greetingNamesOn, locationCount, sellsWebOrMarketing, type Greeting } from '../site.ts';
import { mxCheck } from '../verify.ts';
import { bookingLinks, crawlSite, hasAvailabilityForm, homeOf, linkedinLinks, otaLinks, phonesOnSite, sitePages, type BookingLink, type CrawlPage, type MenuItem, type SitePhone } from './crawl.ts';
import type { SweepCandidate } from './discover.ts';
import { sweepPaths } from './discover.ts';
import { followBooking, type Follow } from './follow.ts';

export interface SiteEmail {
  email: string;
  on: string;
  how: string;
  mxOk: boolean | null;
  mxHosts: string[];
  mxError: string | null;
}

/** Everything read from one site before any browser opens it. */
export interface Gathered {
  domain: string;
  candidate: SweepCandidate;
  gatheredAt: string;
  seenOn: string;
  homeUrl: string;
  homeStatus: number | null;
  homeError: string | null;
  homeTries: Pick<CrawlPage, 'url' | 'finalUrl' | 'status' | 'error' | 'redirects'>[];
  pages: Omit<CrawlPage, 'file' | 'fetchedAt'>[];
  menu: MenuItem[];
  emails: SiteEmail[];
  phones: { shown: SitePhone[]; tel: SitePhone[] };
  linkedin: { url: string; on: string }[];
  names: Greeting[];
  booking: BookingLink[];
  engines: string[];
  follows: Follow[];
  ota: { name: string; url: string; on: string; text: string }[];
  availabilityForm: string | null;
  excluded: string | null;
  /** 'browser' when the homepage's contacts came from the browser because a plain request could not read them. */
  readBy?: string;
}

/** Plain top-level domains an address can end in; anything else is a word run into the address by the page. */
const TLD = /\.(?:nz|com|net|org|co|io|au|biz|info|me|uk|us|ca|online|site|store|health|kiwi|net\.nz|app|email|xyz|studio|life|vet|dental|dentist|clinic|travel|tours|fitness|salon|beauty|cafe|restaurant|education|global|world|club|services|solutions|group|ltd|limited|tech|digital|pro|design|cloud|live|shop|nz\.com)$/i;

export function plausibleEmail(e: string): boolean {
  return TLD.test(e.split('@')[1] ?? '') && !isPlaceholderEmail(e);
}

/** A template's sample address or a web address run into an email: not a mailbox anyone meant to publish. */
export function isPlaceholderEmail(e: string): boolean {
  const [local = '', domain = ''] = e.toLowerCase().split('@');
  return /^(?:my|your|the|some|sample|demo|test)?domain\.|^(?:example|email|mail|website|company|business|yoursite|mysite|site)\.(?:com|co\.nz|nz)$|^(?:wix|godaddy|squarespace)/.test(domain) || /^www\.|facebook|instagram|^(?:name|youremail|your\.name|firstname|user)$/.test(local);
}

/** Alcohol or wine said in the homepage's own title, heading or description: a wine tour or a bar in all but name. */
function faithOnSite(industry: string, homeHtml: string): string | null {
  if (!['hospitality', 'tourism'].includes(industry)) return null;
  const $ = cheerio.load(homeHtml);
  const head = `${$('title').text()} ${$('h1').first().text()} ${$('meta[name="description"]').attr('content') ?? ''}`;
  const m = /\b(?:wine tours?|winery tours?|wineries|cellar doors?|brewery|craft beer|cocktail bar|wine bar|gastropub|tavern|taphouse|bar & (?:restaurant|grill|kitchen|eatery)|bar and (?:restaurant|grill|kitchen|eatery))\b/i.exec(head);
  return m ? `"${m[0]}" in the homepage title or heading` : null;
}

export function loadCandidates(sweep: string): SweepCandidate[] {
  return parseCsv(readFileSync(join(sweepPaths(sweep).dir, '_candidates.csv'), 'utf8')) as unknown as SweepCandidate[];
}

/**
 * Stage 1 of a sweep, network reads only: each site's eight pages, every booking address followed, every
 * published address's domain checked for a mail server. Saved per site; a site already gathered is read
 * back unless `refresh` is set.
 */
export async function gatherAll(sweep: string, opts: { parallel?: number; only?: string[]; refresh?: boolean; log?: (l: string) => void } = {}): Promise<Gathered[]> {
  const sp = sweepPaths(sweep);
  const log = opts.log ?? (() => undefined);
  mkdirSync(join(sp.sites), { recursive: true });
  let cands = loadCandidates(sweep);
  if (opts.only) cands = cands.filter((c) => opts.only!.includes(c.domain));
  const polite = new Polite(new HostLimiter(BOOK_DIRECT_GAP_MS));
  const limit = pLimit(opts.parallel ?? 24);
  const mxCache = new Map<string, ReturnType<typeof mxCheck>>();
  const seenOn = nzDate();
  const out: Gathered[] = [];
  let done = 0;
  await Promise.all(
    cands.map((c) =>
      limit(async () => {
        const file = join(sp.sites, `${c.domain}.gather.json`);
        if (!opts.refresh && existsSync(file)) {
          out.push(JSON.parse(readFileSync(file, 'utf8')) as Gathered);
          done++;
          return;
        }
        let g: Gathered;
        try {
          g = await gatherOne(polite, c, sp.crawlCache, mxCache, seenOn, opts.refresh);
        } catch (e) {
          g = emptyGathered(c, seenOn, `gather failed: ${(e as Error).message.slice(0, 120)}`);
        }
        writeFileSync(file, JSON.stringify(g, null, 1));
        out.push(g);
        if (++done % 25 === 0) log(`gathered ${done}/${cands.length}`);
      }),
    ),
  );
  return out;
}

function emptyGathered(c: SweepCandidate, seenOn: string, error: string): Gathered {
  return { domain: c.domain, candidate: c, gatheredAt: new Date().toISOString(), seenOn, homeUrl: '', homeStatus: null, homeError: error, homeTries: [], pages: [], menu: [], emails: [], phones: { shown: [], tel: [] }, linkedin: [], names: [], booking: [], engines: [], follows: [], ota: [], availabilityForm: null, excluded: null };
}

async function gatherOne(polite: Polite, c: SweepCandidate, cacheDir: string, mxCache: Map<string, ReturnType<typeof mxCheck>>, seenOn: string, refresh?: boolean): Promise<Gathered> {
  const site = await crawlSite(polite, { domain: c.domain, website: c.website }, cacheDir, { refresh });
  const home = homeOf(site);
  const last = site.homeTries[site.homeTries.length - 1];
  const pages = sitePages(site);
  const g = emptyGathered(c, seenOn, '');
  g.homeUrl = home?.finalUrl ?? '';
  g.homeStatus = home?.status ?? last?.status ?? null;
  g.homeError = home ? null : (last?.error ?? (last?.status ? `answered ${last.status}` : 'no answer'));
  g.homeTries = site.homeTries.map(({ url, finalUrl, status, error, redirects }) => ({ url, finalUrl, status, error, redirects }));
  g.pages = site.pages.map(({ file: _f, fetchedAt: _a, ...rest }) => rest);
  g.menu = site.menu;
  if (!pages.length) return g;
  const homeHtml = pages[0]!.html;
  if (sellsWebOrMarketing(homeHtml)) g.excluded = 'web_or_marketing_business';
  else if (locationCount(homeHtml, pages[0]!.finalUrl) > 4) g.excluded = 'chain_or_franchise (more than four location pages)';
  else {
    const f = faithOnSite(c.industry, homeHtml);
    if (f) g.excluded = `faith_screen: ${f}`;
  }
  const emails = new Map<string, SiteEmail>();
  for (const p of pages) for (const e of emailsOnPage(p.html, p.finalUrl)) if (!emails.has(e.email)) emails.set(e.email, { email: e.email, on: e.sourceUrl, how: e.how, mxOk: null, mxHosts: [], mxError: null });
  for (const e of emails.values()) {
    if (!plausibleEmail(e.email)) {
      e.mxError = 'not checked: the address does not end in a known domain ending';
      continue;
    }
    const domain = e.email.split('@')[1]!;
    if (!mxCache.has(domain)) mxCache.set(domain, mxCheck(e.email));
    const mx = await mxCache.get(domain)!;
    e.mxOk = mx.ok;
    e.mxHosts = mx.hosts;
    e.mxError = mx.error;
  }
  g.emails = [...emails.values()];
  g.phones = phonesOnSite(pages);
  g.linkedin = linkedinLinks(pages);
  g.names = greetingNamesOn(pages);
  g.booking = bookingLinks(pages);
  g.engines = bookingFacts(pages).engines;
  g.ota = otaLinks(pages);
  g.availabilityForm = hasAvailabilityForm(pages);
  g.follows = await followBooking(polite, g.booking, [...site.homeTries, ...site.pages], site.html);
  return g;
}

/**
 * Directories, booking platforms and chains added to the config after a sweep's discovery: a site read
 * under an earlier list is marked excluded, with the reason, so it is never counted as checked or flagged.
 */
export function applyLateExclusions(sweep: string): string[] {
  const cfg = loadSweepConfig();
  const dir = sweepPaths(sweep).sites;
  const marked: string[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.gather.json'))) {
    const g = JSON.parse(readFileSync(join(dir, f), 'utf8')) as Gathered;
    if (g.excluded) continue;
    const ind = cfg.industries.find((i) => i.id === g.candidate.industry);
    const lat = Number(g.candidate.lat);
    const lng = Number(g.candidate.lng);
    const outsideNz = g.candidate.lat !== '' && (lat > -33 || lat < -48 || lng < 165 || lng > 179);
    const why = outsideNz
      ? `outside_new_zealand (the listing is at ${g.candidate.address || `${lat}, ${lng}`})`
      : hostIn(g.domain, cfg.directories)
      ? 'directory_or_platform_website (a booking, ordering or listing platform page; listed after discovery)'
      : ind?.chains.some((c) => hasPhrase(g.candidate.name, c))
        ? 'chain_or_franchise (listed after discovery)'
        : null;
    if (!why) continue;
    g.excluded = why;
    writeFileSync(join(dir, f), JSON.stringify(g, null, 1));
    marked.push(g.domain);
  }
  return marked;
}
