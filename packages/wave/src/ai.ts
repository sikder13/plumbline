import type { Db } from '@plumbline/core';
import { ANSWERS_NEEDED, recordAiFinding, type AiSummary } from '@plumbline/checks';
import type { ImpactEntry } from '@plumbline/impact';
import { setFacts } from './facts.ts';

/**
 * Settles the AI check for one business from its stored answers. Each question is kept as a fact
 * with the number of answers that named the business: a strength where most did. The finding is
 * recorded only when no answer to any of its questions named it.
 */
export function settleAi(db: Db, library: Map<string, ImpactEntry>, business: { id: number; name: string }, batch: string, ai: AiSummary | null, at: string): { finding: 'recorded' | 'dropped' | 'none'; strengths: number } {
  // Without answers there is nothing to settle, and what was settled before stands.
  if (!ai) return { finding: 'none', strengths: 0 };
  const flag = (q: AiSummary['asked'][number]) => (q.answers < ANSWERS_NEEDED ? 'answers still to come' : q.namedIn * 2 > q.answers ? 'strength' : q.namedIn === 0 ? 'not named' : null);
  setFacts(db, business.id, 'ai', ai.asked.map((q) => ({ label: q.question, value: { answers: q.answers, namedIn: q.namedIn, others: q.others.slice(0, 5).map((o) => o.name) }, flag: flag(q) })), ai.lastAskedAt || at);
  return { finding: recordAiFinding(db, library, business, batch, ai, at), strengths: ai.asked.filter((q) => flag(q) === 'strength').length };
}
