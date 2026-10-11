import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { paths } from '@plumbline/core';
import type { Polite } from '@plumbline/fetch';
import type { PageCapture } from '@plumbline/render';
import type { StructuredData } from './types.ts';

const require = createRequire(import.meta.url);

const SCHEMA_URL = 'https://schema.org/version/latest/schemaorg-all-https.jsonld';

interface SchemaGraph {
  '@graph': { '@id': string; '@type'?: string | string[]; 'rdfs:subClassOf'?: { '@id': string } | { '@id': string }[] }[];
}

let schema: SchemaGraph | null | undefined;
let family: Set<string> | undefined;

async function loadSchema(): Promise<SchemaGraph | null> {
  if (schema !== undefined) return schema;
  const file = join(paths.cache, 'schemaorg-all-https.jsonld');
  try {
    if (!existsSync(file)) {
      const res = await fetch(SCHEMA_URL, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`schema.org returned ${res.status}`);
      mkdirSync(paths.cache, { recursive: true });
      writeFileSync(file, await res.text());
    }
    schema = JSON.parse(readFileSync(file, 'utf8')) as SchemaGraph;
  } catch {
    schema = null;
  }
  return schema;
}

/** Fallback when the schema.org vocabulary cannot be downloaded. */
const FAMILY_FALLBACK = ['Organization', 'LocalBusiness', 'Place', 'TouristAttraction', 'TravelAgency', 'LodgingBusiness', 'SportsActivityLocation', 'FoodEstablishment', 'Restaurant', 'Winery', 'Store', 'TouristInformationCenter', 'EntertainmentBusiness', 'Corporation', 'Hotel', 'Campground', 'BedAndBreakfast', 'TouristDestination', 'LandmarksOrHistoricalBuildings', 'Brewery', 'CafeOrCoffeeShop', 'AmusementPark', 'GolfCourse', 'SkiResort', 'Museum', 'Zoo', 'Aquarium', 'Park'];

/** Organization and Place with everything beneath them, which is where LocalBusiness and its kin sit. */
async function businessFamily(): Promise<Set<string>> {
  if (family) return family;
  const s = await loadSchema();
  const out = new Set<string>(FAMILY_FALLBACK);
  if (s) {
    const children = new Map<string, string[]>();
    for (const node of s['@graph']) {
      const parents = node['rdfs:subClassOf'];
      for (const p of parents ? (Array.isArray(parents) ? parents : [parents]) : []) {
        const key = p['@id'].replace('schema:', '');
        children.set(key, [...(children.get(key) ?? []), node['@id'].replace('schema:', '')]);
      }
    }
    const queue = ['Organization', 'Place'];
    while (queue.length) {
      const t = queue.pop()!;
      if (out.has(t) && !['Organization', 'Place'].includes(t) && !FAMILY_FALLBACK.includes(t)) continue;
      out.add(t);
      for (const c of children.get(t) ?? []) if (!out.has(c) || FAMILY_FALLBACK.includes(c)) queue.push(c);
      children.delete(t);
    }
  }
  family = out;
  return out;
}

