import { describe, expect, it } from 'vitest';
import { bookingSystemsIn, bookingish, pageSaysMissing } from './booking.ts';
import { buildFindings, hygienePage, type RunMeasured } from './findings.ts';
import { homeFacts } from './home.ts';
import { capBuilds, type FactPack } from './report.ts';
import { greetingNames, nameForms, waveRows } from './list.ts';
import { creditsIn, faithFlags, testimonialsOn } from './screens.ts';
import { isSlowOnPhone, speedVerdict } from './speed.ts';
import { KINDS, rankRunFindings, recommendation, sentenceFor, type FindingType, type RawFinding } from './tiers.ts';
import { decodeCfEmail, emailsInSource, nameOnText, textOf, urlIn, verifyFacts, type PageRead, type Reader } from './verify.ts';

const row = waveRows([{ order: '1', status: 'wave 4', slug: 'x', business_name: 'X', website: 'https://x.co.nz', email: 'info@x.co.nz', email_source_url: 'https://x.co.nz/contact', greeting: 'Mike and Nans', owner_names: 'Mike Kirkpatrick (owner/guide), wife Nans Kirkpatrick-Stolk', owner_source_url_1: 'https://x.co.nz/about' }])[0]!;

const page = (html: string, over: Partial<PageRead> = {}): PageRead => ({ ok: true, status: 200, finalUrl: 'https://x.co.nz/', html, text: textOf(html), via: 'http', ...over });

describe('checking the list against the site', () => {
  it('decodes an address Cloudflare has hidden', () => {
    // "info@x.co.nz" with key 0x2a
    const key = 0x2a;
    const hex = key.toString(16).padStart(2, '0') + [...'info@x.co.nz'].map((c) => (c.charCodeAt(0) ^ key).toString(16).padStart(2, '0')).join('');
    expect(decodeCfEmail(hex)).toBe('info@x.co.nz');
    expect(emailsInSource(`<a class="__cf_email__" data-cfemail="${hex}">[email protected]</a>`)).toContain('info@x.co.nz');
    expect(emailsInSource(`<a href="/cdn-cgi/l/email-protection#${hex}">write</a>`)).toContain('info@x.co.nz');
  });

  it('finds an address however it is written', () => {
    expect(emailsInSource('<a href="mailto:Info%40X.co.nz?subject=hi">mail</a>')).toContain('info@x.co.nz');
    expect(emailsInSource('<p>write to info [at] x [dot] co [dot] nz</p>')).toContain('info@x.co.nz');
    expect(emailsInSource('<p>info@x.co.nz</p>')).toEqual(['info@x.co.nz']);
  });

  it('matches names as words, with short forms and without hyphens or accents', () => {
    expect(greetingNames('Mike and Nans')).toEqual(['Mike', 'Nans']);
    expect(nameForms('Malc', 'Malcolm Halstead')).toContain('Malcolm');
    expect(nameOnText('Meet Malcolm, our skipper', nameForms('Malc', 'Malcolm Halstead'))).toBe(true);
    expect(nameOnText('Meet Mikey', ['Mike'])).toBe(false);
    expect(nameOnText('Anne-Marie runs it', ['Anne Marie'])).toBe(true);
  });

  const reader = (pages: Record<string, string>, browser: Record<string, string> = {}): Reader => async (url, via) => {
    const src = via === 'http' ? pages : browser;
    return url in src ? page(src[url]!, { via, finalUrl: url }) : null;
  };

  it('passes when the site answers, the email is on its page and the owners are named', async () => {
    const r = await verifyFacts(row, reader({ 'https://x.co.nz': '<p>hi</p>', 'https://x.co.nz/contact': '<a href="mailto:info@x.co.nz">m</a>', 'https://x.co.nz/about': '<p>Mike and Nans run it</p>' }));
    expect(r.changed).toEqual([]);
    expect(r.email.found).toBe(true);
    expect(r.owners.names.every((n) => n.found)).toBe(true);
  });

  it('marks facts_changed and guesses nothing when something no longer holds', async () => {
    const r = await verifyFacts(row, reader({ 'https://x.co.nz': '<p>hi</p>', 'https://x.co.nz/contact': '<a href="mailto:other@x.co.nz">m</a>', 'https://x.co.nz/about': '<p>Mike runs it</p>' }));
    expect(r.changed).toEqual(['info@x.co.nz no longer appears on https://x.co.nz/contact', 'Nans does not appear on https://x.co.nz/about']);
    expect(r.email.seenOnPage).toEqual(['other@x.co.nz']);
  });

  it('reads a page as a browser shows it when the plain source is empty', async () => {
    const r = await verifyFacts(row, reader({ 'https://x.co.nz': '<p>hi</p>', 'https://x.co.nz/contact': '<div id=app></div>', 'https://x.co.nz/about': '<div id=app></div>' }, { 'https://x.co.nz/contact': '<a href="mailto:info@x.co.nz">m</a>', 'https://x.co.nz/about': '<p>Mike and Nans</p>' }));
    expect(r.changed).toEqual([]);
    expect(r.email.via).toBe('browser');
  });

  it('reads the address in a list cell that has a note after it', () => {
    expect(urlIn('https://riverstonekaramea.co.nz/ (guest testimonial)')).toBe('https://riverstonekaramea.co.nz/');
    expect(urlIn('https://x.co.nz/about')).toBe('https://x.co.nz/about');
  });

  it('flags a site that does not answer', async () => {
    const r = await verifyFacts(row, async () => page('', { ok: false, status: 503 }));
    expect(r.site.ok).toBe(false);
    expect(r.changed[0]).toBe('the site does not answer (503)');
  });
});

