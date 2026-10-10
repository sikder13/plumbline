import type { CandidateFinding } from '@plumbline/core';
import { BOOKING_WORDS, ENQUIRY_WORDS, emailsIn, fingerprintUrl, phonesIn, prices } from '@plumbline/collect';
import type { PageCapture } from '@plumbline/render';
import { home, okHomes, okInner, pageEvidence, pathOf, siteFinding } from '../../helpers.ts';
import type { Check } from '../../types.ts';

/** Things in the first phone screen that let a visitor book, enquire, call or email. */
export function foldActions(page: PageCapture): string[] {
  const out: string[] = [];
  for (const l of page.links) {
    if (!l.visible || !l.fold) continue;
    const raw = l.raw.toLowerCase();
    if (raw.startsWith('tel:') && raw.length > 4) out.push(`phone link ${l.raw}`);
    else if (raw.startsWith('mailto:') && raw.length > 7) out.push(`email link ${l.raw}`);
    else if (/^https?:\/\/(wa\.me|api\.whatsapp\.com|m\.me)\//i.test(l.raw)) out.push(`message link ${l.raw}`);
    else if (fingerprintUrl(l.href)) out.push(`booking link "${l.text}"`);
    else if (BOOKING_WORDS.test(l.text)) out.push(`booking control "${l.text}"`);
    else if (ENQUIRY_WORDS.test(l.text)) out.push(`enquiry control "${l.text}"`);
  }
  for (const c of page.controls) {
    if (!c.fold) continue;
    if (c.tag === 'iframe' && fingerprintUrl(c.src)) out.push('booking widget');
    else if (c.tag === 'form' && c.hasEmailField && c.fields >= 2) out.push('enquiry form');
    else if (c.tag !== 'form' && c.tag !== 'iframe' && (BOOKING_WORDS.test(c.text) || ENQUIRY_WORDS.test(c.text))) out.push(`button "${c.text}"`);
  }
  // A phone number or email shown as plain text in the first screen still lets a visitor act.
  const foldText = page.blocks.filter((b) => b.box.y < page.layout.innerHeight).map((b) => b.text).join('\n');
  for (const p of phonesIn(foldText)) out.push(`phone number ${p}`);
  for (const e of emailsIn(foldText)) out.push(`email ${e}`);
  return out;
}

export const C13_no_action_above_fold: Check = {
  id: 'C13_no_action_above_fold',
  pack: 'core',
  tier: 'rule',
  evidenceSpec: 'page',
  appliesTo: ({ site }) => !site.blocked && !!site.homepage.mobile?.ok,
  evaluate({ site }) {
    const page = site.homepage.mobile!;
    if (foldActions(page).length) return [];
    const controls = page.links.filter((l) => l.visible && l.fold && l.text).map((l) => l.text).slice(0, 12);
    return [
      {
        checkId: this.id,
        fingerprint: 'homepage',
        title: 'The first phone screen has no way to book or get in touch',
        pageUrl: page.finalUrl,
        viewport: 'mobile',
        where: 'homepage_mobile',
        detail: { linksInFirstScreen: controls, screen: `${page.layout.innerWidth} x ${page.layout.innerHeight}` },
        evidence: [
          {
            kind: 'element',
            url: page.finalUrl,
            viewport: 'mobile',
            selector: 'html',
            box: { x: 0, y: 0, w: page.layout.innerWidth, h: page.layout.innerHeight },
            excerpt: `First phone screen. Links seen: ${controls.join(', ') || 'none'}. No booking, enquiry, phone or email control.`,
          },
        ],
      },
    ];
  },
};

export const C14_no_price_visible: Check = {
  id: 'C14_no_price_visible',
  pack: 'core',
  tier: 'rule',
  evidenceSpec: 'page',
  appliesTo: ({ site }) => !site.blocked && okHomes(site).length > 0,
  evaluate({ site }) {
    if (okHomes(site).some((p) => prices(p).length)) return [];
    const inner = okInner(site).map((p) => ({ url: p.finalUrl, prices: prices(p) })).filter((p) => p.prices.length);
    const anywhere = inner.length > 0;
    return [
      siteFinding(
        this.id,
        site,
        anywhere ? 'No price is shown on the homepage' : 'No price is shown anywhere on the site',
        { scope: anywhere ? 'homepage' : 'site', pricesFoundOn: inner.slice(0, 5).map((p) => ({ url: p.url, examples: p.prices.slice(0, 3).map((x) => x.context) })), pagesRead: okInner(site).length + 1 },
        anywhere
          ? `No dollar figure is visible on the homepage. Prices appear on: ${inner.slice(0, 3).map((p) => pathOf(p.url)).join(', ')}.`
          : `No dollar figure is visible on the homepage or on the ${okInner(site).length} other pages read.`,
        'homepage',
      ),
    ];
  },
};

export const C15_contact_details_missing: Check = {
  id: 'C15_contact_details_missing',
  pack: 'core',
  tier: 'rule',
  evidenceSpec: 'page',
  appliesTo: ({ site }) => !site.blocked && okHomes(site).length > 0,
  evaluate({ site }) {
    for (const page of okHomes(site)) {
      if (phonesIn(page.text).length || emailsIn(page.text).length) return [];
      if (page.links.some((l) => l.visible && (/^tel:\S+/i.test(l.raw.trim()) || /^mailto:\S+/i.test(l.raw.trim())))) return [];
    }
    return [siteFinding(this.id, site, 'The homepage shows no phone number or email', { pagesRead: okHomes(site).map((p) => p.viewport) }, 'No phone number, email address, phone link or email link is visible on the homepage at either screen size.', 'homepage')];
  },
};

export const C16_booking_hard_to_reach: Check = {
  id: 'C16_booking_hard_to_reach',
  pack: 'core',
  tier: 'measured',
  evidenceSpec: 'page',
  appliesTo: ({ site }) => !site.blocked && site.booking.some((b) => b.kind === 'system'),
  evaluate({ site }) {
    const systems = site.booking.filter((b) => b.kind === 'system');
    const homeUrls = new Set(okHomes(site).map((p) => p.finalUrl));
    const reachable = (b: (typeof systems)[number]) => b.visibleLink || b.how === 'iframe';
    // One step: the homepage itself links to or embeds booking. Two steps: a page linked from the homepage does.
    if (systems.some((b) => reachable(b))) {
      const steps = systems.some((b) => reachable(b) && homeUrls.has(b.pageUrl)) ? 1 : 2;
      if (steps <= 2) return [];
    }
    const system = systems[0]!.system;
    const findings: CandidateFinding[] = [
      siteFinding(
        this.id,
        site,
        `${system} booking is on the site but no visible link reaches it`,
        { system, signals: systems.slice(0, 5).map((b) => ({ how: b.how, url: b.url, page: b.pageUrl })), pagesRead: okInner(site).length + 1 },
        `${system} is loaded on the site, but no visible link or booking widget was found on the homepage or the ${okInner(site).length} pages one step from it.`,
        'booking',
      ),
    ];
    return findings;
  },
};

export function hasBookingWordLink(page: PageCapture): boolean {
  return page.links.some((l) => l.visible && BOOKING_WORDS.test(l.text)) || page.controls.some((c) => c.tag !== 'form' && c.tag !== 'iframe' && BOOKING_WORDS.test(c.text));
}

export { home, pageEvidence };
