import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as cheerio from 'cheerio';
import { engineOf } from '../engines.ts';
import { bookingFacts, emailsOnPage, greetingNamesOn, visibleText, type SitePage } from '../site.ts';
import { mxCheck } from '../verify.ts';
import { OUR_NETWORK, type Shooter, type Visit } from './browser.ts';
import { bookingLinks, isEmailProtection, isKeyMenu, linkedinLinks, nzDigits, otaLinks, phonesOnSite, samePhone } from './crawl.ts';
import { INACTIVE, MISSING, type Follow } from './follow.ts';
import { plausibleEmail, type Gathered } from './gather.ts';
import { googleWeek, googleWeekFromText, hoursConflicts, siteWeek } from './hours.ts';

export const CHECKS = ['booking_link_broken', 'site_down_or_broken', 'not_secure', 'main_nav_404', 'ota_only_booking', 'own_email_dead', 'phone_mismatch', 'hours_mismatch', 'no_online_booking_vs_competitors', 'not_mobile'] as const;
export type CheckId = (typeof CHECKS)[number];

export interface CheckResult {
  check: CheckId;
  /** unproven: the check found something, but no picture could be taken, so it is not a flag. */
  result: 'pass' | 'flag' | 'not_applicable' | 'unknown' | 'unproven';
  evidenceUrl: string;
  http: string;
  detail: string;
  shot: string | null;
  more: string[];
  /** For ranking: a booking page, or a Book or Rates menu item, ranks a flag higher. */
  onBookingPath?: boolean;
}

export interface SiteChecks {
  domain: string;
  checkedAt: string;
  home: Pick<Visit, 'url' | 'finalUrl' | 'status' | 'error' | 'certError' | 'blocked' | 'security' | 'securityIssues' | 'loadMs' | 'slowRender' | 'title' | 'measure'> | null;
  homeShot: string | null;
  hasOnlineBooking: boolean;
  onlineBookingHow: string;
  engine: string;
  results: CheckResult[];
}

