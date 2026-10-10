import { foldName, slugify } from '@plumbline/core';

export interface AiQuestion {
  key: string;
  kind: 'area' | 'town' | 'landmark' | 'brand';
  scope: 'shared' | 'brand';
  question: string;
}

/** A short noun phrase for the activity, as a visitor would say it. */
export function activityPhrase(activity: string | null): string {
  const a = foldName(activity ?? '');
  const table: [RegExp, string][] = [
    [/kayak|paddle|canoe/, 'kayak tour'],
    [/fishing|charter/, 'fishing charter'],
    [/horse|trek(?!king company)/, 'horse trek'],
    [/glowworm|cave/, 'glowworm cave tour'],
    [/penguin|dolphin|seal|whale|wildlife|bird|kiwi|albatross/, 'wildlife tour'],
    [/wine|winery|cellar|vineyard/, 'winery cellar door'],
    [/cruise|boat|sail|yacht|jet ?boat/, 'boat cruise'],
    [/star|astro/, 'stargazing tour'],
    [/food|tasting/, 'food tour'],
    [/hunt/, 'guided hunting trip'],
    [/walk|hike|hiking|tramp/, 'guided walk'],
    [/bike|cycle|cycling/, 'bike tour'],
    [/eco|nature|scenic|sightseeing|tour/, 'scenic tour'],
  ];
  return table.find(([re]) => re.test(a))?.[1] ?? 'tour';
}

/**
 * About six questions for one business: three a visitor would ask about the place, shared by every
 * business in the same place and activity, and two neutral ones about the business itself.
 */
export function questionsFor(b: { name: string; region: string | null; town: string | null; activity: string | null; landmark?: string | null }): AiQuestion[] {
  const act = activityPhrase(b.activity);
  const out: AiQuestion[] = [];
  const shared = (kind: AiQuestion['kind'], place: string, question: string) => out.push({ key: `${kind}:${slugify(place)}:${slugify(act)}:${slugify(question).slice(0, 24)}`, kind, scope: 'shared', question });
  const region = b.region?.replace(/\s*\(.*\)$/, '').trim();
  const town = b.town?.replace(/\s*\(.*\)$/, '').split(',')[0]!.trim();
  if (region) {
    shared('area', region, `What are the best ${act}s in ${region}, New Zealand? Name specific operators.`);
    shared('area', region, `I am visiting ${region}, New Zealand and want to book a ${act}. Which local businesses do you recommend?`);
  }
  if (town && foldName(town) !== foldName(region ?? '')) {
    shared('town', town, `Which ${act} operators are there in ${town}, New Zealand?`);
    shared('town', town, `Who should I book a ${act} with near ${town}, New Zealand?`);
  }
  if (b.landmark) shared('landmark', b.landmark, `Which operators run a ${act} at ${b.landmark}, New Zealand?`);
  const place = town || region || 'New Zealand';
  out.push({ key: `brand:${slugify(b.name)}:about`, kind: 'brand', scope: 'brand', question: `What can you tell me about ${b.name} in ${place}, New Zealand?` });
  out.push({ key: `brand:${slugify(b.name)}:book`, kind: 'brand', scope: 'brand', question: `How do I book with ${b.name} in ${place}, New Zealand, and what does it cost?` });
  return out;
}
