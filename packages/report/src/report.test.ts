import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { memoryDb, type Db } from '@plumbline/core';
import { CHECK_IDS, decide } from '@plumbline/checks';
import { loadLibrary } from '@plumbline/impact';
import { MASTER_COLUMNS, outreachScore, writeReport } from './index.ts';

const library = loadLibrary(CHECK_IDS);
const dir = mkdtempSync(join(tmpdir(), 'plumbline-report-'));
const image = join(dir, 'crop-7.webp');
writeFileSync(image, 'x');

let db: Db;
let out: string;

function finding(id: number, businessId: number, check: string, score: number, status: string, reproduced = 1) {
  db.prepare(
    `INSERT INTO findings (id, business_id, batch, check_id, pack, tier, severity, status, reproduced, fingerprint, title, page_url, viewport, visibility_weight, score, detail, first_seen_at, last_verified_at)
     VALUES (?, ?, 'b', ?, 'core', 'measured', 4, ?, ?, ?, ?, 'https://one.co.nz/', 'mobile', 1, ?, '{}', 'x', ?)`,
  ).run(id, businessId, check, status, reproduced, `f${id}`, `Title for ${check}`, score, reproduced ? '2026-10-11T02:00:00Z' : null);
  db.prepare("INSERT INTO evidence (finding_id, kind, url, viewport, excerpt, path, captured_at_utc, captured_at_nz) VALUES (?, 'element', 'https://one.co.nz/', 'mobile', 'Visible text <b>here</b>', ?, '2026-10-11T02:00:00Z', '2026-10-11 15:00:00 NZDT')").run(id, image);
}

