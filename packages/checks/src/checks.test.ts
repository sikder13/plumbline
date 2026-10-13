import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CandidateFinding } from '@plumbline/core';
import type { SiteData } from '@plumbline/collect';
import { evaluateSite } from './engine.ts';
import { CHECK_IDS } from './ids.ts';
import { checksFor, registryProblems } from './registry.ts';
import { block, editHomes, healthySite, link, page } from './testing.ts';
import type { AiSummary } from './types.ts';

const NOW = new Date('2026-10-10T21:00:00Z');
const run = (site: SiteData, ai: AiSummary | null = null) => evaluateSite(site, 'tourism', NOW, ai);
const ids = (site: SiteData, ai: AiSummary | null = null) => run(site, ai).findings.map((f) => f.checkId);
const one = (site: SiteData, id: string, ai: AiSummary | null = null): CandidateFinding => {
  const f = run(site, ai).findings.filter((x) => x.checkId === id);
  expect(f, `${id} should fire once`).toHaveLength(1);
  return f[0]!;
};

describe('registry', () => {
  it('has a module for every listed check and nothing extra', () => {
    expect(registryProblems()).toEqual([]);
    expect(checksFor('tourism').map((c) => c.id).sort()).toEqual([...CHECK_IDS].sort());
    expect(checksFor('core').some((c) => c.pack === 'tourism')).toBe(false);
  });
});

describe('a healthy site', () => {
  it('produces no findings and no errors', () => {
    const r = run(healthySite());
    expect(r.errors).toEqual([]);
    expect(r.findings.map((f) => `${f.checkId}: ${f.title}`)).toEqual([]);
  });
});

