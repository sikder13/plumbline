import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { brokenHome, flagRank, notMobile, type CheckResult } from './checks.ts';
import { faithReason, onTargetIndustry, perCentreCap, rotation, termShares } from './config.ts';
import { bookingLinks, isKeyMenu, menuItems, nzDigits, otaLinks, phonesOnSite } from './crawl.ts';
import { INACTIVE } from './follow.ts';
import { isPlaceholderEmail, plausibleEmail } from './gather.ts';
import { daysIn, googleWeek, hoursConflicts, hoursIn, siteWeek } from './hours.ts';
import { Registry } from './registry.ts';

const page = (html: string, url = 'https://motel.co.nz/') => ({ url, finalUrl: url, status: 200, html, role: 'home' });

describe('sweep discovery rules', () => {
  it('splits an industry evenly over its terms and adds up to the total', () => {
    expect([...termShares(100, ['a', 'b', 'c']).values()]).toEqual([34, 33, 33]);
    expect([...termShares(100, ['a', 'b', 'c', 'd', 'e', 'f', 'g']).values()].reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('starts each term at a different centre and caps each centre', () => {
    const c = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    expect(rotation(c, 0)[0]).toBe('a');
    expect(rotation(c, 1)[0]).toBe('h');
    expect(rotation(c, 1)).toHaveLength(10);
    expect(perCentreCap(25)).toBe(5);
    expect(perCentreCap(14)).toBe(3);
  });

  it('keeps each industry to its own kind of business', () => {
    expect(onTargetIndustry('hospitality', 'Kea Cafe', 'cafe')).toBe(true);
    expect(onTargetIndustry('auto-home', 'Smith Motors', 'car_dealer')).toBe(false);
    expect(onTargetIndustry('auto-home', 'Pukeko Motor Lodge', 'motel')).toBe(false);
    expect(onTargetIndustry('auto-home', 'Lushingtons Garden Centre', 'garden_center', ['garden_center'])).toBe(false);
    expect(onTargetIndustry('tourism', 'Rotokare Scenic Reserve', 'tourist_attraction')).toBe(false);
    expect(onTargetIndustry('tourism', 'Fiordland Jet', 'tourist_attraction')).toBe(true);
    expect(onTargetIndustry('vets-pets', 'Pet 2 Us', 'pet_store')).toBe(false);
    expect(onTargetIndustry('allied-health', 'Feet First Podiatry', '')).toBe(true);
  });

  it('screens out alcohol-centred and adult businesses but not a brow bar or a pilates club', () => {
    expect(faithReason('The Fat Duck Bar & Kitchen', 'restaurant', 'hospitality')).toBe('"bar" in the name');
    expect(faithReason('Napier Tours - Napier Wineries', 'tour_agency', 'tourism')).toMatch(/wineries/);
    expect(faithReason('Golf Club Restaurant', 'restaurant', 'hospitality')).toMatch(/club/);
    expect(faithReason('Avenue Beauty Bar', 'beauty_salon', 'hair-beauty')).toBeNull();
    expect(faithReason('Brow Bar Wanaka', 'beauty_salon', 'hair-beauty')).toBeNull();
    expect(faithReason('Core Club - Reformer Pilates', 'gym', 'fitness')).toBeNull();
    expect(faithReason('Any Place', 'wine_bar', 'hospitality')).toBe('type wine_bar');
    expect(faithReason('Tantric Massage', 'massage', 'fitness')).toMatch(/tantric/);
  });
});

describe('the registry', () => {
  it('keeps the first audit date, updates the rest, and never drops a row', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'reg-')), 'audited.csv');
    const r = new Registry(file);
    r.record({ domain: 'https://www.motel.co.nz/', business: 'Motel', industry: 'accommodation', first_audited: '2026-10-20', last_audited: '2026-10-20', audit_version: '1', outcome: 'clean' });
    r.save();
    const again = new Registry(file);
    expect(again.has('motel.co.nz')).toBe(true);
    again.record({ domain: 'motel.co.nz', business: 'Motel', industry: 'accommodation', last_audited: '2026-11-01', audit_version: '2', outcome: 'flagged' });
    again.save();
    const third = new Registry(file);
    expect(third.get('www.motel.co.nz')).toMatchObject({ first_audited: '2026-10-20', last_audited: '2026-11-01', audit_version: '2' });
    // A row written by someone else in between is kept.
    const other = new Registry(file);
    other.record({ domain: 'cafe.nz', business: 'Cafe', industry: 'hospitality', last_audited: '2026-11-02', audit_version: '2', outcome: 'clean' });
    other.save();
    third.save();
    expect(readFileSync(file, 'utf8')).toMatch(/cafe\.nz/);
  });
});

