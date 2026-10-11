import { foldName, normalizeEmail, normalizePhone } from '@plumbline/core';
import { emailsIn, phonesIn, prices, type ListingData, type SiteData } from '@plumbline/collect';
import { okHomes, okInner, pagesInOrder, siteFinding } from '../../helpers.ts';
import type { Check } from '../../types.ts';

function sitePhones(site: SiteData): Set<string> {
  const out = new Set<string>();
  for (const p of pagesInOrder(site)) {
    for (const ph of phonesIn(p.text)) out.add(normalizePhone(ph));
    for (const l of p.links) if (l.visible && /^tel:/i.test(l.raw)) out.add(normalizePhone(decodeURIComponent(l.raw.slice(4))));
  }
  out.delete('');
  return out;
}

function siteEmails(site: SiteData): Set<string> {
  const out = new Set<string>();
  for (const p of pagesInOrder(site)) {
    for (const e of emailsIn(p.text)) out.add(normalizeEmail(e));
    for (const l of p.links) if (l.visible && /^mailto:/i.test(l.raw)) out.add(normalizeEmail(decodeURIComponent(l.raw.slice(7).split('?')[0] ?? '')));
  }
  out.delete('');
  return out;
}

/** A listing is trusted for comparison only when it is a directory page that names this business. */
function namesBusiness(site: SiteData, l: ListingData): boolean {
  if (!l.name) return false;
  const a = foldName(site.business.name.replace(/\(.*?\)/g, ' ')).split(' ').filter((w) => w.length > 2);
  const b = foldName(l.name);
  return a.length > 0 && a.filter((w) => b.includes(w)).length / a.length >= 0.6;
}

function comparable(site: SiteData, l: ListingData): boolean {
  return l.status === 'fetched' && l.kind === 'directory' && namesBusiness(site, l);
}

export const C37_not_named_by_ai: Check = {
  id: 'C37_not_named_by_ai',
  pack: 'core',
  tier: 'measured',
  evidenceSpec: 'ai',
  appliesTo: ({ ai }) => !!ai && ai.questions >= 4,
  evaluate({ site, ai }) {
    if (!ai || ai.namedIn > 1) return [];
    const strong = ai.others.filter((o) => o.answers >= 3);
    if (strong.length < 2) return [];
    return [
      {
        checkId: this.id,
        fingerprint: 'ai',
        title: `Named in ${ai.namedIn} of ${ai.questions} AI answers about the area`,
        pageUrl: null,
        viewport: null,
        where: 'homepage_mobile',
        detail: { namedIn: ai.namedIn, questions: ai.questions, othersNamed: strong.slice(0, 6), business: site.business.name, spanMinutes: Math.round(ai.spanMinutes), reproducedAcrossPasses: ai.holdsInBothPasses },
        evidence: [
          {
            kind: 'ai',
            excerpt: ai.sample
              ? `Question: ${ai.sample.question}\nProvider: ${ai.sample.provider}\nAsked: ${ai.sample.askedAt}\nAnswer: ${ai.sample.answer}\nCitations: ${ai.sample.citations.join(' ')}`
              : `Named in ${ai.namedIn} of ${ai.questions} questions. Others named: ${strong.map((o) => `${o.name} (${o.answers})`).join(', ')}`,
          },
        ],
      },
    ];
  },
};

export const C38_inconsistent_contact_details: Check = {
  id: 'C38_inconsistent_contact_details',
  pack: 'core',
  tier: 'rule',
  evidenceSpec: 'page',
  appliesTo: ({ site }) => !site.blocked && site.listings.some((l) => comparable(site, l)),
  evaluate({ site }) {
    const phones = sitePhones(site);
    const emails = siteEmails(site);
    const differences: { listing: string; field: string; site: string[]; listingValue: string[] }[] = [];
    for (const l of site.listings.filter((x) => comparable(site, x))) {
      const lp = l.phones.map(normalizePhone).filter((p) => p.length >= 7 && p.length <= 10);
      // A directory's own address on its page is not the business's.
      const host = new URL(l.url).hostname.replace(/^(www|book)\./, '');
      const le = l.emails.map(normalizeEmail).filter((e) => !e.endsWith(`@${host}`) && !e.endsWith(`.${host}`));
      // Freephone and local numbers are both valid for one business, so a difference needs no number in common at all.
      if (phones.size && lp.length && !lp.some((p) => phones.has(p))) differences.push({ listing: l.url, field: 'phone', site: [...phones], listingValue: l.phones });
      if (emails.size && le.length && !le.some((e) => emails.has(e))) differences.push({ listing: l.url, field: 'email', site: [...emails], listingValue: l.emails });
    }
    if (!differences.length) return [];
    const d = differences[0]!;
    return [
      siteFinding(
        this.id,
        site,
        `The ${d.field} on the site differs from the ${new URL(d.listing).hostname.replace(/^www\./, '')} listing`,
        { differences },
        differences.map((x) => `${x.field}: site shows ${x.site.join(', ')}; ${x.listing} shows ${x.listingValue.join(', ')}`).join('. '),
        `contact|${differences.map((x) => x.field).sort().join(',')}`,
      ),
    ];
  },
};

