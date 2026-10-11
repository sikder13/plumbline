import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { ROBOTS_PRODUCT_TOKEN, normalizeUrl, paths, sameSite, utcDay, utcIso, type Business, type Viewport } from '@plumbline/core';
import { PageBudget, hasOwnGroup, isAllowedByRobots, outcomeAllows, type Polite, type RobotsOutcome } from '@plumbline/fetch';
import type { PageCapture, Renderer } from '@plumbline/render';
import { runAxe } from './axe.ts';
import { bookingSignals } from './booking.ts';
import { runLighthouse } from './lighthouse.ts';
import { checkLinks } from './links.ts';
import { fetchListings } from './listings.ts';
import { findSitemap, structuredData } from './search.ts';
import { detectTechnologies, eolHits } from './tech.ts';
import type { AxeViolation, RobotsFacts, SiteData } from './types.ts';

export const SEARCH_AND_AI_BOTS = ['Googlebot', 'Bingbot', 'OAI-SearchBot', 'PerplexityBot'];

const PAGE_WORDS: [RegExp, number][] = [
  [/\b(book|booking|bookings|reserve|reservations?|availability|tickets?)\b/i, 10],
  [/\b(contact|find us|get in touch|enquir|inquir)/i, 9],
  [/\b(prices?|pricing|rates?|costs?|fares?)\b/i, 9],
  [/\b(tours?|trips?|charters?|cruises?|experiences?|activit|adventures?|kayak|fishing|walks?|treks?|trekking|rides?|tastings?|cellar door|what we do|options|packages|hire|rentals?)\b/i, 8],
  [/\b(about|our story|team|crew|meet|who we are|guides?|skipper|history)\b/i, 7],
  [/\b(faqs?|questions|info|information|what to bring|season|timetable|schedule|times)\b/i, 5],
  [/\b(gallery|photos|reviews|testimonials)\b/i, 2],
  [/\b(blog|news|privacy|terms|conditions|policy|sitemap|login|cart|account)\b/i, -4],
];
const NOT_A_PAGE = /\.(pdf|jpe?g|png|gif|webp|svg|zip|docx?|xlsx?|mp4|mp3|ics)(\?|$)|\/(wp-admin|wp-login|feed|cart|checkout|my-account|tag|category|author)\b|[?&](replytocom|add-to-cart|share)=/i;

export interface InnerChoice {
  url: string;
  score: number;
  text: string;
}

/** Internal pages worth reading, best first: booking, contact, prices, the experiences, about. */
export function chooseInnerPages(homepages: PageCapture[], homepageUrl: string, max: number): InnerChoice[] {
  const byUrl = new Map<string, InnerChoice>();
  const home = (normalizeUrl(homepageUrl) ?? homepageUrl).replace(/\/$/, '');
  for (const page of homepages) {
    for (const link of page.links) {
      if (!link.visible && !link.inNav) continue;
      const url = normalizeUrl(link.href)?.replace(/([^:])\/{2,}/g, '$1/');
      if (!url || !sameSite(url, homepageUrl) || NOT_A_PAGE.test(url)) continue;
      const key = url.replace(/\/$/, '');
      if (key === home || key === home.replace('://www.', '://') || key.replace('://www.', '://') === home) continue;
      if (new URL(url).pathname === '/' && !new URL(url).search) continue;
      let score = link.inNav || link.inHeader ? 3 : 0;
      const hay = `${link.text} ${decodeURIComponent(new URL(url).pathname).replace(/[-_/]+/g, ' ')}`;
      for (const [re, weight] of PAGE_WORDS) if (re.test(hay)) score += weight;
      if (new URL(url).search) score -= 2;
      const prev = byUrl.get(key);
      if (!prev || score > prev.score) byUrl.set(key, { url, score, text: link.text });
    }
  }
  return [...byUrl.values()].sort((a, b) => b.score - a.score || a.url.length - b.url.length).slice(0, max);
}

