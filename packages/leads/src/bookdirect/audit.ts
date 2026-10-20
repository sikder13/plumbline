import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import { phonesIn, runLighthouse } from '@plumbline/collect';
import { HostLimiter, Polite } from '@plumbline/fetch';
import { Renderer, type PageCapture } from '@plumbline/render';
import { parseCsv } from '../batch.ts';
import { toCsv } from '../pull.ts';
import { CALL_WORDS, findingsOf, leadFindings, type AuditFacts, type BookLanding, type Finding } from './classes.ts';
import type { ContactRow } from './contacts.ts';
import { BOOK_DIRECT_GAP_MS, bookDirectPaths } from './discover.ts';
import { engineOf, isBookWords } from './engines.ts';
import { hostOfUrl } from './filters.ts';
import { bookingFacts, telDialable, visibleText, type SitePage } from './site.ts';

export interface AuditRecord {
  slug: string;
  list: string;
  name: string;
  town: string;
  homeUrl: string;
  measuredAt: string;
  facts: AuditFacts;
  findings: Finding[];
  firstScreenShot: string | null;
  bookOnFirstScreen: boolean;
  errors: string[];
}

/** The pages Part 2 saved for a lead. */
export function savedPages(slug: string): SitePage[] {
  const dir = join(bookDirectPaths().data, 'cache', 'sites', slug);
  const index = join(dir, 'pages.json');
  if (!existsSync(index)) return [];
  const c = JSON.parse(readFileSync(index, 'utf8')) as { pages: (Omit<SitePage, 'html'> & { file: string | null })[] };
  return c.pages.map((p) => ({ ...p, html: p.file && existsSync(join(dir, p.file)) ? readFileSync(join(dir, p.file), 'utf8') : '' })).filter((p) => p.html);
}