describe('content checks', () => {
  it('C01 fires on placeholder text and on a file name shown as a link', () => {
    const s = editHomes(healthySite(), (p) => p.blocks.splice(1, 0, block('Want something a bit special? We can plan a day around you. '.repeat(3) + 'Lorem ipsum dolor sit amet, and then a good deal more filler text follows here, consectetur adipiscing elit.')));
    const f = one(s, 'C01_placeholder_text');
    expect(f.where).toBe('homepage_mobile');
    expect(f.evidence[0]).toMatchObject({ kind: 'element', viewport: 'mobile' });
    const s2 = healthySite();
    s2.homepage.mobile!.links.push(link('https://fixture.co.nz/photography-hike.html', 'photography-hike.html'));
    expect(one(s2, 'C01_placeholder_text').title).toContain('photography-hike.html');
  });

  it('C01 on an inner page is scored as an inner page finding', () => {
    const s = healthySite();
    s.inner[0]!.blocks.push(block('Your content goes here. Edit or remove this text inline.'));
    expect(one(s, 'C01_placeholder_text').where).toBe('inner');
  });

  it('C02 fires when the copyright year is two or more years old', () => {
    const set = (year: number) => editHomes(healthySite(), (p) => (p.blocks[p.blocks.length - 1] = block(`© ${year} Harbour Fixture Charters`, { inFooter: true })));
    expect(one(set(2015), 'C02_stale_copyright').detail).toMatchObject({ year: 2015, currentYear: 2026 });
    expect(ids(set(2024))).toContain('C02_stale_copyright');
    expect(ids(set(2025))).not.toContain('C02_stale_copyright');
  });

  it('C03 fires on an expired date, COVID wording or an old homepage alert', () => {
    const withText = (t: string) => editHomes(healthySite(), (p) => p.blocks.splice(1, 0, block(t)));
    expect(one(withText('Prices valid until 31 August 2024.'), 'C03_stale_dated_notice').detail).toMatchObject({ kind: 'expired', date: '2024-08-31' });
    expect(one(withText('All customers must hold a valid vaccine pass.'), 'C03_stale_dated_notice').detail).toMatchObject({ kind: 'covid' });
    expect(one(withText('Notice: the wharf is closed from 3 March 2021.'), 'C03_stale_dated_notice').detail).toMatchObject({ kind: 'old_alert' });
    expect(ids(withText('Prices valid until 31 August 2027.'))).not.toContain('C03_stale_dated_notice');
  });

  it('C04 fires on a season message out of season', () => {
    const s = editHomes(healthySite(), (p) => p.blocks.splice(1, 0, block('Summer has started, Xmas parties are booking fast.')));
    expect(one(s, 'C04_seasonal_mismatch').detail).toMatchObject({ season: 'summer', month: 10 });
    const ok = editHomes(healthySite(), (p) => p.blocks.splice(1, 0, block('Spring special: 10% off all trips.')));
    expect(ids(ok)).not.toContain('C04_seasonal_mismatch');
  });

  it('C05 needs both a foreign block and spam terms or an outbound link', () => {
    const czech = 'V dnešní digitální éře se sázková industrie dramaticky proměnila a sportovní tipy jsou dostupné každému. Analytické modely a prediktivní algoritmy zpracovávají data ze sportovních zdrojů, aby nabídly přesnější předpovědi pro všechny sázkaře v zemi.';
    const s = editHomes(healthySite(), (p) => p.blocks.splice(1, 0, block(czech)));
    const f = one(s, 'C05_possible_compromise');
    expect(f.detail.language).toBe('ces');
    expect((f.detail.spamTerms as string[]).length).toBeGreaterThan(0);
    const german = 'Willkommen an Bord. Wir fahren jeden Morgen mit kleinen Gruppen hinaus in den Hafen, und unser Kapitän zeigt Ihnen die besten Plätze zum Angeln. Alle Ruten und Köder werden gestellt, und Kinder sind auf jeder Fahrt herzlich willkommen bei uns.';
    expect(ids(editHomes(healthySite(), (p) => p.blocks.splice(1, 0, block(german))))).not.toContain('C05_possible_compromise');
  });

  it('C36 fires under 150 visible words on both layouts', () => {
    const s = editHomes(healthySite(), (p) => p.blocks.splice(1, 1));
    expect(one(s, 'C36_thin_homepage').detail.words).toBeLessThan(150);
    const half = healthySite();
    half.homepage.mobile!.blocks.splice(1, 1);
    half.homepage.mobile!.text = half.homepage.mobile!.blocks.map((b) => b.text).join('\n');
    expect(ids(half)).not.toContain('C36_thin_homepage');
  });

  it('C60 fires when two founding years are given', () => {
    const s = editHomes(healthySite(), (p) => p.blocks.splice(1, 0, block('Sharing the harbour since 1988.')));
    s.inner[0]!.finalUrl = 'https://fixture.co.nz/about-us/';
    s.inner[0]!.blocks.push(block('Family-run since 2010.'));
    const f = one(s, 'C60_conflicting_facts');
    expect((f.detail.values as { year: number }[]).map((v) => v.year)).toEqual([1988, 2010]);
    expect(f.evidence).toHaveLength(2);
  });
});

describe('hidden injected content', () => {
  const CZECH = 'V dnešní digitální éře se sázková industrie dramaticky proměnila díky pokročilým technologiím a datové analytice. Platformy představují novou generaci služeb, které kombinují umělou inteligenci, statistické modely a lidskou expertízu k vytváření kvalitních podkladů pro rozhodování.';
  const withHtml = (hidden: string) => {
    const s = healthySite();
    const dir = mkdtempSync(join(tmpdir(), 'plumbline-c05b-'));
    const body = s.homepage.mobile!.blocks.map((b) => `<p>${b.text}</p>`).join('\n');
    writeFileSync(join(dir, 'page.html'), `<!doctype html><html lang="en"><body>${body}\n${hidden}</body></html>`);
    for (const p of [s.homepage.mobile!, s.homepage.desktop!]) Object.assign(p, { dir, htmlFile: 'page.html' });
    return s;
  };

  it('C05b fires on hidden foreign text that links to an unrelated domain, with the code, the link and the place on the page', () => {
    const f = one(withHtml(`<div style="overflow: hidden; height: 1px;"><p>${CZECH}</p><a href="https://betzoid.com/cz/">sportovní tipy</a></div>`), 'C05b_hidden_injected_content');
    expect(f.detail).toMatchObject({ language: 'ces', shownToVisitors: false, outboundLinks: [{ href: 'https://betzoid.com/cz/', domain: 'betzoid.com' }] });
    expect(f.title).toContain('betzoid.com');
    expect(f.evidence[0]).toMatchObject({ kind: 'element', viewport: 'mobile' });
    expect(f.evidence[0]!.box).toBeDefined();
    expect(f.evidence[0]!.excerpt).toContain('overflow: hidden; height: 1px;');
    expect(f.evidence[0]!.excerpt).toContain('https://betzoid.com/cz/');
    expect(f.evidence[0]!.excerpt).toContain('line ');
  });

  it('C05b stays quiet without an unrelated link, and C05 stays quiet because nothing foreign is visible', () => {
    const s = withHtml(`<div style="display:none"><p>${CZECH}</p></div>`);
    expect(ids(s)).not.toContain('C05b_hidden_injected_content');
    expect(ids(s)).not.toContain('C05_possible_compromise');
  });

  it('C05b stays quiet when the same text is visible', () => {
    const s = withHtml(`<div><p>${CZECH}</p><a href="https://betzoid.com/cz/">tipy</a></div>`);
    editHomes(s, (p) => p.blocks.push(block(CZECH)));
    expect(ids(s)).not.toContain('C05b_hidden_injected_content');
  });
});

