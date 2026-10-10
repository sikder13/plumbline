import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { VIEWPORTS, bothTimes, hostOf, type Box, type Viewport } from '@plumbline/core';
import { userAgent, type Polite } from '@plumbline/fetch';

const INPAGE = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'inpage.js'), 'utf8');

export interface TextBlock {
  text: string;
  tag: string;
  heading: string | null;
  selector: string;
  box: Box;
  fontSize: number;
  href: string | null;
  inHeader: boolean;
  inNav: boolean;
  inFooter: boolean;
}

export interface PageLink {
  raw: string;
  href: string;
  text: string;
  visible: boolean;
  fold: boolean;
  box: Box | null;
  selector: string;
  target: string;
  hasHandler: boolean;
  inHeader: boolean;
  inNav: boolean;
  inFooter: boolean;
}

export interface PageControl {
  tag: string;
  text: string;
  src: string;
  action: string;
  fields: number;
  hasEmailField: boolean;
  fold: boolean;
  box: Box;
  selector: string;
}

export interface PageImage {
  src: string;
  currentSrc: string;
  alt: string | null;
  naturalWidth: number;
  naturalHeight: number;
  complete: boolean;
  width: number;
  height: number;
  visible: boolean;
  box: Box | null;
  selector: string;
  loading: string;
  lazyAttr: boolean;
  inHeader: boolean;
  inNav: boolean;
  inFooter: boolean;
}

export interface PageMeta {
  title: string;
  description: string | null;
  canonical: string | null;
  robots: string | null;
  viewport: string | null;
  generator: string[];
  lang: string;
  og: Record<string, string>;
  hreflangs: string[];
  h1: string[];
  h1Total: number;
  jsonld: string[];
  scripts: string[];
  stylesheets: string[];
  iframes: string[];
}

export interface PageLayout {
  innerWidth: number;
  innerHeight: number;
  deviceWidth: number;
  scrollWidth: number;
  docW: number;
  docH: number;
  horizontalScroll: boolean;
  wide: { selector: string; box: Box; right: number }[];
}

export interface Tile {
  file: string;
  y: number;
  h: number;
}

export interface PageCapture {
  url: string;
  finalUrl: string;
  viewport: Viewport;
  status: number | null;
  ok: boolean;
  blocked: 'robots' | null;
  error: string | null;
  certError: boolean;
  headers: Record<string, string>;
  capturedAtUtc: string;
  capturedAtNz: string;
  blocks: TextBlock[];
  text: string;
  links: PageLink[];
  controls: PageControl[];
  images: PageImage[];
  meta: PageMeta;
  layout: PageLayout;
  consoleErrors: string[];
  failedRequests: { url: string; error: string; type: string }[];
  badResponses: { url: string; status: number; type: string }[];
  mixedContent: string[];
  requestHosts: string[];
  htmlFile: string | null;
  tiles: Tile[];
  scale: number;
  dir: string | null;
}

export interface RenderRequest {
  url: string;
  viewport: Viewport;
  /** Directory for the HTML and screenshot tiles. Nothing is written when omitted. */
  outDir?: string;
  screenshots?: boolean;
  /** Runs against the live page after capture, before it closes. */
  onPage?: (page: Page, capture: PageCapture) => Promise<void>;
}

const EMPTY_META: PageMeta = {
  title: '',
  description: null,
  canonical: null,
  robots: null,
  viewport: null,
  generator: [],
  lang: '',
  og: {},
  hreflangs: [],
  h1: [],
  h1Total: 0,
  jsonld: [],
  scripts: [],
  stylesheets: [],
  iframes: [],
};

function emptyCapture(url: string, viewport: Viewport): PageCapture {
  const t = bothTimes();
  return {
    url,
    finalUrl: url,
    viewport,
    status: null,
    ok: false,
    blocked: null,
    error: null,
    certError: false,
    headers: {},
    capturedAtUtc: t.utc,
    capturedAtNz: t.nz,
    blocks: [],
    text: '',
    links: [],
    controls: [],
    images: [],
    meta: EMPTY_META,
    layout: { innerWidth: VIEWPORTS[viewport].width, innerHeight: VIEWPORTS[viewport].height, deviceWidth: VIEWPORTS[viewport].width, scrollWidth: 0, docW: 0, docH: 0, horizontalScroll: false, wide: [] },
    consoleErrors: [],
    failedRequests: [],
    badResponses: [],
    mixedContent: [],
    requestHosts: [],
    htmlFile: null,
    tiles: [],
    scale: VIEWPORTS[viewport].deviceScaleFactor,
    dir: null,
  };
}

