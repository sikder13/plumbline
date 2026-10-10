import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ROOT, VIEWPORTS } from '@plumbline/core';
import { injectHelper } from './render.ts';

const fixture = (name: string) => readFileSync(join(ROOT, 'fixtures', 'render', name), 'utf8');

let browser: Browser;
let page: Page;
let expectations: { id: string; expect: string; visible: boolean; why: string | null }[];
let text: string;

beforeAll(async () => {
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: VIEWPORTS.mobile.width, height: VIEWPORTS.mobile.height } });
  await page.setContent(fixture('visibility.html'));
  await injectHelper(page);
  expectations = await page.evaluate(`Array.from(document.querySelectorAll('[data-expect]')).map((el) => ({
    id: el.id, expect: el.getAttribute('data-expect'), visible: window.__plumb.isVisible(el), why: window.__plumb.whyHidden(el),
  }))`);
  text = await page.evaluate('window.__plumb.collect().text');
});
afterAll(async () => {
  await browser.close();
});

const why = (id: string) => expectations.find((e) => e.id === id)!.why;

describe('visibility helper: elements', () => {
  it('agrees with every marked element in the fixture', () => {
    const wrong = expectations.filter((e) => e.visible !== (e.expect === 'visible')).map((e) => `${e.id} expected ${e.expect} (${e.why})`);
    expect(wrong).toEqual([]);
    expect(expectations.length).toBeGreaterThan(30);
  });

  it('gives the reason for each kind of hiding', () => {
    expect(why('display-none')).toBe('display');
    expect(why('visibility-hidden')).toBe('visibility');
    expect(why('opacity-zero')).toBe('opacity');
    expect(why('opacity-low')).toBe('opacity');
    expect(why('opacity-parent')).toBe('opacity');
    expect(why('hidden-attr')).toBe('display');
    expect(why('content-vis')).toBe('content-visibility');
    expect(why('sr-only')).toBe('sr-only');
    expect(why('sr-clip-path')).toBe('sr-only');
    expect(why('sr-new')).toBe('sr-only');
    expect(why('aria-hidden')).toBe('aria-hidden');
    expect(why('offscreen')).toBe('outside-scroll-area');
    expect(why('slide-2')).toBe('clipped');
    expect(why('collapsed')).toBe('sr-only');
    expect(why('details-body')).toBe('details-closed');
    expect(why('empty')).toBe('size');
    expect(why('one-pixel')).toBe('sr-only');
    expect(why('plain')).toBeNull();
  });

  it('keeps a child that turns visibility back on', () => {
    expect(why('visibility-child-shown')).toBeNull();
  });

  it('does not clip an absolutely positioned box by an ancestor that is not its containing block', () => {
    expect(why('escapes')).toBeNull();
  });

  it('counts content inside a scrollable box, which a visitor can reach', () => {
    expect(why('scroller-below')).toBeNull();
  });

  it('gives a wrapping link the box of its floated children', () => {
    expect(why('float-link')).toBeNull();
  });
});

describe('visibility helper: text', () => {
  const shown = ['PLAIN-VISIBLE', 'VISIBILITY-CHILD-SHOWN', 'OPACITY-FAINT', 'ARIA-FALSE', 'SLIDE-ONE', 'DETAILS-SUMMARY', 'DETAILS-OPEN', 'FADE-ON', 'SCROLLER-BELOW', 'ESCAPES-CLIP', 'FLOAT-LINK', 'MENU-ICON', 'FOOTER-TEXT'];
  const hiddenText = [
    'DISPLAY-NONE',
    'VISIBILITY-HIDDEN',
    'OPACITY-ZERO',
    'OPACITY-LOW',
    'OPACITY-PARENT',
    'HIDDEN-ATTR',
    'CONTENT-VISIBILITY',
    'SR-ONLY',
    'SR-CLIP-PATH',
    'SR-NEW',
    'Toggle navigation',
    'OFFSCREEN',
    'TEXT-INDENT',
    'ZERO-FONT',
    'NOSCRIPT-TEXT',
    'googletagmanager',
    'TEMPLATE-TEXT',
    'ARIA-HIDDEN',
    'SCRIPT-TEXT',
    'STYLE-TEXT',
    'SLIDE-TWO',
    'Lorem ipsum',
    'SLIDE-THREE',
    'COLLAPSED',
    'DETAILS-BODY',
    'FADE-OFF',
    'ONE-PIXEL',
  ];

  it.each(shown)('includes %s', (marker) => {
    expect(text).toContain(marker);
  });

  it.each(hiddenText)('leaves out %s', (marker) => {
    expect(text).not.toContain(marker);
  });

  it('reports each block with a box inside the page and a selector that finds it', async () => {
    const blocks = (await page.evaluate('window.__plumb.collect().blocks')) as { text: string; selector: string; box: { x: number; y: number; w: number; h: number }; inFooter: boolean }[];
    const plain = blocks.find((b) => b.text.includes('PLAIN-VISIBLE'))!;
    expect(plain.box.w).toBeGreaterThan(50);
    expect(plain.box.h).toBeGreaterThan(10);
    expect(await page.locator(plain.selector).innerText()).toContain('PLAIN-VISIBLE');
    expect(blocks.find((b) => b.text.includes('FOOTER-TEXT'))!.inFooter).toBe(true);
  });

  it('boxes only the visible slide of a carousel', async () => {
    const blocks = (await page.evaluate('window.__plumb.collect().blocks')) as { text: string; box: { w: number } }[];
    const slide = blocks.find((b) => b.text.includes('SLIDE-ONE'))!;
    expect(slide.text).not.toContain('SLIDE-TWO');
    expect(slide.box.w).toBeLessThanOrEqual(300);
  });
});