describe('phone speed from the API', () => {
  const run = (performance: number, lcpMs: number) => ({ performance, lcpMs, cls: 0, tbtMs: 0 });
  it('uses two runs that agree', () => {
    const v = speedVerdict([run(40, 6000), run(44, 5000)]);
    expect(v.status).toBe('ok');
    expect(v.performance).toBe(42);
    expect(isSlowOnPhone(v)).toBe(true);
  });
  it('does not use two runs more than 20 percent apart', () => {
    const v = speedVerdict([run(40, 6000), run(55, 5000)]);
    expect(v.status).toBe('unstable');
    expect(v.reason).toContain('27%');
    expect(isSlowOnPhone(v)).toBe(false);
  });
  it('is unavailable without two scores', () => {
    expect(speedVerdict([{ performance: null, lcpMs: null, cls: null, tbtMs: null, error: 'PageSpeed API answered 429' }]).status).toBe('unavailable');
    expect(speedVerdict([run(40, 6000)]).status).toBe('unavailable');
  });
  it('needs main content after 4 seconds as well as a score under 50', () => {
    expect(isSlowOnPhone(speedVerdict([run(40, 3000), run(42, 3500)]))).toBe(false);
    expect(isSlowOnPhone(speedVerdict([run(55, 6000), run(58, 6500)]))).toBe(false);
  });
});

describe('booking paths', () => {
  it('recognises the booking systems of the list', () => {
    const html = `<a href="https://reservations.thebookingbutton.com.au/x">Book</a><iframe src="https://www.resonline.com/x"></iframe><script src="https://app.cliniko.com/x.js"></script><a href="https://bookeo.com/x">b</a><a href="https://fareharbor.com/embeds/book/x">f</a>`;
    expect(bookingSystemsIn([{ url: 'https://x.co.nz', html }]).map((s) => s.system).sort()).toEqual(['Bookeo', 'Cliniko', 'FareHarbor', 'Little Hotelier', 'ResOnline']);
    expect(bookingSystemsIn([{ url: 'https://x.co.nz', html: '<meta name="generator" content="Wix.com Website Builder"><a href="/booking-calendar/massage">Book</a>' }]).map((s) => s.system)).toEqual(['Wix Bookings']);
  });
  it('knows a page that says it is gone', () => {
    expect(pageSaysMissing(404, '', '')).toBe(true);
    expect(pageSaysMissing(200, 'Page not found', '')).toBe(true);
    expect(pageSaysMissing(200, 'Book now', 'Book')).toBe(false);
  });
  it('tells booking links from the rest', () => {
    expect(bookingish('Accomodation')).toBe(true);
    expect(bookingish('/product-page/gift-voucher')).toBe(true);
    expect(bookingish('Blog')).toBe(false);
  });
});

