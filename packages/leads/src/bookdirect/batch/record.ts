import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { chromium, type Browser } from 'playwright';
import { quietContext } from '@plumbline/preview';

/**
 * A review recording: the page opened at one width, left to settle, then scrolled from top to bottom
 * at an even pace over `seconds`, as a person reading it would. The browser marks itself as ours and
 * answers the visit report locally, so a recording is never counted as a visit.
 */
export async function recordScroll(browser: Browser, url: string, width: number, out: string, seconds = 20): Promise<string> {
  const height = width < 900 ? 844 : 900;
  const tmp = join(dirname(out), `.rec-${width}-${Date.now()}`);
  mkdirSync(tmp, { recursive: true });
  const ctx = await quietContext(browser, { viewport: { width, height }, deviceScaleFactor: 1, isMobile: width < 900, hasTouch: width < 900, recordVideo: { dir: tmp, size: { width, height } } });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.waitForTimeout(1500);
    const total = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    const steps = Math.max(1, Math.round(((seconds - 2) * 1000) / 50));
    for (let i = 1; i <= steps; i++) {
      await page.evaluate((y) => window.scrollTo(0, y), Math.round((total * i) / steps));
      await page.waitForTimeout(50);
    }
    await page.waitForTimeout(500);
  } finally {
    await ctx.close();
  }
  const file = readdirSync(tmp).find((f) => f.endsWith('.webm'));
  mkdirSync(dirname(out), { recursive: true });
  if (file) renameSync(join(tmp, file), out);
  rmSync(tmp, { recursive: true, force: true });
  return out;
}

/** The first screen of a page at one width, as a picture for a contact sheet. */
export async function firstScreen(browser: Browser, url: string, width: number, out: string): Promise<string> {
  const height = width < 900 ? 844 : 900;
  const ctx = await quietContext(browser, { viewport: { width, height }, deviceScaleFactor: 1, isMobile: width < 900, hasTouch: width < 900 });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.waitForTimeout(2500);
    mkdirSync(dirname(out), { recursive: true });
    await page.screenshot({ path: out });
  } finally {
    await ctx.close();
  }
  return out;
}

export async function withBrowser<T>(run: (b: Browser) => Promise<T>): Promise<T> {
  const b = await chromium.launch({ headless: true });
  try {
    return await run(b);
  } finally {
    await b.close();
  }
}
