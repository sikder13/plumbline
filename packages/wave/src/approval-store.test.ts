import { describe, expect, it } from 'vitest';
import { memoryDb, type Db } from '@plumbline/core';
import { decide } from '@plumbline/checks/review';
import { findingsToDecide, isSuppressed, readSuppression, storeDecisions } from './approval-store.ts';
import type { Decision } from './approve.ts';

function seeded(): Db {
  const db = memoryDb();
  db.prepare("INSERT INTO businesses (id, slug, name, website, source, status, created_at) VALUES (1, 'alpha', 'Alpha', 'https://alpha.co.nz/', 'discovered', 'audited', 'x')").run();
  return db;
}

let n = 0;
function add(db: Db, checkId: string, status = 'reproduced', reproduced = 1): number {
  n += 1;
  const r = db
    .prepare("INSERT INTO findings (business_id, batch, check_id, pack, tier, severity, status, reproduced, fingerprint, title, visibility_weight, score, detail, first_seen_at, last_verified_at, source) VALUES (1, 'b', ?, 'core', 'measured', 4, ?, ?, ?, ?, 1, 4, '{\"n\":1}', 'x', '2026-10-13T03:00:00Z', 'plumbline')")
    .run(checkId, status, reproduced, `fp-${n}`, `${checkId} measured`);
  const id = Number(r.lastInsertRowid);
  db.prepare("INSERT INTO evidence (finding_id, kind, excerpt, path, captured_at_utc, captured_at_nz) VALUES (?, 'page', 'seen', ?, 'x', 'x')").run(id, `/evidence/${id}.webp`);
  return id;
}

const statusOf = (db: Db, id: number) => (db.prepare('SELECT status FROM findings WHERE id = ?').get(id) as { status: string }).status;
const noteOf = (db: Db, id: number) => (db.prepare('SELECT note FROM reviews WHERE finding_id = ? ORDER BY id DESC LIMIT 1').get(id) as { note: string } | undefined)?.note;
const decision = (findingId: number, d: Decision['decision'], rule = 'F3 top three'): Decision => ({ findingId, slug: 'alpha', checkId: 'C', title: 't', sentence: 't', decision: d, rule, tier: 'speed', reason: 'ranked 1 of 3' });

describe('the suppression list', () => {
  it('reads slugs and addresses, one to a line or separated by commas, whatever their case, and skips a heading', () => {
    const list = readSuppression('slug,email\nalpha-tours, Owner@Alpha.co.nz\n\nbravo-wines\r\nno-reply@charlie.nz\n');
    expect([...list].sort()).toEqual(['alpha-tours', 'bravo-wines', 'no-reply@charlie.nz', 'owner@alpha.co.nz']);
    expect(readSuppression('').size).toBe(0);
  });

  it('holds back a business named by its slug or by any of its addresses', () => {
    const list = readSuppression('alpha-tours\nhello@bravo.co.nz');
    expect(isSuppressed(list, 'alpha-tours', [])).toBe(true);
    expect(isSuppressed(list, 'bravo-wines', ['info@bravo.co.nz', 'Hello@Bravo.co.nz'])).toBe(true);
    expect(isSuppressed(list, 'charlie', ['info@charlie.nz'])).toBe(false);
  });
});

describe('findings put before the rules', () => {
  it('leaves out what a person rejected, and puts a decision the rules made earlier up for deciding again', () => {
    const db = seeded();
    const open = add(db, 'C20_slow_mobile');
    const byPerson = add(db, 'T01_no_online_booking');
    decide(db, byPerson, 'reject', 'Eveve takes reservations');
    const byRule = add(db, 'C13_no_action_above_fold');
    decide(db, byRule, 'reject', 'By rule: F3 not in the top three. ranked 4 of 6');
    const approvedEarlier = add(db, 'C41_outdated_platform');
    decide(db, approvedEarlier, 'approve', null);
    const gone = add(db, 'C10_broken_contact_links', 'resolved', 1);

    const r = findingsToDecide(db, 1, 'b', (path) => path.endsWith(`${open}.webp`));
    expect(r.byPerson).toEqual([{ findingId: byPerson, checkId: 'T01_no_online_booking', title: 'T01_no_online_booking measured', note: 'Eveve takes reservations' }]);
    expect(r.findings.map((f) => [f.id, f.status])).toEqual([
      [open, 'reproduced'],
      [byRule, 'reproduced'],
      [approvedEarlier, 'reproduced'],
      [gone, 'resolved'],
    ]);
    // Evidence whose file is no longer on disk does not count as a screenshot.
    expect(r.findings[0]!.evidence[0]!.path).toBe(`/evidence/${open}.webp`);
    expect(r.findings[1]!.evidence[0]!.path).toBeNull();
    expect(r.findings[0]!.detail).toEqual({ n: 1 });
  });
});

