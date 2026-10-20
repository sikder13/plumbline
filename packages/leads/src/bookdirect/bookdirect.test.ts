import { describe, expect, it } from 'vitest';
import { bookDirectDropReason, hasPhrase, hostOfUrl, placeFlags, priorContactReason, type DiscoverConfig, type PlaceLike } from './filters.ts';
import { parsePark } from './discover.ts';
import { engineOf, isBookWords } from './engines.ts';
import { bookingFacts, emailsOnPage, fullSignal, greetingNamesOn, locationCount, phoneFacts, pickEmail, pickPages, sellsWebOrMarketing, telDialable, type SitePage } from './site.ts';
import { mxCheck, syntaxOk, verdictOf, zeroBounceCheck } from './verify.ts';

const cfg: Pick<DiscoverConfig, 'lists' | 'chains' | 'directories' | 'publicHealth'> = {
  lists: { A: { label: 'accommodation', terms: [], ratingCount: [5, 400] }, B: { label: 'allied health', terms: [], ratingCount: [3, 400] }, C: { label: 'dental', terms: [], ratingCount: [3, 400] }, D: { label: 'trades', terms: [], ratingCount: [3, 400] } },
  chains: { A: ['quest', 'best western', 'scenic hotel'], B: ['habit health', 'proactive'], C: [], D: [] },
  directories: ['facebook.com', 'booking.com', 'airbnb.com', 'bookme.co.nz', 'healthpoint.co.nz'],
  publicHealth: { hosts: ['govt.nz'], names: ['hospital', 'te whatu ora'], types: ['hospital'] },
};
const place = (over: Partial<PlaceLike> = {}): PlaceLike => ({ id: 'p1', displayName: { text: 'Kiwi Court Motel' }, businessStatus: 'OPERATIONAL', websiteUri: 'https://www.kiwicourt.co.nz/', userRatingCount: 80, primaryType: 'motel', ...over });
const ctx = (list: 'A' | 'B' = 'A', hostCounts = new Map<string, number>()) => ({ list, cfg, hostCounts });

describe('Book Direct discovery filters', () => {
  it('keeps an open motel with its own site and 5 to 400 ratings', () => {
    expect(bookDirectDropReason(place(), ctx())).toBeNull();
  });
  it('drops in the relay order: status, website, directory site, rating band, chain, hospital', () => {
    expect(bookDirectDropReason(place({ businessStatus: 'CLOSED_TEMPORARILY' }), ctx())).toBe('not_operational');
    expect(bookDirectDropReason(place({ websiteUri: undefined }), ctx())).toBe('no_website');
    expect(bookDirectDropReason(place({ websiteUri: 'https://m.facebook.com/kiwicourt' }), ctx())).toBe('directory_or_social_website');
    expect(bookDirectDropReason(place({ websiteUri: 'https://www.booking.com/hotel/nz/kiwi.html' }), ctx())).toBe('directory_or_social_website');
    expect(bookDirectDropReason(place({ userRatingCount: 4 }), ctx())).toBe('rating_count_out_of_band');
    expect(bookDirectDropReason(place({ userRatingCount: 401 }), ctx())).toBe('rating_count_out_of_band');
    expect(bookDirectDropReason(place({ userRatingCount: 3, primaryType: 'physiotherapist' }), ctx('B'))).toBeNull();
    expect(bookDirectDropReason(place({ displayName: { text: 'Best Western Kiwi Court' } }), ctx())).toBe('chain_or_franchise');
    expect(bookDirectDropReason(place({ displayName: { text: 'Proactive Physio Hamilton' } }), ctx('B'))).toBe('chain_or_franchise');
    expect(bookDirectDropReason(place({ displayName: { text: 'Southern Cross Hospital Physio' } }), ctx('B'))).toBe('hospital_or_public_body');
    expect(bookDirectDropReason(place({ websiteUri: 'https://www.tewhatuora.govt.nz/x' }), ctx('B'))).toBe('hospital_or_public_body');
  });
  it('treats a website shared by more than four places as a chain', () => {
    expect(bookDirectDropReason(place(), ctx('A', new Map([['kiwicourt.co.nz', 5]])))).toBe('chain_or_franchise');
    expect(bookDirectDropReason(place(), ctx('A', new Map([['kiwicourt.co.nz', 4]])))).toBeNull();
  });
  it('matches chain names as whole words only', () => {
    expect(hasPhrase('Questar Lodge', 'quest')).toBe(false);
    expect(hasPhrase('Quest Napier', 'quest')).toBe(true);
  });
  it('keeps Top 10 parks and flags them', () => {
    expect(placeFlags(place({ displayName: { text: 'Rotorua Top 10 Holiday Park' } }))).toEqual(['top10_member']);
    expect(placeFlags(place(), ['TOP 10 Holiday Parks'])).toEqual(['top10_member']);
    expect(placeFlags(place())).toEqual([]);
  });
  it('reads hosts without www and from bare domains', () => {
    expect(hostOfUrl('http://WWW.Kiwi.co.nz/x')).toBe('kiwi.co.nz');
    expect(hostOfUrl('kiwi.co.nz')).toBe('kiwi.co.nz');
    expect(hostOfUrl('')).toBe('');
  });
});

