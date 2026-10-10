import { describe, expect, it } from 'vitest';
import { parseRobotsTxt } from '@plumbline/fetch';
import type { PageCapture, PageLink, TextBlock } from '@plumbline/render';
import { bookingSignals, fingerprintUrl } from './booking.ts';
import { copyrightYear, datedNotices, emailsIn, findPhrases, foreignBlocks, foundingYears, parseDate, phonesIn, prices, seasonalMismatches } from './content.ts';
import { atOrBelowSeries, eolFor } from './eol.ts';
import { contactLinkProblem, isBrokenStatus } from './links.ts';
import { classifyListing, parseListing, urlsIn } from './listings.ts';
import { chooseInnerPages, robotsFacts } from './site.ts';
import { eolHits } from './tech.ts';

const block = (text: string, extra: Partial<TextBlock> = {}): TextBlock => ({ text, tag: 'p', heading: null, selector: 'p', box: { x: 0, y: 0, w: 100, h: 20 }, fontSize: 16, href: null, inHeader: false, inNav: false, inFooter: false, ...extra });
const link = (href: string, text = '', extra: Partial<PageLink> = {}): PageLink => ({ raw: href, href, text, visible: true, fold: false, box: { x: 0, y: 0, w: 10, h: 10 }, selector: 'a', target: '', hasHandler: false, inHeader: false, inNav: false, inFooter: false, ...extra });
const page = (texts: string[], extra: Partial<PageCapture> = {}): PageCapture =>
  ({ url: 'https://e.nz/', finalUrl: 'https://e.nz/', viewport: 'mobile', ok: true, blocks: texts.map((t) => block(t)), links: [], meta: { lang: 'en', iframes: [], scripts: [] }, requestHosts: [], ...extra }) as unknown as PageCapture;

