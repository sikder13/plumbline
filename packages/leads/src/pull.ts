import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { ROOT, slugify } from '@plumbline/core';
import { readInbiz, type Filing } from './inbiz.ts';
import { classifyName, normaliseName, ownerIsAgent, type Dictionary, type TradeGroup } from './names.ts';

export const KEPT_TYPES = ['Domestic Limited Liability Company', 'Domestic For-Profit Corporation'];
export const WINDOW_DAYS = 90;
export const RECENT_DAYS = 45;

export const EXCLUSIONS = ['liquor', 'bar', 'pub', 'tavern', 'lounge', 'club', 'vape', 'smoke', 'tobacco', 'hemp', 'cbd', 'cannabis', 'casino', 'gaming', 'lending', 'loan', 'finance', 'credit', 'pawn', 'adult'];
export const NOISE = ['logistics', 'trucking', 'freight', 'transport', 'hauling', 'holdings', 'properties', 'investments', 'consulting', 'marketing', 'wholesale', 'distribution', 'supply', 'rental', 'realty', 'real estate', 'payroll', 'capital', 'ventures'];

/** Where a campaign keeps its words and its data. */
export function campaignPaths(campaign: string) {
  const data = join(ROOT, 'data', campaign);
  return {
    config: join(ROOT, 'config', campaign),
    data,
    raw: join(data, 'raw'),
    leads: join(data, 'leads'),
    cache: join(data, 'cache', 'places'),
    assets: join(data, 'assets'),
    batches: join(data, 'batches'),
  };
}

export function loadDictionary(campaign: string): Dictionary {
  const dir = campaignPaths(campaign).config;
  const trades = parse(readFileSync(join(dir, 'trades.yml'), 'utf8')) as Dictionary['trades'];
  const franchises = parse(readFileSync(join(dir, 'franchises.yml'), 'utf8')) as string[];
  return { trades, franchises, exclusions: EXCLUSIONS, noise: NOISE };
}

function daysBetween(fromIso: string, to: Date): number {
  return Math.floor((to.getTime() - new Date(`${fromIso}T12:00:00Z`).getTime()) / 86_400_000);
}

export interface ScoreInput {
  trade: string | null;
  group: TradeGroup | null;
  ownerIsAgent: boolean;
  city: string;
  created: string;
}

/** Orders enrichment only: trade word 2, owner filed it 1, a city to search in 1, filed in the last 45 days 1, food, beauty or trades 1. */
export function nameScore(r: ScoreInput, today: Date): number {
  let s = 0;
  if (r.trade) s += 2;
  if (r.ownerIsAgent) s += 1;
  if (r.city.trim()) s += 1;
  if (r.created && daysBetween(r.created, today) <= RECENT_DAYS) s += 1;
  if (r.group === 'food' || r.group === 'beauty' || r.group === 'trades') s += 1;
  return s;
}

export interface PoolRow {
  slug: string;
  control: string;
  name: string;
  created: string;
  type: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  agent: string;
  owner_is_agent: boolean;
  trade: string;
  trade_group: string;
  name_score: number;
  keep: boolean;
  reason: string;
}

export const POOL_COLUMNS: (keyof PoolRow)[] = ['slug', 'control', 'name', 'created', 'type', 'address', 'city', 'state', 'zip', 'agent', 'owner_is_agent', 'trade', 'trade_group', 'name_score', 'keep', 'reason'];

/** One row per filing, kept or dropped with the first reason that applies. */
export function poolFrom(filings: Filing[], dict: Dictionary, today: Date): PoolRow[] {
  const taken = new Set<string>();
  return filings.map((f) => {
    const cls = classifyName(f.name, dict);
    const owner = ownerIsAgent(f.agent);
    let reason = '';
    if (!KEPT_TYPES.includes(f.typeDesc)) reason = `type: ${f.typeDesc || `code ${f.typeCode}, no description`}`;
    else if (f.state !== 'IN') reason = `state: ${f.state || 'none'}`;
    else if (!f.created || daysBetween(f.created, today) > WINDOW_DAYS || daysBetween(f.created, today) < 0) reason = `filed ${f.created || 'unknown'}, outside ${WINDOW_DAYS} days`;
    else if (cls.drop) reason = cls.drop;
    const base = slugify(normaliseName(f.name)) || slugify(f.name) || f.control;
    let slug = base;
    for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
    taken.add(slug);
    return {
      slug,
      control: f.control,
      name: f.name,
      created: f.created,
      type: f.typeDesc,
      address: [f.address, f.address2].filter(Boolean).join(', '),
      city: f.city,
      state: f.state,
      zip: f.zip,
      agent: f.agent,
      owner_is_agent: owner,
      trade: cls.trade ?? '',
      trade_group: cls.group ?? '',
      name_score: nameScore({ trade: cls.trade, group: cls.group, ownerIsAgent: owner, city: f.city, created: f.created }, today),
      keep: !reason,
      reason: reason || 'kept',
    };
  });
}

/** Kept rows, name score first, then newest filing, then name. */
export function candidatesFrom(pool: PoolRow[]): PoolRow[] {
  return pool.filter((r) => r.keep).sort((a, b) => b.name_score - a.name_score || b.created.localeCompare(a.created) || a.name.localeCompare(b.name));
}

export function toCsv<T extends object>(rows: T[], columns: (keyof T)[]): string {
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `${[columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\n')}\n`;
}

export interface PullSummary {
  rows: number;
  domesticInWindow: number;
  tradeHits: number;
  drops: Record<string, number>;
  candidates: number;
  byGroup: Record<string, number>;
}

/** Reads the export, writes _pool.csv and _candidates.csv, and says what happened. */
export function pullLeads(campaign: string, file: string, today: Date = new Date()): PullSummary {
  const p = campaignPaths(campaign);
  const filings = readInbiz(readFileSync(file));
  const pool = poolFrom(filings, loadDictionary(campaign), today);
  const candidates = candidatesFrom(pool);
  mkdirSync(p.leads, { recursive: true });
  writeFileSync(join(p.leads, '_pool.csv'), toCsv(pool, POOL_COLUMNS));
  writeFileSync(join(p.leads, '_candidates.csv'), toCsv(candidates, POOL_COLUMNS));
  const drops: Record<string, number> = {};
  for (const r of pool.filter((x) => !x.keep)) {
    const kind = r.reason.split(':')[0]!.replace(/^filed .*/, 'outside window');
    const key = /^(excluded|noise|franchise)$/.test(kind) ? r.reason : kind;
    drops[key] = (drops[key] ?? 0) + 1;
  }
  const inWindow = pool.filter((r) => !r.reason.startsWith('type') && !r.reason.startsWith('state') && !r.reason.startsWith('filed'));
  const byGroup: Record<string, number> = {};
  for (const r of candidates) byGroup[r.trade_group] = (byGroup[r.trade_group] ?? 0) + 1;
  return { rows: pool.length, domesticInWindow: inWindow.length, tradeHits: inWindow.filter((r) => r.trade).length, drops, candidates: candidates.length, byGroup };
}
