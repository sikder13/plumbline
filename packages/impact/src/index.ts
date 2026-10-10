import { readFileSync, writeFileSync } from 'node:fs';
import { parse, parseDocument } from 'yaml';
import { paths, wordCount } from '@plumbline/core';

export type Basis = 'BENCHMARK' | 'OBSERVED' | 'OUR_VIEW';

export interface ImpactSource {
  publisher: string;
  year: number;
  url: string;
  quote: string;
  verified_by_ud: boolean;
}

export interface ImpactEntry {
  check: string;
  severity: number;
  impact: string;
  basis: Basis;
  sources: ImpactSource[];
  fix: string;
}

export const MAX_WORDS = 35;
export const BANNED_WORDS = [
  'empower',
  'leverage',
  'unlock',
  'transform',
  'harness',
  'cutting-edge',
  'innovative',
  'world-class',
  'solutions',
  'forward-thinking',
];
const DASHES = /[-‐‑‒–—―−]/;
const BASES: Basis[] = ['BENCHMARK', 'OBSERVED', 'OUR_VIEW'];

export function loadLibraryRaw(file: string = paths.library): unknown {
  return parse(readFileSync(file, 'utf8'));
}

export function validateLibrary(raw: unknown, checkIds: string[]): string[] {
  const errors: string[] = [];
  const entries = (raw as { entries?: unknown })?.entries;
  if (!Array.isArray(entries)) return ['library has no entries list'];

  const seen = new Set<string>();
  for (const [i, e] of entries.entries()) {
    const entry = (e ?? {}) as Record<string, unknown>;
    const id = typeof entry.check === 'string' && entry.check ? entry.check : `entry ${i + 1}`;
    for (const field of ['check', 'severity', 'impact', 'basis', 'sources', 'fix']) {
      const v = entry[field];
      if (v === undefined || v === null || v === '') errors.push(`${id}: missing field ${field}`);
    }
    if (seen.has(id)) errors.push(`${id}: duplicate entry`);
    seen.add(id);

    if (entry.severity !== undefined && !(Number.isInteger(entry.severity) && (entry.severity as number) >= 1 && (entry.severity as number) <= 5)) {
      errors.push(`${id}: severity must be a whole number from 1 to 5`);
    }
    if (entry.basis !== undefined && !BASES.includes(entry.basis as Basis)) errors.push(`${id}: basis must be one of ${BASES.join(', ')}`);

    for (const field of ['impact', 'fix'] as const) {
      const text = entry[field];
      if (typeof text !== 'string' || !text) continue;
      const words = wordCount(text);
      if (words > MAX_WORDS) errors.push(`${id}: ${field} has ${words} words, over ${MAX_WORDS}`);
      if (DASHES.test(text)) errors.push(`${id}: ${field} contains a dash`);
      for (const banned of BANNED_WORDS) {
        if (new RegExp(`\\b${banned.replace('-', '[- ]?')}`, 'i').test(text)) errors.push(`${id}: ${field} uses the banned word "${banned}"`);
      }
    }

    const sources = Array.isArray(entry.sources) ? (entry.sources as Record<string, unknown>[]) : [];
    if (entry.sources !== undefined && !Array.isArray(entry.sources)) errors.push(`${id}: sources must be a list`);
    if (entry.basis === 'BENCHMARK') {
      if (!sources.length) errors.push(`${id}: BENCHMARK without a source`);
      for (const [j, s] of sources.entries()) {
        const label = `${id}: source ${j + 1}`;
        if (typeof s.url !== 'string' || !/^https?:\/\/\S+$/.test(s.url)) errors.push(`${label} has no URL`);
        if (!Number.isInteger(s.year)) errors.push(`${label} has no year`);
        if (typeof s.quote !== 'string' || !s.quote.trim()) errors.push(`${label} has no quote`);
        if (typeof s.verified_by_ud !== 'boolean') errors.push(`${label} has no verified_by_ud flag`);
      }
    }
  }

  for (const id of checkIds) if (!seen.has(id)) errors.push(`${id}: check has no library entry`);
  for (const id of seen) if (!checkIds.includes(id) && !id.startsWith('entry ')) errors.push(`${id}: library entry has no check`);
  return errors;
}

export function loadLibrary(checkIds: string[], file: string = paths.library): Map<string, ImpactEntry> {
  const raw = loadLibraryRaw(file);
  const errors = validateLibrary(raw, checkIds);
  if (errors.length) throw new Error(`impact library is invalid:\n  ${errors.join('\n  ')}`);
  return new Map(((raw as { entries: ImpactEntry[] }).entries).map((e) => [e.check, e]));
}

/** Library entries read without validation against the check list, for display. */
export function readEntries(file: string = paths.library): ImpactEntry[] {
  return ((loadLibraryRaw(file) as { entries?: ImpactEntry[] })?.entries ?? []);
}

export function unverifiedSources(entry: ImpactEntry): ImpactSource[] {
  return entry.basis === 'BENCHMARK' ? entry.sources.filter((s) => !s.verified_by_ud) : [];
}

/** Flips one source's verified flag in place, keeping comments and layout. */
export function setVerified(check: string, sourceIndex: number, verified: boolean, file: string = paths.library): void {
  const doc = parseDocument(readFileSync(file, 'utf8'));
  const entries = doc.get('entries') as { items: unknown[] } | undefined;
  const idx = (doc.toJS() as { entries: ImpactEntry[] }).entries.findIndex((e) => e.check === check);
  if (!entries || idx < 0) throw new Error(`no library entry for ${check}`);
  if (!doc.hasIn(['entries', idx, 'sources', sourceIndex])) throw new Error(`${check} has no source ${sourceIndex + 1}`);
  doc.setIn(['entries', idx, 'sources', sourceIndex, 'verified_by_ud'], verified);
  writeFileSync(file, doc.toString({ lineWidth: 0 }));
}
