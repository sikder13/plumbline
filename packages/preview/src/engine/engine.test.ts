import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from '@plumbline/core';
import { contrastRatio, fromOklch, paletteChecks, paletteFrom } from './colour.ts';
import { cropAround, cropInside, heroFor, keptBox } from './photos.ts';
import { measuredOn, packCards, seenOf, type FactPack, type PackFinding } from './page.ts';
import { OWN_VISIT } from '../gates.ts';
import { ENGINES, EngineConfig } from './schema.ts';
import { EARLIER_TYPE_PAIRS, pairIssues } from './variety.ts';

describe('type pairs', () => {
  it('no engine pair is an earlier page’s pair, and no two engines share one', () => {
    expect(pairIssues()).toEqual([]);
  });

  it('the earlier pairs include every design made to order in the repository', () => {
    const dir = join(ROOT, 'apps', 'previews', 'designs');
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.tsx'))) {
      const m = /designStyles\('([a-z]+)', \['([^']+)', '([^']+)'/.exec(readFileSync(join(dir, f), 'utf8'));
      if (!m) continue;
      expect(EARLIER_TYPE_PAIRS.find((p) => p.by === m[1]), `${m[1]} is missing`).toMatchObject({ display: m[2], text: m[3] });
    }
  });
});

describe('palettes', () => {
  it('every pair of words and ground passes AA, whatever colours the logo has', () => {
    const hues = [0, 25, 60, 95, 140, 190, 230, 280, 330];
    for (const engine of ENGINES)
      for (const h of hues)
        for (const [l, c] of [
          [0.3, 0.05],
          [0.55, 0.18],
          [0.8, 0.12],
          [0.9, 0.02],
        ] as const) {
          const p = paletteFrom(engine, [{ hex: fromOklch({ l, c, h }), share: 0.4, from: 'logo' }]);
          for (const check of paletteChecks(p)) expect(check.ok, `${engine} h${h} l${l}: ${check.pair} ${check.ratio}`).toBe(true);
        }
  });

  it('measures contrast as WCAG does', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
  });
});

describe('the hero the photos allow', () => {
  it('makes a photo hero the default for any sharp photo 1200 px wide or more', () => {
    expect(heroFor('type', { width: 2400, height: 1600, score: 900 }).kind).toBe('photo');
    expect(heroFor('photo', { width: 1920, height: 1440, score: 900 }).kind).toBe('photo');
  });

  it('frames a photo between 1200 and 1800 px wide, or a wide shallow one, in the split hero', () => {
    expect(heroFor('photo', { width: 1600, height: 1200, score: 500 }).kind).toBe('split');
    expect(heroFor('photo', { width: 1280, height: 720, score: 400 }).kind).toBe('split');
    expect(heroFor('photo', { width: 1900, height: 700, score: 2500 }).kind).toBe('split');
  });

  it('opens on words alone below 1200 px, without a photo, or with a soft one however large', () => {
    expect(heroFor('photo', { width: 1023, height: 522, score: 900 }).kind).toBe('type');
    expect(heroFor('photo', null).kind).toBe('type');
    expect(heroFor('photo', { width: 4000, height: 2667, score: 120 }).kind).toBe('type');
  });
});

describe('crops', () => {
  it('stay inside the photo and keep their shape', () => {
    for (const [w, h] of [
      [4000, 2667],
      [1900, 700],
      [800, 550],
      [1080, 1920],
    ] as const)
      for (const ratio of [16 / 9, 2 / 3, 3 / 2, 4 / 5])
        for (const focus of [
          [0, 0],
          [0.5, 0.5],
          [1, 1],
        ] as [number, number][]) {
          const c = cropAround(w, h, ratio, focus);
          expect(c.left).toBeGreaterThanOrEqual(0);
          expect(c.top).toBeGreaterThanOrEqual(0);
          expect(c.left + c.width).toBeLessThanOrEqual(w);
          expect(c.top + c.height).toBeLessThanOrEqual(h);
          expect(Math.abs(c.width / c.height - ratio)).toBeLessThan(0.02);
        }
  });
});