const PRICE = /(?:NZ)?\$\s?\d{2,4}(?:\.\d{2})?\b/;
const HOURS = /\b(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b[^\n]{0,40}?\b\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)\b|\b\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)\s*(?:-|–|to)\s*\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)\b|\bopening hours\b|\bclinic hours\b/i;
const CONTACT_PATH = /\/(?:contact|contact[-_ ]?us|get[-_]in[-_]touch|enquir(?:e|y|ies)(?:[-_](?:now|us))?)\/?(?:\.html?|\.php)?$/i;
const MISSING = /\bnot found\b|\b404\b|\bpage (?:doesn'?t|does not|cannot be) (?:exist|found)\b|\bno longer (?:exists|available)\b/i;

/** Whether a link points into the page it is on. */
function sameDoc(href: string, pageUrl: string): boolean {
  try {
    const a = new URL(href, pageUrl);
    const b = new URL(pageUrl);
    return a.origin === b.origin && a.pathname.replace(/\/$/, '') === b.pathname.replace(/\/$/, '');
  } catch {
    return false;
  }
}

/** Book controls a visitor can see on the first phone screen: Book words, an engine link or widget. */
export function bookControlsInFold(cap: PageCapture): string[] {
  const out: string[] = [];
  for (const l of cap.links) {
    if (!l.visible || !l.fold) continue;
    const e = engineOf(l.href);
    if (isBookWords(l.text)) out.push(`Book link "${l.text.trim().slice(0, 40)}"`);
    else if (e) out.push(`${e.name} link`);
  }
  for (const c of cap.controls) {
    if (!c.fold) continue;
    if (c.tag === 'iframe' && engineOf(c.src)) out.push(`${engineOf(c.src)!.name} widget`);
    else if (c.tag === 'form' && engineOf(c.action)) out.push(`${engineOf(c.action)!.name} search form`);
    else if (c.tag !== 'form' && c.tag !== 'iframe' && isBookWords(c.text)) out.push(`Book button "${c.text.trim().slice(0, 40)}"`);
  }
  return [...new Set(out)];
}

/** Book, Call or Book Appointment on the first phone screen: the Book controls, Call words, or a dialable tel: link. */
export function firstScreenControls(cap: PageCapture): string[] {
  const out = bookControlsInFold(cap);
  for (const l of cap.links) {
    if (!l.visible || !l.fold) continue;
    if (/^tel:/i.test(l.raw.trim()) && telDialable(l.raw.trim())) out.push(`call link ${l.raw.trim()}`);
    else if (CALL_WORDS.test(l.text.trim())) out.push(`Call link "${l.text.trim()}"`);
  }
  for (const c of cap.controls) if (c.fold && c.tag !== 'form' && c.tag !== 'iframe' && CALL_WORDS.test(c.text.trim())) out.push(`Call button "${c.text.trim()}"`);
  return [...new Set(out)];
}

interface ClickResult {
  text: string;
  selector: string;
  reacted: boolean;
  how: string;
}

/** Follows one Book link the way a visitor's browser would, sending nothing. */
async function follow(polite: Polite, homeUrl: string, homeHtml: string, link: { text: string; raw: string; href: string }, clicks: ClickResult[]): Promise<BookLanding> {
  const raw = link.raw.trim();
  const base = { text: link.text.trim().slice(0, 60), href: raw || link.href, status: null as number | null, landedOn: '', detail: '' };
  if (/^(?:tel|mailto|sms):/i.test(raw)) return { ...base, outcome: 'ok', landedOn: raw.split(':')[0]! };
  if (!raw || raw === '#' || /^javascript:/i.test(raw)) {
    const c = clicks.find((x) => x.text.toLowerCase() === link.text.trim().toLowerCase());
    if (!c) return { ...base, outcome: 'unknown', detail: 'no target and not tapped (not visible)' };
    const eng = engineOf(c.how.replace(/^a new tab \((.*)\)$/, '$1'));
    return c.reacted ? { ...base, outcome: 'ok', landedOn: c.how, ...(eng && eng.kind !== 'ota' ? { engine: eng.name } : {}) } : { ...base, outcome: 'no_target', detail: 'no link target, and tapping it changed nothing in 3 seconds' };
  }
  let target: URL;
  try {
    target = new URL(link.href || raw, homeUrl);
  } catch {
    return { ...base, outcome: 'no_target', detail: 'the link target cannot be read' };
  }
  const home = new URL(homeUrl);
  if (target.hash.length > 1 && target.origin + target.pathname.replace(/\/$/, '') === home.origin + home.pathname.replace(/\/$/, '')) {
    const id = decodeURIComponent(target.hash.slice(1));
    const $ = cheerio.load(homeHtml);
    const exists = $('[id]').toArray().some((e) => $(e).attr('id') === id) || $('a[name]').toArray().some((e) => $(e).attr('name') === id);
    if (exists) return { ...base, outcome: 'ok', landedOn: 'a section of the same page' };
    // The section is missing, but a script may still take the visitor to the engine: only the tap decides.
    const c = clicks.find((x) => x.text.toLowerCase() === link.text.trim().toLowerCase());
    if (!c) return { ...base, outcome: 'unknown', detail: `the section #${id} is not on the page, and the link was not tapped` };
    const eng = engineOf(c.how.replace(/^a new tab \((.*)\)$/, '$1'));
    return c.reacted ? { ...base, outcome: 'ok', landedOn: c.how, ...(eng && eng.kind !== 'ota' ? { engine: eng.name } : {}) } : { ...base, outcome: 'no_target', detail: `it points at #${id}, which is not on the page, and tapping it changed nothing in 3 seconds` };
  }
  let r = await polite.get(target.toString(), { maxRedirects: 6, timeoutMs: 25_000, maxBytes: 800_000 });
  if ((r.status !== null && r.status >= 500) || (r.status === null && r.error && r.error !== 'robots' && r.error !== 'ENOTFOUND')) {
    await new Promise((res) => setTimeout(res, 3000));
    r = await polite.get(target.toString(), { maxRedirects: 6, timeoutMs: 25_000, maxBytes: 800_000 });
  }
  const eng = engineOf(r.finalUrl) ?? engineOf(target.toString());
  if (r.status === null) {
    if (r.error === 'ENOTFOUND') return { ...base, outcome: 'not_200', detail: `${target.hostname} does not resolve` };
    return { ...base, outcome: 'unknown', landedOn: eng?.name ?? target.hostname, detail: r.error === 'robots' ? 'not opened: robots.txt' : `no answer (${r.error ?? 'error'})`, ...(eng && eng.kind !== 'ota' ? { engine: eng.name } : {}) };
  }
  if ([401, 403, 405, 429].includes(r.status)) return { ...base, outcome: 'unknown', status: r.status, landedOn: eng?.name ?? target.hostname, detail: `answered ${r.status} to us; a browser may differ`, ...(eng && eng.kind !== 'ota' ? { engine: eng.name } : {}) };
  if (r.status === 404 || r.status === 410 || r.status >= 500) return { ...base, outcome: 'not_200', status: r.status, landedOn: r.finalUrl, detail: r.finalUrl };
  const $ = cheerio.load(r.body);
  const title = $('title').first().text().trim();
  const h1 = $('h1').first().text().trim();
  if (r.status >= 200 && r.status < 300 && MISSING.test(`${title} ${h1}`) && !eng) return { ...base, outcome: 'not_200', status: r.status, landedOn: r.finalUrl, detail: `the page says "${(h1 || title).slice(0, 60)}"` };
  if (eng) return { ...base, outcome: 'ok', status: r.status, landedOn: eng.name, ...(eng.kind !== 'ota' ? { engine: eng.name } : {}) };
  const onLanding = bookingFacts([{ url: r.finalUrl, finalUrl: r.finalUrl, status: r.status, html: r.body, role: 'book' }]);
  if (onLanding.engineKind === 'own' || onLanding.engineKind === 'platform') return { ...base, outcome: 'ok', status: r.status, landedOn: `${onLanding.engine} (on ${r.finalUrl})`, engine: onLanding.engine };
  const sameSite = hostOfUrl(r.finalUrl) === hostOfUrl(homeUrl);
  const path = (() => {
    try {
      return new URL(r.finalUrl).pathname;
    } catch {
      return '';
    }
  })();
  if (sameSite && (CONTACT_PATH.test(path) || /^\s*contact\b/i.test(title))) return { ...base, outcome: 'contact_page', status: r.status, landedOn: r.finalUrl, detail: r.finalUrl };
  return { ...base, outcome: 'ok', status: r.status, landedOn: r.finalUrl };
}

/** Lighthouse on a phone, once; when that one run is over 4 s, twice more, and the median of the three is kept. */
async function lcpOf(polite: Polite, url: string): Promise<{ lcpS: number | null; runs: number; error: string | null }> {
  const first = await runLighthouse(polite, url, 'mobile', 1);
  if (!first) return { lcpS: null, runs: 0, error: 'not run (robots.txt or a bad address)' };
  const v1 = first.runs[0]?.lcpMs ?? null;
  if (v1 === null) return { lcpS: null, runs: 1, error: first.runs[0]?.error ?? 'no LCP' };
  if (v1 <= 4000) return { lcpS: Math.round(v1 / 100) / 10, runs: 1, error: null };
  const more = await runLighthouse(polite, url, 'mobile', 2);
  const all = [v1, ...(more?.runs.map((r) => r.lcpMs).filter((x): x is number => x !== null) ?? [])].sort((a, b) => a - b);
  const median = all[Math.floor((all.length - 1) / 2)]!;
  return { lcpS: Math.round(median / 100) / 10, runs: all.length, error: null };
}

/** The own-site page that shows rates or takes the booking, for the second speed measurement. */
function ratesPage(pages: SitePage[], homeUrl: string): string | null {
  const own = pages.filter((p) => p.role === 'book' && hostOfUrl(p.finalUrl) === hostOfUrl(homeUrl));
  const pick = own.find((p) => /rates|tariff|pric|book|reserv|availab|appointment/i.test(p.finalUrl)) ?? own.find((p) => /room|accommodation|stay|units?/i.test(p.finalUrl)) ?? null;
  return pick?.finalUrl ?? null;
}

/**
 * Leads that can still qualify first (a booking path, nothing saying they are full), those with 10 to
 * 150 ratings before the rest, and the lists taken in turn, so a night that ends early has measured
 * both lists where it counts.
 */
export function auditOrder<T extends Pick<ContactRow, 'list' | 'booking_engine_kind' | 'ota_links' | 'full_signal' | 'rating_count' | 'slug'>>(leads: T[]): T[] {
  const likely = (l: T) => (l.booking_engine_kind !== 'none' || !!l.ota_links) && !l.full_signal;
  const band = (l: T) => Number(l.rating_count) >= 10 && Number(l.rating_count) <= 150;
  const rank = (a: T, b: T) => Number(likely(b)) - Number(likely(a)) || Number(band(b)) - Number(band(a)) || Number(b.rating_count) - Number(a.rating_count) || a.slug.localeCompare(b.slug);
  const lists = [...new Set(leads.map((l) => l.list))].sort();
  const queues = lists.map((x) => leads.filter((l) => l.list === x).sort(rank));
  const out: T[] = [];
  // Within each tier of likelihood, the lists alternate.
  for (const want of [true, false]) {
    const qs = queues.map((q) => q.filter((l) => likely(l) === want));
    for (let i = 0; qs.some((q) => i < q.length); i++) for (const q of qs) if (i < q.length) out.push(q[i]!);
  }
  return out;
}

export interface AuditOptions {
  /** Audit again every lead already audited, keeping its stored phone speed. */
  refresh?: boolean;
  /** Audit at most this many new leads in this run (those already audited are kept). */
  max?: number;
  /** Only these lists, for example ['C', 'D']. */
  lists?: string[];
  parallel?: number;
  lighthouseParallel?: number;
  only?: string[];
  speed?: boolean;
  log?: (l: string) => void;
}

/** Part 3: the audit, for leads that passed the gate only. Nothing is sent to any business. */
export async function auditVerified(opts: AuditOptions = {}): Promise<{ records: AuditRecord[] }> {
  const p = bookDirectPaths();
  const log = opts.log ?? (() => undefined);
  const dir = join(p.data, 'audit');
  mkdirSync(join(dir, 'shots'), { recursive: true });
  let leads = parseCsv(readFileSync(join(p.leads, '_verified.csv'), 'utf8')) as unknown as ContactRow[];
  if (opts.only) leads = leads.filter((l) => opts.only!.includes(l.slug));
  if (opts.lists) leads = leads.filter((l) => opts.lists!.includes(l.list));
  leads = auditOrder(leads);
  if (opts.max) {
    const dir0 = join(p.data, 'audit');
    const doneAlready = leads.filter((l) => existsSync(join(dir0, `${l.slug}.json`)));
    leads = [...doneAlready, ...leads.filter((l) => !existsSync(join(dir0, `${l.slug}.json`))).slice(0, opts.max)];
  }
  const polite = new Polite(new HostLimiter(BOOK_DIRECT_GAP_MS));
  const renderer = new Renderer(polite);
  const limit = pLimit(opts.parallel ?? 6);
  const lhLimit = pLimit(opts.lighthouseParallel ?? 3);
  const records: AuditRecord[] = [];
  let done = 0;
  try {
    await Promise.all(
      leads.map((lead) =>
        limit(async () => {
          const file = join(dir, `${lead.slug}.json`);
          const stored = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as AuditRecord) : null;
          if (stored && !opts.only && !opts.refresh) {
            records.push(stored);
            done++;
            return;
          }
          // A refresh reads the pages and follows the links again, and keeps the phone speed already measured.
          const keep = opts.refresh && stored ? stored.facts.speed : null;
          if (opts.refresh && !stored) return;
          const rec = await auditOne(lead, { polite, renderer, lhLimit, shots: join(dir, 'shots'), speed: keep ? false : opts.speed !== false });
          if (keep) {
            rec.facts.speed = keep;
            rec.findings = findingsOf(rec.facts);
            rec.measuredAt = `${rec.measuredAt} (speed ${stored!.measuredAt})`;
          }
          writeFileSync(file, JSON.stringify(rec, null, 1));
          records.push(rec);
          const lead1 = leadFindings(rec.findings)[0];
          log(`[${++done}/${leads.length}] ${lead.slug}: ${lead1 ? `${lead1.cls} (tier ${lead1.tier})` : 'no lead finding'}${rec.errors.length ? `; ${rec.errors.join('; ').slice(0, 120)}` : ''}`);
        }),
      ),
    );
  } finally {
    await renderer.stop();
  }
  return { records };
}