describe('reading a site', () => {
  it('finds the main menu and leaves out the footer and hidden-address links', () => {
    const html = `<header><nav><ul><li><a href="/">Home</a></li><li><a href="/rooms">Our Rooms</a><ul><li><a href="/rooms/king">King</a></li></ul></li><li><a href="/contact-us">Contact Us</a></li><li><a href="/cdn-cgi/l/email-protection#abc">[email&#160;protected]</a></li></ul></nav></header><footer><nav><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav></footer>`;
    const m = menuItems(html, 'https://motel.co.nz/');
    expect(m.map((x) => x.label)).toEqual(['Our Rooms', 'Contact Us', 'King']);
    expect(isKeyMenu('Hotel Rooms')).toBe(true);
    expect(isKeyMenu('Book Now')).toBe(true);
    expect(isKeyMenu('[email protected]')).toBe(false);
    expect(isKeyMenu('See how it works')).toBe(false);
  });

  it('reads New Zealand numbers as their national digits', () => {
    expect(nzDigits('+64 3 434 7788')).toBe('034347788');
    expect(nzDigits('(03) 434 7788')).toBe('034347788');
    expect(nzDigits('0800 332 232')).toBe('0800332232');
    const ph = phonesOnSite([page('<p>Call 07 282 0238</p><a href="tel:+6472820238">Call</a>')]);
    expect(ph.shown[0]!.digits).toBe('072820238');
    expect(ph.tel[0]!.digits).toBe('072820238');
  });

  it('lists booking links but not hidden-address links, section jumps, or OTA links', () => {
    const links = bookingLinks([page('<a href="/book-now">Book Now</a><a href="#book">Book now</a><a href="/cdn-cgi/l/email-protection#x">Book an appointment</a><a href="https://www.booking.com/hotel/nz/x.html">Book</a><iframe src="https://app.cliniko.com/bookings"></iframe>')]);
    expect(links.map((l) => l.url)).toEqual(['https://motel.co.nz/book-now', 'https://app.cliniko.com/bookings']);
    expect(links[1]!.engine).toBe('Cliniko');
  });

  it('counts an OTA link a visitor can follow, not a review badge', () => {
    const o = otaLinks([page('<a href="https://www.booking.com/hotel/nz/x.html">Book on Booking.com</a><a href="https://www.booking.com/reviews/nz/hotel/x.html"><img alt="Booking.com review score" src="badge.png"></a>')]);
    expect(o).toHaveLength(1);
    expect(o[0]!.name).toBe('Booking.com');
  });

  it('recognises an engine page that says the account is gone, not one with no rooms free', () => {
    expect(INACTIVE.test('This account is inactive. Please contact the property.')).toBe(true);
    expect(INACTIVE.test('Property not found')).toBe(true);
    expect(INACTIVE.test('Online bookings are currently unavailable')).toBe(true);
    expect(INACTIVE.test('No availability found for your dates')).toBe(false);
  });

  it('ignores template and run-together addresses', () => {
    expect(isPlaceholderEmail('info@mydomain.com')).toBe(true);
    expect(isPlaceholderEmail('www.facebook@puressencespa.com')).toBe(true);
    expect(plausibleEmail('stay@motel.co.nz')).toBe(true);
    expect(plausibleEmail('stay@motel.co.nzphone')).toBe(false);
  });
});

