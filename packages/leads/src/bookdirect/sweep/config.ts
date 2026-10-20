import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { ROOT } from '@plumbline/core';
import { plainWords } from '../../names.ts';
import { hasPhrase, hostIn, hostOfUrl, loadDiscoverConfig, onTarget, type Centre, type DiscoverConfig, type PlaceLike } from '../filters.ts';

/**
 * Hosts the campaign never requests, as a page or a frame, from the crawler or the browser: the relay's
 * named sites and the travel agents whose terms forbid automated reading. A link to them is recorded, never opened.
 */
const OFF_LIMITS = [/(^|\.)booking\.com$/, /(^|\.)bookme\.co\.nz$/, /(^|\.)yellow\.co\.nz$/, /(^|\.)neighbourly\.co\.nz$/, /(^|\.)linkedin\.com$/, /(^|\.)airbnb\.[a-z.]+$/, /(^|\.)expedia\.[a-z.]+$/, /(^|\.)agoda\.com$/, /(^|\.)hotels\.com$/, /(^|\.)tripadvisor\.[a-z.]+$/, /(^|\.)vrbo\.com$/, /(^|\.)trivago\.[a-z.]+$/];

export function allowHost(host: string): boolean {
  const h = host.toLowerCase();
  return !!h && !OFF_LIMITS.some((r) => r.test(h));
}

