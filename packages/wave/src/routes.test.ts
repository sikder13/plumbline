import { describe, expect, it } from 'vitest';
import { link, page } from '@plumbline/checks/testing';
import { bookingRoutesOn, contactRoutesOn, opensBehindAgeGate } from './routes.ts';

const none = () => '';

describe('ways to book found on a site', () => {
  it('finds a third-party system by a link, an embedded frame, a script or a request', () => {
    const linked = page('https://alpha.co.nz/tours', ['Tours'], { links: [link('https://alpha.rezdy.com/', 'Book now')] });
    expect(bookingRoutesOn([linked], none)).toEqual(['Rezdy on https://alpha.co.nz/tours']);
    const framed = page('https://alpha.co.nz/lunch.html', ['Lunch']);
    framed.meta.iframes = ['https://nz6.eveve.com/web/form?est=AlphaEstate'];
    expect(bookingRoutesOn([framed], none)).toEqual(['Eveve on https://alpha.co.nz/lunch.html']);
    const scripted = page('https://alpha.co.nz/', ['Home']);
    scripted.meta.scripts = ['https://resources.ibisnz.com/widget.js'];
    expect(bookingRoutesOn([scripted], none)).toEqual(['IBIS on https://alpha.co.nz/']);
    const requested = page('https://alpha.co.nz/', ['Home'], { requestHosts: ['booking.resdiary.com'] });
    expect(bookingRoutesOn([requested], none)).toEqual(['ResDiary on https://alpha.co.nz/']);
    for (const host of ['app.lodgify.com', 'widgets.bokun.io', 'bookings.rtbslive.com', 'alpha.bookit.co.nz']) {
      expect(bookingRoutesOn([page('https://alpha.co.nz/', ['Home'], { links: [link(`https://${host}/x`, 'Book')] })], none), host).toHaveLength(1);
    }
  });

  it('counts a form that takes a booking or an enquiry, and any form with a message box', () => {
    const p = page('https://alpha.co.nz/contact', ['Contact']);
    const booking = '<h2>Booking request</h2><form><input name="name"><input name="date"><select name="trip"></select><button>Send</button></form>';
    expect(bookingRoutesOn([p], () => booking)).toEqual(['a booking or enquiry form on https://alpha.co.nz/contact']);
    const message = '<form><input name="first"><input name="email"><textarea name="comments"></textarea><button>Submit</button></form>';
    expect(bookingRoutesOn([p], () => message)).toEqual(['a contact form with a message box on https://alpha.co.nz/contact']);
    // A newsletter sign-up and a search box take neither a booking nor a message.
    const signup = '<form><input name="first"><input name="last"><input name="email"><button>Sign up</button></form><form><input type="search" name="q"></form>';
    expect(bookingRoutesOn([p], () => signup)).toEqual([]);
  });

  it('counts a booking page of the site itself when it loads, even with nothing on it to book', () => {
    const empty = page('https://www.alpha.co.nz/book-online', ['Nothing to book right now. Check back soon.']);
    expect(bookingRoutesOn([empty], none)).toEqual(['a booking page of their own at https://www.alpha.co.nz/book-online']);
    const gone = page('https://www.alpha.co.nz/booking', ['Page not found'], { status: 404, ok: false });
    expect(bookingRoutesOn([gone], none)).toEqual([]);
    expect(bookingRoutesOn([page('https://www.alpha.co.nz/facebook-news', ['News'])], none)).toEqual([]);
  });
});

describe('ways to get in touch found on the homepage', () => {
  it('finds email and phone links and says where they sit, and a form with a message box', () => {
    const home = page('https://alpha.co.nz/', ['Home'], {
      links: [link('mailto:hello@alpha.co.nz', 'Email us', { raw: 'mailto:hello@alpha.co.nz', inFooter: true }), link('tel:+6491234567', 'Call', { raw: 'tel:+6491234567', inNav: true })],
    });
    expect(contactRoutesOn([home], none)).toEqual(['an email link in the footer', 'a phone link in the menu']);
    const bare = page('https://alpha.co.nz/', ['Home']);
    expect(contactRoutesOn([bare], () => '<form><input name="name"><input name="email"><textarea></textarea></form>')).toEqual(['a contact form on the homepage']);
    expect(contactRoutesOn([bare], () => '<form><input name="first"><input name="email"><button>Sign up</button></form>')).toEqual([]);
  });
});

describe('an age gate', () => {
  it('is seen when the homepage opens by asking the visitor their age', () => {
    expect(opensBehindAgeGate([page('https://alpha.co.nz/', ['ALPHA WINES', 'Are you over 18?', 'Yes', 'No'])])).toBe(true);
    expect(opensBehindAgeGate([page('https://alpha.co.nz/', ['You must be of legal drinking age to enter this site.'])])).toBe(true);
    expect(opensBehindAgeGate([page('https://alpha.co.nz/', ['Family winery in Marlborough since 1989. Cellar door open daily.'])])).toBe(false);
  });
});