describe('link checks', () => {
  const brokenImage = (p: NonNullable<SiteData['homepage']['mobile']>) => {
    p.images.push({ src: '/gone.jpg', currentSrc: 'https://fixture.co.nz/gone.jpg', alt: '', naturalWidth: 0, naturalHeight: 0, complete: true, width: 320, height: 200, visible: true, box: { x: 0, y: 500, w: 320, h: 200 }, selector: 'img', loading: '', lazyAttr: false, inHeader: false, inNav: false, inFooter: false });
    p.badResponses.push({ url: 'https://fixture.co.nz/gone.jpg', status: 404, type: 'image' });
  };

  it('C06 fires only when the image is broken at both viewports and the server said so', () => {
    expect(one(editHomes(healthySite(), brokenImage), 'C06_broken_images').detail.images).toEqual([{ src: 'https://fixture.co.nz/gone.jpg', status: 404 }]);
    const mobileOnly = healthySite();
    brokenImage(mobileOnly.homepage.mobile!);
    expect(ids(mobileOnly)).not.toContain('C06_broken_images');
    const lazy = editHomes(healthySite(), (p) => {
      brokenImage(p);
      p.badResponses.length = 0;
    });
    expect(ids(lazy)).not.toContain('C06_broken_images');
  });

  it('C10 fires on malformed contact links', () => {
    const s = healthySite();
    s.homepage.mobile!.links.push(link('http://Http', 'WhatsApp: +64 22 383 3051'), link('https://m.me/https://www.facebook.com/fixture/', 'Messenger'), link('', 'hello@fixture.co.nz'));
    const f = run(s).findings.filter((x) => x.checkId === 'C10_broken_contact_links');
    expect(f.map((x) => x.detail.kind).sort()).toEqual(['mailto', 'messenger', 'scheme']);
  });

  it('C11 fires on menu items that go to #, javascript: or an error', () => {
    const s = healthySite();
    s.homepage.mobile!.links.push(link('https://fixture.co.nz/#', 'More', { raw: '#', inNav: true }), link('javascript:void(0)', 'Deals', { inNav: true }), link('https://fixture.co.nz/old/', 'Old', { inNav: true }), link('https://fixture.co.nz/#', 'Back to top', { raw: '#' }));
    s.links.push({ url: 'https://fixture.co.nz/old/', internal: true, status: 404, error: null, finalUrl: '', skipped: null, seen: [{ pageUrl: 'https://fixture.co.nz/', viewport: 'mobile', text: 'Old', selector: 'a', box: null, inNav: true, raw: '/old/' }] });
    const f = one(s, 'C11_dead_navigation');
    expect((f.detail.items as { text: string }[]).map((i) => i.text)).toEqual(['More', 'Deals', 'Old']);
  });

  it('C12 fires on internal links that are gone, and not on refusals', () => {
    const s = healthySite();
    const seen = [{ pageUrl: 'https://fixture.co.nz/tours/', viewport: 'mobile' as const, text: 'Timetable', selector: 'a', box: { x: 0, y: 0, w: 10, h: 10 }, inNav: false, raw: '/t/' }];
    s.links.push({ url: 'https://fixture.co.nz/t/', internal: true, status: 404, error: null, finalUrl: '', skipped: null, seen }, { url: 'https://fixture.co.nz/p/', internal: true, status: 403, error: null, finalUrl: '', skipped: null, seen }, { url: 'https://other.nz/x', internal: false, status: 404, error: null, finalUrl: '', skipped: null, seen });
    const f = one(s, 'C12_broken_internal_links');
    expect((f.detail.links as { url: string }[]).map((l) => l.url)).toEqual(['https://fixture.co.nz/t/']);
    expect(f.where).toBe('inner');
  });
});

