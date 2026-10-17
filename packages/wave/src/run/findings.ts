import type { FactCheck } from './verify.ts';
import type { SpeedResult } from './speed.ts';
import { isSlowOnPhone } from './speed.ts';
import type { Landing, SystemHit } from './booking.ts';
import { bookingish } from './booking.ts';
import type { FormState, UnlinkedPage } from './probe.ts';
import type { FaithFlag, TestimonialSign } from './screens.ts';
import { pageName, type FindingType, type RawFinding } from './tiers.ts';

/** One check finding, cut down to what the run keeps. */
export interface CheckOut {
  checkId: string;
  title: string;
  pageUrl: string | null;
  detail: Record<string, unknown>;
  excerpt: string;
  evidenceUrl: string | null;
}

export interface ExampleOut {
  url: string;
  status: number | null;
  missing: boolean;
  title: string;
  words: number;
  /** The first words of the page, so a leftover can be named by what it says. */
  snippet: string;
  linkedFrom: { pageUrl: string; text: string; where: string }[];
}

export interface CrawlmouseOut {
  text: string;
  claims: string[];
  caution: string | null;
  confirmed: boolean;
  undecided: boolean;
  measured: string | null;
  reason: string | null;
  examples: ExampleOut[];
}

export interface PhoneScreen {
  url: string;
  width: number;
  height: number;
  actions: string[];
  actionVisible: boolean;
  /** The page really moves sideways when scrolled. */
  sideways: boolean;
  /** The page is laid out wider than the screen but does not move when scrolled (a phone shrinks it to fit). */
  wider: boolean;
  scrollWidth: number;
  scrollX: number | null;
}

export interface PageSummary {
  url: string;
  hasDescription: boolean;
  hasHeading: boolean;
  hasStructuredData: boolean;
}

export interface BookingScan {
  systems: SystemHit[];
  path: string;
  landings: Landing[];
  unlinked: UnlinkedPage[];
  forms: FormState[];
  /** Prices are shown, and nothing on the homepage lets a visitor book, enquire, call or email. */
  noWay: boolean;
}

export interface PelorusHeaders {
  checkedAt: string;
  requests: { url: string; method: 'HEAD'; status: number | null; location: string | null; error: string | null }[];
}

/** Everything a run measures for one business, kept so the findings can be worked out again without opening the site. */
export interface RunMeasured {
  slug: string;
  measuredAt: string;
  category: string;
  homepage: string;
  collection: { blocked: string | null; errors: string[]; pagesRead: number; checkErrors: string[] };
  facts: FactCheck;
  checks: CheckOut[];
  eol: { product: string; version: string; eolDate: string; sourceUrl: string }[];
  speed: SpeedResult;
  phone: PhoneScreen | null;
  booking: BookingScan | null;
  crawlmouse: CrawlmouseOut[];
  pages: PageSummary[];
  physio: TestimonialSign[] | null;
  faith: FaithFlag[];
  agencies: string[];
  refusal: string | null;
  pelorus: PelorusHeaders | null;
  trading: string[];
  aiCrawlers: { allowed: boolean; blocked: string[] };
}

/** Checks whose findings are ranked above, or replaced by the run's own measurements, or kept apart for a person to look at. */
const HANDLED = new Set(['C01_placeholder_text', 'C02_stale_copyright', 'C03_stale_dated_notice', 'C06_broken_images', 'C10_broken_contact_links', 'C11_dead_navigation', 'C12_broken_internal_links', 'C41_outdated_platform', 'T02_booking_system_not_linked', 'C13_no_action_above_fold', 'C20_slow_mobile', 'C23_not_mobile_friendly', 'C31_no_structured_data', 'C05_possible_compromise', 'C05b_hidden_injected_content']);

/** What the checks measured that the tiers do not rank, kept so a person can see it. */
export function otherObservations(m: RunMeasured): string[] {
  return m.checks.filter((c) => !HANDLED.has(c.checkId)).map((c) => `${c.checkId.split('_')[0]}: ${c.title}`.slice(0, 120));
}

