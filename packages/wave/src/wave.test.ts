import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { memoryDb, type Db } from '@plumbline/core';
import { block, link, page } from '@plumbline/checks/testing';
import { agencySigns, bookingLinks, factPageUrls, fullSize, imageUrlsIn, pagePrices, quoteOnPage, tradingFlags, videosIn } from './extract.ts';
import { CHECK_IDS, type AiSummary } from '@plumbline/checks';
import { loadLibrary } from '@plumbline/impact';
import sharp from 'sharp';
import { settleAi } from './ai.ts';
import { heroCandidates, heroEligible, measure, mp4Info, photoKind, youtubeInfo, type Photo } from './assets.ts';
import { claimsIn, crawlmouseFileFor, judge, linkersOf, pageState, storeCrawlmouse, type ExampleState, type SentenceResult } from './crawlmouse.ts';
import { factsFor, setFacts, statedActivities } from './facts.ts';
import { importWave, waveMembers, waves } from './list.ts';
import { PACK_MAX_LINES, packBusiness, packLines, writePack } from './pack.ts';
import { groupOf, rankFindings, repeats, type Rankable } from './rank.ts';
import { Research, checkResearch, storeResearch } from './research.ts';

function seed(db: Db, slugs: string[]) {
  for (const [i, slug] of slugs.entries()) db.prepare("INSERT INTO businesses (id, slug, name, website, source, status, created_at) VALUES (?, ?, ?, ?, 'discovered', 'audited', 'x')").run(i + 1, slug, slug, `https://${slug}.co.nz/`);
}

describe('a wave list', () => {
  it('keeps the businesses in list order with their status and reports slugs it does not know', () => {
    const db = memoryDb();
    seed(db, ['alpha', 'bravo', 'charlie']);
    const r = importWave(db, 'wave-2', [
      { slug: 'charlie', position: 1, status: 'wave' },
      { slug: 'alpha', position: 2, status: 'wave' },
      { slug: 'bravo', position: 3, status: 'reserve' },
      { slug: 'nobody', position: 4, status: 'reserve' },
    ]);
    expect(r).toEqual({ stored: 3, unknown: ['nobody'] });
    expect(waveMembers(db, 'wave-2').map((b) => b.slug)).toEqual(['charlie', 'alpha']);
    expect(waveMembers(db, 'wave-2', ['wave', 'reserve']).map((b) => [b.slug, b.wave_status])).toEqual([['charlie', 'wave'], ['alpha', 'wave'], ['bravo', 'reserve']]);
    expect(waves(db)).toEqual(['wave-2']);
  });

  it('is replaced as a whole when imported again, keeping a note', () => {
    const db = memoryDb();
    seed(db, ['alpha', 'bravo']);
    importWave(db, 'wave-2', [{ slug: 'alpha', position: 1, status: 'wave' }, { slug: 'bravo', position: 2, status: 'reserve' }]);
    importWave(db, 'wave-2', [{ slug: 'alpha', position: 1, status: 'dropped', note: 'for sale' }, { slug: 'bravo', position: 2, status: 'wave', note: 'replaces alpha' }]);
    expect(waveMembers(db, 'wave-2', ['wave', 'reserve', 'dropped']).map((b) => [b.slug, b.wave_status, b.wave_note])).toEqual([['alpha', 'dropped', 'for sale'], ['bravo', 'wave', 'replaces alpha']]);
  });
});

describe('facts', () => {
  it('are stored by topic with their source, quote and the day they were checked', () => {
    const db = memoryDb();
    seed(db, ['alpha']);
    setFacts(db, 1, 'email', [{ value: { address: 'hello@alpha.co.nz', published: true }, sourceUrl: 'https://alpha.co.nz/contact', quote: 'hello@alpha.co.nz' }], '2026-10-12T09:00:00.000Z');
    expect(factsFor(db, 1, 'email')).toEqual([{ id: 1, businessId: 1, topic: 'email', label: '', value: { address: 'hello@alpha.co.nz', published: true }, sourceUrl: 'https://alpha.co.nz/contact', quote: 'hello@alpha.co.nz', flag: null, checkedOn: '2026-10-12T09:00:00.000Z' }]);
  });

  it('replace the earlier facts of the same topic and leave other topics alone', () => {
    const db = memoryDb();
    seed(db, ['alpha']);
    setFacts(db, 1, 'price', [{ label: 'Half day', value: 120 }, { label: 'Full day', value: 200 }]);
    setFacts(db, 1, 'email', [{ value: 'a@alpha.co.nz' }]);
    setFacts(db, 1, 'price', [{ label: 'Half day', value: 130, flag: 'conflict' }]);
    expect(factsFor(db, 1, 'price').map((f) => [f.label, f.value, f.flag])).toEqual([['Half day', 130, 'conflict']]);
    expect(factsFor(db, 1).map((f) => f.topic).sort()).toEqual(['email', 'price']);
  });

  it('give the activities stated for a business, main one first', () => {
    const db = memoryDb();
    seed(db, ['alpha']);
    expect(statedActivities(db, 1)).toEqual([]);
    setFacts(db, 1, 'activity', [{ value: 'kayak tour' }, { value: 'kayak hire' }]);
    expect(statedActivities(db, 1)).toEqual(['kayak tour', 'kayak hire']);
  });
});

describe('signs that a business has changed hands or stopped', () => {
  const flags = (...texts: string[]) => tradingFlags(page('https://fixture.co.nz/about', texts)).map((f) => [f.kind, f.quote]);

  it('quotes the sentence for each sign', () => {
    expect(flags('Welcome. This business is for sale as a going concern. Call us.')).toEqual([['for sale', 'This business is for sale as a going concern.']]);
    expect(flags('NOW CLOSED Re-open September 28th 2026')).toEqual([['closed', 'NOW CLOSED Re-open September 28th 2026']]);
    expect(flags('The lodge is under new management from this season.')).toEqual([['under new management', 'The lodge is under new management from this season.']]);
    expect(flags('We are the new owners, Sam and Kiri.')).toEqual([['new owners', 'We are the new owners, Sam and Kiri.']]);
    expect(flags('We are taking a break for the winter and will be back in spring.')).toEqual([['taking a break', 'We are taking a break for the winter and will be back in spring.']]);
  });

  it('says nothing about ordinary opening hours or things on sale in a shop', () => {
    expect(flags('Closed on Christmas Day.', 'Gift vouchers for sale at the cellar door.', 'Our wines are for sale online.', 'An enclosed cabin keeps you dry.')).toEqual([]);
  });

  it('gives the page each sign was read on', () => {
    expect(tradingFlags(page('https://fixture.co.nz/about', ['We have ceased trading.']))[0]).toMatchObject({ kind: 'closed', url: 'https://fixture.co.nz/about' });
  });
});

