import * as cheerio from 'cheerio';
import { emailsIn, phonesIn } from '@plumbline/collect';
import { decodeCloudflareEmail, peopleByPattern, type FoundPerson } from '@plumbline/contacts';
import type { PageCapture, TextBlock } from '@plumbline/render';
import { engineOf, isBookWords, type Engine } from './engines.ts';
import { hostOfUrl } from './filters.ts';

export interface SitePage {
  url: string;
  finalUrl: string;
  status: number | null;
  html: string;
  /** home, contact, about or book */
  role: string;
}

const sameHost = (a: string, b: string) => {
  const x = hostOfUrl(a);
  const y = hostOfUrl(b);
  return !!x && x === y;
};

function abs(href: string, base: string): string | null {
  try {
    const u = new URL(href, base);
    if (!/^https?:$/.test(u.protocol)) return null;
    u.hash = '';
    return u.toString();
  } catch {
    return null;
  }
}

const CONTACT = /\b(?:contact|get in touch|find us|enquir(?:e|y|ies)|reach us)\b/i;
const ABOUT = /\b(?:about|our story|meet (?:the|your|our)|the team|our team|who we are|your hosts?|the owners|our people|practitioners|staff)\b/i;
const BOOK = /\b(?:book(?:ing|ings)?|reserv\w*|availability|rates|tariffs?|rooms?|accommodation|prices?|pricing|fees|appointments?)\b/i;

/**
 * The pages worth reading after the homepage, at most five: two contact pages, one about page and two
 * book, rates or rooms pages, all on the business's own site.
 */
export function pickPages(homeHtml: string, homeUrl: string, max = 5): { url: string; role: string }[] {
  const $ = cheerio.load(homeHtml);
  const picks: { url: string; role: string; rank: number }[] = [];
  const seen = new Set<string>([homeUrl.replace(/\/$/, '')]);
  $('a[href]').each((_, a) => {
    const href = $(a).attr('href') ?? '';
    const url = abs(href, homeUrl);
    if (!url || !sameHost(url, homeUrl) || /\.(pdf|jpe?g|png|gif|webp|docx?|zip)(\?|$)/i.test(url)) return;
    const key = url.replace(/\/$/, '');
    if (seen.has(key)) return;
    const text = $(a).text().replace(/\s+/g, ' ').trim();
    const path = (() => {
      try {
        return decodeURIComponent(new URL(url).pathname).replace(/[-_/+.]+/g, ' ');
      } catch {
        return '';
      }
    })();
    const hay = `${text} ${path}`;
    if (/\b(?:privacy|terms|jobs|careers|vacanc|blog|news|login|cart|checkout|wp-admin|feed)\b/i.test(hay)) return;
    let role = '';
    if (CONTACT.test(hay)) role = 'contact';
    else if (ABOUT.test(hay)) role = 'about';
    else if (BOOK.test(hay)) role = 'book';
    if (!role) return;
    seen.add(key);
    picks.push({ url, role, rank: picks.length });
  });
  const take = (role: string, n: number) => picks.filter((p) => p.role === role).slice(0, n);
  return [...take('contact', 2), ...take('about', 1), ...take('book', 2)].slice(0, max).map(({ url, role }) => ({ url, role }));
}

export interface FoundAddress {
  email: string;
  sourceUrl: string;
  how: 'mailto' | 'text' | 'cloudflare' | 'obfuscated';
}

const NOT_BUSINESS = /@(?:example\.|domain\.|email\.com$|yourdomain|sentry|wixpress\.com|godaddy\.com|squarespace\.com|wix\.com|rocketspark\.|mysite\.com|test\.com|company\.com|website\.com|seekom\.com|staah\.|littlehotelier|siteminder|cliniko\.com|halaxy\.com|booking\.com|airbnb\.|expedia\.|bookme\.|tripadvisor\.)|^(?:you|your|name|email|user|someone|username|firstname|john\.doe|jane\.doe|noreply|no-reply|donotreply)@|\.(?:png|jpe?g|gif|webp|svg|css|js)$/i;

const cleanEmail = (raw: string): string | null => {
  const e = raw
    .trim()
    .replace(/^mailto:/i, '')
    .split('?')[0]!
    .replace(/[.,;:)>\]]+$/, '')
    .toLowerCase();
  try {
    const d = decodeURIComponent(e);
    return /^[a-z0-9._%+'-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(d) && !NOT_BUSINESS.test(d) ? d : null;
  } catch {
    return null;
  }
};