describe('action checks', () => {
  it('C13 fires when the first phone screen has no way to act', () => {
    const s = healthySite();
    for (const l of s.homepage.mobile!.links) l.fold = false;
    for (const b of s.homepage.mobile!.blocks) b.box.y += 2000;
    expect(one(s, 'C13_no_action_above_fold').evidence[0]!.box).toEqual({ x: 0, y: 0, w: 390, h: 844 });
  });

  it('C13 stays quiet when a phone number is shown as plain text in the first screen', () => {
    const s = healthySite();
    for (const l of s.homepage.mobile!.links) l.fold = false;
    for (const b of s.homepage.mobile!.blocks) b.box.y += 2000;
    s.homepage.mobile!.blocks.unshift(block('Call 09 402 8105', { box: { x: 0, y: 100, w: 200, h: 20 } }));
    expect(ids(s)).not.toContain('C13_no_action_above_fold');
  });

  it('C14 says whether prices are missing from the homepage only or from the whole site', () => {
    const noHome = editHomes(healthySite(), (p) => p.blocks.splice(2, 1, block('Call 09 402 8105 or email hello@fixture.co.nz.')));
    expect(one(noHome, 'C14_no_price_visible').detail.scope).toBe('homepage');
    noHome.inner[0]!.blocks.splice(1, 1, block('Departing 7am daily from October to April.'));
    expect(one(noHome, 'C14_no_price_visible').detail.scope).toBe('site');
  });

  it('C15 fires when the homepage has no phone or email at all', () => {
    const s = editHomes(healthySite(), (p) => {
      p.blocks.splice(2, 1, block('Half day charter $450.'));
      p.links = p.links.filter((l) => !l.raw.startsWith('tel:'));
    });
    one(s, 'C15_contact_details_missing');
  });

  it('C16 fires when booking is loaded but no visible link reaches it', () => {
    const s = editHomes(healthySite(), (p) => (p.links = p.links.filter((l) => !l.href.includes('rezdy'))));
    s.inner[0]!.links = [];
    s.booking = [{ system: 'Rezdy', kind: 'system', url: 'https://fixture.rezdy.com/x.js', pageUrl: 'https://fixture.co.nz/', how: 'script', visibleLink: false }];
    one(s, 'C16_booking_hard_to_reach');
    s.booking.push({ system: 'Rezdy', kind: 'system', url: 'https://fixture.rezdy.com/', pageUrl: 'https://fixture.co.nz/tours/', how: 'link', visibleLink: true });
    expect(ids(s)).not.toContain('C16_booking_hard_to_reach');
  });
});