describe('visibility helper: page-level cases', () => {
  const fresh = async (html: string, width = 390) => {
    const p = await browser.newPage({ viewport: { width, height: 844 } });
    await p.setContent(html);
    await injectHelper(p);
    return p;
  };

  it('ignores an off-canvas menu when the page cannot scroll sideways', async () => {
    const p = await fresh(`<body style="margin:0;overflow-x:hidden"><div id="menu" style="position:absolute;left:400px;top:0;width:300px">OFFCANVAS</div><p>Main</p></body>`);
    expect(await p.evaluate(`window.__plumb.isVisible(document.getElementById('menu'))`)).toBe(false);
    expect(await p.evaluate('window.__plumb.collect().text')).not.toContain('OFFCANVAS');
    await p.close();
  });

  it('counts content to the right when the page really does scroll sideways', async () => {
    const p = await fresh(`<body style="margin:0"><div id="wide" style="position:absolute;left:500px;top:0;width:300px">SIDEWAYS</div><p>Main</p></body>`);
    expect(await p.evaluate(`window.__plumb.isVisible(document.getElementById('wide'))`)).toBe(true);
    const layout = (await p.evaluate('window.__plumb.collect().layout')) as { horizontalScroll: boolean; wide: unknown[] };
    expect(layout.horizontalScroll).toBe(true);
    expect(layout.wide.length).toBe(1);
    await p.close();
  });

  it('does not report sideways scroll for a page that fits', async () => {
    const p = await fresh(`<body style="margin:0"><p>Fits</p></body>`);
    expect(((await p.evaluate('window.__plumb.collect().layout')) as { horizontalScroll: boolean }).horizontalScroll).toBe(false);
    await p.close();
  });

  it('treats a fixed element as visible wherever the page is scrolled', async () => {
    const p = await fresh(`<body style="margin:0;height:3000px"><div style="overflow:hidden;height:10px"><a id="fab" href="/book" style="position:fixed;bottom:10px;right:10px">Book now</a></div></body>`);
    expect(await p.evaluate(`window.__plumb.isVisible(document.getElementById('fab'))`)).toBe(true);
    const links = (await p.evaluate('window.__plumb.collect().links')) as { text: string; fold: boolean }[];
    expect(links[0]).toMatchObject({ text: 'Book now', fold: true });
    await p.close();
  });

  it('marks links below the first screen as outside the fold', async () => {
    const p = await fresh(`<body style="margin:0"><a href="/a">Top</a><div style="height:2000px"></div><a href="/b">Bottom</a></body>`);
    const links = (await p.evaluate('window.__plumb.collect().links')) as { text: string; fold: boolean; visible: boolean }[];
    expect(links.map((l) => [l.text, l.visible, l.fold])).toEqual([
      ['Top', true, true],
      ['Bottom', true, false],
    ]);
    await p.close();
  });

  it('keeps the raw href so empty and script links can be told apart', async () => {
    const p = await fresh(`<nav><a href="#">Tours</a><a href="javascript:void(0)">Deals</a><a href="">Empty</a><a href="tel:">Call</a></nav>`);
    const links = (await p.evaluate('window.__plumb.collect().links')) as { raw: string; inNav: boolean }[];
    expect(links.map((l) => l.raw)).toEqual(['#', 'javascript:void(0)', '', 'tel:']);
    expect(links.every((l) => l.inNav)).toBe(true);
    await p.close();
  });

  it('uses the alt text of a visible image as the text of an image link', async () => {
    const p = await fresh(`<a href="/"><img alt="Fixture Tours logo" width="50" height="50" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='50' height='50'/%3E"></a>`);
    const links = (await p.evaluate('window.__plumb.collect().links')) as { text: string }[];
    expect(links[0]!.text).toBe('Fixture Tours logo');
    await p.close();
  });

  it('reads h1 headings that are visible and counts all of them', async () => {
    const p = await fresh(`<h1>Shown</h1><h1 style="display:none">Hidden</h1>`);
    const meta = (await p.evaluate('window.__plumb.collect().meta')) as { h1: string[]; h1Total: number };
    expect(meta.h1).toEqual(['Shown']);
    expect(meta.h1Total).toBe(2);
    await p.close();
  });

  it('splits lines at br so separate lines are not run together', async () => {
    const p = await fresh(`<p>Line one<br>Line two</p>`);
    expect(await p.evaluate('window.__plumb.collect().text')).toBe('Line one\nLine two');
    await p.close();
  });
});