describe('prior contact', () => {
  const prior = { domains: new Set(['troutcatching.com', 'bellphysio.co.nz']), emails: new Set(['lucy@trek.co.nz']), nameTowns: new Set(['bell physiotherapy|taupo', 'wine hopper|']) };
  it('matches on domain, on any address, and on name plus town', () => {
    expect(priorContactReason(prior, { name: 'X', town: 'Y', website: 'https://www.troutcatching.com/' })).toBe('previously_contacted_or_suppressed');
    expect(priorContactReason(prior, { name: 'X', town: 'Y', website: 'https://shop.bellphysio.co.nz/' })).toBe('previously_contacted_or_suppressed');
    expect(priorContactReason(prior, { name: 'X', town: 'Y', website: 'https://z.nz', emails: ['Lucy@trek.co.nz'] })).toBe('previously_contacted_or_suppressed');
    expect(priorContactReason(prior, { name: 'Bell Physiotherapy Ltd', town: 'Taupo', website: 'https://new.nz' })).toBe('previously_contacted_or_suppressed');
    expect(priorContactReason(prior, { name: 'The Wine Hopper', town: 'Anywhere', website: 'https://new.nz' })).toBe('previously_contacted_or_suppressed');
  });
  it('lets a namesake in another town through', () => {
    expect(priorContactReason(prior, { name: 'Bell Physiotherapy', town: 'Nelson', website: 'https://bell-nelson.nz' })).toBeNull();
  });
});

describe('holidayparks.co.nz park page', () => {
  it('reads the name, phone, town, own website and affiliations', () => {
    const html = `<html><head><title>Opotiki Holiday Park - Holiday Parks New Zealand</title></head><body><h1>Opotiki Holiday Park</h1>
      <div>Affiliations</div><div>TOP 10 Holiday Parks</div><div>Contact Opotiki Holiday Park</div>
      <a href="https://goo.gl/maps/x">Get Directions</a>
      <div>(07) 315 6050</div><div>Potts Avenue</div><div>Opotiki</div><a href="http://www.opotikiholidaypark.co.nz">www.opotikiholidaypark.co.nz</a>
      <a href="https://dubzz.co.nz">Website Design by Dubzz</a></body></html>`.replace(/>\s*</g, '>\n<');
    const p = parsePark('https://holidayparks.co.nz/park/opotiki/', html)!;
    expect(p).toMatchObject({ name: 'Opotiki Holiday Park', town: 'Opotiki', website: 'http://www.opotikiholidaypark.co.nz', phone: '(07) 315 6050' });
    expect(p.affiliations).toContain('TOP 10 Holiday Parks');
  });
});

const page = (html: string, role = 'home', url = 'https://www.kiwicourt.co.nz/'): SitePage => ({ url, finalUrl: url, status: 200, html, role });

