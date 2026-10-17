import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { beforeEach, describe, expect, it } from 'vitest';
import { memoryDb, type Db } from '@plumbline/core';
import type { SiteData } from '@plumbline/collect';
import { cropElement, pageShot, regionFor } from '@plumbline/evidence';
import { loadLibrary } from '@plumbline/impact';
import { applyCheckToStoredRuns, decide, evaluateSite, recordAiFinding, recordRecheck, recordRunA, recordRunB, refreshTop3, scoreOf, top3Eligible } from './engine.ts';
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

describe('slow mobile speed in the top three', () => {
  it('takes a place only when the score is under 30 or main content comes after 6 seconds', () => {
    expect(top3Eligible('C20_slow_mobile', { performance: 29, lcpMs: 3000 })).toBe(true);
    expect(top3Eligible('C20_slow_mobile', { performance: 45, lcpMs: 6100 })).toBe(true);
    expect(top3Eligible('C20_slow_mobile', { performance: 30, lcpMs: 6000 })).toBe(false);
    expect(top3Eligible('C20_slow_mobile', { performance: 45, lcpMs: 4500 })).toBe(false);
    expect(top3Eligible('C20_slow_mobile', {})).toBe(false);
    expect(top3Eligible('C02_stale_copyright', {})).toBe(true);
  });

  it('is left out of the flagged top three when it is not severe, and stays approved', async () => {
    const slow = (performance: number, lcpMs: number) => ({ ...healthySite().lighthouse.mobile!, runs: [1, 2, 3].map(() => ({ performance, lcpMs, cls: 0, tbtMs: 0 })), median: { performance, lcpMs, cls: 0, tbtMs: 0 } });
    const make = (runId: number, at: string, perf: number, lcp: number) => troubled(runId, at, (s) => {
      s.lighthouse.mobile = slow(perf, lcp);
      s.https.certError = true;
      s.eol = [{ product: 'PHP', version: '7.4.33', eolDate: '2022-11-28', sourceUrl: 'https://endoflife.date/php', detectedFrom: 'X-Powered-By header' }];
    });
    const a = await make(1, '2026-10-10T20:00:00.000Z', 42, 4800);
    await recordRunA(db, library, a, 'b', evaluateSite(a, 'tourism', NOW).findings, evidenceRoot);
    const b = await make(2, '2026-10-10T21:15:00.000Z', 44, 4700);
    await recordRunB(db, library, b, 'b', evaluateSite(b, 'tourism', NOW).findings, a.finishedAt, evidenceRoot);
    for (const f of db.prepare('SELECT id FROM findings').all() as { id: number }[]) decide(db, f.id, 'approve', null);
    const r = Object.fromEntries(rows().map((x) => [x.check_id, x]));
    expect(r.C20_slow_mobile).toMatchObject({ status: 'approved', top3: 0 });
    expect(rows().filter((x) => x.top3).map((x) => x.check_id).sort()).toEqual(['C11_dead_navigation', 'C40_insecure_connection', 'C41_outdated_platform']);
  });
});

