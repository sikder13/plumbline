import type { Box, Viewport } from '@plumbline/core';
import type { PageCapture } from '@plumbline/render';

export interface LinkSighting {
  pageUrl: string;
  viewport: Viewport;
  text: string;
  selector: string;
  box: Box | null;
  inNav: boolean;
  raw: string;
}

export interface LinkStatus {
  url: string;
  internal: boolean;
  status: number | null;
  error: string | null;
  finalUrl: string;
  skipped: 'robots' | null;
  seen: LinkSighting[];
}

export interface LighthouseRun {
  performance: number | null;
  lcpMs: number | null;
  cls: number | null;
  tbtMs: number | null;
  error?: string;
}

export interface LighthouseSummary {
  formFactor: 'mobile' | 'desktop';
  url: string;
  runs: LighthouseRun[];
  median: { performance: number | null; lcpMs: number | null; cls: number | null; tbtMs: number | null };
  largestImages: { url: string; bytes: number }[];
  version: string;
  at: string;
}

export interface AxeViolation {
  id: string;
  impact: 'serious' | 'critical';
  help: string;
  helpUrl: string;
  nodes: { target: string; html: string; box: Box | null; summary: string }[];
  nodeCount: number;
}

export interface Technology {
  name: string;
  version: string | null;
  categories: string[];
}

export interface BookingSignal {
  system: string;
  kind: 'system' | 'platform';
  url: string;
  pageUrl: string;
  how: 'link' | 'iframe' | 'script' | 'html';
  visibleLink: boolean;
}

export interface EolHit {
  product: string;
  version: string;
  eolDate: string;
  sourceUrl: string;
  detectedFrom: string;
}

export interface StructuredData {
  types: string[];
  hasLocalBusinessFamily: boolean;
  items: number;
  errors: { message: string; severity: string; type: string }[];
}

export interface RobotsFacts {
  status: number | null;
  outcome: 'rules' | 'allow_all' | 'disallow_all';
  body: string;
  blocksHomepage: boolean;
  sitemaps: string[];
  /** For each named bot, the key pages it may not read. */
  botBlocks: { bot: string; ownGroup: boolean; blocked: string[] }[];
}

export interface ListingData {
  url: string;
  platform: string;
  kind: 'booking_system' | 'booking_platform' | 'directory' | 'review' | 'other';
  status: 'fetched' | 'robots' | 'blocked' | 'error' | 'not_fetched';
  name: string | null;
  phones: string[];
  emails: string[];
  prices: { amount: number; text: string; context: string }[];
  rating: number | null;
  reviewCount: number | null;
}

export interface SiteData {
  runId: number;
  kind: 'A' | 'B' | 'recheck';
  startedAt: string;
  finishedAt: string;
  business: {
    id: number;
    slug: string;
    name: string;
    website: string;
    domain: string | null;
    region: string | null;
    town: string | null;
    activity: string | null;
    googleRating: number | null;
    googleReviewCount: number | null;
  };
  homepageUrl: string;
  robots: RobotsFacts;
  blocked: 'robots_blocks_homepage' | 'unreachable' | null;
  homepage: { mobile: PageCapture | null; desktop: PageCapture | null };
  inner: PageCapture[];
  links: LinkStatus[];
  lighthouse: { mobile: LighthouseSummary | null; desktop: LighthouseSummary | null };
  axe: { mobile: AxeViolation[] | null; desktop: AxeViolation[] | null };
  technologies: Technology[];
  eol: EolHit[];
  booking: BookingSignal[];
  structuredData: StructuredData | null;
  sitemap: { found: boolean; url: string | null; urls: number };
  https: { homepageScheme: string; certError: boolean; httpUpgrades: boolean | null };
  listings: ListingData[];
  errors: string[];
}

export function allPages(site: SiteData): PageCapture[] {
  return [site.homepage.mobile, site.homepage.desktop, ...site.inner].filter((p): p is PageCapture => !!p && p.ok);
}
