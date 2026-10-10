import * as chromeLauncher from 'chrome-launcher';
import { chromium } from 'playwright';
import { config, hostOf, median, utcIso } from '@plumbline/core';
import { userAgent, type Polite } from '@plumbline/fetch';
import type { LighthouseRun, LighthouseSummary } from './types.ts';

interface Lhr {
  lighthouseVersion: string;
  runtimeError?: { message: string };
  categories: { performance?: { score: number | null } };
  audits: Record<string, { numericValue?: number; details?: { items?: { url?: string; transferSize?: number; resourceType?: string }[] } }>;
}

const DESKTOP = {
  formFactor: 'desktop' as const,
  screenEmulation: { mobile: false, width: 1440, height: 900, deviceScaleFactor: 1, disabled: false },
  throttling: { rttMs: 40, throughputKbps: 10 * 1024, cpuSlowdownMultiplier: 1, requestLatencyMs: 0, downloadThroughputKbps: 0, uploadThroughputKbps: 0 },
};
const MOBILE = {
  formFactor: 'mobile' as const,
  screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 3, disabled: false },
};

function summarise(lhr: Lhr): LighthouseRun {
  if (lhr.runtimeError?.message) return { performance: null, lcpMs: null, cls: null, tbtMs: null, error: lhr.runtimeError.message.slice(0, 200) };
  const score = lhr.categories.performance?.score;
  return {
    performance: score === null || score === undefined ? null : Math.round(score * 100),
    lcpMs: lhr.audits['largest-contentful-paint']?.numericValue ?? null,
    cls: lhr.audits['cumulative-layout-shift']?.numericValue ?? null,
    tbtMs: lhr.audits['total-blocking-time']?.numericValue ?? null,
  };
}

function med(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x !== null);
  return v.length ? median(v) : null;
}

/** Runs Lighthouse `runs` times for one form factor and keeps the median of each measure. */
export async function runLighthouse(polite: Polite, url: string, formFactor: 'mobile' | 'desktop', runs: number = config.reproduce.measurementsPerRun): Promise<LighthouseSummary | null> {
  if (!(await polite.robots.allows(url))) return null;
  const host = hostOf(url);
  if (!host) return null;
  const { default: lighthouse } = await import('lighthouse');

  const results: LighthouseRun[] = [];
  let largestImages: { url: string; bytes: number }[] = [];
  let version = '';
  for (let i = 0; i < runs; i++) {
    await polite.limiter.acquire(host);
    const chrome = await chromeLauncher.launch({
      chromePath: chromium.executablePath(),
      chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
      logLevel: 'silent',
    });
    try {
      const result = await lighthouse(
        url,
        { port: chrome.port, output: 'json', logLevel: 'silent', onlyCategories: ['performance'], maxWaitForLoad: 45_000 },
        {
          extends: 'lighthouse:default',
          settings: {
            ...(formFactor === 'desktop' ? DESKTOP : MOBILE),
            emulatedUserAgent: userAgent(formFactor),
            onlyCategories: ['performance'],
          },
        },
      );
      const lhr = result?.lhr as unknown as Lhr | undefined;
      if (!lhr) {
        results.push({ performance: null, lcpMs: null, cls: null, tbtMs: null, error: 'no result' });
        continue;
      }
      version = lhr.lighthouseVersion;
      results.push(summarise(lhr));
      const items = lhr.audits['network-requests']?.details?.items ?? [];
      const images = items
        .filter((it) => it.resourceType === 'Image' && it.url && typeof it.transferSize === 'number')
        .map((it) => ({ url: it.url!, bytes: it.transferSize! }))
        .sort((a, b) => b.bytes - a.bytes)
        .slice(0, 5);
      if (images.length > largestImages.length || !largestImages.length) largestImages = images;
    } catch (e) {
      results.push({ performance: null, lcpMs: null, cls: null, tbtMs: null, error: (e as Error).message.slice(0, 200) });
    } finally {
      await chrome.kill();
    }
  }

  return {
    formFactor,
    url,
    runs: results,
    median: {
      performance: med(results.map((r) => r.performance)),
      lcpMs: med(results.map((r) => r.lcpMs)),
      cls: med(results.map((r) => r.cls)),
      tbtMs: med(results.map((r) => r.tbtMs)),
    },
    largestImages,
    version,
    at: utcIso(),
  };
}