describe('contact capture', () => {
  it('picks contact, about and book pages on the same site, five at most', () => {
    const html = `<a href="/contact-us">Contact</a><a href="/about">About us</a><a href="/rooms">Our rooms</a><a href="/rates">Rates</a><a href="/privacy">Privacy</a><a href="https://other.nz/contact">Contact</a><a href="/gallery">Gallery</a>`;
    expect(pickPages(html, 'https://www.kiwicourt.co.nz/').map((p) => p.role)).toEqual(['contact', 'about', 'book', 'book']);
  });
  it('finds addresses by mailto, by Cloudflare protection, by text and by [at] [dot] writing', () => {
    // Cloudflare's encoding: the first byte is the key, each later byte is a letter XOR the key.
    const key = 0x42;
    const hex = [key, ...[...'desk@kiwicourt.co.nz'].map((ch) => ch.charCodeAt(0) ^ key)].map((b) => b.toString(16).padStart(2, '0')).join('');
    const html = `<a href="mailto:Stay@KiwiCourt.co.nz?subject=hi">Email</a><a href="/cdn-cgi/l/email-protection#${hex}">x</a><p>Write to bookings@kiwicourt.co.nz.</p><p>owner [at] kiwicourt [dot] co [dot] nz</p>`;
    const found = emailsOnPage(html, 'https://www.kiwicourt.co.nz/contact');
    expect(found.find((f) => f.how === 'cloudflare')?.email).toBe('desk@kiwicourt.co.nz');
    expect(found.find((f) => f.how === 'mailto')?.email).toBe('stay@kiwicourt.co.nz');
    expect(found.some((f) => f.email === 'bookings@kiwicourt.co.nz' && f.how === 'text')).toBe(true);
    expect(found.some((f) => f.email === 'owner@kiwicourt.co.nz' && f.how === 'obfuscated')).toBe(true);
    expect(found.every((f) => f.sourceUrl === 'https://www.kiwicourt.co.nz/contact')).toBe(true);
  });
  it('never takes a designer credited in the footer, a placeholder or a booking engine address', () => {
    const html = `<footer><p>Website by <a href="https://pixelworks.co.nz">Pixel Works</a></p><a href="mailto:hello@pixelworks.co.nz">hello@pixelworks.co.nz</a></footer><p>you@example.com noreply@seekom.com</p>`;
    expect(emailsOnPage(html, 'https://www.kiwicourt.co.nz/')).toEqual([]);
  });
  it('prefers the business domain over free mail, and info@ over a personal gmail', () => {
    const f = (email: string, how: 'mailto' | 'text' = 'text') => ({ email, sourceUrl: 'u', how });
    expect(pickEmail([f('jo.smith@gmail.com', 'mailto'), f('info@kiwicourt.co.nz')], 'https://www.kiwicourt.co.nz')!.email).toBe('info@kiwicourt.co.nz');
    expect(pickEmail([f('kiwicourt@xtra.co.nz'), f('accounts@kiwicourt.co.nz')], 'https://www.kiwicourt.co.nz')!.email).toBe('kiwicourt@xtra.co.nz');
    expect(pickEmail([f('reception@smiles.co.nz'), f('sarah@smiles.co.nz')], 'https://smiles.co.nz', true)!.email).toBe('sarah@smiles.co.nz');
    expect(pickEmail([], 'https://x.nz')).toBeNull();
  });
  it('reads greeting names with the page they are on', () => {
    const pages = [page('<p>Your hosts Mike and Nans Taylor welcome you.</p><p>Jane Doe, Principal Physiotherapist</p>', 'about', 'https://k.nz/about')];
    const names = greetingNamesOn(pages).map((g) => g.name);
    expect(names).toContain('Mike');
    expect(names).toContain('Jane Doe');
    expect(greetingNamesOn(pages)[0]!.url).toBe('https://k.nz/about');
    expect(greetingNamesOn([page('<p>Physiotherapist, Director</p><p>Sam Lee, Manager</p>', 'about')]).map((g) => g.name)).toEqual(['Sam Lee']);
  });
  it('tells a dialable tel: link from one that carries no number', () => {
    expect(telDialable('tel:+6474381234')).toBe(true);
    expect(telDialable('tel:07%20438%201234')).toBe(true);
    expect(telDialable('tel:')).toBe(false);
    expect(telDialable('tel:call')).toBe(false);
    const f = phoneFacts([page('<p>Call 07 438 1234</p><a href="tel:">Call us</a>')]);
    expect(f).toMatchObject({ shown: '07 438 1234', telHref: 'tel:', telWorks: false });
    expect(phoneFacts([page('<p>Call 07 438 1234</p>')]).telWorks).toBeNull();
  });
  it('names the booking engine, the OTA links and a generic Book link', () => {
    const seekom = bookingFacts([page('<a href="https://book.seekom.com/kiwi-court/property/123">Book now</a><a href="https://www.booking.com/hotel/nz/kiwi.html">Booking.com</a>')]);
    expect(seekom).toMatchObject({ engine: 'Seekom', engineKind: 'own', bookingUrl: 'https://book.seekom.com/kiwi-court/property/123', otaLinks: ['https://www.booking.com/hotel/nz/kiwi.html'] });
    const widget = bookingFacts([page('<script>loadWidget("https://ibe.staah.net/x/widget.js")</script>')]);
    expect(widget.engine).toBe('STAAH');
    const ota = bookingFacts([page('<a href="https://www.booking.com/hotel/nz/kiwi.html">Book now</a>')]);
    expect(ota).toMatchObject({ engine: 'none', engineKind: 'none', bookingUrl: 'https://www.booking.com/hotel/nz/kiwi.html' });
    const generic = bookingFacts([page('<a href="/enquire">Book Now</a>')]);
    expect(generic).toMatchObject({ engine: 'generic', engineKind: 'generic', bookingUrl: 'https://www.kiwicourt.co.nz/enquire' });
    expect(bookingFacts([page('<a href="https://x.cliniko.com/bookings">Book online</a>')]).engine).toBe('Cliniko');
    expect(bookingFacts([page('<a href="https://www.freeonlinebooking.com/b.php?id=1">Book Now</a>')]).engine).toBe('Free Online Booking');
    // A Booking.com review badge is not a booking path.
    expect(bookingFacts([page('<iframe src="//www.booking.com/flexiproduct.html?product=rw&hid=1"></iframe><script src="https://www.booking.com/x.js"></script>')]).otaLinks).toEqual([]);
  });
  it('recognises Book controls by their words', () => {
    for (const t of ['Book', 'Book Now', 'BOOK ONLINE', 'Check Availability', 'Book Appointment', 'Book an appointment', 'Reserve', 'Book your stay']) expect(isBookWords(t)).toBe(true);
    for (const t of ['Facebook', 'Bookshop', 'About our booking policy and cancellation terms for groups', 'Contact']) expect(isBookWords(t)).toBe(false);
    expect(engineOf('https://www.agoda.com/x')?.kind).toBe('ota');
    expect(engineOf('https://bookme.co.nz/x')?.kind).toBe('platform');
  });
  it('finds "already full" words on the home or book page only', () => {
    expect(fullSignal([page('<p>We are currently not taking new patients.</p>')])?.phrase).toMatch(/not taking new patients/);
    expect(fullSignal([page('<p>Sorry, no vacancy tonight</p>', 'book')])).not.toBeNull();
    expect(fullSignal([page('<p>Join the waitlist</p>', 'about')])).toBeNull();
    expect(fullSignal([page('<p>We keep a waitlist for new patients.</p>')])).not.toBeNull();
    expect(fullSignal([page('<p>Closed for the season. We reopen in October.</p>')])).not.toBeNull();
  });
  it('never takes a guest review, a holiday peak or a single-date waitlist for "already full"', () => {
    expect(fullSignal([page('<p>Great location, and they went above and beyond despite being fully booked.</p>')])).toBeNull();
    expect(fullSignal([page('<div class="reviews-widget"><p>It is always fully booked, sadly.</p></div>')])).toBeNull();
    expect(fullSignal([page('<p>The park becomes fully booked for Christmas and New Year, so book early.</p>')])).toBeNull();
    expect(fullSignal([page('<p>Want to join our wait list for a specific date? Call us.</p>')])).toBeNull();
    expect(fullSignal([page('<blockquote>We stayed three nights, fully booked town but they found us a room.</blockquote>')])).toBeNull();
  });
  it('spots a web or marketing business and a site with many locations', () => {
    expect(sellsWebOrMarketing('<title>Pixel | Web Design Rotorua</title>')).toBe(true);
    expect(sellsWebOrMarketing('<title>Kiwi Court Motel</title><footer>Website design by Pixel</footer>')).toBe(false);
    const links = ['a', 'b', 'c', 'd', 'e'].map((x) => `<a href="/locations/${x}">${x}</a>`).join('');
    expect(locationCount(links, 'https://physio.nz/')).toBe(5);
  });
});

