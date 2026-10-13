import type { Db } from '@plumbline/core';
import { recordAiFinding, type AiSummary } from '@plumbline/checks';
import type { ImpactEntry } from '@plumbline/impact';
import { setFacts } from './facts.ts';

/**
 * Settles the AI check for one business from its stored answers. Each question is kept as a fact
 * with the number of answers that named the business: a strength where most did. The finding is
 * recorded only when no answer to any of its questions named it.
 */
export function settleAi(db: Db, library: Map<string, ImpactEntry>, business: { id: number; name: string }, batch: string, ai: AiSummary | null, at: string): { finding: 'recorded' | 'dropped' | 'none'; strengths: number } {
  const asked = ai?.asked ?? [];
  const flag = (q: AiSummary['asked'][number]) => (q.namedIn * 2 > q.answers ? 'strength' : q.namedIn === 0 ? 'not named' : null);
  const when = asked.map((q) => q.sample?.askedAt).filter((x): x is string => !!x).sort()[0] ?? at;
  setFacts(db, business.id, 'ai', asked.map((q) => ({ label: q.question, value: { answers: q.answers, namedIn: q.namedIn, others: q.others.slice(0, 5).map((o) => o.name) }, flag: flag(q) })), when);
  return { finding: recordAiFinding(db, library, business, batch, ai, at), strengths: asked.filter((q) => flag(q) === 'strength').length };
}
