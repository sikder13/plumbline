import { foldName } from '@plumbline/core';
import type { PageCapture } from '@plumbline/render';

/**
 * What a business does, read from its own homepage. The search category that found a business
 * says what we were looking for, not what the business offers, so it is never used here.
 */

/** The places on a homepage where a business says what it is. */
export interface HomepageWords {
  title: string;
  description: string;
  headings: string[];
  nav: string[];
  /** Everything a visitor can read on the page. */
  text: string;
}

export function homepageWords(page: Pick<PageCapture, 'meta' | 'blocks' | 'links' | 'text'>): HomepageWords {
  const unique = (list: string[]) => {
    const seen = new Set<string>();
    return list.map((s) => s.replace(/\s+/g, ' ').trim()).filter((s) => s && !seen.has(foldName(s)) && !!seen.add(foldName(s)));
  };
  return {
    title: page.meta.title ?? '',
    description: page.meta.description ?? '',
    headings: unique([...page.meta.h1, ...page.blocks.filter((b) => b.heading && !b.inFooter).map((b) => b.text)]),
    nav: unique([...page.blocks.filter((b) => b.inNav).map((b) => b.text), ...page.links.filter((l) => l.inNav && l.visible).map((l) => l.text)]).filter((s) => s.length <= 60),
    text: page.text,
  };
}

interface Kind {
  /** How a visitor would say it: "Who should I book a <phrase> with". */
  phrase: string;
  /** Kinds in one family are ways of saying one activity, so a business gets a question for only one of them. */
  family: string;
  shows: RegExp;
  /** A broad word for touring. Used only when the homepage names nothing more exact. */
  general: boolean;
}

const TRIP = 'tours?|trips?|adventures?|experiences?|excursions?';
const DAYS = 'two|three|four|five|2|3|4|5|multi';
const A = '(?:a |an |our |your |the )?';

/**
 * Patterns are written for text already folded to plain lower case words. Word order matters:
 * "boat tours and kayak hire" offers kayak hire, not kayak tours, so the thing comes first and
 * what is done with it after, with at most `gap` words between. The other order is spelt out
 * only where people really write it ("tours by kayak", "hire a kayak").
 */
const then = (first: string, second: string, gap = 2) => `\\b(?:${first})(?: \\w+){0,${gap}} (?:${second})\\b`;
const words = (source: string) => `\\b(?:${source})\\b`;
const either = (...sources: string[]) => sources.join('|');
const kind = (phrase: string, family: string, source: string, general = false): Kind => ({ phrase, family, shows: new RegExp(source, 'g'), general });

