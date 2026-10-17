import * as cheerio from 'cheerio';
import { domainOf } from '@plumbline/core';
import type { PageCapture } from '@plumbline/render';

// ---- Physio: testimonials and review widgets on the homepage ----

export interface TestimonialSign {
  kind: 'section' | 'quote' | 'widget';
  /** The exact words on the page, or the widget's name. */
  text: string;
  url: string;
  /** For a widget, the address of its script or frame. */
  source?: string;
}

const SECTION = /\b(?:testimonials?|what (?:our |my )?(?:clients|patients|customers|people) (?:say|are saying)|(?:client|patient|customer) (?:reviews?|feedback|stories|experiences)|kind words|happy (?:clients|patients)|success stories|google reviews?|reviews?)\b/i;
const WIDGETS: { name: string; test: RegExp }[] = [
  { name: 'Elfsight reviews widget', test: /elfsight/i },
  { name: 'Trustindex reviews widget', test: /trustindex|ti-widget/i },
  { name: 'Google reviews widget', test: /google[-_ ]?reviews?|grw-|wp-?google-?review|featurable|reviews\.io|sociablekit|embedsocial|reviewsonmywebsite|birdeye|podium/i },
  { name: 'testimonial carousel', test: /testimonial/i },
];

/** Words as a visitor would see them: found among the page's visible text. */
const visible = (page: PageCapture, text: string) => {
  const probe = text.replace(/\s+/g, ' ').trim().slice(0, 40);
  return probe.length >= 12 && page.text.replace(/\s+/g, ' ').includes(probe);
};

/** What on a homepage shows testimonials or a review widget to a visitor. Hidden text does not count. */
export function testimonialsOn(page: PageCapture, html: string): TestimonialSign[] {
  const signs: TestimonialSign[] = [];
  const $ = cheerio.load(html);
  const url = page.finalUrl;
  $('h1, h2, h3, h4, h5, h6').each((_, e) => {
    const text = $(e).text().replace(/\s+/g, ' ').trim();
    if (text.length > 80 || !SECTION.test(text) || !visible(page, text)) return;
    // A heading counts when words follow it that a client could have written: quotes or paragraphs under it.
    const after = $(e).nextAll().slice(0, 3).text().replace(/\s+/g, ' ').trim() || $(e).parent().text().replace(/\s+/g, ' ').trim().slice(text.length);
    if (after.length >= 40) signs.push({ kind: 'section', text: `${text}: ${after.slice(0, 240)}`, url });
  });
  $('[class*="testimonial" i], [id*="testimonial" i], blockquote').each((_, e) => {
    const text = $(e).text().replace(/\s+/g, ' ').trim();
    const named = /testimonial/i.test(`${$(e).attr('class') ?? ''} ${$(e).attr('id') ?? ''}`);
    if (text.length < 40 || !visible(page, text) || signs.some((s) => s.text.includes(text.slice(0, 40)))) return;
    // A bare blockquote is a quote of anything; only one that sits near a testimonial heading or class is taken.
    if (named || signs.some((s) => s.kind === 'section')) signs.push({ kind: 'quote', text: text.slice(0, 300), url });
  });
  const sources = [...$('script[src], iframe[src], iframe[data-src]').toArray().map((e) => $(e).attr('src') ?? $(e).attr('data-src') ?? ''), ...$('[class], [id]').toArray().map((e) => `${$(e).attr('class') ?? ''} ${$(e).attr('id') ?? ''}`)];
  for (const w of WIDGETS.slice(0, 3)) {
    const hit = sources.find((s) => w.test.test(s));
    if (hit && !signs.some((s) => s.kind === 'widget' && s.text === w.name)) signs.push({ kind: 'widget', text: w.name, url, source: hit.trim().slice(0, 160) });
  }
  return signs;
}

// ---- Faith screen: a menu page whose main content sells alcohol or gambling ----

