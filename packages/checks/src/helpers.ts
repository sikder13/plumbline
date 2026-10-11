import type { Box, CandidateFinding, EvidenceSpec } from '@plumbline/core';
import type { SiteData } from '@plumbline/collect';
import type { PageCapture } from '@plumbline/render';

export function okHomes(site: SiteData): PageCapture[] {
  return [site.homepage.mobile, site.homepage.desktop].filter((p): p is PageCapture => !!p && p.ok);
}

export function home(site: SiteData): PageCapture | null {
  return okHomes(site)[0] ?? null;
}

export function okInner(site: SiteData): PageCapture[] {
  return site.inner.filter((p) => p.ok);
}

/** Homepage on mobile first, then desktop, then inner pages, so the most visible sighting wins. */
export function pagesInOrder(site: SiteData): PageCapture[] {
  return [...okHomes(site), ...okInner(site)];
}

export function whereOf(site: SiteData, page: PageCapture): CandidateFinding['where'] {
  if (page === site.homepage.mobile) return 'homepage_mobile';
  if (page === site.homepage.desktop) return 'homepage_desktop';
  return 'inner';
}

export function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return (u.pathname.replace(/\/$/, '') || '/') + u.search;
  } catch {
    return url;
  }
}

export function norm(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 120);
}

export function elementEvidence(page: PageCapture, selector: string, box: Box | null, excerpt: string): EvidenceSpec {
  return { kind: 'element', url: page.finalUrl, viewport: page.viewport, selector, box: box ?? undefined, excerpt: excerpt.slice(0, 500) };
}

export function pageEvidence(page: PageCapture | null, excerpt: string, url?: string): EvidenceSpec {
  return { kind: 'page', url: url ?? page?.finalUrl, viewport: page?.viewport, excerpt: excerpt.slice(0, 800) };
}

export function siteFinding(checkId: string, site: SiteData, title: string, detail: Record<string, unknown>, excerpt: string, fingerprint = 'site'): CandidateFinding {
  const h = home(site);
  return {
    checkId,
    fingerprint,
    title,
    pageUrl: h?.finalUrl ?? site.homepageUrl,
    viewport: h?.viewport ?? null,
    where: h && h.viewport === 'desktop' ? 'homepage_desktop' : 'homepage_mobile',
    detail,
    evidence: [pageEvidence(h, excerpt, h?.finalUrl ?? site.homepageUrl)],
  };
}

/** Keeps the items present in both lists, compared by a key. */
export function common<T>(a: T[] | undefined, b: T[] | undefined, key: (x: T) => string): T[] {
  const keys = new Set((a ?? []).map(key));
  return (b ?? []).filter((x) => keys.has(key(x)));
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
