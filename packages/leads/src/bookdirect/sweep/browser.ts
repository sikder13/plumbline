import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { hostOf } from '@plumbline/core';
import { userAgent, type Polite } from '@plumbline/fetch';

export interface Measure {
  viewport: string | null;
  innerWidth: number;
  scrollWidth: number;
  /** How far the page moves when pushed sideways: more than 20 is a page wider than the phone. */
  scrollX: number;
  /** The middle font size of the page's sentences, by characters. */
  medianFontPx: number | null;
  /** All visible text. */
  textChars: number;
  /** Sentence text outside menus, buttons and the footer. */
  bodyChars?: number;
  images: number;
  media: number;
}

export interface Visit {
  url: string;
  finalUrl: string;
  status: number | null;
  error: string | null;
  certError: string | null;
  blocked: boolean;
  /** Chrome's own reading of the address bar: secure, neutral, insecure or insecure-broken. */
  security: string | null;
  securityIssues: string[];
  loadMs: number;
  slowRender: boolean;
  title: string;
  text: string;
  frames: { url: string; text: string }[];
  measure: Measure | null;
  html: string;
  highlighted: boolean;
  /** Pop-ups hidden before the picture. */
  overlaysHidden: number;
  shot: string | null;
  at: string;
}

export interface VisitOptions {
  /** Where the 390 x 844 picture goes. No picture is taken without it. */
  shot?: string;
  /** Lines written above the picture, as plain evidence. */
  banner?: string[];
  /** The element to outline and bring into view before the picture. */
  highlight?: { href?: string; text?: string; digits?: string };
  measure?: boolean;
  /** A desktop picture instead (for the main menu). */
  desktop?: boolean;
  /** Read the words inside frames too (booking widgets). */
  frames?: boolean;
  /** Keep the page's code after it ran. */
  html?: boolean;
  /** Push the page as far right as it goes before the picture: shows a page wider than the phone. */
  scrollRight?: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Errors that are our own connection, not the site's. */
export const OUR_NETWORK = /ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED|ERR_NETWORK_IO_SUSPENDED|ERR_NAME_RESOLUTION_FAILED|ERR_PROXY_CONNECTION_FAILED/;
export const BROWSER_GONE = /Target page, context or browser has been closed|Browser has been closed|browser\.newContext|Connection closed/i;
/** A page call that gives up after `ms`, so one hung frame cannot hold the sweep. */
const within = <T>(p: Promise<T>, ms: number, fallback: T): Promise<T> => Promise.race([p.catch(() => fallback), new Promise<T>((res) => setTimeout(() => res(fallback), ms).unref())]);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/**
 * The sweep's browser. Each page opens fresh at 390 x 844 as a phone, under robots.txt and the
 * one-request-a-second rule for its host, and is photographed only after it has fully loaded: the
 * network idle and three seconds more, sixty seconds at most, with anything over thirty recorded as a
 * slow render.
 */
export class Shooter {
  private browser: Browser | undefined;
  private starting: Promise<Browser> | undefined;

  constructor(private readonly polite: Polite) {}

  private async start(): Promise<Browser> {
    if (this.browser) return this.browser;
    // The new headless mode, which reports the address bar's security state.
    this.starting ??= chromium.launch({ headless: true, channel: 'chromium' });
    this.browser = await this.starting;
    return this.browser;
  }

  async stop(): Promise<void> {
    await this.browser?.close().catch(() => undefined);
    this.browser = undefined;
    this.starting = undefined;
  }

  private async context(desktop: boolean, ignoreHTTPSErrors: boolean): Promise<BrowserContext> {
    const b = await this.start();
    const ctx = await b.newContext({
      viewport: desktop ? { width: 1280, height: 800 } : { width: 390, height: 844 },
      deviceScaleFactor: 1,
      isMobile: !desktop,
      hasTouch: !desktop,
      userAgent: userAgent(desktop ? 'desktop' : 'mobile'),
      locale: 'en-NZ',
      timezoneId: 'Pacific/Auckland',
      ignoreHTTPSErrors,
      serviceWorkers: 'block',
    });
    // The page helpers below are compiled with named inner functions; the browser needs the name helper the compiler calls.
    await ctx.addInitScript({ content: 'globalThis.__name = globalThis.__name || ((f) => f);' });
    return ctx;
  }

  async visit(url: string, opts: VisitOptions = {}): Promise<Visit> {
    const v = await this.visitOnce(url, opts);
    // A blip in our own connection is tried once more before anything is read into it.
    if (v.error && OUR_NETWORK.test(v.error)) {
      await sleep(5000);
      return this.visitOnce(url, opts);
    }
    return v;
  }