describe('signs that an agency looks after the site', () => {
  it('reads a credit in the footer and the site it links to', () => {
    const p = page('https://fixture.co.nz/', [block('Harbour cruises daily.'), block('© 2026 Fixture. Website by Tidal Studio', { inFooter: true })], { links: [link('https://tidalstudio.nz/', 'Tidal Studio', { inFooter: true })] });
    expect(agencySigns(p, '')).toEqual([
      { kind: 'credit', quote: '© 2026 Fixture. Website by Tidal Studio', agency: 'Tidal Studio', url: 'https://fixture.co.nz/' },
      { kind: 'link', quote: 'Tidal Studio', agency: 'tidalstudio.nz', url: 'https://fixture.co.nz/' },
    ]);
  });

  it('reads author names and the author tag from the page source', () => {
    const html = '<html><head><meta name="author" content="Bright Pixel Ltd"></head><body><a href="https://fixture.co.nz/author/brightpixel/" rel="author">brightpixel</a></body></html>';
    const signs = agencySigns(page('https://fixture.co.nz/news', ['A day on the harbour']), html);
    expect(signs).toEqual([
      { kind: 'author', quote: 'meta author: Bright Pixel Ltd', agency: 'Bright Pixel Ltd', url: 'https://fixture.co.nz/news' },
      { kind: 'author', quote: 'author page: /author/brightpixel/', agency: 'brightpixel', url: 'https://fixture.co.nz/news' },
    ]);
  });

  it('does not take a site builder, a booking system or a social link for an agency', () => {
    const p = page('https://fixture.co.nz/', [block('Proudly powered by Weebly', { inFooter: true }), block('Bookings powered by Rezdy', { inFooter: true })], {
      links: [link('https://www.weebly.com/', 'Weebly', { inFooter: true }), link('https://www.facebook.com/fixture', 'Facebook', { inFooter: true }), link('https://fixture.rezdy.com/', 'Book', { inFooter: true }), link('https://fixture.co.nz/terms', 'Terms', { inFooter: true })],
    });
    expect(agencySigns(p, '<meta name="author" content="Fixture">')).toEqual([{ kind: 'platform', quote: 'Proudly powered by Weebly', agency: 'Weebly', url: 'https://fixture.co.nz/' }]);
  });
});

describe('photos and videos on a page', () => {
  it('finds the largest version of each photo, from images, picture sources and backgrounds', () => {
    const html = `<body>
      <img src="/wp-content/uploads/2024/01/boat-300x200.jpg" srcset="/wp-content/uploads/2024/01/boat-300x200.jpg 300w, /wp-content/uploads/2024/01/boat-1024x683.jpg 1024w" alt="Our boat">
      <picture><source srcset="https://cdn.fixture.co.nz/hero.webp 1x, https://cdn.fixture.co.nz/hero@2x.webp 2x"><img src="data:image/gif;base64,R0lGOD" alt=""></picture>
      <div style="background-image: url('https://static.wixstatic.com/media/abc123~mv2.jpg/v1/fill/w_980,h_551,q_85/abc123~mv2.jpg')"></div>
      <img data-src="https://images.squarespace-cdn.com/content/v1/5f/bay.jpg?format=750w" alt="The bay">
    </body>`;
    expect(imageUrlsIn(html, 'https://fixture.co.nz/tours').map((i) => [i.url, i.alt])).toEqual([
      ['https://fixture.co.nz/wp-content/uploads/2024/01/boat.jpg', 'Our boat'],
      ['https://cdn.fixture.co.nz/hero@2x.webp', ''],
      ['https://static.wixstatic.com/media/abc123~mv2.jpg', ''],
      ['https://images.squarespace-cdn.com/content/v1/5f/bay.jpg?format=2500w', 'The bay'],
    ]);
  });

  it('asks a site builder for the original of a resized photo', () => {
    expect(fullSize('https://static.wixstatic.com/media/abc~mv2.jpg/v1/crop/x_0,y_0,w_10,h_10/fill/w_10,h_10/a.jpg')).toBe('https://static.wixstatic.com/media/abc~mv2.jpg');
    expect(fullSize('https://fixture.co.nz/wp-content/uploads/boat-scaled-1536x1024.jpeg')).toBe('https://fixture.co.nz/wp-content/uploads/boat-scaled.jpeg');
    expect(fullSize('https://fixture.co.nz/uploads/1/2/3/boat_orig.jpg')).toBe('https://fixture.co.nz/uploads/1/2/3/boat_orig.jpg');
    expect(fullSize('https://i0.wp.com/fixture.co.nz/boat.jpg?resize=300%2C200&ssl=1')).toBe('https://i0.wp.com/fixture.co.nz/boat.jpg?ssl=1');
  });

  it('finds their own video files and the videos they embed or link to', () => {
    const html = `<body>
      <video poster="/p.jpg"><source src="/media/hero.mp4" type="video/mp4"></video>
      <iframe src="https://www.youtube.com/embed/abcDEF12345?rel=0"></iframe>
      <iframe src="https://player.vimeo.com/video/987654321"></iframe>
      <a href="https://youtu.be/zzzYYY00011">Watch our film</a>
      <a href="https://www.facebook.com/fixture/videos/1234567890/">On Facebook</a>
      <a href="https://www.youtube.com/@fixture">Our channel</a>
      <iframe src="https://www.google.com/maps/embed?pb=1"></iframe>
    </body>`;
    expect(videosIn(html, 'https://fixture.co.nz/')).toEqual([
      { url: 'https://fixture.co.nz/media/hero.mp4', kind: 'file', how: 'video on the page', pageUrl: 'https://fixture.co.nz/' },
      { url: 'https://www.youtube.com/watch?v=abcDEF12345', kind: 'youtube', how: 'embedded', pageUrl: 'https://fixture.co.nz/' },
      { url: 'https://vimeo.com/987654321', kind: 'vimeo', how: 'embedded', pageUrl: 'https://fixture.co.nz/' },
      { url: 'https://www.youtube.com/watch?v=zzzYYY00011', kind: 'youtube', how: 'linked', pageUrl: 'https://fixture.co.nz/' },
      { url: 'https://www.facebook.com/fixture/videos/1234567890/', kind: 'facebook', how: 'linked', pageUrl: 'https://fixture.co.nz/' },
    ]);
  });
});

describe('booking, prices and quotes', () => {
  it('reads the booking links a visitor can follow, with the system behind each', () => {
    const p = page('https://fixture.co.nz/', ['Book online'], { links: [link('https://fixture.rezdy.com/123/half-day', 'Book now'), link('https://fixture.co.nz/tours', 'Tours'), link('https://fareharbor.com/embeds/book/fixture/', 'Reserve', { visible: false })] });
    expect(bookingLinks(p)).toEqual([
      { system: 'Rezdy', url: 'https://fixture.rezdy.com/123/half-day', text: 'Book now', visible: true, pageUrl: 'https://fixture.co.nz/' },
      { system: 'FareHarbor', url: 'https://fareharbor.com/embeds/book/fixture/', text: 'Reserve', visible: false, pageUrl: 'https://fixture.co.nz/' },
    ]);
  });

  it('reads each price with the words around it and the page it is on', () => {
    const p = page('https://fixture.co.nz/prices', ['Half day charter $450 per boat. Full day $800.']);
    expect(pagePrices(p)).toEqual([
      { amount: 450, text: '$450', context: 'Half day charter $450 per boat. Full day $800.', pageUrl: 'https://fixture.co.nz/prices' },
      { amount: 800, text: '$800', context: 'Half day charter $450 per boat. Full day $800.', pageUrl: 'https://fixture.co.nz/prices' },
    ]);
  });

  it('finds a quote on a page whatever the spacing, case or style of its quote marks', () => {
    const p = page('https://fixture.co.nz/about', ['Meet Sam and Kiri,\n  your hosts.   We’ve run the boat since 2009.']);
    p.meta.title = 'About | Fixture Charters';
    expect(quoteOnPage(p, "meet sam and kiri, your hosts. We've run the boat since 2009.")).toBe(true);
    expect(quoteOnPage(p, 'About | Fixture Charters')).toBe(true);
    expect(quoteOnPage(p, 'Meet Sam and Kiri, the owners')).toBe(false);
    expect(quoteOnPage(p, '  ')).toBe(false);
  });

  it('picks the pages that say who runs the business, how to reach it and what it costs', () => {
    const home = page('https://fixture.co.nz/', ['Home'], {
      links: [
        link('https://fixture.co.nz/about-us', 'About'),
        link('https://fixture.co.nz/contact', 'Contact us'),
        link('https://fixture.co.nz/prices', 'Rates'),
        link('https://fixture.co.nz/tours', 'Our tours'),
        link('https://fixture.co.nz/gallery', 'Gallery'),
        link('https://fixture.co.nz/blog/a-day-out', 'A day out'),
        link('https://other.co.nz/about', 'About them'),
        link('https://fixture.co.nz/about-us#team', 'The team'),
        link('https://fixture.co.nz/brochure.pdf', 'Prices (PDF)'),
      ],
    });
    expect(factPageUrls(home, 6)).toEqual(['https://fixture.co.nz/about-us', 'https://fixture.co.nz/contact', 'https://fixture.co.nz/prices', 'https://fixture.co.nz/tours', 'https://fixture.co.nz/gallery']);
  });
});

