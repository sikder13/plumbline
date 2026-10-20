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

