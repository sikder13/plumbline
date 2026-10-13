import { foldName, slugify } from '@plumbline/core';
import { ownActivities, type HomepageWords } from './activities.ts';

export interface AiQuestion {
  key: string;
  kind: 'activity' | 'brand';
  scope: 'shared' | 'brand';
  question: string;
  /** The activity an activity question asks about, as the business's homepage shows it. */
  activity?: string;
}

export interface QuestionOptions {
  /** Activities a person has written down for this business, main one first. Each must be on the homepage to be asked about. */
  stated?: string[];
  brandQuestions?: number;
}

/** The parts of a stored place: "Ōkārito (near Franz Josef)" holds Ōkārito and Franz Josef. */
function placeParts(place: string | null): string[] {
  return (place ?? '')
    .split(/[(),/&]/)
    .map((p) => p.replace(/^\s*(?:near|south of|north of|east of|west of|just out of)\s+/i, '').trim())
    .filter(Boolean);
}

/** The place to ask about: the part of the town the homepage itself names, or else the town as stored. */
function placeFor(b: { town: string | null; region: string | null }, home: HomepageWords | null): string | null {
  const parts = placeParts(b.town).length ? placeParts(b.town) : placeParts(b.region);
  if (!parts.length) return null;
  const page = home ? ` ${foldName([home.title, home.description, ...home.headings, ...home.nav, home.text].join(' '))} ` : '';
  return parts.find((p) => page.includes(` ${foldName(p)} `)) ?? parts[0]!;
}

const article = (phrase: string) => (/^[aeio]/i.test(phrase) ? 'an' : 'a');

/**
 * The questions for one business. Each activity question asks who to book one of the business's
 * own activities with, in or near its own town, and is shared by every business with the same
 * activity in the same town. The activity comes from the business's homepage and never from the
 * stored category, which for a business found by search is only the search that found it. A
 * business whose homepage shows no activity gets no activity question. The two brand questions
 * are neutral questions about the business itself.
 */
export function questionsFor(b: { name: string; region: string | null; town: string | null; activity?: string | null }, home: HomepageWords | null, opts: QuestionOptions = {}): AiQuestion[] {
  const brandQuestions = opts.brandQuestions ?? 2;
  const place = placeFor(b, home);
  const out: AiQuestion[] = [];
  if (home && place) {
    for (const a of ownActivities(home, opts.stated).activities) {
      out.push({ key: `activity:${slugify(place)}:${slugify(a.phrase)}`, kind: 'activity', scope: 'shared', question: `Who should I book ${article(a.phrase)} ${a.phrase} with in or near ${place}, New Zealand? Name specific operators.`, activity: a.phrase });
    }
  }
  const where = place ? `${place}, New Zealand` : 'New Zealand';
  if (brandQuestions >= 1) out.push({ key: `brand:${slugify(b.name)}:about`, kind: 'brand', scope: 'brand', question: `What can you tell me about ${b.name} in ${where}?` });
  if (brandQuestions >= 2) out.push({ key: `brand:${slugify(b.name)}:book`, kind: 'brand', scope: 'brand', question: `How do I book with ${b.name} in ${where}, and what does it cost?` });
  return out;
}
