import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { beforeEach, describe, expect, it } from 'vitest';
import { memoryDb, type Db } from '@plumbline/core';
import type { SiteData } from '@plumbline/collect';
import { cropElement, pageShot, regionFor } from '@plumbline/evidence';
import { loadLibrary } from '@plumbline/impact';
import { decide, evaluateSite, recordRecheck, recordRunA, recordRunB, refreshTop3, scoreOf } from './engine.ts';
import { CHECK_IDS } from './ids.ts';
import { block, editHomes, healthySite, link } from './testing.ts';

const library = loadLibrary(CHECK_IDS);
const NOW = new Date('2026-10-10T21:00:00Z');
const evidenceRoot = mkdtempSync(join(tmpdir(), 'plumbline-evidence-'));

/** A site with a stale footer, a dead menu item and a broken link, with real screenshot tiles behind it. */
async function troubled(runId: number, startedAt: string, patch: (s: SiteData) => void = () => undefined): Promise<SiteData> {
  const s = editHomes(healthySite({ runId, startedAt, finishedAt: new Date(new Date(startedAt).getTime() + 600_000).toISOString() }), (p) => (p.blocks[p.blocks.length - 1] = block('© 2015 Harbour Fixture Charters', { inFooter: true, box: { x: 16, y: 2400, w: 300, h: 24 } })));
  s.homepage.mobile!.links.push(link('https://fixture.co.nz/#', 'More', { raw: '#', inNav: true }), link('https://fixture.co.nz/#', 'Deals', { raw: '#', inNav: true }));
  const dir = mkdtempSync(join(tmpdir(), 'plumbline-capture-'));
  mkdirSync(dir, { recursive: true });
  for (const [i, colour] of ['#336699', '#993366'].entries()) {
    await sharp({ create: { width: 1170, height: 6000, channels: 3, background: colour } }).jpeg().toFile(join(dir, `tile-0${i}.jpg`));
  }
  s.homepage.mobile!.dir = dir;
  s.homepage.mobile!.tiles = [
    { file: 'tile-00.jpg', y: 0, h: 2000 },
    { file: 'tile-01.jpg', y: 2000, h: 1000 },
  ];
  patch(s);
  return s;
}

let db: Db;
beforeEach(() => {
  db = memoryDb();
  db.prepare("INSERT INTO businesses (id, slug, name, source, created_at) VALUES (1, 'harbour-fixture', 'Harbour Fixture Charters', 'seed20', '2026-10-10')").run();
  for (const id of [1, 2, 3]) db.prepare("INSERT INTO runs (id, business_id, batch, kind, started_at) VALUES (?, 1, 'b', ?, '2026-10-10')").run(id, id === 1 ? 'A' : id === 2 ? 'B' : 'recheck');
});

const rows = () => db.prepare('SELECT check_id, status, reproduced, score, top3, last_verified_at, detail FROM findings ORDER BY check_id').all() as { check_id: string; status: string; reproduced: number; score: number; top3: number; last_verified_at: string | null; detail: string }[];

describe('scoring', () => {
  it('multiplies severity by where it was seen and how it was established', () => {
    expect(scoreOf(5, 'homepage_mobile', 'measured')).toBe(5);
    expect(scoreOf(5, 'homepage_desktop', 'measured')).toBe(4);
    expect(scoreOf(4, 'inner', 'rule')).toBe(2.16);
    expect(scoreOf(5, 'homepage_mobile', 'judgment')).toBe(4);
  });
});