describe('settings', () => {
  const U = 'https://example.co.nz/';
  const base = {
    engine: 'fishing',
    slug: 'a-charter',
    name: 'A Charter',
    domain: 'example.co.nz',
    place: { town: 'Town', source: U },
    concept: 'A day out on the water',
    look: { hero: 'type', type: 'bigshoulders-hanken', family: 'ocean' },
    palette: { family: 'ocean', paper: '#ffffff', ink: '#111111', soft: '#eeeeee', deep: '#000022', onDeep: '#ffffff', accent: '#0044aa', onAccent: '#ffffff', accentInk: '#0044aa' },
    contact: { phone: { display: '021 000 000', tel: 'tel:+6421000000', source: U } },
    hero: { lines: ['Out'], source: U },
    close: { heading: 'Book' },
  };

  it('takes a page with only what is required', () => {
    expect(EngineConfig.safeParse(base).success).toBe(true);
  });

  it('turns down a type pair or a signature of another engine', () => {
    expect(EngineConfig.safeParse({ ...base, look: { ...base.look, type: 'cormorant-manrope' } }).success).toBe(false);
    expect(EngineConfig.safeParse({ ...base, signature: { kind: 'acc', heading: 'ACC', points: [{ title: 'a', text: 'b', source: U }, { title: 'c', text: 'd', source: U }] } }).success).toBe(false);
  });

  it('turns down a page with no way to book, and a photo used twice', () => {
    expect(EngineConfig.safeParse({ ...base, contact: {} }).success).toBe(false);
    const photos = [{ id: 'a', file: 'photos/a.jpg', alt: 'A', source: U }];
    expect(EngineConfig.safeParse({ ...base, photos, hero: { ...base.hero, photo: 'a' }, gallery: ['a'] }).success).toBe(false);
  });
});

describe('kept part of a photo', () => {
  it('keeps every crop inside the box, so a door frame at the edge never comes in', () => {
    const box = keptBox(4000, 2667, [0.35, 0, 0.8, 1]);
    expect(box).toEqual({ left: 1400, top: 0, width: 1800, height: 2667 });
    for (const ratio of [16 / 9, 4 / 5, 4 / 3])
      for (const focus of [[0, 0], [0.5, 0.42], [1, 1]] as [number, number][]) {
        const c = cropInside(box, ratio, focus, 4000, 2667);
        expect(c.left).toBeGreaterThanOrEqual(box.left);
        expect(c.left + c.width).toBeLessThanOrEqual(box.left + box.width);
        expect(c.top + c.height).toBeLessThanOrEqual(box.height);
      }
  });

  it('is the whole photo when nothing is kept', () => {
    expect(keptBox(1200, 800)).toEqual({ left: 0, top: 0, width: 1200, height: 800 });
    expect(cropInside(keptBox(1200, 800), 3 / 2, [0.5, 0.5], 1200, 800)).toEqual(cropAround(1200, 800, 3 / 2, [0.5, 0.5]));
  });
});