describe('findings built from AI answers', () => {
  const others = [{ name: 'Rival One', answers: 6 }, { name: 'Rival Two', answers: 4 }];
  const sample = { provider: 'openai', askedAt: '2026-10-10T20:00:00Z', answer: 'Rival One', citations: [] };
  const ai = (holds: boolean, namedIn = 0, answers = 6) => ({ questions: 6, namedIn, others, sample: { question: 'Q', ...sample }, asked: [{ question: 'Q', answers: 6, namedIn, others, sample, holdsInBothPasses: holds }, { question: 'Q2', answers, namedIn: 0, others, sample, holdsInBothPasses: holds }], lastAskedAt: '2026-10-12T02:30:00.000Z', spanMinutes: holds ? 95 : 0, holdsInBothPasses: holds });
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

describe('findings built from AI answers, recorded without a site visit', () => {
  const others = [{ name: 'Rival One', answers: 6 }, { name: 'Rival Two', answers: 4 }];
  const sample = { provider: 'openai', askedAt: '2026-10-12T01:00:00Z', answer: 'Rival One', citations: [] };
  const ai = (holds: boolean, namedIn = 0, answers = 6) => ({ questions: 6, namedIn, others, sample: { question: 'Q', ...sample }, asked: [{ question: 'Q', answers: 6, namedIn, others, sample, holdsInBothPasses: holds }, { question: 'Q2', answers, namedIn: 0, others, sample, holdsInBothPasses: holds }], lastAskedAt: '2026-10-12T02:30:00.000Z', spanMinutes: holds ? 95 : 0, holdsInBothPasses: holds });
  const business = { id: 1, slug: 'harbour-fixture', name: 'Harbour Fixture Charters' };
  const finding = () => db.prepare("SELECT id, status, reproduced, title, last_verified_at FROM findings WHERE check_id = 'C37_not_named_by_ai'").get() as { id: number; status: string; reproduced: number; title: string; last_verified_at: string | null } | undefined;
  const AT = '2026-10-12T03:00:00.000Z';

  it('are recorded with one piece of evidence for each question asked', () => {
    expect(recordAiFinding(db, library, business, 'b', ai(true), AT)).toBe('recorded');
    // The finding is as fresh as its newest answer, not as the moment it was recorded.
    expect(finding()).toMatchObject({ status: 'reproduced', reproduced: 1, title: 'Named in 0 of 12 AI answers', last_verified_at: '2026-10-12T02:30:00.000Z' });
    const ev = db.prepare('SELECT kind, excerpt, captured_at_utc FROM evidence WHERE finding_id = ? ORDER BY id').all(finding()!.id) as { kind: string; excerpt: string; captured_at_utc: string }[];
    expect(ev.map((e) => e.kind)).toEqual(['ai', 'ai']);
    expect(ev[0]!.excerpt).toContain('Question: Q\n');
    expect(ev[1]!.excerpt).toContain('Question: Q2\n');
    expect(ev[0]!.captured_at_utc).toBe('2026-10-12T01:00:00.000Z');
  });

  it('stay candidates until the answers come in two passes that agree', () => {
    expect(recordAiFinding(db, library, business, 'b', ai(false), AT)).toBe('recorded');
    expect(finding()).toMatchObject({ status: 'candidate', reproduced: 0 });
    recordAiFinding(db, library, business, 'b', ai(true), AT);
    expect(finding()).toMatchObject({ status: 'reproduced', reproduced: 1 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM findings').get()).toEqual({ n: 1 });
  });

  it('are dropped when a later round of answers names the business', () => {
    recordAiFinding(db, library, business, 'b', ai(true), AT);
    expect(recordAiFinding(db, library, business, 'b', ai(true, 4), AT)).toBe('dropped');
    expect(finding()).toMatchObject({ status: 'resolved' });
    expect(recordAiFinding(db, library, business, 'b', ai(true, 4), AT)).toBe('none');
  });

  it('are left as they are when the answers are missing or not all in, whatever their state', () => {
    recordAiFinding(db, library, business, 'b', ai(true), AT);
    decide(db, finding()!.id, 'approve', null);
    // No summary at all: a run that stopped at the budget line, or a homepage that could not be read.
    expect(recordAiFinding(db, library, business, 'b', null, AT)).toBe('none');
    // One question still has only its first two answers.
    expect(recordAiFinding(db, library, business, 'b', ai(true, 0, 2), AT)).toBe('none');
    expect(finding()).toMatchObject({ status: 'approved', reproduced: 1 });
  });

  it('are not recorded when there are no answers or the business is named', () => {
    expect(recordAiFinding(db, library, business, 'b', null, AT)).toBe('none');
    expect(recordAiFinding(db, library, business, 'b', ai(true, 1), AT)).toBe('none');
    expect(finding()).toBeUndefined();
  });

  it('keep a decision already made', () => {
    recordAiFinding(db, library, business, 'b', ai(true), AT);
    decide(db, finding()!.id, 'reject', 'not for this one');
    expect(recordAiFinding(db, library, business, 'b', ai(true), AT)).toBe('recorded');
    expect(finding()).toMatchObject({ status: 'rejected' });
  });
});

describe('findings from another tool', () => {
  const other = () => db.prepare("SELECT status FROM findings WHERE source = 'crawlmouse'").get() as { status: string } | undefined;
  beforeEach(() => {
    db.prepare(
      `INSERT INTO findings (business_id, batch, check_id, pack, tier, severity, status, reproduced, fingerprint, title, visibility_weight, score, first_seen_at, source)
       VALUES (1, 'b', 'CM_missing_page', 'crawlmouse', 'measured', 5, 'reproduced', 1, 'a-link-is-missing', 'A link leads to a missing page.', 0.6, 3, '2026-10-12', 'crawlmouse')`,
    ).run();
  });

  it('are left alone by a new run A, which clears only Plumbline findings not yet ruled on', async () => {
    const a = await troubled(1, '2026-10-10T20:00:00.000Z');
    await recordRunA(db, library, a, 'b', evaluateSite(a, 'tourism', NOW).findings, evidenceRoot);
    await recordRunA(db, library, a, 'b', evaluateSite(a, 'tourism', NOW).findings, evidenceRoot);
    expect(other()).toEqual({ status: 'reproduced' });
  });

  it('are left alone by run B, which neither reproduces nor touches them', async () => {
    const a = await troubled(1, '2026-10-10T20:00:00.000Z');
    await recordRunA(db, library, a, 'b', evaluateSite(a, 'tourism', NOW).findings, evidenceRoot);
    db.prepare("UPDATE findings SET detail = '{\"kept\":true}' WHERE source = 'crawlmouse'").run();
    const b = await troubled(2, '2026-10-10T21:15:00.000Z');
    await recordRunB(db, library, b, 'b', evaluateSite(b, 'tourism', NOW).findings, a.finishedAt, evidenceRoot);
    expect(db.prepare("SELECT status, detail, last_run_id FROM findings WHERE source = 'crawlmouse'").get()).toEqual({ status: 'reproduced', detail: '{"kept":true}', last_run_id: null });
  });

  it('are not marked resolved by a re-check, which cannot measure them', async () => {
    const site = await troubled(3, '2026-10-12T20:00:00.000Z');
    const r = await recordRecheck(db, site, 'b', evaluateSite(site, 'tourism', NOW).findings, evidenceRoot);
    expect(r.resolved).toBe(0);
    expect(other()).toEqual({ status: 'reproduced' });
  });
});

describe('a check added after a batch was audited', () => {
  it('is applied to the stored runs: candidate from run A alone, reproduced when run B shows it too', async () => {
    const a = await troubled(1, '2026-10-10T20:00:00.000Z');
    const r1 = await applyCheckToStoredRuns(db, library, 'C02_stale_copyright', 'b', a, null, evidenceRoot);
    expect(r1).toEqual({ candidates: 1, reproduced: 0 });
    expect(rows().map((r) => [r.check_id, r.status])).toEqual([['C02_stale_copyright', 'candidate']]);
    const b = await troubled(2, '2026-10-10T21:15:00.000Z');
    const r2 = await applyCheckToStoredRuns(db, library, 'C02_stale_copyright', 'b', a, b, evidenceRoot);
    expect(r2).toEqual({ candidates: 0, reproduced: 1 });
    expect(rows()[0]).toMatchObject({ status: 'reproduced', reproduced: 1, last_verified_at: b.finishedAt });
    expect(db.prepare('SELECT COUNT(*) AS n FROM evidence').get()).toEqual({ n: 1 });
  });

  it('does not count two runs less than 60 minutes apart, or a problem only one run shows', async () => {
    const a = await troubled(1, '2026-10-10T20:00:00.000Z');
    const soon = await troubled(2, '2026-10-10T20:30:00.000Z');
    expect((await applyCheckToStoredRuns(db, library, 'C02_stale_copyright', 'b', a, soon, evidenceRoot)).reproduced).toBe(0);
    const fixed = await troubled(3, '2026-10-10T22:00:00.000Z', (s) => editHomes(s, (p) => (p.blocks[p.blocks.length - 1] = block('© 2026 Harbour Fixture Charters', { inFooter: true }))));
    expect((await applyCheckToStoredRuns(db, library, 'C02_stale_copyright', 'b', a, fixed, evidenceRoot)).reproduced).toBe(0);
    expect(rows()[0]).toMatchObject({ status: 'candidate', reproduced: 0 });
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