describe('content analysis', () => {
  it('finds placeholder phrases with an excerpt', () => {
    const hits = findPhrases(page(['Welcome', 'Heading. Lorem ipsum dolor sit amet, more.']), [{ label: 'lorem', re: /lorem ipsum/i }]);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.excerpt).toContain('Lorem ipsum dolor');
  });

  it('reads the newest year from a copyright line', () => {
    expect(copyrightYear(page(['© 2015 Fixture']))!.year).toBe(2015);
    expect(copyrightYear(page(['Copyright © 2012 - 2026 Fixture Ltd']))!.year).toBe(2026);
    expect(copyrightYear(page(['(c) Fixture Tours 2019. All rights reserved']))!.year).toBe(2019);
    expect(copyrightYear(page(['Built in 2015 by hand']))).toBeNull();
    expect(copyrightYear(page(['Copywrite 2023 Glacier Fixture Tours']))!.year).toBe(2023);
    expect(copyrightYear(page(['2023 © Copyright - Fixture Penguins']))!.year).toBe(2023);
    expect(copyrightYear(page(['ALL RIGHTS RESERVED. FIXTURE KAYAKS LTD 2018']))!.year).toBe(2018);
    expect(copyrightYear(page(['Copyright 2020 - Fixture Guiding - All rights reserved']))!.year).toBe(2020);
    expect(copyrightYear(page(['© Fixture Ltd. Phone 03 525 2019 or $2015 per boat']))).toBeNull();
  });

  it('parses dates day first', () => {
    expect(parseDate('closed from 3 March 2021')!.date.toISOString().slice(0, 10)).toBe('2021-03-03');
    expect(parseDate('March 3rd, 2021')!.date.toISOString().slice(0, 10)).toBe('2021-03-03');
    expect(parseDate('valid to 31/10/2024')!.date.toISOString().slice(0, 10)).toBe('2024-10-31');
    expect(parseDate('through October 2025')!.date.toISOString().slice(0, 10)).toBe('2025-10-31');
    expect(parseDate('no date here')).toBeNull();
  });

  it('flags expired offers, COVID wording and old alerts, and leaves current ones', () => {
    const now = new Date('2026-10-10T00:00:00Z');
    const kinds = (t: string) => datedNotices(page([t]), now).map((n) => n.kind);
    expect(kinds('Prices valid until 30 April 2024.')).toEqual(['expired']);
    expect(kinds('Prices valid until 30 April 2027.')).toEqual([]);
    expect(kinds('We operate under COVID-19 Alert Level 2.')).toEqual(['covid']);
    expect(kinds('Important notice: wharf closed from 3 March 2021.')).toEqual(['old_alert']);
    expect(kinds('Notice: wharf closed from 3 September 2026.')).toEqual([]);
    expect(kinds('Jane visited in March 2019 and loved it.')).toEqual([]);
  });

  it('flags a seasonal promotion only outside its season', () => {
    expect(seasonalMismatches(page(['Our winter special is on now']), 12).map((s) => s.season)).toEqual(['winter']);
    expect(seasonalMismatches(page(['Our winter special is on now']), 7)).toEqual([]);
    expect(seasonalMismatches(page(['Summer deals from $99']), 6).map((s) => s.season)).toEqual(['summer']);
    expect(seasonalMismatches(page(['Summer deals from $99']), 11)).toEqual([]);
    expect(seasonalMismatches(page(['Summer has started, Xmas parties are booking fast.']), 10).map((s) => s.season)).toEqual(['summer']);
    expect(seasonalMismatches(page(['Summer has started, Xmas parties are booking fast.']), 12)).toEqual([]);
    expect(seasonalMismatches(page(['We love winter mornings on the lake']), 1)).toEqual([]);
  });

  it('flags a long block in another language but not English or te reo Māori', () => {
    const polish = 'Najlepsze kasyna online oferują wiele gier hazardowych dla graczy z całego świata, a bonusy powitalne przyciągają nowych użytkowników każdego dnia. Zakłady bukmacherskie cieszą się rosnącą popularnością wśród fanów sportu w naszym kraju.';
    const english = 'We take small groups out on the harbour every morning through the season, and our skipper will show you the best spots for snapper and kingfish while you enjoy the view of the islands and the open sea beyond the heads.';
    const maori = 'Ko te reo Māori te reo taketake o Aotearoa, ā, he taonga tuku iho nō ngā tūpuna. Ka kōrero mātou ki ō mātou manuhiri mō ngā kōrero o te whenua, o te moana, o ngā maunga hoki, kia mārama ai rātou ki te ao Māori me ōna tikanga katoa.';
    expect(foreignBlocks(page([polish])).map((f) => f.language)).toEqual(['pol']);
    expect(foreignBlocks(page([english]))).toEqual([]);
    expect(foreignBlocks(page([maori]))).toEqual([]);
    expect(foreignBlocks(page([polish.slice(0, 150)]))).toEqual([]);
  });

  it('reads prices with their context', () => {
    const p = prices(page(['Half day charter: $450 for the boat. Full day: NZ$1,200.50 all in.']));
    expect(p.map((x) => x.amount)).toEqual([450, 1200.5]);
    expect(p[0]!.context).toContain('Half day charter');
  });

  it('reads founding year claims', () => {
    expect(foundingYears(page(['Established in 1998 and still going', 'Founded 2004.', 'Operating since 1998'])).map((f) => f.year)).toEqual([1998, 2004, 1998]);
  });

  it('pulls phone numbers and emails out of text', () => {
    expect(phonesIn('Call 09 402 8105 or +64 27 498 3323, ref 12345')).toEqual(['09 402 8105', '+64 27 498 3323']);
    expect(emailsIn('Write to info@fixture.co.nz. Not logo@2x.png')).toEqual(['info@fixture.co.nz']);
  });
});

describe('contact link validation', () => {
  const problem = (raw: string, text = '') => contactLinkProblem({ raw, href: raw, text })?.kind ?? null;
  it('accepts well formed links', () => {
    for (const ok of ['mailto:info@fixture.co.nz', 'mailto:a@b.nz?subject=Hi', 'tel:+6494028105', 'tel:09 402 8105', 'https://wa.me/64274983323', 'https://m.me/fixturetours', 'https://example.com/', '/contact']) expect(problem(ok)).toBeNull();
  });
  it('rejects empty and malformed links', () => {
    expect(problem('mailto:')).toBe('mailto');
    expect(problem('mailto:info at fixture')).toBe('mailto');
    expect(problem('tel:')).toBe('tel');
    expect(problem('tel:123')).toBe('tel');
    expect(problem('http://Http://www.fixture.co.nz')).toBe('scheme');
    expect(problem('https://https://fixture.co.nz')).toBe('scheme');
    expect(problem('https://m.me/https://www.facebook.com/fixture')).toBe('messenger');
    expect(problem('https://m.me/')).toBe('messenger');
    expect(problem('https://wa.me/')).toBe('whatsapp');
    expect(problem('https://api.whatsapp.com/send?phone=')).toBe('whatsapp');
    expect(problem('http://Http')).toBe('scheme');
    expect(problem('https://whatsapp.com/dl/')).toBe('whatsapp');
    expect(problem('tel:64274275120')).toBe('tel');
    expect(problem('', 'hello@fixture.co.nz')).toBe('mailto');
    expect(problem('#', '+64 22 383 3051')).toBe('tel');
    expect(problem('#', 'Tours')).toBeNull();
    expect(problem('', '')).toBeNull();
  });
  it('counts only statuses that mean a page is gone', () => {
    expect([404, 410, 500, 502].every(isBrokenStatus)).toBe(true);
    expect([200, 301, 401, 403, 429, 503, null].some(isBrokenStatus)).toBe(false);
  });
});