const SCROLL_STEP = 600;
const SCROLL_PAUSE = 400;
const MAX_STEPS = 60;
const TILE_HEIGHT = { mobile: 2000, desktop: 3000 } as const;
const MAX_CAPTURE_HEIGHT = { mobile: 14_000, desktop: 18_000 } as const;

async function quiet(page: Page, ms: number): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: ms }).catch(() => undefined);
}

/** Scrolls to the bottom in steps so lazy content loads, calling `each` after every pause. */
export async function scrollThrough(page: Page, each?: () => Promise<void>): Promise<void> {
  for (let step = 0; step < MAX_STEPS; step++) {
    const done = await page.evaluate((dy) => {
      const before = window.scrollY;
      window.scrollBy(0, dy);
      const max = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0) - window.innerHeight;
      return window.scrollY <= before || window.scrollY >= max - 1;
    }, SCROLL_STEP);
    await page.waitForTimeout(SCROLL_PAUSE);
    if (each) await each();
    if (done) break;
  }
}

export async function injectHelper(page: Page): Promise<void> {
  await page.evaluate(INPAGE);
}

type Collected = Pick<PageCapture, 'blocks' | 'text' | 'links' | 'controls' | 'images' | 'meta' | 'layout'>;

/** Scrolls, settles and reads everything a visitor can see. The page ends at the top. */
export async function collectVisible(page: Page): Promise<Collected> {
  await quiet(page, 10_000);
  await scrollThrough(page);
  await quiet(page, 6_000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await injectHelper(page);

  // Scroll-reveal effects hide content again once it leaves the screen. Pass over the page a second
  // time and note anything that shows itself while on screen.
  const pending = (await page.evaluate('window.__plumb.startReveal()')) as number;
  if (pending > 0) {
    await page.evaluate('window.__plumb.stepReveal()');
    await scrollThrough(page, async () => {
      await page.evaluate('window.__plumb.stepReveal()');
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
  }
  return (await page.evaluate('window.__plumb.collect()')) as Collected;
}

async function screenshotTiles(page: Page, viewport: Viewport, layout: PageLayout, dir: string): Promise<Tile[]> {
  const docH = layout.docH;
  // A phone page that overflows is laid out wider than the device, so the tile follows the layout width.
  const width = Math.max(VIEWPORTS[viewport].width, Math.min(layout.innerWidth, 1440));
  const total = Math.min(Math.max(docH, VIEWPORTS[viewport].height), MAX_CAPTURE_HEIGHT[viewport]);
  // Tiles come out at the device's pixel width, however wide the layout is.
  const scale = (VIEWPORTS[viewport].deviceScaleFactor * VIEWPORTS[viewport].width) / width;
  const cdp = await page.context().newCDPSession(page);
  const tiles: Tile[] = [];
  try {
    for (let y = 0, i = 0; y < total; y += TILE_HEIGHT[viewport], i++) {
      const h = Math.min(TILE_HEIGHT[viewport], total - y);
      const shot = await cdp.send('Page.captureScreenshot', {
        format: 'jpeg',
        quality: 72,
        clip: { x: 0, y, width, height: h, scale },
        captureBeyondViewport: true,
      });
      const file = `tile-${String(i).padStart(2, '0')}.jpg`;
      writeFileSync(join(dir, file), Buffer.from(shot.data, 'base64'));
      tiles.push({ file, y, h });
    }
  } finally {
    await cdp.detach().catch(() => undefined);
  }
  return tiles;
}

export class Renderer {
  private browser: Browser | undefined;

  constructor(private readonly polite: Polite) {}

  async start(): Promise<void> {
    this.browser ??= await chromium.launch({ headless: true });
  }

  async stop(): Promise<void> {
    await this.browser?.close();
    this.browser = undefined;
  }

  private async context(viewport: Viewport, ignoreHTTPSErrors: boolean): Promise<BrowserContext> {
    await this.start();
    const v = VIEWPORTS[viewport];
    return this.browser!.newContext({
      viewport: { width: v.width, height: v.height },
      deviceScaleFactor: v.deviceScaleFactor,
      isMobile: v.isMobile,
      hasTouch: v.hasTouch,
      userAgent: userAgent(viewport === 'mobile' ? 'mobile' : 'desktop'),
      locale: 'en-NZ',
      timezoneId: 'Pacific/Auckland',
      ignoreHTTPSErrors,
      serviceWorkers: 'block',
    });
  }

  /** Renders one page at one viewport, under robots.txt and the per-host rate limit. */
  async render(req: RenderRequest): Promise<PageCapture> {
    const cap = emptyCapture(req.url, req.viewport);
    if (!(await this.polite.robots.allows(req.url))) {
      cap.blocked = 'robots';
      return cap;
    }
    const host = hostOf(req.url);
    if (!host) {
      cap.error = 'invalid URL';
      return cap;
    }

    for (const ignoreCert of [false, true]) {
      await this.polite.limiter.acquire(host);
      const context = await this.context(req.viewport, ignoreCert);
      const page = await context.newPage();
      try {
        const outcome = await this.capture(page, req, cap, ignoreCert);
        if (outcome === 'retry-without-cert-check') continue;
        return cap;
      } finally {
        await context.close().catch(() => undefined);
      }
    }
    return cap;
  }

  private async capture(page: Page, req: RenderRequest, cap: PageCapture, ignoringCert: boolean): Promise<'done' | 'retry-without-cert-check'> {
    const hosts = new Set<string>();
    page.on('console', (m) => {
      if (m.type() === 'error' && cap.consoleErrors.length < 50) cap.consoleErrors.push(m.text().slice(0, 300));
    });
    page.on('pageerror', (e) => {
      if (cap.consoleErrors.length < 50) cap.consoleErrors.push(`uncaught: ${e.message.slice(0, 300)}`);
    });
    page.on('dialog', (d) => void d.dismiss().catch(() => undefined));
    page.on('request', (r) => {
      const u = r.url();
      const h = hostOf(u);
      if (h) hosts.add(h);
      if (u.startsWith('http://') && page.url().startsWith('https://') && !r.isNavigationRequest() && cap.mixedContent.length < 50) cap.mixedContent.push(u);
    });
    page.on('requestfailed', (r) => {
      if (cap.failedRequests.length < 200) cap.failedRequests.push({ url: r.url(), error: r.failure()?.errorText ?? 'failed', type: r.resourceType() });
    });
    page.on('response', (r) => {
      if (r.status() >= 400 && cap.badResponses.length < 200) cap.badResponses.push({ url: r.url(), status: r.status(), type: r.request().resourceType() });
    });

    try {
      const response = await page.goto(req.url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      cap.status = response?.status() ?? null;
      cap.headers = response ? await response.allHeaders().catch(() => ({})) : {};
    } catch (e) {
      const message = (e as Error).message.split('\n')[0] ?? 'navigation failed';
      if (!ignoringCert && /ERR_CERT|ERR_SSL|SSL_ERROR/i.test(message)) {
        cap.certError = true;
        return 'retry-without-cert-check';
      }
      cap.error = message.slice(0, 300);
      return 'done';
    }

    await page.waitForLoadState('load', { timeout: 25_000 }).catch(() => undefined);
    cap.finalUrl = page.url();

    // A redirect can land on a different host with its own rules.
    if (cap.finalUrl !== req.url && !(await this.polite.robots.allows(cap.finalUrl))) {
      cap.blocked = 'robots';
      cap.status = null;
      return 'done';
    }

    try {
      Object.assign(cap, await collectVisible(page));
      const t = bothTimes();
      cap.capturedAtUtc = t.utc;
      cap.capturedAtNz = t.nz;
      cap.ok = cap.status !== null && cap.status < 400;
      cap.requestHosts = [...hosts].sort();

      if (req.outDir) {
        mkdirSync(req.outDir, { recursive: true });
        cap.dir = req.outDir;
        writeFileSync(join(req.outDir, 'page.html'), await page.content());
        cap.htmlFile = 'page.html';
        if (req.screenshots !== false) cap.tiles = await screenshotTiles(page, req.viewport, cap.layout, req.outDir);
      }
      if (req.onPage) await req.onPage(page, cap);
      if (req.outDir) writeFileSync(join(req.outDir, 'capture.json'), JSON.stringify(cap));
    } catch (e) {
      cap.error = ((e as Error).message.split('\n')[0] ?? 'capture failed').slice(0, 300);
      cap.ok = false;
    }
    return 'done';
  }
}
