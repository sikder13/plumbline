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

/** The figures a speed sentence gives, or null when the sentence is about something else. */
export function speedIn(sentence: string): SpeedRun | null {
  const m = /^Mobile speed score (\d+) out of 100, main content after (\d+(?:\.\d+)?) s$/.exec(sentence.trim());
  return m ? { performance: Number(m[1]), lcpMs: Math.round(Number(m[2]) * 1000) } : null;
}

function place(url: string): string {
  try {
    const u = new URL(url);
    // The query is kept: on some sites it is all that tells one page from another.
    const path = `${u.pathname}${u.search}`;
    return path === '/' ? 'the homepage' : path;
  } catch {
    return url;
  }
}

const ABSENT = /No (meta description|main heading|structured data) on the (?:(\d+) )?example pages?(?:, nor on (\d+) of the (\d+) other pages we read)?\./g;

interface Example {
  url: string;
  title?: string;
  status?: number | null;
  missing?: boolean;
  unread?: boolean;
  linkedFrom?: { pageUrl: string; text?: string }[];
}

/**
 * A finding in the words it is put to the owner in. Most findings stand as they were measured.
 * Four kinds are restated: phone speed, which is given as the median of the last three runs and
 * not the newest one; the first phone screen, which is said to lack what was looked for and no
 * more; a phone link without its plus sign, which is said to fail from overseas and not to be
 * broken; and a sentence that came from Crawlmouse, which is said in terms of what we read ourselves.
 */
export function statedSentence(f: { checkId: string; title: string; detail: Record<string, unknown> }, runs: SpeedRun[]): string {
  const examples = (f.detail.examples as Example[] | undefined) ?? [];
  const measured = String(f.detail.measured ?? '');
  if (f.checkId === 'C20_slow_mobile') {
    const s = runs.length >= 2 ? steadySpeed(runs) : null;
    return s ? `Mobile speed score ${Math.round(s.performance)} out of 100, main content after ${(s.lcpMs / 1000).toFixed(1)} s` : f.title;
  }
  if (f.checkId === 'C13_no_action_above_fold') return 'The first phone screen has no button to book, call or email';
  if (f.checkId === 'C10_broken_contact_links' && f.detail.kind === 'tel' && /country code with no plus sign/.test(String(f.detail.problem ?? ''))) {
    // The number is right and the link dials at home. What was measured is that it cannot be dialled from abroad.
    const words = String(f.detail.linkText ?? '').trim();
    return `${words ? `The phone link behind "${words}"` : 'A phone link'} has no plus sign before its country code, so it will not dial from overseas`;
  }
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
    // Only a page that loads and that nothing links to is unlinked. One that is linked but missing belongs to another sentence.
    const unlinked = examples.filter((e) => !e.missing && !e.unread && !(e.status && e.status >= 400) && !e.linkedFrom?.length);
    if (!unlinked.length || !others) return f.title;
    const where = unlinked.map((e) => place(e.url));
    return `The page${where.length > 1 ? 's' : ''} at ${listed(where)} ${where.length > 1 ? 'are' : 'is'} not linked from any of the ${others} other pages we read`;
  }
  if (f.checkId === 'CM_leftover_page') {
    const e = examples[0];
    return e ? `The page at ${place(e.url)} is still live${e.title ? `, under the title "${e.title}"` : ''}` : f.title;
  }
  if (/^CM_no_/.test(f.checkId)) {
    const seen = [...measured.matchAll(ABSENT)];
    const counts = seen.filter((m) => m[4]).map((m) => ({ what: m[1]!, without: Number(m[2] ?? 1) + Number(m[3]), of: Number(m[2] ?? 1) + Number(m[4]) }));
    if (!counts.length) {
      // Where no other page was read, only the pages we did read are spoken of, and no count of anyone else's.
      if (!seen.length) return f.title;
      const read = Number(seen[0]![2] ?? 1);
      return `${read === 1 ? 'The one page we read has' : `The ${read} pages we read have`} no ${seen.map((m) => m[1]!).join(' and no ')}`;
    }
    const [first, ...rest] = counts;
    return [`${first!.without} of the ${first!.of} pages we read have no ${first!.what}`, ...rest.map((c) => `${c.without} of the ${c.of} have no ${c.what}`)].join(', and ');
  }
  return f.title;
}
