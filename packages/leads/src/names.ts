/** Reading business names: words, trades, exclusions and how alike two names are. */

export type TradeGroup = 'food' | 'beauty' | 'cleaning' | 'trades' | 'auto' | 'care_fitness' | 'repair_retail';

export interface Dictionary {
  trades: Partial<Record<TradeGroup, string[]>>;
  exclusions: string[];
  noise: string[];
  franchises: string[];
}

const LEGAL = new Set(['llc', 'inc', 'incorporated', 'corp', 'corporation', 'co', 'company', 'ltd', 'limited', 'pllc', 'lc', 'llp', 'dba']);

/** Lower case, accents folded, apostrophes dropped, "&" read as "and", everything else a space. */
export function plainWords(name: string): string[] {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/l\.l\.c\.?/g, ' llc ')
    .replace(/['’‘`]/g, '')
    .replace(/&/g, ' and ')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** The words of a name without its legal suffixes, as one string. */
export function normaliseName(name: string): string {
  return plainWords(name)
    .filter((w) => !LEGAL.has(w))
    .join(' ');
}

/** Whether the name's words hold the phrase as whole words, a word also matching its plural. */
function holds(words: string[], phrase: string, longer = false): boolean {
  const parts = plainWords(phrase);
  if (!parts.length) return false;
  for (let i = 0; i + parts.length <= words.length; i++) {
    let ok = true;
    for (let j = 0; j < parts.length; j++) {
      const w = words[i + j]!;
      const p = parts[j]!;
      const last = j === parts.length - 1;
      if (w === p || (last && (w === `${p}s` || w === `${p}es`)) || (last && longer && w.startsWith(p))) continue;
      ok = false;
      break;
    }
    if (ok) return true;
  }
  return false;
}

export interface NameClass {
  trade: string | null;
  group: TradeGroup | null;
  /** Why the name is dropped, or null when it is kept. */
  drop: string | null;
}

/**
 * Franchise first, then exclusions, then noise, then the trade word. Noise words also match their
 * longer forms ("transport" catches "transportation"); exclusions match whole words and plurals only,
 * so "bar" never catches "barber".
 */
export function classifyName(name: string, dict: Dictionary): NameClass {
  const words = plainWords(name);
  let trade: string | null = null;
  let group: TradeGroup | null = null;
  // The longest phrase wins, so "food truck" is reported before "food".
  const all = Object.entries(dict.trades).flatMap(([g, list]) => (list ?? []).map((t) => ({ t, g: g as TradeGroup })));
  all.sort((a, b) => plainWords(b.t).length - plainWords(a.t).length);
  for (const { t, g } of all) {
    if (holds(words, t)) {
      trade = t;
      group = g;
      break;
    }
  }
  const franchise = dict.franchises.find((f) => holds(words, f));
  if (franchise) return { trade, group, drop: `franchise: ${franchise}` };
  const excluded = dict.exclusions.find((x) => holds(words, x));
  if (excluded) return { trade, group, drop: `excluded: ${excluded}` };
  const noise = dict.noise.find((x) => holds(words, x, true));
  if (noise) return { trade, group, drop: `noise: ${noise}` };
  if (!trade) return { trade: null, group: null, drop: 'no trade word' };
  return { trade, group, drop: null };
}

const FORMATION = /registered agent|agents,? inc|service center|entity protect|corporation agents|corporation service|ct corporation|legalzoom|zenbusiness|incorp services|cogency global|national registered agents|bizee|incfile|swyft filings|harbor compliance|business filings|inc authority|northwest registered/i;

/** The owner most likely filed the papers themselves unless the agent is a formation service. An empty agent tells us nothing. */
export function ownerIsAgent(agent: string): boolean {
  if (!agent.trim()) return false;
  return !FORMATION.test(agent);
}

/** Levenshtein distance with a substitution costing two, as the ratio below expects. */
function distance(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 2));
    prev = cur;
  }
  return prev[b.length]!;
}

function ratio(a: string, b: string): number {
  const total = a.length + b.length;
  return total === 0 ? 1 : (total - distance(a, b)) / total;
}

/**
 * Token set ratio, 0 to 1: the shared words compared with each name's whole set of words. A name
 * whose words all appear in the other scores 1.
 */
export function tokenSetRatio(a: string, b: string): number {
  const ta = new Set(normaliseName(a).split(' ').filter(Boolean));
  const tb = new Set(normaliseName(b).split(' ').filter(Boolean));
  const both = [...ta].filter((t) => tb.has(t)).sort();
  const onlyA = [...ta].filter((t) => !tb.has(t)).sort();
  const onlyB = [...tb].filter((t) => !ta.has(t)).sort();
  const t0 = both.join(' ');
  const t1 = [t0, onlyA.join(' ')].filter(Boolean).join(' ');
  const t2 = [t0, onlyB.join(' ')].filter(Boolean).join(' ');
  const scores = [ratio(t1, t2)];
  if (t0) scores.push(ratio(t0, t1), ratio(t0, t2));
  return Math.max(...scores);
}