describe('opening hours', () => {
  it('reads day ranges, lists and closed days', () => {
    expect(daysIn('Mon - Fri')).toEqual([1, 2, 3, 4, 5]);
    expect(daysIn('Saturday & Sunday').sort()).toEqual([0, 6]);
    expect(daysIn('Open 7 days')).toHaveLength(7);
    expect(hoursIn('8:30am - 5pm')).toEqual({ open: 510, close: 1020 });
    expect(hoursIn('9-5')).toEqual({ open: 540, close: 1020 });
    expect(hoursIn('Closed')).toBe('closed');
    expect(hoursIn('11:30am - 2pm, 5pm - 9pm')).toEqual({ open: 690, close: 1260 });
  });

  it('reads a page of hours, with the day and the hours in neighbouring cells', () => {
    const w = siteWeek('Opening Hours\nMon - Fri:\n9:00am - 6:00pm\nSaturday:\n10:00am - 4:00pm\nSunday:\nClosed');
    expect(w!.week[1]).toEqual({ open: 540, close: 1080 });
    expect(w!.week[6]).toEqual({ open: 600, close: 960 });
    expect(w!.week[0]).toBe('closed');
  });

  it('gives up on a page that names a day twice with different hours', () => {
    expect(siteWeek('Summer: Mon - Fri 8am - 6pm\nWinter: Mon - Fri 9am - 5pm\nSat 9am - 1pm')).toBeNull();
  });

  it('compares with Google by day and needs half an hour to differ', () => {
    const g = googleWeek(JSON.stringify([1, 2, 3, 4, 5].map((d) => ({ open: { day: d, hour: 9, minute: 0 }, close: { day: d, hour: 17, minute: 0 } }))))!;
    const site = siteWeek('Mon - Fri 9am - 5:15pm\nSat 10am - 2pm\nSun closed')!.week;
    const diff = hoursConflicts(site, g);
    expect(diff.map((d) => d.day)).toEqual(['Sat']);
    expect(googleWeek(JSON.stringify([{ open: { day: 0, hour: 0, minute: 0 } }]))![3]).toEqual({ open: 0, close: 1440 });
  });
});

describe('the checks', () => {
  const visit = { status: 200, error: null, blocked: false, title: 'Home', text: 'Welcome to our clinic. '.repeat(40), certError: null, measure: { viewport: 'width=device-width', innerWidth: 390, scrollWidth: 390, scrollX: 0, medianFontPx: 16, textChars: 900, images: 3, media: 0 } };

  it('calls a homepage broken only for an error, a placeholder or a blank page', () => {
    expect(brokenHome(visit)).toBeNull();
    expect(brokenHome({ ...visit, status: 500, title: 'Error', text: 'Internal Server Error' })).toMatch(/answers 500/);
    expect(brokenHome({ ...visit, title: 'This domain is for sale', text: 'Buy this domain' })).toMatch(/placeholder/);
    expect(brokenHome({ ...visit, text: '', measure: { ...visit.measure, textChars: 0, images: 0 } })).toMatch(/blank/);
    expect(brokenHome({ ...visit, status: 403, title: 'Just a moment...', text: 'Checking your browser' })).toBeNull();
    expect(brokenHome({ ...visit, status: null, error: 'ERR_NAME_NOT_RESOLVED' })).toMatch(/could not open/);
    // "Coming soon" on a full page is news, not a placeholder.
    expect(brokenHome({ ...visit, text: `New menu coming soon. ${'Our food is great. '.repeat(60)}` })).toBeNull();
  });

  it('flags a layout that scrolls sideways, renders at desktop width, or sets tiny text', () => {
    expect(notMobile(visit.measure)).toBeNull();
    expect(notMobile({ ...visit.measure, scrollX: 120 })).toMatch(/120 px sideways/);
    expect(notMobile({ ...visit.measure, viewport: null, innerWidth: 980, medianFontPx: 14 })).toMatch(/desktop width.*5\.6 px/);
    expect(notMobile({ ...visit.measure, medianFontPx: 10 })).toMatch(/10 px/);
    // A page with a viewport tag that reports a wide layout but does not move is not flagged on width alone.
    expect(notMobile({ ...visit.measure, innerWidth: 1560 })).toBeNull();
  });

  it('ranks a broken booking link first and a layout problem last', () => {
    const r = (check: CheckResult['check'], onBookingPath = false) => ({ check, result: 'flag', evidenceUrl: '', http: '', detail: '', shot: null, more: [], onBookingPath }) as CheckResult;
    const ranked = [r('not_mobile'), r('phone_mismatch'), r('not_secure', true), r('booking_link_broken'), r('main_nav_404')].sort((a, b) => flagRank(a) - flagRank(b));
    expect(ranked.map((x) => x.check)).toEqual(['booking_link_broken', 'not_secure', 'phone_mismatch', 'main_nav_404', 'not_mobile']);
  });
});
