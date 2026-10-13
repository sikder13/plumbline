import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { chromium } from 'playwright';
import { describe, expect, it } from 'vitest';
import { cropInPixels, mediaDir, nzReadable, plainDates, plainImpact, plainSeen, secondCheckOf, withoutDashes } from './build.ts';
import { bannedIssues, dashIssues, numberIssues, numberSet, scanPage, splitPage, visibleText } from './copy.ts';
import { holds, kindOf, pageFacts } from './crawlmouse.ts';
import { quietContext, validMailto, validTel } from './gates.ts';
import type { ContentFile } from './types.ts';
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

describe('words quoted from a site on a recipe page', () => {
  it('lose a dash set off by spaces, which the copy rules do not allow anywhere on a page', () => {
    expect(withoutDashes('2023 © Copyright - Alpha Penguins. All rights reserved.')).toBe('2023 © Copyright, Alpha Penguins. All rights reserved.');
    expect(withoutDashes('Open daily — bookings essential')).toBe('Open daily, bookings essential');
    expect(withoutDashes('A family-run business')).toBe('A family-run business');
    expect(withoutDashes(null)).toBeNull();
  });

  it('keep a range of prices as a range, written with "to" and never as a list of two prices', () => {
    expect(withoutDashes('Tastings $45 - $60 per person')).toBe('Tastings $45 to $60 per person');
    expect(withoutDashes('From NZ$1,250 – NZ$1,650, twin share')).toBe('From NZ$1,250 to NZ$1,650, twin share');
    expect(withoutDashes('Adult $12.50—$14.00')).toBe('Adult $12.50 to $14.00');
    expect(withoutDashes('Platters $25-40')).toBe('Platters $25 to 40');
    expect(withoutDashes('$45pp - $60pp')).toBe('$45pp to $60pp');
  });

  it('keep opening hours as a range too', () => {
    expect(withoutDashes('Open 9am – 5pm — every day')).toBe('Open 9am to 5pm, every day');
    expect(withoutDashes('Cellar door 10:30am-4.30pm')).toBe('Cellar door 10:30am to 4.30pm');
  });

  it('do not take a price followed by something else for a range', () => {
    expect(withoutDashes('Kayak hire $45 - 2 hours on the water')).toBe('Kayak hire $45, 2 hours on the water');
    expect(withoutDashes('Call 03 123 4567 - 021 123 456')).toBe('Call 03 123 4567, 021 123 456');
  });
});

describe('a crop given in fractions of a photograph', () => {
  it('is turned into whole pixels that never reach past the edge', () => {
    expect(cropInPixels({ left: 0.5, top: 0, width: 0.5, height: 1 }, 2000, 1000)).toEqual({ left: 1000, top: 0, width: 1000, height: 1000 });
    // 0.3 and 0.7 of 1875 round to 563 and 1313, one pixel more than the photograph has.
    expect(cropInPixels({ left: 0, top: 0.3, width: 1, height: 0.7 }, 2500, 1875)).toEqual({ left: 0, top: 563, width: 2500, height: 1312 });
    expect(cropInPixels({ left: 0.9, top: 0.9, width: 0.5, height: 0.5 }, 1000, 1000)).toEqual({ left: 900, top: 900, width: 100, height: 100 });
  });

  it('is left as it is when it is already given in pixels', () => {
    expect(cropInPixels({ left: 120, top: 40, width: 800, height: 600 }, 2000, 1000)).toEqual({ left: 120, top: 40, width: 800, height: 600 });
  });
});

describe('where a page reads its photographs from', () => {
  const own: ContentFile = { design: 'coastal', images: {}, demo: {} };

  it('is its own content folder for a page whose business was not prepared as part of a wave', () => {
    expect(mediaDir('alpha-tours', own)).toMatch(/previews[\\/]content[\\/]alpha-tours$/);
  });

  it('is the folder its wave was researched into, for a page with a design of its own as much as for a recipe page', () => {
    expect(mediaDir('alpha-tours', { ...own, wave: true })).toMatch(/data[\\/]wave[\\/]alpha-tours$/);
  });
});

describe('the words a visitor can read', () => {
  it('leave out what is hidden from a screen reader as decoration, and keep a label that stands in for it', () => {
    const html = '<h1 aria-label="Meet the penguins"><span aria-hidden="true">Meet the</span><span aria-hidden="true">penguins</span></h1><p aria-hidden="true">01 / 04</p><p>Four tours.</p>';
    expect(visibleText(html)).toBe('Meet the penguins Four tours.');
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

describe('a browser opened by a gate', () => {
  it('answers the visit report itself, so a check is never counted as a visit', async () => {
    let reports = 0;
    const server = createServer((req, res) => {
      if (req.url === '/api/demo-visit') {
        reports += 1;
        res.writeHead(204).end();
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><title>waiting</title><script>fetch("/api/demo-visit",{method:"POST",body:"{}"}).then(function(){document.title="sent"})</script>');
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    const browser = await chromium.launch();
    try {
      const ctx = await quietContext(browser, { viewport: { width: 390, height: 844 } });
      const page = await ctx.newPage();
      await page.goto(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`);
      await page.waitForFunction(() => document.title === 'sent');
      expect(reports).toBe(0);
    } finally {
      await browser.close();
      server.close();
    }
  }, 60_000);
});

describe('what a recipe page says of the second crawl', () => {
  const summary = { site_score: 66.06, grade: 'C+', ai_readiness_score: 92, ai_crawler_access: 'All major AI crawlers are allowed by robots.txt. A strength, not a finding.' };

  it('gives the scores of a summary filed for a wave, and the approved findings in the words they are put in', () => {
    expect(secondCheckOf(summary, ['The page at /old is still live.'])).toEqual({ score: '66 out of 100 (grade C+)', aiReadiness: '92 out of 100', crawlerAccess: 'All major AI crawlers are allowed by robots.txt.', findings: ['The page at /old is still live.'] });
  });

  it('carries the approved findings even where no summary is on file, and at most three of them', () => {
    expect(secondCheckOf(null, ['a.', 'b.', 'c.', 'd.'])).toEqual({ score: null, aiReadiness: null, crawlerAccess: null, findings: ['a.', 'b.', 'c.'] });
  });

  it('carries no dash, even inside a page title it quotes', () => {
    expect(secondCheckOf(null, ['The page at /old is still live, under the title "Cellar Door - Wine Sales Only | Alpha Wines".'])?.findings).toEqual(['The page at /old is still live, under the title "Cellar Door, Wine Sales Only | Alpha Wines".']);
  });

  it('is left off the page when there is neither a summary nor a finding', () => {
    expect(secondCheckOf(null, [])).toBeNull();
  });
});
