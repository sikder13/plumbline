import { describe, expect, it } from 'vitest';
import type { PageCapture } from '@plumbline/render';
import { bookControlsInFold, firstScreenControls } from './audit.ts';
import { findingsOf, leadFindings, type AuditFacts } from './classes.ts';
import { excludedType, qualifyReason, roomToSell, type QualifyInput } from './qualify.ts';

const facts = (over: Partial<AuditFacts> = {}): AuditFacts => ({
  list: 'A',
  homeUrl: 'https://kiwicourt.co.nz/',
  ownEngine: 'Seekom',
  otaLinks: [],
  otaOn: '',
  landings: [],
  firstScreen: { checked: true, controls: ['Book link "Book now"'] },
  phone: { shownOnHome: '07 438 1234', telLinksOnHome: ['tel:074381234'], firstTelWorks: true },
  speed: { measured: true, pages: [{ url: 'https://kiwicourt.co.nz/', lcpS: 2.1, runs: 1 }], error: null },
  pricesFound: true,
  hoursFound: true,
  layout: { viewportMeta: 'width=device-width, initial-scale=1', scrollWidth: 390, innerWidth: 390, movesSideways: false },
  hygiene: { footerYear: 2026, https: true },
  ...over,
});
const classes = (f: AuditFacts) => findingsOf(f, new Date('2026-10-19T12:00:00Z')).map((x) => `${x.cls}/${x.tier}`);

describe('Book Direct finding classes', () => {
  it('finds nothing on a site that books direct well', () => {
    expect(classes(facts())).toEqual([]);
  });
  it('ota_only_booking: accommodation with OTA links and no own engine, tier 1', () => {
    expect(classes(facts({ ownEngine: '', otaLinks: ['https://www.booking.com/hotel/nz/kiwi.html'], otaOn: 'https://kiwicourt.co.nz/rates' }))).toEqual(['ota_only_booking/1']);
    // Never for allied health, and never when an own engine exists.
    expect(classes(facts({ list: 'B', ownEngine: '', otaLinks: ['https://www.booking.com/x'] }))).toEqual([]);
    expect(classes(facts({ otaLinks: ['https://www.booking.com/x'] }))).toEqual([]);
  });
  it('book_cta_dead: no target, a non-200 answer, or the contact page instead of the engine, tier 1', () => {
    const l = (outcome: 'no_target' | 'not_200' | 'contact_page' | 'unknown' | 'ok') => ({ text: 'Book Now', href: '#', outcome, status: outcome === 'not_200' ? 404 : 200, landedOn: '', detail: '' });
    expect(classes(facts({ landings: [l('no_target')] }))).toEqual(['book_cta_dead/1']);
    expect(classes(facts({ landings: [l('not_200')] }))).toEqual(['book_cta_dead/1']);
    expect(findingsOf(facts({ landings: [l('contact_page')] }))[0]!.value).toMatch(/opens the contact page instead of Seekom/);
    // A Book link we could not decide on is never a finding.
    expect(classes(facts({ landings: [l('unknown'), l('ok')] }))).toEqual([]);
    // The contact page is only "instead of the engine" when there is an engine or OTA to go to.
    expect(classes(facts({ ownEngine: '', landings: [l('contact_page')] }))).toEqual([]);
  });
  it('no_first_screen_cta: tier 2, only when the first screen was read', () => {
    expect(classes(facts({ firstScreen: { checked: true, controls: [] } }))).toEqual(['no_first_screen_cta/2']);
    expect(classes(facts({ firstScreen: { checked: false, controls: [] } }))).toEqual([]);
  });
  it('tel_link_dead: tier 2 for accommodation, tier 3 for allied health', () => {
    const plain = { shownOnHome: '07 438 1234', telLinksOnHome: [], firstTelWorks: null };
    expect(classes(facts({ phone: plain }))).toEqual(['tel_link_dead/2']);
    expect(classes(facts({ list: 'B', phone: plain }))).toEqual(['tel_link_dead/3']);
    expect(classes(facts({ phone: { shownOnHome: null, telLinksOnHome: ['tel:'], firstTelWorks: false } }))).toEqual(['tel_link_dead/2']);
    expect(classes(facts({ phone: { shownOnHome: null, telLinksOnHome: [], firstTelWorks: null } }))).toEqual([]);
  });
  it('slow_mobile: tier 2 over 6 s, tier 3 from 4 to 6 s, never when not measured', () => {
    const sp = (lcpS: number) => ({ measured: true, pages: [{ url: 'https://kiwicourt.co.nz/rates', lcpS, runs: 3 }], error: null });
    expect(classes(facts({ speed: sp(6.4) }))).toEqual(['slow_mobile/2']);
    expect(classes(facts({ speed: sp(4.8) }))).toEqual(['slow_mobile/3']);
    expect(classes(facts({ speed: sp(4.0) }))).toEqual([]);
    expect(findingsOf(facts({ speed: sp(6.4) }))[0]!.evidenceUrl).toBe('https://kiwicourt.co.nz/rates');
    expect(classes(facts({ speed: { measured: false, pages: [], error: 'timed out' } }))).toEqual([]);
  });
  it('no_prices_or_hours: allied health and dental only, tier 4, never a lead finding', () => {
    const f = facts({ list: 'B', pricesFound: false, hoursFound: false });
    expect(classes(f)).toEqual(['no_prices_or_hours/4']);
    expect(leadFindings(findingsOf(f))).toEqual([]);
    expect(classes(facts({ pricesFound: false, hoursFound: false }))).toEqual([]);
  });
  it('not_mobile_layout: tier 3, tier 2 with a booking class', () => {
    expect(classes(facts({ layout: { viewportMeta: null, scrollWidth: 980, innerWidth: 390, movesSideways: true } }))).toEqual(['not_mobile_layout/3']);
    expect(classes(facts({ firstScreen: { checked: true, controls: [] }, layout: { viewportMeta: 'width=1024', scrollWidth: 1024, innerWidth: 390, movesSideways: true } }))).toEqual(['no_first_screen_cta/2', 'not_mobile_layout/2']);
    // A wide carousel that does not move the page is not a fixed-width layout.
    expect(classes(facts({ layout: { viewportMeta: 'width=device-width', scrollWidth: 900, innerWidth: 390, movesSideways: false } }))).toEqual([]);
  });
  it('records hygiene as tier 6 and 7, never as a lead', () => {
    const f = facts({ hygiene: { footerYear: 2019, https: false } });
    expect(classes(f)).toEqual(['hygiene_no_https/6', 'hygiene_footer_year/7']);
    expect(leadFindings(findingsOf(f))).toEqual([]);
  });
});