describe('verification', () => {
  it('checks syntax', () => {
    expect(syntaxOk('info@kiwicourt.co.nz')).toBe(true);
    expect(syntaxOk('info@@kiwi.nz')).toBe(false);
    expect(syntaxOk('.info@kiwi.nz')).toBe(false);
    expect(syntaxOk('info@kiwi')).toBe(false);
  });
  it('needs MX records', async () => {
    expect((await mxCheck('a@kiwi.nz', async () => [{ exchange: 'mx2.kiwi.nz', priority: 20 }, { exchange: 'mx1.kiwi.nz', priority: 10 }])).hosts).toEqual(['mx1.kiwi.nz', 'mx2.kiwi.nz']);
    expect((await mxCheck('a@kiwi.nz', async () => [])).ok).toBe(false);
    expect((await mxCheck('a@nope.nz', async () => Promise.reject(Object.assign(new Error('x'), { code: 'ENOTFOUND' })))).error).toBe('ENOTFOUND');
  });
  it('maps single-address results: role and catch-all allowed, traps and invalid refused, unknown left for a verifier', () => {
    const c = (status: string, subStatus = '') => ({ provider: 'zerobounce' as const, status, subStatus, checkedAt: '', error: null });
    expect(verdictOf(c('valid')).status).toBe('valid');
    expect(verdictOf(c('catch-all'))).toEqual({ status: 'catch_all', flags: ['catch_all_domain'] });
    expect(verdictOf(c('do_not_mail', 'role_based'))).toEqual({ status: 'valid', flags: ['role_address'] });
    expect(verdictOf(c('do_not_mail', 'global_suppression')).status).toBe('invalid');
    expect(verdictOf(c('invalid', 'mailbox_not_found')).status).toBe('invalid');
    expect(verdictOf(c('spamtrap')).status).toBe('invalid');
    expect(verdictOf(c('unknown', 'timeout_exceeded')).flags).toContain('needs_verifier');
    expect(verdictOf(c('error')).status).toBe('mx_only');
  });
  it('never lets the key into a result', async () => {
    const key = 'sekrit-key-123';
    const r = await zeroBounceCheck('a@b.nz', key, (async () => ({ status: 401, json: async () => ({ error: `Invalid API key sekrit-key-123` }) })) as unknown as typeof fetch);
    expect(r.error).not.toContain(key);
    expect(r.status).toBe('error');
  });
});

