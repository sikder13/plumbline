import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { openDb, paths } from '@plumbline/core';
import { ensureToken } from '@plumbline/preview';
import { CallLedger, QuotaStop, photoUri, pickTen, type Cached, type Details, type Enriched } from './enrich.ts';
import { campaignPaths, toCsv } from './pull.ts';

/** CSV text with quoted fields as rows of strings keyed by the header. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') {
      row.push(cur);
      cur = '';
    } else if (ch === '\n') {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else if (ch !== '\r') cur += ch;
  }
  if (cur || row.length) {
    row.push(cur);
    rows.push(row);
  }
  const head = rows.shift() ?? [];
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

/** The variance of a Laplacian over a greyscale copy 800 px wide: how much fine edge a photo holds. */
export async function sharpness(file: string): Promise<number> {
  const { data, info } = await sharp(file).rotate().resize({ width: 800, withoutEnlargement: true }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  let sum = 0;
  let sq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = data[i - w]! + data[i + w]! + data[i - 1]! + data[i + 1]! - 4 * data[i]!;
      sum += v;
      sq += v * v;
      n++;
    }
  }
  return n ? Math.round(sq / n - (sum / n) ** 2) : 0;
}

/** The businesses already in another batch's LEADS.csv: a lead is built once. */
export function earlierSlugs(batches: string, current: string): Set<string> {
  const out = new Set<string>();
  if (!existsSync(batches)) return out;
  for (const b of readdirSync(batches, { withFileTypes: true })) {
    const file = join(batches, b.name, 'LEADS.csv');
    if (!b.isDirectory() || b.name === current || !existsSync(file)) continue;
    for (const r of parseCsv(readFileSync(file, 'utf8'))) if (r.slug) out.add(r.slug);
  }
  return out;
}

export interface PhotoFile {
  file: string;
  width: number;
  height: number;
  sharpness: number;
  /** Who posted it on Google: the business itself or a customer. */
  author: string;
  authorUri: string;
}

export interface Picked extends Enriched {
  token: string;
  demoUrl: string;
}

const LEADS_COLUMNS = ['slug', 'legal_name', 'trading_name', 'trade_group', 'city', 'county', 'zip', 'filing_date', 'phone', 'address', 'hours', 'photo_count', 'score', 'google_link', 'facebook_link', 'email', 'planned_demo_url', 'status'];

function enrichedFrom(r: Record<string, string>): Enriched {
  return {
    ...(r as unknown as Enriched),
    ownerIsAgent: r.ownerIsAgent === 'true',
    hours: r.hours === 'true',
    score: Number(r.score),
    photos: Number(r.photos),
    match: r.match ? Number(r.match) : null,
    reviews: r.reviews ? Number(r.reviews) : null,
    rating: r.rating ? Number(r.rating) : null,
  };
}

/**
 * Picks the ten and the five alternates from _scored.csv, gives each its demo address, downloads up to
 * ten of its Google photos (as many as the day's calls allow), and writes the batch folder and LEADS.csv.
 */
