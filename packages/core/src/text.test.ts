import { describe, expect, it } from 'vitest';
import { domainOf, median, normalizePhone, sameSite, slugify, wordCount } from './text.ts';
import { nzTime } from './time.ts';

describe('text helpers', () => {
  it('slugifies names with macrons and ampersands', () => {
    expect(slugify('Ōkārito Boat Eco Tours')).toBe('okarito-boat-eco-tours');
    expect(slugify('Taupo Boating & Fishing Charters (MV Solamaar)')).toBe('taupo-boating-and-fishing-charters-mv-solamaar');
  });

  it('finds the registrable domain', () => {
    expect(domainOf('https://www.targetcharters.co.nz/prices')).toBe('targetcharters.co.nz');
    expect(domainOf('coastalkayakers.co.nz')).toBe('coastalkayakers.co.nz');
    expect(domainOf('')).toBeNull();
  });

  it('treats www and bare hosts as the same site', () => {
    expect(sameSite('https://www.example.co.nz/a', 'http://example.co.nz/b')).toBe(true);
    expect(sameSite('https://book.example.co.nz/', 'https://example.co.nz/')).toBe(false);
  });

  it('normalises NZ phone numbers to one form', () => {
    expect(normalizePhone('+64 9 402 8105')).toBe('94028105');
    expect(normalizePhone('09 402 8105')).toBe('94028105');
    expect(normalizePhone('(027) 498-3323')).toBe('274983323');
    expect(normalizePhone('0800 334 661')).toBe('800334661');
  });

  it('counts words and medians', () => {
    expect(wordCount("It's a three-hour trip, $95.")).toBe(5);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it('formats NZ time with the zone name', () => {
    expect(nzTime('2026-10-10T20:15:02Z')).toBe('2026-10-11 09:15:02 NZDT');
    expect(nzTime('2026-06-10T11:00:00Z')).toBe('2026-06-10 23:00:00 NZST');
  });
});