describe('the AI check for one business', () => {
  const others = [{ name: 'Rival One', answers: 6 }, { name: 'Rival Two', answers: 5 }];
  const sample = { provider: 'openai', askedAt: '2026-10-12T01:00:00.000Z', answer: 'Rival One', citations: [] };
  const summary = (first: number, second: number): AiSummary => ({
    questions: 12,
    namedIn: first + second,
    others,
    sample: { question: 'Who should I book a kayak tour with?', ...sample },
    asked: [
      { question: 'Who should I book a kayak tour with?', answers: 6, namedIn: first, others, sample },
      { question: 'Who should I book a kayak hire with?', answers: 6, namedIn: second, others, sample },
    ],
    spanMinutes: 95,
    holdsInBothPasses: first + second === 0,
  });
  const library = loadLibrary(CHECK_IDS);
  const business = { id: 1, name: 'alpha' };
  const stored = (db: Db) => factsFor(db, 1, 'ai').map((f) => [f.label, f.value, f.flag]);
  const finding = (db: Db) => (db.prepare("SELECT status FROM findings WHERE check_id = 'C37_not_named_by_ai'").get() as { status: string } | undefined)?.status ?? null;

  it('is a strength for each question where most answers name the business, and no finding', () => {
    const db = memoryDb();
    seed(db, ['alpha']);
    expect(settleAi(db, library, business, 'b', summary(5, 3), '2026-10-12T03:00:00.000Z')).toEqual({ finding: 'none', strengths: 1 });
    expect(stored(db)).toEqual([
      ['Who should I book a kayak tour with?', { answers: 6, namedIn: 5, others: ['Rival One', 'Rival Two'] }, 'strength'],
      ['Who should I book a kayak hire with?', { answers: 6, namedIn: 3, others: ['Rival One', 'Rival Two'] }, null],
    ]);
    expect(factsFor(db, 1, 'ai')[0]!.checkedOn).toBe('2026-10-12T01:00:00.000Z');
    expect(finding(db)).toBeNull();
  });

  it('is a finding only when no answer to any question names the business', () => {
    const db = memoryDb();
    seed(db, ['alpha']);
    expect(settleAi(db, library, business, 'b', summary(0, 0), '2026-10-12T03:00:00.000Z')).toEqual({ finding: 'recorded', strengths: 0 });
    expect(stored(db).map((r) => r[2])).toEqual(['not named', 'not named']);
    expect(finding(db)).toBe('reproduced');
    expect(settleAi(db, library, business, 'b', summary(0, 1), '2026-10-12T04:00:00.000Z')).toEqual({ finding: 'dropped', strengths: 0 });
    expect(stored(db).map((r) => r[2])).toEqual(['not named', null]);
    expect(finding(db)).toBe('resolved');
  });

  it('stores nothing when no question was answered', () => {
    const db = memoryDb();
    seed(db, ['alpha']);
    setFacts(db, 1, 'ai', [{ label: 'old', value: {} }]);
    expect(settleAi(db, library, business, 'b', null, '2026-10-12T03:00:00.000Z')).toEqual({ finding: 'none', strengths: 0 });
    expect(stored(db)).toEqual([]);
  });
});

describe('a Crawlmouse summary', () => {
  it('is found by slug wherever it sits under the inputs folder, and by a shorter name for a long slug', () => {
    const root = mkdtempSync(join(tmpdir(), 'plumbline-cm-'));
    mkdirSync(join(root, 'crawlmouse-inputs', 'crawlmouse', 'wave2', 'crawlmouse'), { recursive: true });
    writeFileSync(join(root, 'crawlmouse-inputs', 'crawlmouse', 'alpha.json'), '{}');
    writeFileSync(join(root, 'crawlmouse-inputs', 'crawlmouse', 'wave2', 'crawlmouse', 'bravo-wine-trail.json'), '{}');
    expect(crawlmouseFileFor('alpha', root)).toBe(join(root, 'crawlmouse-inputs', 'crawlmouse', 'alpha.json'));
    expect(crawlmouseFileFor('bravo-wine-trail-central-wine-tours', root)).toBe(join(root, 'crawlmouse-inputs', 'crawlmouse', 'wave2', 'crawlmouse', 'bravo-wine-trail.json'));
    expect(crawlmouseFileFor('charlie', root)).toBeNull();
    expect(crawlmouseFileFor('alp', root)).toBeNull();
  });

  it('says what each sentence claims', () => {
    expect(claimsIn('A link to your Contact page leads to a missing page (404).')).toEqual(['missing_page']);
    expect(claimsIn('Your Packages page is not linked from anywhere else on the site.')).toEqual(['orphan_page']);
    expect(claimsIn('26 of 27 pages have no meta description, and 13 have no main heading.')).toEqual(['no_meta_description', 'no_main_heading']);
    expect(claimsIn('14 of 15 pages carry no structured data, and 10 have no meta description.')).toEqual(['no_structured_data', 'no_meta_description']);
    expect(claimsIn("A leftover page called 'copy of cellar door' is live.")).toEqual(['leftover_page']);
    expect(claimsIn("Old pages are still live but unlinked, such as a Mother's Day offer and a second home page.")).toEqual(['leftover_page', 'orphan_page']);
    expect(claimsIn('The blog page is nearly empty.')).toEqual(['thin_page']);
    expect(claimsIn('Several package pages have very little text.')).toEqual(['thin_page']);
    expect(claimsIn('Your conservation email address is set up as a web page link, so tapping it opens a missing page instead of an email.')).toEqual(['missing_page']);
    expect(claimsIn('The site loads quickly.')).toEqual([]);
  });
});

