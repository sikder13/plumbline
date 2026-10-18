import type { PageCapture } from '@plumbline/render';
import { pagePrices } from '../extract.ts';

export interface OwnWord {
  kind: 'title' | 'h1' | 'hero' | 'about' | 'tagline' | 'price' | 'time';
  /** Exactly as written on the page. */
  text: string;
  /** For a price or a time, the words around it. */
  context?: string;
  url: string;
}

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const ABOUT_PATH = /\/(?:about|about-us|about-me|our-story|story|who-we-are|your-hosts?|meet[a-z-]*|the-team|our-team|team)(?:[-/][a-z-]*)?\/?$/i;
const TIME = /\b(?:\d{1,2}(?:[:.]\d{2})?\s?(?:am|pm|a\.m\.|p\.m\.)(?:\s?(?:-|\u2013|\u2014|to|until|till)\s?\d{1,2}(?:[:.]\d{2})?\s?(?:am|pm|a\.m\.|p\.m\.))?|\d{1,2}[:.]\d{2}\s?(?:-|\u2013|\u2014|to)\s?\d{1,2}[:.]\d{2})\b/gi;

/** A page's own words, as written, each with the page it came from. */
export function ownWords(pages: PageCapture[], homeUrl: string): OwnWord[] {
  const out: OwnWord[] = [];
  const ok = pages.filter((p) => p.ok);
  const seen = new Set<string>();
  const add = (w: OwnWord) => {
    const key = `${w.kind}|${w.text}|${w.url}`;
    if (!w.text.trim() || seen.has(key)) return;
    seen.add(key);
    out.push({ ...w, text: w.text.trim() });
  };
  const isHome = (p: PageCapture) => new URL(p.finalUrl).pathname.replace(/\/$/, '') === new URL(homeUrl).pathname.replace(/\/$/, '');
  const homes = ok.filter(isHome);
  const home = homes.find((p) => p.viewport === 'desktop') ?? homes[0] ?? ok[0];

  for (const p of ok.filter((x) => x.viewport === 'desktop' || !ok.some((y) => y.viewport === 'desktop' && y.finalUrl === x.finalUrl))) {
    add({ kind: 'title', text: p.meta.title, url: p.finalUrl });
    for (const h of p.meta.h1) add({ kind: 'h1', text: h.replace(/\s+/g, ' '), url: p.finalUrl });
  }

  if (home) {
    const first = home.blocks.filter((b) => b.box.y < home.layout.innerHeight && !b.inNav && !b.inFooter && !b.inHeader && words(b.text) >= 3 && b.text.length <= 220);
    for (const b of first.slice(0, 6)) add({ kind: 'hero', text: b.text.replace(/\s+/g, ' '), url: home.finalUrl });
    if (home.meta.description) add({ kind: 'tagline', text: home.meta.description, url: home.finalUrl });
    if (home.meta.og.description && home.meta.og.description !== home.meta.description) add({ kind: 'tagline', text: home.meta.og.description, url: home.finalUrl });
    for (const b of home.blocks.filter((x) => x.inHeader && !x.inNav && !x.href && words(x.text) >= 3 && words(x.text) <= 14).slice(0, 3)) add({ kind: 'tagline', text: b.text.replace(/\s+/g, ' '), url: home.finalUrl });
  }

  const aboutPage = ok.find((p) => ABOUT_PATH.test(new URL(p.finalUrl).pathname) && p.viewport === 'desktop') ?? ok.find((p) => ABOUT_PATH.test(new URL(p.finalUrl).pathname));
  const longest = (p: PageCapture) => p.blocks.filter((b) => !b.inNav && !b.inFooter && !b.inHeader && !b.heading && words(b.text) >= 25 && words(b.text) <= 250).sort((a, b) => a.box.y - b.box.y)[0];
  const para = aboutPage ? longest(aboutPage) : null;
  if (aboutPage && para) add({ kind: 'about', text: para.text.replace(/\s+/g, ' '), url: aboutPage.finalUrl });
  else if (home && longest(home)) add({ kind: 'about', text: longest(home)!.text.replace(/\s+/g, ' '), url: home.finalUrl });

  const priced = new Set<string>();
  for (const p of ok) {
    for (const pr of pagePrices(p)) {
      const key = `${pr.text}|${pr.context}`;
      if (priced.has(key) || priced.size >= 24) continue;
      priced.add(key);
      add({ kind: 'price', text: pr.text, context: pr.context.replace(/\s+/g, ' ').trim(), url: p.finalUrl });
    }
  }
  const timed = new Set<string>();
  for (const p of ok) {
    const text = p.text.replace(/\s+/g, ' ');
    for (const m of text.matchAll(TIME)) {
      if (timed.size >= 24) break;
      const context = text.slice(Math.max(0, m.index! - 50), m.index! + m[0].length + 40).trim();
      if (timed.has(context)) continue;
      timed.add(context);
      add({ kind: 'time', text: m[0], context, url: p.finalUrl });
    }
  }
  return out;
}