  private async visitOnce(url: string, opts: VisitOptions): Promise<Visit> {
    const v: Visit = { url, finalUrl: url, status: null, error: null, certError: null, blocked: false, security: null, securityIssues: [], loadMs: 0, slowRender: false, title: '', text: '', frames: [], measure: null, html: '', highlighted: false, overlaysHidden: 0, shot: null, at: new Date().toISOString() };
    if (!(await this.polite.robots.allows(url).catch(() => false))) {
      v.blocked = true;
      v.error = 'robots';
      return v;
    }
    const host = hostOf(url);
    if (!host) {
      v.error = 'invalid URL';
      return v;
    }
    for (const ignore of [false, true]) {
      await this.polite.limiter.acquire(host);
      const ctx = await this.context(!!opts.desktop, ignore);
      const page = await ctx.newPage();
      try {
        const again = await this.load(page, ctx, url, v, opts, ignore);
        if (again) continue;
        return v;
      } catch (e) {
        const msg = (e as Error).message.split('\n')[0] ?? 'failed';
        // Our own browser going away is never something the site did.
        if (BROWSER_GONE.test(msg)) throw e;
        v.error = msg.slice(0, 200);
        return v;
      } finally {
        await ctx.close().catch(() => undefined);
      }
    }
    return v;
  }

  /** Loads, waits, reads and photographs one page. Returns true to try again without the certificate check. */
  private async load(page: Page, ctx: BrowserContext, url: string, v: Visit, opts: VisitOptions, ignoringCert: boolean): Promise<boolean> {
    page.on('dialog', (d) => void d.dismiss().catch(() => undefined));
    page.on('response', (r) => {
      if (r.frame() === page.mainFrame() && r.request().isNavigationRequest()) v.status = r.status();
    });
    const cdp = await ctx.newCDPSession(page);
    cdp.on('Security.visibleSecurityStateChanged', (e: { visibleSecurityState: { securityState: string; securityStateIssueIds?: string[] } }) => {
      v.security = e.visibleSecurityState.securityState;
      v.securityIssues = e.visibleSecurityState.securityStateIssueIds ?? [];
    });
    await cdp.send('Security.enable').catch(() => undefined);
    const t0 = Date.now();
    try {
      const res = await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
      v.status = res?.status() ?? v.status;
    } catch (e) {
      const msg = (e as Error).message.split('\n')[0] ?? 'navigation failed';
      if (BROWSER_GONE.test(msg)) throw e;
      if (!ignoringCert && /ERR_CERT|ERR_SSL|SSL_ERROR/i.test(msg)) {
        v.certError = (/net::(\w+)/.exec(msg)?.[1] ?? msg).slice(0, 80);
        // The browser's warning page is the proof: photograph it before trying again past it.
        if (opts.shot) {
          const buf = await within(page.screenshot({ type: 'png', timeout: 15_000 }), 20_000, null);
          if (buf) await this.write(buf, opts.shot.replace(/\.png$/, '-warning.png'), [`Chrome: "Your connection is not private" (${v.certError})`, url]);
        }
        return true;
      }
      if (!/Timeout/i.test(msg)) {
        v.error = (/net::(\w+)/.exec(msg)?.[1] ?? msg).slice(0, 120);
        v.loadMs = Date.now() - t0;
        if (opts.shot) {
          const buf = await within(page.screenshot({ type: 'png', timeout: 15_000 }), 20_000, null);
          if (buf) v.shot = await this.write(buf, opts.shot, opts.banner ?? []);
        }
        return false;
      }
    }
    // Network idle, within sixty seconds of the start, then three seconds more.
    const left = Math.max(0, 60_000 - (Date.now() - t0));
    await page.waitForLoadState('networkidle', { timeout: left }).catch(() => undefined);
    v.loadMs = Date.now() - t0;
    v.slowRender = v.loadMs > 30_000;
    await sleep(3000);
    v.finalUrl = page.url();
    v.title = await within(page.title(), 10_000, '');
    if (opts.measure) v.measure = await within(page.evaluate(MEASURE), 20_000, null);
    v.text = await within(page.evaluate(() => (document.body ? document.body.innerText : '').slice(0, 20_000)), 15_000, '');
    if (opts.html) v.html = await within(page.content(), 15_000, '');
    if (opts.frames) {
      for (const f of page.frames().slice(1, 8)) {
        const text = await within(f.evaluate(() => (document.body ? document.body.innerText : '').slice(0, 4000)), 5000, '');
        if (text) v.frames.push({ url: f.url(), text });
      }
    }
    if (opts.shot) v.overlaysHidden = await within(page.evaluate(CLEAR_OVERLAYS), 5000, 0);
    if (opts.highlight) {
      v.highlighted = await within(page.evaluate(HIGHLIGHT, opts.highlight), 10_000, false);
      if (v.highlighted) {
        await sleep(700);
        v.highlighted = await within(page.evaluate(ON_SCREEN), 10_000, false);
      }
    }
    if (opts.shot) {
      if (opts.highlight && v.highlighted) await sleep(400);
      else if (opts.scrollRight) {
        await within(page.evaluate(() => window.scrollTo(10_000, 0)), 5000, undefined);
        await sleep(400);
      } else await within(page.evaluate(() => window.scrollTo(0, 0)), 5000, undefined);
      const buf = await within(page.screenshot({ type: 'png', timeout: 20_000 }), 25_000, null);
      if (buf) v.shot = await this.write(buf, opts.shot, opts.banner ?? []);
    }
    if (ignoringCert && v.certError) v.security = 'insecure-broken';
    return false;
  }

