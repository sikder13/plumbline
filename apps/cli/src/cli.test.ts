import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { memoryDb, type Business } from '@plumbline/core';
import { businessSuppressed, clearToContact, verdictStands } from './approve.ts';
import { calibrate, calibrationReport } from './calibrate.ts';
import { importResearchContacts } from './commands.ts';
import { parseCsv, toCsv } from './csv.ts';
import { dossierSection, readDossiers, seed, storefrontBelongs } from './seed.ts';
import { fit, rank, selectBatch } from './select.ts';
import { readWaveList } from './wave.ts';

describe('CSV', () => {
  it('reads quoted fields, doubled quotes and line breaks inside quotes', () => {
    const rows = parseCsv('﻿name,note\r\n"Smith, Jo","said ""hi""\nthen left"\nPlain,x\n');
    expect(rows).toEqual([
      { name: 'Smith, Jo', note: 'said "hi"\nthen left' },
      { name: 'Plain', note: 'x' },
    ]);
  });
  it('writes what it reads', () => {
    const rows = [{ a: 'x, y', b: 'say "no"', c: 3 }];
    expect(parseCsv(toCsv(rows, ['a', 'b', 'c']))).toEqual([{ a: 'x, y', b: 'say "no"', c: '3' }]);
  });
});

function inputs(): string {
  const dir = mkdtempSync(join(tmpdir(), 'plumbline-inputs-'));
  writeFileSync(
    join(dir, 'NZ-OPERATORS-MASTER.csv'),
    [
      'rank,business_name,town,region,activity_type,website,email,email_source_url,contact_form_url,phone,owner_names,owner_source_url,booking_system,ota_listings,reviews,fit_reason',
      '1,Fixture Kayakers,Paihia (Waitangi),Northland,Kayak tours,https://fixturekayakers.co.nz,info@fixturekayakers.co.nz,https://fixturekayakers.co.nz,,09 402 0000,"Dora and Chad (first names only; surnames unconfirmed)",https://fixturekayakers.co.nz/about,Rezdy (fixturekayakers.rezdy.com),"Bookme: https://www.bookme.co.nz/x/1 ; reseller https://kiwidrivertours.rezdy.com/1/tour",TripAdvisor 5.0,Owner-run',
      '2,Second Charters (MV Example),Taupō,Taupō,Fishing charter,https://www.secondcharters.co.nz (also https://other.example),fish@secondcharters.co.nz,,,07 378 0000,"Ross (Rossy) Michael Taylor; Frances Rae Taylor (directors). Site photo caption: Ross, Fran and Kye",https://register.example/second,Phone only,FishingBooker: https://fishingbooker.com/charters/view/1,,',
      '3,No Site Tours,Invercargill,Southland,Guided tours,none found (newzealand.com links only to https://www.newzealand.com/x),,,,,,,,,,',
    ].join('\n'),
  );
  writeFileSync(join(dir, 'NZ-FIRST-20-DOSSIERS.md'), '# First\n\n# 01. Fixture Kayakers\n## Snapshot\n- Listing: https://www.newzealand.com/nz/plan/business/fixture-kayakers/\n## Competitors\n- https://rival.rezdy.com/\n## Website problems\n1. A problem.\n');
  return dir;
}