describe('storing the decisions', () => {
  it('stores a rejection at once, and an approval only once the independent check has passed it', () => {
    const db = seeded();
    const [a, b, c] = [add(db, 'C10_broken_contact_links'), add(db, 'C20_slow_mobile'), add(db, 'C31_no_structured_data')];
    const r = storeDecisions(db, [decision(a, 'approve'), decision(b, 'approve'), decision(c, 'reject', 'F3 not in the top three')], { [a]: { verdict: 'ok', reason: '' } });
    expect(r).toEqual({ approved: 1, rejected: 1, waiting: 1 });
    expect([statusOf(db, a), statusOf(db, b), statusOf(db, c)]).toEqual(['approved', 'reproduced', 'rejected']);
    expect(noteOf(db, a)).toBe('By rule: F3 top three. ranked 1 of 3. Passed the independent check.');
    expect(noteOf(db, c)).toBe('By rule: F3 not in the top three. ranked 1 of 3');
    // A second pass changes nothing and writes no second review.
    expect(storeDecisions(db, [decision(a, 'approve'), decision(c, 'reject', 'F3 not in the top three')], { [a]: { verdict: 'ok', reason: '' } })).toEqual({ approved: 0, rejected: 0, waiting: 0 });
    expect((db.prepare('SELECT count(*) AS n FROM reviews').get() as { n: number }).n).toBe(2);
  });

  it('takes back an approval the rules no longer make, and leaves a finding that is gone as it is', () => {
    const db = seeded();
    const was = add(db, 'C11_dead_navigation');
    decide(db, was, 'approve', 'By rule: F3 top three. ranked 2 of 3. Passed the independent check.');
    const gone = add(db, 'C12_broken_internal_links', 'resolved', 1);
    const never = add(db, 'C13_no_action_above_fold', 'candidate', 0);
    storeDecisions(db, [decision(was, 'reject', 'F4 independent check'), decision(gone, 'reject', 'F1.1 did not reproduce'), decision(never, 'reject', 'F1.1 did not reproduce')], {});
    expect([statusOf(db, was), statusOf(db, gone), statusOf(db, never)]).toEqual(['rejected', 'resolved', 'candidate']);
  });
});

describe('a suppression list kept in a spreadsheet', () => {
  it('is read when its cells are quoted', () => {
    const list = readSuppression('"slug","email","reason"\n"alpha-tours","Owner@Alpha.co.nz","asked not to be written to"\n');
    expect(isSuppressed(list, 'alpha-tours', [])).toBe(true);
    expect(isSuppressed(list, 'bravo-wines', ['owner@alpha.co.nz'])).toBe(true);
    expect(isSuppressed(list, 'charlie', ['info@charlie.nz'])).toBe(false);
  });
});

describe('a suppression entry for a whole domain', () => {
  const sheet = 'domain,emails,date,reason\ndelta.co.nz,lucy@delta.co.nz;lucyp@delta.co.nz,2026-10-13,"replied, no thanks"\n';

  it('is read from its own column, and the date and the reason beside it are not taken for entries', () => {
    expect([...readSuppression(sheet)].sort()).toEqual(['delta.co.nz', 'lucy@delta.co.nz', 'lucyp@delta.co.nz']);
  });

  it('holds back every address at the domain, and the business whose site is on it', () => {
    const list = readSuppression(sheet);
    expect(isSuppressed(list, 'delta-treks', ['Bookings@Delta.co.nz'])).toBe(true);
    expect(isSuppressed(list, 'delta-treks', ['hello@mail.delta.co.nz'])).toBe(true);
    expect(isSuppressed(list, 'delta-treks', [], 'https://www.delta.co.nz/contact')).toBe(true);
    expect(isSuppressed(list, 'delta-treks', [], 'delta.co.nz')).toBe(true);
  });

  it('still reads an address that has slipped into the wrong column, as when two addresses are set apart by a comma', () => {
    const list = readSuppression('domain,emails,date,reason\ndelta.co.nz,lucy@delta.co.nz,lucyp@echo.nz,2026-10-13,replied no thanks\n');
    expect([...list].sort()).toEqual(['delta.co.nz', 'lucy@delta.co.nz', 'lucyp@echo.nz']);
    expect(isSuppressed(list, 'echo-tours', ['lucyp@echo.nz'])).toBe(true);
  });

  it('leaves alone a business whose name only ends the same way', () => {
    const list = readSuppression(sheet);
    expect(isSuppressed(list, 'other', ['info@notdelta.co.nz'], 'https://notdelta.co.nz/')).toBe(false);
    expect(isSuppressed(list, 'other', [], null)).toBe(false);
  });
});

describe('an approval whose pass no longer stands', () => {
  it('is taken back until the independent check has seen the finding as it now reads', () => {
    const db = seeded();
    const id = add(db, 'C20_slow_mobile');
    storeDecisions(db, [decision(id, 'approve')], { [id]: { verdict: 'ok', reason: '' } });
    expect(statusOf(db, id)).toBe('approved');
    // The same finding, decided again with no verdict standing for its sentence.
    const out = storeDecisions(db, [decision(id, 'approve')], {});
    expect(statusOf(db, id)).toBe('reproduced');
    expect(out).toEqual({ approved: 0, rejected: 0, waiting: 1 });
    // Passed again, it is approved again.
    expect(storeDecisions(db, [decision(id, 'approve')], { [id]: { verdict: 'ok', reason: '' } }).approved).toBe(1);
    expect(statusOf(db, id)).toBe('approved');
  });

  it('is left alone when a person gave it', () => {
    const db = seeded();
    const id = add(db, 'C10_broken_contact_links');
    decide(db, id, 'approve', 'looked at it myself');
    expect(storeDecisions(db, [decision(id, 'approve')], {})).toEqual({ approved: 0, rejected: 0, waiting: 0 });
    expect(statusOf(db, id)).toBe('approved');
  });
});
