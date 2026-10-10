import { mkdtempSync, readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ROOT, type Business } from '@plumbline/core';
import { captureBrand, voiceSamples, type BrandCapture } from '@plumbline/brand';
import { HostLimiter, Polite, RobotsCache } from '@plumbline/fetch';
import { Renderer } from '@plumbline/render';
import { contactLinkProblems } from './links.ts';
import { runLighthouse } from './lighthouse.ts';
import { collectSite } from './site.ts';
import type { SiteData } from './types.ts';

const fx = (name: string) => readFileSync(join(ROOT, 'fixtures', 'site', name), 'utf8');
const svg = (fill: string, w: number, h: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${fill}"/></svg>`;

let server: Server;
let base = '';
let renderer: Renderer;
let polite: Polite;
let site: SiteData;
const brand: Partial<Record<'mobile' | 'desktop', BrandCapture>> = {};
const requests: string[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    const path = (req.url ?? '').split('?')[0]!;
    requests.push(`${req.method} ${path}`);
    const html = (body: string, extra: Record<string, string> = {}) => res.writeHead(200, { 'content-type': 'text/html', ...extra }).end(body);
    if (path === '/robots.txt') return void res.writeHead(200, { 'content-type': 'text/plain' }).end(`User-agent: *\nDisallow: /private/\n\nUser-agent: PerplexityBot\nDisallow: /\n\nSitemap: ${base}/sitemap.xml\n`);
    if (path === '/sitemap.xml') return void res.writeHead(200, { 'content-type': 'application/xml' }).end(`<?xml version="1.0"?><urlset><url><loc>${base}/</loc></url><url><loc>${base}/tours/</loc></url></urlset>`);
    if (path === '/') return void html(fx('home.html'), { 'x-powered-by': 'PHP/7.4.33' });
    if (path === '/tours/') return void html(fx('tours.html'));
    if (path === '/about/') return void html(fx('about.html'));
    if (path === '/contact/') return void html('<!doctype html><html lang="en"><head><title>Contact</title></head><body><h1>Contact</h1><p>Phone 09 402 8105</p></body></html>');
    if (path === '/listing') return void html(fx('listing.html'));
    if (path === '/logo.svg') return void res.writeHead(200, { 'content-type': 'image/svg+xml' }).end(svg('#0b4f6c', 120, 40));
    if (path === '/hero.svg') return void res.writeHead(200, { 'content-type': 'image/svg+xml' }).end(svg('#0b4f6c', 1600, 600));
    if (path === '/photo.svg') return void res.writeHead(200, { 'content-type': 'image/svg+xml' }).end(svg('#88aacc', 800, 500));
    res.writeHead(404, { 'content-type': 'text/html' }).end('<h1>Not found</h1>');
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const limiter = new HostLimiter(50);
  polite = new Polite(limiter, new RobotsCache(limiter, null));
  renderer = new Renderer(polite);
  const dir = mkdtempSync(join(tmpdir(), 'plumbline-site-'));
  const business = { id: 1, slug: 'harbour-fixture', name: 'Harbour Fixture Charters', website: `${base}/`, domain: null, region: 'Northland', town: 'Paihia', activity: 'Fishing charter', google_rating: 4.8, google_review_count: 67 } as Business;
  site = await collectSite(polite, renderer, business, {
    runId: 1,
    kind: 'A',
    dir,
    innerPages: 6,
    listingUrls: [`${base}/listing`, `${base}/private/listing`],
    onHomepage: async (page, _cap, viewport) => {
      brand[viewport] = await captureBrand(page, viewport, join(dir, 'brand'));
    },
  });
}, 180_000);
afterAll(async () => {
  await renderer.stop();
  server.close();
});