async function auditOne(lead: ContactRow, deps: { polite: Polite; renderer: Renderer; lhLimit: <T>(fn: () => Promise<T>) => Promise<T>; shots: string; speed: boolean }): Promise<AuditRecord> {
  const errors: string[] = [];
  const pages = savedPages(lead.slug);
  const homeUrl = lead.home_url || lead.website;
  let cap: PageCapture | null = null;
  let renderedHtml = '';
  let layout = { scrollWidth: 0, innerWidth: 390, movesSideways: false };
  const clicks: ClickResult[] = [];
  let shot: string | null = null;
  try {
    cap = await deps.renderer.render({
      url: homeUrl,
      viewport: 'mobile',
      onPage: async (page, c) => {
        renderedHtml = await page.content();
        shot = join(deps.shots, `${lead.slug}-390.png`);
        await page.screenshot({ path: shot, clip: { x: 0, y: 0, width: 390, height: 844 } }).catch(() => (shot = null));
        layout = await page.evaluate(() => {
          const sw = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
          window.scrollTo(300, 0);
          const moved = window.scrollX > 0;
          window.scrollTo(0, 0);
          return { scrollWidth: sw, innerWidth: window.innerWidth, movesSideways: moved };
        });
        // A Book control with no link target, or one that points at a section the page does not have, is tapped once
        // (never one inside a form) to see whether anything opens: a script may take it to the engine.
        const noSection = async (raw: string) => {
          const m = /^(?:\/?)#(.+)$/.exec(raw) ?? (raw.includes('#') && sameDoc(raw, page.url()) ? /#(.+)$/.exec(raw) : null);
          if (!m) return false;
          const id = decodeURIComponent(m[1]!);
          return page.evaluate((x) => !document.getElementById(x) && !document.querySelector(`[name="${CSS.escape(x)}"]`), id).catch(() => false);
        };
        const untargeted: typeof c.links = [];
        for (const l of [...c.links].sort((a, b) => Number(b.visible) - Number(a.visible))) {
          const raw = l.raw.trim();
          if (!isBookWords(l.text) || !l.selector || untargeted.some((u) => u.raw.trim() === raw && u.text.trim() === l.text.trim())) continue;
          if (!raw || raw === '#' || /^javascript:/i.test(raw) || (await noSection(raw))) untargeted.push(l);
        }
        const bare = (u: string) => u.split('#')[0];
        const overlays = () => page.evaluate(() => [...document.querySelectorAll('dialog[open], [role="dialog"], [aria-modal="true"], .modal.show, .modal.in, .mfp-ready, .fancybox-is-open, iframe')].filter((e) => {
          const r = (e as HTMLElement).getBoundingClientRect();
          return r.width > 100 && r.height > 100 && r.top < window.innerHeight && r.bottom > 0;
        }).length).catch(() => 0);
        for (const l of untargeted.slice(0, 3)) {
          const before = page.url();
          const inForm = await page.locator(l.selector).first().evaluate((el) => !!el.closest('form')).catch(() => true);
          if (inForm) continue;
          const framesBefore = page.frames().length;
          const shownBefore = await overlays();
          const sizeBefore = await page.evaluate(() => document.body?.innerHTML.length ?? 0).catch(() => 0);
          let navigatedTo = '';
          const onNav = (f: { url(): string }) => {
            if (f === page.mainFrame() && bare(f.url()) !== bare(before)) navigatedTo = f.url();
          };
          page.on('framenavigated', onNav);
          const popup = page.context().waitForEvent('page', { timeout: 3500 }).catch(() => null);
          const fired = await page.locator(l.selector).first().dispatchEvent('click').then(() => true).catch(() => false);
          const opened = await popup;
          await page.waitForTimeout(3000);
          page.off('framenavigated', onNav);
          if (!fired && !navigatedTo && !opened) continue;
          const left = !!navigatedTo || bare(page.url()) !== bare(before);
          const shownAfter = left ? shownBefore : await overlays();
          const sizeAfter = left ? sizeBefore : await page.evaluate(() => document.body?.innerHTML.length ?? 0).catch(() => sizeBefore);
          const reacted = !!opened || left || page.frames().length > framesBefore || shownAfter > shownBefore || Math.abs(sizeAfter - sizeBefore) > 300;
          clicks.push({ text: l.text.trim(), selector: l.selector, reacted, how: opened ? `a new tab (${opened.url()})` : left ? navigatedTo || page.url() : shownAfter > shownBefore ? 'a panel or frame on the page' : 'a change on the page' });
          if (opened) await opened.close().catch(() => undefined);
          if (left) await page.goto(before, { waitUntil: 'domcontentloaded', timeout: 20_000 }).catch(() => undefined);
        }
      },
    });
    if (!cap.ok) errors.push(`home not rendered: ${cap.blocked ?? cap.error ?? cap.status}`);
  } catch (e) {
    errors.push(`render failed: ${(e as Error).message.slice(0, 100)}`);
  }
  const homeHtml = renderedHtml || pages.find((x) => x.role.startsWith('home'))?.html || '';
  const renderedPage: SitePage[] = renderedHtml && cap ? [{ url: homeUrl, finalUrl: cap.finalUrl, status: cap.status, html: renderedHtml, role: 'home' }] : [];
  const booking = bookingFacts([...renderedPage, ...pages]);
  const ownEngine = booking.engineKind === 'own' || booking.engineKind === 'platform' ? booking.engine : '';
  const otaPage = [...renderedPage, ...pages].find((pg) => bookingFacts([pg]).otaLinks.length);

  // Book links: on the phone render (any, seen or folded away) and in the saved homepage and book pages.
  const linkSet: { text: string; raw: string; href: string }[] = [];
  const addLink = (text: string, raw: string, href: string) => {
    if (!isBookWords(text)) return;
    if (linkSet.some((x) => x.text.toLowerCase() === text.trim().toLowerCase() && x.href === href)) return;
    linkSet.push({ text, raw, href });
  };
  for (const l of cap?.links ?? []) addLink(l.text, l.raw, l.href);
  for (const pg of pages.filter((x) => x.role.startsWith('home'))) {
    const $ = cheerio.load(pg.html);
    $('a').each((_, a) => {
      const raw = $(a).attr('href') ?? '';
      const href = (() => {
        try {
          return raw ? new URL(raw, pg.finalUrl).toString() : '';
        } catch {
          return '';
        }
      })();
      addLink($(a).text().replace(/\s+/g, ' ').trim(), raw, href);
    });
  }
  const landings: BookLanding[] = [];
  for (const l of linkSet.slice(0, 6)) landings.push(await follow(deps.polite, cap?.finalUrl ?? homeUrl, homeHtml, l, clicks));
  // An engine the Book link reaches (a /book-online page that holds the widget) is the lead's engine too.
  const engineFound = ownEngine || (landings.find((l) => l.engine)?.engine ?? '');

  // The phone path on the homepage, as a phone shows it.
  const homeText = cap?.ok ? cap.text : visibleText(cheerio.load(homeHtml));
  const shown = phonesIn(homeText).find((x) => /^(?:\+?64|0)/.test(x.replace(/[^\d+]/g, '')) && x.replace(/\D/g, '').length >= 8) ?? null;
  const telLinks = (cap?.links ?? []).map((l) => l.raw.trim()).filter((r) => /^tel:/i.test(r));
  const $home = cheerio.load(homeHtml);
  const telFromHtml = telLinks.length ? telLinks : $home('a[href^="tel:" i]').toArray().map((a) => $home(a).attr('href') ?? '');

  // Speed on a phone.
  const speed: AuditFacts['speed'] = { measured: false, pages: [], error: null };
  if (deps.speed) {
    await deps.lhLimit(async () => {
      const h = await lcpOf(deps.polite, cap?.finalUrl ?? homeUrl);
      if (h.lcpS !== null) speed.pages.push({ url: cap?.finalUrl ?? homeUrl, lcpS: h.lcpS, runs: h.runs });
      else speed.error = `home: ${h.error}`;
      const rates = ratesPage(pages, homeUrl);
      if (rates && (h.lcpS === null || h.lcpS <= 6)) {
        const r = await lcpOf(deps.polite, rates);
        if (r.lcpS !== null) speed.pages.push({ url: rates, lcpS: r.lcpS, runs: r.runs });
        else speed.error = `${speed.error ? `${speed.error}; ` : ''}rates page: ${r.error}`;
      }
      speed.measured = speed.pages.length > 0;
    });
  }

  const allText = [homeText, ...pages.map((pg) => visibleText(cheerio.load(pg.html)))].join('\n');
  const years = [...homeText.matchAll(/(?:©|copyright)\s*(?:\d{4}\s*(?:-|–|to)\s*)?(20\d{2})/gi)].map((m) => Number(m[1]));
  const facts: AuditFacts = {
    list: lead.list,
    homeUrl: cap?.finalUrl ?? homeUrl,
    ownEngine: engineFound,
    otaLinks: booking.otaLinks,
    otaOn: otaPage?.finalUrl ?? '',
    landings,
    firstScreen: { checked: !!cap?.ok, controls: cap?.ok ? firstScreenControls(cap) : [] },
    phone: { shownOnHome: shown, telLinksOnHome: telFromHtml, firstTelWorks: telFromHtml.length ? telDialable(telFromHtml[0]!) : null },
    speed,
    pricesFound: PRICE.test(allText),
    hoursFound: HOURS.test(allText),
    layout: { viewportMeta: cap?.ok ? cap.meta.viewport : (cheerio.load(homeHtml)('meta[name="viewport"]').attr('content') ?? null), ...layout },
    hygiene: { footerYear: years.length ? Math.max(...years) : null, https: (cap?.finalUrl ?? homeUrl).startsWith('https:') },
  };
  if (!cap?.ok) facts.layout = { ...facts.layout, scrollWidth: 0, innerWidth: 390, movesSideways: false };
  return {
    slug: lead.slug,
    list: lead.list,
    name: lead.name,
    town: lead.town,
    homeUrl: facts.homeUrl,
    measuredAt: new Date().toISOString(),
    facts,
    findings: findingsOf(facts),
    firstScreenShot: shot,
    bookOnFirstScreen: cap?.ok ? bookControlsInFold(cap).length > 0 : false,
    errors,
  };
}

