import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { slugify, type Business, type Db } from '@plumbline/core';
import { isNamed, namedCandidates, openAiAsk, perCallEstimate, perplexityAsk, runPlan, type AiPlan, type Citation, type ProviderName, type RunResult } from '@plumbline/ai';
import { loadPrices } from '@plumbline/budget';
import { contentDir } from './paths.ts';

const PROVIDERS: ProviderName[] = ['openai', 'perplexity'];
const RUNS = 3;

/**
 * Questions written by hand for one business, used in place of the generated ones when those asked
 * about the wrong kind of business. They live with the business content, outside the repository.
 */
export function correctedQuestions(slug: string): string[] {
  const file = join(contentDir(slug), 'questions.json');
  if (!existsSync(file)) return [];
  const list = JSON.parse(readFileSync(file, 'utf8')) as unknown;
  if (!Array.isArray(list) || list.some((q) => typeof q !== 'string' || !q.trim())) throw new Error(`${file} must be a list of questions`);
  return list as string[];
}

export function questionKey(slug: string, question: string): string {
  return `preview:${slug}:${slugify(question).slice(0, 80)}`;
}

/** What is still to ask: every question, through both providers, three runs each, less the answers already stored. */
export function planCorrected(db: Db, slug: string, questions: string[]): AiPlan {
  const have = db.prepare('SELECT 1 FROM ai_answers WHERE question_key = ? AND provider = ? AND run_index = ?');
  const toRun: AiPlan['toRun'] = [];
  let cached = 0;
  for (const question of questions) {
    const key = questionKey(slug, question);
    for (const provider of PROVIDERS) {
      for (let runIndex = 0; runIndex < RUNS; runIndex++) {
        if (have.get(key, provider, runIndex)) cached += 1;
        else toRun.push({ provider, key, question, scope: 'shared', businessId: null, runIndex });
      }
    }
  }
  const perCall = perCallEstimate(db, loadPrices());
  const estimateUsd = { openai: toRun.filter((t) => t.provider === 'openai').length * perCall.openai, perplexity: toRun.filter((t) => t.provider === 'perplexity').length * perCall.perplexity };
  return { businesses: 1, items: [], shared: questions.length, brand: 0, callsPerProvider: questions.length * RUNS, cached, toRun, estimateUsd, totalUsd: estimateUsd.openai + estimateUsd.perplexity, perCall };
}

export async function askCorrected(db: Db, plan: AiPlan): Promise<RunResult> {
  const prices = loadPrices();
  return runPlan(db, plan, { asks: { openai: openAiAsk(prices), perplexity: perplexityAsk(prices) }, concurrency: 3 });
}

export interface CorrectedAnswer {
  provider: string;
  model: string;
  runIndex: number;
  askedAt: string;
  named: boolean;
  matchedBy: string | null;
  answer: string;
  citations: string[];
}

export interface CorrectedQuestion {
  question: string;
  key: string;
  answers: CorrectedAnswer[];
  namedIn: number;
  /** Other names the answers put forward, with the number of answers each appears in. */
  others: { name: string; answers: number }[];
}

export interface CorrectedSummary {
  questions: CorrectedQuestion[];
  answers: number;
  namedIn: number;
  /** True when every planned answer is stored, so a zero really means zero. */
  complete: boolean;
}

/** How a business fares in its corrected questions, read from the stored answers. */
export function correctedSummary(db: Db, business: Pick<Business, 'slug' | 'name' | 'domain' | 'town' | 'region'>, questions: string[]): CorrectedSummary {
  const out: CorrectedQuestion[] = [];
  for (const question of questions) {
    const key = questionKey(business.slug, question);
    const rows = db.prepare('SELECT provider, model, run_index, asked_at, answer, citations FROM ai_answers WHERE question_key = ? ORDER BY provider, run_index').all(key) as { provider: string; model: string; run_index: number; asked_at: string; answer: string; citations: string }[];
    const others = new Map<string, { name: string; answers: number }>();
    const answers = rows.map((r) => {
      const citations = JSON.parse(r.citations) as Citation[];
      const m = isNamed(business, r.answer, citations);
      for (const name of namedCandidates(r.answer)) {
        if (isNamed(business, name, []).named) continue;
        const k = name.toLowerCase();
        const e = others.get(k) ?? { name, answers: 0 };
        e.answers += 1;
        others.set(k, e);
      }
      return { provider: r.provider, model: r.model, runIndex: r.run_index, askedAt: r.asked_at, named: m.named, matchedBy: m.by, answer: r.answer, citations: citations.map((c) => c.url) };
    });
    out.push({ question, key, answers, namedIn: answers.filter((a) => a.named).length, others: [...others.values()].sort((a, b) => b.answers - a.answers).slice(0, 12) });
  }
  const total = out.reduce((n, q) => n + q.answers.length, 0);
  return { questions: out, answers: total, namedIn: out.reduce((n, q) => n + q.namedIn, 0), complete: questions.length > 0 && total === questions.length * PROVIDERS.length * RUNS };
}
