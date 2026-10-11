import { franc } from 'franc';
import { excerptAround } from '@plumbline/core';
import type { PageCapture, TextBlock } from '@plumbline/render';

export interface TextHit {
  label: string;
  match: string;
  excerpt: string;
  block: TextBlock;
  pageUrl: string;
  viewport: PageCapture['viewport'];
}

export interface Phrase {
  label: string;
  re: RegExp;
}

function hit(page: PageCapture, block: TextBlock, label: string, m: RegExpExecArray | RegExpMatchArray): TextHit {
  return { label, match: m[0], excerpt: excerptAround(block.text, m.index ?? 0, m[0].length), block, pageUrl: page.finalUrl, viewport: page.viewport };
}

export function findPhrases(page: PageCapture, phrases: Phrase[]): TextHit[] {
  const out: TextHit[] = [];
  for (const block of page.blocks) {
    for (const p of phrases) {
      const m = p.re.exec(block.text);
      if (m) out.push(hit(page, block, p.label, m));
    }
  }
  return out;
}

const COPYRIGHT_WORD = /©|\(c\)|&copy;|\bcopy(?:right|write)\b|\ball rights reserved\b/gi;
const YEAR = /(?<![\d$.,/-])(?<!\d[\s-])((?:19[89]|20[0-4])\d)(?![\d/]|\.\d|\s?(?:km|m\b|kg|ft|people|guests))/g;