describe('what a page shows when it is opened again', () => {
  it('reads the status, the description, the main heading, structured data and the amount of text', () => {
    const p = page('https://fixture.co.nz/tours', [block('Our tours', { heading: 'h1' }), block('Half day and full day trips on the harbour.')]);
    p.meta.description = 'Tours';
    p.meta.h1 = ['Our tours'];
    p.meta.jsonld = ['{"@type":"TouristTrip"}'];
    expect(pageState(p, '')).toEqual({ url: 'https://fixture.co.nz/tours', status: 200, missing: false, metaDescription: true, mainHeading: true, structuredData: true, words: 11, title: 'Fixture' });
    const bare = page('https://fixture.co.nz/x', ['Hello']);
    bare.meta.description = '  ';
    expect(pageState(bare, '<div itemscope itemtype="https://schema.org/Winery"></div>')).toMatchObject({ metaDescription: false, mainHeading: false, structuredData: true, words: 1 });
  });

  it('knows a page that says it was not found, whatever status it was served with', () => {
    const gone = page('https://fixture.co.nz/old', ['Page not found'], { status: 404, ok: false });
    expect(pageState(gone, '').missing).toBe(true);
    const soft = page('https://fixture.co.nz/old', [block('404', { heading: 'h1' }), block('Sorry, we could not find that page.')]);
    soft.meta.title = 'Page Not Found';
    expect(pageState(soft, '').missing).toBe(true);
    const fine = page('https://fixture.co.nz/404-fishing-club', ['Welcome to the 404 fishing club, where we never miss.']);
    expect(pageState(fine, '').missing).toBe(false);
  });

  it('finds which pages link to an address, with the words on the link', () => {
    const home = page('https://fixture.co.nz/', ['Home'], { links: [link('https://fixture.co.nz/book-online', 'Book Online', { inNav: true }), link('https://fixture.co.nz/tours', 'Tours')] });
    const tours = page('https://fixture.co.nz/tours', ['Tours'], { links: [link('http://www.fixture.co.nz/book-online/', 'Reserve your seat'), link('https://fixture.co.nz/book-online', 'hidden', { visible: false })] });
    const self = page('https://fixture.co.nz/book-online', ['Book'], { links: [link('https://fixture.co.nz/book-online', 'Book Online')] });
    expect(linkersOf([home, tours, self], 'https://fixture.co.nz/book-online').map((l) => [l.pageUrl, l.text, l.where])).toEqual([
      ['https://fixture.co.nz/', 'Book Online', 'menu'],
      ['https://fixture.co.nz/tours', 'Reserve your seat', 'page'],
    ]);
  });

  it('leads with a link that has words on it, and reads an address the same however it is written', () => {
    const picture = page('https://fixture.co.nz/', ['Home'], { links: [link('https://fixture.co.nz/booking', ''), link('https://fixture.co.nz/booking', '  ')] });
    const visit = page('https://fixture.co.nz/visit-us', ['Visit'], { links: [link('https://fixture.co.nz/booking', ''), link('https://fixture.co.nz/booking', 'Book a \ue934\ue934 wine   tasting')] });
    expect(linkersOf([picture, visit], 'https://fixture.co.nz/booking').map((l) => [l.pageUrl, l.text])).toEqual([
      ['https://fixture.co.nz/visit-us', 'Book a wine tasting'],
      ['https://fixture.co.nz/', ''],
    ]);
    const mail = page('https://fixture.co.nz/contact', ['Contact'], { links: [link('https://fixture.co.nz/hello%40fixture.co.nz.html', 'Email us')] });
    expect(linkersOf([mail], 'https://fixture.co.nz/hello@fixture.co.nz.html')).toHaveLength(1);
  });
});

describe('whether a Crawlmouse sentence still holds', () => {
  const state = (patch: Partial<ExampleState>): ExampleState => ({ url: 'https://fixture.co.nz/x', status: 200, missing: false, metaDescription: true, mainHeading: true, structuredData: true, words: 400, title: 'X', linkedFrom: [], ...patch });
  const others = [state({ url: 'https://fixture.co.nz/a', metaDescription: false }), state({ url: 'https://fixture.co.nz/b', metaDescription: false }), state({ url: 'https://fixture.co.nz/c' })];

  it('confirms a missing page only when one of their own pages links to it', () => {
    const linked = state({ status: 404, missing: true, linkedFrom: [{ pageUrl: 'https://fixture.co.nz/', text: 'Book Online', where: 'menu', box: null }] });
    expect(judge(['missing_page'], [linked], [])).toMatchObject({ confirmed: true, measured: 'The page answers 404 (not found). The menu link "Book Online" on https://fixture.co.nz/ leads to it.' });
    expect(judge(['missing_page'], [state({ status: 404, missing: true })], others)).toMatchObject({ confirmed: false, reason: 'https://fixture.co.nz/x is missing, but none of the 3 pages we read links to it' });
    expect(judge(['missing_page'], [state({})], [])).toMatchObject({ confirmed: false, reason: 'https://fixture.co.nz/x now loads (status 200)' });
  });

  it('keeps a sentence about several missing pages when all are missing and a link to at least one was found', () => {
    const booking = state({ url: 'https://fixture.co.nz/booking', status: 404, missing: true, linkedFrom: [{ pageUrl: 'https://fixture.co.nz/visit-us', text: 'Book a wine tasting', where: 'page', box: null }] });
    const picture = state({ url: 'https://fixture.co.nz/wine', status: 404, missing: true, linkedFrom: [{ pageUrl: 'https://fixture.co.nz/our-wine', text: '', where: 'page', box: null }] });
    const unlinked = state({ url: 'https://fixture.co.nz/buy-wine', status: 404, missing: true });
    expect(judge(['missing_page'], [unlinked, booking, picture], others)).toMatchObject({
      confirmed: true,
      measured:
        'https://fixture.co.nz/booking answers 404 (not found). The link "Book a wine tasting" on https://fixture.co.nz/visit-us leads to it. https://fixture.co.nz/wine answers 404 (not found). A link with no words on it (a picture or a button) on https://fixture.co.nz/our-wine leads to it. https://fixture.co.nz/buy-wine answers 404 (not found). None of the 3 pages we read links to it.',
    });
    expect(judge(['missing_page'], [unlinked, state({ url: 'https://fixture.co.nz/shop' })], others)).toMatchObject({ confirmed: false, reason: 'https://fixture.co.nz/shop now loads (status 200)' });
  });

  it('confirms an unlinked page when it loads and none of the pages read links to it', () => {
    expect(judge(['orphan_page'], [state({})], others)).toMatchObject({ confirmed: true, measured: 'The page loads. None of the 3 other pages we read links to it.' });
    const linked = state({ linkedFrom: [{ pageUrl: 'https://fixture.co.nz/', text: 'Packages', where: 'menu', box: null }] });
    expect(judge(['orphan_page'], [linked], others)).toMatchObject({ confirmed: false, reason: 'https://fixture.co.nz/x is linked from https://fixture.co.nz/ ("Packages")' });
    expect(judge(['orphan_page'], [state({ status: 404, missing: true })], others)).toMatchObject({ confirmed: false, reason: 'https://fixture.co.nz/x no longer loads (status 404)' });
  });

  it('confirms what is absent from a page when every example shows it', () => {
    expect(judge(['no_meta_description'], [state({ metaDescription: false })], others)).toMatchObject({ confirmed: true, measured: 'No meta description on the example page, nor on 2 of the 3 other pages we read.' });
    // When our own reading does not bear out a count, the measured line says so plainly.
    expect(judge(['no_structured_data'], [state({ structuredData: false })], others)).toMatchObject({ confirmed: true, measured: 'No structured data on the example page. The 3 other pages we read all carry some.' });
    expect(judge(['no_main_heading'], [state({ mainHeading: false })], others)).toMatchObject({ confirmed: true, measured: 'No main heading on the example page. The 3 other pages we read all have one.' });
    expect(judge(['no_main_heading'], [state({})], others)).toMatchObject({ confirmed: false, reason: 'https://fixture.co.nz/x has a main heading' });
    expect(judge(['thin_page'], [state({ words: 40 })], [])).toMatchObject({ confirmed: true, measured: 'The example page shows 40 words.' });
    expect(judge(['leftover_page'], [state({ title: 'Copy of Cellar Door' })], [])).toMatchObject({ confirmed: true, measured: 'The page loads, with the title "Copy of Cellar Door".' });
  });

  it('needs every half of a two part sentence, from the example or from two other pages read', () => {
    const noHeading = [state({ url: 'https://fixture.co.nz/a', mainHeading: false }), state({ url: 'https://fixture.co.nz/b', mainHeading: false })];
    expect(judge(['no_meta_description', 'no_main_heading'], [state({ metaDescription: false })], noHeading)).toMatchObject({ confirmed: true });
    expect(judge(['no_meta_description', 'no_main_heading'], [state({ metaDescription: false })], others)).toMatchObject({ confirmed: false, reason: 'no page we read shows: no main heading' });
    expect(judge([], [state({})], [])).toMatchObject({ confirmed: false, reason: 'opening the example pages cannot prove this' });
    expect(judge(['thin_page'], [], [])).toMatchObject({ confirmed: false, reason: 'no example page was given' });
  });
});