describe('end of life table', () => {
  it('places versions in their series', () => {
    expect(atOrBelowSeries('7.4.33', '7.4')).toBe(true);
    expect(atOrBelowSeries('8.2.1', '8.1')).toBe(false);
    expect(atOrBelowSeries('3.10.12', '3')).toBe(true);
    expect(atOrBelowSeries('10.5.1', '10.4')).toBe(false);
  });
  it('reports software past its end date and nothing else', () => {
    expect(eolFor('PHP', '7.4.33', '2026-10-10')).toMatchObject({ eolDate: '2022-11-28' });
    expect(eolFor('PHP', '8.3.1', '2026-10-10')).toBeNull();
    expect(eolFor('PHP', '8.1.2', '2025-06-01')).toBeNull();
    expect(eolFor('WordPress', '4.5.3', '2026-10-10')).toMatchObject({ product: 'WordPress' });
    expect(eolFor('WordPress', '6.2', '2026-10-10')).toBeNull();
    expect(eolFor('Joomla', '3.9.1', '2026-10-10')).not.toBeNull();
    expect(eolFor('Drupal', '7.98', '2026-10-10')).not.toBeNull();
    expect(eolFor('PHP', null, '2026-10-10')).toBeNull();
    expect(eolFor('PHP', '7', '2026-10-10')).toBeNull();
    expect(eolFor('Squarespace', '7.1', '2026-10-10')).toBeNull();
  });
  it('turns detected technologies into hits with a source', () => {
    const hits = eolHits([{ name: 'PHP', version: '5.6.40', categories: [] }, { name: 'WordPress', version: '6.6', categories: ['CMS'] }], '2026-10-10');
    expect(hits).toHaveLength(1);
    expect(hits[0]!.sourceUrl).toMatch(/^https:\/\/endoflife\.date\/php/);
  });
});

describe('booking fingerprints', () => {
  it('recognises the tourism booking systems and the platforms', () => {
    for (const [url, system] of [
      ['https://fareharbor.com/embeds/book/x/', 'FareHarbor'],
      ['https://coastalkayakers.rezdy.com/', 'Rezdy'],
      ['https://bookeo.com/x', 'Bookeo'],
      ['https://x.checkfront.com/reserve/', 'Checkfront'],
      ['https://book.peek.com/s/1', 'Peek'],
      ['https://x.trekksoft.com/en/', 'TrekkSoft'],
      ['https://checkout.xola.com/', 'Xola'],
      ['https://checkout.ventrata.com/', 'Ventrata'],
      ['https://app.bookit.co.nz/x', 'Bookit'],
      ['https://whitelabel.rtbs.nz/x', 'RTBS'],
    ]) expect(fingerprintUrl(url!)?.system).toBe(system);
    expect(fingerprintUrl('https://www.viator.com/tours/x')?.kind).toBe('platform');
    expect(fingerprintUrl('https://www.bookme.co.nz/x')?.kind).toBe('platform');
    expect(fingerprintUrl('https://notrezdy.com/')).toBeNull();
    expect(fingerprintUrl('https://example.com/rezdy.com')).toBeNull();
  });
  it('collects signals from links, iframes and scripts', () => {
    const p = page([], { links: [link('https://x.rezdy.com/', 'Book now')], meta: { lang: 'en', iframes: ['https://fareharbor.com/embeds/x'], scripts: [] } } as unknown as Partial<PageCapture>);
    expect(bookingSignals([p]).map((s) => [s.system, s.how, s.visibleLink])).toEqual([
      ['Rezdy', 'link', true],
      ['FareHarbor', 'iframe', false],
    ]);
  });
});