describe('technical checks', () => {
  const lh = (performance: number | null, lcpMs: number | null, runs = 3) => ({ ...healthySite().lighthouse.mobile!, runs: Array.from({ length: 3 }, (_, i) => (i < runs ? { performance, lcpMs, cls: 0, tbtMs: 100 } : { performance: null, lcpMs: null, cls: null, tbtMs: null })), median: { performance, lcpMs, cls: 0, tbtMs: 100 } });

  it('C20 fires on a median score under 50 or a median LCP over 4 seconds', () => {
    const s = healthySite();
    s.lighthouse.mobile = lh(28, 13032);
    expect(one(s, 'C20_slow_mobile').detail).toMatchObject({ performance: 28 });
    s.lighthouse.mobile = lh(62, 4600);
    one(s, 'C20_slow_mobile');
    s.lighthouse.mobile = lh(50, 4000);
    expect(ids(s)).not.toContain('C20_slow_mobile');
    s.lighthouse.mobile = lh(20, 9000, 1);
    expect(ids(s)).not.toContain('C20_slow_mobile');
  });

  it('C23 fires on sideways scroll, a missing viewport setting or tiny text', () => {
    const wide = healthySite();
    wide.homepage.mobile!.layout = { ...wide.homepage.mobile!.layout, horizontalScroll: true, scrollWidth: 700, wide: [{ selector: 'table', box: { x: 0, y: 900, w: 700, h: 200 }, right: 700 }] };
    expect(one(wide, 'C23_not_mobile_friendly').evidence[0]!.selector).toBe('table');
    const noMeta = healthySite();
    noMeta.homepage.mobile!.meta.viewport = null;
    one(noMeta, 'C23_not_mobile_friendly');
    const tiny = healthySite();
    for (const b of tiny.homepage.mobile!.blocks) b.fontSize = 10;
    one(tiny, 'C23_not_mobile_friendly');
  });

  it('C31 fires without business structured data, and not when extraction failed', () => {
    const s = healthySite({ structuredData: { types: ['WebSite'], hasLocalBusinessFamily: false, items: 1, errors: [] } });
    one(s, 'C31_no_structured_data');
    s.structuredData!.errors.push({ message: 'x', severity: 'ERROR', type: 'extractor' });
    expect(ids(s)).not.toContain('C31_no_structured_data');
  });

  it('C33 fires when robots.txt turns a search or AI reader away from key pages', () => {
    const s = healthySite();
    s.robots.botBlocks[2] = { bot: 'OAI-SearchBot', ownGroup: true, blocked: ['https://fixture.co.nz/'] };
    const f = one(s, 'C33_robots_blocks_search_or_ai');
    expect(f.title).toContain('OAI-SearchBot');
    expect(f.pageUrl).toBe('https://fixture.co.nz/robots.txt');
  });

  it('C40 fires on http, a bad certificate or mixed content', () => {
    one(healthySite({ https: { homepageScheme: 'http', certError: false, httpUpgrades: null } }), 'C40_insecure_connection');
    one(healthySite({ https: { homepageScheme: 'https', certError: true, httpUpgrades: null } }), 'C40_insecure_connection');
    const mixed = healthySite();
    mixed.homepage.mobile!.mixedContent.push('http://cdn.example/x.js');
    one(mixed, 'C40_insecure_connection');
  });

  it('C41 fires for software past end of life', () => {
    const s = healthySite({ eol: [{ product: 'PHP', version: '7.4.33', eolDate: '2022-11-28', sourceUrl: 'https://endoflife.date/php', detectedFrom: 'X-Powered-By header' }] });
    expect(one(s, 'C41_outdated_platform').detail).toMatchObject({ product: 'PHP', sourceUrl: 'https://endoflife.date/php' });
  });

  it('C50 fires on serious axe violations and merges two runs by rule', () => {
    const v = (id: string) => ({ id, impact: 'serious' as const, help: `${id} help`, helpUrl: '', nodeCount: 2, nodes: [{ target: 'a.x', html: '<a class="x"></a>', box: { x: 10, y: 10, w: 50, h: 20 }, summary: '' }] });
    const a = healthySite({ axe: { mobile: [v('link-name'), v('color-contrast')], desktop: [] } });
    const b = healthySite({ axe: { mobile: [v('color-contrast'), v('image-alt')], desktop: [] } });
    const fa = one(a, 'C50_accessibility_failures');
    const fb = one(b, 'C50_accessibility_failures');
    const merge = checksFor('core').find((c) => c.id === 'C50_accessibility_failures')!.merge!;
    expect((merge(fa.detail, fb.detail)!.rules as { id: string }[]).map((r) => r.id)).toEqual(['color-contrast']);
    expect(merge(fa.detail, { rules: [{ id: 'label' }] })).toBeNull();
  });
});