export function robotsFacts(raw: { status: number | null; body: string; outcome: RobotsOutcome }, homepageUrl: string, keyPages: string[]): RobotsFacts {
  const outcome = raw.outcome;
  const pages = [homepageUrl, ...keyPages];
  const botBlocks = SEARCH_AND_AI_BOTS.map((bot) => {
    if (outcome.kind !== 'rules') return { bot, ownGroup: false, blocked: [] as string[] };
    const blocked = pages.filter((u) => {
      const { pathname, search } = new URL(u);
      return !isAllowedByRobots(outcome.robots, bot, pathname + search);
    });
    return { bot, ownGroup: hasOwnGroup(outcome.robots, bot), blocked };
  });
  return {
    status: raw.status,
    outcome: outcome.kind,
    body: raw.body.slice(0, 20_000),
    blocksHomepage: !outcomeAllows(outcome, ROBOTS_PRODUCT_TOKEN, homepageUrl),
    sitemaps: outcome.kind === 'rules' ? outcome.robots.sitemaps : [],
    botBlocks,
  };
}

export interface SiteOptions {
  runId: number;
  kind: SiteData['kind'];
  innerPages?: number;
  listingUrls?: string[];
  /** Runs on the live homepage at each viewport, after the standard capture. */
  onHomepage?: (page: Page, capture: PageCapture, viewport: Viewport) => Promise<void>;
  dir?: string;
}

export function runDir(runId: number): string {
  return join(paths.captures, String(runId));
}

function pageDir(base: string, viewport: Viewport, url: string): string {
  return join(base, `${viewport}-${createHash('sha1').update(url).digest('hex').slice(0, 10)}`);
}

