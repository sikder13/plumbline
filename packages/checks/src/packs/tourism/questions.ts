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
 * The questions for one business. The area, town and landmark questions are what a visitor would
 * ask about the place, and every business in the same place and activity shares them. The two
 * brand questions are neutral questions about the business itself.
 */
export function questionsFor(b: { name: string; region: string | null; town: string | null; activity: string | null; landmark?: string | null }, brandQuestions = 2): AiQuestion[] {
  const act = activityPhrase(b.activity);
  const out: AiQuestion[] = [];
  const shared = (kind: AiQuestion['kind'], place: string, question: string) => out.push({ key: `${kind}:${slugify(place)}:${slugify(act)}`, kind, scope: 'shared', question });
  const region = b.region?.replace(/\s*\(.*\)$/, '').split(/[&/]/)[0]!.trim();
  const town = b.town?.replace(/\s*\(.*\)$/, '').split(/[,/]/)[0]!.trim();
  if (region) shared('area', region, `What are the best ${act}s in ${region}, New Zealand? Name the specific local operators you would recommend.`);
  if (town && foldName(town) !== foldName(region ?? '')) shared('town', town, `Who should I book a ${act} with in or near ${town}, New Zealand? Name specific operators.`);
  if (b.landmark) shared('landmark', b.landmark, `Which operators run a ${act} at ${b.landmark}, New Zealand?`);
  const place = town || region || 'New Zealand';
  if (brandQuestions >= 1) out.push({ key: `brand:${slugify(b.name)}:about`, kind: 'brand', scope: 'brand', question: `What can you tell me about ${b.name} in ${place}, New Zealand?` });
  if (brandQuestions >= 2) out.push({ key: `brand:${slugify(b.name)}:book`, kind: 'brand', scope: 'brand', question: `How do I book with ${b.name} in ${place}, New Zealand, and what does it cost?` });
  return out;
}