describe('listings', () => {
  it('classifies listing URLs', () => {
    expect(classifyListing('https://coastalkayakers.rezdy.com/')).toEqual({ platform: 'Rezdy', kind: 'booking_system' });
    expect(classifyListing('https://fishingbooker.com/charters/view/1282')).toEqual({ platform: 'FishingBooker', kind: 'booking_platform' });
    expect(classifyListing('https://www.newzealand.com/nz/plan/business/x/').kind).toBe('directory');
    expect(classifyListing('https://www.tripadvisor.co.nz/x').kind).toBe('review');
  });
  it('pulls URLs and bare storefront hosts out of a CSV cell', () => {
    expect(urlsIn("Rezdy (coastalkayakers.rezdy.com); FishingBooker: https://fishingbooker.com/charters/view/1282 ; no Viator/GYG found")).toEqual(['https://fishingbooker.com/charters/view/1282', 'https://coastalkayakers.rezdy.com/']);
  });
  it('reads name, contact details, prices and rating from listing HTML, ignoring noscript', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { ROOT } = await import('@plumbline/core');
    const l = parseListing('https://www.newzealand.com/x', readFileSync(join(ROOT, 'fixtures/site/listing.html'), 'utf8'));
    expect(l).toMatchObject({ name: 'Harbour Fixture Charters', rating: 4.8, reviewCount: 67, emails: ['sales@harbourfixture.example'] });
    expect(l.phones).toContain('+6494028105');
    expect(l.prices.map((p) => p.amount)).toEqual([495]);
  });
});

describe('site planning', () => {
  const home = page([], {
    finalUrl: 'https://www.e.nz/',
    links: [
      link('https://www.e.nz/', 'Home', { inNav: true }),
      link('https://www.e.nz/blog/', 'Blog', { inNav: true }),
      link('https://www.e.nz/contact/', 'Contact', { inNav: true }),
      link('https://www.e.nz/tours/', 'Tours', { inNav: true }),
      link('https://www.e.nz/book-now/', 'Book now'),
      link('https://www.e.nz/files/brochure.pdf', 'Brochure'),
      link('https://e.nz/about-us/', 'About', { inNav: true }),
      link('https://other.nz/', 'Partner'),
      link('https://www.e.nz/hidden/', 'Hidden', { visible: false }),
    ],
  } as Partial<PageCapture>);

  it('chooses booking, contact and tour pages ahead of the blog, and skips files and other sites', () => {
    const urls = chooseInnerPages([home], 'https://www.e.nz/', 4).map((c) => c.url);
    expect(urls.slice(0, 2)).toEqual(['https://www.e.nz/contact/', 'https://www.e.nz/tours/']);
    expect(urls.slice(2).sort()).toEqual(['https://e.nz/about-us/', 'https://www.e.nz/book-now/']);
    expect(chooseInnerPages([home], 'https://www.e.nz/', 20).map((c) => c.url)).not.toContain('https://www.e.nz/hidden/');
  });

  it('reports which search and AI readers robots.txt blocks, and where', () => {
    const body = 'User-agent: *\nDisallow: /tours/\n\nUser-agent: OAI-SearchBot\nDisallow: /\n';
    const facts = robotsFacts({ status: 200, body, outcome: { kind: 'rules', robots: parseRobotsTxt(body) } }, 'https://e.nz/', ['https://e.nz/tours/', 'https://e.nz/contact/']);
    expect(facts.blocksHomepage).toBe(false);
    expect(facts.botBlocks.find((b) => b.bot === 'OAI-SearchBot')).toEqual({ bot: 'OAI-SearchBot', ownGroup: true, blocked: ['https://e.nz/', 'https://e.nz/tours/', 'https://e.nz/contact/'] });
    expect(facts.botBlocks.find((b) => b.bot === 'Googlebot')).toEqual({ bot: 'Googlebot', ownGroup: false, blocked: ['https://e.nz/tours/'] });
  });

  it('treats a 5xx robots.txt as blocking the homepage', () => {
    expect(robotsFacts({ status: 503, body: '', outcome: { kind: 'disallow_all', reason: 'x' } }, 'https://e.nz/', []).blocksHomepage).toBe(true);
  });
});
