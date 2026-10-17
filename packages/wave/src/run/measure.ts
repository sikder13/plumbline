import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as cheerio from 'cheerio';
import { VIEWPORTS, domainOf, utcIso, type Business } from '@plumbline/core';
import { captureBrand, type BrandCapture } from '@plumbline/brand';
import { evaluateSite, foldActions } from '@plumbline/checks';
import { allPages, collectSite, emailsIn, phonesIn, prices } from '@plumbline/collect';
import { refusalStatement } from '@plumbline/contacts';
import { Polite } from '@plumbline/fetch';
import { Renderer, type PageCapture } from '@plumbline/render';
import { agencySigns, tradingFlags } from '../extract.ts';
import { pageState, verifyCrawlmouse, type CrawlmouseSummary } from '../crawlmouse.ts';
import { readPage, sameAddress, savedHtml, savedPage } from '../pages.ts';
import { bookingPath, bookingSystemsIn, ctaLinks, followCta, type Cta, type Landing } from './booking.ts';
import { type BookingScan, type CheckOut, type CrawlmouseOut, type RunMeasured, type PageSummary, type PelorusHeaders, type PhoneScreen } from './findings.ts';
import { harvestAssets } from './harvest.ts';
import type { WaveRow } from './list.ts';
import { checkForms, formRefs, unlinkedBookingPages } from './probe.ts';
import { creditsIn, faithFlags, menuTargets, testimonialsOn, type MenuPage } from './screens.ts';
import { asLighthouse, measureSpeed, type PsiRunner, type SpeedResult } from './speed.ts';
import { textOf, verifyFacts, type PageRead, type Reader } from './verify.ts';

export const PELORUS = { slug: 'pelorus-eco-adventures', urls: ['https://www.kayak-newzealand.com', 'https://www.kayak-newzealand.com/'] };

export interface MeasureOptions {
  /** Where this wave keeps what it measures: data/wave-4. */
  dataRoot: string;
  crawlmouse: CrawlmouseSummary | null;
  psi: PsiRunner | null;
  log?: (line: string) => void;
}

const businessFor = (row: WaveRow, at: string): Business => ({
  id: 0,
  slug: row.slug,
  name: row.name,
  website: row.website,
  domain: domainOf(row.website),
  country: 'NZ',
  region: row.region || null,
  town: row.town || null,
  lat: null,
  lng: null,
  pack: 'tourism',
  activity: row.activity || null,
  source: 'discovered',
  google_place_id: null,
  google_rating: null,
  google_review_count: null,
  google_business_status: null,
  phone: row.phone || null,
  listing_urls: '[]',
  seed: null,
  status: 'qualified',
  exclude_reason: null,
  notes: null,
  created_at: at,
});

const unavailable = (reason: string): SpeedResult => ({ source: 'PageSpeed Insights API', status: 'unavailable', runs: [], spread: null, performance: null, lcpMs: null, reason, measuredAt: utcIso() });

/**
 * The first phone screen, read from the capture the run already made of the homepage. The screen is
 * 390 by 844. A page that really moves sideways when scrolled is told apart from one that is only
 * laid out wider than the screen, which a phone shrinks to fit.
 */
export function phoneScreen(page: PageCapture, scrollX: number | null): PhoneScreen {
  const actions = foldActions(page);
  const sideways = (scrollX ?? 0) > 0;
  return { url: page.finalUrl, width: VIEWPORTS.mobile.width, height: VIEWPORTS.mobile.height, actions: actions.slice(0, 8), actionVisible: actions.length > 0, sideways, wider: page.layout.horizontalScroll && !sideways, scrollWidth: page.layout.scrollWidth, scrollX };
}

const unique = (xs: string[]) => [...new Set(xs)];

