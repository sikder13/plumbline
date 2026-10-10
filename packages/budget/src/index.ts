import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { env, paths, utcIso, type Db } from '@plumbline/core';

const ModelPrice = z.object({
  input_per_mtok: z.number().nonnegative(),
  cached_input_per_mtok: z.number().nonnegative(),
  output_per_mtok: z.number().nonnegative(),
});

const Prices = z.object({
  currency: z.literal('USD'),
  approved_on: z.string(),
  providers: z.object({
    openai: z.object({
      source_url: z.string().url(),
      read_on: z.string(),
      tools: z.object({ web_search_per_call: z.number() }),
      models: z.record(z.string(), ModelPrice),
    }),
    perplexity: z.object({
      source_url: z.string().url(),
      read_on: z.string(),
      tools: z.object({ web_search_per_call: z.number(), fetch_url_per_call: z.number() }),
      models: z.record(z.string(), ModelPrice),
    }),
    google_places: z.object({
      source_url: z.string().url(),
      read_on: z.string(),
      per_call: z.number(),
      free_calls_per_month: z.number(),
      count_as_free_until: z.number(),
    }),
  }),
});
export type Prices = z.infer<typeof Prices>;
export type Provider = keyof Prices['providers'];

export function loadPrices(file: string = paths.prices): Prices {
  return Prices.parse(JSON.parse(readFileSync(file, 'utf8')));
}

export interface Limits {
  askAbove: number;
  total: number;
}

export function limits(): Limits {
  const e = env();
  const askAbove = Number(e.BUDGET_ASK_ABOVE_USD);
  const total = Number(e.BUDGET_TOTAL_USD);
  if (!Number.isFinite(askAbove) || !Number.isFinite(total) || askAbove <= 0 || total < askAbove) {
    throw new Error('BUDGET_ASK_ABOVE_USD and BUDGET_TOTAL_USD must be set, with the total at or above the ask line');
  }
  return { askAbove, total };
}

export interface TokenUsage {
  inputTokens: number;
  cachedInputTokens?: number;
  outputTokens: number;
  webSearchCalls?: number;
  fetchUrlCalls?: number;
}

export function tokenCost(prices: Prices, provider: 'openai' | 'perplexity', model: string, u: TokenUsage): number {
  const p = prices.providers[provider];
  const m = p.models[model];
  if (!m) throw new Error(`No price for ${provider} model ${model} in prices.json`);
  const cached = u.cachedInputTokens ?? 0;
  const fresh = Math.max(0, u.inputTokens - cached);
  let usd = (fresh * m.input_per_mtok + cached * m.cached_input_per_mtok + u.outputTokens * m.output_per_mtok) / 1_000_000;
  usd += (u.webSearchCalls ?? 0) * p.tools.web_search_per_call;
  if (provider === 'perplexity') usd += (u.fetchUrlCalls ?? 0) * prices.providers.perplexity.tools.fetch_url_per_call;
  return usd;
}

/** Money already committed: the actual cost where known, otherwise the estimate. */
export function spent(db: Db): number {
  const row = db.prepare('SELECT COALESCE(SUM(COALESCE(actual_usd, estimated_usd)), 0) AS usd FROM ledger').get() as { usd: number };
  return row.usd;
}

export function spendByProvider(db: Db): { provider: string; calls: number; estimated: number; actual: number }[] {
  return db
    .prepare(
      `SELECT provider, COUNT(*) AS calls, SUM(estimated_usd) AS estimated, SUM(COALESCE(actual_usd, estimated_usd)) AS actual
       FROM ledger GROUP BY provider ORDER BY provider`,
    )
    .all() as { provider: string; calls: number; estimated: number; actual: number }[];
}

export class BudgetStop extends Error {
  constructor(
    readonly kind: 'ask' | 'hard',
    readonly spentUsd: number,
    readonly estimateUsd: number,
    readonly limit: number,
  ) {
    super(
      kind === 'hard'
        ? `Refused: spent $${spentUsd.toFixed(4)} plus estimate $${estimateUsd.toFixed(4)} would pass the hard total of $${limit.toFixed(2)}.`
        : `Stopped to ask: spent $${spentUsd.toFixed(4)} plus estimate $${estimateUsd.toFixed(4)} would pass the ask line of $${limit.toFixed(2)}.`,
    );
  }
}

export interface GuardOptions {
  /** Set only after UD has said yes to spending between the ask line and the total. */
  approvedAboveAsk?: boolean;
  quiet?: boolean;
}

/**
 * Call before every paid step. Prints the estimate and throws when the running
 * total would cross a limit. The hard total can never be passed.
 */
export function guard(db: Db, label: string, estimateUsd: number, opts: GuardOptions = {}, lim: Limits = limits()): void {
  const already = spent(db);
  const after = already + estimateUsd;
  if (!opts.quiet) {
    console.log(`[budget] ${label}: estimate $${estimateUsd.toFixed(4)}, spent so far $${already.toFixed(4)}, after $${after.toFixed(4)}`);
  }
  if (after > lim.total) throw new BudgetStop('hard', already, estimateUsd, lim.total);
  if (after > lim.askAbove && !opts.approvedAboveAsk) throw new BudgetStop('ask', already, estimateUsd, lim.askAbove);
}

export function record(
  db: Db,
  entry: { provider: Provider; operation: string; units: Record<string, unknown>; estimatedUsd: number; actualUsd: number | null },
): number {
  const r = db
    .prepare('INSERT INTO ledger (provider, operation, units, estimated_usd, actual_usd, at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(entry.provider, entry.operation, JSON.stringify(entry.units), entry.estimatedUsd, entry.actualUsd, utcIso());
  return Number(r.lastInsertRowid);
}

/** Calls recorded for a provider in the given UTC month (YYYY-MM) or day (YYYY-MM-DD). */
export function callCount(db: Db, provider: Provider, prefix: string): number {
  const row = db.prepare('SELECT COUNT(*) AS n FROM ledger WHERE provider = ? AND at LIKE ?').get(provider, `${prefix}%`) as { n: number };
  return row.n;
}

/** Google Places: free while the month's count is under the agreed line, list price after. */
export function placesCallCost(db: Db, prices: Prices, now: Date = new Date()): { estimated: number; actual: number } {
  const g = prices.providers.google_places;
  const used = callCount(db, 'google_places', now.toISOString().slice(0, 7));
  return { estimated: g.per_call, actual: used < g.count_as_free_until ? 0 : g.per_call };
}