describe('seed', () => {
  it('imports every row, marks the ones with a dossier and handles a business with no website', () => {
    const db = memoryDb();
    const r = seed(db, inputs());
    expect(r).toEqual({ imported: 3, seed20: 1, withoutWebsite: 1 });
    const rows = db.prepare('SELECT slug, source, website, domain, town, listing_urls FROM businesses ORDER BY id').all() as { slug: string; source: string; website: string | null; domain: string | null; listing_urls: string }[];
    expect(rows.map((x) => [x.slug, x.source, x.website])).toEqual([
      ['fixture-kayakers', 'seed20', 'https://fixturekayakers.co.nz'],
      ['second-charters', 'master76', 'https://www.secondcharters.co.nz'],
      ['no-site-tours', 'master76', null],
    ]);
    expect(rows[0]!.domain).toBe('fixturekayakers.co.nz');
    // The business's own storefront and its listings are kept. A reseller's storefront and competitors are not.
    expect(JSON.parse(rows[0]!.listing_urls)).toEqual(['https://fixturekayakers.rezdy.com/', 'https://www.newzealand.com/nz/plan/business/fixture-kayakers/', 'https://www.bookme.co.nz/x/1']);
    expect(seed(db, inputs()).imported).toBe(3);
    expect(db.prepare('SELECT COUNT(*) AS n FROM businesses').get()).toEqual({ n: 3 });
  });

  it('reads dossier sections by heading', () => {
    const d = readDossiers(join(inputs(), 'NZ-FIRST-20-DOSSIERS.md'));
    expect(d.map((x) => [x.number, x.name])).toEqual([[1, 'Fixture Kayakers']]);
    expect(dossierSection(d[0]!, /^Snapshot/)).toContain('newzealand.com');
    expect(dossierSection(d[0]!, /^Snapshot/)).not.toContain('rival.rezdy.com');
  });

  it('accepts a storefront only when its address echoes the business', () => {
    expect(storefrontBelongs('https://coastalkayakers.rezdy.com/', 'Coastal Kayakers', 'coastalkayakers.co.nz')).toBe(true);
    expect(storefrontBelongs('https://okarekaestateadventures.rezdy.com/', 'Trek Lake Okareka', 'treklakeokareka.co.nz')).toBe(true);
    expect(storefrontBelongs('https://kiwidrivertours.rezdy.com/x', 'Cathedral Cove Kayak Tours', 'kayaktours.co.nz')).toBe(false);
    expect(storefrontBelongs('https://newzealand.rezdy.com/x', 'Cathedral Cove Kayak Tours', 'kayaktours.co.nz')).toBe(false);
  });

  it('imports researched contacts with their source and never marks a name confirmed', () => {
    const db = memoryDb();
    seed(db, inputs());
    expect(importResearchContacts(db)).toBe(5);
    const rows = db.prepare('SELECT b.slug, c.role, c.name, c.name_confirmed, c.email, c.email_source_url FROM contacts c JOIN businesses b ON b.id = c.business_id ORDER BY c.id').all();
    expect(rows).toEqual([
      { slug: 'fixture-kayakers', role: 'general', name: null, name_confirmed: 0, email: 'info@fixturekayakers.co.nz', email_source_url: 'https://fixturekayakers.co.nz' },
      { slug: 'fixture-kayakers', role: 'owner', name: 'Dora', name_confirmed: 0, email: null, email_source_url: null },
      { slug: 'fixture-kayakers', role: 'second', name: 'Chad', name_confirmed: 0, email: null, email_source_url: null },
      { slug: 'second-charters', role: 'owner', name: 'Ross Michael Taylor', name_confirmed: 0, email: null, email_source_url: null },
      { slug: 'second-charters', role: 'second', name: 'Frances Rae Taylor', name_confirmed: 0, email: null, email_source_url: null },
    ]);
    // The second business has an email in the research but no page it was published on, so it is not imported.
    expect(importResearchContacts(db)).toBe(5);
    expect(db.prepare('SELECT COUNT(*) AS n FROM contacts').get()).toEqual({ n: 5 });
  });
});

