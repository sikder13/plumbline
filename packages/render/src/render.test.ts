import { mkdtempSync, readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ROOT } from '@plumbline/core';
import { HostLimiter, Polite, RobotsCache } from '@plumbline/fetch';
import { Renderer } from './render.ts';

const fixture = (name: string) => readFileSync(join(ROOT, 'fixtures', 'render', name), 'utf8');
const PIXEL = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="teal"/></svg>`;

let server: Server;
let base = '';
let renderer: Renderer;
const hits: { path: string; ua: string; at: number }[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    const path = req.url ?? '';
    hits.push({ path, ua: req.headers['user-agent'] ?? '', at: Date.now() });
    if (path === '/robots.txt') return void res.writeHead(200, { 'content-type': 'text/plain' }).end('User-agent: *\nDisallow: /private\n');
    if (path === '/pixel.svg') return void res.writeHead(200, { 'content-type': 'image/svg+xml' }).end(PIXEL);
    if (path === '/reveal') return void res.writeHead(200, { 'content-type': 'text/html' }).end(fixture('reveal.html'));
    if (path === '/visibility') return void res.writeHead(200, { 'content-type': 'text/html' }).end(fixture('visibility.html'));
    if (path === '/' || path === '/about') return void res.writeHead(200, { 'content-type': 'text/html' }).end(fixture('site.html'));
    if (path === '/moved') return void res.writeHead(301, { location: '/private/landing' }).end();
    res.writeHead(404, { 'content-type': 'text/html' }).end('<h1>Not found</h1>');
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const limiter = new HostLimiter(300);
  renderer = new Renderer(new Polite(limiter, new RobotsCache(limiter, null)));
  await renderer.start();
});
afterAll(async () => {
  await renderer.stop();
  server.close();
});

describe('Renderer', () => {
  it('captures the visible content of a page at the mobile viewport', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'plumbline-render-'));
    const cap = await renderer.render({ url: `${base}/`, viewport: 'mobile', outDir: dir });
    expect(cap.ok).toBe(true);
    expect(cap.status).toBe(200);
    expect(cap.meta.title).toBe('Fixture Kayaks | Guided tours');
    expect(cap.meta.description).toBe('Guided kayak tours in Fixture Bay.');
    expect(cap.meta.jsonld).toHaveLength(1);
    expect(cap.text).toContain('adults $95');
    expect(cap.text).toContain('© 2019 Fixture Kayaks');
    expect(cap.layout.deviceWidth).toBe(390);
    expect(cap.layout.scrollWidth).toBe(700);
    expect(cap.layout.horizontalScroll).toBe(true);
    expect(cap.links.find((l) => l.text === 'Book now')).toMatchObject({ visible: true, fold: true, href: 'https://fixture.rezdy.com/' });
    expect(cap.links.filter((l) => l.inNav).map((l) => l.raw)).toEqual(['/', '#', 'javascript:void(0)', '/about', '/missing']);
    expect(cap.capturedAtNz).toMatch(/NZ[DS]T$/);
    expect(hits.find((h) => h.path === '/')!.ua).toMatch(/Mobile Safari.*PlumblineAudit\/1\.0/);

    const broken = cap.images.find((i) => i.src === '/broken.jpg')!;
    expect(broken).toMatchObject({ visible: true, naturalWidth: 0, complete: true });
    expect(cap.badResponses.some((r) => r.url.endsWith('/broken.jpg') && r.status === 404)).toBe(true);
    expect(cap.images.find((i) => i.src === '/pixel.svg')!.naturalWidth).toBe(80);

    // Tiles are at the device scale and cover the page from the top.
    expect(cap.tiles[0]).toMatchObject({ y: 0 });
    const tile = await sharp(join(dir, cap.tiles[0]!.file)).metadata();
    expect(tile.width! / cap.layout.innerWidth).toBeCloseTo(tile.height! / cap.tiles[0]!.h, 1);
    expect(JSON.parse(readFileSync(join(dir, 'capture.json'), 'utf8')).finalUrl).toBe(`${base}/`);
    expect(readFileSync(join(dir, 'page.html'), 'utf8')).toContain('Fixture Kayaks');
  });

  it('captures the desktop viewport at 1440 wide', async () => {
    const cap = await renderer.render({ url: `${base}/`, viewport: 'desktop' });
    expect(cap.layout.innerWidth).toBe(1440);
    expect(cap.layout.horizontalScroll).toBe(false);
    expect(hits.at(-1)!.ua).not.toMatch(/Mobile/);
  });

  it('does not load a page robots.txt disallows', async () => {
    const before = hits.length;
    const cap = await renderer.render({ url: `${base}/private/page`, viewport: 'mobile' });
    expect(cap.blocked).toBe('robots');
    expect(hits.slice(before).some((h) => h.path.startsWith('/private'))).toBe(false);
  });

  it('discards a page when a redirect lands somewhere robots.txt disallows', async () => {
    const cap = await renderer.render({ url: `${base}/moved`, viewport: 'mobile' });
    expect(cap.blocked).toBe('robots');
    expect(cap.text).toBe('');
  });

  it('reports the status of an error page', async () => {
    const cap = await renderer.render({ url: `${base}/gone`, viewport: 'mobile' });
    expect(cap.status).toBe(404);
    expect(cap.ok).toBe(false);
  });

  it('reports a site that cannot be reached without throwing', async () => {
    const cap = await renderer.render({ url: 'http://127.0.0.1:1/', viewport: 'mobile' });
    expect(cap.ok).toBe(false);
    expect(cap.blocked ?? cap.error).toBeTruthy();
  });

  it('spaces page loads on one host by the rate limit', async () => {
    const before = hits.length;
    await renderer.render({ url: `${base}/about`, viewport: 'mobile' });
    await renderer.render({ url: `${base}/about`, viewport: 'mobile' });
    const pages = hits.slice(before).filter((h) => h.path === '/about');
    expect(pages[1]!.at - pages[0]!.at).toBeGreaterThanOrEqual(290);
  });

  it('keeps text that a scroll effect shows on screen and hides again afterwards', async () => {
    const cap = await renderer.render({ url: `${base}/reveal`, viewport: 'mobile' });
    expect(cap.text).toContain('REVEAL-ON-SCROLL Adults $95');
    expect(cap.text).not.toContain('NEVER-SHOWN');
  });

  it('loads lazy images by scrolling before it reads them', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'plumbline-render-'));
    const cap = await renderer.render({ url: `${base}/reveal`, viewport: 'mobile', outDir: dir });
    const tile = await sharp(join(dir, cap.tiles[0]!.file)).metadata();
    expect([tile.width, tile.height]).toEqual([390 * 3, cap.tiles[0]!.h * 3]);
    expect(cap.tiles.reduce((sum, t) => sum + t.h, 0)).toBe(cap.layout.docH);
    expect(cap.images.find((i) => i.src === '/pixel.svg')).toMatchObject({ naturalWidth: 80, visible: true, loading: 'lazy' });
  });

  it('agrees with the visibility fixture when it is served and rendered for real', async () => {
    const cap = await renderer.render({ url: `${base}/visibility`, viewport: 'desktop' });
    expect(cap.text).toContain('PLAIN-VISIBLE');
    for (const hidden of ['googletagmanager', 'Toggle navigation', 'SLIDE-TWO', 'SR-ONLY', 'TEMPLATE-TEXT']) expect(cap.text).not.toContain(hidden);
  });
});