describe('screens', () => {
  const capture = (text: string) => ({ finalUrl: 'https://x.co.nz/', text }) as never;
  it('finds testimonials a visitor can see, and a review widget', () => {
    const html = '<h2>What our clients say</h2><p>Sharon fixed my shoulder after two sessions and I could swing a racket again.</p><script src="https://static.elfsight.com/platform/platform.js"></script>';
    const signs = testimonialsOn(capture(textOf(html)), html);
    expect(signs.map((s) => s.kind).sort()).toEqual(['section', 'widget']);
    expect(signs.find((s) => s.kind === 'widget')!.text).toBe('Elfsight reviews widget');
    // Text hidden from visitors is not visible text, so it is not found.
    expect(testimonialsOn(capture('Home About'), html).some((s) => s.kind === 'section')).toBe(false);
  });
  it('names a credit for whoever built the site, but not a site builder', () => {
    expect(creditsIn('Website Design by Rapideye Media Copyright \u00a9 The Gambler 2021')).toEqual(['Rapideye Media']);
    expect(creditsIn('Site by Clever Studio | Privacy')).toEqual(['Clever Studio']);
    expect(creditsIn('Website by Wix.com')).toEqual([]);
  });
  it('flags a menu page that sells wine and leaves the others', () => {
    const flags = faithFlags([
      { label: 'Wine shop', url: 'https://x.co.nz/shop', title: 'Wine', h1: 'Our wines', text: 'Buy a case of pinot noir. $240 per case. Add to cart.' },
      { label: 'Tours', url: 'https://x.co.nz/tours', title: 'Tours', h1: 'Tours', text: 'A day on the water with lunch. Book now. $120.' },
    ]);
    expect(flags).toHaveLength(1);
    expect(flags[0]!.topic).toBe('alcohol');
  });
});

describe('sentences, filters and ranking', () => {
  const at = '2026-10-17T00:00:00.000Z';
  const f = (type: FindingType, over: Partial<RawFinding> = {}): RawFinding => ({ type, facts: { label: 'Book Now', page: 'homepage', title: 'x', count: 2, of: 5, score: 41, seconds: 6.2, product: 'PHP', version: '7.4', since: 'November 2022', year: '2021', season: 'summer', text: 'lorem ipsum' }, measured: 'm', evidenceUrl: 'https://x.co.nz/', key: type, source: 'plumbline', measuredAt: at, ...over });

  it('writes every kind as one plain sentence with no dash in it', () => {
    for (const type of Object.keys(KINDS) as FindingType[]) {
      const s = sentenceFor(type, { ...f(type).facts, label: 'Pre-book now – today', title: 'copy-of-room', page: 'room-two page', what: 'enquiry form' });
      expect(s, type).toMatch(/\.$/);
      expect(s, type).not.toMatch(/[-‐-―]/);
      expect(s.match(/\. /g)?.length ?? 0, type).toBe(0);
    }
  });

  it('puts the lower tier first and keeps three', () => {
    const { top } = rankRunFindings([f('no_description'), f('broken_images'), f('phone_sideways'), f('book_button_missing'), f('slow_phone', { steady: true }), f('hello_world')], { agencies: [] });
    expect(top.map((t) => t.type)).toEqual(['book_button_missing', 'slow_phone', 'phone_sideways']);
    expect(top.map((t) => t.place)).toEqual([1, 2, 3]);
  });

  it('never puts a minor search item above third place', () => {
    expect(rankRunFindings([f('no_description'), f('no_heading')], { agencies: [] }).top).toEqual([]);
    expect(rankRunFindings([f('hello_world'), f('no_description')], { agencies: [] }).top.map((t) => t.type)).toEqual(['hello_world']);
    expect(rankRunFindings([f('hello_world'), f('phone_sideways'), f('no_description')], { agencies: [] }).top.map((t) => t.type)).toEqual(['phone_sideways', 'hello_world', 'no_description']);
  });

  it('drops what does not reproduce, a missing page nothing links to, unstable speed, duplicates and a named agency', () => {
    const { top, dropped } = rankRunFindings(
      [
        f('broken_link', { key: 'a', reproduced: false }),
        f('broken_link', { key: 'b', unlinked: true }),
        f('slow_phone', { key: 'c', steady: false }),
        f('book_link_broken', { key: 'd' }),
        f('book_link_broken', { key: 'd', source: 'crawlmouse' }),
        f('form_not_loading', { key: 'e', evidenceUrl: 'https://cleverstudio.co.nz/form' }),
      ],
      { agencies: ['cleverstudio.co.nz'] },
    );
    expect(top.map((t) => t.type)).toEqual(['book_link_broken']);
    expect(dropped.map((d) => d.reason)).toEqual(['does not reproduce today', 'a missing page that nothing links to', 'speed unstable or unavailable', 'names a web agency (cleverstudio.co.nz)', 'duplicate of a booking or contact broken item']);
  });

  it('recommends BUILD only when the lead is tier 1 to 4, or a tier 5 item on the homepage or in the main menu', () => {
    const lead = (type: FindingType, over: Partial<RawFinding> = {}) => rankRunFindings([f(type, over)], { agencies: [] }).top;
    expect(recommendation(lead('book_button_missing'))).toBe('BUILD');
    expect(recommendation(lead('phone_no_action'))).toBe('BUILD');
    expect(recommendation(lead('hello_world', { onMain: true }))).toBe('BUILD');
    expect(recommendation(lead('hello_world', { onMain: false }))).toBe('RESERVE');
    expect(recommendation(lead('outdated_software'))).toBe('RESERVE');
    expect(recommendation([])).toBe('RESERVE');
  });

  it('never lets tier 6 or tier 7 lead, and keeps tier 7 out of a subject', () => {
    expect(rankRunFindings([f('stale_copyright'), f('covid_wording')], { agencies: [] }).top).toEqual([]);
    const { top } = rankRunFindings([f('stale_copyright'), f('covid_wording'), f('phone_no_action')], { agencies: [] });
    expect(top.map((t) => [t.type, t.tier, t.subjectOk])).toEqual([['phone_no_action', 4, true], ['covid_wording', 6, true], ['stale_copyright', 7, false]]);
    // A tier 7 item is third at most.
    expect(rankRunFindings([f('phone_no_action'), f('stale_copyright')], { agencies: [] }).top.map((t) => t.type)).toEqual(['phone_no_action']);
  });

  it('puts a tier 5 item on the homepage or in the menu before one that is not', () => {
    const { top } = rankRunFindings([f('hello_world', { onMain: false }), f('demo_page', { onMain: true })], { agencies: [] });
    expect(top.map((t) => t.type)).toEqual(['demo_page', 'hello_world']);
  });
});

