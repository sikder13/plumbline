import { describe, expect, it } from 'vitest';
import { speedSeen, statedSentence, steadySpeed } from './stated.ts';

const f = (checkId: string, title: string, detail: Record<string, unknown> = {}) => ({ checkId, title, detail });

describe('the sentence put to an owner', () => {
  it('states phone speed as the median of the last three runs, each measure on its own', () => {
    const runs = [{ performance: 46, lcpMs: 6568 }, { performance: 40, lcpMs: 6098 }, { performance: 31, lcpMs: 8572 }];
    expect(steadySpeed(runs)).toEqual({ performance: 40, lcpMs: 6568 });
    expect(statedSentence(f('C20_slow_mobile', 'Mobile speed score 31 out of 100, main content after 8.6 s'), runs)).toBe('Mobile speed score 40 out of 100, main content after 6.6 s');
    // Only the last three runs count, and one run alone is left as it was measured.
    expect(steadySpeed([{ performance: 90, lcpMs: 1000 }, ...runs])).toEqual({ performance: 40, lcpMs: 6568 });
    expect(statedSentence(f('C20_slow_mobile', 'Mobile speed score 31 out of 100, main content after 8.6 s'), [runs[2]!])).toBe('Mobile speed score 31 out of 100, main content after 8.6 s');
    expect(steadySpeed([])).toBeNull();
  });

  it('shows every run behind a speed sentence', () => {
    const runs = [{ performance: 46, lcpMs: 6568 }, { performance: 40, lcpMs: 6098 }, { performance: 31, lcpMs: 8572 }];
    expect(speedSeen(runs)).toBe('Measured on 3 separate runs. Scores: 46, 40 and 31 out of 100. Main content after 6.6 s, 6.1 s and 8.6 s.');
    expect(speedSeen(runs.slice(0, 2))).toBe('Measured on 2 separate runs. Scores: 46 and 40 out of 100. Main content after 6.6 s and 6.1 s.');
    expect(speedSeen(runs.slice(0, 1))).toBeNull();
  });

  it('says exactly what the first phone screen lacks', () => {
    expect(statedSentence(f('C13_no_action_above_fold', 'The first phone screen has no way to book or get in touch'), [])).toBe('The first phone screen has no button to book, call or email');
  });

  it('states a missing page by the link that leads to it, and leaves out one nothing links to', () => {
    const examples = [
      { url: 'https://www.alpha.co.nz/buy-wine', linkedFrom: [] },
      { url: 'https://www.alpha.co.nz/booking', linkedFrom: [{ pageUrl: 'https://www.alpha.co.nz/visit-us', text: 'Book a wine tasting' }] },
      { url: 'https://www.alpha.co.nz/wine', linkedFrom: [{ pageUrl: 'https://www.alpha.co.nz/our-wine', text: '' }] },
    ];
    expect(statedSentence(f('CM_missing_page', 'Links to your Buy Wine page, your Booking page and your Wine pages lead to missing pages (404). We found 12 broken links.', { examples }), [])).toBe(
      'The link "Book a wine tasting" on /visit-us leads to a missing page (404), and so does a picture link on /our-wine',
    );
    expect(statedSentence(f('CM_missing_page', 'A link to your Info page leads to a missing page (404).', { examples: [{ url: 'https://alpha.co.nz/Info.html', linkedFrom: [{ pageUrl: 'https://alpha.co.nz/', text: 'Info |' }] }] }), [])).toBe('The link "Info |" on the homepage leads to a missing page (404)');
  });

  it('counts pages from our own reading, not from the count it was given', () => {
    expect(statedSentence(f('CM_no_meta_description', '15 of the 16 pages have no meta description, including your fishing package pages.', { measured: 'No meta description on the example page, nor on 7 of the 8 other pages we read.' }), [])).toBe('8 of the 9 pages we read have no meta description');
    expect(statedSentence(f('CM_no_main_heading', '7 of 12 pages have no main heading, and 11 carry no structured data.', { measured: 'No main heading on the example page, nor on 8 of the 11 other pages we read. No structured data on the example page, nor on 10 of the 11 other pages we read.' }), [])).toBe(
      '9 of the 12 pages we read have no main heading, and 11 of the 12 have no structured data',
    );
    expect(statedSentence(f('CM_no_meta_description', 'Half the pages have no meta description.', { measured: 'No meta description on the 2 example pages, nor on 1 of the 4 other pages we read.' }), [])).toBe('3 of the 6 pages we read have no meta description');
    // Where we read no other page, the sentence speaks of the pages we did read and gives no count of theirs.
    expect(statedSentence(f('CM_no_meta_description', '72 of 102 pages have no meta description.', { measured: 'No meta description on the example page.' }), [])).toBe('The one page we read has no meta description');
    expect(statedSentence(f('CM_no_main_heading', 'Half the pages have no main heading.', { measured: 'No main heading on the 3 example pages.' }), [])).toBe('The 3 pages we read have no main heading');
    // With nothing of ours to go on at all, the sentence stays as it was.
    expect(statedSentence(f('CM_no_meta_description', 'Half the pages have no meta description.', { measured: '' }), [])).toBe('Half the pages have no meta description.');
  });

  it('names an unlinked page and a leftover page by its address', () => {
    expect(statedSentence(f('CM_orphan_page', 'Your Packages page is not linked from anywhere else on the site.', { measured: 'The page loads. None of the 11 other pages we read links to it.', examples: [{ url: 'https://www.alpha.co.nz/packages.html' }] }), [])).toBe(
      'The page at /packages.html is not linked from any of the 11 other pages we read',
    );
    expect(
      statedSentence(f('CM_orphan_page', 'Two pages are not linked.', { measured: 'The 2 example pages load. None of the 16 other pages we read links to them.', examples: [{ url: 'https://alpha.co.nz/a' }, { url: 'https://alpha.co.nz/b/' }] }), []),
    ).toBe('The pages at /a and /b/ are not linked from any of the 16 other pages we read');
    expect(statedSentence(f('CM_leftover_page', "A leftover page called 'copy of cellar door' is live.", { examples: [{ url: 'https://www.alpha.co.nz/copy-of-cellar-door', title: 'Cellar Door - Wine Sales Only | Alpha Wines' }] }), [])).toBe(
      'The page at /copy-of-cellar-door is still live, under the title "Cellar Door - Wine Sales Only | Alpha Wines"',
    );
  });

  it('leaves every other finding in its own words', () => {
    expect(statedSentence(f('C41_outdated_platform', 'PHP 7.1.33 is past its end of life (2019-12-01)'), [])).toBe('PHP 7.1.33 is past its end of life (2019-12-01)');
  });

  it('keeps the query of an address, which may be all that tells two pages apart', () => {
    expect(statedSentence(f('CM_leftover_page', 'A sample page is still live.', { examples: [{ url: 'https://x.co.nz/?p=1', title: 'Hello world' }] }), [])).toBe('The page at /?p=1 is still live, under the title "Hello world"');
    expect(statedSentence(f('CM_missing_page', 'A link leads to a missing page.', { examples: [{ url: 'https://x.co.nz/info', linkedFrom: [{ pageUrl: 'https://x.co.nz/?page_id=7', text: 'Info' }] }] }), [])).toBe('The link "Info" on /?page_id=7 leads to a missing page (404)');
  });
});
