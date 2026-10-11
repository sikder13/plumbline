import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Agent, fetch as undiciFetch } from 'undici';
import { ROBOTS_PRODUCT_TOKEN, USER_AGENT_SUFFIX, config, hostOf, paths } from '@plumbline/core';
import { getCrawlDelay, outcomeAllows, outcomeFromResponse, type RobotsOutcome } from './robots.ts';

const require = createRequire(import.meta.url);

let chromeVersion: string | undefined;
function bundledChromeVersion(): string {
  if (chromeVersion) return chromeVersion;
  try {
    const browsers = require('playwright-core/browsers.json') as { browsers: { name: string; browserVersion: string }[] };
    chromeVersion = browsers.browsers.find((b) => b.name === 'chromium')?.browserVersion ?? '140.0.0.0';
  } catch {
    chromeVersion = '140.0.0.0';
  }
  return chromeVersion;
}

/** The ordinary Chromium user agent for the bundled browser, plus the Plumbline token. */
export function userAgent(kind: 'desktop' | 'mobile' = 'desktop'): string {
  const major = `${bundledChromeVersion().split('.')[0]}.0.0.0`;
  const base =
    kind === 'mobile'
      ? `Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major} Mobile Safari/537.36`
      : `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major} Safari/537.36`;
  return `${base} ${USER_AGENT_SUFFIX}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One request start per host every `minDelayMs`, in arrival order. */
export class HostLimiter {
  private next = new Map<string, number>();
  private delay = new Map<string, number>();

  constructor(
    private readonly minDelayMs: number = config.fetch.minDelayMsPerHost,
    private readonly now: () => number = Date.now,
    private readonly wait: (ms: number) => Promise<unknown> = sleep,
  ) {}

  setCrawlDelay(host: string, seconds: number | undefined): void {
    if (seconds !== undefined) this.delay.set(host, Math.max(this.minDelayMs, Math.min(seconds * 1000, 30_000)));
  }

  async acquire(host: string): Promise<void> {
    const gap = this.delay.get(host) ?? this.minDelayMs;
    const t = this.now();
    const at = Math.max(t, this.next.get(host) ?? 0);
    this.next.set(host, at + gap);
    if (at > t) await this.wait(at - t);
  }
}

export interface FetchResult {
  url: string;
  finalUrl: string;
  status: number | null;
  headers: Record<string, string>;
  body: string;
  error?: string;
  redirects: string[];
}

const dispatcher = new Agent({ connect: { timeout: 15_000 }, headersTimeout: 20_000, bodyTimeout: 30_000 });

export interface RawFetchOptions {
  method?: 'GET' | 'HEAD';
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  accept?: string;
}

/** A single request with redirects followed by hand, so each hop is rate limited. */
export async function rawFetch(limiter: HostLimiter, url: string, opts: RawFetchOptions = {}): Promise<FetchResult> {
  const redirects: string[] = [];
  let current = url;
  const maxRedirects = opts.maxRedirects ?? 5;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const host = hostOf(current);
    if (!host) return { url, finalUrl: current, status: null, headers: {}, body: '', error: 'invalid URL', redirects };
    await limiter.acquire(host);
    try {
      const res = await undiciFetch(current, {
        method: opts.method ?? 'GET',
        redirect: 'manual',
        dispatcher,
        signal: AbortSignal.timeout(opts.timeoutMs ?? config.fetch.timeoutMs),
        headers: {
          'user-agent': userAgent('desktop'),
          accept: opts.accept ?? 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'en-NZ,en;q=0.9',
        },
      });
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => (headers[k] = v));
      const location = headers.location;
      if (res.status >= 300 && res.status < 400 && location && hop < maxRedirects) {
        await res.body?.cancel().catch(() => undefined);
        current = new URL(location, current).toString();
        redirects.push(current);
        continue;
      }
      let body = '';
      if ((opts.method ?? 'GET') === 'GET' && res.body) {
        const max = opts.maxBytes ?? 3_000_000;
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of res.body) {
          const buf = Buffer.from(chunk);
          size += buf.length;
          chunks.push(buf);
          if (size >= max) break;
        }
        body = Buffer.concat(chunks).toString('utf8');
      } else {
        await res.body?.cancel().catch(() => undefined);
      }
      return { url, finalUrl: current, status: res.status, headers, body, redirects };
    } catch (e) {
      const err = e as Error & { cause?: { code?: string; message?: string } };
      return { url, finalUrl: current, status: null, headers: {}, body: '', error: err.cause?.code ?? err.cause?.message ?? err.name ?? 'fetch failed', redirects };
    }
  }
  return { url, finalUrl: current, status: null, headers: {}, body: '', error: 'too many redirects', redirects };
}

interface CachedRobots {
  fetchedAt: number;
  status: number | null;
  body: string;
}

/** Fetches and caches robots.txt per origin, for 24 hours at most. */
export class RobotsCache {
  private memory = new Map<string, { at: number; outcome: RobotsOutcome; raw: CachedRobots }>();

  constructor(
    private readonly limiter: HostLimiter,
    private readonly dir: string | null = join(paths.cache, 'robots'),
    private readonly maxAgeMs: number = config.fetch.robotsCacheMs,
    private readonly now: () => number = Date.now,
    private readonly fetcher: (url: string) => Promise<FetchResult> = (u) => rawFetch(limiter, u, { timeoutMs: 15_000, maxBytes: 500_000, accept: 'text/plain,*/*' }),
  ) {}

  private file(origin: string): string | null {
    return this.dir ? join(this.dir, `${origin.replace(/[^a-z0-9.-]+/gi, '_')}.json`) : null;
  }

  async raw(url: string): Promise<CachedRobots & { outcome: RobotsOutcome }> {
    const origin = new URL(url).origin;
    const hit = this.memory.get(origin);
    if (hit && this.now() - hit.at < this.maxAgeMs) return { ...hit.raw, outcome: hit.outcome };

    const file = this.file(origin);
    if (file && existsSync(file)) {
      try {
        const raw = JSON.parse(readFileSync(file, 'utf8')) as CachedRobots;
        if (this.now() - raw.fetchedAt < this.maxAgeMs) {
          const outcome = outcomeFromResponse(raw.status, raw.body);
          this.remember(origin, raw, outcome);
          return { ...raw, outcome };
        }
      } catch {
        // A damaged cache file is treated as missing.
      }
    }

    const res = await this.fetcher(`${origin}/robots.txt`);
    // A robots.txt that redirects off to an HTML page is the same as having none.
    const looksHtml = /^\s*<(!doctype|html)/i.test(res.body);
    const raw: CachedRobots = { fetchedAt: this.now(), status: looksHtml && res.status === 200 ? 404 : res.status, body: looksHtml ? '' : res.body };
    const outcome = outcomeFromResponse(raw.status, raw.body);
    this.remember(origin, raw, outcome);
    if (file) {
      mkdirSync(this.dir!, { recursive: true });
      writeFileSync(file, JSON.stringify(raw));
    }
    return { ...raw, outcome };
  }

  private remember(origin: string, raw: CachedRobots, outcome: RobotsOutcome): void {
    this.memory.set(origin, { at: raw.fetchedAt, outcome, raw });
    if (outcome.kind === 'rules') this.limiter.setCrawlDelay(new URL(origin).host, getCrawlDelay(outcome.robots, ROBOTS_PRODUCT_TOKEN));
  }

  async outcome(url: string): Promise<RobotsOutcome> {
    return (await this.raw(url)).outcome;
  }

  async allows(url: string): Promise<boolean> {
    return outcomeAllows(await this.outcome(url), ROBOTS_PRODUCT_TOKEN, url);
  }
}

/** Counts pages taken from one site in one run, against the per-site cap. */
export class PageBudget {
  private used = 0;
  constructor(readonly max: number = config.fetch.maxPagesPerSite) {}
  take(): boolean {
    if (this.used >= this.max) return false;
    this.used += 1;
    return true;
  }
  get count(): number {
    return this.used;
  }
}

export class Polite {
  readonly limiter: HostLimiter;
  readonly robots: RobotsCache;

  constructor(limiter: HostLimiter = new HostLimiter(), robots?: RobotsCache) {
    this.limiter = limiter;
    this.robots = robots ?? new RobotsCache(limiter);
  }

  /** A robots-checked GET. Returns status null with error 'robots' when disallowed. */
  async get(url: string, opts: RawFetchOptions = {}): Promise<FetchResult> {
    if (!(await this.robots.allows(url))) return { url, finalUrl: url, status: null, headers: {}, body: '', error: 'robots', redirects: [] };
    const res = await rawFetch(this.limiter, url, opts);
    if (res.redirects.length && res.finalUrl !== url && !(await this.robots.allows(res.finalUrl))) {
      return { url, finalUrl: res.finalUrl, status: null, headers: {}, body: '', error: 'robots', redirects: res.redirects };
    }
    return res;
  }

  /** Status of a link: HEAD first, then GET when the server refuses HEAD. Retries on network failure. */
  async status(url: string, opts: { timeoutMs?: number; retries?: number } = {}): Promise<{ status: number | null; finalUrl: string; error?: string }> {
    const timeoutMs = opts.timeoutMs ?? config.links.timeoutMs;
    const retries = opts.retries ?? config.links.retries;
    let last: FetchResult | undefined;
    for (let attempt = 0; attempt <= retries; attempt++) {
      last = await rawFetch(this.limiter, url, { method: 'HEAD', timeoutMs });
      if (last.status === null || [400, 403, 404, 405, 406, 501, 503].includes(last.status)) {
        last = await rawFetch(this.limiter, url, { method: 'GET', timeoutMs, maxBytes: 1024 });
      }
      if (last.status !== null && last.status < 500 && last.status !== 429) break;
    }
    return { status: last!.status, finalUrl: last!.finalUrl, error: last!.error };
  }
}