describe('findings from what was measured', () => {
  const base = (over: Partial<RunMeasured>): RunMeasured =>
    ({
      slug: 'x',
      measuredAt: '2026-10-17T00:00:00.000Z',
      category: 'kayak',
      homepage: 'https://x.co.nz/',
      collection: { blocked: null, errors: [], pagesRead: 3, checkErrors: [] },
      checks: [],
      eol: [],
      speed: { source: 'PageSpeed Insights API', status: 'unavailable', runs: [], spread: null, performance: null, lcpMs: null, reason: 'x', measuredAt: '' },
      phone: null,
      booking: null,
      crawlmouse: [],
      pages: [],
      physio: null,
      faith: [],
      agencies: [],
      refusal: null,
      pelorus: null,
      trading: [],
      aiCrawlers: { allowed: true, blocked: [] },
      ...over,
    }) as RunMeasured;

  it('turns a Book button that lands on the contact page into a tier 1 sentence', () => {
    const m = base({ booking: { systems: [], path: 'contact page only', unlinked: [], forms: [], noWay: false, landings: [{ text: 'Book Now', href: 'https://x.co.nz/contact/', kind: 'page', status: 200, finalUrl: 'https://x.co.nz/contact/', landsOn: 'the contact page', problem: 'contact_page', system: null, error: null }] } });
    const [one] = rankRunFindings(buildFindings(m), { agencies: [] }).top;
    expect(one!.sentence).toBe('The "Book Now" button on your homepage opens your contact page, not a booking page.');
    expect(one!.tier).toBe(1);
  });

  it('uses a Crawlmouse sentence only when it held, and a missing page only when a page links to it', () => {
    const ex = { url: 'https://x.co.nz/accomodation', status: 404, missing: true, title: '', words: 0, snippet: '' };
    const sentence = (confirmed: boolean, linked: boolean) => ({ text: 't', claims: ['missing_page'], caution: null, confirmed, undecided: false, measured: 'm', reason: null, examples: [{ ...ex, linkedFrom: linked ? [{ pageUrl: 'https://x.co.nz/', text: 'Accomodation', where: 'menu' }] : [] }] });
    const rank = (c: ReturnType<typeof sentence>) => rankRunFindings(buildFindings(base({ crawlmouse: [c] })), { agencies: [] }).top.map((t) => t.sentence);
    expect(rank(sentence(true, true))).toEqual(['The "Accomodation" link on your homepage opens a page that is not found.']);
    expect(rank(sentence(true, false))).toEqual([]);
    expect(rank(sentence(false, true))).toEqual([]);
  });

  it('says a template post, a Hello world post and copy of addresses by what the pages show', () => {
    const e = (url: string, title: string, snippet: string) => ({ url, status: 200, missing: false, title, words: 5, snippet, linkedFrom: [] });
    const m = base({
      crawlmouse: [
        { text: 'a', claims: ['leftover_page'], caution: null, confirmed: true, undecided: false, measured: 'm', reason: null, examples: [e('https://x.co.nz/hello-world', 'Hello world!', 'Welcome to WordPress'), e('https://x.co.nz/a-blog-post-copy-zR18sT', 'Monkeys: adorable mischief', 'My post content')] },
        { text: 'b', claims: ['leftover_page'], caution: null, confirmed: true, undecided: false, measured: 'm', reason: null, examples: [e('https://x.co.nz/copy-of-queen-studio', 'Twin Studios', 'x'), e('https://x.co.nz/copy-of-studios-8-9-1', 'Studios', 'x')] },
        { text: 'c', claims: ['leftover_page'], caution: null, confirmed: true, undecided: false, measured: 'm', reason: null, examples: [e('https://x.co.nz/demo-page', 'demo page - Welcome to Onerahi Physiotherapy, Whangarei', 'x')] },
      ],
    });
    const ranked = rankRunFindings(buildFindings(m), { agencies: [] });
    const sentences = [...ranked.top, ...ranked.rest].map((t) => t.sentence);
    expect(sentences).toEqual(['The default "Hello world!" post is still live on your website.', 'A template blog post titled "Monkeys: adorable mischief" is still live on your website.', 'A page titled "demo page" is still live on your website.', '2 of your pages have web addresses that start with copy of, so the address names a different page from its content.']);
  });

  it('puts the physio testimonial finding at tier 2 and only for a physio', () => {
    const signs = [{ kind: 'widget' as const, text: 'Elfsight reviews widget', url: 'https://x.co.nz/', source: 'https://static.elfsight.com/p.js' }];
    expect(rankRunFindings(buildFindings(base({ category: 'physio', physio: signs })), { agencies: [] }).top[0]!.tier).toBe(2);
    expect(buildFindings(base({ category: 'kayak', physio: null })).some((x) => x.type === 'physio_testimonials')).toBe(false);
  });

  it('states minor search items as none, some or one', () => {
    expect(sentenceFor('no_heading', { count: 7, of: 7 })).toBe('None of the 7 pages we read has a main heading.');
    expect(sentenceFor('no_description', { count: 1, of: 3 })).toBe('1 of the 3 pages we read has no description for search results.');
    expect(sentenceFor('no_structured_data', { count: 2, of: 3 })).toBe('2 of the 3 pages we read have no structured data describing the business.');
    expect(sentenceFor('no_description', { count: 1, of: 1 })).toBe('Your homepage has no description for search results.');
  });

  it('does not repeat the word link when a link has no words on it', () => {
    expect(sentenceFor('broken_link', { label: '', page: 'homepage' })).toBe('A link on your homepage opens a page that is not found.');
  });

  const check = (checkId: string, title: string, detail: Record<string, unknown>) => ({ checkId, title, pageUrl: 'https://x.co.nz/', detail, excerpt: title, evidenceUrl: 'https://x.co.nz/' });
  const mBase = (over: Partial<RunMeasured>) => ({ slug: 'x', measuredAt: '2026-10-17T00:00:00.000Z', category: 'kayak', homepage: 'https://x.co.nz/', collection: { blocked: null, errors: [], pagesRead: 3, checkErrors: [] }, checks: [], eol: [], speed: { source: 'PageSpeed Insights API', status: 'unavailable', runs: [], spread: null, performance: null, lcpMs: null, reason: 'x', measuredAt: '' }, phone: null, booking: null, crawlmouse: [], pages: [], physio: null, faith: [], agencies: [], refusal: null, pelorus: null, trading: [], aiCrawlers: { allowed: true, blocked: [] }, ...over }) as RunMeasured;

  it('leaves out a share button, a menu toggle and a seasonal word, and names a social link for what it is', () => {
    const types = buildFindings(
      mBase({
        checks: [
          check('C10_broken_contact_links', 'The WhatsApp link is broken', { kind: 'whatsapp', href: 'https://api.whatsapp.com/send?text=https%3A%2F%2Fx.co.nz%2Fp', problem: 'no number' }),
          check('C10_broken_contact_links', 'A contact link has a malformed address', { kind: 'scheme', href: 'https://https://www.facebook.com/x/', problem: 'repeats the scheme' }),
          check('C11_dead_navigation', '1 menu item leads nowhere', { items: [{ text: 'Click for menu' }] }),
          check('C04_seasonal_mismatch', 'A winter message is showing out of season', { season: 'winter' }),
          check('C03_stale_dated_notice', 'COVID wording is still showing', { kind: 'covid', text: 'ot offered due to Covid 19' }),
        ],
      }),
    ).map((f) => f.type);
    expect(types).toEqual(['social_link_broken', 'covid_wording']);
  });

  it('tells a page that really scrolls sideways from one that is only laid out wider', () => {
    const phone = { url: 'https://x.co.nz/', width: 390, height: 844, actions: ['phone link'], actionVisible: true, scrollWidth: 812, scrollX: 0 };
    expect(buildFindings(mBase({ phone: { ...phone, sideways: false, wider: true } })).map((f) => f.type)).toEqual(['phone_wider']);
    expect(buildFindings(mBase({ phone: { ...phone, sideways: true, wider: false, scrollX: 11 } })).map((f) => f.type)).toEqual(['phone_sideways']);
  });
});