describe('two runs', () => {
  it('starts every finding as a candidate with evidence, a severity from the library and both times', async () => {
    const a = await troubled(1, '2026-10-10T20:00:00.000Z');
    const res = await recordRunA(db, library, a, 'b', evaluateSite(a, 'tourism', NOW).findings, evidenceRoot);
    expect(res.candidates).toBe(2);
    expect(rows().map((r) => [r.check_id, r.status, r.reproduced, r.score])).toEqual([
      ['C02_stale_copyright', 'candidate', 0, 2],
      ['C11_dead_navigation', 'candidate', 0, 3],
    ]);
    const ev = db.prepare('SELECT * FROM evidence ORDER BY id').all() as { kind: string; path: string | null; captured_at_utc: string; captured_at_nz: string; url: string; viewport: string; bbox: string; excerpt: string }[];
    expect(ev[0]).toMatchObject({ kind: 'element', url: 'https://fixture.co.nz/', viewport: 'mobile', captured_at_utc: '2026-10-10T20:00:00.000Z', captured_at_nz: '2026-10-11 09:00:00 NZDT' });
    expect(ev[0]!.excerpt).toContain('© 2015');
    expect(existsSync(ev[0]!.path!)).toBe(true);
  });

  it('refuses a second run less than 60 minutes after the first', async () => {
    const a = await troubled(1, '2026-10-10T20:00:00.000Z');
    await recordRunA(db, library, a, 'b', evaluateSite(a, 'tourism', NOW).findings, evidenceRoot);
    const b = await troubled(2, '2026-10-10T20:40:00.000Z');
    await expect(recordRunB(db, library, b, 'b', evaluateSite(b, 'tourism', NOW).findings, a.finishedAt, evidenceRoot)).rejects.toThrow(/at least 60/);
    expect(rows().every((r) => r.status === 'candidate')).toBe(true);
  });

  it('marks a finding reproduced only when it fires again, and keeps what the two runs share', async () => {
    const a = await troubled(1, '2026-10-10T20:00:00.000Z');
    await recordRunA(db, library, a, 'b', evaluateSite(a, 'tourism', NOW).findings, evidenceRoot);
    // In run B the footer has been fixed, one dead menu item is gone, and something new appears.
    const b = await troubled(2, '2026-10-10T21:15:00.000Z', (s) => {
      editHomes(s, (p) => (p.blocks[p.blocks.length - 1] = block('© 2026 Harbour Fixture Charters', { inFooter: true })));
      s.homepage.mobile!.links = s.homepage.mobile!.links.filter((l) => l.text !== 'Deals');
      s.https.certError = true;
    });
    const res = await recordRunB(db, library, b, 'b', evaluateSite(b, 'tourism', NOW).findings, a.finishedAt, evidenceRoot);
    expect(res).toMatchObject({ reproduced: 1, notReproduced: 1, newInB: 1 });
    const r = Object.fromEntries(rows().map((x) => [x.check_id, x]));
    expect(r.C02_stale_copyright).toMatchObject({ status: 'candidate', reproduced: 0, last_verified_at: null });
    expect(r.C11_dead_navigation).toMatchObject({ status: 'reproduced', reproduced: 1, last_verified_at: b.finishedAt });
    expect((JSON.parse(r.C11_dead_navigation!.detail).items as { text: string }[]).map((i) => i.text)).toEqual(['More']);
    expect(r.C40_insecure_connection).toMatchObject({ status: 'candidate', reproduced: 0 });
  });

  it('clears unreviewed findings when run A is repeated, and keeps decisions already made', async () => {
    const a = await troubled(1, '2026-10-10T20:00:00.000Z');
    await recordRunA(db, library, a, 'b', evaluateSite(a, 'tourism', NOW).findings, evidenceRoot);
    const b = await troubled(2, '2026-10-10T21:15:00.000Z');
    await recordRunB(db, library, b, 'b', evaluateSite(b, 'tourism', NOW).findings, a.finishedAt, evidenceRoot);
    const nav = db.prepare("SELECT id FROM findings WHERE check_id = 'C11_dead_navigation'").get() as { id: number };
    decide(db, nav.id, 'reject', 'dropdown parents');
    const again = await troubled(1, '2026-10-11T20:00:00.000Z');
    await recordRunA(db, library, again, 'b', evaluateSite(again, 'tourism', NOW).findings, evidenceRoot);
    expect(rows().map((r) => [r.check_id, r.status])).toEqual([
      ['C02_stale_copyright', 'candidate'],
      ['C11_dead_navigation', 'rejected'],
    ]);
  });
});