const NOUN: Record<string, string> = { fishing: 'charters', kayak: 'tours', accommodation: 'stays', physio: 'appointments' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function monthYear(iso: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : iso;
}

const norm = (u: string) => u.replace(/^https?:\/\/(?:www\.)?/i, '').replace(/[#?].*$/, '').replace(/\/$/, '').toLowerCase();

/** The part of a page title before the site's name: "demo page - Welcome to X" is "demo page". */
const headTitle = (t: string) => t.split(/\s+[-|\u2013\u2014]\s+/)[0]!.trim();

function leftoverType(e: ExampleOut): { type: FindingType; title: string } | null {
  const hay = `${e.url} ${e.title} ${e.snippet}`.toLowerCase();
  const path = (() => {
    try {
      return new URL(e.url).pathname.toLowerCase();
    } catch {
      return '';
    }
  })();
  if (/hello[-_ ]world/.test(hay)) return { type: 'hello_world', title: headTitle(e.title) };
  if (/my post content|lorem ipsum|a-blog-post-copy/.test(hay)) return { type: 'template_post', title: headTitle(e.title) };
  if (/\bcoming soon\b/.test(hay)) return { type: 'coming_soon_page', title: headTitle(e.title) };
  if (/new[-_ ]page/.test(path) || /^new page$/i.test(e.title.trim())) return { type: 'blank_page', title: headTitle(e.title) || 'new page' };
  if (/\bdemo\b/.test(`${path} ${e.title.toLowerCase()}`)) return { type: 'demo_page', title: headTitle(e.title) };
  if (/maintenance|under construction/.test(`${path} ${e.title.toLowerCase()}`)) return { type: 'maintenance_page', title: headTitle(e.title) };
  return null;
}

/** Turns what was measured into findings, each tied to its evidence. The kinds and sentences are in tiers.ts. */
export function buildFindings(m: RunMeasured): RawFinding[] {
  const out: RawFinding[] = [];
  const at = m.measuredAt;
  const push = (f: Omit<RawFinding, 'measuredAt' | 'source'> & { source?: RawFinding['source'] }) => out.push({ source: 'plumbline', measuredAt: at, ...f });

  // Speed
  if (m.speed.status === 'ok' || m.speed.status === 'unstable') {
    const slow = m.speed.status === 'ok' ? isSlowOnPhone(m.speed) : (m.speed.performance ?? 100) < 50;
    if (slow) {
      const seconds = Math.round(((m.speed.lcpMs ?? 0) / 1000) * 10) / 10;
      push({ type: 'slow_phone', key: 'speed', facts: { score: m.speed.performance ?? 0, seconds }, steady: m.speed.status === 'ok', evidenceUrl: m.homepage, measured: `PageSpeed Insights, phone, two runs: scores ${m.speed.runs.map((r) => r.performance).join(' and ')}, main content (LCP) ${m.speed.runs.map((r) => (r.lcpMs === null ? 'n/a' : `${(r.lcpMs / 1000).toFixed(1)} s`)).join(' and ')}${m.speed.reason ? `; ${m.speed.reason}` : ''}` });
    }
  }

  // The first phone screen
  if (m.phone) {
    const where = '390 by 844 phone screen';
    if (m.phone.sideways) push({ type: 'phone_sideways', key: 'phone:sideways', facts: {}, evidenceUrl: m.phone.url, measured: `At ${where} the page is ${m.phone.scrollWidth} px wide and moves sideways by ${m.phone.scrollX} px when scrolled` });
    else if (m.phone.wider) push({ type: 'phone_wider', key: 'phone:wider', facts: {}, evidenceUrl: m.phone.url, measured: `At ${where} the page is laid out ${m.phone.scrollWidth} px wide` });
    if (!m.phone.actionVisible) push({ type: 'phone_no_action', key: 'phone:action', facts: {}, evidenceUrl: m.phone.url, measured: `At ${where} no book, call or email action is visible without scrolling` });
  }

  // How a visitor books
  const b = m.booking;
  if (b) {
    for (const l of b.landings) {
      const key = `cta:${l.text}|${norm(l.href)}`;
      const base = { facts: { label: l.text, page: 'homepage' }, evidenceUrl: l.finalUrl ?? l.href, measured: `"${l.text}" on the homepage goes to ${l.finalUrl ?? l.href}, which lands on ${l.landsOn}${l.status === null ? '' : ` (status ${l.status})`}` };
      if (l.problem === 'not_found') push({ type: 'book_button_missing', key: `missing:${norm(l.finalUrl ?? l.href)}`, ...base });
      else if (l.problem === 'missing_anchor') push({ type: 'book_button_section_missing', key, ...base });
      else if (l.problem === 'contact_page') push({ type: 'book_button_contact', key, ...base });
    }
    for (const f of b.forms.filter((x) => x.broken)) {
      push({ type: 'form_not_loading', key: `form:${norm(f.url)}`, facts: { what: /book/i.test(f.pageUrl) ? 'booking form' : 'enquiry form', page: pageName(f.pageUrl) }, evidenceUrl: f.pageUrl, measured: `The form on this page loads from ${f.url}, which ${f.status === null ? `did not answer (${f.error ?? 'no answer'})` : `answered ${f.status}`}` });
    }
    for (const u of b.unlinked) push({ type: 'booking_page_unlinked', key: `unlinked:${norm(u.url)}`, facts: { page: u.url }, evidenceUrl: u.url, measured: `${u.url} answers ${u.status} with the title "${u.title}". None of the ${u.pagesRead} pages we read links to it` });
    if (b.noWay) push({ type: 'no_way_to_book', key: 'noway', facts: { noun: NOUN[m.category] ?? 'tours' }, evidenceUrl: m.homepage, measured: 'Prices are shown. No Book or Enquire link, booking system, form, phone link or email link was found on the homepage' });
  }

  // Checks
  for (const c of m.checks) {
    const url = c.evidenceUrl ?? c.pageUrl ?? m.homepage;
    const page = pageName(c.pageUrl ?? m.homepage);
    const d = c.detail;
    switch (c.checkId) {
      case 'C01_placeholder_text': {
        const match = String(d.match ?? '');
        if (/hello world/i.test(match)) push({ type: 'hello_world', key: `leftover:hello-world`, facts: {}, evidenceUrl: url, measured: c.excerpt || c.title, checkId: c.checkId });
        else push({ type: 'placeholder_text', key: `placeholder:${match.toLowerCase().slice(0, 40)}`, facts: { text: match.slice(0, 60), page }, evidenceUrl: url, measured: c.excerpt || c.title, checkId: c.checkId });
        break;
      }
      case 'C02_stale_copyright':
        push({ type: 'stale_copyright', key: 'copyright', facts: { year: String(d.year ?? ''), page }, evidenceUrl: url, measured: `The footer says ${String(d.year ?? '')} and the year is now ${String(d.currentYear ?? '')}`, checkId: c.checkId });
        break;
      case 'C03_stale_dated_notice': {
        // The excerpt can begin in the middle of a word.
        const text = String(d.text ?? c.excerpt).replace(/^[a-z]\S*\s+/, '').slice(0, 200);
        if (d.kind === 'covid') push({ type: 'covid_wording', key: `covid:${page}`, facts: { page }, evidenceUrl: url, measured: `${c.title}: ${text}`, checkId: c.checkId });
        else push({ type: 'passed_notice', key: `notice:${String(d.date ?? c.title)}:${page}`, facts: { page }, evidenceUrl: url, measured: `${c.title}: ${text}`, checkId: c.checkId });
        break;
      }
      case 'C06_broken_images': {
        const count = Array.isArray(d.images) ? d.images.length : 1;
        push({ type: 'broken_images', key: 'images', facts: { count, page: 'homepage' }, evidenceUrl: url, measured: c.title, checkId: c.checkId });
        break;
      }
      case 'C10_broken_contact_links': {
        const href = String(d.href ?? '');
        // A WhatsApp or similar link that carries a text to share and no number is a share button.
        if (/[?&]text=/i.test(href) && !/[?&]phone=|wa\.me\/\d/i.test(href)) break;
        const social = /(?:facebook|instagram|twitter|x|tiktok|youtube|linkedin)\.com/i.exec(href)?.[0]?.split('.')[0];
        if (social) {
          push({ type: 'social_link_broken', key: `contact:${href}`, facts: { kind: social[0]!.toUpperCase() + social.slice(1), page }, evidenceUrl: url, measured: `${c.title}: ${href} (${String(d.problem ?? '')})`, checkId: c.checkId });
          break;
        }
        const kind = ({ mailto: 'email', tel: 'phone', whatsapp: 'WhatsApp', messenger: 'Messenger' } as Record<string, string>)[String(d.kind)] ?? 'contact';
        push({ type: 'contact_link_broken', key: `contact:${href}`, facts: { kind, page }, evidenceUrl: url, measured: `${c.title}: ${href} (${String(d.problem ?? '')})`, checkId: c.checkId });
        break;
      }
      case 'C11_dead_navigation': {
        const items = (Array.isArray(d.items) ? d.items : []) as { text?: string }[];
        for (const it of items.slice(0, 3)) {
          const label = String(it.text ?? '').trim();
          if (label && !/\b(?:menu|navigation|toggle|open|close|search|skip)\b/i.test(label)) push({ type: bookingish(label) ? 'dead_menu_booking' : 'dead_menu_item', key: `menu:${label.toLowerCase()}`, facts: { label, page: 'homepage' }, evidenceUrl: url, measured: `${c.title}`, checkId: c.checkId });
        }
        break;
      }
      case 'C12_broken_internal_links': {
        const links = (Array.isArray(d.links) ? d.links : []) as { url: string; status: number | null; text: string; foundOn: string }[];
        for (const l of links.filter((x) => x.status === 404 || x.status === 410).slice(0, 4)) {
          const booking = bookingish(`${l.text} ${l.url}`);
          push({ type: booking ? 'book_link_broken' : 'broken_link', key: `missing:${norm(l.url)}`, facts: { label: l.text, page: pageName(l.foundOn) }, linkedFrom: l.foundOn, evidenceUrl: l.url, measured: `${l.text ? `"${l.text}"` : 'A link with no words on it'} on ${l.foundOn} goes to ${l.url}, which answers ${l.status}`, checkId: c.checkId });
        }
        break;
      }
      case 'T02_booking_system_not_linked':
        push({ type: 'booking_system_not_linked', key: `unlinked-system:${String(d.platform ?? '')}`, facts: { system: String(d.platform ?? '') }, evidenceUrl: String(d.storefront ?? url), measured: c.excerpt || c.title, checkId: c.checkId });
        break;
      default:
        break;
    }
  }

  for (const e of m.eol.slice(0, 2)) push({ type: 'outdated_software', key: `eol:${e.product}`, facts: { product: e.product, version: e.version, since: monthYear(e.eolDate) }, evidenceUrl: e.sourceUrl, measured: `${e.product} ${e.version}; support ended ${e.eolDate}`, checkId: 'C41_outdated_platform' });

  // Crawlmouse sentences, kept only as far as opening their pages today bore them out.
  for (const s of m.crawlmouse) {
    const claims = new Set(s.claims);
    const cm = (f: Omit<RawFinding, 'measuredAt' | 'source' | 'reproduced'>) => out.push({ ...f, measured: s.caution ? `${f.measured} Caution from Crawlmouse: ${s.caution}` : f.measured, source: 'crawlmouse', measuredAt: at, reproduced: s.confirmed });
    if (!s.confirmed) continue;
    if (claims.has('missing_page')) {
      for (const e of s.examples) {
        const link = e.linkedFrom[0];
        const booking = bookingish(`${link?.text ?? ''} ${e.url}`);
        cm({ type: booking ? 'book_link_broken' : 'broken_link', key: `missing:${norm(e.url)}`, facts: { label: link?.text ?? '', page: pageName(link?.pageUrl) }, linkedFrom: link?.pageUrl, unlinked: !link, evidenceUrl: e.url, measured: s.measured ?? '' });
      }
    }
    if (claims.has('orphan_page')) {
      for (const e of s.examples.filter((x) => bookingish(x.url))) cm({ type: 'booking_page_unlinked', key: `unlinked:${norm(e.url)}`, facts: { page: e.url }, evidenceUrl: e.url, measured: s.measured ?? '' });
    }
    if (claims.has('leftover_page')) {
      const typed = s.examples.map((e) => ({ e, t: leftoverType(e) })).filter((x): x is { e: ExampleOut; t: NonNullable<ReturnType<typeof leftoverType>> } => !!x.t);
      const blanks = typed.filter((x) => x.t.type === 'blank_page');
      for (const { e, t } of typed.filter((x) => x.t.type !== 'blank_page')) cm({ type: t.type, key: `leftover:${t.type}:${norm(e.url)}`, facts: { title: t.title }, evidenceUrl: e.url, measured: s.measured ?? '' });
      if (blanks.length) cm({ type: 'blank_page', key: 'leftover:blank', facts: { count: blanks.length, title: blanks[0]!.t.title }, evidenceUrl: blanks[0]!.e.url, measured: s.measured ?? '' });
    }
    // Pages whose address begins with copy-of, found among the examples of any sentence.
    const copies = s.examples.filter((e) => /\/copy-of-/i.test(e.url) && e.status !== null && e.status >= 200 && e.status < 300 && !e.missing);
    if (copies.length) cm({ type: 'copy_of_address', key: 'copy-of', facts: { count: copies.length }, evidenceUrl: copies[0]!.url, measured: `${copies.length} example pages load at addresses that start with copy-of, such as ${copies[0]!.url}, titled "${copies[0]!.title}"` });
  }

  // Minor search items, counted over the pages we read
  const read = m.pages.length;
  const lacking = (pick: (p: PageSummary) => boolean) => m.pages.filter(pick).length;
  const minor: [FindingType, number, string][] = [
    ['no_description', lacking((p) => !p.hasDescription), 'description for search results'],
    ['no_heading', lacking((p) => !p.hasHeading), 'main heading'],
    ['no_structured_data', lacking((p) => !p.hasStructuredData), 'structured data'],
  ];
  const homeSummary = m.pages[0];
  for (const [type, count, what] of minor) {
    const homeLacks = type === 'no_description' ? !homeSummary?.hasDescription : type === 'no_heading' ? !homeSummary?.hasHeading : !homeSummary?.hasStructuredData;
    if (count > 0 && homeLacks) push({ type, key: `minor:${type}`, facts: { count, of: read }, evidenceUrl: m.homepage, measured: `${count} of the ${read} pages we read have no ${what}, the homepage among them` });
  }

  // Physio
  if (m.category === 'physio' && m.physio?.length) {
    const widget = m.physio.find((s) => s.kind === 'widget');
    const quote = m.physio.find((s) => s.kind !== 'widget');
    push({
      type: 'physio_testimonials',
      key: 'physio:testimonials',
      facts: { what: quote ? 'testimonials from clients' : `client reviews in a ${widget!.text}` },
      evidenceUrl: m.homepage,
      measured: m.physio.map((s) => (s.kind === 'widget' ? `${s.text} (${s.source ?? 'on the page'})` : `${s.kind}: "${s.text.slice(0, 160)}"`)).join('; '),
    });
  }
  return out;
}