/** The newest year a visible copyright line claims, with where it was seen. */
export function copyrightYear(page: PageCapture): { year: number; hit: TextHit } | null {
  let best: { year: number; hit: TextHit } | null = null;
  for (const block of page.blocks) {
    // Map and widget credits carry their own year and say nothing about the site.
    if (/map data|google|mapbox|openstreetmap|leaflet|tripadvisor llc|powered by/i.test(block.text) && block.text.length < 120) continue;
    const words = [...block.text.matchAll(COPYRIGHT_WORD)];
    if (!words.length) continue;
    for (const y of block.text.matchAll(YEAR)) {
      const near = words.some((w) => Math.abs((w.index ?? 0) - (y.index ?? 0)) <= 80);
      if (!near) continue;
      const year = Number(y[1]);
      if (!best || year > best.year) {
        const start = Math.min(y.index ?? 0, ...words.map((w) => w.index ?? 0));
        best = { year, hit: { label: 'copyright', match: y[0], excerpt: excerptAround(block.text, start, 40, 70), block, pageUrl: page.finalUrl, viewport: page.viewport } };
      }
    }
  }
  return best;
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const DATE_DMY = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_RE}\\.?,?\\s+((?:19|20)\\d{2})\\b`, 'i');
const DATE_MDY = new RegExp(`\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+((?:19|20)\\d{2})\\b`, 'i');
const DATE_MY = new RegExp(`\\b${MONTH_RE}\\.?\\s+((?:19|20)\\d{2})\\b`, 'i');
const DATE_NUM = /\b(\d{1,2})[/.](\d{1,2})[/.]((?:19|20)\d{2})\b/;

function monthIndex(name: string): number {
  return MONTHS.findIndex((m) => m.startsWith(name.toLowerCase().slice(0, 3)));
}

/** The first full date in a string, read day first as written in New Zealand. Ends of months for month-only dates. */
export function parseDate(text: string): { date: Date; match: string; index: number } | null {
  let m = DATE_DMY.exec(text);
  if (m) return { date: new Date(Date.UTC(Number(m[3]), monthIndex(m[2]!), Number(m[1]))), match: m[0], index: m.index };
  m = DATE_MDY.exec(text);
  if (m) return { date: new Date(Date.UTC(Number(m[3]), monthIndex(m[1]!), Number(m[2]))), match: m[0], index: m.index };
  m = DATE_NUM.exec(text);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12 && Number(m[1]) <= 31) return { date: new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]))), match: m[0], index: m.index };
  m = DATE_MY.exec(text);
  if (m) return { date: new Date(Date.UTC(Number(m[2]), monthIndex(m[1]!) + 1, 0)), match: m[0], index: m.index };
  return null;
}

const VALID_UNTIL = /\b(valid (?:until|till|to|through)|expires?(?: on)?|offer ends|ends on|available until|book (?:before|by)|until|prices? valid (?:until|to|till))\b[^.\n]{0,40}/i;
const COVID = /\b(covid(?:-?19)?|coronavirus|alert level [1-4]|lockdown|vaccine pass(?:es)?|my vaccine pass|traffic light (?:system|setting)|managed isolation|contact tracing|social distancing)\b/i;
const NOTICE = /\b(notice|alert|closure|closed|temporarily|cancelled|canceled|postponed|suspended|update[ds]?|important|please note|due to)\b/i;

export interface NoticeHit extends TextHit {
  kind: 'expired' | 'covid' | 'old_alert';
  date: string | null;
}

export function datedNotices(page: PageCapture, now: Date): NoticeHit[] {
  const out: NoticeHit[] = [];
  const yearAgo = new Date(now.getTime() - 365 * 86_400_000);
  for (const block of page.blocks) {
    const text = block.text;
    const covid = COVID.exec(text);
    if (covid) {
      out.push({ ...hit(page, block, 'covid', covid), kind: 'covid', date: null });
      continue;
    }
    const valid = VALID_UNTIL.exec(text);
    if (valid) {
      const d = parseDate(text.slice(valid.index, valid.index + 90));
      if (d && d.date.getTime() < now.getTime() - 86_400_000) {
        out.push({ ...hit(page, block, 'expired', valid), kind: 'expired', date: d.date.toISOString().slice(0, 10) });
        continue;
      }
    }
    if (text.length <= 400 && NOTICE.test(text)) {
      const d = parseDate(text);
      const notice = NOTICE.exec(text)!;
      if (d && d.date < yearAgo && Math.abs(d.index - notice.index) < 200) {
        out.push({ ...hit(page, block, 'old_alert', notice), kind: 'old_alert', date: d.date.toISOString().slice(0, 10) });
      }
    }
  }
  return out;
}

/**
 * Months (1 to 12) in New Zealand. `promo` is when a promotion for the season can fairly be on show,
 * which starts a month early. `current` is when a line saying the season is here can be true.
 */
const SEASONS: { label: string; re: RegExp; promo: number[]; current: number[] }[] = [
  { label: 'summer', re: /\bsummer\b/i, promo: [11, 12, 1, 2, 3], current: [12, 1, 2, 3] },
  { label: 'autumn', re: /\b(autumn|fall)\b/i, promo: [2, 3, 4, 5, 6], current: [3, 4, 5, 6] },
  { label: 'winter', re: /\bwinter\b/i, promo: [5, 6, 7, 8, 9], current: [6, 7, 8, 9] },
  { label: 'spring', re: /\bspring\b/i, promo: [8, 9, 10, 11, 12], current: [9, 10, 11, 12] },
  { label: 'christmas', re: /\b(christmas|xmas)\b/i, promo: [9, 10, 11, 12, 1], current: [11, 12, 1] },
  { label: 'easter', re: /\beaster\b/i, promo: [2, 3, 4], current: [3, 4] },
];
const PROMO = /\b(special|specials|sale|deal|deals|offer|offers|promo|promotion|discount|\d{1,2}\s?% off|book now for|limited time)\b/i;
const HERE_NOW = /\b(has (?:started|arrived|begun)|is (?:here|now here|upon us|in full swing)|is now on|have started)\b/i;

export function seasonalMismatches(page: PageCapture, month: number): (TextHit & { season: string })[] {
  const out: (TextHit & { season: string })[] = [];
  for (const block of page.blocks) {
    if (block.text.length > 300) continue;
    for (const s of SEASONS) {
      const m = s.re.exec(block.text);
      if (!m) continue;
      const here = HERE_NOW.exec(block.text.slice(m.index, m.index + 60));
      const promo = PROMO.exec(block.text);
      const promoNear = promo && Math.abs((promo.index ?? 0) - m.index) <= 60;
      if (here ? !s.current.includes(month) : promoNear ? !s.promo.includes(month) : false) {
        out.push({ ...hit(page, block, s.label, m), season: s.label });
      }
    }
  }
  return out;
}

/** Languages that belong on a New Zealand page written in English. */
const HOME_LANGUAGES = new Set(['eng', 'sco', 'mri', 'und']);

const MAORI_WORDS = new Set(['ko', 'te', 'ngā', 'nga', 'o', 'ki', 'me', 'he', 'ka', 'mō', 'mo', 'nō', 'no', 'i', 'kia', 'e', 'ā', 'a', 'ō', 'tō', 'tā', 'hoki', 'rātou', 'mātou', 'tātou', 'koe', 'au', 'ahau', 'tēnei', 'ēnei', 'nei', 'rā', 'ana', 'kua', 'kei', 'hei', 'mai', 'atu', 'iho', 'ake', 'whenua', 'moana', 'tangata', 'kōrero', 'reo', 'māori', 'aotearoa', 'whānau', 'iwi', 'hapū', 'mana', 'aroha', 'kaitiaki']);

/** franc has no model for te reo Māori and guesses other languages for it, so it is recognised by its own common words. */
export function looksMaori(text: string): boolean {
  const words = text.toLowerCase().match(/[\p{L}]+/gu) ?? [];
  if (words.length < 10) return false;
  return words.filter((w) => MAORI_WORDS.has(w)).length / words.length >= 0.3;
}

export function foreignBlocks(page: PageCapture): (TextHit & { language: string })[] {
  const pageLang = (page.meta.lang || 'en').toLowerCase().slice(0, 2);
  if (pageLang !== 'en') return [];
  const out: (TextHit & { language: string })[] = [];
  for (const block of page.blocks) {
    if (block.text.length < 200) continue;
    const language = franc(block.text, { minLength: 200 });
    if (HOME_LANGUAGES.has(language) || looksMaori(block.text)) continue;
    // Lists of names, prices and place names confuse language detection, so ask for real sentences.
    const letters = (block.text.match(/\p{L}/gu) ?? []).length;
    if (letters / block.text.length < 0.7) continue;
    out.push({ label: 'foreign', match: block.text.slice(0, 80), excerpt: block.text.slice(0, 200), block, pageUrl: page.finalUrl, viewport: page.viewport, language });
  }
  return out;
}

const PRICE = /(?:NZD?\s?)?\$\s?(\d{1,3}(?:,\d{3})+|\d{1,5})(?:\.(\d{2}))?(?!\d)/g;

export interface PriceHit {
  amount: number;
  text: string;
  context: string;
  block: TextBlock;
  pageUrl: string;
}

export function prices(page: PageCapture): PriceHit[] {
  const out: PriceHit[] = [];
  for (const block of page.blocks) {
    for (const m of block.text.matchAll(PRICE)) {
      const amount = Number(m[1]!.replace(/,/g, '')) + (m[2] ? Number(m[2]) / 100 : 0);
      if (amount <= 0) continue;
      out.push({ amount, text: m[0], context: excerptAround(block.text, m.index ?? 0, m[0].length, 60), block, pageUrl: page.finalUrl });
    }
  }
  return out;
}

export function pricesInText(text: string): { amount: number; text: string; context: string }[] {
  const out: { amount: number; text: string; context: string }[] = [];
  for (const m of text.matchAll(PRICE)) {
    const amount = Number(m[1]!.replace(/,/g, '')) + (m[2] ? Number(m[2]) / 100 : 0);
    if (amount > 0) out.push({ amount, text: m[0], context: excerptAround(text, m.index ?? 0, m[0].length, 60) });
  }
  return out;
}

const FOUNDED = /\b(?:since|established(?: in)?|est\.?|founded(?: in)?|operating since|in business since|started in|opened in|trading since|running since)\s+((?:19|20)\d{2})\b/gi;

const ABOUT_SELF = /\b(we|we've|we're|our|us|family|sharing|operating|running|guiding|trading|proudly|locally owned)\b/i;

/**
 * Starting years the business claims for itself. A sentence about someone else ("the trust was
 * founded in 1969") is left out: the claim must speak in the first person or carry the business name.
 */
export function foundingYears(page: PageCapture, businessName = ''): (TextHit & { year: number })[] {
  const out: (TextHit & { year: number })[] = [];
  const nameWords = businessName.toLowerCase().split(/[^a-z0-9āēīōū]+/).filter((w) => w.length >= 5);
  for (const block of page.blocks) {
    for (const m of block.text.matchAll(FOUNDED)) {
      const at = m.index ?? 0;
      // A claim is often split from its subject by a full stop ("Fixture Tours. Est. 2004."), so nearby words count.
      const sentence = block.text.slice(Math.max(0, at - 90), at + m[0].length + 60).toLowerCase();
      const own = ABOUT_SELF.test(sentence) || nameWords.filter((w) => sentence.includes(w)).length >= Math.min(2, nameWords.length || 99);
      if (own) out.push({ ...hit(page, block, 'founded', m), year: Number(m[1]) });
    }
  }
  return out;
}

const PHONE = /(?:\+?64[\s-]?\(?0?\)?[\s-]?|\(?0)(?:\d[\s\-()]{0,2}){7,10}\d/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;

export function phonesIn(text: string): string[] {
  return [...text.matchAll(PHONE)].map((m) => m[0].trim()).filter((p) => p.replace(/\D/g, '').length >= 8 && p.replace(/\D/g, '').length <= 13);
}

export function emailsIn(text: string): string[] {
  return [...text.matchAll(EMAIL)].map((m) => m[0].replace(/\.$/, '')).filter((e) => !/\.(png|jpe?g|gif|webp|svg|css|js)$/i.test(e));
}