describe('approval, top three and recheck', () => {
  async function reproduced() {
    const a = await troubled(1, '2026-10-10T20:00:00.000Z', (s) => {
      s.https.certError = true;
      s.eol = [{ product: 'PHP', version: '7.4.33', eolDate: '2022-11-28', sourceUrl: 'https://endoflife.date/php', detectedFrom: 'X-Powered-By header' }];
    });
    await recordRunA(db, library, a, 'b', evaluateSite(a, 'tourism', NOW).findings, evidenceRoot);
    const b = await troubled(2, '2026-10-10T21:15:00.000Z', (s) => {
      s.https.certError = true;
      s.eol = a.eol;
    });
    await recordRunB(db, library, b, 'b', evaluateSite(b, 'tourism', NOW).findings, a.finishedAt, evidenceRoot);
    return db.prepare('SELECT id, check_id FROM findings ORDER BY score DESC, id').all() as { id: number; check_id: string }[];
  }

  it('will not approve a finding that has not been reproduced', async () => {
    const a = await troubled(1, '2026-10-10T20:00:00.000Z');
    await recordRunA(db, library, a, 'b', evaluateSite(a, 'tourism', NOW).findings, evidenceRoot);
    const f = db.prepare('SELECT id FROM findings LIMIT 1').get() as { id: number };
    expect(() => decide(db, f.id, 'approve', null)).toThrow(/reproduced before/);
  });

  it('flags the three highest scoring approved findings and no others', async () => {
    const all = await reproduced();
    expect(all).toHaveLength(4);
    expect(rows().every((r) => r.top3 === 0)).toBe(true);
    for (const f of all) decide(db, f.id, 'approve', null);
    const top = rows().filter((r) => r.top3).map((r) => r.check_id).sort();
    expect(top).toEqual(['C11_dead_navigation', 'C40_insecure_connection', 'C41_outdated_platform']);
    decide(db, all[0]!.id, 'reject', 'not for this client');
    expect(rows().filter((r) => r.top3)).toHaveLength(3);
    expect(rows().find((r) => r.status === 'rejected')!.top3).toBe(0);
    expect(refreshTop3(db, 1, 'b')).toHaveLength(3);
    expect(db.prepare('SELECT COUNT(*) AS n FROM reviews').get()).toEqual({ n: 5 });
  });

  it('refreshes the verification time on recheck and resolves what the business has fixed', async () => {
    const all = await reproduced();
    for (const f of all) decide(db, f.id, 'approve', null);
    const c = await troubled(3, '2026-10-12T20:00:00.000Z', (s) => {
      s.https.certError = true;
      editHomes(s, (p) => (p.blocks[p.blocks.length - 1] = block('© 2026 Harbour Fixture Charters', { inFooter: true })));
    });
    c.kind = 'recheck';
    const res = await recordRecheck(db, c, 'b', evaluateSite(c, 'tourism', NOW).findings, evidenceRoot);
    expect(res).toMatchObject({ reproduced: 2, resolved: 2 });
    const r = Object.fromEntries(rows().map((x) => [x.check_id, x]));
    expect(r.C40_insecure_connection).toMatchObject({ status: 'approved', last_verified_at: c.finishedAt });
    expect(r.C02_stale_copyright).toMatchObject({ status: 'resolved', top3: 0 });
    expect(r.C41_outdated_platform).toMatchObject({ status: 'resolved' });
  });
});

