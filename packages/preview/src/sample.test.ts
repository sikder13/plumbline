import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPicture } from './build.ts';
import { staticSample, visitScript } from './sample.ts';

const BUILT = [
  '<!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/>',
  '<link rel="preload" href="/demo/fonts/clash-display-latin-600-normal.woff2" as="font" crossorigin="" type="font/woff2"/>',
  '<link rel="stylesheet" href="/demo/_next/static/chunks/26rl0xtfjgw5l.css" data-precedence="next"/>',
  '<link rel="preload" as="script" fetchPriority="low" href="/demo/_next/static/chunks/a.js"/>',
  '<link rel="modulepreload" href="/demo/_next/static/chunks/b.js"/>',
  '<link rel="icon" href="/demo/_next/static/media/favicon.ico"/>',
  "<style data-precedence=\"design\">@font-face{font-family:'Inter';src:url(/demo/fonts/inter-latin-wght-normal.woff2) format('woff2')}.wall__root{color:red}</style>",
  '<script src="/demo/_next/static/chunks/a.js" async=""></script></head>',
  '<body><main class="wall__root"><h1>Book.</h1></main>',
  '<script data-page="">document.documentElement.dataset.motion="";</script>',
  '<script>(self.__next_f=self.__next_f||[]).push([0])</script>',
  '<script>self.__next_f.push([1,"payload"])</script>',
  '</body></html>',
].join('');

describe('staticSample', () => {
  it('takes out the framework’s scripts and stylesheets and keeps the page’s own', () => {
    const { html } = staticSample(BUILT, 'haute-ink-zfy8pj');
    expect(html).not.toContain('/_next/');
    expect(html).not.toContain('__next_f');
    expect(html).toContain('<script data-page="">document.documentElement.dataset.motion="";</script>');
    expect(html).toContain('.wall__root{color:red}');
    expect(html).toContain('<h1>Book.</h1>');
  });

  it('points every font at the page’s own folder and lists the files', () => {
    const { html, fonts } = staticSample(BUILT, 'haute-ink-zfy8pj');
    expect(html).toContain('href="/demo/haute-ink-zfy8pj/fonts/clash-display-latin-600-normal.woff2" as="font"');
    expect(html).toContain('url(/demo/haute-ink-zfy8pj/fonts/inter-latin-wght-normal.woff2)');
    expect(html).not.toMatch(/\/demo\/fonts\//);
    expect(fonts).toEqual(['clash-display-latin-600-normal.woff2', 'inter-latin-wght-normal.woff2']);
  });

  it('leaves a page with nothing to take out as it is', () => {
    const plain = '<html><head><link rel="preload" href="/demo/p/img/a.webp" as="image"/></head><body><script data-page>1</script></body></html>';
    expect(staticSample(plain, 'p')).toEqual({ html: plain, fonts: [] });
  });
});

/** Runs the visit script in a bare window of its own and records what it sends. */
function run(href: string, opts: { stored?: Record<string, string>; gpc?: boolean } = {}) {
  const store = new Map(Object.entries(opts.stored ?? {}));
  const listeners = new Map<string, ((e?: unknown) => void)[]>();
  const docListeners = new Map<string, ((e?: unknown) => void)[]>();
  const posts: { token: string; kind: string }[] = [];
  const url = { current: href };
  const on = (map: typeof listeners) => (name: string, fn: (e?: unknown) => void) => map.set(name, [...(map.get(name) ?? []), fn]);
  const off = (map: typeof listeners) => (name: string, fn: (e?: unknown) => void) => map.set(name, (map.get(name) ?? []).filter((f) => f !== fn));
  const window = {
    URL,
    JSON,
    Math,
    setTimeout,
    clearTimeout,
    performance: { now: () => Date.now() },
    location: {
      get href() {
        return url.current;
      },
    },
    history: { state: null, replaceState: (_s: unknown, _t: string, next: string) => (url.current = new URL(next, url.current).href) },
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) },
    navigator: { globalPrivacyControl: !!opts.gpc, doNotTrack: null },
    document: { readyState: 'loading', visibilityState: 'visible', addEventListener: on(docListeners), removeEventListener: off(docListeners) },
    addEventListener: on(listeners),
    removeEventListener: off(listeners),
    fetch: (_url: string, init: { body: string }) => {
      posts.push(JSON.parse(init.body) as { token: string; kind: string });
      return Promise.resolve();
    },
  };
  runInNewContext(visitScript({ token: 'haute-ink-zfy8pj', endpoint: 'https://example.test/api/demo-visit', own: { param: 'nahl-own', key: 'nahl-own' } }), window);
  const fire = (name: string) => (listeners.get(name) ?? []).forEach((f) => f());
  return { posts, store, url, fire };
}

