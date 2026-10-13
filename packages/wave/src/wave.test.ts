import { describe, expect, it } from 'vitest';
import { memoryDb, type Db } from '@plumbline/core';
import { block, link, page } from '@plumbline/checks/testing';
import { agencySigns, bookingLinks, factPageUrls, fullSize, imageUrlsIn, pagePrices, quoteOnPage, tradingFlags, videosIn } from './extract.ts';
import { CHECK_IDS, type AiSummary } from '@plumbline/checks';
import { loadLibrary } from '@plumbline/impact';
import { settleAi } from './ai.ts';
import { factsFor, setFacts, statedActivities } from './facts.ts';
import { importWave, waveMembers, waves } from './list.ts';

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