/** A host's registrable part: "www.motel.co.nz" and "book.motel.co.nz" are both "motel.co.nz". */
export function siteKey(url: string): string {
  const h = (() => {
    try {
      return new URL(/^[a-z]+:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase();
    } catch {
      return url;
    }
  })();
  const parts = h.split('.');
  return parts.slice(/\.(?:co|org|net|govt|ac|school|gen|maori|iwi|com)\.[a-z]{2}$/.test(h) ? -3 : -2).join('.');
}

const result = (check: CheckId, r: Partial<CheckResult> & Pick<CheckResult, 'result'>): CheckResult => ({ check, evidenceUrl: '', http: '', detail: '', shot: null, more: [], ...r });

const httpOf = (f: { status: number | null; error?: string | null; finalUrl?: string; redirects?: string[] }) => `${f.status ?? 'no answer'}${f.error ? ` (${f.error})` : ''}${f.redirects?.length ? ` after ${f.redirects.length} redirect(s) to ${f.finalUrl}` : ''}`;

const PARKED_TITLE = /\b(?:domain (?:is )?for sale|buy this domain|parked (?:domain|free)|this domain (?:is|has been) (?:parked|registered)|account suspended|website (?:is )?(?:coming soon|under construction)|under construction|default web ?site page|apache2? .*default page|welcome to nginx|index of \/|future home of|website expired|domain (?:has )?expired|site not (?:found|published)|404 not found|page not found)\b/i;
const PARKED_TEXT = /\b(?:(?:this )?domain (?:name )?(?:is |may be )?for sale|buy this domain|this domain (?:is|has been) (?:parked|registered)|parked (?:free|domain)|domain parking|hugedomains|sedo|afternic|dan\.com|account (?:has been )?suspended|(?:website|site) (?:is )?(?:coming soon|under construction|launching soon)|under construction|default web ?site page|apache2? .*default page|welcome to nginx|it works!|index of \/|future home of|(?:this )?(?:web)?site is (?:currently )?(?:unavailable|offline|not available)|website (?:has )?expired|domain (?:has )?expired|renew (?:your|this) (?:domain|hosting)|this site can['’]?t be reached|error establishing a database connection|there has been a critical error)\b/i;
const BOT_WALL = /cloudflare|just a moment|checking your browser|verify you are (?:a )?human|captcha|attention required|access denied by|ddos protection|security check/i;

/** What the homepage shows a visitor once it has loaded: an error, a parked domain, a host's placeholder, an empty page, or none of these. */
export function brokenHome(v: Pick<Visit, 'status' | 'error' | 'blocked' | 'title' | 'text' | 'measure' | 'certError'> & { frames?: { text: string }[] }): string | null {
  if (v.blocked || (v.error && OUR_NETWORK.test(v.error))) return null;
  // A parked domain often shows its ad links inside a frame, with nothing on the page itself.
  const framed = (v.frames ?? []).map((f) => f.text).join(' ');
  if (v.text.replace(/\s+/g, '').length < 50 && /\b(?:related searches|related search topics|sponsored (?:listings|links)|this domain (?:may be|is) for sale)\b/i.test(framed)) return 'the homepage is a parked domain: a page of advertising links';
  if (v.error && !v.certError) return `the browser could not open it (${v.error})`;
  const text = v.text.replace(/\s+/g, ' ').trim();
  if (v.status !== null && v.status >= 400) {
    if ([401, 403, 429].includes(v.status) && (BOT_WALL.test(`${v.title} ${text}`) || text.length > 400)) return null;
    return `the homepage answers ${v.status}${v.title ? ` ("${v.title.slice(0, 60)}")` : ''}`;
  }
  if (PARKED_TITLE.test(v.title)) return `the homepage is a placeholder: "${v.title.slice(0, 80)}"`;
  const m = PARKED_TEXT.exec(text);
  if (m && text.length < 700) return `the homepage is a placeholder: "${m[0]}"`;
  if (v.measure && v.measure.textChars < 20 && v.measure.images === 0 && v.measure.media === 0) return 'the homepage is blank after it loads';
  return null;
}

/** The layout reading: a page that moves sideways, renders at desktop width, or sets its body text under 11 px. */
export function notMobile(m: NonNullable<Visit['measure']>): string | null {
  if (m.textChars < 200) return null;
  const out: string[] = [];
  const desktop = !m.viewport && m.innerWidth > 400;
  if (m.scrollX > 20) out.push(`the page scrolls ${m.scrollX} px sideways on a 390 px screen`);
  if (desktop) out.push(`no viewport tag: it lays out ${m.innerWidth} px wide, desktop width, and is shrunk to fit the phone`);
  // Text size as the phone shows it: a desktop-width page is shrunk, so its text is too. A page with a viewport tag is read as set.
  const effective = m.medianFontPx !== null && (m.bodyChars ?? m.textChars) >= 200 ? Math.round(m.medianFontPx * (desktop ? 390 / m.innerWidth : 1) * 10) / 10 : null;
  if (effective !== null && effective < 11) out.push(`most of the body text shows at ${effective} px`);
  return out.length ? out.join('; ') : null;
}

const CHECK_LABEL: Record<CheckId, string> = {
  booking_link_broken: 'Booking link broken',
  site_down_or_broken: 'Site down or broken',
  not_secure: 'Not secure',
  main_nav_404: 'Menu page missing',
  ota_only_booking: 'Books only through an OTA',
  own_email_dead: 'Published email cannot receive mail',
  phone_mismatch: 'Phone differs from Google',
  hours_mismatch: 'Hours differ from Google',
  no_online_booking_vs_competitors: 'No online booking; nearby rivals have it',
  not_mobile: 'Not built for a phone',
};
export const checkLabel = (c: CheckId) => CHECK_LABEL[c];

/** Strength order for picking a site's strongest flag (relay 02, Part 5 item 4). */
export function flagRank(r: CheckResult): number {
  switch (r.check) {
    case 'booking_link_broken':
      return 0;
    case 'site_down_or_broken':
      return 1;
    case 'not_secure':
      return r.onBookingPath ? 2 : 7.5;
    case 'main_nav_404':
      return r.onBookingPath ? 3 : 7.6;
    case 'ota_only_booking':
      return 4;
    case 'own_email_dead':
      return 5;
    case 'phone_mismatch':
      return 6;
    case 'hours_mismatch':
      return 7;
    case 'no_online_booking_vs_competitors':
      return 8;
    case 'not_mobile':
      return 9;
  }
}

/** The not_mobile proof: the homepage as it loaded, or pushed fully right when the page is wider than the phone. */
export async function notMobileProof(home: Pick<Visit, 'finalUrl' | 'measure' | 'shot'>, nm: string, shooter: Shooter, dir: string): Promise<CheckResult> {
  const m = home.measure!;
  let src = home.shot;
  if (m.scrollX > 20) {
    const v = await shooter.visit(home.finalUrl, { shot: join(dir, 'not_mobile-page.png'), scrollRight: true });
    src = v.shot ?? src;
  }
  const shot = src ? await shooter.write(readFileSync(src), join(dir, 'not_mobile.png'), ['Not built for a phone (390 x 844)', m.scrollX > 20 ? `${nm} (picture taken pushed fully right)` : nm]) : null;
  const r = result('not_mobile', { result: 'flag', evidenceUrl: home.finalUrl, http: `viewport tag: ${m.viewport ?? 'none'}; layout width ${m.innerWidth} px; sideways ${m.scrollX} px; median sentence text ${m.medianFontPx} px`, detail: nm, shot });
  if (!shot) {
    r.result = 'unproven';
    r.detail = `${r.detail} (no picture could be taken, so not a flag)`;
  }
  return r;
}

const ENGINE_WALL = /cloudflare|just a moment|verify you are human|captcha/i;

/** A picture with one item outlined: at phone width first, and at desktop width when the phone layout hides it (a closed menu, a desktop-only footer). */
async function proofVisit(shooter: Shooter, url: string, highlight: NonNullable<Parameters<Shooter['visit']>[1]>['highlight'], shot: string): Promise<Visit> {
  const v = await shooter.visit(url, { highlight, shot });
  if (v.highlighted || v.blocked || v.error) return v;
  const d = await shooter.visit(url, { highlight, shot: shot.replace(/\.png$/, '-desktop.png'), desktop: true });
  return d.highlighted ? d : v;
}

/**
 * The checks for one site that need nothing from other sites: everything but the competitor check,
 * which runs once every site has been read. Each flag is photographed; a flag whose picture cannot be
 * taken is recorded as unproven.
 */
export async function checkSite(g: Gathered, shooter: Shooter, shotsDir: string, crawlCacheDir: string): Promise<SiteChecks> {
  const dir = join(shotsDir, g.domain);
  mkdirSync(dir, { recursive: true });
  const shotPath = (c: string) => join(dir, `${c}.png`);
  const out: SiteChecks = { domain: g.domain, checkedAt: new Date().toISOString(), home: null, homeShot: null, hasOnlineBooking: false, onlineBookingHow: '', engine: '', results: [] };
  const push = (r: CheckResult) => {
    if (r.result === 'flag' && (!r.shot || !existsSync(r.shot))) {
      r.result = 'unproven';
      r.detail = `${r.detail} (no picture could be taken, so not a flag)`;
    }
    out.results.push(r);
  };

  // The homepage, as a phone shows it once loaded: the proof for site_down, not_secure and not_mobile.
  const homeUrl = g.homeUrl || g.candidate.website;
  const home = await shooter.visit(homeUrl, { shot: join(dir, 'home.png'), measure: true, html: true, frames: true });
  out.home = { url: home.url, finalUrl: home.finalUrl, status: home.status, error: home.error, certError: home.certError, blocked: home.blocked, security: home.security, securityIssues: home.securityIssues, loadMs: home.loadMs, slowRender: home.slowRender, title: home.title, measure: home.measure };
  out.homeShot = home.shot;
  if (home.html && !home.error && !home.blocked) await fillFromRender(g, home);
  const gatherHttp = g.homeTries.map((t) => `${t.url} -> ${httpOf(t)}`).join(' | ');

  // 3. site_down_or_broken
  // A homepage that sends the visitor on to Booking.com or another off-limits site is not the business's site any more; the browser is stopped at the door.
  const sentOn = home.blockedNav ? (() => {
    try {
      return new URL(home.blockedNav).hostname;
    } catch {
      return home.blockedNav;
    }
  })() : null;
  // A homepage that ends on another domain showing almost nothing (a parking or affiliate redirect) is not the business's site; a rebrand lands on a full page and is fine.
  const shown = home.text.replace(/\s+/g, ' ').trim();
  const elsewhere = !home.blocked && !home.error && home.finalUrl && siteKey(home.finalUrl) !== siteKey(g.candidate.website) && /^https?:/.test(home.finalUrl) && (shown.length < 120 || /verify(?:ing)? (?:that )?you are (?:not a robot|human)|bot verification/i.test(`${home.title} ${shown}`) || PARKED_TEXT.test(shown)) ? `the homepage sends visitors to ${new URL(home.finalUrl).hostname}, which shows almost nothing ("${home.text.replace(/\s+/g, ' ').trim().slice(0, 60)}")` : null;
  const broken = home.blocked ? null : sentOn ? `the homepage sends visitors on to ${sentOn} instead of the business's own site (not opened: that site is off limits)` : (elsewhere ?? brokenHome(home));
  // A plain request read the homepage but the browser was refused: a firewall's choice about us, not what a visitor sees.
  const refusedOnlyToUs = !!broken && !sentOn && !!g.homeUrl && home.status !== null && [401, 403, 429].includes(home.status);
  if (home.blocked) push(result('site_down_or_broken', { result: 'unknown', evidenceUrl: homeUrl, http: gatherHttp, detail: 'robots.txt does not allow the homepage to be opened' }));
  else if (!sentOn && home.error && OUR_NETWORK.test(home.error)) push(result('site_down_or_broken', { result: 'unknown', evidenceUrl: homeUrl, http: gatherHttp, detail: `our own connection failed (${home.error})` }));
  else if (refusedOnlyToUs) push(result('site_down_or_broken', { result: 'unknown', evidenceUrl: homeUrl, http: `${gatherHttp} | browser: ${home.status}`, detail: `the browser was refused (${home.status}) though a plain request read the page` }));
  else if (broken) push(result('site_down_or_broken', { result: 'flag', evidenceUrl: home.finalUrl || homeUrl, http: `${gatherHttp} | browser: ${sentOn ? `sent on to ${home.blockedNav}` : (home.status ?? home.error)}`, detail: broken, shot: home.shot ? await shooter.write(readFileSync(home.shot), shotPath('site_down_or_broken'), ['Site down or broken', broken, home.finalUrl || homeUrl]) : null }));
  else push(result('site_down_or_broken', { result: 'pass', evidenceUrl: home.finalUrl, http: `browser: ${home.status}` }));
  // A firewall's "checking your browser" page in front of the homepage: what a visitor sees there cannot be judged.
  const walled = !broken && home.status !== null && [401, 403, 429].includes(home.status);
  const homeOk = !broken && !home.blocked && !home.error && !walled;

  // 2. not_secure: the address bar on the homepage, then on the contact and booking pages.
  if (home.certError) {
    const warn = shotPath('not_secure').replace(/\.png$/, '-warning.png');
    const proof = existsSync(join(dir, 'home-warning.png')) ? join(dir, 'home-warning.png') : existsSync(warn) ? warn : home.shot;
    push(result('not_secure', { result: 'flag', evidenceUrl: homeUrl, http: gatherHttp, detail: `the certificate is not valid (${home.certError}): Chrome shows a full-page warning before the site`, shot: proof ? await shooter.write(readFileSync(proof), shotPath('not_secure'), proof === home.shot ? [`Chrome warns "Your connection is not private" (${home.certError})`, homeUrl] : []) : null, onBookingPath: true }));
  } else if (homeOk && (home.security === 'insecure' || home.security === 'insecure-broken')) {
    push(result('not_secure', { result: 'flag', evidenceUrl: home.finalUrl, http: gatherHttp, detail: `the site is served over plain http: Chrome shows "Not secure" in the address bar (${home.securityIssues.join(', ') || home.security})`, shot: home.shot ? await shooter.write(readFileSync(home.shot), shotPath('not_secure'), ['Chrome shows: ⚠ Not secure', home.finalUrl]) : null, onBookingPath: true }));
  } else if (homeOk) {
    const plain = [...g.pages.filter((p) => ['contact', 'book'].includes(p.role) && p.status === 200 && p.finalUrl.startsWith('http://')).map((p) => ({ url: p.finalUrl, role: p.role })), ...g.follows.filter((f) => f.status === 200 && f.finalUrl.startsWith('http://') && !engineOf(f.finalUrl)).map((f) => ({ url: f.finalUrl, role: 'book' }))];
    let done = false;
    for (const p of plain.slice(0, 2)) {
      const v = await shooter.visit(p.url, { shot: join(dir, 'not_secure-page.png') });
      if (v.security === 'insecure' || v.security === 'insecure-broken') {
        push(result('not_secure', { result: 'flag', evidenceUrl: v.finalUrl, http: `GET ${p.url} -> 200`, detail: `the ${p.role === 'book' ? 'booking' : 'contact'} page is served over plain http: Chrome shows "Not secure" there`, shot: v.shot ? await shooter.write(readFileSync(v.shot), shotPath('not_secure'), [`Chrome shows: ⚠ Not secure (${p.role === 'book' ? 'booking' : 'contact'} page)`, v.finalUrl]) : null, onBookingPath: p.role === 'book' }));
        done = true;
        break;
      }
    }
    if (!done) push(result('not_secure', { result: home.security ? 'pass' : 'unknown', evidenceUrl: home.finalUrl, http: `browser security state: ${home.security ?? 'not reported'}` }));
  } else push(result('not_secure', { result: walled ? 'unknown' : 'not_applicable', detail: walled ? `a firewall refused the browser (${home.status})` : 'the homepage did not open' }));

  // 10. not_mobile
  const nm = homeOk && home.measure ? notMobile(home.measure) : null;
  if (!homeOk || !home.measure) push(result('not_mobile', { result: walled ? 'unknown' : 'not_applicable', detail: walled ? `a firewall refused the browser (${home.status})` : 'the homepage did not open' }));
  else if (nm) push(await notMobileProof(home, nm, shooter, dir));
  else push(result('not_mobile', { result: 'pass', evidenceUrl: home.finalUrl, http: `viewport tag: ${home.measure.viewport ?? 'none'}; layout width ${home.measure.innerWidth} px; sideways ${home.measure.scrollX} px; median text ${home.measure.medianFontPx} px` }));

  // Engines: in the pages read, in the homepage as rendered, and wherever a booking link landed.
  const renderedEngines = home.html ? bookingFacts([{ url: home.finalUrl, finalUrl: home.finalUrl, status: home.status, html: home.html, role: 'home' }]).engines : [];
  const frameEngines = home.frames.map((f) => engineOf(f.url)).filter((e) => e && e.kind !== 'ota').map((e) => e!.name);
  const landed = g.follows.filter((f) => f.engine && engineOf(f.finalUrl)?.kind !== 'ota').map((f) => f.engine);
  const engines = [...new Set([...g.engines, ...renderedEngines, ...frameEngines, ...landed])];
  out.engine = engines.join(';');
  // Any booking address that is not the contact page counts, opened or not: the competitor check flags only a site with none at all.
  const bookingPages = g.booking.filter((b) => !/contact|enquir|get-in-touch/i.test(b.url));
  out.hasOnlineBooking = engines.length > 0 || bookingPages.length > 0 || !!g.availabilityForm;
  out.onlineBookingHow = engines.length ? engines.join(', ') : bookingPages.length ? `booking link ${bookingPages[0]!.url}` : g.availabilityForm ? `availability form on ${g.availabilityForm}` : '';

  // 1. booking_link_broken
  await checkBooking(g, shooter, dir, push);

  // 4. main_nav_404
  const bad = g.pages.filter((p) => p.inMenu && isKeyMenu(p.label) && !isEmailProtection(p.url) && p.status !== null && (p.status === 404 || p.status === 410 || p.status >= 500));
  if (!g.menu.length) push(result('main_nav_404', { result: 'not_applicable', detail: 'no main menu found in the homepage code' }));
  else if (!bad.length) push(result('main_nav_404', { result: 'pass', http: g.pages.filter((p) => p.inMenu && isKeyMenu(p.label)).map((p) => `${p.label}: ${p.status ?? p.error}`).join('; ') }));
  else {
    let flagged = false;
    for (const p of bad.slice(0, 2)) {
      const v = await shooter.visit(p.url, { shot: shotPath('main_nav_404') });
      const says = MISSING.test(`${v.title} ${v.text.slice(0, 2000)}`) || v.text.replace(/\s+/g, ' ').length < 200;
      if ((v.status !== null && v.status >= 400 && says) || v.error) {
        const menuShot = await shooter.visit(home.finalUrl || homeUrl, { desktop: true, highlight: { href: new URL(p.url).pathname.length > 1 ? new URL(p.url).pathname : p.url }, shot: join(dir, 'main_nav_404-menu.png') });
        const proof = v.shot ? await shooter.write(readFileSync(v.shot), shotPath('main_nav_404'), [`Menu item "${p.label}" opens a missing page (${v.status ?? v.error})`, p.url]) : null;
        push(result('main_nav_404', { result: 'flag', evidenceUrl: p.url, http: `GET ${p.url} -> ${httpOf(p)} | browser: ${v.status ?? v.error}`, detail: `the main-menu item "${p.label}" answers ${v.status ?? v.error}`, shot: proof, more: menuShot.shot ? [menuShot.shot] : [], onBookingPath: /book|rate|tariff|price|reserv|room/i.test(p.label) }));
        flagged = true;
        break;
      }
    }
    if (!flagged) push(result('main_nav_404', { result: 'pass', detail: `${bad.map((p) => p.label).join(', ')} answered ${bad.map((p) => p.status).join(', ')} to a plain request but opened as a page in the browser`, http: bad.map((p) => `${p.label}: ${p.status}`).join('; ') }));
  }

  // 8. ota_only_booking
  if (g.candidate.industry !== 'accommodation') push(result('ota_only_booking', { result: 'not_applicable' }));
  else if (!g.ota.length) push(result('ota_only_booking', { result: 'pass', detail: 'no OTA links' }));
  else if (engines.length || g.availabilityForm) push(result('ota_only_booking', { result: 'pass', detail: `own booking path: ${engines.join(', ') || `availability form on ${g.availabilityForm}`}` }));
  else {
    const o = g.ota[0]!;
    const names = [...new Set(g.ota.map((x) => x.name))].join(' and ');
    const v = await shooter.visit(o.on, { highlight: { href: new URL(o.url).hostname.replace(/^www\./, '') }, shot: join(dir, 'ota-page.png') });
    push(result('ota_only_booking', { result: 'flag', evidenceUrl: o.on, http: g.ota.map((x) => `${x.name}: ${x.url}`).join(' | '), detail: `the only booking links go to ${names}; no booking engine or availability search of its own on the ${g.pages.length + 1} pages read`, shot: v.shot ? await shooter.write(readFileSync(v.shot), shotPath('ota_only_booking'), [`Booking links go only to ${names}`, `"${o.text || 'link'}" on ${o.on}`]) : null, onBookingPath: true }));
  }

  // 7. own_email_dead: a published address whose domain has no mail server.
  const dead = g.emails.filter((e) => e.mxOk === false && plausibleEmail(e.email) && /^(?:ENOTFOUND|ENODATA|no MX records)$/.test(e.mxError ?? ''));
  if (!g.emails.length) push(result('own_email_dead', { result: 'not_applicable', detail: 'no published address' }));
  else if (!dead.length) push(result('own_email_dead', { result: 'pass', http: g.emails.map((e) => `${e.email}: ${e.mxOk === null ? (e.mxError ?? 'not checked') : e.mxOk ? `MX ${e.mxHosts[0] ?? ''}` : (e.mxError ?? 'no MX')}`).join('; ') }));
  else {
    const e = dead[0]!;
    const v = await proofVisit(shooter, e.on, { href: `mailto:${e.email}`, text: e.email }, join(dir, 'email-page.png'));
    const domain = e.email.split('@')[1]!;
    push(result('own_email_dead', { result: 'flag', evidenceUrl: e.on, http: `MX lookup for ${domain}: ${e.mxError}`, detail: `${e.email} is published on the site, but ${domain} has no mail server (${e.mxError}), so mail to it bounces`, shot: v.shot && v.highlighted ? await shooter.write(readFileSync(v.shot), shotPath('own_email_dead'), [`${e.email}: no mail server for ${domain}`, `DNS: ${e.mxError} (checked ${g.gatheredAt.slice(0, 10)})`]) : null }));
  }

  // 5. phone_mismatch
  push(await checkPhone(g, shooter, dir));

  // 6. hours_mismatch
  push(await checkHours(g, shooter, dir, crawlCacheDir));
  return out;
}

/** Check 5 on its own, so it can run again on stored reads. */
export async function checkPhone(g: Gathered, shooter: Shooter, dir: string): Promise<CheckResult> {
  const shotPath = (c: string) => join(dir, `${c}.png`);
  let res: CheckResult | null = null;
  const push = (r: CheckResult) => {
    if (r.result === 'flag' && (!r.shot || !existsSync(r.shot))) {
      r.result = 'unproven';
      r.detail = `${r.detail} (no picture could be taken, so not a flag)`;
    }
    res = r;
  };
  const gphone = nzDigits(g.candidate.phone || '');
  const sitePhones = [...g.phones.shown, ...g.phones.tel];
  if (!gphone || gphone.length < 8) push(result('phone_mismatch', { result: 'not_applicable', detail: 'no phone on the Google listing' }));
  else if (!sitePhones.length) push(result('phone_mismatch', { result: 'not_applicable', detail: 'no phone number found on the pages read' }));
  else if (sitePhones.some((p) => samePhone(nzDigits(p.shown), gphone) || samePhone(p.digits, gphone))) push(result('phone_mismatch', { result: 'pass', http: `Google ${g.candidate.phone} is on the site` }));
  else {
    const first = g.phones.shown[0] ?? g.phones.tel[0]!;
    const shown = [...new Set(g.phones.shown.map((p) => p.shown))].slice(0, 3).join(', ') || [...new Set(g.phones.tel.map((p) => p.shown))].slice(0, 3).join(', ');
    const v = await proofVisit(shooter, first.on, { digits: first.digits }, join(dir, 'phone-page.png'));
    push(result('phone_mismatch', { result: 'flag', evidenceUrl: first.on, http: `Google listing: ${g.candidate.phone}; site: ${shown}`, detail: `Google lists ${g.candidate.phone}, which is not on the ${g.pages.length + 1} pages read; the site shows ${shown}`, shot: v.shot && v.highlighted ? await shooter.write(readFileSync(v.shot), shotPath('phone_mismatch'), [`Google listing: ${g.candidate.phone}`, `This site: ${shown}`]) : null }));
  }
  return res!;
}

/** Check 6 on its own, so it can run again on stored reads. */
export async function checkHours(g: Gathered, shooter: Shooter, dir: string, crawlCacheDir: string): Promise<CheckResult> {
  const shotPath = (c: string) => join(dir, `${c}.png`);
  let res: CheckResult | null = null;
  const push = (r: CheckResult) => {
    if (r.result === 'flag' && (!r.shot || !existsSync(r.shot))) {
      r.result = 'unproven';
      r.detail = `${r.detail} (no picture could be taken, so not a flag)`;
    }
    res = r;
  };
  const gweek = googleWeekFromText(g.candidate.hours) ?? googleWeek(g.candidate.hours_periods);
  let siteHours: { week: ReturnType<typeof googleWeek>; lines: string[]; on: string } | null = null;
  if (gweek) {
    const idx = join(crawlCacheDir, g.domain, 'pages.json');
    if (existsSync(idx)) {
      const crawl = JSON.parse(readFileSync(idx, 'utf8')) as { homeTries: { file: string | null; finalUrl: string; status: number | null }[]; pages: { file: string | null; finalUrl: string; status: number | null }[] };
      for (const p of [...crawl.homeTries, ...crawl.pages].filter((x) => x.file && x.status === 200)) {
        const html = readFileSync(join(crawlCacheDir, g.domain, p.file!), 'utf8');
        const sw = siteWeek(visibleText(cheerio.load(html)));
        if (sw) {
          siteHours = { week: sw.week, lines: sw.lines, on: p.finalUrl };
          break;
        }
      }
    }
  }
  // A motel's hours on its own site are reception's or its cafe's; the listing is the property's. Not comparable.
  if (g.candidate.industry === 'accommodation') push(result('hours_mismatch', { result: 'not_applicable', detail: 'accommodation: the site gives reception or facility hours, the listing the property' }));
  else if (!gweek) push(result('hours_mismatch', { result: 'not_applicable', detail: 'no hours on the Google listing' }));
  else if (!siteHours?.week) push(result('hours_mismatch', { result: 'not_applicable', detail: 'no readable hours on the pages read' }));
  else {
    const diff = hoursConflicts(siteHours.week, gweek);
    if (diff.length < 2) push(result('hours_mismatch', { result: 'pass', evidenceUrl: siteHours.on, http: `site: ${siteHours.lines.join(' / ').slice(0, 200)}; Google: ${g.candidate.hours.slice(0, 200)}`, detail: diff.length ? `one day differs: ${diff[0]!.day}` : '' }));
    else {
      const v = await proofVisit(shooter, siteHours.on, { text: (siteHours.lines[0]!.split(/\d/)[0] ?? '').replace(/[\s:–-]+$/, '').slice(0, 30) || siteHours.lines[0]!.slice(0, 12) }, join(dir, 'hours-page.png'));
      const lines = diff.map((d) => `${d.day}: site ${d.site}, Google ${d.google}`);
      push(result('hours_mismatch', { result: 'flag', evidenceUrl: siteHours.on, http: `site: ${siteHours.lines.join(' / ').slice(0, 300)}; Google: ${g.candidate.hours}`, detail: `${diff.length} days differ: ${lines.join('; ')}`, shot: v.shot && v.highlighted ? await shooter.write(readFileSync(v.shot), shotPath('hours_mismatch'), ['Opening hours differ from the Google listing', ...lines.slice(0, 4)]) : null }));
    }
  }
  return res!;
}

async function checkBooking(g: Gathered, shooter: Shooter, dir: string, push: (r: CheckResult) => void): Promise<void> {
  if (!g.follows.length) {
    push(result('booking_link_broken', { result: 'not_applicable', detail: 'no booking, appointment or availability link found' }));
    return;
  }
  const http = g.follows.map((f) => `${f.text || f.how} ${f.url} -> ${httpOf(f)}${f.says ? ` [says ${f.says}: ${f.saysText}]` : ''}`).join(' | ');
  const shot = join(dir, 'booking_link_broken.png');
  const suspects: { f: Follow; why: string }[] = [];
  for (const f of g.follows) {
    // A link to "/.lightbox-header" or a pop-up is a hook a script opens on the page: the address itself was never meant to load.
    if (f.error === 'robots' || isEmailProtection(f.url) || /\/\.[\w-]+\/?$|lightbox|popup|pop-up|modal/i.test(f.url)) continue;
    if (f.status !== null && (f.status === 404 || f.status === 410 || f.status >= 500)) suspects.push({ f, why: `answers ${f.status}` });
    else if (f.status === null && f.error && /ENOTFOUND|ECONNREFUSED|EAI_AGAIN|ERR_NAME|CERT|SSL|TLS/i.test(f.error)) suspects.push({ f, why: `cannot be reached (${f.error})` });
    else if (f.says === 'inactive') suspects.push({ f, why: `the booking page says "${f.saysText}"` });
    else if (f.says === 'missing') suspects.push({ f, why: `the page says "${f.saysText}"` });
    else if (f.engine && f.status === 200) suspects.push({ f, why: '' });
  }
  // Engine pages are opened in the browser too: an inactive account shows only once the page has run.
  for (const { f, why } of suspects.slice(0, 4)) {
    const v = await shooter.visit(f.url, { shot, frames: true });
    if (v.blocked) continue;
    const text = `${v.title}\n${v.text}\n${v.frames.map((x) => x.text).join('\n')}`;
    const inactive = INACTIVE.exec(text);
    const shortText = v.text.replace(/\s+/g, ' ').trim().length < 400;
    let confirmed = '';
    if (v.error && !v.certError) confirmed = `the browser cannot open it (${v.error})`;
    else if (v.certError) confirmed = `its certificate is not valid (${v.certError})`;
    else if (v.status !== null && v.status >= 400 && ![401, 403, 429].includes(v.status) && !ENGINE_WALL.test(text)) confirmed = `it answers ${v.status}`;
    else if (inactive) confirmed = `the booking page says "${inactive[0]}"`;
    else if (!f.engine && MISSING.test(`${v.title}`) && shortText) confirmed = `the page says "${v.title.slice(0, 60)}"`;
    if (!confirmed) continue;
    const proof = v.shot ? await shooter.write(readFileSync(v.shot), shot, [`"${f.text || 'Book'}" link: ${confirmed}`, f.url]) : null;
    push(result('booking_link_broken', { result: 'flag', evidenceUrl: f.url, http: `${f.text || f.how} on ${f.on}: GET ${httpOf(f)}${why ? ` (${why})` : ''} | browser: ${v.status ?? v.error}`, detail: `the "${f.text || 'Book'}" link on ${f.on} ${confirmed}`, shot: proof, onBookingPath: true }));
    return;
  }
  const unknown = g.follows.filter((f) => f.error === 'robots' || (f.status !== null && [401, 403, 429].includes(f.status)));
  push(result('booking_link_broken', { result: unknown.length === g.follows.length ? 'unknown' : 'pass', http, detail: unknown.length ? `${unknown.length} link(s) not opened: robots.txt or refused to us` : '' }));
}

/**
 * A homepage a plain request could not read (a firewall's 429, a page built by script) is read from the
 * browser instead: its addresses, numbers, LinkedIn, booking and OTA links join what the crawl found.
 * Booking links found only this way are listed but not followed.
 */
async function fillFromRender(g: Gathered, home: Visit): Promise<void> {
  const thin = !g.homeUrl || (!g.emails.length && !g.phones.shown.length);
  if (!thin) return;
  const page: SitePage = { url: home.url, finalUrl: home.finalUrl, status: home.status, html: home.html, role: 'home' };
  const before = g.emails.length;
  for (const e of emailsOnPage(home.html, home.finalUrl)) {
    if (g.emails.some((x) => x.email === e.email)) continue;
    const mx = plausibleEmail(e.email) ? await mxCheck(e.email) : { ok: null, hosts: [], error: 'not checked: the address does not end in a known domain ending' };
    g.emails.push({ email: e.email, on: e.sourceUrl, how: `${e.how}, read in the browser`, mxOk: mx.ok, mxHosts: mx.hosts, mxError: mx.error });
  }
  const ph = phonesOnSite([page]);
  for (const x of ph.shown) if (!g.phones.shown.some((y) => y.digits === x.digits)) g.phones.shown.push(x);
  for (const x of ph.tel) if (!g.phones.tel.some((y) => y.digits === x.digits)) g.phones.tel.push(x);
  for (const x of linkedinLinks([page])) if (!g.linkedin.some((y) => y.url === x.url)) g.linkedin.push(x);
  for (const x of otaLinks([page])) if (!g.ota.some((y) => y.url === x.url)) g.ota.push(x);
  for (const x of bookingLinks([page])) if (!g.booking.some((y) => y.url === x.url)) g.booking.push(x);
  if (!g.names.length) g.names = greetingNamesOn([page]);
  if (!g.homeUrl || g.emails.length > before) g.readBy = 'browser';
}