/** Everything one business needs, measured in one go and written to data/wave-4/<slug>/. No AI, nothing sent to the business. */
export async function measureBusiness(row: WaveRow, opts: MeasureOptions): Promise<RunMeasured> {
  const log = opts.log ?? (() => undefined);
  const started = Date.now();
  const measuredAt = utcIso();
  const dir = join(opts.dataRoot, row.slug);
  mkdirSync(dir, { recursive: true });
  const polite = new Polite();
  const renderer = new Renderer(polite);
  await renderer.start();
  try {
    // Speed runs on Google's side, so it goes alongside everything else.
    const speedPromise: Promise<SpeedResult> = opts.psi ? measureSpeed(row.website, opts.psi) : Promise.resolve(unavailable('no PAGESPEED_API_KEY and the keyless PageSpeed quota is used up'));

    // 1. The list's facts
    const read: Reader = async (url, via) => {
      if (via === 'http') {
        const r = await polite.get(url, { maxRedirects: 5, timeoutMs: 20_000, maxBytes: 2_000_000 });
        const ok = r.status !== null && r.status >= 200 && r.status < 300;
        return { ok, status: r.status, finalUrl: r.finalUrl, html: ok ? r.body : '', text: ok ? textOf(r.body) : '', via: 'http', error: r.error } satisfies PageRead;
      }
      const cap = await readPage(renderer, row.slug, url);
      const html = cap.ok ? savedHtml(cap) : '';
      return { ok: cap.ok, status: cap.status, finalUrl: cap.finalUrl, html, text: cap.ok ? cap.text : '', via: 'browser', error: cap.error ?? cap.blocked ?? undefined } satisfies PageRead;
    };
    const facts = await verifyFacts(row, read);
    log(`facts ${facts.changed.length ? `changed (${facts.changed.length})` : 'hold'}`);

    // 2. The site and every existing check
    const business = businessFor(row, measuredAt);
    const brand: Partial<Record<'mobile' | 'desktop', BrandCapture>> = {};
    const site = await collectSite(polite, renderer, business, {
      runId: 0,
      kind: 'A',
      dir: join(dir, 'capture'),
      onHomepage: async (page, _cap, viewport) => void (brand[viewport] = await captureBrand(page, viewport, join(dir, 'brand'))),
    });
    log(`collected ${allPages(site).length} pages${site.blocked ? ` (${site.blocked})` : ''}`);

    const speed = await speedPromise;
    site.lighthouse.mobile = asLighthouse(site.homepageUrl, speed);
    log(`speed ${speed.status}${speed.performance !== null ? ` ${speed.performance}` : ''}`);

    const { findings, errors: checkErrors } = evaluateSite(site, business.pack, new Date(), null);
    const checks: CheckOut[] = findings
      .filter((f) => !f.checkId.startsWith('C37'))
      .map((f) => ({ checkId: f.checkId, title: f.title, pageUrl: f.pageUrl, detail: f.detail, excerpt: f.evidence[0]?.excerpt ?? '', evidenceUrl: f.evidence[0]?.url ?? f.pageUrl }));

    const pages = allPages(site);
    const homeDesktop = site.homepage.desktop?.ok ? site.homepage.desktop : null;
    const homeMobile = site.homepage.mobile?.ok ? site.homepage.mobile : null;
    const home = homeDesktop ?? homeMobile;
    const homepage = home?.finalUrl ?? site.homepageUrl;
    const htmlOf = (p: PageCapture) => savedHtml(p);

    // 3. The first phone screen
    let scrollX: number | null = null;
    if (homeMobile && !site.blocked) {
      // Scroll the live page sideways, as a thumb would, and see whether it moves.
      await renderer
        .render({
          url: homepage,
          viewport: 'mobile',
          onPage: async (page) => {
            scrollX = await page.evaluate(() => {
              window.scrollTo(300, 0);
              return window.scrollX;
            });
          },
        })
        .catch(() => undefined);
    }
    const phone = homeMobile ? phoneScreen(homeMobile, scrollX) : null;

    // 4. How a visitor books
    let booking: BookingScan | null = null;
    if (home && !site.blocked) {
      const sources = pages.map((p) => ({ url: p.finalUrl, html: htmlOf(p) })).filter((s) => s.html);
      const systems = bookingSystemsIn(sources);
      const ctas: Cta[] = [];
      for (const p of [homeDesktop, homeMobile].filter((x): x is PageCapture => !!x)) for (const c of ctaLinks(p)) if (!ctas.some((o) => o.text.toLowerCase() === c.text.toLowerCase() && o.href === c.href)) ctas.push(c);
      const homeHtml = htmlOf(home);
      const landings: Landing[] = [];
      for (const c of ctas.slice(0, 8)) landings.push(await followCta(polite, homepage, homeHtml, c));
      const unlinked = await unlinkedBookingPages(polite, homepage, pages);
      const forms = await checkForms(polite, formRefs(sources.filter((s) => s.url === homepage || /contact|book|enquir/i.test(s.url)).slice(0, 8)));
      const homeLinks = home.links;
      const showsPrices = pages.some((p) => prices(p).length > 0);
      // A phone number or an email address written out in the words of the page lets a visitor reach them too.
      const anyWay = ctas.length > 0 || systems.length > 0 || homeLinks.some((l) => /^(?:mailto|tel):/i.test(l.raw)) || phonesIn(home.text).length > 0 || emailsIn(home.text).length > 0 || pages.some((p) => p.controls.some((c) => c.tag === 'form' && c.fields >= 2));
      booking = { systems, path: bookingPath(systems, landings, homeLinks), landings, unlinked, forms, noWay: showsPrices && !anyWay };
      log(`booking ${booking.path}; ${landings.length} Book/Enquire links followed`);
    }

    // 5. Crawlmouse, opened again
    const crawlmouse: CrawlmouseOut[] = [];
    if (opts.crawlmouse && home) {
      const summary: CrawlmouseSummary = {
        ...opts.crawlmouse,
        findings_plain: opts.crawlmouse.findings_plain
          .map((f) => ({ ...f, examples: f.examples.filter((u) => !/cdn-cgi\/l\/email-protection/i.test(u)) }))
          .filter((f) => f.examples.length > 0),
      };
      const known = [...pages];
      // A caution that says which page links to the missing one is a lead worth reading first.
      for (const f of summary.findings_plain) {
        const m = /linked from (https?:\/\/[^\s]+?)(?:[.,;]?(?:\s|$))/i.exec(f.caution ?? '');
        if (m && !known.some((p) => sameAddress(p.finalUrl, m[1]!))) {
          const p = await readPage(renderer, row.slug, m[1]!);
          if (p.ok) known.push(p);
        }
      }
      let results = await verifyCrawlmouse(renderer, row.slug, summary, known);
      // A page that could not be read once is tried again before the sentence is left undecided.
      const unread = results.filter((r) => r.undecided);
      if (unread.length) {
        const again = await verifyCrawlmouse(renderer, row.slug, { ...summary, findings_plain: summary.findings_plain.filter((f) => unread.some((r) => r.text === f.text)) }, known);
        results = results.map((r) => again.find((a) => a.text === r.text && !a.undecided) ?? r);
      }
      for (const r of results) {
        crawlmouse.push({
          text: r.text,
          claims: r.claims,
          caution: r.caution,
          confirmed: r.confirmed,
          undecided: r.undecided,
          measured: r.measured,
          reason: r.reason,
          examples: r.examples.map((e) => ({ url: e.url, status: e.status, missing: e.missing, title: e.title, words: e.words, snippet: (savedPage(row.slug, e.url)?.text ?? '').replace(/\s+/g, ' ').slice(0, 300), linkedFrom: e.linkedFrom.map((l) => ({ pageUrl: l.pageUrl, text: l.text, where: l.where })) })),
        });
      }
      log(`crawlmouse ${crawlmouse.filter((c) => c.confirmed).length} of ${crawlmouse.length} sentences hold`);
    }

    // 6. Pelorus: two header-only requests
    let pelorus: PelorusHeaders | null = null;
    if (row.slug === PELORUS.slug) {
      const requests: PelorusHeaders['requests'] = [];
      for (const url of PELORUS.urls) {
        const r = await polite.get(url, { method: 'HEAD', maxRedirects: 0, timeoutMs: 20_000 });
        requests.push({ url, method: 'HEAD', status: r.status, location: r.headers.location ?? null, error: r.error ?? null });
      }
      pelorus = { checkedAt: utcIso(), requests };
    }

    // 7. Physio: testimonials and review widgets
    let physio: RunMeasured['physio'] = null;
    if (row.category === 'physio' && home) {
      physio = [];
      for (const p of [homeDesktop, homeMobile].filter((x): x is PageCapture => !!x)) for (const s of testimonialsOn(p, htmlOf(p))) if (!physio.some((x) => x.kind === s.kind && x.text === s.text)) physio.push(s);
    }

    // 8. Faith screen on the pages in the menu
    const faith: RunMeasured['faith'] = [];
    if (home) {
      const menu: MenuPage[] = [];
      for (const t of menuTargets(home)) {
        const held = pages.find((p) => sameAddress(p.finalUrl, t.url));
        if (held) menu.push({ label: t.label, url: t.url, title: held.meta.title, h1: held.meta.h1[0] ?? '', text: held.text });
        else {
          const r = await polite.get(t.url, { maxRedirects: 4, timeoutMs: 20_000, maxBytes: 600_000 });
          if (r.status !== null && r.status >= 200 && r.status < 300) {
            const $ = cheerio.load(r.body);
            menu.push({ label: t.label, url: t.url, title: $('title').first().text().trim(), h1: $('h1').first().text().trim(), text: textOf(r.body) });
          }
        }
      }
      faith.push(...faithFlags(menu));
    }

    // 9. Who built it, whether the site refuses unsolicited messages, signs of a sale
    const footerCredits = [homeDesktop, homeMobile]
      .filter((x): x is PageCapture => !!x)
      .flatMap((p) => {
        const footer = p.blocks.filter((b) => b.inFooter).map((b) => b.text).join(' ');
        if (!/\b(?:design(?:ed)?|develop(?:ed|ment)|built|created|web ?site|site|by)\b/i.test(footer)) return [];
        return p.links.filter((l) => l.inFooter && l.text.trim().split(/\s+/).length <= 3 && (domainOf(l.href) !== domainOf(p.finalUrl) || /\/(?:www\.)?[a-z0-9-]+\.(?:com|co\.nz|nz|net|co)\b/i.test(new URL(l.href, p.finalUrl).pathname))).map((l) => l.text.trim());
      })
      .filter((t) => t.length >= 3 && !/^(?:facebook|instagram|twitter|youtube|tiktok|linkedin|tripadvisor|email|privacy|terms|home)\b/i.test(t));
    const agencies = unique([
      ...[homeDesktop, homeMobile]
        .filter((x): x is PageCapture => !!x)
        .flatMap((p) => agencySigns(p, htmlOf(p)))
        .filter((s) => s.kind !== 'platform')
        .map((s) => s.agency),
      ...[homeDesktop, homeMobile].filter((x): x is PageCapture => !!x).flatMap((p) => creditsIn(p.text)),
      ...footerCredits,
    ]);
    const refusal = pages.map((p) => refusalStatement(p.text)).find((x) => !!x) ?? null;
    const trading = unique([homeDesktop, homeMobile].filter((x): x is PageCapture => !!x).flatMap((p) => tradingFlags(p)).map((t) => `${t.kind}: "${t.quote}" (${t.url})`));

    // 10. Pages read, for the minor search items
    const summaries: PageSummary[] = [];
    for (const p of [...(homeDesktop ? [homeDesktop] : []), ...pages.filter((x) => x.viewport === 'desktop' && x !== homeDesktop), ...pages.filter((x) => x.viewport === 'mobile' && !pages.some((y) => y.viewport === 'desktop' && sameAddress(y.finalUrl, x.finalUrl)))]) {
      if (summaries.some((s) => sameAddress(s.url, p.finalUrl))) continue;
      const st = pageState(p, htmlOf(p));
      summaries.push({ url: p.finalUrl, hasDescription: st.metaDescription, hasHeading: st.mainHeading, hasStructuredData: st.structuredData });
    }

    // 11. Assets for the design phase
    if (home && !site.blocked) {
      const logoBrand = brand.desktop ?? brand.mobile;
      await harvestAssets({ polite, slug: row.slug, dir: join(opts.dataRoot, 'assets', row.slug), homeUrl: homepage, pages, htmlOf, logo: { path: logoBrand?.logoPath ?? null, sourceUrl: logoBrand?.logoSourceUrl ?? null }, at: utcIso() });
    }

    const blockedBotNames = site.robots.botBlocks.filter((b) => b.blocked.length).map((b) => b.bot);
    const measured: RunMeasured = {
      slug: row.slug,
      measuredAt,
      category: row.category,
      homepage,
      collection: { blocked: site.blocked, errors: site.errors.slice(0, 8), pagesRead: pages.length, checkErrors },
      facts,
      checks,
      eol: site.eol.map((e) => ({ product: e.product, version: e.version, eolDate: e.eolDate, sourceUrl: e.sourceUrl })),
      speed,
      phone,
      booking,
      crawlmouse,
      pages: summaries,
      physio,
      faith,
      agencies,
      refusal,
      pelorus,
      trading,
      aiCrawlers: { allowed: blockedBotNames.length === 0, blocked: blockedBotNames },
    };
    writeFileSync(join(dir, 'result.json'), JSON.stringify({ ...measured, seconds: Math.round((Date.now() - started) / 1000) }, null, 1));
    return measured;
  } finally {
    await renderer.stop();
  }
}

/** Replaces only the speed in a stored result: the second chance for a business whose speed could not be measured. */
export async function remeasureSpeed(row: WaveRow, dataRoot: string, psi: PsiRunner | null): Promise<SpeedResult | null> {
  const file = join(dataRoot, row.slug, 'result.json');
  if (!existsSync(file)) return null;
  const stored = JSON.parse(readFileSync(file, 'utf8')) as RunMeasured;
  const speed = psi ? await measureSpeed(row.website, psi) : unavailable('no PAGESPEED_API_KEY and the keyless PageSpeed quota is used up');
  writeFileSync(file, JSON.stringify({ ...stored, speed }, null, 1));
  return speed;
}