export function allowUrl(url: string): boolean {
  try {
    return allowHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

export interface Industry {
  id: string;
  label: string;
  terms: string[];
  chains: string[];
}

export interface BookSweepConfig {
  centres: Centre[];
  perIndustry: number;
  ratingCount: [number, number];
  industries: Industry[];
  directories: string[];
  neverTypes: string[];
  base: DiscoverConfig;
}

export function loadSweepConfig(): BookSweepConfig {
  const base = loadDiscoverConfig();
  const raw = parse(readFileSync(join(ROOT, 'config', 'book-direct', 'sweep.yml'), 'utf8')) as {
    moreCentres: Centre[];
    perIndustry: number;
    ratingCount: [number, number];
    industries: Industry[];
    moreDirectories: string[];
    neverTypes: string[];
  };
  return {
    centres: [...base.centres, ...raw.moreCentres],
    perIndustry: raw.perIndustry,
    ratingCount: raw.ratingCount,
    industries: raw.industries,
    directories: [...base.directories, ...raw.moreDirectories],
    neverTypes: raw.neverTypes,
    base,
  };
}

/** Google types that say which industry a place belongs to. */
const TYPES: Record<string, Set<string>> = {
  accommodation: new Set(['motel', 'lodging', 'bed_and_breakfast', 'rv_park', 'campground', 'inn', 'guest_house', 'private_guest_room', 'farmstay', 'cottage', 'camping_cabin', 'cabin', 'chalet', 'extended_stay_hotel', 'hotel', 'resort_hotel', 'hostel', 'japanese_inn', 'budget_japanese_inn']),
  'allied-health': new Set(['physiotherapist', 'chiropractor', 'podiatrist']),
  dental: new Set(['dentist', 'dental_clinic']),
  trades: new Set(['plumber', 'electrician', 'locksmith', 'roofing_contractor', 'glazier', 'window_installation_service', 'drainage_service', 'general_contractor', 'handyman']),
  hospitality: new Set(['restaurant', 'cafe', 'coffee_shop', 'bakery', 'bistro', 'brunch_restaurant', 'breakfast_restaurant', 'diner', 'cafeteria', 'tea_house', 'dessert_shop', 'deli', 'food_court', 'fine_dining_restaurant']),
  'hair-beauty': new Set(['hair_salon', 'hair_care', 'barber_shop', 'beauty_salon', 'nail_salon', 'beautician', 'skin_care_clinic', 'makeup_artist', 'tanning_studio', 'spa', 'day_spa', 'cosmetics_store']),
  tourism: new Set(['tour_agency', 'boat_tour_agency', 'fishing_charter', 'tourist_attraction', 'adventure_sports_center', 'sightseeing_tour_agency', 'marina', 'boat_rental']),
  'vets-pets': new Set(['veterinary_care', 'pet_care', 'pet_boarding_service', 'pet_groomer', 'dog_trainer', 'animal_hospital']),
  fitness: new Set(['gym', 'fitness_center', 'yoga_studio', 'pilates_studio', 'massage', 'massage_spa', 'wellness_center', 'sports_club', 'sports_activity_location', 'sauna']),
  'auto-home': new Set(['car_repair', 'auto_repair', 'car_service', 'tire_shop', 'cleaning_service', 'house_cleaning_service', 'lawn_care', 'landscaper', 'gardener', 'pest_control', 'pest_control_service']),
};

/** Words in a name that say the industry, for a place whose Google type is general. */
const NAMES: Record<string, RegExp> = {
  'allied-health': /physio|chiro|osteo|podiat|\bfoot ?(?:clinic|care|doctor|health)|spinal|\bspine\b|musculoskeletal|sports? (?:injury|medicine)|\brehab/i,
  trades: /\b(?:plumb\w*|electric\w*|sparky|sparkies|lock(?:s|smiths?)?|glaz\w*|glass|drain\w*|roof\w*|spouting|gutter\w*|gas ?fitt\w*|property (?:maintenance|services|care)|maintenance|handyman|building services)\b/i,
  hospitality: /restaurant|caf[eé]|eatery|bistro|brasserie|kitchen|coffee|espresso|bakery|trattoria|pizzeria|diner|dining|cuisine|roastery/i,
  'hair-beauty': /\b(?:hair\w*|barber\w*|beauty|nails?|salon|brows?|lash(?:es)?|skin|spa|laser|aestheti\w*|cosmetic\w*|wax\w*|tanning|makeup|blow ?dry)\b/i,
  tourism: /\b(?:tours?|touring|kayak\w*|charters?|fishing|jet ?boat\w*|jet|guided|guides?|guiding|walks?|trek\w*|cruises?|safaris?|eco|adventures?|scenic|heli\w*|flights?|excursions?|expeditions?|paddle\w*|rafting)\b/i,
  'vets-pets': /\b(?:vets?|veterinar\w*|animal|pets?|dogs?|doggy|groom\w*|kennels?|catter\w*|canine|paws?|k9|pooch|pup\w*|boarding)\b/i,
  fitness: /\b(?:gym|fitness|yoga|pilates|massage|crossfit|strength|barre|wellness|bodywork|boxing|personal train\w*|reformer)\b/i,
  'auto-home': /\b(?:mechanic\w*|auto\w*|automotive|tyres?|tires?|wof|panel ?beat\w*|brakes?|exhaust\w*|diesel|clean\w*|lawns?|mow\w*|garden\w*|landscap\w*|pest\w*|termite\w*|grass)\b/i,
};

/** Google types for places that sell something else: a car yard is not a mechanic, a pet shop is not pet care. */
const NOT_TYPES: Record<string, Set<string>> = {
  'auto-home': new Set(['car_dealer', 'used_car_dealer', 'car_rental', 'auto_parts_store', 'motorcycle_dealer', 'gas_station']),
  'vets-pets': new Set(['pet_store']),
  tourism: new Set(['travel_agency', 'hotel', 'lodging', 'motel', 'campground', 'rv_park', 'winery', 'restaurant', 'store', 'sporting_goods_store']),
  hospitality: new Set(['hotel', 'lodging', 'motel', 'grocery_store', 'supermarket', 'liquor_store', 'food_store', 'catering_service', 'meal_delivery', 'meal_takeaway']),
  fitness: new Set(['physiotherapist', 'chiropractor', 'doctor', 'beauty_salon', 'hair_salon', 'nail_salon']),
  'hair-beauty': new Set(['doctor', 'dentist', 'pharmacy', 'drugstore', 'department_store', 'shopping_mall']),
};

/**
 * Whether a place is the kind of business its industry is for: its Google type says so, or its name
 * does when the type is general. A type that belongs to another industry, or to something sold rather
 * than serviced (a car yard, a pet shop), is never on target.
 */
export function onTargetIndustry(industry: string, name: string, type: string, neverTypes: string[] = []): boolean {
  if (neverTypes.includes(type)) return false;
  if (industry === 'accommodation') return onTarget('A', name, type);
  if (industry === 'dental') return onTarget('C', name, type);
  if (NOT_TYPES[industry]?.has(type)) return false;
  // A tourist attraction is a tour operator only when its name says it runs trips: not a reserve, a track or a lookout.
  if (industry === 'tourism' && /^(?:tourist_attraction|)$/.test(type)) return OPERATOR.test(name);
  const own = TYPES[industry];
  if (own?.has(type)) return true;
  // A type that is another industry's says what the place is.
  if (Object.entries(TYPES).some(([id, set]) => id !== industry && set.has(type))) return false;
  return NAMES[industry]?.test(name) ?? false;
}

const OPERATOR = /\b(?:tours?|touring|kayak\w*|charters?|fishing|jet ?boat\w*|jet|guided|guides?|guiding|cruises?|safaris?|adventures?|heli\w*|flights?|excursions?|expeditions?|rafting|hire|rentals?|paddle\w*)\b/i;

/** The faith screen: alcohol, gambling, tobacco and vaping, adult and cannabis businesses, by Google type or by whole word in the name. */
const FAITH_TYPES = /^(?:bar|pub|night_club|wine_bar|cocktail_bar|sports_bar|hookah_bar|lounge_bar|irish_pub|beer_garden|brewpub|brewery|distillery|winery|liquor_store|casino|cannabis_store|tobacco_shop|vape_shop|pawn_shop|adult_entertainment_store|adult_entertainment_club|bar_and_grill|gastropub|karaoke)$/;
const FAITH_WORDS = ['pub', 'tavern', 'brewery', 'brewpub', 'brewing', 'taphouse', 'tap house', 'alehouse', 'ale house', 'distillery', 'winery', 'wineries', 'vineyard', 'vineyards', 'vines', 'vino', 'cellar door', 'cellar doors', 'wine', 'wines', 'wine bar', 'wine tours', 'wine tour', 'cocktail', 'cocktails', 'liquor', 'bottle store', 'bottlestore', 'beer', 'beers', 'cider', 'saloon', 'hookah', 'shisha', 'vape', 'vapes', 'vaping', 'smoke shop', 'tobacco', 'casino', 'pokies', 'pawn', 'adult', 'erotic', 'sensual', 'tantric', 'nuru', 'escort', 'escorts', 'strip club', 'gentlemens club', 'nightclub', 'night club', 'cannabis', 'hemp', 'cbd', 'dispensary', 'lounge bar', 'sports bar', 'rsa', 'cosmopolitan club', 'workingmens club', 'chartered club'];
/** "Bar" is alcohol unless it is a brow bar, a juice bar or the like. */
const BAR_OK_BEFORE = new Set(['brow', 'brows', 'lash', 'lashes', 'nail', 'nails', 'dry', 'juice', 'salad', 'sushi', 'espresso', 'coffee', 'smoothie', 'wax', 'waxing', 'beauty', 'health', 'protein', 'raw', 'dessert', 'noodle', 'poke', 'tea', 'milk', 'acai', 'breakfast', 'snack', 'candy', 'lolly', 'gelato', 'yoghurt', 'cereal', 'tan', 'brunch', 'oxygen', 'blow', 'pasta', 'burrito', 'taco', 'dumpling', 'ramen', 'pho', 'bowl', 'cake', 'muffin', 'bagel', 'sandwich', 'pita', 'kebab', 'brow & lash']);

export function faithReason(name: string, type: string, industry: string): string | null {
  if (FAITH_TYPES.test(type)) return `type ${type}`;
  const words = plainWords(name);
  const hit = FAITH_WORDS.find((w) => hasPhrase(name, w));
  if (hit) return `"${hit}" in the name`;
  const bar = words.findIndex((w, i) => (w === 'bar' || w === 'bars') && !BAR_OK_BEFORE.has(words[i - 1] ?? ''));
  if (bar >= 0) return '"bar" in the name';
  // Clubs: a club that serves food is a licensed club; a gym or a pilates club is not.
  if (industry === 'hospitality' && words.includes('club')) return '"club" in the name';
  return null;
}

export interface SweepKeepContext {
  industry: Industry;
  cfg: BookSweepConfig;
  hostCounts: Map<string, number>;
}

/** More than this many places on one website host is a chain's site, not an owner's. */
const CHAIN_HOST_ABOVE = 4;

/** Why a place is not a sweep candidate, or null when it is kept. */
export function sweepDropReason(p: PlaceLike & { types?: string[] }, ctx: SweepKeepContext): string | null {
  const name = p.displayName?.text ?? '';
  if (p.businessStatus !== 'OPERATIONAL') return 'not_operational';
  // A name match can bring a business from the other side of the world ("Cromwell Dental Practice", Surrey).
  if (p.formattedAddress && !/New Zealand|Aotearoa/i.test(p.formattedAddress)) return 'outside_new_zealand';
  const host = hostOfUrl(p.websiteUri);
  if (!host) return 'no_website';
  if (hostIn(host, ctx.cfg.directories)) return 'directory_or_platform_website';
  const [lo, hi] = ctx.cfg.ratingCount;
  const n = p.userRatingCount ?? 0;
  if (n < lo || n > hi) return 'rating_count_out_of_band';
  if (ctx.industry.chains.some((c) => hasPhrase(name, c))) return 'chain_or_franchise';
  const ph = ctx.cfg.base.publicHealth;
  if (hostIn(host, ph.hosts) || ph.names.some((w) => hasPhrase(name, w)) || ph.types.includes(p.primaryType ?? '')) return 'hospital_or_public_body';
  if ((ctx.hostCounts.get(host) ?? 0) > CHAIN_HOST_ABOVE) return 'chain_or_franchise';
  if (faithReason(name, p.primaryType ?? '', ctx.industry.id)) return 'faith_screen';
  if (['website_designer', 'marketing_agency', 'advertising_agency', 'graphic_designer'].includes(p.primaryType ?? '') || /\b(?:web ?design|digital marketing|marketing agency|seo)\b/i.test(name)) return 'web_or_marketing_business';
  if (!onTargetIndustry(ctx.industry.id, name, p.primaryType ?? '', ctx.cfg.neverTypes)) return 'off_target_type';
  return null;
}

/**
 * Each term's share of its industry, so the industry adds up to its total: 100 over 3 terms is 34, 33, 33.
 */
export function termShares(total: number, terms: string[]): Map<string, number> {
  const base = Math.floor(total / terms.length);
  let extra = total - base * terms.length;
  const out = new Map<string, number>();
  for (const t of terms) out.set(t, base + (extra-- > 0 ? 1 : 0));
  return out;
}

/** The centres in the order one term visits them: each term starts somewhere else, so no city leads every list. */
export function rotation<T>(centres: T[], termIndex: number, stride = 7): T[] {
  if (!centres.length) return [];
  const start = (termIndex * stride) % centres.length;
  return [...centres.slice(start), ...centres.slice(0, start)];
}

/** At most this many sites from one centre for one term. */
export function perCentreCap(share: number): number {
  return Math.max(2, Math.ceil(share / 6));
}

/** Search terms that name a trade the competitor check compares like with like. */
export function tradeOf(industry: string, term: string): string {
  if (industry === 'dental') return 'dental';
  if (industry === 'hair-beauty') return /hair|barber/.test(term) ? 'hair' : term;
  if (industry === 'allied-health') return term;
  return term;
}