describe('findings built from AI answers', () => {
  const ai = (holds: boolean) => ({ questions: 6, namedIn: 0, others: [{ name: 'Rival One', answers: 6 }, { name: 'Rival Two', answers: 4 }], sample: { question: 'Q', provider: 'openai', askedAt: '2026-10-10T20:00:00Z', answer: 'Rival One', citations: [] }, spanMinutes: holds ? 95 : 0, holdsInBothPasses: holds });
  const status = () => (db.prepare("SELECT status, reproduced FROM findings WHERE check_id = 'C37_not_named_by_ai'").get() as { status: string; reproduced: number });

  it('stay candidates when every answer was asked at one time, however many site runs see them', async () => {
    const a = await troubled(1, '2026-10-10T20:00:00.000Z');
    await recordRunA(db, library, a, 'b', evaluateSite(a, 'tourism', NOW, ai(false)).findings, evidenceRoot);
    expect(status()).toEqual({ status: 'candidate', reproduced: 0 });
    const b = await troubled(2, '2026-10-10T21:15:00.000Z');
    await recordRunB(db, library, b, 'b', evaluateSite(b, 'tourism', NOW, ai(false)).findings, a.finishedAt, evidenceRoot);
    expect(status()).toEqual({ status: 'candidate', reproduced: 0 });
  });

  it('count as reproduced once the answers come in two passes an hour apart that agree', async () => {
    const a = await troubled(1, '2026-10-10T20:00:00.000Z');
    await recordRunA(db, library, a, 'b', evaluateSite(a, 'tourism', NOW, ai(false)).findings, evidenceRoot);
    const b = await troubled(2, '2026-10-10T21:15:00.000Z');
    await recordRunB(db, library, b, 'b', evaluateSite(b, 'tourism', NOW, ai(true)).findings, a.finishedAt, evidenceRoot);
    expect(status()).toEqual({ status: 'reproduced', reproduced: 1 });
    const ev = db.prepare("SELECT e.kind, e.excerpt FROM evidence e JOIN findings f ON f.id = e.finding_id WHERE f.check_id = 'C37_not_named_by_ai'").get() as { kind: string; excerpt: string };
    expect(ev.kind).toBe('ai');
    expect(ev.excerpt).toContain('Question: Q');
  });
});

describe('evidence images', () => {
  it('takes the element plus 120 px of context, inside the page', () => {
    expect(regionFor({ x: 16, y: 2400, w: 300, h: 24 }, 390, 3000)).toEqual({ x: 0, y: 2280, w: 390, h: 264 });
    expect(regionFor({ x: 16, y: 10, w: 300, h: 24 }, 390, 3000)).toEqual({ x: 0, y: 0, w: 390, h: 154 });
    expect(regionFor({ x: 16, y: 5000, w: 300, h: 24 }, 390, 3000)).toBeNull();
  });

  it('crops across two tiles, caps the width at 1080 and draws the box in the house colour', async () => {
    const s = await troubled(1, '2026-10-10T20:00:00.000Z');
    const out = join(evidenceRoot, 'crop.webp');
    // The box straddles the join between the tiles at y = 2000.
    const res = (await cropElement(s.homepage.mobile!, { x: 40, y: 1950, w: 200, h: 100 }, out))!;
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(1080);
    expect(res.width).toBe(1080);
    const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
    const px = (x: number, y: number) => Array.from(data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3));
    const near = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]!) < 28);
    const b = res.boxInImage!;
    expect(near(px(b.x + Math.round(b.w / 2), b.y), [0xe4, 0x57, 0x2e])).toBe(true);
    expect(near(px(b.x, b.y + Math.round(b.h / 2)), [0xe4, 0x57, 0x2e])).toBe(true);
    // Above the join is the first tile's colour, below it the second's.
    expect(near(px(20, 20), [0x33, 0x66, 0x99])).toBe(true);
    expect(near(px(20, info.height - 20), [0x99, 0x33, 0x66])).toBe(true);
  });

  it('saves the top of the page for page-level findings', async () => {
    const s = await troubled(1, '2026-10-10T20:00:00.000Z');
    const res = (await pageShot(s.homepage.mobile!, join(evidenceRoot, 'page.webp')))!;
    expect(res.width).toBe(1080);
    expect(res.boxInImage).toBeNull();
  });
});