const link = (text: string, raw: string, fold = true, visible = true) => ({ text, raw, href: raw.startsWith('http') ? raw : `https://k.nz/${raw}`, visible, fold, box: null, selector: 'a', target: '', hasHandler: false, inHeader: false, inNav: false, inFooter: false });
const cap = (links: ReturnType<typeof link>[], controls: { tag: string; text: string; src: string; action: string; fold: boolean }[] = []) => ({ links, controls }) as unknown as PageCapture;

describe('first phone screen', () => {
  it('counts Book, Book Appointment, Call and dialable tel: links that are visible in the fold', () => {
    expect(firstScreenControls(cap([link('Book Now', 'book')]))).toEqual(['Book link "Book Now"']);
    expect(firstScreenControls(cap([link('', 'tel:+6474381234')]))).toEqual(['call link tel:+6474381234']);
    expect(firstScreenControls(cap([link('Call us', '#')]))).toEqual(['Call link "Call us"']);
    expect(firstScreenControls(cap([], [{ tag: 'button', text: 'Book Appointment', src: '', action: '', fold: true }]))).toEqual(['Book button "Book Appointment"']);
    expect(firstScreenControls(cap([], [{ tag: 'iframe', text: '', src: 'https://book.seekom.com/x', action: '', fold: true }]))).toEqual(['Seekom widget']);
  });
  it('ignores what is below the fold, hidden in a menu, or a tel: link with no number', () => {
    expect(firstScreenControls(cap([link('Book Now', 'book', false), link('Book', 'book', true, false), link('', 'tel:')]))).toEqual([]);
  });
  it('a Book control for the competitor check is Book words or an engine link, not Call', () => {
    expect(bookControlsInFold(cap([link('Call us', 'tel:074381234')]))).toEqual([]);
    expect(bookControlsInFold(cap([link('Appointments', 'https://physio.cliniko.com/bookings')]))).toEqual(['Book link "Appointments"']);
    expect(bookControlsInFold(cap([link('Online', 'https://physio.cliniko.com/bookings')]))).toEqual(['Cliniko link']);
  });
});