export const AUDIT_COLUMNS = ['slug', 'list', 'name', 'town', 'home', 'own_engine', 'ota_links', 'first_screen_cta', 'book_landings', 'tel', 'lcp', 'findings', 'errors'];

export function auditCsv(records: AuditRecord[]): string {
  const rows = records.map((r) => ({
    slug: r.slug,
    list: r.list,
    name: r.name,
    town: r.town,
    home: r.homeUrl,
    own_engine: r.facts.ownEngine,
    ota_links: r.facts.otaLinks.join(' '),
    first_screen_cta: r.facts.firstScreen.checked ? r.facts.firstScreen.controls.join('; ') || 'none' : 'not checked',
    book_landings: r.facts.landings.map((l) => `${l.text} -> ${l.outcome}${l.landedOn ? ` (${l.landedOn})` : ''}`).join(' | '),
    tel: `${r.facts.phone.shownOnHome ?? 'no number shown'}; ${r.facts.phone.telLinksOnHome[0] ?? 'no tel link'}`,
    lcp: r.facts.speed.measured ? r.facts.speed.pages.map((p) => `${p.lcpS} s ${p.url}`).join(' | ') : `not_measured${r.facts.speed.error ? ` (${r.facts.speed.error})` : ''}`,
    findings: r.findings.map((f) => `${f.cls}/${f.tier}: ${f.value}`).join(' | '),
    errors: r.errors.join('; '),
  }));
  return toCsv(rows, AUDIT_COLUMNS as (keyof (typeof rows)[number])[]);
}
