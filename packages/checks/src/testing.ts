import type { Box } from '@plumbline/core';
import type { SiteData } from '@plumbline/collect';
import type { PageCapture, PageLink, TextBlock } from '@plumbline/render';

let y = 0;
export function block(text: string, extra: Partial<TextBlock> = {}): TextBlock {
  y += 40;
  return { text, tag: 'p', heading: null, selector: `p:nth-of-type(${y / 40})`, box: { x: 16, y, w: 300, h: 24 }, fontSize: 16, href: null, inHeader: false, inNav: false, inFooter: false, ...extra };
}

export function link(href: string, text: string, extra: Partial<PageLink> = {}): PageLink {
  return { raw: href, href, text, visible: true, fold: false, box: { x: 16, y: 10, w: 80, h: 20 } as Box, selector: 'a', target: '', hasHandler: false, inHeader: false, inNav: false, inFooter: false, ...extra };
}

export function page(url: string, texts: (string | TextBlock)[], extra: Partial<PageCapture> = {}): PageCapture {
  const blocks = texts.map((t) => (typeof t === 'string' ? block(t) : t));
  return {
    url,
    finalUrl: url,
    viewport: 'mobile',
    status: 200,
    ok: true,
    blocked: null,
    error: null,
    certError: false,
    headers: {},
    capturedAtUtc: '2026-10-10T20:00:00.000Z',
    capturedAtNz: '2026-10-11 09:00:00 NZDT',
    blocks,
    text: blocks.map((b) => b.text).join('\n'),
    links: [],
    controls: [],
    images: [],
    meta: { title: 'Fixture', description: null, canonical: null, robots: null, viewport: 'width=device-width, initial-scale=1', generator: [], lang: 'en', og: {}, hreflangs: [], h1: [], h1Total: 1, jsonld: [], scripts: [], stylesheets: [], iframes: [] },
    layout: { innerWidth: 390, innerHeight: 844, deviceWidth: 390, scrollWidth: 390, docW: 390, docH: 3000, horizontalScroll: false, wide: [] },
    consoleErrors: [],
    failedRequests: [],
    badResponses: [],
    mixedContent: [],
    requestHosts: [],
    htmlFile: null,
    tiles: [],
    scale: 3,
    dir: null,
    ...extra,
  };
}

const LONG =
  'We take small groups out on the harbour every morning from October to April, leaving the wharf at 7am. Our skipper has fished these waters for thirty years and knows where the snapper and kingfish run. All rods, bait and tackle are supplied, and we clean and bag your catch before you head home. Half day trips suit families and first timers, while full day trips reach the outer islands where the big fish are. We are a small family business and we answer the phone ourselves. Bring a hat, sunscreen, warm layers and something to eat. Children are welcome on every trip and we carry life jackets in all sizes. Parking is free beside the wharf, and the boat ramp cafe opens early for coffee. If the weather turns we will call you the night before and move your trip or refund you in full. Read what our guests say in their reviews below. Gift vouchers are on sale all year round.';

/** A healthy site: every check should stay quiet on it. */
export function healthySite(patch: Partial<SiteData> = {}): SiteData {
  const homeTexts = () => [
    block('Harbour Fixture Charters', { heading: 'h1' }),
    block(LONG),
    block('Half day charter $450. Full day charter $800. Call 09 402 8105 or email hello@fixture.co.nz.'),
    block('Rated 4.8 from 67 Google reviews.'),
    block('© 2026 Harbour Fixture Charters', { inFooter: true }),
  ];
  const links = () => [
    link('https://fixture.co.nz/', 'Home', { inNav: true }),
    link('https://fixture.co.nz/tours/', 'Tours', { inNav: true }),
    link('https://fixture.rezdy.com/', 'Book now', { fold: true }),
    link('tel:+6494028105', '09 402 8105', { raw: 'tel:+6494028105', fold: true }),
  ];
  const mobile = page('https://fixture.co.nz/', homeTexts(), { links: links() });
  const desktop = page('https://fixture.co.nz/', homeTexts(), { links: links(), viewport: 'desktop', layout: { innerWidth: 1440, innerHeight: 900, deviceWidth: 1440, scrollWidth: 1440, docW: 1440, docH: 2000, horizontalScroll: false, wide: [] } });
  const tours = page('https://fixture.co.nz/tours/', [block('Tours', { heading: 'h1' }), block('Half day charter $450, departing 7am daily from October to April.')], { links: [link('https://fixture.rezdy.com/', 'Book now')] });
  const lh = (formFactor: 'mobile' | 'desktop') => ({
    formFactor,
    url: 'https://fixture.co.nz/',
    runs: [1, 2, 3].map(() => ({ performance: 88, lcpMs: 2100, cls: 0.01, tbtMs: 90 })),
    median: { performance: 88, lcpMs: 2100, cls: 0.01, tbtMs: 90 },
    largestImages: [],
    version: '13.5.0',
    at: '2026-10-10T20:05:00.000Z',
  });
  return {
    runId: 1,
    kind: 'A',
    startedAt: '2026-10-10T20:00:00.000Z',
    finishedAt: '2026-10-10T20:10:00.000Z',
    business: { id: 1, slug: 'harbour-fixture', name: 'Harbour Fixture Charters', website: 'https://fixture.co.nz/', domain: 'fixture.co.nz', region: 'Northland', town: 'Paihia', activity: 'Fishing charter', googleRating: 4.8, googleReviewCount: 67 },
    homepageUrl: 'https://fixture.co.nz/',
    robots: { status: 200, outcome: 'rules', body: 'User-agent: *\nDisallow: /wp-admin/', blocksHomepage: false, sitemaps: [], botBlocks: ['Googlebot', 'Bingbot', 'OAI-SearchBot', 'PerplexityBot'].map((bot) => ({ bot, ownGroup: false, blocked: [] })) },
    blocked: null,
    homepage: { mobile, desktop },
    inner: [tours],
    links: [
      { url: 'https://fixture.co.nz/tours/', internal: true, status: 200, error: null, finalUrl: 'https://fixture.co.nz/tours/', skipped: null, seen: [{ pageUrl: 'https://fixture.co.nz/', viewport: 'mobile', text: 'Tours', selector: 'a', box: { x: 0, y: 0, w: 10, h: 10 }, inNav: true, raw: '/tours/' }] },
    ],
    lighthouse: { mobile: lh('mobile'), desktop: lh('desktop') },
    axe: { mobile: [], desktop: [] },
    technologies: [{ name: 'WordPress', version: '7.1.3', categories: ['CMS'] }],
    eol: [],
    booking: [{ system: 'Rezdy', kind: 'system', url: 'https://fixture.rezdy.com/', pageUrl: 'https://fixture.co.nz/', how: 'link', visibleLink: true }],
    structuredData: { types: ['LocalBusiness'], hasLocalBusinessFamily: true, items: 1, errors: [] },
    sitemap: { found: true, url: 'https://fixture.co.nz/sitemap.xml', urls: 12 },
    https: { homepageScheme: 'https', certError: false, httpUpgrades: true },
    listings: [],
    errors: [],
    ...patch,
  };
}

/** Applies the same change to the homepage at both viewports. */
export function editHomes(site: SiteData, edit: (p: PageCapture) => void): SiteData {
  for (const p of [site.homepage.mobile, site.homepage.desktop]) {
    if (!p) continue;
    edit(p);
    p.text = p.blocks.map((b) => b.text).join('\n');
  }
  return site;
}