export async function pickBatch(campaign: string, batch: string, opts: { ceiling: number; log?: (line: string) => void }): Promise<{ picked: Picked[]; alternates: Enriched[]; stopped: string | null; calls: number }> {
  const p = campaignPaths(campaign);
  const log = opts.log ?? (() => undefined);
  const earlier = earlierSlugs(p.batches, batch);
  const scored = parseCsv(readFileSync(join(p.leads, '_scored.csv'), 'utf8')).map(enrichedFrom).filter((l) => !earlier.has(l.slug));
  const pool = new Map(parseCsv(readFileSync(join(p.leads, '_pool.csv'), 'utf8')).map((r) => [r.slug!, r]));
  const { picked, alternates } = pickTen(scored);
  const dir = join(p.batches, batch);
  mkdirSync(dir, { recursive: true });
  const db = openDb(paths.db);
  const ledger = new CallLedger(join(p.cache, '_calls.jsonl'), opts.ceiling);
  const before = ledger.total();
  let stopped: string | null = null;
  const out: Picked[] = [];
  for (const [i, lead] of picked.entries()) {
    const token = ensureToken(db, lead.slug);
    const demoUrl = `https://nahltech.com/demo/${lead.slug}-${token}`;
    const cached = JSON.parse(readFileSync(join(p.cache, `${lead.slug}.json`), 'utf8')) as Cached;
    const d = cached.details as Details;
    const folder = join(dir, lead.slug);
    const assets = join(p.assets, lead.slug);
    mkdirSync(folder, { recursive: true });
    mkdirSync(assets, { recursive: true });
    const listFile = join(assets, 'photos.json');
    const files: PhotoFile[] = existsSync(listFile) ? (JSON.parse(readFileSync(listFile, 'utf8')) as PhotoFile[]) : [];
    // The calls left today are shared out over the leads still to come.
    const left = Math.max(0, opts.ceiling - ledger.today());
    const share = Math.min(10, Math.floor(left / (picked.length - i)));
    const saved = new Set(files.map((f) => f.file));
    const wanted = (d.photos ?? [])
      .slice(0, 10)
      .map((ph, k) => ({ ph, name: `photo-${String(k + 1).padStart(2, '0')}.jpg` }))
      .filter((x) => !saved.has(x.name))
      .slice(0, share);
    for (const { ph, name } of wanted) {
      if (stopped) break;
      try {
        ledger.take('photoMedia', lead.slug);
        const { photoUri: uri } = await photoUri(ph.name);
        const res = await fetch(uri, { signal: AbortSignal.timeout(30_000) });
        if (!res.ok) throw new Error(`photo ${res.status}`);
        const file = join(assets, name);
        const info = await sharp(Buffer.from(await res.arrayBuffer())).rotate().resize({ width: 2000, withoutEnlargement: true }).jpeg({ quality: 92, mozjpeg: true }).toFile(file);
        files.push({ file: name, width: info.width, height: info.height, sharpness: await sharpness(file), author: ph.authorAttributions?.[0]?.displayName ?? '', authorUri: ph.authorAttributions?.[0]?.uri ?? '' });
      } catch (e) {
        if (e instanceof QuotaStop) {
          stopped = e.message;
          break;
        }
        log(`  ${lead.slug} ${name}: ${(e as Error).message}`);
      }
    }
    files.sort((a, b) => a.file.localeCompare(b.file));
    writeFileSync(listFile, JSON.stringify(files, null, 2));
    const row = pool.get(lead.slug) ?? {};
    writeFileSync(join(folder, 'facts.json'), JSON.stringify({ lead: { ...lead, token, demoUrl }, filing: row, query: cached.query, details: d, photos: files }, null, 2));
    out.push({ ...lead, token, demoUrl });
    log(`${lead.slug}: picked, score ${lead.score}, ${files.length} photos saved, ${demoUrl}`);
  }
  db.close();
  const leadsFile = join(dir, 'LEADS.csv');
  // Facebook links, emails and status are filled by hand later; a rerun keeps what is there.
  const kept = existsSync(leadsFile) ? new Map(parseCsv(readFileSync(leadsFile, 'utf8')).map((r) => [r.slug!, r])) : new Map<string, Record<string, string>>();
  const rows = out.map((l) => {
    const f = pool.get(l.slug) ?? {};
    const k = kept.get(l.slug) ?? {};
    const photos = existsSync(join(p.assets, l.slug, 'photos.json')) ? (JSON.parse(readFileSync(join(p.assets, l.slug, 'photos.json'), 'utf8')) as unknown[]).length : 0;
    return { slug: l.slug, legal_name: l.name, trading_name: l.trading, trade_group: l.group, city: l.city, county: l.county, zip: f.zip ?? '', filing_date: l.created, phone: l.phone, address: l.address, hours: l.hours ? 'yes' : 'no', photo_count: photos, score: l.score, google_link: l.maps, facebook_link: k.facebook_link ?? '', email: k.email ?? '', planned_demo_url: l.demoUrl, status: k.status || 'researched' };
  });
  writeFileSync(leadsFile, toCsv(rows, LEADS_COLUMNS as (keyof (typeof rows)[number])[]));
  writeFileSync(join(dir, 'ALTERNATES.csv'), toCsv(alternates, ['slug', 'name', 'trading', 'group', 'city', 'score', 'created', 'maps', 'photos', 'hours']));
  return { picked: out, alternates, stopped, calls: ledger.total() - before };
}
