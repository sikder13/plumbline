import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { domainOf, foldName, paths, slugify, utcIso, type Db } from '@plumbline/core';
import { classifyListing, urlsIn } from '@plumbline/collect';
import { parseCsv } from './csv.ts';

export interface Dossier {
  number: number;
  name: string;
  body: string;
}

export function readDossiers(file: string = join(paths.inputs, 'NZ-FIRST-20-DOSSIERS.md')): Dossier[] {
  const text = readFileSync(file, 'utf8');
  const out: Dossier[] = [];
  const re = /^# (\d{2})\. (.+)$/gm;
  const heads = [...text.matchAll(re)];
  for (const [i, m] of heads.entries()) {
    out.push({ number: Number(m[1]), name: m[2]!.trim(), body: text.slice(m.index! + m[0].length, heads[i + 1]?.index ?? text.length) });
  }
  return out;
}

/** The part of a dossier under one "## Heading". */
export function dossierSection(d: Dossier, heading: RegExp): string {
  const parts = d.body.split(/^## /m);
  return parts.find((p) => heading.test(p.split('\n')[0] ?? '')) ?? '';
}

function sameBusiness(a: string, b: string): boolean {
  const strip = (s: string) => foldName(s.replace(/\(.*?\)/g, ' '));
  const x = strip(a);
  const y = strip(b);
  return x === y || x.includes(y) || y.includes(x);
}

const GENERIC = new Set(['tours', 'tour', 'kayak', 'kayaks', 'kayaking', 'charter', 'charters', 'adventure', 'adventures', 'fishing', 'cruise', 'cruises', 'guided', 'guiding', 'zealand', 'scenic', 'wines', 'vineyard', 'company', 'boating', 'glowworm', 'nature', 'travel', 'trips', 'estate', 'coast', 'track', 'island', 'safari', 'safaris', 'walks', 'charters', 'valley', 'penguins', 'swim']);

/** A storefront address only counts as this business's own when its name echoes the business. */
export function storefrontBelongs(url: string, name: string, domain: string | null): boolean {
  const label = (new URL(url).hostname.split('.')[0] ?? '').toLowerCase();
  if (['www', 'book', 'bookings', 'app', 'checkout', 'secure', 'newzealand'].includes(label)) return false;
  const domainLabel = (domain ?? '').split('.')[0] ?? '';
  if (domainLabel.length >= 5 && (label.includes(domainLabel) || domainLabel.includes(label))) return true;
  const words = foldName(name).split(' ').filter((w) => w.length >= 5 && !GENERIC.has(w));
  return words.some((w) => label.includes(w));
}

function listingUrls(name: string, domain: string | null, texts: string[]): string[] {
  const picked = new Map<string, { url: string; rank: number }>();
  for (const raw of texts.flatMap(urlsIn)) {
    const cleaned = raw.replace(/[.:)\]]+$/, '');
    let u: URL;
    try {
      u = new URL(cleaned);
    } catch {
      continue;
    }
    const host = u.hostname;
    if (domain && (host === domain || host.endsWith(`.${domain}`))) continue;
    if (/\.(pdf|jpe?g|png)$/i.test(u.pathname)) continue;
    const { kind, platform } = classifyListing(cleaned);
    if (kind === 'booking_system' && !storefrontBelongs(cleaned, name, domain)) continue;
    const rank = kind === 'booking_system' ? 0 : platform === 'newzealand.com' ? 1 : kind === 'booking_platform' ? 2 : kind === 'directory' ? 3 : 9;
    if (rank === 9) continue;
    // One address per site: the storefront's front page, or the first listing page seen.
    const url = kind === 'booking_system' ? `${u.origin}/` : cleaned;
    if (!picked.has(host)) picked.set(host, { url, rank });
  }
  return [...picked.values()].sort((a, b) => a.rank - b.rank).map((x) => x.url).slice(0, 5);
}

export interface SeedResult {
  imported: number;
  seed20: number;
  withoutWebsite: number;
}

/** Imports the 76 researched operators and marks the 20 that have a dossier. */
export function seed(db: Db, inputs: string = paths.inputs): SeedResult {
  const rows = parseCsv(readFileSync(join(inputs, 'NZ-OPERATORS-MASTER.csv'), 'utf8'));
  const dossiers = readDossiers(join(inputs, 'NZ-FIRST-20-DOSSIERS.md'));
  const upsert = db.prepare(
    `INSERT INTO businesses (slug, name, website, domain, country, region, town, pack, activity, source, phone, listing_urls, seed, status, notes, created_at)
     VALUES (@slug, @name, @website, @domain, 'NZ', @region, @town, 'tourism', @activity, @source, @phone, @listing_urls, @seed, 'candidate', @notes, @created_at)
     ON CONFLICT (slug) DO UPDATE SET name = excluded.name, website = excluded.website, domain = excluded.domain, region = excluded.region, town = excluded.town,
       activity = excluded.activity, source = excluded.source, phone = excluded.phone, listing_urls = excluded.listing_urls, seed = excluded.seed, notes = excluded.notes`,
  );
  const result: SeedResult = { imported: 0, seed20: 0, withoutWebsite: 0 };
  const matched = new Set<number>();
  db.transaction(() => {
    for (const r of rows) {
      const name = r.business_name!;
      const website = /^\s*none\b/i.test(r.website ?? '') ? null : (urlsIn(r.website ?? '')[0] ?? null);
      const domain = domainOf(website);
      const dossier = dossiers.find((d) => sameBusiness(d.name, name));
      if (dossier) matched.add(dossier.number);
      const texts = [r.email_source_url ?? '', r.booking_system ?? '', r.ota_listings ?? '', r.reviews ?? ''];
      if (dossier) texts.push(dossierSection(dossier, /^Snapshot/), dossierSection(dossier, /^Booking and channels/));
      if (!website) result.withoutWebsite += 1;
      upsert.run({
        slug: slugify(name.replace(/\(.*?\)/g, ' ')),
        name,
        website,
        domain,
        region: r.region || null,
        town: r.town || null,
        activity: r.activity_type || null,
        source: dossier ? 'seed20' : 'master76',
        phone: r.phone || null,
        listing_urls: JSON.stringify(listingUrls(name, domain, texts)),
        seed: JSON.stringify({ ...r, dossier: dossier?.number ?? null, otherWebsites: urlsIn(r.website ?? '').slice(1) }),
        notes: r.fit_reason || null,
        created_at: utcIso(),
      });
      result.imported += 1;
      if (dossier) result.seed20 += 1;
    }
  })();
  const missing = dossiers.filter((d) => !matched.has(d.number)).map((d) => d.name);
  if (missing.length) throw new Error(`dossiers with no matching CSV row: ${missing.join('; ')}`);
  return result;
}
