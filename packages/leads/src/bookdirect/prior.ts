import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { ROOT } from '@plumbline/core';
import { parseCsv } from '../batch.ts';
import { hostOfUrl, nameKey, type DiscoverConfig, type PriorContact } from './filters.ts';

const at = (p: string) => (isAbsolute(p) ? p : join(ROOT, p));

/**
 * Everyone already emailed in NZ waves 1 to 4 and Wine Hopper, and everyone on the shared suppression
 * list, read from the main checkout. Every row of those lists counts, sent or not: a reserve that was
 * never emailed is still a business we prepared a pitch for.
 */
export function loadPriorContact(cfg: DiscoverConfig['priorContact']): PriorContact & { files: { file: string; rows: number }[] } {
  const prior: PriorContact & { files: { file: string; rows: number }[] } = { domains: new Set(), emails: new Set(), nameTowns: new Set(), files: [] };
  const addEmail = (raw: string) => {
    for (const e of raw.split(/[;,\s]+/)) {
      const v = e.trim().toLowerCase();
      if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) prior.emails.add(v);
    }
  };
  const sup = at(cfg.suppression);
  if (existsSync(sup)) {
    const rows = parseCsv(readFileSync(sup, 'utf8'));
    for (const r of rows) {
      const d = hostOfUrl(r.domain ?? '');
      if (d) prior.domains.add(d);
      addEmail(r.emails ?? r.email ?? '');
      if (r.slug) prior.nameTowns.add(`${nameKey(r.slug.replace(/-/g, ' '))}|`);
    }
    prior.files.push({ file: sup, rows: rows.length });
  } else prior.files.push({ file: sup, rows: -1 });
  for (const f of cfg.lists) {
    const file = at(f);
    if (!existsSync(file)) {
      prior.files.push({ file, rows: -1 });
      continue;
    }
    const rows = parseCsv(readFileSync(file, 'utf8'));
    for (const r of rows) {
      const d = hostOfUrl(r.website ?? '');
      if (d) prior.domains.add(d);
      addEmail(r.email ?? '');
      const name = r.business_name || r.name || '';
      if (name) prior.nameTowns.add(`${nameKey(name)}|${nameKey(r.town ?? '')}`);
    }
    prior.files.push({ file, rows: rows.length });
  }
  for (const d of cfg.extraDomains) prior.domains.add(d.toLowerCase());
  for (const nt of cfg.extraNames) {
    const [n, t] = nt.split('|');
    prior.nameTowns.add(`${nameKey(n ?? '')}|${nameKey(t ?? '')}`);
  }
  return prior;
}