export interface FaithFlag {
  label: string;
  url: string;
  topic: 'alcohol' | 'gambling';
  why: string;
}

const ALCOHOL = /\b(?:wines?|beers?|brewery|breweries|brewing|spirits|whisky|whiskey|gin|vodka|liquor|cellar door|bottle shop|cocktails?|ciders?)\b/gi;
const GAMBLING = /\b(?:casinos?|pokies|pokie|gambling|gamble|betting|sportsbook|lotto|raffles?|poker|roulette|jackpot|place a bet)\b/gi;
const SELLING = /\$\s?\d|\b(?:buy|shop|order|add to cart|add to basket|per bottle|a case|bottles?|checkout|for sale|on sale)\b/i;

export interface MenuPage {
  label: string;
  url: string;
  title: string;
  h1: string;
  text: string;
}

/** The internal pages in a homepage's menu, once each. */
export function menuTargets(home: PageCapture, max = 14): { label: string; url: string }[] {
  const out: { label: string; url: string }[] = [];
  for (const l of home.links) {
    if (!l.inNav || !/^https?:/i.test(l.href) || domainOf(l.href) !== domainOf(home.finalUrl)) continue;
    const url = l.href.split('#')[0]!.replace(/\/$/, '');
    if (!url || url === home.finalUrl.replace(/\/$/, '') || out.some((o) => o.url === url)) continue;
    out.push({ label: l.text.replace(/\s+/g, ' ').trim(), url });
  }
  return out.slice(0, max);
}

/** Flags a menu page whose title, main heading or menu word is about alcohol or gambling and that shows the signs of selling, or whose words are mostly about it. */
export function faithFlags(pages: MenuPage[]): FaithFlag[] {
  const flags: FaithFlag[] = [];
  for (const p of pages) {
    const words = p.text.split(/\s+/).filter(Boolean).length || 1;
    for (const [topic, re] of [['alcohol', ALCOHOL], ['gambling', GAMBLING]] as const) {
      const head = `${p.label} ${p.title} ${p.h1}`;
      const inHead = [...head.matchAll(re)].map((m) => m[0].toLowerCase());
      const count = [...p.text.matchAll(re)].length;
      const dense = count >= 8 && count / words >= 0.015;
      const selling = SELLING.test(p.text);
      if ((inHead.length && selling) || dense) {
        flags.push({ label: p.label, url: p.url, topic, why: inHead.length && selling ? `"${[...new Set(inHead)].join('", "')}" in the menu word, title or heading, with prices or buying words on the page` : `${count} mentions in ${words} words` });
        break;
      }
    }
  }
  return flags;
}

// ---- Whoever built the site, named in a credit anywhere in its words ----

const CREDIT_WORDS = /\b(?:[Ww]eb ?[Ss]ite|[Ww]eb ?[Dd]esign|[Ss]ite|[Dd]esign(?:ed)?|[Dd]evelop(?:ed|ment)|[Bb]uilt|[Cc]reated|[Hh]osted|[Pp]owered|[Mm]aintained)(?: (?:and|&) \w+| [Dd]esign| [Dd]evelopment)? by:?\s+([A-Z][^\n|\u00a9.,]{2,40}?)(?=\s+(?:Copyright|Privacy|Terms|All rights|\u00a9)|[|\u00a9.,\n]|$)/g;
const BUILDERS = /^(?:weebly|wix(?:\.com)?|squarespace|wordpress(?:\.com)?|shopify|rocketspark|godaddy|webflow|jimdo|google sites|square|duda|zyro|webnode|strikingly)$/i;

/** The names given in a "website by" or "designed by" credit, other than a site builder. */
export function creditsIn(text: string): string[] {
  const names = new Set<string>();
  for (const m of text.replace(/\s+/g, ' ').matchAll(CREDIT_WORDS)) {
    const name = m[1]!.trim();
    if (name.split(' ').length <= 5 && !BUILDERS.test(name)) names.add(name);
  }
  return [...names];
}
