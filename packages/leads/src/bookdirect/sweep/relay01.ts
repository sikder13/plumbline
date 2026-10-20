import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCsv } from '../../batch.ts';
import type { AuditRecord } from '../audit.ts';
import type { ContactRow } from '../contacts.ts';
import { bookDirectPaths } from '../discover.ts';
import { nzDate } from '../contacts.ts';
import { registryKey, type Registry } from './registry.ts';

export const LIST_INDUSTRY: Record<string, string> = { A: 'accommodation', B: 'allied-health', C: 'dental', D: 'trades' };

export interface Relay01Site {
  rec: AuditRecord;
  contact: ContactRow | undefined;
  domain: string;
  outcome01: string;
}

/** The 240 sites relay 01 audited, with their contact rows and relay 01's verdict. */
export function relay01Sites(): Relay01Site[] {
  const p = bookDirectPaths();
  const dir = join(p.data, 'audit');
  if (!existsSync(dir)) return [];
  const contacts = new Map((parseCsv(readFileSync(join(p.leads, '_contacts.csv'), 'utf8')) as unknown as ContactRow[]).map((c) => [c.slug, c]));
  const verdict = new Map<string, string>();
  const q = join(p.leads, 'QUALIFIED.csv');
  const r = join(p.leads, 'REJECTED.csv');
  if (existsSync(r)) for (const x of parseCsv(readFileSync(r, 'utf8'))) verdict.set(registryKey(x.website ?? ''), `relay 01: ${x.reason}`);
  if (existsSync(q)) for (const x of parseCsv(readFileSync(q, 'utf8'))) verdict.set(registryKey(x.website ?? ''), `relay 01: qualified (${x.lead_finding})`);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as AuditRecord)
    .map((rec) => {
      const contact = contacts.get(rec.slug);
      const domain = registryKey(contact?.website || rec.homeUrl);
      return { rec, contact, domain, outcome01: verdict.get(domain) ?? 'relay 01: audited' };
    });
}

/** Enters relay 01's audited sites in the registry as version 1, once; rows already there are left alone. */
export function seedRegistryFromRelay01(registry: Registry): number {
  let added = 0;
  for (const s of relay01Sites()) {
    if (!s.domain || registry.has(s.domain)) continue;
    const day = nzDate(new Date(s.rec.measuredAt.slice(0, 24)));
    registry.record({ domain: s.domain, business: s.rec.name, industry: LIST_INDUSTRY[s.rec.list] ?? s.rec.list, first_audited: day, last_audited: day, audit_version: '1', outcome: s.outcome01 });
    added++;
  }
  return added;
}

export interface Relay01Check {
  domain: string;
  business: string;
  industry: string;
  /** Checks that would flag on the cached crawl. None is a flag: no picture can be taken without fetching again. */
  wouldFlag: string;
  detail: string;
  notApplicable: string;
}

const MX_DEAD = /^(?:ENOTFOUND|ENODATA|no MX records)$/;

/**
 * The ten checks run again on relay 01's 240 sites from what is already on disk: the six pages read, the
 * audit's measurements and the Book links it followed. Nothing is fetched from the sites (DNS lookups for
 * the published addresses' mail servers are not site requests). Hours (no Google hours were asked for in
 * relay 01) and anything that needs a fresh picture cannot be settled here: every check that would flag
 * is "unproven" until `--reaudit` photographs it.
 */
