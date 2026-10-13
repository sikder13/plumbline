import type { Db } from '@plumbline/core';

export interface SpeedRun {
  performance: number;
  lcpMs: number;
}

const middle = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;

/** Phone speed as it stands over the last three runs: the median score and the median time, each on its own. */
export function steadySpeed(runs: SpeedRun[]): SpeedRun | null {
  const last = runs.slice(-3);
  if (!last.length) return null;
  return { performance: middle(last.map((r) => r.performance)), lcpMs: middle(last.map((r) => r.lcpMs)) };
}

/** Phone speed on each finished run of a batch, oldest first: the median of that run's own measurements. */
export function speedRuns(db: Db, businessId: number, batch: string): SpeedRun[] {
  const rows = db
    .prepare("SELECT o.value FROM observations o JOIN runs r ON r.id = o.run_id WHERE o.business_id = ? AND o.collector = 'lighthouse' AND r.batch = ? AND r.status = 'done' ORDER BY r.id")
    .all(businessId, batch) as { value: string }[];
  return rows.map((r) => (JSON.parse(r.value) as { mobile?: { median?: SpeedRun } | null }).mobile?.median).filter((m): m is SpeedRun => !!m && Number.isFinite(m.performance) && Number.isFinite(m.lcpMs));
}

const listed = (parts: string[]) => (parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : (parts[0] ?? ''));

/** The runs behind a speed sentence, for a reader who wants to see them all. */
export function speedSeen(runs: SpeedRun[]): string | null {
  const last = runs.slice(-3);
  if (last.length < 2) return null;
  return `Measured on ${last.length} separate runs. Scores: ${listed(last.map((r) => String(Math.round(r.performance))))} out of 100. Main content after ${listed(last.map((r) => `${(r.lcpMs / 1000).toFixed(1)} s`))}.`;
}

function place(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname === '/' ? 'the homepage' : u.pathname;
  } catch {
    return url;
  }
}

const ABSENT = /No (meta description|main heading|structured data) on the (?:(\d+) )?example pages?(?:, nor on (\d+) of the (\d+) other pages we read)?\./g;

interface Example {
  url: string;
  title?: string;
  linkedFrom?: { pageUrl: string; text?: string }[];
}

/**
 * A finding in the words it is put to the owner in. Most findings stand as they were measured.
 * Three kinds are restated: phone speed, which is given as the median of the last three runs and
 * not the newest one; the first phone screen, which is said to lack what was looked for and no
 * more; and a sentence that came from Crawlmouse, which is said in terms of what we read ourselves.
 */
export function statedSentence(f: { checkId: string; title: string; detail: Record<string, unknown> }, runs: SpeedRun[]): string {
  const examples = (f.detail.examples as Example[] | undefined) ?? [];
  const measured = String(f.detail.measured ?? '');
  if (f.checkId === 'C20_slow_mobile') {
    const s = runs.length >= 2 ? steadySpeed(runs) : null;
    return s ? `Mobile speed score ${Math.round(s.performance)} out of 100, main content after ${(s.lcpMs / 1000).toFixed(1)} s` : f.title;
  }
  if (f.checkId === 'C13_no_action_above_fold') return 'The first phone screen has no button to book, call or email';
  if (f.checkId === 'CM_missing_page') {
    const linked = examples.filter((e) => e.linkedFrom?.length);
    if (!linked.length) return f.title;
    const parts = linked.map((e) => {
      const from = e.linkedFrom![0]!;
      const words = (from.text ?? '').trim();
      return `${words ? `the link "${words}"` : 'a picture link'} on ${place(from.pageUrl)}`;
    });
    const [first, ...rest] = parts;
    const lead = `${first![0]!.toUpperCase()}${first!.slice(1)} leads to a missing page (404)`;
    return rest.length ? `${lead}, and so ${rest.length === 1 ? 'does' : 'do'} ${rest.join(' and ')}` : lead;
  }
  if (f.checkId === 'CM_orphan_page') {
    const others = /None of the (\d+) other pages we read/.exec(measured)?.[1];
    if (!examples.length || !others) return f.title;
    const where = examples.map((e) => place(e.url));
    return `The page${where.length > 1 ? 's' : ''} at ${where.join(' and ')} ${where.length > 1 ? 'are' : 'is'} not linked from any of the ${others} other pages we read`;
  }
  if (f.checkId === 'CM_leftover_page') {
    const e = examples[0];
    return e ? `The page at ${place(e.url)} is still live${e.title ? `, under the title "${e.title}"` : ''}` : f.title;
  }
  if (/^CM_no_/.test(f.checkId)) {
    const counts = [...measured.matchAll(ABSENT)].filter((m) => m[4]).map((m) => ({ what: m[1]!, without: Number(m[2] ?? 1) + Number(m[3]), of: Number(m[2] ?? 1) + Number(m[4]) }));
    if (!counts.length) return f.title;
    const [first, ...rest] = counts;
    return [`${first!.without} of the ${first!.of} pages we read have no ${first!.what}`, ...rest.map((c) => `${c.without} of the ${c.of} have no ${c.what}`)].join(', and ');
  }
  return f.title;
}