  /** Writes a picture, with the evidence lines above it when there are any. */
  async write(png: Buffer, path: string, banner: string[]): Promise<string> {
    mkdirSync(dirname(path), { recursive: true });
    if (!banner.length) {
      writeFileSync(path, png);
      return path;
    }
    const b = await this.start();
    const page = await b.newPage({ viewport: { width: png.readUInt32BE(16), height: 100 }, deviceScaleFactor: 1 });
    try {
      const lines = banner.map((l, i) => `<div style="${i === 0 ? 'font-weight:700;color:#fecaca;' : ''}word-break:break-all">${esc(l)}</div>`).join('');
      await page.setContent(`<html><body style="margin:0;background:#fff"><div style="background:#111827;color:#f9fafb;padding:10px 12px;font:13px/1.4 Arial,Helvetica,sans-serif">${lines}</div><img style="display:block" src="data:image/png;base64,${png.toString('base64')}"></body></html>`);
      await page.screenshot({ path, fullPage: true, type: 'png' });
    } finally {
      await page.close().catch(() => undefined);
    }
    return path;
  }

  /** A sheet of pictures with their labels, as one JPEG. */
  async sheet(items: { file: string; label: string[] }[], out: string, title: string): Promise<void> {
    const b = await this.start();
    const page = await b.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
    try {
      const cells = items
        .map((it) => {
          const src = (() => {
            try {
              return `data:image/png;base64,${readFileSync(it.file).toString('base64')}`;
            } catch {
              return '';
            }
          })();
          return `<figure style="margin:0;width:260px;break-inside:avoid"><div style="height:520px;overflow:hidden;border:1px solid #d1d5db;background:#f3f4f6">${src ? `<img src="${src}" style="width:260px;display:block">` : 'missing picture'}</div><figcaption style="font:12px/1.35 Arial,Helvetica,sans-serif;padding:4px 2px 0">${it.label.map((l, i) => `<div style="${i === 0 ? 'font-weight:700' : ''}">${esc(l)}</div>`).join('')}</figcaption></figure>`;
        })
        .join('');
      await page.setContent(`<html><body style="margin:16px;background:#fff;color:#111827"><div style="font:bold 18px Arial,Helvetica,sans-serif;margin-bottom:12px">${esc(title)}</div><div style="display:grid;grid-template-columns:repeat(5,260px);gap:16px 14px">${cells}</div></body></html>`);
      mkdirSync(dirname(out), { recursive: true });
      await page.screenshot({ path: out, fullPage: true, type: 'jpeg', quality: 72 });
    } finally {
      await page.close().catch(() => undefined);
    }
  }
}

const MEASURE = (): Measure => {
  const vp = document.querySelector('meta[name="viewport" i]');
  const viewport = vp ? vp.getAttribute('content') : null;
  const innerWidth = window.innerWidth;
  const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
  window.scrollTo(5000, 0);
  const scrollX = window.scrollX;
  window.scrollTo(0, 0);
  const counts = new Map<number, number>();
  let chars = 0;
  let all = 0;
  const walker = document.createTreeWalker(document.body ?? document.documentElement, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  let i = 0;
  while ((n = walker.nextNode()) && i++ < 30_000) {
    const t = (n.textContent ?? '').trim();
    if (t.length < 2) continue;
    const el = n.parentElement;
    if (!el || /^(?:SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(el.tagName)) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    all += t.length;
    // Body text is sentences: not menu words, buttons, labels or the footer's small print.
    if (t.length < 30 || el.closest('nav, header, footer, button, a, label, small, sup, sub, figcaption, [role="navigation"]')) continue;
    const fs = Math.round(parseFloat(cs.fontSize));
    counts.set(fs, (counts.get(fs) ?? 0) + t.length);
    chars += t.length;
  }
  let acc = 0;
  let median: number | null = null;
  for (const [fs, c] of [...counts.entries()].sort((a, b) => a[0] - b[0])) {
    acc += c;
    if (acc >= chars / 2) {
      median = fs;
      break;
    }
  }
  const images = [...document.images].filter((im) => im.naturalWidth > 20 && im.getBoundingClientRect().width > 20).length;
  const media = document.querySelectorAll('video, canvas, iframe, picture').length;
  return { viewport, innerWidth, scrollWidth, scrollX, medianFontPx: median, textChars: all, bodyChars: chars, images, media };
};

const HIGHLIGHT = (needle: { href?: string; text?: string; digits?: string }): boolean => {
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const textNodes = (): Text[] => {
    const out: Text[] = [];
    const w = document.createTreeWalker(document.body ?? document.documentElement, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = w.nextNode())) out.push(n as Text);
    return out;
  };
  let target: Element | null = null;
  const pick = (els: Element[]) => els.find(visible) ?? els[0] ?? null;
  if (needle.href) {
    const want = needle.href.toLowerCase();
    target = pick([...document.querySelectorAll('a[href]')].filter((a) => (a as HTMLAnchorElement).href.toLowerCase().includes(want) || (a.getAttribute('href') ?? '').toLowerCase().includes(want)));
  }
  if (!target && needle.text) {
    const want = needle.text.toLowerCase();
    target = pick(textNodes().filter((t) => (t.textContent ?? '').toLowerCase().includes(want)).map((t) => t.parentElement!).filter(Boolean));
  }
  if (!target && needle.digits) {
    const want = needle.digits.replace(/^0/, '').slice(-7);
    target = pick(textNodes().filter((t) => (t.textContent ?? '').replace(/\D/g, '').includes(want)).map((t) => t.parentElement!).filter(Boolean));
    if (!target || !visible(target)) target = pick([...document.querySelectorAll('a[href^="tel:" i]')].filter((a) => (a.getAttribute('href') ?? '').replace(/\D/g, '').includes(want)));
  }
  if (!target || !visible(target)) return false;
  target.setAttribute('data-plumb-proof', '1');
  target.scrollIntoView({ block: 'center' });
  // Set over the site's own styles: some themes remove outlines from links.
  const st = (target as HTMLElement).style;
  st.setProperty('outline', '3px solid #e11d48', 'important');
  st.setProperty('outline-offset', '2px', 'important');
  st.setProperty('box-shadow', '0 0 0 3px #e11d48', 'important');
  return true;
};

/** Pop-ups, newsletter boxes and modals that cover most of the screen are hidden, so the page under them shows. Returns how many. */
const CLEAR_OVERLAYS = (): number => {
  let n = 0;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const POPUP = /modal|popup|pop-up|lightbox|newsletter|subscribe|overlay|optin|opt-in|klaviyo|mailchimp|privy|giveaway|promo|announcement|cookie|consent|gdpr/i;
  const pageText = (document.body?.innerText ?? '').length || 1;
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const isDialog = el.matches('[role="dialog"], [aria-modal="true"], dialog[open]');
    const named = POPUP.test(`${el.id} ${typeof el.className === 'string' ? el.className : ''}`);
    // A box fixed on top of everything that holds little of the page's words is a pop-up, whatever it is called.
    const onTop = cs.position === 'fixed' && Number(cs.zIndex) >= 100 && ((el as HTMLElement).innerText ?? '').length < 0.5 * pageText;
    if (!isDialog && !named && !onTop) continue;
    if (cs.position !== 'fixed' && cs.position !== 'absolute' && !isDialog) continue;
    const r = el.getBoundingClientRect();
    const area = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    if (area < (onTop && !isDialog && !named ? 0.5 : 0.3) * vw * vh) continue;
    (el as HTMLElement).style.setProperty('visibility', 'hidden', 'important');
    n++;
  }
  if (n) {
    document.documentElement.style.setProperty('overflow', 'auto', 'important');
    if (document.body) document.body.style.setProperty('overflow', 'auto', 'important');
  }
  return n;
};

/** After the page settles: the outlined item must sit inside the screen and not under a sticky bar or a pop-up; covering bars are hidden. */
const ON_SCREEN = (): boolean => {
  const t = document.querySelector('[data-plumb-proof]');
  if (!t) return false;
  t.scrollIntoView({ block: 'center' });
  const seen = () => {
    const r = t.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0 || r.top < 0 || r.left < -2 || r.bottom > window.innerHeight || r.right > window.innerWidth + 2) return false;
    const at = document.elementFromPoint(r.left + Math.min(r.width / 2, 40), r.top + r.height / 2);
    return !!at && (t === at || t.contains(at) || at.contains(t));
  };
  if (seen()) return true;
  const r = t.getBoundingClientRect();
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    const b = el.getBoundingClientRect();
    if (b.bottom > r.top && b.top < r.bottom && b.right > r.left && b.left < r.right && !el.contains(t)) (el as HTMLElement).style.visibility = 'hidden';
  }
  return seen();
};
