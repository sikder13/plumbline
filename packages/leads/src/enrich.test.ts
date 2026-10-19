import { describe, expect, it } from 'vitest';
import { bestMatch, bucketOf, leadScore, pickTen, type Details, type SearchPlace } from './enrich.ts';

const inIndiana = (name: string, extra: Partial<SearchPlace> = {}): SearchPlace => ({ id: name, displayName: { text: name }, formattedAddress: 'x, Muncie, IN 47305, USA', addressComponents: [{ shortText: 'IN', types: ['administrative_area_level_1'] }], ...extra });

describe('bestMatch', () => {
  it('takes the closest Indiana place and ignores places in other states', () => {
    const ohio = { ...inIndiana('Swan Nail Salon'), addressComponents: [{ shortText: 'OH', types: ['administrative_area_level_1'] }] };
    const m = bestMatch('SWAN NAIL SALON LLC', [ohio, inIndiana('Swan Nails & Spa'), inIndiana('Other Place')]);
    expect(m?.place.displayName?.text).toBe('Swan Nails & Spa');
  });
  it('is null with no Indiana place', () => {
    expect(bestMatch('X LLC', [])).toBeNull();
  });
});

describe('bucketOf', () => {
  it('sorts A to D', () => {
    expect(bucketOf(null, null)).toBe('D');
    expect(bucketOf(0.6, null)).toBe('B');
    expect(bucketOf(0.9, { websiteUri: 'https://x.com', businessStatus: 'OPERATIONAL' } as Details)).toBe('C');
    expect(bucketOf(0.9, { businessStatus: 'OPERATIONAL' } as Details)).toBe('A');
    expect(bucketOf(0.9, { businessStatus: 'CLOSED_TEMPORARILY' } as Details)).toBe('B');
  });
});

describe('leadScore', () => {
  it('lists each point it gives', () => {
    const d = { userRatingCount: 7, regularOpeningHours: { weekdayDescriptions: ['Monday: 9 AM to 5 PM'] }, photos: [{}, {}, {}, {}], nationalPhoneNumber: '(765) 555-0100' } as unknown as Details;
    const s = leadScore(d, { ownerIsAgent: true, group: 'food', created: '2026-09-28' }, new Date('2026-10-19T12:00:00Z'));
    expect(s.score).toBe(7);
    expect(s.points).toHaveLength(7);
    const none = leadScore({ userRatingCount: 40 } as Details, { ownerIsAgent: false, group: 'auto', created: '2026-08-01' }, new Date('2026-10-19T12:00:00Z'));
    expect(none.score).toBe(0);
  });
});

describe('pickTen', () => {
  const lead = (slug: string, group: string, score: number, created = '2026-09-20') => ({ slug, group, score, created });
  it('keeps to four food and three of any other group, newest first on ties', () => {
    const list = [
      ...['f1', 'f2', 'f3', 'f4', 'f5', 'f6'].map((s) => lead(s, 'food', 6)),
      ...['b1', 'b2', 'b3', 'b4'].map((s) => lead(s, 'beauty', 5)),
      lead('t1', 'trades', 5, '2026-09-29'),
      lead('t2', 'trades', 4),
      lead('t3', 'trades', 4),
      lead('t4', 'trades', 4),
    ];
    const { picked, alternates } = pickTen(list);
    expect(picked.filter((l) => l.group === 'food')).toHaveLength(4);
    expect(picked.filter((l) => l.group === 'beauty')).toHaveLength(3);
    expect(picked.filter((l) => l.group === 'trades')).toHaveLength(3);
    expect(picked).toHaveLength(10);
    expect(alternates.map((l) => l.slug)).toEqual(['f5', 'f6', 'b4', 't4']);
  });
});

describe('parseCsv', () => {
  it('reads quoted fields with commas and doubled quotes', async () => {
    const { parseCsv } = await import('./batch.ts');
    expect(parseCsv('a,b\n"x, y","say ""hi"""\n1,2\n')).toEqual([{ a: 'x, y', b: 'say "hi"' }, { a: '1', b: '2' }]);
  });
});