describe('collectSite on the fixture site', () => {
  it('captures the homepage at both viewports and the inner pages on mobile', () => {
    expect(site.blocked).toBeNull();
    expect(site.homepage.mobile!.ok).toBe(true);
    expect(site.homepage.desktop!.layout.innerWidth).toBe(1440);
    expect(site.inner.map((p) => new URL(p.finalUrl).pathname).sort()).toEqual(['/about/', '/contact/', '/old-page/', '/tours/']);
    expect(site.inner.every((p) => p.viewport === 'mobile')).toBe(true);
    expect(site.errors).toEqual([]);
  });

  it('checks link status and finds the broken ones', () => {
    const status = (path: string) => site.links.find((l) => new URL(l.url).pathname === path)?.status;
    expect(status('/tours/')).toBe(200);
    expect(status('/old-page/')).toBe(404);
    expect(status('/missing-page/')).toBe(404);
    expect(site.links.find((l) => new URL(l.url).pathname === '/old-page/')!.seen[0]).toMatchObject({ text: 'Deals', inNav: true });
  });

  it('finds malformed contact links on the homepage', () => {
    expect(contactLinkProblems(site.homepage.mobile!).map((p) => p.kind).sort()).toEqual(['mailto', 'tel']);
  });

  it('detects the platform, its version and end of life', () => {
    expect(site.technologies.find((t) => t.name === 'WordPress')?.version).toBe('4.5.3');
    expect(site.technologies.find((t) => t.name === 'PHP')?.version).toBe('7.4.33');
    expect(site.eol.map((e) => e.product).sort()).toEqual(['PHP', 'WordPress']);
  });

  it('finds the booking system linked from an inner page', () => {
    expect(site.booking.map((b) => [b.system, new URL(b.pageUrl).pathname, b.visibleLink])).toEqual([['Rezdy', '/tours/', true]]);
  });

  it('reads robots.txt, the sitemap and structured data', () => {
    expect(site.robots.outcome).toBe('rules');
    expect(site.robots.botBlocks.find((b) => b.bot === 'PerplexityBot')!.blocked.length).toBeGreaterThan(0);
    expect(site.robots.botBlocks.find((b) => b.bot === 'Googlebot')!.blocked).toEqual([]);
    expect(site.sitemap).toMatchObject({ found: true, urls: 2 });
    expect(site.structuredData).toMatchObject({ hasLocalBusinessFamily: false, types: [] });
  });

  it('runs axe on the homepage at both viewports and keeps only serious and critical results', () => {
    expect(site.axe.mobile).not.toBeNull();
    expect(site.axe.desktop).not.toBeNull();
    const all = [...site.axe.mobile!, ...site.axe.desktop!];
    expect(all.every((v) => v.impact === 'serious' || v.impact === 'critical')).toBe(true);
    expect(all.map((v) => v.id)).toContain('label');
    expect(all.find((v) => v.id === 'label')!.nodes[0]!.box).not.toBeNull();
  });

  it('fetches listings that robots.txt allows and records a block without fetching', () => {
    expect(site.listings[0]).toMatchObject({ status: 'fetched', rating: 4.8, reviewCount: 67 });
    expect(site.listings[1]).toMatchObject({ status: 'robots' });
    expect(requests.some((r) => r.includes('/private/'))).toBe(false);
  });

  it('never asks for more pages than the cap', () => {
    const pageLoads = requests.filter((r) => r.startsWith('GET /') && /^GET \/(tours|about|contact|old-page)?\/?$/.test(r));
    expect(pageLoads.length).toBeLessThanOrEqual(25 * 2);
  });

  it('captures the brand pack from the homepage', () => {
    const d = brand.desktop!;
    expect(d.logoSourceUrl).toBe(`${base}/logo.svg`);
    expect(readFileSync(d.logoPath!, 'utf8')).toContain('<svg');
    expect(d.colours.length).toBeLessThanOrEqual(6);
    expect(d.colours.map((c) => c.hex)).toContain('#0b4f6c');
    expect(d.colours.find((c) => c.hex === '#fdfaf3')!.role).toBe('background');
    expect(d.colours.reduce((s, c) => s + c.share, 0)).toBeLessThanOrEqual(1.001);
    expect(d.fonts.body).toContain('Georgia');
    expect(d.fonts.headings).toContain('Verdana');
    expect(d.hero).toMatchObject({ url: `${base}/hero.svg` });
    expect(d.heroPath).not.toBeNull();
    expect(d.images.map((i) => i.url)).toEqual([`${base}/photo.svg`]);
    expect(brand.mobile!.logoSourceUrl).toBe(`${base}/logo.svg`);
  });

  it('picks short voice quotes with their page', () => {
    const about = site.inner.find((p) => p.finalUrl.endsWith('/about/'))!;
    const quotes = voiceSamples([site.homepage.desktop!, about]);
    expect(quotes.map((q) => q.quote)).toContain('We believe every guest should feel like family.');
    expect(quotes.every((q) => q.quote.split(/\s+/).length <= 15)).toBe(true);
    expect(quotes.length).toBeLessThanOrEqual(5);
  });

  it('measures speed with Lighthouse and keeps the median', async () => {
    const lh = await runLighthouse(polite, `${base}/`, 'mobile', 2);
    expect(lh!.runs).toHaveLength(2);
    expect(lh!.median.performance).toBeGreaterThan(0);
    expect(lh!.median.lcpMs).toBeGreaterThan(0);
    expect(lh!.version).toMatch(/^13\./);
    expect(requests.length).toBeGreaterThan(0);
  }, 120_000);
});