describe('cross-source checks', () => {
  const listing = (patch: Partial<SiteData['listings'][number]> = {}): SiteData['listings'][number] => ({ url: 'https://www.newzealand.com/nz/plan/business/harbour-fixture-charters/', platform: 'newzealand.com', kind: 'directory', status: 'fetched', name: 'Harbour Fixture Charters', phones: ['+64 9 402 8105'], emails: ['hello@fixture.co.nz'], prices: [{ amount: 450, text: '$450', context: 'Half day $450' }], rating: null, reviewCount: null, ...patch });

  it('C37 fires only when no AI answer to any question names the business and the answers name others', () => {
    const others = [{ name: 'Rival One', answers: 5 }, { name: 'Rival Two', answers: 3 }, { name: 'Minor', answers: 1 }];
    const sample = { provider: 'openai', askedAt: '2026-10-10T20:00:00Z', answer: 'Rival One and Rival Two', citations: ['https://rival.one/'] };
    const question = (q: string, namedIn = 0, answers = 6) => ({ question: q, answers, namedIn, others, sample, holdsInBothPasses: true });
    const ai: AiSummary = { questions: 6, namedIn: 0, others, sample: { question: 'Q', ...sample }, asked: [question('Q'), question('Q2')], lastAskedAt: '2026-10-10T21:30:00Z', spanMinutes: 95, holdsInBothPasses: true };
    const f = one(healthySite(), 'C37_not_named_by_ai', ai);
    expect(f.title).toBe('Named in 0 of 12 AI answers');
    expect(f.evidence).toHaveLength(2);
    expect(f.evidence[0]).toMatchObject({ kind: 'ai' });
    expect(f.evidence[0]!.excerpt).toContain('Question: Q');
    expect(f.evidence[0]!.excerpt).toContain('Named in 0 of 6 answers');
    expect(f.detail).toMatchObject({ reproducedAcrossPasses: true, spanMinutes: 95, questions: 12, asked: ['Q', 'Q2'] });
    expect((f.detail.othersNamed as { name: string; answers: number }[])[0]).toEqual({ name: 'Rival One', answers: 10 });
    // Named even once, on either question, is not a finding.
    expect(ids(healthySite(), { ...ai, asked: [question('Q'), question('Q2', 1)] })).not.toContain('C37_not_named_by_ai');
    // A question still short of its answers is no ground for a finding.
    expect(ids(healthySite(), { ...ai, asked: [question('Q'), question('Q2', 0, 2)] })).not.toContain('C37_not_named_by_ai');
    const few = [{ name: 'Rival One', answers: 5 }];
    expect(ids(healthySite(), { ...ai, asked: [{ ...question('Q'), others: few }] })).not.toContain('C37_not_named_by_ai');
    expect(ids(healthySite())).not.toContain('C37_not_named_by_ai');
  });

  it('C38 fires only when a matching directory listing shares no phone or email with the site', () => {
    expect(ids(healthySite({ listings: [listing()] }))).not.toContain('C38_inconsistent_contact_details');
    const f = one(healthySite({ listings: [listing({ phones: ['07 362 8185'], emails: ['sales@fixture.co.nz'] })] }), 'C38_inconsistent_contact_details');
    expect((f.detail.differences as { field: string }[]).map((d) => d.field)).toEqual(['phone', 'email']);
    expect(ids(healthySite({ listings: [listing({ phones: ['07 362 8185'], name: 'Somebody Else Tours' })] }))).not.toContain('C38_inconsistent_contact_details');
    expect(ids(healthySite({ listings: [listing({ phones: ['07 362 8185'], kind: 'booking_platform' })] }))).not.toContain('C38_inconsistent_contact_details');
  });

  it('C61 fires when no price on the listing matches any price on the site', () => {
    expect(ids(healthySite({ listings: [listing()] }))).not.toContain('C61_price_differs_from_listing');
    const f = one(healthySite({ listings: [listing({ prices: [{ amount: 495, text: '$495', context: 'Half day $495' }] })] }), 'C61_price_differs_from_listing');
    expect(f.detail.pairingConfirmed).toBe(false);
  });

  it('C70 fires on strong reviews elsewhere with none shown on the site', () => {
    const quiet = editHomes(healthySite(), (p) => {
      p.blocks.splice(3, 1);
      p.blocks[1] = block(p.blocks[1]!.text.replace('Read what our guests say in their reviews below. ', ''));
    });
    expect(one(quiet, 'C70_reviews_not_shown').detail.sources).toEqual([{ source: 'Google', rating: 4.8, count: 67 }]);
    quiet.business.googleReviewCount = 12;
    expect(ids(quiet)).not.toContain('C70_reviews_not_shown');
    expect(ids(healthySite())).not.toContain('C70_reviews_not_shown');
  });
});

