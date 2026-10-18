import { utcIso } from '@plumbline/core';
import type { LighthouseRun, LighthouseSummary } from '@plumbline/collect';

export interface PsiRun {
  performance: number | null;
  lcpMs: number | null;
  cls: number | null;
  tbtMs: number | null;
  error?: string;
}

export type PsiRunner = (url: string) => Promise<PsiRun>;

/** Two scores that differ by more than this share of the higher one are not a measurement. */
export const UNSTABLE_ABOVE = 0.2;
export const SLOW = { performanceBelow: 50, lcpAboveMs: 4000 };

export interface SpeedResult {
  source: 'PageSpeed Insights API';
  status: 'ok' | 'unstable' | 'unavailable';
  runs: PsiRun[];
  /** Difference between the two scores as a share of the higher one. */
  spread: number | null;
  performance: number | null;
  lcpMs: number | null;
  reason: string | null;
  measuredAt: string;
}

const mean = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);

/** Two runs in, one verdict out. Fewer than two usable runs is "unavailable", two that disagree is "unstable". */
export function speedVerdict(runs: PsiRun[], measuredAt: string = utcIso()): SpeedResult {
  const base = { source: 'PageSpeed Insights API' as const, runs, spread: null, performance: null, lcpMs: null, measuredAt };
  const usable = runs.filter((r) => r.performance !== null && !r.error);
  if (usable.length < 2) return { ...base, status: 'unavailable', reason: runs.find((r) => r.error)?.error ?? 'fewer than two runs gave a score' };
  const [a, b] = [usable[0]!.performance!, usable[1]!.performance!];
  const high = Math.max(a, b);
  const spread = high === 0 ? 0 : Math.abs(a - b) / high;
  const lcps = usable.map((r) => r.lcpMs).filter((x): x is number => x !== null);
  const result = { ...base, spread: Math.round(spread * 1000) / 1000, performance: mean([a, b]), lcpMs: lcps.length ? mean(lcps) : null };
  return spread > UNSTABLE_ABOVE ? { ...result, status: 'unstable', reason: `the two scores ${a} and ${b} differ by ${Math.round(spread * 100)}%` } : { ...result, status: 'ok', reason: null };
}

/** Slow on a phone: a steady score under 50 and main content after 4 seconds in both runs. */
export function isSlowOnPhone(s: SpeedResult): boolean {
  if (s.status !== 'ok') return false;
  const usable = s.runs.filter((r) => r.performance !== null && !r.error);
  return usable.length >= 2 && usable.every((r) => r.performance! < SLOW.performanceBelow && r.lcpMs !== null && r.lcpMs > SLOW.lcpAboveMs);
}

/** The shape the check engine reads, from the two API runs. Only a steady measurement is given to it. */
export function asLighthouse(url: string, s: SpeedResult): LighthouseSummary | null {
  if (s.status !== 'ok') return null;
  const runs: LighthouseRun[] = s.runs.map((r) => ({ performance: r.performance, lcpMs: r.lcpMs, cls: r.cls, tbtMs: r.tbtMs }));
  const med = (f: (r: PsiRun) => number | null) => {
    const v = s.runs.map(f).filter((x): x is number => x !== null);
    return v.length ? mean(v) : null;
  };
  return { formFactor: 'mobile', url, runs, median: { performance: s.performance, lcpMs: s.lcpMs, cls: med((r) => r.cls), tbtMs: med((r) => r.tbtMs) }, largestImages: [], version: 'PageSpeed Insights', at: s.measuredAt };
}

const redact = (s: string, key: string | undefined) => s.replace(/key=[^&\s"']+/gi, 'key=<hidden>').replace(key ? new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g') : /$^/, '<hidden>');

/** One PageSpeed Insights run on a phone. The key is read from PAGESPEED_API_KEY and never printed. */
export function psiRunner(key: string | undefined, fetcher: typeof fetch = fetch): PsiRunner {
  return async (url) => {
    const query = new URLSearchParams({ url, strategy: 'mobile', category: 'performance' });
    if (key) query.set('key', key);
    const empty = { performance: null, lcpMs: null, cls: null, tbtMs: null };
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetcher(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${query}`, { signal: AbortSignal.timeout(150_000) });
        const data = (await res.json()) as {
          error?: { code?: number; status?: string; message?: string };
          lighthouseResult?: { categories?: { performance?: { score?: number | null } }; audits?: Record<string, { numericValue?: number }>; runtimeError?: { message?: string } };
        };
        if (data.error) {
          const code = data.error.code ?? res.status;
          if ((code === 429 || code >= 500) && attempt === 0) {
            await new Promise((r) => setTimeout(r, 20_000));
            continue;
          }
          return { ...empty, error: redact(`PageSpeed API answered ${code} ${data.error.status ?? ''}: ${(data.error.message ?? '').slice(0, 120)}`, key) };
        }
        const lr = data.lighthouseResult;
        const score = lr?.categories?.performance?.score;
        if (typeof score !== 'number') return { ...empty, error: lr?.runtimeError?.message ? `PageSpeed could not score the page: ${lr.runtimeError.message.slice(0, 100)}` : 'PageSpeed gave no score' };
        const audit = (id: string) => lr?.audits?.[id]?.numericValue ?? null;
        return { performance: Math.round(score * 100), lcpMs: audit('largest-contentful-paint'), cls: audit('cumulative-layout-shift'), tbtMs: audit('total-blocking-time') };
      } catch (e) {
        if (attempt === 1) return { ...empty, error: redact(`PageSpeed request failed: ${(e as Error).message.slice(0, 100)}`, key) };
      }
    }
    return { ...empty, error: 'PageSpeed gave no answer' };
  };
}

/** Runs the API twice, one after the other, and judges the pair. */
export async function measureSpeed(url: string, run: PsiRunner, now: () => string = utcIso): Promise<SpeedResult> {
  const first = await run(url);
  // A key that is refused will be refused again: one more call would only repeat the error.
  if (first.error && /answered (?:400|401|403|404|429)/.test(first.error)) return speedVerdict([first], now());
  const second = await run(url);
  return speedVerdict([first, second], now());
}
