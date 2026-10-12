import { env } from '@plumbline/core';

export interface VisitRow {
  token: string;
  kind: string | null;
  visited_at: string;
}

export interface VisitSummary {
  token: string;
  firstView: string | null;
  lastView: string | null;
  views: number;
  findingsTab: boolean;
  replyOrCall: boolean;
}

/** One line per page from the raw rows. A row with no kind is a view: the kind column came later. */
export function summarise(tokens: string[], rows: VisitRow[]): VisitSummary[] {
  return tokens.map((token) => {
    const mine = rows.filter((r) => r.token === token);
    const views = mine.filter((r) => !r.kind || r.kind === 'view').map((r) => r.visited_at).sort();
    return { token, firstView: views[0] ?? null, lastView: views.at(-1) ?? null, views: views.length, findingsTab: mine.some((r) => r.kind === 'tab_findings'), replyOrCall: mine.some((r) => r.kind === 'cta_click') };
  });
}

/**
 * Reads the visit table for the given page tokens. The address and a key that can only read are in
 * .env as DEMO_VISITS_URL and DEMO_VISITS_READ_KEY. Neither is printed.
 */
export async function readVisits(tokens: string[], fetcher: typeof fetch = fetch): Promise<VisitRow[]> {
  const base = env().DEMO_VISITS_URL;
  const key = env().DEMO_VISITS_READ_KEY;
  if (!base || !key) throw new Error('DEMO_VISITS_URL and DEMO_VISITS_READ_KEY must be set in .env to read visits');
  if (!tokens.length) return [];
  const url = `${base.replace(/\/$/, '')}/rest/v1/dashboard_visits?select=*&token=in.(${tokens.map((t) => `"${t}"`).join(',')})&order=visited_at.asc&limit=10000`;
  const res = await fetcher(url, { headers: { apikey: key, authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`the visit table answered ${res.status}`);
  return ((await res.json()) as Record<string, unknown>[]).map((r) => ({ token: String(r.token), kind: typeof r.kind === 'string' ? r.kind : null, visited_at: String(r.visited_at) }));
}
