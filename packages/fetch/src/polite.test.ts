import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HostLimiter, PageBudget, Polite, RobotsCache, rawFetch, userAgent, type FetchResult } from './polite.ts';

describe('HostLimiter', () => {
  it('spaces request starts on one host by the minimum delay', async () => {
    let clock = 1000;
    const waits: number[] = [];
    const lim = new HostLimiter(2000, () => clock, async (ms) => {
      waits.push(ms);
    });
    await lim.acquire('a.nz');
    await lim.acquire('a.nz');
    await lim.acquire('a.nz');
    expect(waits).toEqual([2000, 4000]);
    clock = 20_000;
    await lim.acquire('a.nz');
    expect(waits).toEqual([2000, 4000]);
  });

  it('does not make one host wait for another', async () => {
    const waits: number[] = [];
    const lim = new HostLimiter(2000, () => 0, async (ms) => {
      waits.push(ms);
    });
    await lim.acquire('a.nz');
    await lim.acquire('b.nz');
    expect(waits).toEqual([]);
  });

  it('raises the delay to a declared crawl-delay but never lowers it', async () => {
    const waits: number[] = [];
    const lim = new HostLimiter(2000, () => 0, async (ms) => {
      waits.push(ms);
    });
    lim.setCrawlDelay('a.nz', 5);
    lim.setCrawlDelay('b.nz', 0.5);
    await lim.acquire('a.nz');
    await lim.acquire('a.nz');
    await lim.acquire('b.nz');
    await lim.acquire('b.nz');
    expect(waits).toEqual([5000, 2000]);
  });
});

describe('RobotsCache', () => {
  const res = (status: number | null, body = ''): FetchResult => ({ url: '', finalUrl: '', status, headers: {}, body, redirects: [] });

  it('fetches once and reuses the answer for 24 hours, then fetches again', async () => {
    let clock = 0;
    let calls = 0;
    const cache = new RobotsCache(new HostLimiter(0), null, 24 * 3600_000, () => clock, async () => {
      calls += 1;
      return res(200, 'User-agent: *\nDisallow: /private');
    });
    expect(await cache.allows('https://e.nz/private/x')).toBe(false);
    expect(await cache.allows('https://e.nz/open')).toBe(true);
    clock = 23 * 3600_000;
    await cache.allows('https://e.nz/');
    expect(calls).toBe(1);
    clock = 25 * 3600_000;
    await cache.allows('https://e.nz/');
    expect(calls).toBe(2);
  });

  it('allows everything on 404 and nothing on 500 or a network failure', async () => {
    const make = (r: FetchResult) => new RobotsCache(new HostLimiter(0), null, 1000, Date.now, async () => r);
    expect(await make(res(404)).allows('https://e.nz/')).toBe(true);
    expect(await make(res(500)).allows('https://e.nz/')).toBe(false);
    expect(await make(res(null)).allows('https://e.nz/')).toBe(false);
  });

  it('treats an HTML page served for robots.txt as no robots.txt', async () => {
    const cache = new RobotsCache(new HostLimiter(0), null, 1000, Date.now, async () => res(200, '<!DOCTYPE html><html><body>Disallow: /</body></html>'));
    expect(await cache.allows('https://e.nz/')).toBe(true);
  });
});

describe('PageBudget', () => {
  it('stops at the cap', () => {
    const b = new PageBudget(2);
    expect([b.take(), b.take(), b.take()]).toEqual([true, true, false]);
    expect(b.count).toBe(2);
  });
});

describe('fetching against a local server', () => {
  let server: Server;
  let base = '';
  const seen: { path: string; ua: string; method: string }[] = [];

  beforeAll(async () => {
    server = createServer((req, res) => {
      seen.push({ path: req.url ?? '', ua: req.headers['user-agent'] ?? '', method: req.method ?? '' });
      if (req.url === '/robots.txt') return void res.writeHead(200, { 'content-type': 'text/plain' }).end('User-agent: *\nDisallow: /blocked\n');
      if (req.url === '/redirect') return void res.writeHead(302, { location: '/landed' }).end();
      if (req.url === '/to-blocked') return void res.writeHead(302, { location: '/blocked/page' }).end();
      if (req.url === '/no-head' && req.method === 'HEAD') return void res.writeHead(405).end();
      if (req.url === '/missing') return void res.writeHead(404).end('gone');
      res.writeHead(200, { 'content-type': 'text/html' }).end('<p>ok</p>');
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => server.close());

  const polite = () => {
    const lim = new HostLimiter(0);
    return new Polite(lim, new RobotsCache(lim, null));
  };

  it('sends the Chromium user agent with the Plumbline token', async () => {
    await rawFetch(new HostLimiter(0), `${base}/`);
    expect(seen.at(-1)!.ua).toMatch(/Chrome\/\d+\.0\.0\.0 Safari\/537\.36 PlumblineAudit\/1\.0 \(\+https:\/\/nahltech\.com\)$/);
    expect(userAgent('mobile')).toMatch(/Mobile Safari.*PlumblineAudit\/1\.0/);
  });

  it('follows redirects and reports the final URL', async () => {
    const r = await rawFetch(new HostLimiter(0), `${base}/redirect`);
    expect(r.status).toBe(200);
    expect(r.finalUrl).toBe(`${base}/landed`);
  });

  it('does not fetch a disallowed URL', async () => {
    const before = seen.length;
    const r = await polite().get(`${base}/blocked/page`);
    expect(r.error).toBe('robots');
    expect(seen.slice(before).map((s) => s.path)).toEqual(['/robots.txt']);
  });

  it('drops the body when a redirect lands on a disallowed URL', async () => {
    const r = await polite().get(`${base}/to-blocked`);
    expect(r.error).toBe('robots');
    expect(r.body).toBe('');
  });

  it('reports link status, falling back to GET when HEAD is refused', async () => {
    const p = polite();
    expect((await p.status(`${base}/no-head`)).status).toBe(200);
    expect((await p.status(`${base}/missing`)).status).toBe(404);
    expect((await p.status('http://127.0.0.1:1/', { retries: 0, timeoutMs: 2000 })).status).toBeNull();
  });
});