const q = (over: Partial<QualifyInput> = {}): QualifyInput => ({
  list: 'A',
  name: 'Kiwi Court Motel',
  primaryType: 'motel',
  verifyStatus: 'valid',
  verifyFlags: [],
  bookingEngineKind: 'own',
  otaLinks: [],
  telPath: true,
  findings: [{ cls: 'book_cta_dead', tier: 1, value: '"Book Now" answers 404', evidenceUrl: 'https://k.nz/' }],
  fullSignal: '',
  excluded: null,
  prior: null,
  ratingCount: 80,
  competitorsBookOnline: null,
  audited: true,
  ...over,
});

describe('room to sell', () => {
  it('qualifies a verified lead with an engine, a tier 1 to 3 finding and room to sell', () => {
    expect(qualifyReason(q())).toBeNull();
    expect(qualifyReason(q({ verifyStatus: 'mx_only', verifyFlags: ['needs_verifier'] }))).toBeNull();
    expect(qualifyReason(q({ bookingEngineKind: 'none', otaLinks: ['https://www.booking.com/x'] }))).toBeNull();
    expect(qualifyReason(q({ bookingEngineKind: 'generic' }))).toBeNull();
  });
  it('stops at the first rule that fails, in the relay order', () => {
    expect(qualifyReason(q({ verifyStatus: 'invalid', bookingEngineKind: 'none' }))).toBe('invalid_email');
    expect(qualifyReason(q({ bookingEngineKind: 'none' }))).toBe('no_booking_engine_or_link');
    expect(qualifyReason(q({ findings: [] }))).toBe('no_lead_finding');
    expect(qualifyReason(q({ findings: [{ cls: 'no_prices_or_hours', tier: 4, value: 'x', evidenceUrl: 'u' }] }))).toBe('only_tier4_finding');
    expect(qualifyReason(q({ findings: [{ cls: 'hygiene_footer_year', tier: 7, value: 'x', evidenceUrl: 'u' }] }))).toBe('no_lead_finding');
    expect(qualifyReason(q({ fullSignal: 'No vacancy' }))).toBe('already_full');
    expect(qualifyReason(q({ excluded: 'name says "winery"' }))).toBe('excluded_business_type');
    expect(qualifyReason(q({ prior: 'previously_contacted_or_suppressed' }))).toBe('previously_contacted_or_suppressed');
  });
  it('excludes wineries and the faith screen by whole word', () => {
    expect(excludedType('Vineyard Cottages', 'lodging')).toMatch(/vineyard/);
    expect(excludedType('Kiwi Court', 'bar')).toMatch(/type bar/);
    expect(excludedType('Barrington Motel', 'motel')).toBeNull();
  });
  it('scores 0 to 10 as the relay sets out', () => {
    const f = (cls: string, value = 'x') => ({ cls: cls as never, tier: 1, value, evidenceUrl: 'u' });
    expect(roomToSell(q({ findings: [f('ota_only_booking'), f('book_cta_dead'), f('no_first_screen_cta'), f('slow_mobile', 'mobile LCP 7.2 s (Lighthouse)'), f('tel_link_dead')], ratingCount: 50 })).score).toBe(10);
    expect(roomToSell(q({ findings: [f('slow_mobile', 'mobile LCP 4.6 s (Lighthouse)')], ratingCount: 300 })).score).toBe(1);
    expect(roomToSell(q({ findings: [f('book_cta_dead')], ratingCount: 50, verifyFlags: ['needs_verifier'] })).score).toBe(2);
    expect(roomToSell(q({ list: 'B', findings: [f('no_first_screen_cta')], ratingCount: 5, competitorsBookOnline: 2 })).score).toBe(3);
    expect(roomToSell(q({ list: 'A', findings: [f('no_first_screen_cta')], ratingCount: 5, competitorsBookOnline: 3 })).score).toBe(2);
    expect(roomToSell(q({ findings: [], ratingCount: 5, verifyFlags: ['needs_verifier'] })).score).toBe(0);
  });
});