describe('tourism pack', () => {
  const noBooking = () => {
    const s = editHomes(healthySite(), (p) => (p.links = p.links.filter((l) => !l.href.includes('rezdy'))));
    s.inner[0]!.links = [link('https://fixture.co.nz/contact/', 'Book now')];
    s.booking = [];
    return s;
  };

  it('T01 fires when no booking system or other way to book is found', () => {
    const f = one(noBooking(), 'T01_no_online_booking');
    expect((f.detail.bookingWordedLinks as string[])[0]).toContain('/contact');
    expect(ids(healthySite())).not.toContain('T01_no_online_booking');
  });

  it('T01 stays quiet when a booking button goes to an unknown outside site or a shop is present', () => {
    const s = noBooking();
    s.inner[0]!.links = [link('https://bookings.unknown-system.example/fixture', 'Book now')];
    expect(ids(s)).not.toContain('T01_no_online_booking');
    const shop = noBooking();
    shop.technologies.push({ name: 'WooCommerce', version: null, categories: ['Ecommerce'] });
    expect(ids(shop)).not.toContain('T01_no_online_booking');
  });

  it('T02 fires when a live storefront is not linked from the site', () => {
    const s = noBooking();
    s.listings = [{ url: 'https://fixture.rezdy.com/', platform: 'Rezdy', kind: 'booking_system', status: 'fetched', name: 'Fixture Reservations', phones: [], emails: [], prices: [], rating: null, reviewCount: null }];
    expect(one(s, 'T02_booking_system_not_linked').detail).toMatchObject({ platform: 'Rezdy' });
    s.listings[0]!.status = 'robots';
    expect(ids(s)).not.toContain('T02_booking_system_not_linked');
    const linked = healthySite({ listings: [{ ...s.listings[0]!, status: 'fetched' }] });
    expect(ids(linked)).not.toContain('T02_booking_system_not_linked');
  });

  it('T03 fires when platforms sell the business and the site cannot', () => {
    const s = noBooking();
    s.listings = [{ url: 'https://fishingbooker.com/charters/view/1', platform: 'FishingBooker', kind: 'booking_platform', status: 'robots', name: null, phones: [], emails: [], prices: [], rating: null, reviewCount: null }];
    expect(one(s, 'T03_platform_dependency').title).toContain('FishingBooker');
    expect(ids(healthySite({ listings: s.listings }))).not.toContain('T03_platform_dependency');
  });

  it('T05 fires when no season, days or times are given anywhere', () => {
    const s = editHomes(healthySite(), (p) => {
      p.blocks.splice(1, 1, block('We take small groups out on the harbour. '.repeat(40)));
      p.blocks.splice(3, 1);
    });
    s.inner[0]!.blocks = [block('Tours'), block('Half day charter $450.')];
    one(s, 'T05_season_info_missing');
    expect(ids(healthySite())).not.toContain('T05_season_info_missing');
  });
});

describe('robustness', () => {
  it('reports nothing about a site whose homepage robots.txt blocks, except what robots.txt itself shows', () => {
    const s = healthySite({ blocked: 'robots_blocks_homepage', homepage: { mobile: null, desktop: null }, inner: [] });
    s.robots.blocksHomepage = true;
    expect(run(s).errors).toEqual([]);
    expect(ids(s)).toEqual([]);
  });

  it('keeps going when one check throws', () => {
    const s = healthySite();
    (s as { links: unknown }).links = null;
    const r = run(s);
    expect(r.errors.some((e) => e.startsWith('C1'))).toBe(true);
    expect(Array.isArray(r.findings)).toBe(true);
  });

  it('gives every finding a title, a fingerprint and evidence', () => {
    const s = editHomes(healthySite(), (p) => p.blocks.splice(1, 0, block('Lorem ipsum'), block('© 2015 Fixture'), page('x', []).blocks[0] ?? block('Notice: closed from 3 March 2021')));
    for (const f of run(s).findings) {
      expect(f.title.length).toBeGreaterThan(5);
      expect(f.fingerprint.length).toBeGreaterThan(0);
      expect(f.evidence.length).toBeGreaterThan(0);
      expect(f.evidence.every((e) => e.excerpt.length > 0)).toBe(true);
    }
  });
});