/** Everything about one site except the speed measurements, which run in their own phase. */
export async function collectSite(polite: Polite, renderer: Renderer, business: Business, opts: SiteOptions): Promise<SiteData> {
  const startedAt = utcIso();
  const website = business.website!;
  const homepageUrl = normalizeUrl(website) ?? website;
  const dir = opts.dir ?? runDir(opts.runId);
  mkdirSync(dir, { recursive: true });
  const budget = new PageBudget();
  const errors: string[] = [];

  const site: SiteData = {
    runId: opts.runId,
    kind: opts.kind,
    startedAt,
    finishedAt: startedAt,
    business: {
      id: business.id,
      slug: business.slug,
      name: business.name,
      website,
      domain: business.domain,
      region: business.region,
      town: business.town,
      activity: business.activity,
      googleRating: business.google_rating,
      googleReviewCount: business.google_review_count,
    },
    homepageUrl,
    robots: { status: null, outcome: 'allow_all', body: '', blocksHomepage: false, sitemaps: [], botBlocks: [] },
    blocked: null,
    homepage: { mobile: null, desktop: null },
    inner: [],
    links: [],
    lighthouse: { mobile: null, desktop: null },
    axe: { mobile: null, desktop: null },
    technologies: [],
    eol: [],
    booking: [],
    structuredData: null,
    sitemap: { found: false, url: null, urls: 0 },
    https: { homepageScheme: new URL(homepageUrl).protocol.replace(':', ''), certError: false, httpUpgrades: null },
    listings: [],
    errors,
  };
  const finish = () => {
    site.finishedAt = utcIso();
    writeFileSync(join(dir, 'site.json'), JSON.stringify(site));
    return site;
  };

  const rawRobots = await polite.robots.raw(homepageUrl);
  site.robots = robotsFacts(rawRobots, homepageUrl, []);
  if (site.robots.blocksHomepage) {
    site.blocked = 'robots_blocks_homepage';
    return finish();
  }

  const axe: Record<Viewport, AxeViolation[] | null> = { mobile: null, desktop: null };
  for (const viewport of ['mobile', 'desktop'] as const) {
    if (viewport === 'mobile') budget.take();
    const cap = await renderer.render({
      url: homepageUrl,
      viewport,
      outDir: pageDir(dir, viewport, homepageUrl),
      onPage: async (page, capture) => {
        try {
          axe[viewport] = await runAxe(page);
        } catch (e) {
          errors.push(`axe ${viewport}: ${(e as Error).message.slice(0, 120)}`);
        }
        if (opts.onHomepage) {
          try {
            await opts.onHomepage(page, capture, viewport);
          } catch (e) {
            errors.push(`homepage hook ${viewport}: ${(e as Error).message.slice(0, 120)}`);
          }
        }
      },
    });
    site.homepage[viewport] = cap;
    if (cap.error) errors.push(`homepage ${viewport}: ${cap.error}`);
  }
  site.axe = axe;

  const home = site.homepage.mobile?.ok ? site.homepage.mobile : site.homepage.desktop?.ok ? site.homepage.desktop : null;
  if (!home) {
    site.blocked = site.homepage.mobile?.blocked === 'robots' ? 'robots_blocks_homepage' : 'unreachable';
    return finish();
  }
  // Work from where the homepage actually lives, so www and https redirects do not look like another site.
  const base = home.finalUrl;
  site.https.homepageScheme = new URL(base).protocol.replace(':', '');
  site.https.certError = !!(site.homepage.mobile?.certError || site.homepage.desktop?.certError);

  const homepages = [site.homepage.mobile, site.homepage.desktop].filter((p): p is PageCapture => !!p && p.ok);
  const choices = chooseInnerPages(homepages, base, Math.min(opts.innerPages ?? 12, budget.max - 1));
  // Key pages are the ones a visitor comes for: booking, contact, prices, the experiences and the story.
  site.robots = robotsFacts(rawRobots, homepageUrl, chooseInnerPages(homepages, base, 30).filter((c) => c.score >= 7).map((c) => c.url));

  for (const choice of choices) {
    if (!budget.take()) break;
    const cap = await renderer.render({ url: choice.url, viewport: 'mobile', outDir: pageDir(dir, 'mobile', choice.url) });
    if (cap.blocked) continue;
    // Two addresses can land on one page. It is read once.
    if ([...homepages, ...site.inner].some((p) => p.finalUrl.replace(/\/$/, '') === cap.finalUrl.replace(/\/$/, ''))) continue;
    site.inner.push(cap);
  }

  const pages = [...homepages, ...site.inner.filter((p) => p.ok)];
  site.booking = bookingSignals(pages);
  site.links = await checkLinks(polite, pages, base);

  try {
    const html = readFileSync(join(home.dir!, home.htmlFile!), 'utf8');
    site.technologies = await detectTechnologies(home, html);
    site.eol = eolHits(site.technologies, utcDay());
    site.structuredData = await structuredData(home, html);
  } catch (e) {
    errors.push(`homepage analysis: ${(e as Error).message.slice(0, 160)}`);
  }

  try {
    site.sitemap = await findSitemap(polite, base, site.robots.sitemaps);
  } catch (e) {
    errors.push(`sitemap: ${(e as Error).message.slice(0, 120)}`);
  }

  if (site.https.homepageScheme === 'https') {
    const plain = await polite.get(base.replace(/^https:/, 'http:'), { maxRedirects: 0, timeoutMs: 15_000, maxBytes: 1000 });
    const location = plain.headers.location ?? '';
    site.https.httpUpgrades = plain.status === null ? null : plain.status >= 300 && plain.status < 400 && location.startsWith('https://');
  }

  if (opts.listingUrls?.length) {
    try {
      site.listings = await fetchListings(polite, opts.listingUrls);
    } catch (e) {
      errors.push(`listings: ${(e as Error).message.slice(0, 120)}`);
    }
  }
  return finish();
}

/** Lighthouse at both form factors, three runs each. Run this with little else going on. */
export async function collectSpeed(polite: Polite, site: SiteData, dir: string = runDir(site.runId)): Promise<SiteData> {
  if (site.blocked) return site;
  const url = site.homepage.mobile?.finalUrl ?? site.homepage.desktop?.finalUrl ?? site.homepageUrl;
  for (const formFactor of ['mobile', 'desktop'] as const) {
    try {
      site.lighthouse[formFactor] = await runLighthouse(polite, url, formFactor);
    } catch (e) {
      site.errors.push(`lighthouse ${formFactor}: ${(e as Error).message.slice(0, 160)}`);
    }
  }
  site.finishedAt = utcIso();
  writeFileSync(join(dir, 'site.json'), JSON.stringify(site));
  return site;
}

export function loadSite(runId: number): SiteData | null {
  try {
    return JSON.parse(readFileSync(join(runDir(runId), 'site.json'), 'utf8')) as SiteData;
  } catch {
    return null;
  }
}
