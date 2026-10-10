import { copyFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { paths } from '@plumbline/core';
import { CHECK_IDS } from '@plumbline/checks/ids';
import { loadLibrary, loadLibraryRaw, setVerified, validateLibrary } from './index.ts';

const good = {
  check: 'X01',
  severity: 3,
  impact: 'Visitors cannot find a price.',
  basis: 'BENCHMARK',
  sources: [{ publisher: 'P', year: 2025, url: 'https://example.com/a', quote: 'q', verified_by_ud: false }],
  fix: 'Prices are shown.',
};
const check = (patch: Record<string, unknown>, ids = ['X01']) => validateLibrary({ entries: [{ ...good, ...patch }] }, ids);

describe('impact library validator', () => {
  it('accepts the shipped library for the full check list', () => {
    expect(validateLibrary(loadLibraryRaw(), CHECK_IDS)).toEqual([]);
    expect(loadLibrary(CHECK_IDS).size).toBe(CHECK_IDS.length);
  });

  it('accepts a well formed entry', () => {
    expect(check({})).toEqual([]);
  });

  it('fails on a missing field', () => {
    expect(check({ fix: undefined })).toContain('X01: missing field fix');
    expect(check({ severity: undefined })).toContain('X01: missing field severity');
  });

  it('fails on impact or fix over 35 words', () => {
    const long = Array.from({ length: 36 }, () => 'word').join(' ');
    expect(check({ impact: long })[0]).toMatch(/impact has 36 words/);
    expect(check({ fix: long })[0]).toMatch(/fix has 36 words/);
    expect(check({ fix: Array.from({ length: 35 }, () => 'word').join(' ') })).toEqual([]);
  });

  it('fails on any dash in impact or fix', () => {
    expect(check({ impact: 'A well-known problem.' })[0]).toMatch(/impact contains a dash/);
    expect(check({ fix: 'Fixed — for good.' })[0]).toMatch(/fix contains a dash/);
    expect(check({ fix: 'Fixed – for good.' })[0]).toMatch(/fix contains a dash/);
  });

  it('fails on a banned word', () => {
    expect(check({ impact: 'We Leverage your site.' })[0]).toMatch(/banned word "leverage"/);
    expect(check({ fix: 'Our solutions help.' })[0]).toMatch(/banned word "solutions"/);
    expect(check({ fix: 'This transforms the page.' })[0]).toMatch(/banned word "transform"/);
  });

  it('fails on a BENCHMARK without URL, year and quote', () => {
    expect(check({ sources: [] })).toContain('X01: BENCHMARK without a source');
    expect(check({ sources: [{ ...good.sources[0], url: '' }] })[0]).toMatch(/has no URL/);
    expect(check({ sources: [{ ...good.sources[0], year: undefined }] })[0]).toMatch(/has no year/);
    expect(check({ sources: [{ ...good.sources[0], quote: ' ' }] })[0]).toMatch(/has no quote/);
    expect(check({ basis: 'OUR_VIEW', sources: [] })).toEqual([]);
  });

  it('fails on a check without an entry', () => {
    expect(check({}, ['X01', 'X02'])).toContain('X02: check has no library entry');
  });

  it('keeps the library byte for byte equal to the supplied input apart from verified flags', () => {
    const dir = mkdtempSync(join(tmpdir(), 'plumbline-lib-'));
    const copy = join(dir, 'library.yaml');
    copyFileSync(paths.library, copy);
    setVerified('C20_slow_mobile', 1, true, copy);
    const before = readFileSync(paths.library, 'utf8').split('\n');
    const after = readFileSync(copy, 'utf8').split('\n');
    const changed = before.map((l, i) => [l, after[i]]).filter(([a, b]) => a !== b);
    expect(after.length).toBe(before.length);
    expect(changed).toEqual([['        verified_by_ud: false', '        verified_by_ud: true']]);
  });
});