export async function relay01V2(): Promise<Relay01Check[]> {
  const { savedPages } = await import('../audit.ts');
  const { emailsOnPage } = await import('../site.ts');
  const { mxCheck } = await import('../verify.ts');
  const { menuItems, isKeyMenu, phonesOnSite, otaLinks, hasAvailabilityForm, nzDigits } = await import('./crawl.ts');
  const p = bookDirectPaths();
  const cands = new Map((parseCsv(readFileSync(join(p.leads, '_candidates.csv'), 'utf8')) as unknown as { slug: string; phone: string }[]).map((c) => [c.slug, c]));
  const contacts = new Map((parseCsv(readFileSync(join(p.leads, '_contacts.csv'), 'utf8')) as unknown as ContactRow[]).map((c) => [registryKey(c.website), c]));
  const comp = existsSync(join(p.leads, '_competitors.csv')) ? parseCsv(readFileSync(join(p.leads, '_competitors.csv'), 'utf8')) : [];
  const mx = new Map<string, Promise<{ ok: boolean; error: string | null }>>();
  const out: Relay01Check[] = [];
  for (const s of relay01Sites()) {
    const f = s.rec.facts;
    const pages = savedPages(s.rec.slug);
    const would: string[] = [];
    const detail: string[] = [];
    const na: string[] = ['hours_mismatch (no Google hours in relay 01)', 'site_down_or_broken (the homepage opened in relay 01)'];
    const dead = f.landings.filter((l) => l.outcome === 'not_200');
    if (dead.length) {
      would.push('booking_link_broken');
      detail.push(`booking_link_broken: "${dead[0]!.text}" ${dead[0]!.status ?? ''} ${dead[0]!.detail}`.trim());
    }
    if (f.homeUrl.startsWith('http://')) {
      would.push('not_secure');
      detail.push(`not_secure: the homepage ended on ${f.homeUrl}`);
    }
    const home = pages.find((x) => x.role.startsWith('home'));
    if (home) {
      const keys = menuItems(home.html, home.finalUrl).filter((m) => isKeyMenu(m.label));
      const idx = JSON.parse(readFileSync(join(p.data, 'cache', 'sites', s.rec.slug, 'pages.json'), 'utf8')) as { pages: { url: string; status: number | null }[] };
      const bad = idx.pages.find((x) => x.status !== null && (x.status === 404 || x.status === 410 || x.status >= 500) && keys.some((k) => k.url.replace(/\/$/, '') === x.url.replace(/\/$/, '')));
      if (bad) {
        would.push('main_nav_404');
        detail.push(`main_nav_404: ${bad.url} answered ${bad.status}`);
      }
    }
    const gphone = nzDigits(cands.get(s.rec.slug)?.phone ?? '');
    const ph = phonesOnSite(pages);
    const all = [...ph.shown, ...ph.tel];
    if (gphone.length >= 8 && all.length && !all.some((x) => x.digits === gphone)) {
      would.push('phone_mismatch');
      detail.push(`phone_mismatch: Google ${cands.get(s.rec.slug)?.phone}, site ${[...new Set(ph.shown.map((x) => x.shown))].slice(0, 3).join(', ')}`);
    }
    const emails = [...new Set(pages.flatMap((x) => emailsOnPage(x.html, x.finalUrl).map((e) => e.email)))];
    for (const e of emails) {
      const d = e.split('@')[1]!;
      if (!mx.has(d)) mx.set(d, mxCheck(e));
      const r = await mx.get(d)!;
      if (!r.ok && MX_DEAD.test(r.error ?? '')) {
        would.push('own_email_dead');
        detail.push(`own_email_dead: ${e} (${r.error})`);
        break;
      }
    }
    if (s.rec.list === 'A' && f.otaLinks.length && !f.ownEngine && !hasAvailabilityForm(pages) && otaLinks(pages).length) {
      would.push('ota_only_booking');
      detail.push(`ota_only_booking: ${f.otaLinks.join(' ')}`);
    }
    if (s.rec.list === 'B') {
      const own = f.ownEngine || (s.contact && s.contact.booking_engine_kind !== 'none');
      const rivals = comp.filter((c) => c.lead === s.rec.slug).slice(0, 3);
      const withB = rivals.filter((r) => {
        const c = contacts.get(registryKey(r.website ?? ''));
        return c && c.booking_engine_kind !== 'none';
      });
      if (!own && rivals.length >= 3 && withB.length >= 2) {
        would.push('no_online_booking_vs_competitors');
        detail.push(`no_online_booking_vs_competitors: ${withB.length} of ${rivals.length} same-town rivals book online`);
      }
    } else na.push('no_online_booking_vs_competitors (accommodation)');
    const l = f.layout;
    if (l.movesSideways && l.scrollWidth - 390 > 20) {
      would.push('not_mobile');
      detail.push(`not_mobile: scrolls sideways to ${l.scrollWidth} px`);
    } else if (!l.viewportMeta && l.innerWidth > 400) {
      would.push('not_mobile');
      detail.push(`not_mobile: no viewport tag, ${l.innerWidth} px wide`);
    }
    out.push({ domain: s.domain, business: s.rec.name, industry: LIST_INDUSTRY[s.rec.list] ?? s.rec.list, wouldFlag: would.join(';'), detail: detail.join(' | '), notApplicable: na.join('; ') });
  }
  return out;
}
