import { foldName } from '@plumbline/core';

export interface Exclusion {
  group: string;
  /** Matched against the folded business name. */
  names: RegExp;
  /** Matched against the registrable domain. */
  domains?: RegExp;
}

/** Large groups, their brands, and national chains. These are never audited. */
export const EXCLUSIONS: Exclusion[] = [
  { group: 'RealNZ', names: /\b(realnz|real nz|real journeys|go orange|cardrona alpine|treble cone|international antarctic centre|tss earnslaw|walter peak)\b/, domains: /^(realnz\.com|realjourneys\.co\.nz|goorange\.co\.nz)$/ },
  { group: 'Ngāi Tahu Tourism', names: /\b(ngai tahu tourism|shotover jet|dart river|huka falls jet|rainbow springs|agrodome|hollyford (track|wilderness)|franz josef glacier guides|glacier hot pools|all blacks experience|national kiwi hatchery|dark sky project)\b/, domains: /^(ngaitahutourism\.co\.nz|shotoverjet\.com|dartriver\.co\.nz|hukafallsjet\.com|rainbowsprings\.co\.nz|agrodome\.co\.nz|franzjosefglacier\.com|darkskyproject\.co\.nz)$/ },
  { group: 'Tourism Holdings', names: /\b(tourism holdings|thl\b|kiwi experience|discover waitomo|waitomo glowworm caves|ruakuri cave|aranui cave|black water rafting|maui (rentals|motorhomes)|britz|apollo (motorhome|campers))\b/, domains: /^(thlonline\.com|waitomo\.com|kiwiexperience\.com|maui-rentals\.com|britz\.com)$/ },
  { group: 'Skyline', names: /\bskyline (queenstown|rotorua|enterprises|luge|gondola)\b/, domains: /^skyline\.co\.nz$/ },
  { group: 'AJ Hackett', names: /\b(aj hackett|a j hackett|hackett bungy|nevis (bungy|swing|catapult)|kawarau bungy|auckland bridge (bungy|climb)|skywalk|skyjump)\b/, domains: /^(bungy\.co\.nz|ajhackett\.com)$/ },
  { group: 'Hobbiton', names: /\bhobbiton\b/, domains: /^hobbitontours\.com$/ },
  { group: 'Te Puia', names: /\b(te puia|new zealand maori arts and crafts institute)\b/, domains: /^tepuia\.com$/ },
  { group: 'Fullers and Explore', names: /\b(fullers(360| great sights)?|great sights|explore group|intercity)\b/, domains: /^(fullers\.co\.nz|fullersgreatsights\.co\.nz|greatsights\.co\.nz|exploregroup\.co\.nz|intercity\.co\.nz|dolphincruises\.co\.nz)$/ },
  { group: 'Entrada and Wayfare', names: /\b(wayfare|entrada travel)\b/ },
  { group: 'Public bodies and information centres', names: /\b(department of conservation|doc visitor centre|i-?site|isite visitor|visitor information centre|information centre|district council|city council|regional council)\b/, domains: /^(doc\.govt\.nz|isite\.nz)$|\.govt\.nz$/ },
  { group: 'National chains and franchises', names: /\b(kiwi rail|kiwirail|interislander|bluebridge|air new zealand|jucy|wilderness motorhomes|rydges|hilton|novotel|mercure|accor|scenic hotel|heritage hotels?|millennium hotel|copthorne|kingsgate|top 10 holiday park|yha|base backpackers|haka (tours|lodge|tourism)|contiki|flying kiwi|stray travel|pure glenorchy|southern discoveries|ziptrek|oxbow|canyon swing|skydive (queenstown|wanaka|taupo|abel tasman|franz|auckland)|nzone|rainbow.?s end|kelly tarlton|sea life|sky ?city|sky tower|weta workshop|zealandia|mcdonald|starbucks)\b/ },
];

export function exclusionFor(name: string, domain: string | null): string | null {
  // Words in brackets describe where a business is, not who owns it.
  const folded = foldName(name.replace(/\(.*?\)/g, ' '));
  for (const e of EXCLUSIONS) {
    if (e.names.test(folded)) return e.group;
    if (domain && e.domains?.test(domain)) return e.group;
  }
  return null;
}

/** Hosts that are a page on someone else's platform, not a business's own website. */
export const NOT_OWN_SITE = /(^|\.)(facebook\.com|fb\.com|fb\.me|instagram\.com|linktr\.ee|tripadvisor\.[a-z.]+|bookme\.co\.nz|viator\.com|getyourguide\.[a-z.]+|airbnb\.[a-z.]+|booking\.com|expedia\.[a-z.]+|fishingbooker\.com|newzealand\.com|google\.[a-z.]+|g\.page|goo\.gl|business\.site|yelp\.[a-z.]+|rezdy\.com|fareharbor\.com|bookeo\.com|checkfront\.com|youtube\.com|twitter\.com|x\.com|linkedin\.com|wixsite\.com\/nonexistent|eventbrite\.[a-z.]+|trademe\.co\.nz|neighbourly\.co\.nz|yellow\.co\.nz|finda\.co\.nz|nzherald\.co\.nz)$/;
