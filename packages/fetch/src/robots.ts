export interface RobotsRules {
  disallow: string[];
  allow: string[];
  crawlDelay?: number;
}

export interface ParsedRobots {
  sitemaps: string[];
  /** Keyed by lower-cased user agent token, with '*' for the wildcard group. */
  rules: Record<string, RobotsRules>;
}

export function parseRobotsTxt(text: string): ParsedRobots {
  const sitemaps: string[] = [];
  const rules: Record<string, RobotsRules> = {};
  let currentUas: string[] = [];
  let lastWasRule = false;

  // A leading BOM would otherwise hide the first user-agent line and drop its group.
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const directive = m[1]!.toLowerCase();
    const value = m[2]!.trim();

    if (directive === 'sitemap') {
      if (value) sitemaps.push(value);
    } else if (directive === 'user-agent') {
      // Consecutive user-agent lines share one group. One that follows a rule starts a new group.
      if (lastWasRule) currentUas = [];
      if (value) currentUas.push(value.toLowerCase());
      lastWasRule = false;
    } else if (directive === 'disallow' || directive === 'allow') {
      // Rules before any user-agent line go to '*'. An empty value restricts nothing.
      const uas = currentUas.length ? currentUas : ['*'];
      for (const ua of uas) {
        rules[ua] ??= { disallow: [], allow: [] };
        if (value) rules[ua][directive].push(value);
      }
      lastWasRule = true;
    } else if (directive === 'crawl-delay') {
      const uas = currentUas.length ? currentUas : ['*'];
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) {
        for (const ua of uas) {
          rules[ua] ??= { disallow: [], allow: [] };
          rules[ua].crawlDelay = n;
        }
      }
      lastWasRule = true;
    }
  }

  return { sitemaps, rules };
}

/**
 * Matches a rule against a path with the two wildcards RFC 9309 requires: `*`
 * for any sequence and a trailing `$` for the end. This is a linear walk, not a
 * translated regex, because robots.txt comes from the audited site and a regex
 * built from it can be made to backtrack without limit.
 */
function ruleMatches(rule: string, path: string): boolean {
  const anchored = rule.endsWith('$');
  const body = anchored ? rule.slice(0, -1) : rule;
  const segments = body.split('*');

  let pos = 0;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    if (seg === '') continue;
    const isFirst = i === 0;
    const isLast = i === segments.length - 1;
    if (isFirst) {
      if (!path.startsWith(seg)) return false;
      pos = seg.length;
    } else if (isLast && anchored) {
      if (path.length - seg.length < pos || !path.endsWith(seg)) return false;
      pos = path.length;
    } else {
      const idx = path.indexOf(seg, pos);
      if (idx === -1) return false;
      pos = idx + seg.length;
    }
  }

  if (anchored) return segments[segments.length - 1] === '' || pos === path.length;
  return true;
}

function matchSpecificity(rule: string, path: string): number | null {
  if (!ruleMatches(rule, path)) return null;
  return rule.replace(/\*/g, '').replace(/\$$/, '').length;
}

/** The group for a product token: an exact token match, otherwise the wildcard group. */
export function groupFor(robots: ParsedRobots, productToken: string): RobotsRules | undefined {
  return robots.rules[productToken.toLowerCase()] ?? robots.rules['*'];
}

export function hasOwnGroup(robots: ParsedRobots, productToken: string): boolean {
  return robots.rules[productToken.toLowerCase()] !== undefined;
}

export function getCrawlDelay(robots: ParsedRobots, productToken: string): number | undefined {
  return groupFor(robots, productToken)?.crawlDelay;
}

/** Longest matching rule wins, and Allow wins a tie (RFC 9309). */
export function isAllowedByRobots(robots: ParsedRobots, productToken: string, path: string): boolean {
  if (path === '/robots.txt') return true;
  const r = groupFor(robots, productToken);
  if (!r) return true;

  let best: { isAllow: boolean; len: number } | null = null;
  for (const rule of r.disallow) {
    const len = matchSpecificity(rule, path);
    if (len !== null && (!best || len > best.len)) best = { isAllow: false, len };
  }
  for (const rule of r.allow) {
    const len = matchSpecificity(rule, path);
    if (len !== null && (!best || len >= best.len)) best = { isAllow: true, len };
  }
  return best ? best.isAllow : true;
}

export type RobotsOutcome =
  | { kind: 'rules'; robots: ParsedRobots }
  | { kind: 'allow_all'; reason: string }
  | { kind: 'disallow_all'; reason: string };

/** RFC 9309 section 2.3.1: 4xx means no restrictions, 5xx or unreachable means assume full disallow. */
export function outcomeFromResponse(status: number | null, body: string): RobotsOutcome {
  if (status === null) return { kind: 'disallow_all', reason: 'robots.txt unreachable' };
  if (status >= 200 && status < 300) return { kind: 'rules', robots: parseRobotsTxt(body) };
  if (status >= 400 && status < 500) return { kind: 'allow_all', reason: `robots.txt returned ${status}` };
  if (status >= 500) return { kind: 'disallow_all', reason: `robots.txt returned ${status}` };
  return { kind: 'allow_all', reason: `robots.txt returned ${status}` };
}

export function outcomeAllows(outcome: RobotsOutcome, productToken: string, url: string): boolean {
  if (outcome.kind === 'allow_all') return true;
  if (outcome.kind === 'disallow_all') return false;
  try {
    const { pathname, search } = new URL(url);
    return isAllowedByRobots(outcome.robots, productToken, pathname + search);
  } catch {
    return false;
  }
}