/** Visible text of a page with scripts, styles and hidden template content left out. */
export function visibleText($: cheerio.CheerioAPI): string {
  const SKIP = new Set(['script', 'style', 'noscript', 'template', 'svg', 'head']);
  const parts: string[] = [];
  // Each element ends with a break, so words of neighbouring elements never run together into one fake address.
  const walk = (n: { type: string; data?: string; name?: string; attribs?: Record<string, string>; children?: unknown[] }) => {
    if (n.type === 'text') {
      parts.push(n.data ?? '');
      return;
    }
    if (n.type !== 'tag' && n.type !== 'root') return;
    if (n.name && SKIP.has(n.name)) return;
    if (n.attribs && ('hidden' in n.attribs || n.attribs['aria-hidden'] === 'true')) return;
    for (const ch of n.children ?? []) walk(ch as typeof n);
    if (n.type === 'tag') parts.push(/^(?:a|span|strong|em|b|i|u|small|sup|sub|abbr|label)$/.test(n.name ?? '') ? ' ' : '\n');
  };
  walk($.root()[0] as unknown as Parameters<typeof walk>[0]);
  return parts
    .join('')
    .replace(/&nbsp;|\u00a0/g, ' ')
    .replace(/[ \t\r]+/g, ' ')
    .replace(/ *\n[\s]*/g, '\n')
    .trim();
}

/** Published addresses on one page: email links first, then Cloudflare-protected ones, then the words of the page. */
export function emailsOnPage(html: string, url: string): FoundAddress[] {
  const $ = cheerio.load(html);
  const out = new Map<string, FoundAddress>();
  const add = (raw: string, how: FoundAddress['how']) => {
    const e = cleanEmail(raw);
    if (e && !out.has(e)) out.set(e, { email: e, sourceUrl: url, how });
  };
  $('a[href^="mailto:" i], a[href^="MAILTO:"]').each((_, a) => {
    for (const part of ($(a).attr('href') ?? '').slice(7).split(/[,;]/)) add(part, 'mailto');
  });
  $('[data-cfemail]').each((_, el) => {
    const d = decodeCloudflareEmail($(el).attr('data-cfemail') ?? '');
    if (d) add(d, 'cloudflare');
  });
  $('a[href*="email-protection#"]').each((_, a) => {
    const m = /email-protection#([0-9a-f]+)/i.exec($(a).attr('href') ?? '');
    const d = m ? decodeCloudflareEmail(m[1]!) : null;
    if (d) add(d, 'cloudflare');
  });
  const text = visibleText($);
  for (const e of emailsIn(text)) add(e, 'text');
  // A designer's credit ("Website by Pixel Ltd") links their own site; an address at that domain is theirs, not the business's.
  const credits = new Set<string>();
  $('a[href^="http"]').each((_, a) => {
    const around = `${$(a).text()} ${$(a).parent().text()}`.slice(0, 200);
    if (/\b(?:web ?site|design(?:ed)?|developed|built|created|powered|hosted|made)\s+(?:by|with)\b|\bweb design\b/i.test(around)) {
      const h = hostOfUrl($(a).attr('href') ?? '');
      if (h && !sameHost(h, url)) credits.add(h);
    }
  });
  for (const [e] of out) {
    const d = e.split('@')[1] ?? '';
    if ([...credits].some((h) => d === h || d.endsWith(`.${h}`) || h.endsWith(`.${d}`))) out.delete(e);
  }
  // "info [at] lodge [dot] co [dot] nz" and the like.
  for (const m of text.matchAll(/\b([a-z0-9._%+-]+)\s*(?:\[at\]|\(at\)|\{at\}| at )\s*([a-z0-9-]+(?:\s*(?:\[dot\]|\(dot\)|\.| dot )\s*[a-z0-9-]+)+)\b/gi)) {
    if (!/\[at\]|\(at\)|\{at\}/i.test(m[0]) && !/\b(?:dot)\b/i.test(m[0])) continue;
    add(`${m[1]}@${m[2]!.replace(/\s*(?:\[dot\]|\(dot\)| dot )\s*/gi, '.').replace(/\s+/g, '')}`, 'obfuscated');
  }
  return [...out.values()];
}