/** Exact activities first, broad words for touring last. */
const KINDS: Kind[] = [
  kind('penguin tour', 'wildlife', then('penguins?', 'tours?|colony|encounters?|experiences?')),
  kind('whale watching tour', 'wildlife', words('whale watch(?:ing)?')),
  kind('dolphin tour', 'wildlife', either(then('dolphins?', 'tours?|cruises?|swim(?:s|ming)?|encounters?|watching', 1), words('swim(?:ming)? with (?:the )?dolphins'))),
  kind('bird watching tour', 'wildlife', either(words('bird ?watch(?:ing|ers?)?|birding'), then('birds?|birdlife', 'tours?|walks?', 1))),
  kind('wildlife tour', 'wildlife', then('wildlife', 'tours?|cruises?|encounters?|experiences?', 1)),
  kind('glowworm tour', 'glowworm', words('glow ?worms?')),
  kind('stargazing tour', 'stargazing', words('star ?gazing|astronomy tours?|night sky tours?')),
  kind('kayak tour', 'kayak tour', either(then('(?:sea )?kayak(?:s|ing)?', TRIP), words('guided (?:sea )?kayak(?:s|ing)?'), words(`(?:tours?|trips?) by (?:sea )?kayak`))),
  kind('kayak hire', 'kayak hire', either(then('kayaks?|kayaking', 'hire|rentals?'), words(`(?:hire|rent) ${A}(?:sea )?kayaks?`), words('freedom kayak(?:s|ing)?'))),
  kind('guided fly fishing trip', 'fishing', words('fly ?fishing|fishing guides?|guided (?:trout )?fishing')),
  kind('fishing charter', 'fishing', either(then('fishing|fish', 'charters?'), words('fishing trips?|charter fishing'))),
  kind('sailing trip', 'sailing', either(then('sailing|sail', `${TRIP}|charters?|cruises?|catamaran`, 3), words('scenic sailing|day sail(?:s|ing)?'))),
  kind('harbour cruise', 'cruise', either(then('harbour', 'cruises?'), words('cruises? (?:of|on|around) (?:the )?(?:\\w+ )?harbour'))),
  kind('lake cruise', 'cruise', either(then('lake', 'cruises?', 3), words('cruises? (?:of|on|around) (?:the )?(?:\\w+ )?lake'))),
  kind('boat cruise', 'cruise', words('(?:boat|scenic|sightseeing|sunset|dinner|lunch(?:time)?|eco) cruises?')),
  kind('boat tour', 'cruise', '(?<!\\bjet )\\bboat(?: \\w+){0,1} (?:tours?|trips?)\\b'),
  kind('jet boat ride', 'jet boat', words('jet ?boat(?:s|ing)?')),
  kind('snorkelling trip', 'snorkelling', words('snorkell?ing')),
  kind('dive trip', 'diving', either(words('scuba'), then('dive|diving', 'trips?|charters?|tours?', 1))),
  kind('rafting trip', 'rafting', words('rafting')),
  kind('surf lesson', 'surfing', words('surf(?:ing)? (?:lessons?|school)')),
  kind('horse trek', 'horse', either(then('horses?|horseback', 'treks?|trekking|riding|rides?', 3), words('horse ?back riding|(?:treks?|rides?) on horse ?back'))),
  kind('multi-day walk', 'walk', words(`(?:${DAYS}) day (?:\\w+ ){0,2}(?:walks?|hikes?|tramps?)`)),
  kind('guided walk', 'walk', words('guided (?:\\w+ ){0,1}(?:walks?|hikes?|hiking|walking)|(?:walking|hiking) tours?')),
  kind('bike hire', 'bike hire', either(then('e ?bikes?|bikes?|bicycles?|cycles?', 'hire|rentals?'), words(`(?:hire|rent) ${A}(?:e ?)?(?:bikes?|bicycles?)`))),
  kind('bike tour', 'bike tour', then('bike|biking|cycle|cycling', 'tours?')),
  kind('wine tour', 'wine tour', words('wine(?:ry)? tours?|vineyard tours?|wine tasting tours?|wine trail')),
  kind('cellar door wine tasting', 'cellar door', either(words('cellar door|tasting room'), '\\bwine tastings?\\b(?! tours?\\b)', then('tastings?', 'wines?', 3))),
  // A winery with a restaurant is written both ways round: "winery and restaurant", "restaurant at the vineyard".
  kind('winery lunch', 'winery lunch', either(then('winery|vineyard|cellar door', 'restaurant|lunch(?:es)?|bistro|dining', 6), then('restaurant|lunch(?:es)?|bistro|dining', 'winery|vineyard|cellar door', 6))),
  kind('food tour', 'food tour', words('food(?:ie)? tours?')),
  kind('scenic flight', 'flight', words('scenic flights?|heli(?:copter)? (?:tours?|flights?)')),
  kind('guided hunting trip', 'hunting', words('guided hunt(?:s|ing)?|hunting (?:trips?|safaris?|guides?)')),
  kind('cultural tour', 'culture', words('cultural (?:tours?|experiences?)')),
  kind('4WD tour', 'tour', words('(?:4wd|4x4|four wheel drive) (?:\\w+ ){0,1}tours?'), true),
  kind('private tour', 'tour', words('private (?:\\w+ ){0,2}tours?'), true),
  kind('small group tour', 'tour', words('small group (?:\\w+ ){0,3}tours?'), true),
  kind('scenic tour', 'tour', words('scenic (?:\\w+ ){0,1}tours?|sightseeing tours?'), true),
  kind('eco tour', 'tour', words('eco ?tours?'), true),
  kind('guided tour', 'tour', words('guided (?:\\w+ ){0,2}tours?'), true),
  kind('day tour', 'tour', words('day tours?'), true),
];

export interface OwnActivity {
  phrase: string;
  /** The business's own words that show it. */
  quote: string;
  /** How strongly the homepage shows it. Nought for an activity stated by a person. */
  weight: number;
}

interface Shown extends OwnActivity {
  family: string;
  general: boolean;
  /** Named in the title, description, a heading or the menu, where a business says what it is. */
  named: boolean;
  mentions: number;
  /** How early the business names it. Activities shown equally strongly are taken in the order the business gives them. */
  at: number;
}

const WEIGHT = { title: 8, description: 6, heading: 5, nav: 4, mention: 1, mentionsCounted: 4 };
/** An activity the page only mentions in passing needs this many mentions to count. */
const MENTIONS_NEEDED = 3;