describe('Crawlmouse findings in the database', () => {
  const result = (patch: Partial<SentenceResult>): SentenceResult => ({ text: 'A link to your Contact page leads to a missing page (404).', claims: ['missing_page'], confirmed: true, measured: 'The page answers 404 (not found).', reason: null, caution: null, examples: [], evidence: [{ url: 'https://alpha.co.nz/contact', path: null, excerpt: 'Status 404', capturedAt: '2026-10-12T05:00:00.000Z' }], ...patch });
  const rows = (db: Db) => db.prepare("SELECT check_id, pack, tier, source, status, reproduced, title, severity FROM findings ORDER BY id").all();

  it('are stored as measured findings from Crawlmouse, ready for a decision, with their evidence', () => {
    const db = memoryDb();
    seed(db, ['alpha']);
    const n = storeCrawlmouse(db, { id: 1 }, 'b', [result({}), result({ text: 'Dropped one.', confirmed: false, reason: 'now loads' })], { auditedAt: '2026-10-12', checkedAt: '2026-10-12T05:00:00.000Z' });
    expect(n).toEqual({ stored: 1, dropped: 1 });
    expect(rows(db)).toEqual([{ check_id: 'CM_missing_page', pack: 'crawlmouse', tier: 'measured', source: 'crawlmouse', status: 'reproduced', reproduced: 1, title: 'A link to your Contact page leads to a missing page (404).', severity: 5 }]);
    expect(db.prepare('SELECT kind, url, excerpt, captured_at_utc FROM evidence').all()).toEqual([{ kind: 'page', url: 'https://alpha.co.nz/contact', excerpt: 'Status 404', captured_at_utc: '2026-10-12T05:00:00.000Z' }]);
  });

  it('keep a decision when checked again, and are dropped when they no longer hold', () => {
    const db = memoryDb();
    seed(db, ['alpha']);
    const meta = { auditedAt: '2026-10-12', checkedAt: '2026-10-12T05:00:00.000Z' };
    storeCrawlmouse(db, { id: 1 }, 'b', [result({}), result({ text: '26 of 27 pages have no meta description.', claims: ['no_meta_description'] })], meta);
    const first = db.prepare('SELECT id FROM findings ORDER BY id').all() as { id: number }[];
    db.prepare("UPDATE findings SET status = 'approved' WHERE id = ?").run(first[0]!.id);
    storeCrawlmouse(db, { id: 1 }, 'b', [result({ measured: 'Still 404.' }), result({ text: '26 of 27 pages have no meta description.', claims: ['no_meta_description'], confirmed: false, reason: 'the example has one now' })], meta);
    expect((rows(db) as { status: string }[]).map((r) => r.status)).toEqual(['approved', 'resolved']);
    expect(db.prepare('SELECT COUNT(*) AS n FROM findings').get()).toEqual({ n: 2 });
  });
});