const ROLE_LOCAL = /^(?:info|information|admin|administration|bookings?|reservations?|res|stay|hello|hi|kiaora|kia\.?ora|enquir(?:y|ies)|inquir(?:y|ies)|contact|office|reception|frontdesk|front\.?desk|manager|managers|management|accounts?|mail|email|sales|team|clinic|physio|physiotherapy|chiro|osteo|help|support|welcome|hosts?|owners?|motel|lodge|park|camp|holidaypark|stay\w*|book|guest\w*|care|health|appointments?|practice|dental|dentist|smile|reception\w*)$/i;
const FREE_MAIL = /@(?:gmail\.com|googlemail\.com|xtra\.co\.nz|hotmail\.(?:com|co\.nz)|outlook\.(?:com|co\.nz)|live\.(?:com|co\.nz)|yahoo\.(?:com|co\.nz)|icloud\.com|me\.com|slingshot\.co\.nz|vodafone\.co\.nz|orcon\.net\.nz|actrix\.co\.nz|clear\.net\.nz|paradise\.net\.nz|ihug\.co\.nz|inspire\.net\.nz|farmside\.co\.nz|kinect\.co\.nz|snap\.net\.nz|woosh\.co\.nz|wave\.co\.nz|xnet\.co\.nz|bigpond\.com|protonmail\.com|proton\.me)$/i;
const NEVER_PICK = /^(?:accounts?|jobs|careers|privacy|webmaster|media|press|marketing|billing|invoices?|payroll|hr|recruitment|unsubscribe)@/i;

export function isRoleAddress(email: string): boolean {
  return ROLE_LOCAL.test(email.split('@')[0] ?? '');
}
export function isFreeMail(email: string): boolean {
  return FREE_MAIL.test(email);
}

/**
 * The address to write to, as the relay orders them: a named person's address or the business's own
 * domain before a generic one, and info@ or bookings@ before a personal free-mail address. For
 * dental (List C) a named person comes first, since the buyer is often a practice manager.
 */
export function pickEmail(found: FoundAddress[], website: string, preferNamed = false): FoundAddress | null {
  const host = hostOfUrl(website);
  const ownDomain = (e: string) => {
    const d = e.split('@')[1] ?? '';
    const root = host.split('.').slice(-3).join('.');
    return !!d && (d === host || host.endsWith(`.${d}`) || d.endsWith(`.${host}`) || (root.length > 6 && d.endsWith(root)) || d.replace(/^mail\./, '') === host);
  };
  const score = (f: FoundAddress) => {
    const e = f.email;
    let s = 0;
    if (NEVER_PICK.test(e)) s += 100;
    const own = ownDomain(e);
    const role = isRoleAddress(e);
    if (own && !role) s += preferNamed ? 0 : 1;
    else if (own && role) s += preferNamed ? 2 : 1;
    else if (!own && !isFreeMail(e)) s += 5;
    else if (role) s += 6;
    else s += 7;
    if (f.how !== 'mailto') s += 0.5;
    return s;
  };
  const ranked = [...found].sort((a, b) => score(a) - score(b));
  return ranked[0] ?? null;
}

/** Text blocks shaped like the renderer's, read from fetched HTML, so the name patterns can run on them. */
export function blocksOf(html: string): TextBlock[] {
  const $ = cheerio.load(html);
  $('script,style,noscript,template,svg').remove();
  const blocks: TextBlock[] = [];
  $('h1,h2,h3,h4,h5,h6,p,li,td,th,dd,dt,figcaption,blockquote,address,span,strong,em,b,div').each((_, el) => {
    const $el = $(el);
    // Leaf-ish elements only: an element whose children are all inline.
    if ($el.children('p,div,li,ul,ol,table,section,article,h1,h2,h3,h4,h5,h6').length) return;
    const text = $el.text().replace(/\s+/g, ' ').trim();
    if (!text || text.length > 1500) return;
    const inNav = $el.closest('nav,header,[role="navigation"]').length > 0;
    const inFooter = $el.closest('footer').length > 0;
    blocks.push({ text, tag: el.tagName.toLowerCase(), heading: null, selector: '', box: { x: 0, y: 0, w: 0, h: 0 }, fontSize: 16, href: null, inHeader: inNav, inNav, inFooter } as unknown as TextBlock);
  });
  return blocks;
}

export interface Greeting {
  name: string;
  role: string;
  quote: string;
  url: string;
}