function sentences(text: string): string[] {
  return text.split(/[\n.!?]+/).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

const clip = (s: string) => (s.length > 160 ? `${s.slice(0, 157).trim()}...` : s);

function has(re: RegExp, text: string): boolean {
  re.lastIndex = 0;
  return re.test(foldName(text));
}

function shownBy(home: HomepageWords): Shown[] {
  const body = sentences(home.text);
  const said = foldName([home.title, home.description, ...home.headings, ...home.nav].join(' | '));
  const out: Shown[] = [];
  for (const k of KINDS) {
    const heading = home.headings.find((h) => has(k.shows, h));
    const nav = home.nav.find((n) => has(k.shows, n));
    const inTitle = has(k.shows, home.title);
    const inDescription = has(k.shows, home.description);
    const mentions = (foldName(home.text).match(k.shows) ?? []).length;
    const weight = (inTitle ? WEIGHT.title : 0) + (inDescription ? WEIGHT.description : 0) + (heading ? WEIGHT.heading : 0) + (nav ? WEIGHT.nav : 0) + Math.min(mentions, WEIGHT.mentionsCounted) * WEIGHT.mention;
    if (!weight) continue;
    const quote = (inTitle && home.title) || (inDescription && home.description) || heading || nav || body.find((s) => has(k.shows, s)) || '';
    k.shows.lastIndex = 0;
    const at = said.search(k.shows);
    out.push({ phrase: k.phrase, family: k.family, general: k.general, quote: clip(quote), weight, named: inTitle || inDescription || !!heading || !!nav, mentions, at: at < 0 ? Infinity : at });
  }
  // Equal showings: two ways of saying one activity are taken exact one first (the list's order), two activities in the order the business gives them.
  const order = new Map(KINDS.map((k, i) => [k.phrase, i]));
  return out.sort((a, b) => b.weight - a.weight || (a.family === b.family ? order.get(a.phrase)! - order.get(b.phrase)! : a.at - b.at));
}

/** Every activity the homepage shows, strongest first. */
export function activitiesShown(home: HomepageWords): OwnActivity[] {
  return shownBy(home).map(({ phrase, quote, weight }) => ({ phrase, quote, weight }));
}

const SMALL_WORDS = new Set(['and', 'the', 'for', 'with', 'from', 'our', 'your']);

/** A word matches its plural and its "-ing" form: tour and tours, cruise and cruising. */
function stem(word: string): string {
  const s = word.replace(/(?:ing|es|s|e)$/, '');
  return s.length >= 4 ? s : word;
}

/**
 * Whether the homepage shows an activity, by the same measure whoever names it: it is named where
 * the business says what it is (title, description, a heading or the menu), or the page mentions
 * it again and again. One passing mention is not enough: a tour that stops at a cellar door is not
 * a cellar door. Returns the business's own words that show it, or null. An activity outside the
 * list above is shown when one of those places uses every word of it.
 */
export function confirmsActivity(home: HomepageWords, phrase: string): string | null {
  if (KINDS.some((k) => foldName(k.phrase) === foldName(phrase))) {
    const known = shownBy(home).find((a) => foldName(a.phrase) === foldName(phrase));
    return known && (known.named || known.mentions >= MENTIONS_NEEDED) ? known.quote : null;
  }
  const wanted = foldName(phrase).split(' ').filter((w) => w.length >= 3 && !SMALL_WORDS.has(w)).map(stem);
  if (!wanted.length) return null;
  const tokens = (s: string) => foldName(s).split(' ');
  const place = [home.title, home.description, ...home.headings, ...home.nav].filter(Boolean).find((s) => wanted.every((w) => tokens(s).some((t) => t.startsWith(w))));
  return place ? clip(place) : null;
}

export interface OwnActivities {
  /** One or two activities, the main one first. Each is shown on the homepage. */
  activities: OwnActivity[];
  /** Stated activities the homepage does not show. No question is asked about these. */
  unconfirmed: string[];
}

/**
 * The activities to ask about. Activities a person has stated for the business are used in the
 * order given, each only if the homepage shows it. Without any, they are read from the homepage:
 * the activity it shows most strongly, and a second one when the page names that clearly too.
 */
export function ownActivities(home: HomepageWords, stated: string[] = []): OwnActivities {
  if (stated.length) {
    const activities: OwnActivity[] = [];
    const unconfirmed: string[] = [];
    for (const phrase of stated.map((s) => s.trim()).filter(Boolean)) {
      const quote = confirmsActivity(home, phrase);
      if (quote === null) unconfirmed.push(phrase);
      else if (activities.length < 2) activities.push({ phrase, quote, weight: 0 });
    }
    return { activities, unconfirmed };
  }
  const eligible = shownBy(home).filter((a) => a.named || a.mentions >= MENTIONS_NEEDED);
  const pool = eligible.some((a) => a.named && !a.general) ? eligible.filter((a) => !a.general) : eligible;
  const main = pool[0];
  if (!main) return { activities: [], unconfirmed: [] };
  const second = pool.find((a) => a.family !== main.family && a.named && a.weight >= main.weight / 2);
  return { activities: [main, ...(second ? [second] : [])].map(({ phrase, quote, weight }) => ({ phrase, quote, weight })), unconfirmed: [] };
}