describe('findings from a fact pack', () => {
  const f = (over: Partial<PackFinding>): PackFinding => ({ place: 1, tier: 1, type: 'broken_link', sentence: 'A link on your homepage opens a page that is not found.', measured: '"Trips" on https://x.co.nz/ goes to https://x.co.nz/old, which answers 404', evidence_url: 'https://x.co.nz/old', linked_from: 'https://x.co.nz/', measured_at: '2026-10-17T03:55:03.921Z', source: 'plumbline', on_main_page: true, ...over });
  const pack = (findings: PackFinding[]): FactPack => ({ slug: 'x', name: 'X', website: 'https://www.x.co.nz', category: 'fishing', to: { address: 'a@x.co.nz', source_url: 'https://x.co.nz/contact' }, greeting: 'A', greeting_names: ['A'], findings, flags: { facts_changed: [], faith: [], security_review: [], refuses_unsolicited: null, speed: null }, recommendation: 'BUILD' });
  const library = new Map([
    ['C12_broken_internal_links', { check: 'C12_broken_internal_links', severity: 3, impact: 'Links that end in an error page stop visitors.', basis: 'OUR_VIEW' as const, sources: [], fix: 'All links are checked.' }],
    ['C16_booking_hard_to_reach', { check: 'C16_booking_hard_to_reach', severity: 3, impact: 'It takes several steps to book.', basis: 'OUR_VIEW' as const, sources: [], fix: 'Booking opens in one tap.' }],
  ]);

  it('says what was seen without the second tool’s note, without dashes, and never quotes a testimonial', () => {
    expect(seenOf(f({ measured: 'The page answers 404 (not found). Caution from Crawlmouse: Linked from https://x.co.nz/a.' }))).toBe('The page answers 404 (not found).');
    expect(seenOf(f({ measured: 'The page loads, with the title "demo page - Welcome"' }))).toBe('The page loads, with the title "demo page, Welcome"');
    expect(seenOf(f({ type: 'physio_testimonials', measured: 'quote: "Lovely people"' }))).toBeNull();
    expect(seenOf(f({ measured: 'PHP 7.4.33; support ended 2022-11-28' }))).toBe('PHP 7.4.33; support ended 28 November 2022.');
    expect(seenOf(f({ measured: 'At 390 by 844 phone screen no book, call or email action is visible without scrolling' }))).toBe('On a phone screen 390 by 844 pixels, no book, call or email action is visible without scrolling.');
  });

  it('names the page a finding was measured on, never an outside source', () => {
    expect(measuredOn(f({}), 'https://www.x.co.nz')).toBe('https://x.co.nz/');
    expect(measuredOn(f({ linked_from: null, evidence_url: 'https://endoflife.date/php' }), 'https://www.x.co.nz')).toBe('https://www.x.co.nz');
    expect(measuredOn(f({ linked_from: null, type: 'book_button_contact', sentence: 'The "Book" button on your homepage opens your contact page, not a booking page.', evidence_url: 'https://x.co.nz/contact/' }), 'https://www.x.co.nz')).toBe('https://www.x.co.nz');
    expect(measuredOn(f({ linked_from: null, sentence: 'A page titled "demo page" is still live on your website.', evidence_url: 'https://x.co.nz/demo-page' }), 'https://www.x.co.nz')).toBe('https://x.co.nz/demo-page');
  });

  it('keeps the pack’s order and words, at most three, with the fix and only an impact that holds', async () => {
    const cards = await packCards(pack([f({ place: 2, type: 'booking_page_unlinked', sentence: 'Your book page is live, but nothing on your site links to it.' }), f({}), f({ place: 3, type: 'no_heading' }), f({ place: 4 })]), library, async () => null);
    expect(cards.map((c) => c.check)).toEqual(['broken_link-1', 'booking_page_unlinked-2', 'no_heading-3']);
    expect(cards[0]).toMatchObject({ sentence: 'Links that end in an error page stop visitors.', fix: 'All links are checked.', measuredNz: '17 October 2026, 4:55 pm' });
    expect(cards[1]).toMatchObject({ sentence: '', fix: '' });
    expect(cards[2]).toMatchObject({ sentence: '', fix: '' });
  });

  it('speaks of their booking system only where they have one', async () => {
    const one = [f({ type: 'booking_page_unlinked' })];
    expect((await packCards(pack(one), library, async () => null, { bookingSystem: true }))[0]!.fix).toBe('Booking opens in one tap.');
    expect((await packCards(pack(one), library, async () => null, { bookingSystem: false }))[0]!.fix).toBe('');
  });
});

describe('own visits', () => {
  it('the checks mark a browser with the same flag the pages read', () => {
    const offer = readFileSync(join(ROOT, 'apps', 'previews', 'lib', 'offer.ts'), 'utf8');
    expect(offer).toContain(`OWN_VISITS = { param: '${OWN_VISIT.param}', key: '${OWN_VISIT.key}' }`);
  });
});