/** Words that are a job, a trade or a place, never a person's name. */
const NOT_A_PERSON = /^(?:physio\w*|chiro\w*|osteo\w*|therapist|therapy|clinic|clinics|practice|practitioner|massage|acupunctur\w*|podiat\w*|pilates|reception\w*|motel|motels|lodge|park|holiday|accommodation|staff|team|director|manager|owner|host|hosts|dental|dentist|hygienist|nurse|doctor|sports?|rehab\w*|wellness|health|injury|spinal|spine)$/i;

export function isPersonName(name: string): boolean {
  const words = name.trim().split(/\s+/);
  return words.length > 0 && !words.some((w) => NOT_A_PERSON.test(w));
}

/** Owner and manager names as the site prints them, each with its page. */
export function greetingNamesOn(pages: SitePage[]): Greeting[] {
  const out = new Map<string, Greeting>();
  for (const p of pages) {
    if (!p.html) continue;
    const people: FoundPerson[] = peopleByPattern({ finalUrl: p.finalUrl, blocks: blocksOf(p.html) } as unknown as PageCapture);
    for (const f of people) {
      if (!isPersonName(f.name)) continue;
      const key = f.name.toLowerCase();
      if (!out.has(key)) out.set(key, { name: f.name, role: f.title, quote: f.quote, url: f.sourceUrl });
    }
  }
  return [...out.values()].slice(0, 6);
}

export interface PhoneFacts {
  shown: string | null;
  shownOn: string | null;
  telHref: string | null;
  telOn: string | null;
  /** The first tel: link carries a dialable number. null when there is no tel: link at all. */
  telWorks: boolean | null;
}

const digits = (s: string) => s.replace(/\D/g, '');

/** A tel: link dials when its number has at least seven digits. */
export function telDialable(href: string): boolean {
  const n = digits(decodeURIComponent(href.replace(/^tel:/i, '')));
  return n.length >= 7 && n.length <= 15;
}

export function phoneFacts(pages: SitePage[]): PhoneFacts {
  const f: PhoneFacts = { shown: null, shownOn: null, telHref: null, telOn: null, telWorks: null };
  for (const p of pages) {
    if (!p.html) continue;
    const $ = cheerio.load(p.html);
    if (!f.telHref) {
      const a = $('a[href^="tel:" i]').first();
      if (a.length) {
        f.telHref = a.attr('href') ?? '';
        f.telOn = p.finalUrl;
        f.telWorks = telDialable(f.telHref);
      }
    }
    if (!f.shown) {
      const nz = phonesIn(visibleText($)).find((x) => /^(?:\+?64|0)/.test(x.replace(/[^\d+]/g, '')) && digits(x).length >= 8);
      if (nz) {
        f.shown = nz;
        f.shownOn = p.finalUrl;
      }
    }
  }
  return f;
}

export interface BookingFacts {
  engine: string;
  engineKind: 'own' | 'platform' | 'generic' | 'none';
  bookingUrl: string;
  bookingOn: string;
  otaLinks: string[];
  engines: string[];
}

