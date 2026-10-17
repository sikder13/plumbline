import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from '@plumbline/core';
import { contrastRatio, fromOklch, paletteChecks, paletteFrom } from './colour.ts';
import { cropAround, heroFor } from './photos.ts';
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
    look: { hero: 'type', type: 'bitter-hanken', family: 'ocean' },
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