describe('ranking findings for an owner', () => {
  let next = 0;
  const f = (check_id: string, patch: Partial<Rankable> = {}): Rankable => ({ id: ++next, check_id, source: check_id.startsWith('CM_') ? 'crawlmouse' : 'plumbline', status: 'reproduced', severity: 3, score: 3, title: check_id, detail: '{}', ...patch });

  it('puts lost bookings and broken contact first, then speed, security, search and AI, then the rest', () => {
    const ranked = rankFindings([f('C37_not_named_by_ai', { severity: 5 }), f('C41_outdated_platform', { severity: 5 }), f('C20_slow_mobile', { severity: 5 }), f('C70_reviews_not_shown', { severity: 5 }), f('T01_no_online_booking', { severity: 2 }), f('C10_broken_contact_links', { severity: 4 })]);
    expect(ranked.map((r) => [r.finding.check_id, r.group])).toEqual([
      ['C10_broken_contact_links', 'bookings and contact'],
      ['T01_no_online_booking', 'bookings and contact'],
      ['C20_slow_mobile', 'speed'],
      ['C41_outdated_platform', 'security'],
      ['C37_not_named_by_ai', 'search and AI'],
      ['C70_reviews_not_shown', 'other'],
    ]);
    expect(ranked.map((r) => r.place)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('keeps the top three, and a fourth and fifth only when they are severe enough', () => {
    const kept = (list: Rankable[]) => rankFindings(list).filter((r) => r.kept).map((r) => r.finding.check_id);
    const three = [f('C10_broken_contact_links'), f('C20_slow_mobile'), f('C41_outdated_platform')];
    expect(kept([...three, f('C31_no_structured_data', { severity: 2 }), f('C37_not_named_by_ai', { severity: 4 })])).toEqual(['C10_broken_contact_links', 'C20_slow_mobile', 'C41_outdated_platform', 'C37_not_named_by_ai']);
    // A weak fourth is left out, and so is whatever follows it: those put forward are always the first few in order.
    expect(kept([...three, f('C31_no_structured_data', { severity: 2 }), f('C70_reviews_not_shown', { severity: 5 })])).toEqual(['C10_broken_contact_links', 'C20_slow_mobile', 'C41_outdated_platform']);
    expect(kept([...three, f('C37_not_named_by_ai', { severity: 4 }), f('C31_no_structured_data', { severity: 3 }), f('C36_thin_homepage', { severity: 3 })])).toEqual(['C10_broken_contact_links', 'C20_slow_mobile', 'C41_outdated_platform', 'C37_not_named_by_ai', 'C31_no_structured_data']);
    expect(kept([f('C31_no_structured_data', { severity: 1 }), f('C02_stale_copyright', { severity: 1 })])).toEqual(['C31_no_structured_data', 'C02_stale_copyright']);
  });

  it('puts forward one finding for each check, so two broken links of the same kind take one place', () => {
    const ranked = rankFindings([f('C10_broken_contact_links', { severity: 5, title: 'first' }), f('C10_broken_contact_links', { severity: 5, title: 'second' }), f('C16_booking_hard_to_reach', { severity: 4 }), f('C12_broken_internal_links'), f('C20_slow_mobile', { severity: 4 }), f('C41_outdated_platform', { severity: 4 }), f('C37_not_named_by_ai', { severity: 4 })]);
    expect(ranked.map((r) => [r.finding.title, r.kept])).toEqual([
      ['first', true],
      ['second', false],
      ['C16_booking_hard_to_reach', true],
      ['C12_broken_internal_links', true],
      ['C20_slow_mobile', true],
      ['C41_outdated_platform', true],
      ['C37_not_named_by_ai', false],
    ]);
  });

  it('ranks only findings that are reproduced or approved', () => {
    const ranked = rankFindings([f('C10_broken_contact_links', { status: 'rejected' }), f('C20_slow_mobile', { status: 'candidate' }), f('C41_outdated_platform', { status: 'resolved' }), f('C13_no_action_above_fold', { status: 'approved' })]);
    expect(ranked.map((r) => r.finding.check_id)).toEqual(['C13_no_action_above_fold']);
  });

  it('treats an unlinked booking page as a lost booking and other unlinked pages as a search matter', () => {
    expect(groupOf({ check_id: 'CM_orphan_page', title: 'Your Book Online page exists but is not linked from anywhere on the site.' })).toBe('bookings and contact');
    expect(groupOf({ check_id: 'CM_orphan_page', title: 'Your Packages page is not linked from anywhere else on the site.' })).toBe('search and AI');
    expect(groupOf({ check_id: 'X99_unknown', title: '' })).toBe('other');
  });

  it('leaves out a Crawlmouse finding that repeats a Plumbline one, and says which', () => {
    const structured = f('C31_no_structured_data');
    const broken = f('C10_broken_contact_links', { detail: JSON.stringify({ links: [{ href: 'https://www.alpha.co.nz/conservation@alpha.co.nz.html', status: 404 }] }) });
    const sameData = f('CM_no_structured_data');
    const sameLink = f('CM_missing_page', { detail: JSON.stringify({ examples: [{ url: 'https://alpha.co.nz/conservation@alpha.co.nz.html' }] }) });
    const otherLink = f('CM_missing_page', { detail: JSON.stringify({ examples: [{ url: 'https://alpha.co.nz/custom-tours' }] }) });
    const all = [structured, broken, sameData, sameLink, otherLink];
    expect(repeats(sameData, all)?.id).toBe(structured.id);
    expect(repeats(sameLink, all)?.id).toBe(broken.id);
    expect(repeats(otherLink, all)).toBeNull();
    expect(repeats(structured, all)).toBeNull();
    const ranked = rankFindings(all);
    expect(ranked.filter((r) => r.repeatOf === null).map((r) => r.finding.id)).toEqual([broken.id, otherLink.id, structured.id]);
    expect(ranked.filter((r) => r.repeatOf !== null).map((r) => [r.finding.id, r.repeatOf, r.kept])).toEqual([[sameData.id, structured.id, false], [sameLink.id, broken.id, false]]);
  });
});

describe('a research file', () => {
  const about = page('https://alpha.co.nz/about', ['Meet Tony and Lisa Smith, your hosts since 2009.', 'Half day trip $120 per adult.', 'Qualmark Gold 2026']);
  const contact = page('https://alpha.co.nz/contact', ['Email hello@alpha.co.nz or call us.', '12 Wharf Road, Paihia 0200, Bay of Islands']);
  const register = page('https://register.example/alpha-limited', ['Directors: Anthony John SMITH, Lisa Mary SMITH']);
  const prices = page('https://alpha.co.nz/prices', ['Half day trip $130 per adult.']);
  const pages = [about, contact, register, prices];
  const base = () =>
    Research.parse({
      slug: 'alpha',
      trading: { status: 'trading', pages_checked: ['https://alpha.co.nz/about'] },
      people: {
        status: 'confirmed',
        address_as: 'Tony and Lisa',
        owners: [
          { name: 'Anthony John Smith', first_name_used: 'Tony', role: 'owner', confirmed: true, sources: [{ url: 'https://alpha.co.nz/about', quote: 'Meet Tony and Lisa Smith, your hosts since 2009.' }, { url: 'https://register.example/alpha-limited', quote: 'Anthony John SMITH' }] },
        ],
      },
      email: { address: 'hello@alpha.co.nz', published: true, source: { url: 'https://alpha.co.nz/contact', quote: 'Email hello@alpha.co.nz or call us.' } },
      agency: { name: null },
      location: { town: 'Paihia', region: 'Northland', address: '12 Wharf Road, Paihia 0200', source: { url: 'https://alpha.co.nz/contact', quote: '12 Wharf Road, Paihia 0200' } },
      booking: { system: null, link: null, source: null },
      prices: [{ item: 'Half day trip, adult', text: '$120', amount: 120, source: { url: 'https://alpha.co.nz/about', quote: 'Half day trip $120 per adult.' } }],
      price_conflicts: [{ item: 'Half day trip, adult', values: [{ text: '$120', source: { url: 'https://alpha.co.nz/about', quote: 'Half day trip $120 per adult.' } }, { text: '$130', source: { url: 'https://alpha.co.nz/prices', quote: 'Half day trip $130 per adult.' } }] }],
      activities: ['kayak tour'],
      strengths: [{ kind: 'certification', text: 'Qualmark Gold 2026', source: { url: 'https://alpha.co.nz/about', quote: 'Qualmark Gold 2026' } }],
    });

  it('passes when every quote is on its saved page and each confirmed name has two sites behind it', () => {
    expect(checkResearch(base(), pages)).toEqual([]);
  });

  it('says what is wrong: a quote not on the page, a page not kept, a name confirmed from one site', () => {
    const r = base();
    r.people.owners[0]!.sources = [{ url: 'https://alpha.co.nz/about', quote: 'Meet Tony and Lisa Smith, the owners' }];
    r.location.source.url = 'https://alpha.co.nz/find-us';
    r.email.published = true;
    r.email.source = null;
    expect(checkResearch(r, pages)).toEqual([
      'owner Anthony John Smith: the quote is not on https://alpha.co.nz/about: "Meet Tony and Lisa Smith, the owners"',
      'location: https://alpha.co.nz/find-us has not been read and kept',
      'owner Anthony John Smith: marked confirmed with sources on one site only',
      'email: marked published without the page that shows it',
    ]);
  });

  it('wants a quoted sign for a business that is for sale, and no name to address when the owner is unknown', () => {
    const r = base();
    r.trading.status = 'for sale';
    r.people.status = 'owner unknown';
    expect(checkResearch(r, pages)).toEqual(['people: owner unknown, yet a name to address is given', 'trading: status "for sale" without a quoted sign']);
  });

  it('is stored as facts dated by the reading of each page, and sets the town and region', () => {
    const db = memoryDb();
    seed(db, ['alpha']);
    storeResearch(db, { id: 1 }, base(), pages, '2026-10-12T09:00:00.000Z');
    const all = factsFor(db, 1);
    expect([...new Set(all.map((f) => f.topic))].sort()).toEqual(['activity', 'agency', 'booking', 'email', 'location', 'owner', 'people', 'price', 'price_conflict', 'strength', 'trading']);
    expect(factsFor(db, 1, 'owner').map((f) => [f.label, f.sourceUrl, f.flag])).toEqual([['Anthony John Smith', 'https://alpha.co.nz/about', null], ['Anthony John Smith', 'https://register.example/alpha-limited', null]]);
    expect(factsFor(db, 1, 'price')[0]).toMatchObject({ label: 'Half day trip, adult', value: { text: '$120', amount: 120 }, flag: 'conflict', checkedOn: '2026-10-10T20:00:00.000Z' });
    expect(factsFor(db, 1, 'people')[0]).toMatchObject({ value: { status: 'confirmed', addressAs: 'Tony and Lisa', note: null }, flag: null, checkedOn: '2026-10-12T09:00:00.000Z' });
    expect(statedActivities(db, 1)).toEqual(['kayak tour']);
    expect(db.prepare('SELECT town, region FROM businesses WHERE id = 1').get()).toEqual({ town: 'Paihia', region: 'Northland' });
    storeResearch(db, { id: 1 }, base(), pages, '2026-10-13T09:00:00.000Z');
    expect(factsFor(db, 1)).toHaveLength(all.length);
  });
});

describe('photos for the top of a page', () => {
  const photo = (patch: Partial<Photo>): Photo => ({ url: 'https://alpha.co.nz/img/bay.jpg', pageUrl: 'https://alpha.co.nz/', alt: '', bytes: 400_000, width: 2400, height: 1350, format: 'jpeg', hasAlpha: false, sharpness: 6, entropy: 7.2, kind: 'photo', file: null, ...patch });

  it('tells a photograph from a logo, a map, a screenshot and an icon', () => {
    expect(photoKind(photo({}))).toBe('photo');
    expect(photoKind(photo({ url: 'https://alpha.co.nz/img/alpha-logo-large.jpg' }))).toBe('logo');
    expect(photoKind(photo({ format: 'png', hasAlpha: true }))).toBe('logo');
    expect(photoKind(photo({ entropy: 2.1 }))).toBe('logo');
    expect(photoKind(photo({ alt: 'Map of the harbour' }))).toBe('map');
    expect(photoKind(photo({ url: 'https://alpha.co.nz/img/tripmap.jpg' }))).toBe('photo');
    expect(photoKind(photo({ url: 'https://alpha.co.nz/img/Screenshot-2024-01-01.png', format: 'png' }))).toBe('screenshot');
    expect(photoKind(photo({ width: 120, height: 120 }))).toBe('icon');
    // A picture served by a widget or a listing site is not the business's own.
    expect(photoKind(photo({ url: 'https://elfsight.com/assets/age-verification/wine-overlay.jpg' }))).toBe('third party');
    expect(photoKind(photo({ url: 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/1a/bay.jpg' }))).toBe('third party');
    expect(photoKind(photo({ url: 'https://static.wixstatic.com/media/abc~mv2.jpg' }))).toBe('photo');
  });

  it('picks the three crispest photographs at least 1800 px wide and wider than tall', () => {
    const picks = heroCandidates([
      photo({ url: 'a', sharpness: 5, bytes: 3 }),
      photo({ url: 'b', sharpness: 9 }),
      photo({ url: 'c', width: 1700, sharpness: 20 }),
      photo({ url: 'd', kind: 'logo', sharpness: 20 }),
      photo({ url: 'e', width: 2000, height: 3000, sharpness: 20 }),
      photo({ url: 'f', sharpness: 0.5 }),
      photo({ url: 'g', sharpness: 7, bytes: 1 }),
      photo({ url: 'h', sharpness: 3, bytes: 2 }),
      photo({ url: 'b-again', sharpness: 9 }),
    ]);
    expect(picks.map((p) => p.url)).toEqual(['b', 'g', 'a']);
  });

  it('lists every photo fit for the top of a page, those on the homepage first, for a person to choose from', () => {
    const list = heroEligible([
      photo({ url: 'gear', pageUrl: 'https://alpha.co.nz/checklist', sharpness: 30, bytes: 1 }),
      photo({ url: 'bay', pageUrl: 'https://alpha.co.nz/', sharpness: 4, bytes: 2 }),
      photo({ url: 'boat', pageUrl: 'https://www.alpha.co.nz', sharpness: 6, bytes: 3 }),
      photo({ url: 'small', width: 1200, bytes: 4 }),
    ]);
    expect(list.map((p) => p.url)).toEqual(['boat', 'bay', 'gear']);
  });

  it('measures a picture: its size in pixels, its format and how crisp it is', async () => {
    const flat = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: '#336699' } }).jpeg().toBuffer();
    const noisy = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: '#336699', noise: { type: 'gaussian', mean: 128, sigma: 60 } } }).jpeg().toBuffer();
    const a = await measure(flat);
    const b = await measure(noisy);
    expect(a).toMatchObject({ width: 2000, height: 1000, format: 'jpeg', hasAlpha: false });
    expect(b.sharpness).toBeGreaterThan(a.sharpness);
    expect(b.entropy).toBeGreaterThan(a.entropy);
  });
});

describe('what can be learnt about a video without playing it', () => {
  const box = (type: string, body: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length + 8, 0);
    head.write(type, 4, 'latin1');
    return Buffer.concat([head, body]);
  };

  it('reads the length and frame size from the index of an MP4 file', async () => {
    const mvhd = Buffer.alloc(100);
    mvhd.writeUInt32BE(1000, 12);
    mvhd.writeUInt32BE(42_500, 16);
    const tkhd = Buffer.alloc(84);
    tkhd.writeUInt32BE(1920 * 65536, 76);
    tkhd.writeUInt32BE(1080 * 65536, 80);
    const file = Buffer.concat([box('ftyp', Buffer.alloc(16)), box('free', Buffer.alloc(40)), box('moov', Buffer.concat([box('mvhd', mvhd), box('trak', box('tkhd', tkhd))])), box('mdat', Buffer.alloc(64))]);
    const read = async (start: number, end: number) => file.subarray(start, Math.min(end + 1, file.length));
    expect(await mp4Info(read)).toEqual({ seconds: 43, width: 1920, height: 1080 });
    expect(await mp4Info(async () => null)).toEqual({ seconds: null, width: null, height: null });
  });

  it('reads the title, the length and the best picture size from a YouTube page', () => {
    const html = '<title>Sunset cruise &amp; dolphins - YouTube</title><meta name="title" content="Sunset cruise &amp; dolphins"><script>{"lengthSeconds":"94","formats":[{"qualityLabel":"360p"},{"qualityLabel":"1080p60"},{"qualityLabel":"720p"}]}</script>';
    expect(youtubeInfo(html)).toEqual({ title: 'Sunset cruise & dolphins', seconds: 94, quality: '1080p' });
    expect(youtubeInfo('<html></html>')).toEqual({ title: null, seconds: null, quality: null });
  });
});

