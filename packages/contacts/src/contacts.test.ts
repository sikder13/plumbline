import { describe, expect, it } from 'vitest';
import type { PageCapture, PageLink, TextBlock } from '@plumbline/render';
import { acceptModelPeople, contactPageUrls, decodeCloudflareEmail, isAmbiguous, peopleByPattern, publishedEmails, rankEmails, refusalStatement, usableName } from './index.ts';

const block = (text: string, extra: Partial<TextBlock> = {}): TextBlock => ({ text, tag: 'p', heading: null, selector: 'p', box: { x: 0, y: 0, w: 1, h: 1 }, fontSize: 16, href: null, inHeader: false, inNav: false, inFooter: false, ...extra });
const link = (raw: string, text = '', visible = true): PageLink => ({ raw, href: raw.startsWith('/') ? `https://fixture.co.nz${raw}` : raw, text, visible, fold: false, box: null, selector: 'a', target: '', hasHandler: false, inHeader: false, inNav: false, inFooter: false });
const page = (texts: string[], links: PageLink[] = [], url = 'https://fixture.co.nz/about'): PageCapture => ({ finalUrl: url, url, blocks: texts.map((t) => block(t)), text: texts.join('\n'), links, controls: [] }) as unknown as PageCapture;

function encodeCf(email: string, key = 0x5a): string {
  return key.toString(16).padStart(2, '0') + [...email].map((c) => (c.charCodeAt(0) ^ key).toString(16).padStart(2, '0')).join('');
}

describe('emails', () => {
  it('decodes Cloudflare email protection', () => {
    expect(decodeCloudflareEmail(encodeCf('info@fixture.co.nz'))).toBe('info@fixture.co.nz');
    expect(decodeCloudflareEmail(encodeCf('bookings@fixture.co.nz', 0xa7))).toBe('bookings@fixture.co.nz');
    expect(decodeCloudflareEmail('zz')).toBeNull();
    expect(decodeCloudflareEmail(encodeCf('not an email'))).toBeNull();
  });

  it('records only emails a visitor can see, with the page they are on', () => {
    const p = page(['Write to Info@Fixture.co.nz today.'], [link('mailto:bookings@fixture.co.nz?subject=Hi', 'Email us'), link('mailto:hidden@fixture.co.nz', 'x', false), link(`/cdn-cgi/l/email-protection#${encodeCf('skipper@fixture.co.nz')}`, '[email protected]')]);
    expect(publishedEmails(p)).toEqual([
      { email: 'info@fixture.co.nz', sourceUrl: 'https://fixture.co.nz/about', how: 'text' },
      { email: 'bookings@fixture.co.nz', sourceUrl: 'https://fixture.co.nz/about', how: 'mailto' },
      { email: 'skipper@fixture.co.nz', sourceUrl: 'https://fixture.co.nz/about', how: 'cloudflare' },
    ]);
  });

  it('never invents an address and drops template ones', () => {
    expect(publishedEmails(page(['Contact us through the form. Our domain is fixture.co.nz.']))).toEqual([]);
    expect(publishedEmails(page(['you@example.com', 'abc123@sentry.wixpress.com', 'logo@2x.png']))).toEqual([]);
  });

  it('puts own-domain and booking addresses first', () => {
    const ranked = rankEmails([{ email: 'someone@gmail.com', sourceUrl: '', how: 'text' }, { email: 'accounts@fixture.co.nz', sourceUrl: '', how: 'text' }, { email: 'info@fixture.co.nz', sourceUrl: '', how: 'text' }], 'fixture.co.nz');
    expect(ranked.map((e) => e.email)).toEqual(['info@fixture.co.nz', 'someone@gmail.com', 'accounts@fixture.co.nz']);
  });
});

describe('consent check', () => {
  it.each([
    'No unsolicited emails please.',
    'Unsolicited marketing emails will be reported as spam.',
    'Please do not send us SEO or marketing offers.',
    'We do not accept unsolicited sales approaches.',
    'No marketing emails or sales calls.',
    'No solicitations.',
    'This address is not for unsolicited commercial messages.',
  ])('finds a refusal in "%s"', (text) => {
    expect(refusalStatement(`Welcome aboard. ${text} Thanks.`)).toBe(text);
  });

  it.each([
    'We will never send you unsolicited emails or share your details.',
    'We do not send marketing emails without your consent.',
    'Contact us for bookings and enquiries.',
    'No booking fees. No hidden costs.',
    'You will not receive unsolicited messages from us.',
  ])('does not treat "%s" as a refusal', (text) => {
    expect(refusalStatement(text)).toBeNull();
  });
});

