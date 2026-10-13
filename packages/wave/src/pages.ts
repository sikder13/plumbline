import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { paths, slugify, type Viewport } from '@plumbline/core';
import type { PageCapture, Renderer } from '@plumbline/render';

/** Pages read for a wave are kept here, outside the repository, so every fact can be traced to what was on the page. */
export function waveDir(slug: string): string {
  return join(paths.data, 'wave', slug);
}

function pageKey(url: string): string {
  const u = new URL(url);
  const name = slugify(`${u.hostname.replace(/^www\./, '')}${u.pathname}`).slice(0, 60) || 'home';
  return `${name}-${createHash('sha1').update(url).digest('hex').slice(0, 8)}`;
}

export function pageDir(slug: string, url: string): string {
  return join(waveDir(slug), 'pages', pageKey(url));
}

/** Reads one page under robots.txt and the per-host rate limit, and keeps its source, its visible text and, when asked, its screenshots. */
export async function readPage(renderer: Renderer, slug: string, url: string, opts: { viewport?: Viewport; screenshots?: boolean } = {}): Promise<PageCapture> {
  return renderer.render({ url, viewport: opts.viewport ?? 'desktop', outDir: pageDir(slug, url), screenshots: opts.screenshots ?? false });
}

export function savedPages(slug: string): PageCapture[] {
  const dir = join(waveDir(slug), 'pages');
  if (!existsSync(dir)) return [];
  const out: PageCapture[] = [];
  for (const name of readdirSync(dir).sort()) {
    const file = join(dir, name, 'capture.json');
    if (existsSync(file)) out.push(JSON.parse(readFileSync(file, 'utf8')) as PageCapture);
  }
  return out;
}

/** Two addresses for one page: the scheme, a leading www, a trailing slash and a fragment do not matter. */
export function sameAddress(a: string, b: string): boolean {
  const key = (u: string) => u.trim().replace(/#.*$/, '').replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '').toLowerCase();
  return key(a) === key(b);
}

export function savedPage(slug: string, url: string): PageCapture | null {
  return savedPages(slug).find((p) => sameAddress(p.url, url) || sameAddress(p.finalUrl, url)) ?? null;
}

export function savedHtml(page: PageCapture): string {
  const file = page.dir ? join(page.dir, 'page.html') : null;
  return file && existsSync(file) ? readFileSync(file, 'utf8') : '';
}