describe('nameMatch', () => {
  it('needs the distinctive words to agree, not just the trade words', async () => {
    const { nameMatch } = await import('./enrich.ts');
    const generic = new Set(['welding', 'fabrication', 'construction', 'beauty', 'excavating', 'tattoo', 'pizzeria', 'shawarma', 'flooring']);
    expect(nameMatch('AGUIRRES WELDING AND FABRICATION LLC', 'Lozano Welding and Fabrication LLC', generic)).toBeLessThan(0.8);
    expect(nameMatch('KEYTLIN CONSTRUCTION LLC', 'Kelvin Construction, LLC', generic)).toBeLessThan(0.8);
    expect(nameMatch('JFR CONSTRUCTION LLC', 'JRF Construction', generic)).toBeLessThan(0.8);
    expect(nameMatch('ENHANCED BEAUTY BY ZOE LLC', 'Enhanced Beauty by Jessica Lynn, RN', generic)).toBeLessThan(0.8);
    expect(nameMatch('DR SHAWARMA LLC', 'Mr. Shawarma', generic)).toBeLessThan(0.8);
    expect(nameMatch('HAUTE INK TATTOO STUDIO LLC', 'Haute Ink Tattoo Studio', generic)).toBe(1);
    expect(nameMatch('MIA PIZZERIA III LLC', 'Mia Pizzeria', generic)).toBe(1);
    expect(nameMatch('L & R FLOORING LLC', 'L & R FLOORING', generic)).toBe(1);
    expect(nameMatch('PARR EXCAVATING LLC', 'Parr Excavating', generic)).toBe(1);
    expect(nameMatch('TAQUERIA EL GUERRO LLC', 'Taqueria El Guero', new Set(['taqueria']))).toBeGreaterThanOrEqual(0.8);
  });
});

describe('nameMatch, one shared word', () => {
  it('does not take one shared surname as the same business', async () => {
    const { nameMatch } = await import('./enrich.ts');
    const generic = new Set(['remodeling', 'homes', 'renovations', 'builders', 'gyro', 'hot', 'chicken', 'halal', 'eats', 'salon', 'tanning', 'pizzeria']);
    expect(nameMatch('LEGACY HOME REMODELING LLC', 'Legacy Homes by Delagrange', generic)).toBeLessThan(0.8);
    expect(nameMatch('HEARTLAND HILLS RENOVATIONS LLC', 'The Heartland Builders', generic)).toBeLessThan(0.8);
    expect(nameMatch('SALON SOL, LLC', 'Bronze Sol Tanning Salon', generic)).toBeLessThan(0.8);
    expect(nameMatch('MIA PIZZERIA III LLC', 'Mia Pizzeria', generic)).toBe(1);
  });
});

describe('sameAddress', () => {
  it('compares the street number of the filing with the profile', async () => {
    const { sameAddress } = await import('./enrich.ts');
    expect(sameAddress('8336 PAIRIE DR', '8336 Prairie Dr, Indianapolis, IN 46256, USA')).toBe(true);
    expect(sameAddress('11098 N. Spring Lake Drive', '11323 Sarah Ln, Mooresville, IN 46158, USA')).toBe(false);
    expect(sameAddress('2517 RANSDELL ST', 'Indianapolis, IN, USA')).toBe(false);
  });
});

describe('earlierSlugs', () => {
  it('collects the businesses of every other batch so a lead is never picked twice', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const { earlierSlugs } = await import('./batch.ts');
    const dir = mkdtempSync(join(tmpdir(), 'batches-'));
    mkdirSync(join(dir, 'batch-01'));
    writeFileSync(join(dir, 'batch-01', 'LEADS.csv'), 'slug,legal_name\nhaute-ink,X\nl-and-r,Y\n');
    mkdirSync(join(dir, 'batch-02'));
    expect([...earlierSlugs(dir, 'batch-02')].sort()).toEqual(['haute-ink', 'l-and-r']);
    expect([...earlierSlugs(dir, 'batch-01')]).toEqual([]);
  });
});