describe('contact pages', () => {
  it('picks contact, about and team links on the same site, contact first, five at most', () => {
    const home = page([], [link('/tours', 'Tours'), link('/about-us', 'About'), link('/contact', 'Contact'), link('https://other.nz/contact', 'Contact'), link('/meet-the-team', 'Meet the team'), link('/our-story', 'Our Story'), link('/a', 'Find us'), link('/b', 'The crew'), link('/c', 'Your hosts')], 'https://fixture.co.nz/');
    const urls = contactPageUrls(home);
    expect(urls).toHaveLength(5);
    expect(urls.slice(0, 2).sort()).toEqual(['https://fixture.co.nz/a', 'https://fixture.co.nz/contact']);
    expect(urls).not.toContain('https://other.nz/contact');
    expect(urls).not.toContain('https://fixture.co.nz/tours');
  });
});

describe('people', () => {
  const names = (texts: string[]) => peopleByPattern(page(texts)).map((p) => `${p.name}:${p.role}`);

  it('reads owners and seconds from common phrasings', () => {
    expect(names(['Ross Taylor, owner and skipper, has fished here for 40 years.'])).toEqual(['Ross Taylor:owner']);
    expect(names(['Dora and Chad - owners'])).toEqual(['Dora:owner', 'Chad:owner']);
    expect(names(['Owned and operated by Lisa and Tony Smith since 2010.'])).toEqual(['Lisa:owner', 'Tony Smith:owner']);
    expect(names(['Your skipper Mere will meet you at the wharf.'])).toEqual(['Mere:owner']);
    expect(names(['Kieran is the head guide and knows every cave.'])).toEqual(['Kieran:second']);
    expect(names(["Kia ora, I'm Rachel, your host for the day."])).toEqual(['Rachel:owner']);
    expect(names(['Sarah Jones, General Manager'])).toEqual(['Sarah Jones:second']);
    expect(names(['Tom Brown - co-owner'])).toEqual(['Tom Brown:second']);
  });

  it('reads team cards where the role is on the next line', () => {
    expect(names(['Aroha Ngata', 'Operations Manager', 'Pete Chandler', 'Founder'])).toEqual(['Aroha Ngata:second', 'Pete Chandler:owner']);
  });

  it('keeps the sentence each name came from', () => {
    const p = peopleByPattern(page(['Welcome. Ross Taylor, owner and skipper, has fished here for 40 years. Come aboard.']))[0]!;
    expect(p.quote).toContain('Ross Taylor, owner and skipper');
    expect(p.sourceUrl).toBe('https://fixture.co.nz/about');
  });

  it('does not turn places or business words into people', () => {
    expect(names(['Lake Taupo, host of the annual fishing contest.'])).toEqual([]);
    expect(names(['Qualmark Gold, operator of the year.'])).toEqual([]);
    expect(names(['The Owner reserves the right to cancel.'])).toEqual([]);
    expect(names(['our guides are friendly and our manager is on site'])).toEqual([]);
  });

  it('calls a page ambiguous when it speaks of owners but names none, or names too many', () => {
    expect(isAmbiguous([], [page(['A family owned business run by a husband and wife team.'])])).toBe(true);
    expect(isAmbiguous([], [page(['We run kayak tours every day.'])])).toBe(false);
    const p = peopleByPattern(page(['Ross Taylor, owner and skipper.']));
    expect(isAmbiguous(p, [page(['Ross Taylor, owner and skipper.'])])).toBe(false);
  });
});

describe('model answers', () => {
  const text = 'Welcome to Fixture Charters.\nRoss and  Frances bought the business 14 years ago and run every trip themselves.';

  it('accepts an answer whose quote is in the page word for word', () => {
    const got = acceptModelPeople([{ name: 'Ross', role: 'owner', quote: 'Ross and Frances bought the business 14 years ago' }], text, 'https://fixture.co.nz/');
    expect(got).toMatchObject([{ name: 'Ross', role: 'owner', how: 'model' }]);
  });

  it('rejects a quote that is not in the page, a quote without the name, and an unknown role', () => {
    expect(acceptModelPeople([{ name: 'Ross', role: 'owner', quote: 'Ross Taylor is the owner of Fixture Charters' }], text, 'u')).toEqual([]);
    expect(acceptModelPeople([{ name: 'Harley', role: 'owner', quote: 'Ross and Frances bought the business 14 years ago' }], text, 'u')).toEqual([]);
    expect(acceptModelPeople([{ name: 'Ross', role: 'customer', quote: 'Ross and Frances bought the business 14 years ago' }], text, 'u')).toEqual([]);
    expect(acceptModelPeople([null as never, { name: 5 as never, role: 'owner', quote: 'x' }], text, 'u')).toEqual([]);
  });
});

describe('names in output', () => {
  it('uses only the first name until the name is confirmed', () => {
    expect(usableName('Ross Michael Taylor', false)).toBe('Ross');
    expect(usableName('Ross Michael Taylor', true)).toBe('Ross Michael Taylor');
    expect(usableName('Dora', 0)).toBe('Dora');
    expect(usableName(null, true)).toBe('');
  });
});