describe('the hygiene rules', () => {
  const mk = (over: Partial<RunMeasured>): RunMeasured =>
    ({
      slug: 'x',
      measuredAt: '2026-10-17T00:00:00.000Z',
      category: 'kayak',
      homepage: 'https://x.co.nz/',
      collection: { blocked: null, errors: [], pagesRead: 3, checkErrors: [] },
      checks: [],
      eol: [],
      speed: { source: 'PageSpeed Insights API', status: 'unavailable', runs: [], spread: null, performance: null, lcpMs: null, reason: 'x', measuredAt: '' },
      phone: null,
      booking: null,
      crawlmouse: [],
      pages: [],
      physio: null,
      faith: [],
      agencies: [],
      refusal: null,
      pelorus: null,
      trading: [],
      home: { menu: ['https://x.co.nz/about/', 'https://x.co.nz/copy-of-room'], contact: false, lastUpdated: [] },
      aiCrawlers: { allowed: true, blocked: [] },
      ...over,
    }) as RunMeasured;
  const check = (checkId: string, title: string, detail: Record<string, unknown>, pageUrl = 'https://x.co.nz/') => ({ checkId, title, pageUrl, detail, excerpt: title, evidenceUrl: pageUrl });
  const tiers = (m: RunMeasured) => Object.fromEntries(rankRunFindings(buildFindings(m), { agencies: [] }).top.concat(rankRunFindings(buildFindings(m), { agencies: [] }).rest).map((t) => [t.type, t.tier]));

  it('makes the footer year and a last updated line tier 7, and COVID wording tier 6', () => {
    const m = mk({
      checks: [check('C02_stale_copyright', 'The footer says 2021', { year: 2021, currentYear: 2026 }), check('C03_stale_dated_notice', 'COVID wording is still showing', { kind: 'covid', text: 'Covid 19 rules' })],
      home: { menu: [], contact: false, lastUpdated: [{ url: 'https://x.co.nz/', text: 'Last updated 3 March 2020' }] },
    });
    expect(tiers(m)).toEqual({ stale_copyright: 7, last_updated: 7, covid_wording: 6 });
  });

  it('makes a past date notice tier 5 on the homepage or a menu page, and tier 6 elsewhere', () => {
    const notice = (url: string) => mk({ checks: [check('C03_stale_dated_notice', 'An expired date is still showing', { kind: 'expired', date: '2020-01-01', text: 'Open until 2020' }, url)] });
    expect(tiers(notice('https://x.co.nz/about/')).passed_notice).toBe(5);
    expect(tiers(notice('https://x.co.nz/')).passed_notice).toBe(5);
    expect(tiers(notice('https://x.co.nz/winter-news/')).passed_notice).toBe(6);
  });

  it('makes anything on a jobs, careers, privacy or terms page tier 6 at most', () => {
    expect(['/kayak-guide-job-new-zealand/', '/careers', '/privacy-policy', '/terms-and-conditions'].map((p) => hygienePage(`https://x.co.nz${p}`))).toEqual([true, true, true, true]);
    expect(hygienePage('https://x.co.nz/tours/')).toBe(false);
    const m = mk({ checks: [check('C03_stale_dated_notice', 'An expired date is still showing', { kind: 'expired', date: '2018-03-01', text: 'Paid until March 2018' }, 'https://x.co.nz/kayak-guide-job-new-zealand/')], home: { menu: ['https://x.co.nz/kayak-guide-job-new-zealand/'], contact: true, lastUpdated: [] } });
    expect(tiers(m).passed_notice).toBe(6);
  });

  it('makes one image that does not load tier 6 and several tier 5', () => {
    const images = (n: number) => mk({ checks: [check('C06_broken_images', `${n} images fail`, { images: Array.from({ length: n }, (_, i) => `i${i}`) })] });
    expect(tiers(images(1)).broken_images).toBe(6);
    expect(tiers(images(3)).broken_images).toBe(5);
  });

  it('makes an unlinked contact page tier 1 only when the homepage shows no phone, email or contact link', () => {
    const booking = (contact: boolean) =>
      mk({
        home: { menu: [], contact, lastUpdated: [] },
        booking: { systems: [], path: 'x', landings: [], forms: [], noWay: false, unlinked: [{ url: 'https://x.co.nz/contact/', title: 'Contact', status: 200, pagesRead: 5 }] },
      });
    expect(tiers(booking(false)).booking_page_unlinked).toBe(1);
    expect(tiers(booking(true)).booking_page_unlinked).toBe(6);
  });

  it('makes copy of addresses tier 5 only when the menu leads to one, and a blank page tier 6', () => {
    const e = (url: string) => ({ url, status: 200, missing: false, title: 'Room', words: 5, snippet: 'x', linkedFrom: [] });
    const sentence = (url: string) => ({ text: 'c', claims: ['leftover_page'], caution: null, confirmed: true, undecided: false, measured: 'm', reason: null, examples: [e(url)] });
    expect(tiers(mk({ crawlmouse: [sentence('https://x.co.nz/copy-of-room')] })).copy_of_address).toBe(5);
    expect(tiers(mk({ crawlmouse: [sentence('https://x.co.nz/copy-of-other')] })).copy_of_address).toBe(6);
    expect(tiers(mk({ crawlmouse: [sentence('https://x.co.nz/new-page')] })).blank_page).toBe(6);
  });

  it('reads the menu, the contact check and out of date last updated lines from saved pages', () => {
    const page = (path: string, text: string, links: object[] = []) => ({ ok: true, finalUrl: `https://x.co.nz${path}`, viewport: 'desktop', text, links }) as never;
    const link = (href: string, over: object = {}) => ({ href, raw: href, text: 'x', inNav: false, ...over });
    const facts = homeFacts(
      [
        page('/', 'Welcome', [link('https://x.co.nz/about/', { inNav: true }), link('https://other.com/', { inNav: true }), link('tel:+6421555000', { raw: 'tel:+6421555000' })]),
        page('/news', 'Last updated: 3 March 2020. News.'),
        page('/fresh', 'Last updated: 2 October 2026.'),
      ],
      'https://x.co.nz/',
      new Date('2026-10-17'),
    );
    expect(facts.menu).toEqual(['https://x.co.nz/about/']);
    expect(facts.contact).toBe(true);
    expect(facts.lastUpdated.map((l) => l.url)).toEqual(['https://x.co.nz/news']);
  });

  const pack = (slug: string, order: number, tier: number, size: number): FactPack => ({ slug, list: { order }, recommendation: 'BUILD', reserve_reason: null, findings: [{ tier, size }] }) as unknown as FactPack;

  it('keeps the 25 strongest builds by tier and then by size, and does not pad when fewer qualify', () => {
    const packs = Array.from({ length: 27 }, (_, i) => pack(`b${i}`, i + 1, i < 25 ? 4 : 1, i));
    packs.push({ ...pack('r', 28, 1, 99), recommendation: 'RESERVE' });
    capBuilds(packs, 25);
    const cut = packs.filter((p) => p.recommendation === 'RESERVE' && p.slug !== 'r').map((p) => p.slug);
    // Two tier 1 builds stay. Of the 25 tier 4 builds the two smallest are cut.
    expect(cut).toEqual(['b0', 'b1']);
    const few = [pack('a', 1, 4, 1), pack('b', 2, 5, 1)];
    capBuilds(few, 25);
    expect(few.map((p) => p.recommendation)).toEqual(['BUILD', 'BUILD']);
  });
});
