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
  /** True when this question's answers fall into two groups at least 60 minutes apart, neither names the business and both name others. */
  holdsInBothPasses: boolean;
}

/** How many answers a question needs before anything is concluded from it. */
export const ANSWERS_NEEDED = 4;

export interface AiSummary {
  /** Answers to the one question where the business does best. The sample below is from that same question. */
  questions: number;
  /** In how many of those answers the business was named. */
  namedIn: number;
  /** Other businesses named in those answers, and the number of answers that named each. */
  others: { name: string; answers: number }[];
  sample: { question: string; provider: string; askedAt: string; answer: string; citations: string[] } | null;
  /** Every question asked about the business's own activities, each with its own count. */
  asked: AskedQuestion[];
  /** When the newest of all those answers was given. */
  lastAskedAt: string;
  /** Minutes between the first and the last answer. */
  spanMinutes: number;
  /** True when every question asked has all its answers and holds in both passes. */
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