describe('batch selection', () => {
  const b = (id: number, source: string, region: string, reviews: number, rating = 4.8): Business => ({ id, slug: `b${id}`, source, region, google_review_count: reviews, google_rating: rating, seed: '{"types":["tour_agency"]}' }) as Business;

  it('prefers small, well reviewed operators', () => {
    expect(fit(b(1, 'discovered', 'x', 200))).toBeGreaterThan(fit(b(2, 'discovered', 'x', 2500)));
    expect(fit(b(1, 'discovered', 'x', 200, 4.8))).toBeGreaterThan(fit(b(2, 'discovered', 'x', 200, 3.9)));
  });

  it('takes researched businesses first, then discovered ones in turn from each region', () => {
    const pool = [b(1, 'discovered', 'North', 100), b(2, 'discovered', 'North', 300), b(3, 'discovered', 'North', 50), b(4, 'discovered', 'South', 5), b(5, 'seed20', 'South', 0), b(6, 'master76', 'North', 0)];
    expect(rank(pool, 5).map((x) => x.id)).toEqual([5, 6, 2, 4, 1]);
    const db = memoryDb();
    for (const x of pool) db.prepare("INSERT INTO businesses (id, slug, name, source, region, created_at) VALUES (?, ?, ?, ?, ?, 'x')").run(x.id, x.slug, x.slug, x.source, x.region);
    expect(selectBatch(db, 'b', 4, pool)).toEqual({ total: 4, seeded: 2, discovered: 2, regions: 2 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM batch_members WHERE batch = 'b'").get()).toEqual({ n: 4 });
  });
});

describe('calibration', () => {
  it('counts matches, false findings, misses with their reasons and new findings', () => {
    const db = memoryDb();
    db.prepare("INSERT INTO businesses (id, slug, name, source, created_at) VALUES (1, 'one', 'One', 'seed20', 'x'), (2, 'two', 'Two', 'seed20', 'x')").run();
    db.prepare("INSERT INTO runs (business_id, batch, kind, status, started_at) VALUES (1, 'c', 'A', 'done', 'x'), (1, 'c', 'B', 'done', 'x'), (2, 'c', 'A', 'done', 'x')").run();
    const f = db.prepare("INSERT INTO findings (business_id, batch, check_id, pack, tier, severity, status, reproduced, fingerprint, title, visibility_weight, score, detail, first_seen_at) VALUES (?, 'c', ?, 'core', 'measured', 3, ?, ?, ?, ?, 1, 3, '{}', 'x')");
    f.run(1, 'C02_stale_copyright', 'reproduced', 1, 'a', 'The footer says 2015');
    f.run(1, 'C01_placeholder_text', 'reproduced', 1, 'b', 'Leftover template text: "Toggle navigation"');
    f.run(1, 'C20_slow_mobile', 'reproduced', 1, 'c', 'Mobile speed score 20');
    f.run(1, 'C11_dead_navigation', 'candidate', 0, 'd', 'Seen once only');
    f.run(2, 'C06_broken_images', 'candidate', 0, 'e', '3 images fail to load');
    const file = join(mkdtempSync(join(tmpdir(), 'plumbline-truth-')), 'truth.json');
    writeFileSync(
      file,
      JSON.stringify({
        businesses: [
          { slug: 'one', verified: [{ check: 'C02_stale_copyright', note: '2015' }, { check: 'C11_dead_navigation', note: 'menu' }, { check: 'C70_reviews_not_shown', note: 'reviews', miss_reason: 'badges shown' }], false: [{ pattern: 'Toggle navigation', note: 'screen reader text' }] },
          { slug: 'two', verified: [], false: [{ check: 'C06_broken_images', note: 'lazy loaded' }] },
        ],
      }),
    );
    const c = calibrate(db, 'c', file);
    expect(c.totals).toEqual({ verified: 3, matches: 1, falseFindings: 2, missed: 2, missedExplained: 1, fresh: 1 });
    expect(c.rows[0]).toMatchObject({ stage: 'reproduced', matches: ['C02_stale_copyright'] });
    // Once run B is done, a finding seen only in run A no longer counts as found.
    expect(c.rows[0]!.missed.map((m) => [m.check, m.reason])).toEqual([['C11_dead_navigation', 'not detected'], ['C70_reviews_not_shown', 'badges shown']]);
    expect(c.rows[0]!.fresh.map((x) => x.check)).toEqual(['C20_slow_mobile']);
    expect(c.rows[1]).toMatchObject({ stage: 'run A only' });
    expect(c.rows[1]!.falseFindings[0]).toMatchObject({ check: 'C06_broken_images', rule: 'lazy loaded' });
    const md = calibrationReport(c, 'c');
    expect(md).toContain('| False findings (must be zero) | 2 |');
    expect(md).toContain('| one | reproduced | C02 | 1 | C11, C70 | C20 |');
  });
});

describe('a wave list', () => {
  it('reads the order, the slug and whether a row is in the wave or a reserve', () => {
    const csv = 'order,status,slug,name,town\n1,wave 2,fixture-kayakers,Fixture Kayakers,"Paihia, Northland"\n2,dropped,third-tours,Third Tours,Napier\n21,reserve,second-charters,Second Charters,Taupō\n,wave 2,,No slug,\n';
    expect(readWaveList(csv)).toEqual([
      { slug: 'fixture-kayakers', position: 1, status: 'wave' },
      { slug: 'third-tours', position: 2, status: 'dropped' },
      { slug: 'second-charters', position: 21, status: 'reserve' },
    ]);
  });
});

describe('a kept verdict of the independent check', () => {
  it('holds for the sentence it was given on, and a flag against the finding holds however it is reworded', () => {
    const ok = { verdict: 'ok' as const, reason: '', sentence: 'Mobile speed score 31 out of 100' };
    expect(verdictStands(ok, 'Mobile speed score 31 out of 100')).toBe(true);
    expect(verdictStands(ok, 'Mobile speed score 40 out of 100')).toBe(false);
    const flag = { verdict: 'flag' as const, reason: 'the menu item opens a dropdown', sentence: '1 menu item leads nowhere' };
    expect(verdictStands(flag, 'One menu item leads nowhere')).toBe(true);
    expect(verdictStands({ ...flag, scope: 'sentence' }, 'One menu item leads nowhere')).toBe(false);
    expect(verdictStands({ ...flag, scope: 'sentence' }, '1 menu item leads nowhere')).toBe(true);
    // A verdict kept without its sentence speaks for the finding as a whole.
    expect(verdictStands({ verdict: 'ok', reason: '' }, 'anything')).toBe(true);
  });
});

describe('a business that must not be built for or written to', () => {
  function seeded() {
    const db = memoryDb();
    const add = db.prepare("INSERT INTO businesses (id, slug, name, website, source, status, created_at) VALUES (?, ?, ?, ?, 'discovered', ?, 'x')");
    add.run(1, 'alpha', 'Alpha', 'https://alpha.co.nz/', 'audited');
    add.run(2, 'bravo', 'Bravo', 'https://bravo.co.nz/', 'excluded');
    add.run(3, 'charlie', 'Charlie', 'https://charlie.co.nz/', 'audited');
    add.run(4, 'delta', 'Delta', 'https://delta.co.nz/', 'audited');
    db.prepare("INSERT INTO contacts (business_id, role, email, captured_at) VALUES (4, 'general', 'Info@Delta.co.nz', 'x')").run();
    db.prepare("INSERT INTO consent_checks (business_id, pages_checked, no_unsolicited_statement_found, quote, checked_at) VALUES (3, '[]', 1, 'No unsolicited marketing please.', 'x')").run();
    return db;
  }

  it('is one on the suppression list by slug or address, one we excluded, or one whose site refuses unsolicited messages', () => {
    const db = seeded();
    const list = new Set(['info@delta.co.nz']);
    expect(businessSuppressed(db, { id: 1, slug: 'alpha' }, list)).toBeNull();
    expect(businessSuppressed(db, { id: 1, slug: 'alpha' }, new Set(['alpha']))).toBe('on the suppression list');
    expect(businessSuppressed(db, { id: 2, slug: 'bravo' }, list)).toBe('excluded');
    expect(businessSuppressed(db, { id: 3, slug: 'charlie' }, list)).toBe('their site refuses unsolicited messages: "No unsolicited marketing please."');
    expect(businessSuppressed(db, { id: 4, slug: 'delta' }, list)).toBe('on the suppression list');
  });

  it('is sorted out of any list of pages to publish or drafts to mark, with the reason', () => {
    const db = seeded();
    const all = [{ id: 1, slug: 'alpha' }, { id: 2, slug: 'bravo' }, { id: 4, slug: 'delta' }];
    expect(clearToContact(db, all, new Set(['info@delta.co.nz']))).toEqual({ clear: [{ id: 1, slug: 'alpha' }], held: [{ slug: 'bravo', why: 'excluded' }, { slug: 'delta', why: 'on the suppression list' }] });
  });
});
