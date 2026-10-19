import { describe, expect, it } from 'vitest';
import { dropReason, isNewFiling, pickSweep, sweepScore, type SweepPlace } from './sweep.ts';

const franchises = ['great clips', 'dominos', 'the lash lounge', 'jets'];
const place = (over: Partial<SweepPlace> = {}): SweepPlace => ({ id: 'x', displayName: { text: 'Fresh Fade Barbershop' }, businessStatus: 'OPERATIONAL', userRatingCount: 20, primaryType: 'barber_shop', formattedAddress: '1 Main St, Indianapolis, IN 46201, USA', ...over });

describe('dropReason', () => {
  it('keeps an open profile without a website and with 3 to 150 ratings', () => {
    expect(dropReason(place(), franchises)).toBeNull();
  });
  it('drops in the order website, status, rating count, franchise, faith screen', () => {
    expect(dropReason(place({ websiteUri: 'https://x.com', businessStatus: 'CLOSED_PERMANENTLY' }), franchises)).toBe('website');
    expect(dropReason(place({ businessStatus: 'CLOSED_TEMPORARILY' }), franchises)).toBe('status');
    expect(dropReason(place({ userRatingCount: 2 }), franchises)).toBe('rating count');
    expect(dropReason(place({ userRatingCount: 151 }), franchises)).toBe('rating count');
    expect(dropReason(place({ userRatingCount: undefined }), franchises)).toBe('rating count');
    expect(dropReason(place({ displayName: { text: "Domino's Pizza" } }), franchises)).toBe('franchise');
    expect(dropReason(place({ displayName: { text: 'Pizza King #12' } }), franchises)).toBe('franchise');
    expect(dropReason(place({ displayName: { text: 'Hookah Lounge Nails' } }), franchises)).toBe('faith screen');
    expect(dropReason(place({ primaryType: 'bar' }), franchises)).toBe('faith screen');
    expect(dropReason(place({ primaryType: 'liquor_store' }), franchises)).toBe('faith screen');
  });
  it('never catches a barber in "bar" or a smokehouse grill in "smoke" by part of a word', () => {
    expect(dropReason(place({ displayName: { text: 'Barber Bros' } }), franchises)).toBeNull();
    expect(dropReason(place({ displayName: { text: 'Smokehouse Soul Food' }, primaryType: 'restaurant' }), franchises)).toBeNull();
  });
});

describe('sweepScore', () => {
  it('gives one point for each of the eight signals', () => {
    const s = sweepScore({ userRatingCount: 30, rating: 4.6, nationalPhoneNumber: '(317) 555-0100' }, { regularOpeningHours: { weekdayDescriptions: ['Monday: 9 AM'] }, photos: Array(6).fill({}), editorialSummary: { text: 'x' } }, 'beauty', true);
    expect(s.score).toBe(8);
    expect(sweepScore({ userRatingCount: 100, rating: 4.0 }, {}, 'auto_home', false).score).toBe(0);
  });
});

describe('isNewFiling', () => {
  it('needs the distinctive name and the street number to agree', () => {
    const filings = [{ name: 'FRESH FADE BARBERSHOP LLC', address: '1 MAIN ST', created: '2026-09-12' }, { name: 'OTHER LLC', address: '9 ELM ST', created: '2026-09-02' }];
    expect(isNewFiling(place(), filings, new Set(['barbershop']))).toEqual({ created: '2026-09-12' });
    expect(isNewFiling(place({ formattedAddress: '5 Main St, Indianapolis, IN' }), filings, new Set(['barbershop']))).toBeNull();
  });
});

describe('pickSweep', () => {
  const lead = (slug: string, group: string, score: number, count: number) => ({ slug, group, score, count, name: slug });
  it('takes score then rating count, four per group at most, and skips excluded names', () => {
    const list = [lead('b1', 'beauty', 8, 10), lead('b2', 'beauty', 8, 50), lead('b3', 'beauty', 7, 9), lead('b4', 'beauty', 7, 8), lead('b5', 'beauty', 7, 7), lead('f1', 'food', 6, 40), lead('f2', 'food', 6, 30), lead('a1', 'auto_home', 5, 5), lead('a2', 'auto_home', 5, 4), lead('a3', 'auto_home', 4, 3), lead('a4', 'auto_home', 4, 2), lead('x', 'food', 9, 99)];
    const { picked, alternates } = pickSweep(list, new Set(['x']));
    expect(picked.map((l) => l.slug)).toEqual(['b2', 'b1', 'b3', 'b4', 'f1', 'f2', 'a1', 'a2', 'a3', 'a4']);
    expect(alternates.map((l) => l.slug)).toEqual(['b5']);
  });
});
