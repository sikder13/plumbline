import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { config, hostOf, median, utcIso } from '@plumbline/core';
import { userAgent, type Polite } from '@plumbline/fetch';
import type { LighthouseRun, LighthouseSummary } from './types.ts';

const WORKER = join(dirname(fileURLToPath(import.meta.url)), 'lighthouse-worker.mjs');

interface WorkerResult {
  error?: string;
  version?: string;
  performance?: number | null;
  lcpMs?: number | null;
  cls?: number | null;
  tbtMs?: number | null;
  images?: { url: string; bytes: number }[];
}

/** One Lighthouse run in a child process, so runs cannot disturb each other or bring down the caller. */
function runOnce(url: string, formFactor: 'mobile' | 'desktop'): Promise<WorkerResult> {
  return new Promise((resolve) => {
    execFile(process.execPath, [WORKER, url, formFactor, chromium.executablePath(), userAgent(formFactor)], { timeout: 150_000, maxBuffer: 16 * 1024 * 1024, killSignal: 'SIGKILL' }, (err, stdout) => {
      const line = stdout.split('\n').find((l) => l.startsWith('PLUMBLINE_LH '));
      if (line) {
        try {
          return resolve(JSON.parse(line.slice('PLUMBLINE_LH '.length)) as WorkerResult);
        } catch {
          // Fall through to the error below.
        }
      }
      resolve({ error: err ? (err.killed ? 'timed out' : err.message.split('\n')[0]!.slice(0, 200)) : 'no result' });
    });
  });
}

function med(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x !== null);
  return v.length ? median(v) : null;
}

export type LighthouseRunner = (url: string, formFactor: 'mobile' | 'desktop') => Promise<WorkerResult>;

/** Runs Lighthouse `runs` times for one form factor and keeps the median of each measure. */
export async function runLighthouse(polite: Polite, url: string, formFactor: 'mobile' | 'desktop', runs: number = config.reproduce.measurementsPerRun, runner: LighthouseRunner = runOnce): Promise<LighthouseSummary | null> {
  if (!(await polite.robots.allows(url))) return null;
  const host = hostOf(url);
  if (!host) return null;

  const results: LighthouseRun[] = [];
  let largestImages: { url: string; bytes: number }[] = [];
  let version = '';
  for (let i = 0; i < runs; i++) {
    await polite.limiter.acquire(host);
    const r = await runner(url, formFactor);
    if (r.version) version = r.version;
    if (r.error) results.push({ performance: null, lcpMs: null, cls: null, tbtMs: null, error: r.error });
    else {
      results.push({ performance: r.performance ?? null, lcpMs: r.lcpMs ?? null, cls: r.cls ?? null, tbtMs: r.tbtMs ?? null });
      if ((r.images?.length ?? 0) > largestImages.length || !largestImages.length) largestImages = r.images ?? [];
    }
  }
  return {
    formFactor,
    url,
    runs: results,
    median: { performance: med(results.map((r) => r.performance)), lcpMs: med(results.map((r) => r.lcpMs)), cls: med(results.map((r) => r.cls)), tbtMs: med(results.map((r) => r.tbtMs)) },
    largestImages,
    version,
    at: utcIso(),
  };
}
