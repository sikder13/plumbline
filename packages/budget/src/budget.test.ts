import { describe, expect, it } from 'vitest';
import { memoryDb } from '@plumbline/core';
import { BudgetStop, guard, loadPrices, placesCallCost, record, spendByProvider, spent, tokenCost } from './index.ts';

const lim = { askAbove: 25, total: 30 };

describe('ledger', () => {
  it('reads the prices file with its source pages and dates', () => {
    const p = loadPrices();
    expect(p.providers.openai.source_url).toMatch(/^https:/);
    expect(p.providers.perplexity.read_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('prices a call from reported token and call counts', () => {
    const p = loadPrices();
    const usd = tokenCost(p, 'openai', 'gpt-6-luna', { inputTokens: 8000, outputTokens: 600, webSearchCalls: 1 });
    expect(usd).toBeCloseTo(0.01 + 0.0008 + 0.0003, 6);
    expect(() => tokenCost(p, 'openai', 'unknown-model', { inputTokens: 1, outputTokens: 1 })).toThrow(/No price/);
  });

  it('sums actual cost where known and the estimate otherwise', () => {
    const db = memoryDb();
    record(db, { provider: 'openai', operation: 'a', units: {}, estimatedUsd: 1, actualUsd: 0.5 });
    record(db, { provider: 'perplexity', operation: 'b', units: {}, estimatedUsd: 2, actualUsd: null });
    expect(spent(db)).toBeCloseTo(2.5);
    expect(spendByProvider(db).map((r) => r.provider)).toEqual(['openai', 'perplexity']);
  });

  it('lets a step through under the ask line', () => {
    const db = memoryDb();
    record(db, { provider: 'openai', operation: 'a', units: {}, estimatedUsd: 20, actualUsd: 20 });
    expect(() => guard(db, 'step', 4.99, { quiet: true }, lim)).not.toThrow();
  });

  it('stops to ask between the ask line and the total', () => {
    const db = memoryDb();
    record(db, { provider: 'openai', operation: 'a', units: {}, estimatedUsd: 24, actualUsd: 24 });
    try {
      guard(db, 'step', 2, { quiet: true }, lim);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(BudgetStop);
      expect((e as BudgetStop).kind).toBe('ask');
    }
    expect(() => guard(db, 'step', 2, { quiet: true, approvedAboveAsk: true }, lim)).not.toThrow();
  });

  it('never passes the total, even with approval', () => {
    const db = memoryDb();
    record(db, { provider: 'openai', operation: 'a', units: {}, estimatedUsd: 29, actualUsd: 29 });
    try {
      guard(db, 'step', 1.01, { quiet: true, approvedAboveAsk: true }, lim);
      expect.unreachable();
    } catch (e) {
      expect((e as BudgetStop).kind).toBe('hard');
    }
  });

  it('counts Places calls as free until 900 in the month, then at list price', () => {
    const db = memoryDb();
    const p = loadPrices();
    const now = new Date('2026-10-10T00:00:00Z');
    expect(placesCallCost(db, p, now)).toEqual({ estimated: 0.035, actual: 0 });
    const ins = db.prepare("INSERT INTO ledger (provider, operation, units, estimated_usd, actual_usd, at) VALUES ('google_places', 'text_search', '{}', 0.035, 0, ?)");
    for (let i = 0; i < 900; i++) ins.run('2026-10-10T01:00:00.000Z');
    expect(placesCallCost(db, p, now).actual).toBe(0.035);
    expect(placesCallCost(db, p, new Date('2026-11-01T00:00:00Z')).actual).toBe(0);
  });
});
