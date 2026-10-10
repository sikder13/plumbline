import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { memoryDb, type Db } from '@plumbline/core';
import { CHECK_IDS } from '@plumbline/checks';
import { loadLibrary } from '@plumbline/impact';
import { exportBusiness, gateFailures } from './index.ts';

const dir = mkdtempSync(join(tmpdir(), 'plumbline-export-'));
const image = join(dir, 'crop.webp');
writeFileSync(image, 'x');
const NOW = new Date('2026-10-12T02:00:00Z');
const library = loadLibrary(CHECK_IDS);

let db: Db;
/** One business with one finding that passes every gate. C10 has basis OUR_VIEW, so it needs no source check. */
function setup(patch: { check?: string; status?: string; reproduced?: number; verified?: string | null; evidence?: boolean; path?: string | null } = {}) {
  db = memoryDb();
  db.prepare("INSERT INTO businesses (id, slug, name, website, source, status, created_at) VALUES (1, 'fixture', 'Fixture Tours', 'https://fixture.co.nz/', 'seed20', 'audited', 'x')").run();
  db.prepare("INSERT INTO runs (id, business_id, batch, kind, status, started_at, finished_at) VALUES (1, 1, 'b', 'A', 'done', 'x', '2026-10-11T20:00:00Z')").run();
  db.prepare("INSERT INTO contacts (business_id, role, name, name_confirmed, email, email_source_url, captured_at) VALUES (1, 'owner', 'Ross Taylor', 0, 'info@fixture.co.nz', 'https://fixture.co.nz/contact', 'x')").run();
  db.prepare(
    `INSERT INTO findings (id, business_id, batch, check_id, pack, tier, severity, status, reproduced, fingerprint, title, page_url, viewport, visibility_weight, score, detail, first_seen_at, last_verified_at)
     VALUES (1, 1, 'b', ?, 'core', 'measured', 5, ?, ?, 'f', 'The email link is broken', 'https://fixture.co.nz/', 'mobile', 1, 5, '{}', 'x', ?)`,
  ).run(patch.check ?? 'C10_broken_contact_links', patch.status ?? 'approved', patch.reproduced ?? 1, patch.verified === undefined ? '2026-10-11T22:00:00Z' : patch.verified);
  if (patch.evidence !== false) {
    db.prepare("INSERT INTO evidence (finding_id, run_id, kind, url, viewport, selector, bbox, excerpt, path, captured_at_utc, captured_at_nz) VALUES (1, 1, 'element', 'https://fixture.co.nz/', 'mobile', 'a', '{}', 'The email link has no address.', ?, '2026-10-11T22:00:00Z', '2026-10-12 11:00:00 NZDT')").run(patch.path === undefined ? image : patch.path);
  }
}
const gates = () => exportBusiness(db, 'fixture', { now: NOW, outRoot: dir }).failures.map((f) => f.gate);

beforeEach(() => setup());

describe('export gates', () => {
  it('exports a finding that passes all five gates', () => {
    const r = exportBusiness(db, 'fixture', { now: NOW, outRoot: dir });
    expect(r).toMatchObject({ ok: true, exported: 1, failures: [] });
    const bundle = JSON.parse(readFileSync(join(r.dir!, 'bundle.json'), 'utf8'));
    expect(bundle.findings[0]).toMatchObject({ check: 'C10_broken_contact_links', top3: true, basis: 'OUR_VIEW' });
    expect(bundle.findings[0].impact).toBe(library.get('C10_broken_contact_links')!.impact);
    expect(bundle.findings[0].fix).toBe(library.get('C10_broken_contact_links')!.fix);
    expect(bundle.findings[0].evidence[0]).toMatchObject({ image: 'evidence/crop.webp', captured_at_nz: '2026-10-12 11:00:00 NZDT' });
    expect(existsSync(join(r.dir!, 'evidence', 'crop.webp'))).toBe(true);
    expect(bundle.contacts.owner).toMatchObject({ name: 'Ross', confirmed: false });
    expect(db.prepare('SELECT COUNT(*) AS n FROM exports').get()).toEqual({ n: 1 });
  });

  it('refuses without evidence', () => {
    setup({ evidence: false });
    expect(gates()).toContain('evidence');
    setup({ path: join(dir, 'missing.webp') });
    expect(gates()).toEqual(['evidence']);
  });

  it('refuses a finding that was not reproduced', () => {
    setup({ reproduced: 0 });
    expect(gates()).toEqual(['reproduced']);
  });

  it('refuses when nothing is approved', () => {
    setup({ status: 'reproduced' });
    const r = exportBusiness(db, 'fixture', { now: NOW, outRoot: join(dir, 'none') });
    expect(r.ok).toBe(false);
    expect(r.failures.map((f) => f.gate)).toEqual(['nothing_to_export']);
    expect(existsSync(join(dir, 'none'))).toBe(false);
  });

  it('refuses a finding verified more than 24 hours ago, or never', () => {
    setup({ verified: '2026-10-11T01:00:00Z' });
    expect(gates()).toEqual(['fresh']);
    setup({ verified: null });
    expect(gates()).toEqual(['fresh']);
    setup({ verified: '2026-10-11T02:30:00Z' });
    expect(gates()).toEqual([]);
  });

  it('refuses while a benchmark source behind the finding is unverified', () => {
    setup({ check: 'C01_placeholder_text' });
    const r = exportBusiness(db, 'fixture', { now: NOW, outRoot: dir });
    expect(r.ok).toBe(false);
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0]).toMatchObject({ gate: 'sources' });
    expect(r.failures[0]!.reason).toContain('Nielsen Norman Group');
  });

  it('reports every failed gate at once', () => {
    const f = { id: 1, checkId: 'C01_placeholder_text', status: 'candidate', reproduced: false, lastVerifiedAt: null, evidence: [] } as never;
    expect(gateFailures(f, library.get('C01_placeholder_text')!, NOW).map((x) => x.gate).sort()).toEqual(['approved', 'evidence', 'fresh', 'reproduced', 'sources']);
  });
});