export const C61_price_differs_from_listing: Check = {
  id: 'C61_price_differs_from_listing',
  pack: 'core',
  tier: 'rule',
  evidenceSpec: 'page',
  appliesTo: ({ site }) => !site.blocked && site.listings.some((l) => l.status === 'fetched' && l.prices.length > 0),
  evaluate({ site }) {
    const sitePrices = pagesInOrder(site).flatMap((p) => prices(p));
    const amounts = new Set(sitePrices.map((p) => p.amount));
    if (!amounts.size) return [];
    for (const l of site.listings) {
      // Only listings that price in New Zealand dollars and name this business are compared.
      if (l.status !== 'fetched' || !l.prices.length || l.prices.length > 12) continue;
      if (!(l.kind === 'directory' || l.platform === 'Bookme') || !namesBusiness(site, l)) continue;
      const listingAmounts = [...new Set(l.prices.map((p) => p.amount))].filter((a) => a >= 10);
      // Any figure in common means the two may well agree, so nothing is claimed.
      if (!listingAmounts.length || listingAmounts.some((a) => amounts.has(a))) continue;
      return [
        siteFinding(
          this.id,
          site,
          `Prices on the site do not match the ${l.platform} listing`,
          { listing: l.url, sitePrices: sitePrices.slice(0, 8).map((p) => ({ amount: p.amount, context: p.context, url: p.pageUrl })), listingPrices: l.prices.slice(0, 8), pairingConfirmed: false },
          `Site: ${sitePrices.slice(0, 4).map((p) => `"${p.context}"`).join(' | ')}. Listing ${l.url}: ${l.prices.slice(0, 4).map((p) => `"${p.context}"`).join(' | ')}. The pairing of experiences needs confirming.`,
          `price|${new URL(l.url).hostname}`,
        ),
      ];
    }
    return [];
  },
};

const REVIEW_TEXT = /\b(\d(?:\.\d)?\s*(?:\/|out of)\s*5|\d(?:\.\d)?\s*stars?|\d[\d,]*\+?\s*(?:google |tripadvisor |five[- ]star |5[- ]star )?reviews?|reviews?|testimonials?|tripadvisor|trip advisor|travell?ers'? choice|certificate of excellence|what (?:our )?(?:guests|customers|clients|people) (?:say|are saying)|rated \d(?:\.\d)?)\b|★|⭐/i;
const REVIEW_WIDGET = /(trustindex|elfsight|taggbox|tripadvisor\.[a-z.]+\/(?:WidgetEmbed|widgets)|jscache\.com|widget\.trustpilot|reviews\.io|birdeye|google.*reviews|sociablekit|featurable|embedsocial|rezdy.*reviews)/i;

export function showsReviews(site: SiteData): string | null {
  for (const p of [...okHomes(site), ...okInner(site)]) {
    const m = REVIEW_TEXT.exec(p.text);
    if (m) return `text "${m[0]}" on ${p.finalUrl}`;
    const w = [...p.meta.scripts, ...p.meta.iframes, ...p.requestHosts].find((u) => REVIEW_WIDGET.test(u));
    if (w) return `review widget ${w}`;
    const img = p.images.find((i) => i.visible && /tripadvisor|trip-advisor|reviews?|rating|stars/i.test(`${i.src} ${i.alt ?? ''}`));
    if (img) return `review image ${img.src}`;
  }
  return null;
}

export const C70_reviews_not_shown: Check = {
  id: 'C70_reviews_not_shown',
  pack: 'core',
  tier: 'rule',
  evidenceSpec: 'page',
  appliesTo: ({ site }) => !site.blocked && okHomes(site).length > 0,
  evaluate({ site }) {
    const sources: { source: string; rating: number; count: number }[] = [];
    const b = site.business;
    if (b.googleRating !== null && b.googleReviewCount !== null) sources.push({ source: 'Google', rating: b.googleRating, count: b.googleReviewCount });
    for (const l of site.listings) if (l.status === 'fetched' && l.rating !== null && l.reviewCount !== null) sources.push({ source: l.url, rating: l.rating, count: l.reviewCount });
    const strong = sources.filter((s) => s.rating >= 4.5 && s.count >= 30).sort((x, y) => y.count - x.count);
    if (!strong.length || showsReviews(site)) return [];
    const s = strong[0]!;
    return [
      siteFinding(
        this.id,
        site,
        `${s.rating} from ${s.count} reviews on ${s.source === 'Google' ? 'Google' : new URL(s.source).hostname.replace(/^www\./, '')}, none shown on the site`,
        { sources: strong, pagesRead: okInner(site).length + 1 },
        `${strong.map((x) => `${x.source}: ${x.rating} from ${x.count} reviews`).join('; ')}. No rating, review count, testimonial or review widget was found on the homepage or the ${okInner(site).length} other pages read.`,
        'reviews',
      ),
    ];
  },
};
