import * as cheerio from 'cheerio';
import { franc } from 'franc';
import { domainOf } from '@plumbline/core';
import { fingerprintUrl } from './booking.ts';
import { looksMaori } from './content.ts';

export interface HiddenBlock {
  /** Text of the block as it stands in the HTML. */
  text: string;
  language: string | null;
  spamTerms: string[];
  links: { href: string; domain: string }[];
  /** Line in the saved HTML where the block starts. */
  line: number | null;
  /** The opening of the block's own markup. */
  html: string;
  /** Text that comes just before the block in the page, used to find where it sits. */
  before: string[];
}

const SKIP = 'script, style, template, noscript, svg, head, iframe, select, option';
const HOME_LANGUAGES = new Set(['eng', 'sco', 'mri', 'und']);

/** Domains a business links to in the ordinary course of things. A link to one of these proves nothing. */
const ORDINARY = /(^|\.)(facebook\.com|instagram\.com|twitter\.com|x\.com|youtube\.com|youtu\.be|tiktok\.com|linkedin\.com|pinterest\.[a-z.]+|google\.[a-z.]+|goo\.gl|g\.page|apple\.com|microsoft\.com|whatsapp\.com|wa\.me|m\.me|tripadvisor\.[a-z.]+|newzealand\.com|qualmark\.co\.nz|tiaki\.nz|govt\.nz|wordpress\.(org|com)|wix\.com|squarespace\.com|rocketspark\.[a-z.]+|shopify\.com|weebly\.com|godaddy\.com|w3\.org|schema\.org|gravatar\.com|cloudflare\.com|vimeo\.com|metservice\.com|mailchimp\.com|paypal\.com|stripe\.com)$/;

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** True when none of three samples of the text appears in what a visitor can see. */
export function absentFrom(text: string, visible: string): boolean {
  const t = norm(text);
  if (t.length < 40) return false;
  const size = Math.min(60, Math.floor(t.length / 3));
  const samples = [t.slice(0, size), t.slice(Math.floor(t.length / 2 - size / 2), Math.floor(t.length / 2 + size / 2)), t.slice(-size)];
  return samples.every((s) => !visible.includes(s));
}

/**
 * Blocks of text that are in the page's HTML but are not among the text a visitor can see, and that
 * carry spam wording or a long passage in another language. `visible` holds the visible text of
 * every capture of this page: a block shown at any screen size is not hidden.
 */
export function hiddenBlocks(html: string, visible: string[], pageUrl: string, spam: RegExp[], pageLang = 'en'): HiddenBlock[] {
  const $ = cheerio.load(html, { sourceCodeLocationInfo: true });
  $(SKIP).remove();
  const shown = norm(visible.join('\n'));
  const own = domainOf(pageUrl);
  const out: HiddenBlock[] = [];
  const taken = new Set<unknown>();

  // Judge each piece of text where it sits, then add the results up through its ancestors. A
  // container counts as hidden only when all the text inside it is hidden, so a page wrapper
  // that merely holds a collapsed menu is not mistaken for a hidden block.
  const total = new Map<unknown, number>();
  const hiddenChars = new Map<unknown, number>();
  $('body *').each((_, node) => {
    const own = $(node).contents().toArray().filter((c) => c.type === 'text').map((c) => (c as unknown as { data: string }).data).join(' ').replace(/\s+/g, ' ').trim();
    if (own.length < 30) return;
    const isHidden = absentFrom(own.length < 40 ? `${own} ${own}` : own, shown);
    for (let cur: unknown = node; cur && (cur as { type?: string }).type === 'tag'; cur = (cur as { parent?: unknown }).parent) {
      total.set(cur, (total.get(cur) ?? 0) + own.length);
      if (isHidden) hiddenChars.set(cur, (hiddenChars.get(cur) ?? 0) + own.length);
    }
  });

  $('body *').each((_, node) => {
    const el = $(node);
    if (el.parents().toArray().some((p) => taken.has(p))) return;
    const all = total.get(node) ?? 0;
    // Entirely hidden, give or take a stray label.
    if (all < 80 || all - (hiddenChars.get(node) ?? 0) > 40) return;
    const text = el.text().replace(/\s+/g, ' ').trim();
    // From here on the block is settled, whatever it turns out to hold, so its parts are not judged again.
    taken.add(node);

    const spamTerms = [...new Set(spam.map((re) => re.exec(text)?.[0]).filter((x): x is string => !!x))];
    let language: string | null = null;
    if (text.length >= 200 && pageLang.toLowerCase().startsWith('en')) {
      const longest = el.find('p, li, div, td, span').toArray().map((n) => $(n).text().replace(/\s+/g, ' ').trim()).filter((t) => t.length >= 200).sort((a, b) => b.length - a.length)[0] ?? text;
      const guess = franc(longest.slice(0, 1500), { minLength: 200 });
      const letters = (longest.match(/\p{L}/gu) ?? []).length;
      if (!HOME_LANGUAGES.has(guess) && !looksMaori(longest) && letters / longest.length >= 0.7) language = guess;
    }
    if (!spamTerms.length && !language) return;

    const links: HiddenBlock['links'] = [];
    el.find('a[href]').each((__, a) => {
      const href = $(a).attr('href') ?? '';
      let abs: URL;
      try {
        abs = new URL(href, pageUrl);
      } catch {
        return;
      }
      if (!/^https?:$/.test(abs.protocol)) return;
      const domain = domainOf(abs.href);
      if (!domain || domain === own || ORDINARY.test(abs.hostname) || fingerprintUrl(abs.href)) return;
      if (!links.some((l) => l.domain === domain)) links.push({ href: abs.href, domain });
    });
    if (!links.length) return;

    const before: string[] = [];
    let cursor = el;
    for (let hops = 0; hops < 6 && before.length < 4; hops++) {
      const prev = cursor.prevAll().toArray();
      for (const p of prev) {
        const t = $(p).text().replace(/\s+/g, ' ').trim();
        if (t.length >= 20 && !absentFrom(t.slice(0, 200), shown)) before.push(t.slice(0, 200));
        if (before.length >= 4) break;
      }
      cursor = cursor.parent();
      if (!cursor.length) break;
    }
    const loc = (node as { sourceCodeLocation?: { startLine?: number } }).sourceCodeLocation;
    out.push({ text: text.slice(0, 2000), language, spamTerms: spamTerms.slice(0, 8), links: links.slice(0, 5), line: loc?.startLine ?? null, html: ($.html(el) ?? '').replace(/\s+/g, ' ').slice(0, 600), before });
  });
  return out;
}