beforeEach(() => {
  db = memoryDb();
  out = mkdtempSync(join(tmpdir(), 'plumbline-report-out-'));
  const biz = db.prepare("INSERT INTO businesses (id, slug, name, website, domain, region, town, activity, source, status, exclude_reason, google_rating, google_review_count, created_at) VALUES (?, ?, ?, ?, ?, 'Northland', 'Paihia', 'Kayak tours', ?, ?, ?, ?, ?, 'x')");
  biz.run(1, 'one', 'One Kayaks', 'https://one.co.nz/', 'one.co.nz', 'seed20', 'audited', null, 4.8, 120);
  biz.run(2, 'two', 'Two Charters & Co', 'https://two.co.nz/', 'two.co.nz', 'discovered', 'audited', null, 4.2, 10);
  biz.run(3, 'big', 'Shotover Jet', 'https://big.co.nz/', 'big.co.nz', 'discovered', 'excluded', 'large_group (Ngāi Tahu Tourism)', 4.6, 9000);
  biz.run(4, 'nomail', 'No Mail Tours', 'https://nomail.co.nz/', 'nomail.co.nz', 'discovered', 'excluded', 'no_published_email (and no contact form)', null, null);
  biz.run(5, 'later', 'Later Tours', 'https://later.co.nz/', 'later.co.nz', 'discovered', 'qualified', null, null, null);
  for (const id of [1, 2]) {
    db.prepare("INSERT INTO batch_members (batch, business_id) VALUES ('b', ?)").run(id);
    db.prepare("INSERT INTO runs (business_id, batch, kind, status, started_at, finished_at) VALUES (?, 'b', 'A', 'done', 'x', '2026-10-11T01:00:00Z')").run(id);
  }
  db.prepare("INSERT INTO runs (business_id, batch, kind, status, started_at, finished_at) VALUES (1, 'b', 'B', 'done', 'x', '2026-10-11T02:30:00Z')").run();
  const contact = db.prepare('INSERT INTO contacts (business_id, role, name, name_confirmed, title, email, email_source_url, phone, contact_form_url, source_url, source_quote, captured_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  contact.run(1, 'owner', 'Ross Michael Taylor', 0, 'owner', null, null, null, null, 'https://one.co.nz/about', 'Ross Taylor, owner and skipper', 'x');
  contact.run(1, 'second', 'Frances Taylor', 0, 'co-owner', null, null, null, null, 'https://one.co.nz/about', 'Frances - co-owner', 'x');
  contact.run(1, 'general', null, 0, null, 'info@one.co.nz', 'https://one.co.nz/contact', '09 402 0000', null, 'https://one.co.nz/contact', 'published as visible text', 'x');
  contact.run(2, 'general', null, 0, null, null, null, null, 'https://two.co.nz/contact', 'https://two.co.nz/contact', 'contact form', 'x');
  for (const id of [1, 2]) db.prepare("INSERT INTO consent_checks (business_id, pages_checked, no_unsolicited_statement_found, checked_at) VALUES (?, '[]', 0, 'x')").run(id);
  finding(1, 1, 'C10_broken_contact_links', 5, 'reproduced');
  finding(2, 1, 'C02_stale_copyright', 2, 'reproduced');
  finding(3, 1, 'C14_no_price_visible', 3.6, 'reproduced');
  finding(4, 1, 'C36_thin_homepage', 3, 'reproduced');
  finding(5, 1, 'C11_dead_navigation', 3, 'rejected');
  finding(6, 2, 'C20_slow_mobile', 4, 'candidate', 0);
  db.prepare("INSERT INTO brand_packs (business_id, logo_path, logo_source_url, colors, fonts, hero_images, voice_samples, captured_at) VALUES (1, ?, 'https://one.co.nz/logo.png', ?, ?, ?, ?, 'x')").run(image, JSON.stringify([{ hex: '#0b4f6c', role: 'background', share: 0.4 }]), JSON.stringify({ desktop: { body: 'Georgia', headings: 'Verdana', buttons: null, webFonts: [], sources: [] }, mobile: null }), JSON.stringify([{ url: 'https://one.co.nz/hero.jpg', alt: '', width: 1600, height: 600, hero: true }]), JSON.stringify([{ quote: 'We love this harbour.', url: 'https://one.co.nz/about' }]));
  db.prepare("INSERT INTO ledger (provider, operation, units, estimated_usd, actual_usd, at) VALUES ('openai', 'ai_answer', '{}', 0.02, 0.012, 'x')").run();
});

const read = (file: string) => readFileSync(join(out, file), 'utf8');

describe('outreach score', () => {
  it('adds the top three scores and the adjustments', () => {
    expect(outreachScore([{ score: 5 }, { score: 3.6 }, { score: 3 }, { score: 2 }], false, true, 4.8, 120, false)).toBe(13.6);
    expect(outreachScore([{ score: 5 }], true, false, 4.4, 500, false)).toBe(7);
    expect(outreachScore([], false, false, 4.8, 49, true)).toBe(-3);
  });
});

describe('batch report', () => {
  it('writes the five outputs', () => {
    const r = writeReport(db, 'b', { outDir: out });
    expect(r).toMatchObject({ audited: 2, excluded: 3 });
    for (const f of ['master.csv', 'index.html', 'excluded.csv', 'SUMMARY.md', 'businesses/one.html', 'businesses/two.html']) expect(existsSync(join(out, f)), f).toBe(true);
  });

  it('writes master.csv with one row per audited business, sorted by outreach score', () => {
    writeReport(db, 'b', { outDir: out });
    const lines = read('master.csv').trim().split('\n');
    expect(lines[0]).toBe(MASTER_COLUMNS.join(','));
    expect(lines).toHaveLength(3);
    expect(lines[1]).toMatch(/^one,One Kayaks,Paihia,Northland,Kayak tours,https:\/\/one\.co\.nz\/,Ross,no,https:\/\/one\.co\.nz\/about,Frances,co-owner,/);
    expect(lines[1]).toContain('info@one.co.nz,https://one.co.nz/contact,09 402 0000');
    expect(lines[1]).toContain(',4,C10_broken_contact_links,A contact link is broken,candidate,C14_no_price_visible,No price is visible,candidate,C36_thin_homepage,The homepage says very little,candidate,');
    // 5 + 3.6 + 3 for the top three, plus 1 for a named second and 1 for a strong Google rating.
    expect(lines[1]).toContain(',yes,13.6,');
    expect(lines[2]).toMatch(/^two,"?Two Charters & Co/);
    expect(lines[2]).toContain(',no,-3,');
  });

  it('never prints an unconfirmed surname', () => {
    writeReport(db, 'b', { outDir: out });
    expect(read('master.csv')).not.toContain('Taylor');
    expect(read('index.html')).not.toContain('Taylor');
    const page = read('businesses/one.html').replace(/Ross Taylor, owner and skipper/g, '');
    expect(page).not.toMatch(/Ross Michael|Frances Taylor/);
    db.prepare("UPDATE contacts SET name_confirmed = 1 WHERE role = 'owner'").run();
    writeReport(db, 'b', { outDir: out });
    expect(read('master.csv')).toContain('Ross Michael Taylor,yes');
  });

  it('marks the top three as candidates until they are approved', () => {
    writeReport(db, 'b', { outDir: out });
    expect(read('index.html')).toContain('No finding has been approved yet.');
    expect(read('businesses/one.html')).toContain('candidates, not yet approved');
    decide(db, 1, 'approve', null);
    writeReport(db, 'b', { outDir: out });
    expect(read('index.html')).not.toContain('No finding has been approved yet.');
    expect(read('master.csv').split('\n')[1]).toContain('C10_broken_contact_links,A contact link is broken,approved,,,,,,,');
  });

  it('shows impact and fix sentences word for word from the library, with basis and sources', () => {
    writeReport(db, 'b', { outDir: out });
    const page = read('businesses/one.html');
    const c10 = library.get('C10_broken_contact_links')!;
    const c14 = library.get('C14_no_price_visible')!;
    expect(page).toContain(c10.impact);
    expect(page).toContain(c10.fix);
    expect(page).toContain('Our view: plain reasoning, not a statistic');
    expect(page).toContain('Benchmark: a published figure');
    expect(page).toContain(c14.sources[0]!.url);
    expect(page).toContain('not yet verified by UD');
    expect(page).toContain('2026-10-11T02:00:00Z UTC');
    expect(page).toContain('2026-10-11 15:00:00 NZDT');
  });

  it('copies evidence and brand images into the report and escapes page text', () => {
    writeReport(db, 'b', { outDir: out });
    const page = read('businesses/one.html');
    expect(page).toContain('../files/one/crop-7.webp');
    expect(existsSync(join(out, 'files', 'one', 'crop-7.webp'))).toBe(true);
    expect(page).toContain('Visible text &lt;b&gt;here&lt;/b&gt;');
    expect(page).toContain('#0b4f6c');
    expect(page).toContain('We love this harbour.');
  });

  it('leaves rejected findings out and lists unconfirmed ones as seen in one run only', () => {
    writeReport(db, 'b', { outDir: out });
    expect(read('businesses/one.html')).not.toContain('Title for C11_dead_navigation');
    expect(read('businesses/one.html')).toContain('Title for C02_stale_copyright');
    expect(read('businesses/two.html')).toContain('seen in one run only');
    expect(read('businesses/two.html')).toContain('No finding has been reproduced for this business.');
  });

  it('uses no outside scripts, styles or fonts', () => {
    writeReport(db, 'b', { outDir: out });
    for (const f of ['index.html', 'businesses/one.html']) {
      const html = read(f);
      expect(html).not.toMatch(/<script[^>]+src=/i);
      expect(html).not.toMatch(/<link[^>]+href=/i);
      expect(html).not.toMatch(/@import|fonts\.googleapis/i);
    }
    expect(read('index.html')).toContain('id="master"');
  });

  it('writes TOP25.md with everything about the highest scoring businesses, top three marked, and no images', () => {
    writeReport(db, 'b', { outDir: out });
    const md = read('TOP25.md');
    expect(md).toContain('## 1. One Kayaks');
    expect(md.indexOf('## 1. One Kayaks')).toBeLessThan(md.indexOf('## 2. Two Charters'));
    expect(md).toContain('- **Owner:** Ross (not confirmed, first name only, owner). Source: https://one.co.nz/about');
    expect(md).toContain('- **Email:** info@one.co.nz. Source page: https://one.co.nz/contact');
    expect(md).toContain('- **Brand pack, colours:** #0b4f6c background 40%');
    expect(md).toContain('| yes | C10_broken_contact_links | A contact link is broken | measured | candidate | Title for C10_broken_contact_links | crop-7.webp |');
    expect(md).toContain('|  | C02_stale_copyright |');
    expect(md).not.toContain('C11_dead_navigation');
    expect(md).not.toContain('Taylor');
    expect(md).not.toMatch(/!\[|<img/);
  });

  it('lists every business not audited with its reason', () => {
    writeReport(db, 'b', { outDir: out });
    const csvText = read('excluded.csv');
    expect(csvText).toContain('big,Shotover Jet,Paihia,Northland,Kayak tours,https://big.co.nz/,discovered,large group (Ngāi Tahu Tourism)');
    expect(csvText).toContain('no published email (and no contact form)');
    expect(csvText).toContain('qualified, held for a later batch');
    expect(csvText).not.toMatch(/^one,/m);
  });

  it('summarises stages, common findings, spend and what is uncertain', () => {
    writeReport(db, 'b', { outDir: out, calibration: 'Matches 40, false findings 0.', uncertain: ['Something to check.'] });
    const md = read('SUMMARY.md');
    expect(md).toContain('| Audited (run A complete) | 2 |');
    expect(md).toContain('| Confirmed by run B | 1 |');
    expect(md).toContain('| large group | 1 |');
    expect(md).toContain('| C10 A contact link is broken | 1 | 0 | 0 |');
    expect(md).toContain('| openai | 1 | $0.02 | $0.01 |');
    expect(md).toContain('Matches 40, false findings 0.');
    expect(md).toContain('- Something to check.');
    expect(md).toMatch(/impact library entries have a benchmark source UD has not yet verified/);
  });
});