describe('visitScript', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sends one view with the page’s token once the page has been on screen for three seconds after it wakes', () => {
    const page = run('https://nahltech.com/demo/haute-ink-zfy8pj/');
    page.fire('load');
    vi.advanceTimersByTime(4900);
    expect(page.posts).toEqual([]);
    vi.advanceTimersByTime(200);
    expect(page.posts).toEqual([{ token: 'haute-ink-zfy8pj', kind: 'view' }]);
    vi.advanceTimersByTime(60_000);
    expect(page.posts).toHaveLength(1);
  });

  it('starts counting at the first touch', () => {
    const page = run('https://nahltech.com/demo/haute-ink-zfy8pj/');
    page.fire('pointerdown');
    vi.advanceTimersByTime(2900);
    expect(page.posts).toEqual([]);
    vi.advanceTimersByTime(200);
    expect(page.posts).toHaveLength(1);
  });

  it('marks our own browser from the query flag, takes the flag out of the address and sends nothing', () => {
    const page = run('https://nahltech.com/demo/haute-ink-zfy8pj/?nahl-own=1#book');
    page.fire('load');
    vi.advanceTimersByTime(60_000);
    expect(page.posts).toEqual([]);
    expect(page.store.get('nahl-own')).toBe('1');
    expect(page.url.current).toBe('https://nahltech.com/demo/haute-ink-zfy8pj/#book');
  });

  it('sends nothing from a browser already marked as ours, or from one that asks not to be tracked', () => {
    for (const page of [run('https://nahltech.com/demo/p/', { stored: { 'nahl-own': '1' } }), run('https://nahltech.com/demo/p/', { gpc: true })]) {
      page.fire('load');
      vi.advanceTimersByTime(60_000);
      expect(page.posts).toEqual([]);
    }
  });
});

describe('a photograph a content file asks for as WebP with a JPEG fallback', () => {
  it('offers WebP at each width and falls back to a JPEG, with no AVIF', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'plumb-pic-'));
    try {
      const source = join(dir, 'photo.jpg');
      await sharp({ create: { width: 900, height: 1200, channels: 3, background: '#7a5c3e' } }).jpeg().toFile(source);
      const out = join(dir, 'img');
      const p = await buildPicture(source, out, '/demo/p/img', 'p01', { file: 'photo.jpg', alt: 'A tattoo', widths: [400, 800, 1200], formats: ['webp', 'jpeg'] });
      expect(p.sources.map((x) => x.type)).toEqual(['image/webp']);
      expect(p.sources[0]!.srcset).toBe('/demo/p/img/p01-400.webp 400w, /demo/p/img/p01-800.webp 800w, /demo/p/img/p01-900.webp 900w');
      expect(p.fallback).toBe('/demo/p/img/p01-800.jpg');
      for (const f of ['p01-400.jpg', 'p01-800.jpg', 'p01-900.jpg', 'p01-900.webp']) expect(existsSync(join(out, f)), f).toBe(true);
      expect(existsSync(join(out, 'p01-400.avif'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
