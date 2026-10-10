import { createRequire } from 'node:module';
import type { PageCapture } from '@plumbline/render';
import { eolFor } from './eol.ts';
import type { EolHit, Technology } from './types.ts';

const require = createRequire(import.meta.url);

type Wappalyzer = (input: { url: string; html: string; headers: Record<string, string>; statusCode?: number }) => Promise<{ name: string; version?: string; categories?: { name: string }[] }[]>;

let wappalyzer: Wappalyzer | undefined;

/** Fingerprints the homepage. The fingerprint data is GPL licensed and is for internal use only. */
export async function detectTechnologies(page: PageCapture, html: string): Promise<Technology[]> {
  const found = new Map<string, Technology>();
  const add = (name: string, version: string | null, categories: string[]) => {
    const key = name.toLowerCase();
    const prev = found.get(key);
    if (!prev || (!prev.version && version)) found.set(key, { name, version: version || prev?.version || null, categories: categories.length ? categories : (prev?.categories ?? []) });
  };

  try {
    wappalyzer ??= require('simple-wappalyzer') as Wappalyzer;
    for (const t of await wappalyzer({ url: page.finalUrl, html, headers: page.headers, statusCode: page.status ?? 200 })) {
      add(t.name, t.version || null, (t.categories ?? []).map((c) => c.name));
    }
  } catch {
    // Fingerprinting is best effort. The direct readings below still apply.
  }

  for (const g of page.meta.generator) {
    const m = /^([A-Za-z][A-Za-z0-9 .!+-]*?)(?:\s+v?(\d+(?:\.\d+)+))?(?:\s*[;|(-].*)?$/.exec(g.trim());
    if (m) add(m[1]!.trim(), m[2] ?? null, ['CMS']);
  }
  const powered = page.headers['x-powered-by'];
  if (powered) {
    // A distribution suffix means the vendor may still patch it, so only plain versions are kept.
    const php = /^PHP\/(\d+\.\d+\.\d+)$/.exec(powered.trim());
    if (php) add('PHP', php[1]!, ['Programming languages']);
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function eolHits(technologies: Technology[], today: string): EolHit[] {
  const out: EolHit[] = [];
  for (const t of technologies) {
    const e = eolFor(t.name, t.version, today);
    if (e) out.push({ product: e.product, version: t.version!, eolDate: e.eolDate, sourceUrl: e.sourceUrl, detectedFrom: t.name === 'PHP' ? 'X-Powered-By header' : 'generator tag or fingerprint' });
  }
  return out;
}

const BUILDER_CATEGORIES = /^(cms|website builders?|page builders?|ecommerce|blogs|static site generator|landing page builders)$/i;

export function sitePlatform(technologies: Technology[]): Technology | null {
  return technologies.find((t) => t.categories.some((c) => /^(cms|website builders?|ecommerce)$/i.test(c))) ?? technologies.find((t) => t.categories.some((c) => BUILDER_CATEGORIES.test(c))) ?? null;
}
