import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The repository root. A bundler can move this file, so PLUMBLINE_ROOT overrides the computed path. */
export const ROOT = process.env.PLUMBLINE_ROOT ? resolve(process.env.PLUMBLINE_ROOT) : resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

export const paths = {
  root: ROOT,
  env: join(ROOT, '.env'),
  data: join(ROOT, 'data'),
  db: join(ROOT, 'data', 'plumbline.db'),
  evidence: join(ROOT, 'data', 'evidence'),
  captures: join(ROOT, 'data', 'captures'),
  brand: join(ROOT, 'data', 'brand'),
  cache: join(ROOT, 'data', 'cache'),
  reports: join(ROOT, 'reports'),
  exports: join(ROOT, 'exports'),
  inputs: join(ROOT, 'inputs'),
  migrations: join(ROOT, 'migrations'),
  library: join(ROOT, 'impact', 'library.yaml'),
  prices: join(ROOT, 'prices.json'),
  calibration: join(ROOT, 'calibration'),
};

let cached: Record<string, string> | undefined;

/** Reads .env once. Values are returned to callers and never logged. */
export function env(): Record<string, string> {
  if (cached) return cached;
  const out: Record<string, string> = {};
  if (existsSync(paths.env)) {
    for (const line of readFileSync(paths.env, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      out[m[1]!] = m[2]!.replace(/^(['"])(.*)\1$/, '$2');
    }
  }
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && out[k] === undefined) out[k] = v;
  }
  cached = out;
  return out;
}

export function requireEnv(name: string): string {
  const v = env()[name];
  if (!v) throw new Error(`${name} is not set in .env`);
  return v;
}

export const USER_AGENT_SUFFIX = 'PlumblineAudit/1.0 (+https://nahltech.com)';
export const ROBOTS_PRODUCT_TOKEN = 'PlumblineAudit';

export const VIEWPORTS = {
  mobile: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
} as const;
export type Viewport = keyof typeof VIEWPORTS;

export const config = {
  fetch: {
    minDelayMsPerHost: 2000,
    maxPagesPerSite: 25,
    robotsCacheMs: 24 * 60 * 60 * 1000,
    timeoutMs: 30_000,
  },
  links: { timeoutMs: 15_000, retries: 2, maxInternal: 40, maxExternal: 30 },
  reproduce: { minGapMinutes: 60, measurementsPerRun: 3 },
  fresh: { maxAgeHours: 24 },
  evidence: { contextPx: 120, boxPx: 4, boxColor: '#E4572E', maxWidth: { mobile: 1080, desktop: 1600 } },
  score: {
    visibility: { homepage_mobile: 1.0, homepage_desktop: 0.8, inner: 0.6 },
    tier: { measured: 1.0, rule: 0.9, judgment: 0.8 },
  },
  outreach: {
    ownerConfirmed: 2,
    secondNamed: 1,
    strongGoogle: 1,
    strongGoogleMinRating: 4.5,
    strongGoogleMinReviews: 50,
    formOnlyPenalty: -3,
  },
  qualify: { manualCheckAboveReviews: 3000 },
  places: { maxQueries: 160, perDay: 300, freeMonthlyUntil: 900 },
};