/** The engines named on the site (by link, frame, script or the words of the code), OTA links, and the generic Book links. */
export function bookingFacts(pages: SitePage[]): BookingFacts {
  const engines = new Map<string, { e: Engine; url: string; on: string }>();
  const ota = new Map<string, string>();
  let generic: { url: string; on: string } | null = null;
  for (const p of pages) {
    if (!p.html) continue;
    const $ = cheerio.load(p.html);
    const refs: { value: string; text: string }[] = [
      ...$('a[href]')
        .toArray()
        .map((a) => ({ value: $(a).attr('href') ?? '', text: $(a).text().replace(/\s+/g, ' ').trim() })),
      ...$('iframe[src], iframe[data-src], script[src], form[action]')
        .toArray()
        .map((el) => ({ value: $(el).attr('src') ?? $(el).attr('data-src') ?? $(el).attr('action') ?? '', text: '' })),
    ];
    for (const r of refs) {
      const url = abs(r.value, p.finalUrl);
      if (!url) continue;
      const e = engineOf(url);
      if (e?.kind === 'ota') {
        if (!ota.has(e.name) && /^https?:/i.test(url)) ota.set(e.name, url);
      } else if (e) {
        if (!engines.has(e.name)) engines.set(e.name, { e, url, on: p.finalUrl });
      } else if (!generic && r.text && isBookWords(r.text) && !/^(?:mailto|tel):/i.test(r.value)) generic = { url, on: p.finalUrl };
    }
    // Widgets that load from a script without a link: the host appears in the code.
    for (const m of p.html.matchAll(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,})(\/[^"'\s<>)]*)?/gi)) {
      const e = engineOf(m[0]);
      if (e && e.kind !== 'ota' && !engines.has(e.name)) engines.set(e.name, { e, url: m[0].slice(0, 300), on: p.finalUrl });
    }
  }
  const own = [...engines.values()].filter((x) => x.e.kind === 'own');
  const platform = [...engines.values()].filter((x) => x.e.kind === 'platform');
  const first = own[0] ?? platform[0];
  return {
    engine: first ? first.e.name : generic ? 'generic' : 'none',
    engineKind: own.length ? 'own' : platform.length ? 'platform' : generic ? 'generic' : 'none',
    bookingUrl: first?.url ?? generic?.url ?? [...ota.values()][0] ?? '',
    bookingOn: first?.on ?? generic?.on ?? '',
    otaLinks: [...ota.values()],
    engines: [...engines.keys()],
  };
}

const FULL = /\b(?:not (?:currently )?(?:taking|accepting) (?:any )?new (?:patients|clients)|no longer (?:taking|accepting) new (?:patients|clients)|books? (?:are|is) (?:currently )?closed|wait ?list|waiting list|fully booked|closed for the (?:season|winter|summer)|no vacanc(?:y|ies))\b/i;
/** A guest's words, not the business's: a review or testimonial. */
const REVIEWISH = /\b(?:we|i) (?:stayed|went|spent|visited|loved|enjoyed|had|booked|arrived|will be back)\b|\bour (?:stay|visit|holiday|trip)\b|\bhighly recommend|\bdespite\b|\bwish (?:i|we) could\b|\bthank you\b|\b(?:5|five) stars?\b|\bguests?\b.{0,20}\bsaid\b/i;
/** A note about a peak, a condition or a single date, not a statement that they are full now. */
const NOT_NOW = /\b(?:christmas|new years?|easter|public holidays?|long weekends?|school holidays|peak (?:season|times?)|specific dates?|particular dates?|cancellations?|may be|might be|can be|could be|often|sometimes|becomes?|tends? to|so (?:book|please book)|book (?:early|ahead|in advance))\b/i;
const REVIEW_BLOCKS = '[class*="review" i], [id*="review" i], [class*="testimonial" i], [id*="testimonial" i], [class*="trustindex" i], [class*="elfsight" i], [class*="tripadvisor" i], blockquote, q';

/**
 * "Already full" words on the homepage or a book page, said by the business about now: "not taking new
 * patients", "no vacancy", "closed for the season", a waitlist for new patients. Reviews, testimonials,
 * holiday peaks ("fully booked over Christmas, so book early") and single-date waitlists are left out.
 */
export function fullSignal(pages: SitePage[]): { phrase: string; url: string } | null {
  for (const p of pages.filter((x) => x.role === 'home' || x.role === 'book')) {
    if (!p.html) continue;
    const $ = cheerio.load(p.html);
    $(REVIEW_BLOCKS).remove();
    const text = visibleText($);
    for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
      if (!FULL.test(sentence) || REVIEWISH.test(sentence) || NOT_NOW.test(sentence) || sentence.length > 400) continue;
      return { phrase: sentence.replace(/\s+/g, ' ').trim().slice(0, 200), url: p.finalUrl };
    }
  }
  return null;
}

/** The site sells web or marketing services itself: said in its title, main heading or description. */
export function sellsWebOrMarketing(homeHtml: string): boolean {
  const $ = cheerio.load(homeHtml);
  const hay = `${$('title').text()} ${$('h1').first().text()} ${$('meta[name="description"]').attr('content') ?? ''}`;
  return /\b(?:web ?design|website design|web development|digital marketing|marketing agency|seo (?:services|agency|specialists?)|social media marketing|google ads management)\b/i.test(hay);
}

/** Distinct clinic or location pages linked from the homepage: more than four is a chain. */
export function locationCount(homeHtml: string, homeUrl: string): number {
  const $ = cheerio.load(homeHtml);
  const set = new Set<string>();
  $('a[href]').each((_, a) => {
    const url = abs($(a).attr('href') ?? '', homeUrl);
    if (!url || !sameHost(url, homeUrl)) return;
    const m = /\/(?:locations?|clinics?|our-clinics|branches)\/([^/?#]+)/i.exec(new URL(url).pathname);
    if (m && m[1]) set.add(m[1].toLowerCase());
  });
  return set.size;
}
