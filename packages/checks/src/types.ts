import type { CandidateFinding, Tier } from '@plumbline/core';
import type { SiteData } from '@plumbline/collect';

/** How the answers to one question treated a business. */
export interface AskedQuestion {
  question: string;
  answers: number;
  /** In how many of those answers the business was named. */
  namedIn: number;
  others: { name: string; answers: number }[];
  /** One answer that does not name the business, or the first answer when all do. */
  sample: { provider: string; askedAt: string; answer: string; citations: string[] } | null;
}

export interface AiSummary {
  /** Answers received to the questions about this business's own activities. */
  questions: number;
  /** In how many of those answers the business was named. */
  namedIn: number;
  /** Other businesses and the number of answers that named each. */
  others: { name: string; answers: number }[];
  sample: { question: string; provider: string; askedAt: string; answer: string; citations: string[] } | null;
  /** The same answers, question by question. */
  asked: AskedQuestion[];
  /** Minutes between the first and the last answer. */
  spanMinutes: number;
  /** True when the answers fall into two groups at least 60 minutes apart and both show the same picture. */
  holdsInBothPasses: boolean;
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
