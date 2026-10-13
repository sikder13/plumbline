import { describe, expect, it } from 'vitest';
import { nzReadable, plainDates, plainImpact, plainSeen } from './build.ts';
import { bannedIssues, dashIssues, numberIssues, numberSet, scanPage, splitPage, visibleText } from './copy.ts';
import { holds, kindOf, pageFacts } from './crawlmouse.ts';
import { validMailto, validTel } from './gates.ts';
import { summarise } from './visits.ts';

describe('finding text for a page', () => {
  it('drops a sentence that leans on an outside figure or study', () => {
    expect(plainImpact('Your page is slow on a phone. In a Deloitte study for Google, a tenth of a second faster on mobile lifted travel site conversions by 10.1%.')).toBe('Your page is slow on a phone.');
    expect(plainImpact('Your site does not describe the business in the format search engines read. Google says this makes richer results possible, though it does not guarantee them.')).toBe('Your site does not describe the business in the format search engines read.');
    expect(plainImpact('Menu items that lead nowhere make visitors give up looking for the page they wanted.')).toBe('Menu items that lead nowhere make visitors give up looking for the page they wanted.');
  });

  it('writes stored dates out and removes code from what was seen', () => {
    expect(plainDates('PHP 5.4.45 is past its end of life (2018-12-31)')).toBe('PHP 5.4.45 is past its end of life (31 December 2018)');
    expect(plainSeen('Buttons must have discernible text (button-name, critical, 2 elements). <button type="button">x</button>')).toBe('Buttons must have discernible text.');
    expect(plainSeen('Support for this series ended on 2025-12-31 (https://endoflife.date/php).')).toBe('Support for this series ended on 31 December 2025.');
    expect(plainSeen('The phone link holds "03 555 0100  (International calls 00 64 3 555 0100)", which is not a phone number.')).toBe('The phone link holds "03 555 0100 (International calls 00 64 3 555 0100)", which is not a phone number.');
    expect(plainSeen('text in another language (ces) and spam wording (xyz).')).toBe('text in another language and spam wording.');
    expect(plainSeen(null)).toBeNull();
  });

  it('shows the time in New Zealand', () => {
    expect(nzReadable('2026-10-11T03:52:01.000Z')).toBe('11 October 2026, 4:52 pm');
  });
});

describe('copy scan', () => {
  it('finds dashes and hyphens used as dashes, but not hyphens inside words', () => {
    expect(dashIssues('Open daily – all year', 'demo')).toHaveLength(1);
    expect(dashIssues('Tours - from the beach', 'demo')).toHaveLength(1);
    expect(dashIssues('Open 10-5', 'demo')).toHaveLength(1);
    expect(dashIssues('A pre-trip email and a tidy-up', 'found')).toHaveLength(0);
  });

  it('finds banned words', () => {
    expect(bannedIssues('We unlock world class solutions', 'demo').map((i) => i.text.toLowerCase())).toEqual(['unlock', 'world class', 'solutions']);
  });

  it('traces every number to a source', () => {
    const known = numberSet('Half day $160 per person. Phone 03 555 0100. NZ$1,490.');
    expect(numberIssues('From $160. Call 03 555 0100. NZ$1,490.', 'demo', known)).toHaveLength(0);
    expect(numberIssues('From $165', 'demo', known).map((i) => i.text)).toEqual(['165']);
  });

  it('reads image descriptions as copy and keeps the two tabs apart', () => {
    const html = '<body><header>Bar</header><div id="demo"><img alt="Two kayaks - at dusk"><p>From $99</p></div><div id="found"><p>Score 28</p></div></body>';
    expect(visibleText('<p>One</p><script>x()</script><p>Two</p>')).toBe('One Two');
    const copy = splitPage(html);
    expect(copy.rest).toBe('Bar');
    const issues = scanPage(copy, { ownSite: 'nothing', measured: 'Score 28', offer: '' });
    expect(issues.map((i) => `${i.kind}:${i.where}`).sort()).toEqual(['dash:demo', 'number:demo']);
    expect(scanPage({ demo: 'Rated 28', found: '', rest: '' }, { ownSite: '', measured: 'Score 28', offer: '' })).toEqual([]);
  });
});

describe('second check', () => {
  it('reads what a sentence claims', () => {
    expect(kindOf('A link on your site leads to a missing page (404).')).toBe('missing_page');
    expect(kindOf('18 of the 40 pages we read have no meta description')).toBe('no_meta_description');
    expect(kindOf('12 of 14 pages have no main heading (H1).')).toBe('no_h1');
    expect(kindOf('One page is not linked from anywhere else on the site')).toBe('not_checkable');
  });

  it('keeps a sentence only while the example page still shows the problem', () => {
    const bare = pageFacts('https://example.test/a', 200, '<html><head><title>A</title></head><body><p>Hello</p></body></html>');
    const full = pageFacts('https://example.test/b', 200, '<html><head><meta name="description" content="About"><script type="application/ld+json">{}</script></head><body><h1>Title</h1></body></html>');
    expect(holds('no_meta_description', bare)).toBe(true);
    expect(holds('no_meta_description', full)).toBe(false);
    expect(holds('no_h1', bare)).toBe(true);
    expect(holds('no_structured_data', full)).toBe(false);
    expect(holds('missing_page', pageFacts('https://example.test/c', 404, ''))).toBe(true);
    expect(holds('missing_page', bare)).toBe(false);
    expect(holds('not_checkable', bare)).toBe(false);
  });
});

describe('links', () => {
  it('accepts only numbers and addresses a phone can use', () => {
    expect(validTel('tel:+6435550100')).toBe(true);
    expect(validTel('tel:03 555 0100  (International calls 00 64 3 555 0100)')).toBe(false);
    expect(validMailto('mailto:info@example.co.nz?subject=Hello')).toBe(true);
    expect(validMailto('mailto:"sam@example.co.nz"')).toBe(false);
  });
});

describe('visits', () => {
  it('gives one line per page', () => {
    const rows = [
      { token: 'a-abc123', kind: 'view', visited_at: '2026-10-13T01:00:00Z' },
      { token: 'a-abc123', kind: null, visited_at: '2026-10-12T01:00:00Z' },
      { token: 'a-abc123', kind: 'tab_findings', visited_at: '2026-10-13T01:01:00Z' },
    ];
    expect(summarise(['a-abc123', 'b-def456'], rows)).toEqual([
      { token: 'a-abc123', firstView: '2026-10-12T01:00:00Z', lastView: '2026-10-13T01:00:00Z', views: 2, findingsTab: true, replyOrCall: false },
      { token: 'b-def456', firstView: null, lastView: null, views: 0, findingsTab: false, replyOrCall: false },
    ]);
  });
});
