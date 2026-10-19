import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { ROOT } from '@plumbline/core';
import { plainWords } from '../names.ts';

export type ListId = 'A' | 'B' | 'C' | 'D';

export interface Centre {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusKm: number;
}

export interface DiscoverConfig {
  centres: Centre[];
  lists: Record<ListId, { label: string; terms: string[]; ratingCount: [number, number] }>;
  chains: Record<ListId, string[]>;
  directories: string[];
  publicHealth: { hosts: string[]; names: string[]; types: string[] };
  holidayParks: { sitemap: string };
  priorContact: { suppression: string; lists: string[]; extraDomains: string[]; extraNames: string[] };
}

export function loadDiscoverConfig(): DiscoverConfig {
  return parse(readFileSync(join(ROOT, 'config', 'book-direct', 'discover.yml'), 'utf8')) as DiscoverConfig;
}

/** The host of an address in lower case without "www.", or "" when it cannot be read. */
export function hostOfUrl(url: string | undefined | null): string {
  if (!url) return '';
  try {
    return new URL(/^[a-z]+:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Whether a host is one of the listed hosts or under one of them. */
export function hostIn(host: string, list: string[]): boolean {
  return !!host && list.some((d) => host === d || host.endsWith(`.${d}`));
}

/** A word run that appears in a name as whole words: "best western" in "Best Western Motel", never "quest" in "Questar". */
export function hasPhrase(name: string, phrase: string): boolean {
  const words = plainWords(name);
  const parts = plainWords(phrase);
  if (!parts.length) return false;
  return words.some((_, i) => parts.every((p, j) => words[i + j] === p));
}

export interface PlaceLike {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  websiteUri?: string;
  businessStatus?: string;
  primaryType?: string;
  userRatingCount?: number;
}

export interface KeepContext {
  list: ListId;
  cfg: Pick<DiscoverConfig, 'lists' | 'chains' | 'directories' | 'publicHealth'>;
  /** How many distinct places share each website host, across every search of the run. */
  hostCounts: Map<string, number>;
}

/** More than this many places on one website host is a chain's site, not an owner's. */
export const CHAIN_HOST_ABOVE = 4;

/**
 * Why a place is not a candidate, in the relay's order, or null when it is kept. The website is
 * checked before anything else, because without their own site there is nothing to audit.
 */
export function bookDirectDropReason(p: PlaceLike, ctx: KeepContext): string | null {
  const name = p.displayName?.text ?? '';
  if (p.businessStatus !== 'OPERATIONAL') return 'not_operational';
  const host = hostOfUrl(p.websiteUri);
  if (!host) return 'no_website';
  if (hostIn(host, ctx.cfg.directories)) return 'directory_or_social_website';
  const [lo, hi] = ctx.cfg.lists[ctx.list].ratingCount;
  const n = p.userRatingCount ?? 0;
  if (n < lo || n > hi) return 'rating_count_out_of_band';
  if (ctx.cfg.chains[ctx.list].some((c) => hasPhrase(name, c))) return 'chain_or_franchise';
  if (hostIn(host, ctx.cfg.publicHealth.hosts) || ctx.cfg.publicHealth.names.some((w) => hasPhrase(name, w)) || ctx.cfg.publicHealth.types.includes(p.primaryType ?? '')) return 'hospital_or_public_body';
  if ((ctx.hostCounts.get(host) ?? 0) > CHAIN_HOST_ABOVE) return 'chain_or_franchise';
  if (!onTarget(ctx.list, name, p.primaryType ?? '')) return 'off_target_type';
  return null;
}

const STAY_TYPES = new Set(['motel', 'lodging', 'bed_and_breakfast', 'rv_park', 'campground', 'inn', 'guest_house', 'private_guest_room', 'farmstay', 'cottage', 'camping_cabin', 'cabin', 'chalet', 'extended_stay_hotel', 'apartment_building', 'apartment_complex', 'condominium_complex', 'japanese_inn']);
const STAY_NAME = /\b(?:motel|motor (?:inn|lodge)|lodge|holiday park|top 10|b ?& ?b|bed (?:and|&) breakfast|camp(?:ground|ing)?|cottages?|chalets?|cabins?|retreat|homestay|farmstay|guest ?house|inn)\b/i;
const STAY_NAME_STRICT = /\b(?:motel|motor (?:inn|lodge)|lodge|holiday park|top 10|b ?& ?b|bed (?:and|&) breakfast|inn)\b/i;
const NOT_STAY_TYPES = new Set(['restaurant', 'bar', 'pub', 'cafe', 'bistro', 'bar_and_grill', 'doctor', 'dental_clinic', 'travel_agency', 'health', 'association_or_organization', 'tourist_attraction', 'point_of_interest', 'childrens_camp', 'event_venue', 'wedding_venue', 'service', 'park', 'mobile_home_park']);
const CLINIC_TYPES = new Set(['physiotherapist', 'chiropractor']);
const CLINIC_NAME = /physio|chiro|osteo|spinal|\bspine\b|musculoskeletal|sports? (?:injury|medicine)|rehab/i;
const DENTAL = /dent|smile|orthodont|teeth|tooth/i;

/**
 * Whether a place is the kind of business the list is for. List A is motels, holiday parks, lodges and
 * B&Bs: a hotel, resort or hostel stays only when its name says motel, lodge, inn, B&B or holiday park.
 * List B is physiotherapy, chiropractic and osteopathy: the Google type or the name must say so.
 */
export function onTarget(list: ListId, name: string, type: string): boolean {
  if (list === 'A') {
    if (NOT_STAY_TYPES.has(type)) return false;
    if (['hotel', 'resort_hotel', 'hostel'].includes(type)) return STAY_NAME_STRICT.test(name);
    return STAY_TYPES.has(type) || STAY_NAME.test(name);
  }
  if (list === 'B') return CLINIC_TYPES.has(type) || CLINIC_NAME.test(name);
  if (list === 'C') return type === 'dentist' || type === 'dental_clinic' || DENTAL.test(name);
  return true;
}

/** Flags that travel with a kept place. Top 10 members stay in, flagged, as the relay asks. */
export function placeFlags(p: PlaceLike, affiliations: string[] = []): string[] {
  const name = p.displayName?.text ?? '';
  const flags: string[] = [];
  if (hasPhrase(name, 'top 10') || hasPhrase(name, 'top ten') || affiliations.some((a) => /top\s*10/i.test(a)) || /top10/i.test(hostOfUrl(p.websiteUri))) flags.push('top10_member');
  return flags;
}

/** A name reduced for matching: lower case, plain letters, no legal or filler words. */
export function nameKey(name: string): string {
  return plainWords(name)
    .filter((w) => !['the', 'ltd', 'limited', 'nz', 'and', 'a'].includes(w))
    .join(' ');
}

export interface PriorContact {
  domains: Set<string>;
  emails: Set<string>;
  /** "name key|town key". A town key of "" matches the name in any town. */
  nameTowns: Set<string>;
}

/** Whether a business was emailed before or asked not to be: by domain, by address, or by name and town. */
export function priorContactReason(prior: PriorContact, b: { name: string; town: string; website: string; emails?: string[] }): string | null {
  const host = hostOfUrl(b.website);
  if (host && [...prior.domains].some((d) => host === d || host.endsWith(`.${d}`))) return 'previously_contacted_or_suppressed';
  for (const e of b.emails ?? []) {
    const at = e.toLowerCase().trim();
    const domain = at.split('@')[1] ?? '';
    if (prior.emails.has(at) || (domain && prior.domains.has(domain))) return 'previously_contacted_or_suppressed';
  }
  const key = nameKey(b.name);
  const town = nameKey(b.town);
  if (key && (prior.nameTowns.has(`${key}|${town}`) || prior.nameTowns.has(`${key}|`))) return 'previously_contacted_or_suppressed';
  return null;
}