describe('list types', () => {
  it('keeps motels, lodges, B&Bs and parks, and drops pubs, restaurants and plain hotels', async () => {
    const { onTarget } = await import('./filters.ts');
    expect(onTarget('A', 'Kiwi Court', 'motel')).toBe(true);
    expect(onTarget('A', 'Rimu Lodge', 'lodging')).toBe(true);
    expect(onTarget('A', 'Harbour View', 'bed_and_breakfast')).toBe(true);
    expect(onTarget('A', 'Lakeside Holiday Park', 'rv_park')).toBe(true);
    expect(onTarget('A', 'Grand Central Hotel', 'hotel')).toBe(false);
    expect(onTarget('A', 'Alpine Lodge', 'hotel')).toBe(true);
    expect(onTarget('A', 'The Lodge Bar', 'bar')).toBe(false);
    expect(onTarget('A', 'Backpackers Central', 'hostel')).toBe(false);
  });
  it('keeps dental practices for list C and emergency trades for list D', async () => {
    const { onTarget } = await import('./filters.ts');
    expect(onTarget('C', 'Smile Studio', 'health')).toBe(true);
    expect(onTarget('C', 'City Pharmacy', 'pharmacy')).toBe(false);
    expect(onTarget('D', 'Kiwi Locksmiths', 'service')).toBe(true);
    expect(onTarget('D', 'Joe Bloggs Ltd', 'plumber')).toBe(true);
    expect(onTarget('D', 'Garden World', 'store')).toBe(false);
  });
  it('keeps physio, chiro and osteo clinics only', async () => {
    const { onTarget } = await import('./filters.ts');
    expect(onTarget('B', 'Body Works', 'physiotherapist')).toBe(true);
    expect(onTarget('B', 'Hamilton Osteopaths', 'health')).toBe(true);
    expect(onTarget('B', 'Relax Massage', 'massage')).toBe(false);
    expect(onTarget('B', 'Core Gym', 'gym')).toBe(false);
    expect(onTarget('B', 'Massage and Physio Room', 'massage')).toBe(true);
  });
});