function typesOf(node: unknown, out: Set<string>, depth = 0): void {
  if (!node || typeof node !== 'object' || depth > 6) return;
  if (Array.isArray(node)) {
    for (const n of node) typesOf(n, out, depth + 1);
    return;
  }
  const o = node as Record<string, unknown>;
  const t = o['@type'];
  for (const name of Array.isArray(t) ? t : t ? [t] : []) {
    if (typeof name === 'string') out.add(name.replace(/^https?:\/\/schema\.org\//, '').replace(/^schema:/, ''));
  }
  for (const v of Object.values(o)) typesOf(v, out, depth + 1);
}

interface Extracted {
  jsonld?: Record<string, unknown[]>;
  microdata?: Record<string, unknown[]>;
  rdfa?: Record<string, unknown[]>;
}

/** Structured data on one page: the types present, and what the validator makes of them. */
export async function structuredData(page: PageCapture, html: string): Promise<StructuredData> {
  const types = new Set<string>();
  let extracted: Extracted = {};
  const errors: StructuredData['errors'] = [];
  try {
    const mod = require('@marbec/web-auto-extractor') as { default?: new (o: object) => { parse(html: string): Extracted } } & (new (o: object) => { parse(html: string): Extracted });
    const Extractor = mod.default ?? mod;
    extracted = new Extractor({ addLocation: true, embedSource: ['rdfa', 'microdata'] }).parse(html);
  } catch (e) {
    errors.push({ message: `extraction failed: ${(e as Error).message.slice(0, 120)}`, severity: 'ERROR', type: 'extractor' });
  }

  for (const group of [extracted.jsonld, extracted.microdata, extracted.rdfa]) {
    for (const [type, items] of Object.entries(group ?? {})) {
      if (type && type !== 'undefined') types.add(type.replace(/^https?:\/\/schema\.org\//, ''));
      typesOf(items, types);
    }
  }
  // Read the JSON-LD blocks directly as well, so a block the extractor skips still counts.
  for (const raw of page.meta.jsonld) {
    try {
      typesOf(JSON.parse(raw), types);
    } catch {
      errors.push({ message: 'A JSON-LD block is not valid JSON', severity: 'ERROR', type: 'jsonld' });
    }
  }

  const s = await loadSchema();
  if (s && types.size) {
    try {
      const { Validator } = await import('@adobe/structured-data-validator');
      for (const issue of (await new Validator(s).validate(extracted)).slice(0, 40)) {
        errors.push({ message: issue.issueMessage, severity: issue.severity, type: issue.path?.[0]?.type ?? '' });
      }
    } catch (e) {
      errors.push({ message: `validation failed: ${(e as Error).message.slice(0, 120)}`, severity: 'WARNING', type: 'validator' });
    }
  }

  const fam = await businessFamily();
  const list = [...types].sort();
  return { types: list, hasLocalBusinessFamily: list.some((t) => fam.has(t)), items: list.length, errors };
}

export async function findSitemap(polite: Polite, homepageUrl: string, declared: string[]): Promise<{ found: boolean; url: string | null; urls: number }> {
  const origin = new URL(homepageUrl).origin;
  for (const url of [...declared.slice(0, 2), `${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`]) {
    const res = await polite.get(url, { accept: 'application/xml,text/xml,*/*', maxBytes: 2_000_000, timeoutMs: 20_000 });
    if (res.status === 200 && /<(urlset|sitemapindex)[\s>]/i.test(res.body)) {
      return { found: true, url: res.finalUrl, urls: (res.body.match(/<loc>/gi) ?? []).length };
    }
  }
  return { found: false, url: null, urls: 0 };
}

export interface SearchFacts {
  title: string;
  titleLength: number;
  description: string | null;
  canonical: string | null;
  h1Count: number;
  noindex: boolean;
  openGraph: boolean;
  imagesVisible: number;
  imagesWithAlt: number;
  altCoverage: number | null;
}

export function searchFacts(page: PageCapture): SearchFacts {
  const visible = page.images.filter((i) => i.visible && i.width >= 40 && i.height >= 40);
  const withAlt = visible.filter((i) => (i.alt ?? '').trim().length > 0);
  const robots = `${page.meta.robots ?? ''} ${page.headers['x-robots-tag'] ?? ''}`.toLowerCase();
  return {
    title: page.meta.title,
    titleLength: page.meta.title.length,
    description: page.meta.description,
    canonical: page.meta.canonical,
    h1Count: page.meta.h1Total,
    noindex: /\bnoindex\b/.test(robots),
    openGraph: Object.keys(page.meta.og).length > 0,
    imagesVisible: visible.length,
    imagesWithAlt: withAlt.length,
    altCoverage: visible.length ? withAlt.length / visible.length : null,
  };
}
