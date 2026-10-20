import { describe, expect, it } from 'vitest';
import { bookControls, enginesIn, stillBroken } from './reproof.ts';

const long = 'Select a service. ACC Acupuncture, 60 mins, more info, select. '.repeat(40);

describe('stillBroken', () => {
  it('holds when the link answers 404 and the page says it is missing', () => {
    expect(stillBroken({ status: 404, getStatus: 404, title: 'Page not found', text: 'Oops! That page can’t be found.' }).holds).toBe(true);
  });

  it('holds for a soft 404: a short page that says it is missing, answering 200', () => {
    expect(stillBroken({ status: 200, getStatus: 200, title: 'Studio', text: 'Oops!! We can’t seem to find the page you’re looking for' }).holds).toBe(true);
  });

  it('does not hold when the status is 404 but the visitor sees a working booking form', () => {
    const r = stillBroken({ status: 404, getStatus: 404, title: 'Book An Appointment - Mission Health', text: `Book An Appointment ${long}` });
    expect(r).toEqual({ holds: false, bad: true, missing: false });
  });

  it('does not hold for a full page that opens normally', () => {
    expect(stillBroken({ status: 200, getStatus: 200, title: 'Timetable', text: long }).holds).toBe(false);
  });

  it('holds when the browser cannot open the page at all', () => {
    expect(stillBroken({ status: null, getStatus: null, error: 'net::ERR_NAME_NOT_RESOLVED', title: '', text: '' }).holds).toBe(true);
  });

  it('reads the missing message from a booking frame on the page', () => {
    expect(stillBroken({ status: 200, getStatus: 200, title: 'Book', text: 'Book online', frameText: 'We can’t find that page. There’s no booking page at this address.' }).holds).toBe(true);
  });
});

describe('bookControls', () => {
  it('keeps the links and buttons that ask to book, with absolute targets', () => {
    const html = '<a href="/book/">Book a Table</a><a href="/menu/">Menu</a><button>Reserve</button><a href="https://x.test/">Book Online Now!</a>';
    expect(bookControls(html, 'http://www.example.co.nz/')).toEqual([
      { text: 'Book a Table', href: 'http://www.example.co.nz/book/' },
      { text: 'Book Online Now!', href: 'https://x.test/' },
    ]);
  });
});

describe('enginesIn', () => {
  it('names the engines behind booking links', () => {
    expect(enginesIn(['https://hotels.cloudbeds.com/reservation/ybJR6y', 'https://bookings.gettimely.com/rsmmassage/bb/book'])).toEqual(expect.arrayContaining(['Cloudbeds', 'Timely']));
  });
});
