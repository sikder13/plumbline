import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseCsv } from '../../batch.ts';
import { toCsv } from '../../pull.ts';
import { bookDirectPaths } from '../discover.ts';
import { hostOfUrl } from '../filters.ts';

/**
 * The campaign's memory: every site the campaign has ever crawled, one row per domain. Rows are only
 * ever added or updated, never deleted. A domain here is skipped by later sweeps unless a re-audit is
 * asked for by name.
 */
export interface RegistryRow {
  domain: string;
  business: string;
  industry: string;
  first_audited: string;
  last_audited: string;
  audit_version: string;
  outcome: string;
}

export const REGISTRY_COLUMNS: (keyof RegistryRow)[] = ['domain', 'business', 'industry', 'first_audited', 'last_audited', 'audit_version', 'outcome'];

/** The audit rules the registry's rows were checked under: 1 is relay 01's, 2 the ten checks of relay 02. */
export const AUDIT_VERSION = 2;

export function registryFile(): string {
  return join(bookDirectPaths().data, 'registry', 'audited.csv');
}

/** The registry key of a website: its host without "www.". */
export function registryKey(url: string): string {
  return hostOfUrl(url);
}

export class Registry {
  readonly rows = new Map<string, RegistryRow>();

  constructor(readonly file: string = registryFile()) {
    if (existsSync(file)) for (const r of parseCsv(readFileSync(file, 'utf8')) as unknown as RegistryRow[]) if (r.domain) this.rows.set(r.domain, r);
  }

  has(urlOrDomain: string): boolean {
    return this.rows.has(registryKey(urlOrDomain));
  }

  get(urlOrDomain: string): RegistryRow | undefined {
    return this.rows.get(registryKey(urlOrDomain));
  }

  /** Adds a domain, or updates it: the first audit date is kept, everything else is the latest. */
  record(r: Omit<RegistryRow, 'first_audited'> & { first_audited?: string }): void {
    const domain = registryKey(r.domain);
    if (!domain) return;
    const prev = this.rows.get(domain);
    this.rows.set(domain, { ...r, domain, first_audited: prev?.first_audited || r.first_audited || r.last_audited });
  }

  save(): void {
    mkdirSync(dirname(this.file), { recursive: true });
    // Rows are never dropped: whatever is on disk now and not in memory is kept as it is.
    const onDisk = existsSync(this.file) ? (parseCsv(readFileSync(this.file, 'utf8')) as unknown as RegistryRow[]) : [];
    for (const r of onDisk) if (r.domain && !this.rows.has(r.domain)) this.rows.set(r.domain, r);
    const rows = [...this.rows.values()].sort((a, b) => a.first_audited.localeCompare(b.first_audited) || a.domain.localeCompare(b.domain));
    writeFileSync(this.file, toCsv(rows, REGISTRY_COLUMNS));
  }
}