describe('the pack for a wave', () => {
  function prepared(): Db {
    const db = memoryDb();
    seed(db, ['alpha']);
    db.prepare("UPDATE businesses SET name = 'Alpha Kayaks', town = 'Paihia', region = 'Northland', google_rating = 4.8, google_review_count = 265 WHERE id = 1").run();
    importWave(db, 'wave-2', [{ slug: 'alpha', position: 3, status: 'wave' }]);
    const at = '2026-10-12T20:00:00.000Z';
    setFacts(db, 1, 'trading', [{ label: 'status', value: { status: 'trading', note: null } }, { label: 'closed', value: 'closed', sourceUrl: 'https://alpha.co.nz/', quote: 'NOW CLOSED Re-open September 28th 2026', flag: 'closed' }], at);
    setFacts(db, 1, 'people', [{ label: 'who to address', value: { status: 'confirmed', addressAs: 'Tony and Lisa', note: null } }], at);
    setFacts(db, 1, 'owner', [{ label: 'Anthony John Smith', value: { firstNameUsed: 'Tony', role: 'owner', confirmed: true }, sourceUrl: 'https://alpha.co.nz/about', quote: 'Meet Tony' }, { label: 'Anthony John Smith', value: { firstNameUsed: 'Tony', role: 'owner', confirmed: true }, sourceUrl: 'https://opencorporates.com/companies/nz/1', quote: 'AJ Smith' }], at);
    setFacts(db, 1, 'email', [{ label: 'hello@alpha.co.nz', value: { address: 'hello@alpha.co.nz', published: true, note: null }, sourceUrl: 'https://alpha.co.nz/contact', quote: 'hello@alpha.co.nz' }], at);
    setFacts(db, 1, 'booking', [{ label: 'Rezdy', value: { system: 'Rezdy', link: 'https://alpha.rezdy.com/', note: null }, sourceUrl: 'https://alpha.co.nz/' }], at);
    setFacts(db, 1, 'price', Array.from({ length: 9 }, (_, i) => ({ label: `Trip ${i + 1}`, value: { text: `$${100 + i}`, amount: 100 + i }, sourceUrl: 'https://alpha.co.nz/prices', flag: i === 0 ? 'conflict' : null })), at);
    setFacts(db, 1, 'price_conflict', [{ label: 'Trip 1', value: '$100', sourceUrl: 'https://alpha.co.nz/prices' }, { label: 'Trip 1', value: '$110', sourceUrl: 'https://alpha.co.nz/tours' }], at);
    setFacts(db, 1, 'activity', [{ value: 'kayak tour' }, { value: 'kayak hire' }], at);
    setFacts(db, 1, 'ai', [{ label: 'Who should I book a kayak tour with in or near Paihia, New Zealand? Name specific operators.', value: { answers: 6, namedIn: 5, others: [] }, flag: 'strength' }], at);
    setFacts(db, 1, 'strength', [{ label: 'certification', value: 'Qualmark Gold', sourceUrl: 'https://alpha.co.nz/about' }], at);
    setFacts(db, 1, 'photo', [{ label: 'https://alpha.co.nz/bay.jpg', value: { width: 2400, height: 1350, kind: 'photo', file: '/data/wave/alpha/photos/001.jpg' }, sourceUrl: 'https://alpha.co.nz/', flag: 'hero 1' }, { label: 'https://alpha.co.nz/logo.png', value: { width: 300, height: 80, kind: 'logo', file: null }, sourceUrl: 'https://alpha.co.nz/' }], at);
    setFacts(db, 1, 'video', [{ label: 'https://www.youtube.com/watch?v=abc', value: { kind: 'youtube', how: 'embedded', title: 'Paddle the bay', seconds: 94, quality: '1080p', note: null }, sourceUrl: 'https://alpha.co.nz/' }], at);
    setFacts(db, 1, 'colour', [{ label: 'background', value: { hex: '#ffffff', share: 0.6 } }], at);
    setFacts(db, 1, 'font', [{ value: { headings: 'Figtree', body: 'Open Sans' } }], at);
    setFacts(db, 1, 'voice', Array.from({ length: 5 }, (_, i) => ({ value: `We love this bay, reason ${i + 1}.`, sourceUrl: 'https://alpha.co.nz/about' })), at);
    setFacts(db, 1, 'agency', [{ label: 'summary', value: { name: 'Tidal Studio', note: null }, flag: 'agency' }, { label: 'Tidal Studio', value: 'footer credit', sourceUrl: 'https://alpha.co.nz/', quote: 'Website by Tidal Studio' }], at);
    setFacts(db, 1, 'unknown', [{ value: 'The closed notice on the homepage is out of date.' }], at);
    const add = db.prepare("INSERT INTO findings (business_id, batch, check_id, pack, tier, severity, status, reproduced, fingerprint, title, visibility_weight, score, detail, first_seen_at, last_verified_at, source) VALUES (1, 'b', ?, ?, 'measured', ?, ?, 1, ?, ?, 1, ?, ?, ?, ?, ?)");
    add.run('C20_slow_mobile', 'core', 4, 'approved', 'speed', 'Mobile performance score 31, main content after 8.2 s', 4, '{}', at, at, 'plumbline');
    const cm = add.run('CM_missing_page', 'crawlmouse', 5, 'approved', 'a-link', 'A link to your Contact page leads to a missing page (404).', 3, JSON.stringify({ measured: 'The page answers 404 (not found). The link "Contact Us" on https://alpha.co.nz/faq leads to it.', examples: [{ url: 'https://alpha.co.nz/contact-us' }] }), at, at, 'crawlmouse');
    add.run('C31_no_structured_data', 'core', 2, 'reproduced', 'sd', 'No business structured data on the homepage', 2, '{}', at, at, 'plumbline');
    db.prepare("INSERT INTO evidence (finding_id, kind, path, captured_at_utc, captured_at_nz) VALUES (?, 'page', '/data/evidence/alpha/crawlmouse-1.webp', ?, 'x')").run(cm.lastInsertRowid, at);
    return db;
  }

  it('gathers the facts and the approved findings, ranked for the owner', () => {
    const db = prepared();
    const p = packBusiness(db, waveMembers(db, 'wave-2')[0]!, 'b', { linkedin: 'https://www.linkedin.com/in/tony', googleMeasuredOn: '2026-10-10T22:45:00.000Z' });
    expect(p.findings.map((f) => [f.source, f.check, f.sentence])).toEqual([
      ['Crawlmouse', 'CM_missing_page', 'A link to your Contact page leads to a missing page (404).'],
      ['Plumbline', 'C20_slow_mobile', 'The page is slow on a phone'],
    ]);
    expect(p.findings[0]).toMatchObject({ measured: 'The page answers 404 (not found). The link "Contact Us" on https://alpha.co.nz/faq leads to it.', evidence: ['/data/evidence/alpha/crawlmouse-1.webp'] });
    expect(p.findings[1]!.measured).toBe('Mobile performance score 31, main content after 8.2 s');
    expect(p.people).toMatchObject({ status: 'confirmed', addressAs: 'Tony and Lisa', linkedin: 'https://www.linkedin.com/in/tony' });
    expect(p.people.owners[0]!.sources.map((s) => s.url)).toEqual(['https://alpha.co.nz/about', 'https://opencorporates.com/companies/nz/1']);
    expect(p.assets.photos.filter((x) => x.hero).map((x) => `${x.width}x${x.height}`)).toEqual(['2400x1350']);
    expect(p.priceConflicts).toEqual([{ item: 'Trip 1', values: [{ text: '$100', sourceUrl: 'https://alpha.co.nz/prices' }, { text: '$110', sourceUrl: 'https://alpha.co.nz/tours' }] }]);
  });

  it('writes a section of no more than 70 lines that names every part, with sources and dates', () => {
    const db = prepared();
    const lines = packLines(packBusiness(db, waveMembers(db, 'wave-2')[0]!, 'b', { googleMeasuredOn: '2026-10-10T22:45:00.000Z' }));
    expect(lines.length).toBeLessThanOrEqual(PACK_MAX_LINES);
    const text = lines.join('\n');
    expect(lines[0]).toBe('## 3. Alpha Kayaks');
    for (const part of ['**Business:**', '**People:**', '**Email:**', '**Google:**', '**Booking:**', '**Approved findings, ranked:**', '**Strengths:**', '**Assets:**', '**Risks and unknowns:**']) expect(text).toContain(part);
    expect(text).toContain('Flag, closed: "NOW CLOSED Re-open September 28th 2026" (https://alpha.co.nz/, checked 2026-10-13)');
    expect(text).toContain('address as Tony and Lisa. Status: confirmed.');
    expect(text).toContain('hello@alpha.co.nz. Shown on https://alpha.co.nz/contact, checked 2026-10-13.');
    expect(text).toContain('4.8 from 265 reviews, measured 2026-10-11.');
    expect(text).toContain('PRICE CONFLICT, Trip 1: $100 on https://alpha.co.nz/prices but $110 on https://alpha.co.nz/tours. We do not pick one.');
    expect(text).toContain('[#2, Crawlmouse] A link to your Contact page leads to a missing page (404). Measured: The page answers 404 (not found).');
    expect(text).toContain('AI check (a strength): named in 5 of 6 answers');
    expect(text).toContain('Hero photo 1: 2400x1350 px, https://alpha.co.nz/bay.jpg');
    expect(text).toContain('Video (youtube, embedded): https://www.youtube.com/watch?v=abc, 1 min 34 s, 1080p');
    expect(text).toContain('Agency: Tidal Studio appears to look after the site');
    expect(text).not.toContain('C31');
  });

  it('writes the pack file and one data file for each business', () => {
    const db = prepared();
    const dir = mkdtempSync(join(tmpdir(), 'plumbline-pack-'));
    const r = writePack(db, 'wave-2', 'b', dir);
    expect(r.file).toBe(join(dir, 'WAVE-2-PACK.md'));
    expect(readFileSync(r.file, 'utf8')).toContain('## 3. Alpha Kayaks');
    expect(JSON.parse(readFileSync(join(dir, 'wave-2', 'alpha.json'), 'utf8'))).toMatchObject({ slug: 'alpha', position: 3, email: { address: 'hello@alpha.co.nz' } });
  });
});
