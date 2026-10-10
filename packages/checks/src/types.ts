import type { CandidateFinding, Tier } from '@plumbline/core';
import type { SiteData } from '@plumbline/collect';

export interface AiSummary {
  /** Core questions asked for this business (the shared area and town questions). */
  questions: number;
  /** In how many of those questions the business was named at least once. */
  namedIn: number;
  /** Other businesses and the number of answers that named each. */
  others: { name: string; answers: number }[];
  sample: { question: string; provider: string; askedAt: string; answer: string; citations: string[] } | null;
}

export interface CheckContext {
  site: SiteData;
  now: Date;
  ai: AiSummary | null;
}

export interface Check {
  id: string;
  pack: 'core' | 'tourism';
  tier: Tier;
  /** What the evidence for this check is made of. */
  evidenceSpec: 'element' | 'page' | 'ai';
  appliesTo(ctx: CheckContext): boolean;
  evaluate(ctx: CheckContext): CandidateFinding[];
  /**
   * Combines the detail of the same finding from two runs. Returns null when the two runs
   * have nothing in common, which means the finding did not reproduce.
   */
  merge?(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> | null;
}
