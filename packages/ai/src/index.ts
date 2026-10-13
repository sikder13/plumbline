import pLimit from 'p-limit';
import { domainOf, env, foldName, requireEnv, utcDay, utcIso, type Business, type Db } from '@plumbline/core';
import { BudgetStop, guard, loadPrices, record, tokenCost, type GuardOptions, type Prices } from '@plumbline/budget';
import { ownActivities, questionsFor, type AiQuestion, type AiSummary, type HomepageWords } from '@plumbline/checks';

export type ProviderName = 'openai' | 'perplexity';

export interface Citation {
  url: string;
  title: string;
}

export interface Answer {
  text: string;
  citations: Citation[];
  model: string;
  usage: Record<string, unknown>;
  /** Cost worked out from the counts the provider reported. */
  costUsd: number;
}

export type Ask = (question: string) => Promise<Answer>;

const INSTRUCTIONS = 'Answer as you would for a traveller planning a trip. Search the web. Name specific businesses where the question asks for them. Keep the answer under 250 words.';

export function parseOpenAi(data: Record<string, unknown>, model: string, prices: Prices): Answer {
  const output = (data.output ?? []) as { type: string; action?: { type?: string }; content?: { type: string; text?: string; annotations?: { type: string; url?: string; title?: string }[] }[] }[];
  const parts = output.filter((o) => o.type === 'message').flatMap((o) => o.content ?? []).filter((c) => c.type === 'output_text');
  const text = parts.map((c) => c.text ?? '').join('\n').trim();
  const citations: Citation[] = [];
  for (const c of parts) for (const a of c.annotations ?? []) if (a.type === 'url_citation' && a.url && !citations.some((x) => x.url === a.url)) citations.push({ url: a.url, title: a.title ?? '' });
  const searches = output.filter((o) => o.type === 'web_search_call' && (o.action?.type ?? 'search') === 'search').length;
  const u = (data.usage ?? {}) as { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number } };
  const usage = { input_tokens: u.input_tokens ?? 0, cached_tokens: u.input_tokens_details?.cached_tokens ?? 0, output_tokens: u.output_tokens ?? 0, web_search_calls: searches };
  const costUsd = tokenCost(prices, 'openai', model, { inputTokens: usage.input_tokens, cachedInputTokens: usage.cached_tokens, outputTokens: usage.output_tokens, webSearchCalls: searches });
  return { text, citations, model, usage, costUsd };
}

/** OpenAI Responses API with the web_search tool. Citations arrive as url_citation annotations. */
export function openAiAsk(prices: Prices = loadPrices()): Ask {
  const model = requireEnv('OPENAI_MODEL');
  const key = requireEnv('OPENAI_API_KEY');
  // Each search is billed, and the model runs several unless told otherwise. This caps them per answer.
  const maxSearches = Number(env().OPENAI_MAX_SEARCHES ?? '') || 0;
  return async (question) => {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(120_000),
      body: JSON.stringify({ model, input: question, instructions: INSTRUCTIONS, tools: [{ type: 'web_search', search_context_size: 'low' }], reasoning: { effort: 'low' }, max_output_tokens: 2500, ...(maxSearches ? { max_tool_calls: maxSearches } : {}) }),
    });
    if (!res.ok) throw new Error(`OpenAI returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return parseOpenAi((await res.json()) as Record<string, unknown>, model, prices);
  };
}

export function parsePerplexity(data: Record<string, unknown>, model: string, prices: Prices): Answer {
  const output = (data.output ?? []) as { type: string; results?: { url?: string; title?: string }[]; contents?: { url?: string; title?: string }[]; content?: { type: string; text?: string; annotations?: { type?: string; url?: string; title?: string }[] }[] }[];
  const parts = output.filter((o) => o.type === 'message').flatMap((o) => o.content ?? []).filter((c) => c.type === 'output_text');
  const text = parts.map((c) => c.text ?? '').join('\n').trim();
  const citations: Citation[] = [];
  const add = (url?: string, title?: string) => {
    if (url && !citations.some((x) => x.url === url)) citations.push({ url, title: title ?? '' });
  };
  for (const o of output) {
    if (o.type === 'search_results') for (const r of o.results ?? []) add(r.url, r.title);
    if (o.type === 'fetch_url_results') for (const r of o.contents ?? []) add(r.url, r.title);
  }
  for (const c of parts) for (const a of c.annotations ?? []) add(a.url, a.title);
  const u = (data.usage ?? {}) as { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number }; tool_calls_details?: Record<string, { invocation?: number }>; cost?: { total_cost?: number } };
  const searches = u.tool_calls_details?.search_web?.invocation ?? u.tool_calls_details?.web_search?.invocation ?? 0;
  const fetches = u.tool_calls_details?.fetch_url?.invocation ?? 0;
  const usage = { input_tokens: u.input_tokens ?? 0, cached_tokens: u.input_tokens_details?.cached_tokens ?? 0, output_tokens: u.output_tokens ?? 0, web_search_calls: searches, fetch_url_calls: fetches, reported_cost: u.cost?.total_cost ?? null };
  const computed = tokenCost(prices, 'perplexity', model, { inputTokens: usage.input_tokens, cachedInputTokens: usage.cached_tokens, outputTokens: usage.output_tokens, webSearchCalls: searches, fetchUrlCalls: fetches });
  // The provider's own figure is the bill. The computed one stands in only when none is reported.
  return { text, citations, model, usage, costUsd: typeof u.cost?.total_cost === 'number' ? u.cost.total_cost : computed };
}

/** Perplexity Agent API. Search results come back as their own output item. */
export function perplexityAsk(prices: Prices = loadPrices()): Ask {
  const model = requireEnv('PERPLEXITY_MODEL');
  const key = requireEnv('PERPLEXITY_API_KEY');
  return async (question) => {
    const res = await fetch('https://api.perplexity.ai/v1/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(120_000),
      body: JSON.stringify({ model, input: question, instructions: INSTRUCTIONS, tools: [{ type: 'web_search' }], max_output_tokens: 1200 }),
    });
    if (!res.ok) throw new Error(`Perplexity returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return parsePerplexity((await res.json()) as Record<string, unknown>, model, prices);
  };
}

const GENERIC_NAME_WORDS = new Set(['the', 'and', 'of', 'nz', 'new', 'zealand', 'ltd', 'limited', 'company', 'co', 'tours', 'tour', 'charters', 'charter', 'adventures', 'adventure', 'experiences', 'experience', 'cruises', 'cruise', 'guided', 'guiding', 'trips', 'eco', 'scenic']);

/** The name as people say it: no brackets, no trailing "Ltd" or "Tours". */
export function coreName(name: string): string[] {
  const words = foldName(name.replace(/\(.*?\)/g, ' ')).split(' ').filter(Boolean);
  let end = words.length;
  while (end > 1 && GENERIC_NAME_WORDS.has(words[end - 1]!)) end -= 1;
  let start = 0;
  while (start < end - 1 && words[start] === 'the') start += 1;
  return words.slice(start, end);
}

export interface NameMatch {
  named: boolean;
  by: 'name' | 'domain' | 'citation' | null;
}

const PLACE_WORDS = new Set(['northland', 'auckland', 'coromandel', 'waikato', 'rotorua', 'taupo', 'wellington', 'nelson', 'tasman', 'marlborough', 'kaikoura', 'canterbury', 'mackenzie', 'otago', 'queenstown', 'wanaka', 'fiordland', 'southland', 'christchurch', 'dunedin', 'hokitika', 'glenorchy', 'cathedral', 'aotearoa', 'peninsula', 'hawkes', 'plenty', 'islands', 'southern', 'northern', 'adventure', 'adventures', 'wilderness', 'discovery', 'experience', 'mountain', 'national', 'original', 'ultimate', 'paradise', 'heritage', 'vineyard', 'vineyards', 'fishing', 'kayaking', 'kayakers', 'charters', 'cruising', 'wildlife', 'stargazing', 'trekking', 'outdoors']);

const COMMON_PLACE_PARTS = ['bay', 'of', 'islands', 'island', 'lake', 'lakes', 'coast', 'sound', 'sounds', 'harbour', 'north', 'south', 'east', 'west', 'mt', 'mount', 'the', 'new', 'zealand', 'nz', 'central', 'great', 'golden', 'abel', 'milford', 'doubtful', 'franz', 'josef', 'fox', 'glacier', 'stewart', 'banks', 'cook', 'strait', 'te', 'anau', 'waitomo', 'paihia', 'russell', 'picton', 'blenheim', 'napier', 'hastings', 'tauranga', 'whitianga', 'hahei', 'raglan', 'hamilton', 'tekapo', 'twizel', 'akaroa', 'oamaru', 'invercargill', 'bluff', 'catlins', 'hokianga', 'kerikeri', 'whangarei', 'matakana', 'waiheke', 'martinborough', 'wairarapa', 'kapiti', 'motueka', 'kaiteriteri', 'marahau', 'takaka', 'hanmer', 'arrowtown', 'cromwell', 'alexandra', 'glenorchy'];

/** Whether an answer names a business: by its name in the text, or by its domain in the text or citations. */
export function isNamed(business: { name: string; domain: string | null; town?: string | null; region?: string | null }, text: string, citations: Citation[]): NameMatch {
  const folded = ` ${foldName(text)} `;
  const full = foldName(business.name.replace(/\(.*?\)/g, ' '));
  if (full && folded.includes(` ${full} `)) return { named: true, by: 'name' };
  const places = new Set([...PLACE_WORDS, ...COMMON_PLACE_PARTS, ...foldName(`${business.town ?? ''} ${business.region ?? ''}`).split(' ')]);
  const core = coreName(business.name);
  // A name made only of place and trade words ("Bay of Islands Tours") must appear whole, less any "Ltd".
  const distinctive = core.filter((w) => !GENERIC_NAME_WORDS.has(w) && !places.has(w));
  const withoutSuffix = full.replace(/ (ltd|limited|nz|new zealand)$/g, '');
  if (withoutSuffix && withoutSuffix !== full && folded.includes(` ${withoutSuffix} `)) return { named: true, by: 'name' };
  if (distinctive.length) {
    // Two or more words must appear together. A single word must be long.
    if (core.length >= 2 && folded.includes(` ${core.join(' ')} `)) return { named: true, by: 'name' };
    if (core.length === 1 && core[0]!.length >= 7 && folded.includes(` ${core[0]} `)) return { named: true, by: 'name' };
    // People shorten a long name to its first word. That counts when the word is unusual and is not a place.
    const lead = core[0] ?? '';
    if (core.length >= 2 && lead.length >= 8 && distinctive.includes(lead) && folded.includes(` ${lead} `)) return { named: true, by: 'name' };
  }
  if (business.domain) {
    const d = business.domain.toLowerCase();
    if (text.toLowerCase().includes(d)) return { named: true, by: 'domain' };
    if (citations.some((c) => domainOf(c.url) === d)) return { named: true, by: 'citation' };
  }
  return { named: false, by: null };
}

const NOT_A_BUSINESS = /^(best|top|why|what|when|where|how|tips?|note|summary|overview|options?|price|prices|cost|duration|location|highlights?|pros|cons|key|quick|book|booking|contact|website|phone|address|recommended|recommendation|other|also|for|if|in|near|about|types?|things|good|great|popular|local|family|budget|luxury|half|full|day|morning|evening|sunset|private|guided|self|new zealand|north island|south island)\b/i;

/** Names an answer puts forward as businesses: bold text and the head of list items. */
export function namedCandidates(text: string): string[] {
  const out = new Map<string, string>();
  const add = (raw: string) => {
    const name = raw.split(/\s+[—–|]\s+/)[0]!.replace(/\[[^\]]*\]\([^)]*\)/g, (m) => m.slice(1, m.indexOf(']'))).replace(/\[(?:web:)?\d+\]/g, '').replace(/[*_`]+/g, '').replace(/\s+/g, ' ').replace(/[:.,;–—-]+$/, '').trim();
    if (name.length < 4 || name.length > 60 || name.split(' ').length > 8) return;
    if (!/^[A-ZĀĒĪŌŪ0-9]/.test(name) || NOT_A_BUSINESS.test(name)) return;
    if (!/[a-z]/.test(name) || /[?!]$/.test(name)) return;
    const key = foldName(name);
    if (key && !out.has(key)) out.set(key, name);
  };
  for (const m of text.matchAll(/\*\*([^*\n]{3,80})\*\*/g)) add(m[1]!);
  for (const m of text.matchAll(/^\s*(?:[-*•]|\d+[.)])\s+(?:\*\*)?([A-ZĀĒĪŌŪ][^:\n–—(]{2,60}?)(?:\*\*)?\s*(?:[:–—(]|\s-\s)/gm)) add(m[1]!);
  for (const m of text.matchAll(/^#{2,4}\s+(?:\d+[.)]\s*)?([^\n]{3,70})$/gm)) add(m[1]!);
  return [...out.values()];
}

export interface PlanItem {
  question: AiQuestion;
  businessIds: number[];
}

export interface AiPlan {
  businesses: number;
  items: PlanItem[];
  shared: number;
  brand: number;
  callsPerProvider: number;
  cached: number;
  toRun: { provider: ProviderName; key: string; question: string; scope: AiQuestion['scope']; businessId: number | null; runIndex: number }[];
  estimateUsd: Record<ProviderName, number>;
  totalUsd: number;
  perCall: Record<ProviderName, number>;
}

/** A business that gets no activity question, or fewer than were stated for it, and why. */
export interface Unasked {
  businessId: number;
  slug: string;
  reason: string;
}

export interface BatchPlan extends AiPlan {
  unasked: Unasked[];
}

export interface PlanOptions {
  /** What the business's homepage says, from its newest stored capture, or null when none has been read. */
  homepage: (b: Business) => HomepageWords | null;
  /** Activities a person has written down for the business, main one first. */
  stated?: (b: Business) => string[];
  runs?: number;
  brandQuestions?: number;
  providers?: ProviderName[];
  day?: string;
  /** Businesses the AI run covers. The caller passes only those that passed contacts and consent. */
  businesses: Business[];
  batch: string;
  /**
   * Pass 1 asks each question once. Pass 2, at least 60 minutes later, asks it the remaining times.
   * Two passes are what let a finding built on these answers count as reproduced.
   */
  pass?: 1 | 2;
}

/** Per-call estimates: what past calls to the provider actually cost, with a margin, or a default before any exist. */
export function perCallEstimate(db: Db, prices: Prices): Record<ProviderName, number> {
  const avg = (provider: ProviderName) => (db.prepare("SELECT AVG(actual_usd) AS a, COUNT(*) AS n FROM ledger WHERE provider = ? AND operation = 'ai_answer' AND actual_usd IS NOT NULL").get(provider) as { a: number | null; n: number });
  const o = avg('openai');
  const p = avg('perplexity');
  const openaiModel = env().OPENAI_MODEL ?? '';
  const pplxModel = env().PERPLEXITY_MODEL ?? '';
  const openaiDefault = openaiModel && prices.providers.openai.models[openaiModel] ? tokenCost(prices, 'openai', openaiModel, { inputTokens: 9000, outputTokens: 1200, webSearchCalls: 2 }) : 0.025;
  const pplxDefault = pplxModel && prices.providers.perplexity.models[pplxModel] ? tokenCost(prices, 'perplexity', pplxModel, { inputTokens: 5000, outputTokens: 500, webSearchCalls: 1 }) : 0.006;
  return { openai: o.n >= 5 && o.a ? o.a * 1.15 : openaiDefault, perplexity: p.n >= 5 && p.a ? p.a * 1.15 : pplxDefault };
}

export function plan(db: Db, opts: PlanOptions): BatchPlan {
  const runs = opts.runs ?? 3;
  const providers = opts.providers ?? ['openai', 'perplexity'];
  const day = opts.day ?? utcDay();
  const byKey = new Map<string, PlanItem>();
  const unasked: Unasked[] = [];
  const clear = db.prepare('DELETE FROM ai_question_links WHERE batch = ? AND business_id = ?');
  const link = db.prepare('INSERT OR REPLACE INTO ai_question_links (business_id, batch, question_key, kind) VALUES (?, ?, ?, ?)');
  db.transaction(() => {
    for (const b of opts.businesses) {
      // Only the businesses asked about are touched, so a run for a few leaves the rest of the batch as it was.
      clear.run(opts.batch, b.id);
      const home = opts.homepage(b);
      const stated = opts.stated?.(b) ?? [];
      const questions = questionsFor(b, home, { stated, brandQuestions: opts.brandQuestions ?? 2 });
      const refused = home ? ownActivities(home, stated).unconfirmed : [];
      const why = !home ? 'no homepage has been read' : refused.length ? `the homepage does not show: ${refused.join(', ')}` : !b.town && !b.region ? 'no town is stored' : questions.some((q) => q.kind === 'activity') ? null : 'the homepage shows no activity';
      if (why) unasked.push({ businessId: b.id, slug: b.slug, reason: why });
      for (const q of questions) {
        const item = byKey.get(q.key) ?? { question: q, businessIds: [] };
        item.businessIds.push(b.id);
        byKey.set(q.key, item);
        link.run(b.id, opts.batch, q.key, q.kind);
      }
    }
  })();
  const items = [...byKey.values()];
  const have = db.prepare('SELECT 1 FROM ai_answers WHERE question_key = ? AND provider = ? AND run_index = ?');
  const haveToday = db.prepare('SELECT 1 FROM ai_answers WHERE question_key = ? AND provider = ? AND day = ? AND run_index = ?');
  const toRun: AiPlan['toRun'] = [];
  let cached = 0;
  for (const item of items) {
    for (const provider of providers) {
      for (let i = 0; i < runs; i++) {
        if (opts.pass === 1 && i > 0) continue;
        if (opts.pass === 2 && i === 0) continue;
        // An answer from any day in this batch's run is reused. The day is kept so a later batch asks afresh.
        if (haveToday.get(item.question.key, provider, day, i) || have.get(item.question.key, provider, i)) cached += 1;
        else toRun.push({ provider, key: item.question.key, question: item.question.question, scope: item.question.scope, businessId: item.question.scope === 'brand' ? item.businessIds[0]! : null, runIndex: i });
      }
    }
  }
  const perCall = perCallEstimate(db, loadPrices());
  const estimateUsd = { openai: toRun.filter((t) => t.provider === 'openai').length * perCall.openai, perplexity: toRun.filter((t) => t.provider === 'perplexity').length * perCall.perplexity };
  return {
    businesses: opts.businesses.length,
    items,
    shared: items.filter((i) => i.question.scope === 'shared').length,
    brand: items.filter((i) => i.question.scope === 'brand').length,
    callsPerProvider: items.length * runs,
    cached,
    toRun,
    estimateUsd,
    totalUsd: estimateUsd.openai + estimateUsd.perplexity,
    perCall,
    unasked,
  };
}

export interface RunOptions extends GuardOptions {
  asks: Partial<Record<ProviderName, Ask>>;
  concurrency?: number;
  day?: string;
  log?: (l: string) => void;
}

export interface RunResult {
  asked: number;
  failed: number;
  spentUsd: number;
  stopped: BudgetStop | null;
}

/** Asks every planned question. Each call is guarded before it is made and recorded after. */
export async function runPlan(db: Db, p: AiPlan, opts: RunOptions): Promise<RunResult> {
  const day = opts.day ?? utcDay();
  const log = opts.log ?? ((l: string) => console.log(l));
  const result: RunResult = { asked: 0, failed: 0, spentUsd: 0, stopped: null };
  const limit = pLimit(opts.concurrency ?? 4);
  const insert = db.prepare('INSERT OR IGNORE INTO ai_answers (question_key, question, scope, business_id, provider, model, day, run_index, answer, citations, usage, asked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  // Calls in flight have not been recorded yet, so their estimates are held against the budget too.
  let reserved = 0;
  await Promise.all(
    p.toRun.map((t) =>
      limit(async () => {
        if (result.stopped) return;
        const ask = opts.asks[t.provider];
        if (!ask) return;
        const estimate = p.perCall[t.provider];
        try {
          guard(db, `${t.provider} ${t.key} run ${t.runIndex + 1}`, estimate + reserved, { quiet: true, approvedAboveAsk: opts.approvedAboveAsk });
        } catch (e) {
          if (e instanceof BudgetStop) {
            result.stopped ??= e;
            return;
          }
          throw e;
        }
        reserved += estimate;
        try {
          const a = await ask(t.question);
          record(db, { provider: t.provider, operation: 'ai_answer', units: { ...a.usage, model: a.model, calls: 1, question_key: t.key }, estimatedUsd: estimate, actualUsd: a.costUsd });
          result.spentUsd += a.costUsd;
          insert.run(t.key, t.question, t.scope, t.businessId, t.provider, a.model, day, t.runIndex, a.text, JSON.stringify(a.citations), JSON.stringify(a.usage), utcIso());
          result.asked += 1;
          if (result.asked % 50 === 0) log(`  ${result.asked} of ${p.toRun.length} answers, $${result.spentUsd.toFixed(2)} so far`);
        } catch (e) {
          result.failed += 1;
          // A failed call may still have been billed, so the estimate stays in the ledger.
          record(db, { provider: t.provider, operation: 'ai_answer_failed', units: { question_key: t.key, error: (e as Error).message.slice(0, 160) }, estimatedUsd: estimate, actualUsd: null });
          log(`  failed ${t.provider} ${t.key}: ${(e as Error).message.slice(0, 120)}`);
        } finally {
          reserved -= estimate;
        }
      }),
    ),
  );
  return result;
}

/** Works out, for every stored answer in a batch, which businesses it names. Given some businesses, only the answers to their questions are gone through. */
export function indexMentions(db: Db, batch: string, businessIds?: number[]): number {
  const links = (db.prepare('SELECT l.business_id, l.question_key FROM ai_question_links l WHERE l.batch = ?').all(batch) as { business_id: number; question_key: string }[]).filter((l) => !businessIds || businessIds.includes(l.business_id));
  const all = db.prepare("SELECT id, name, domain, town, region FROM businesses WHERE status != 'excluded' OR exclude_reason LIKE 'large_group%'").all() as { id: number; name: string; domain: string | null; town: string | null; region: string | null }[];
  const keys = [...new Set(links.map((l) => l.question_key))];
  const answers = db.prepare(`SELECT id, question_key, answer, citations FROM ai_answers WHERE question_key IN (${keys.map(() => '?').join(',') || "''"})`).all(...keys) as { id: number; question_key: string; answer: string; citations: string }[];
  const del = db.prepare('DELETE FROM ai_mentions WHERE answer_id = ? AND confirmed IS NULL');
  const ins = db.prepare('INSERT INTO ai_mentions (answer_id, business_id, name, matched_by, confirmed) VALUES (?, ?, ?, ?, NULL)');
  const kept = db.prepare('SELECT name FROM ai_mentions WHERE answer_id = ?');
  let n = 0;
  // One short transaction per answer, so other commands writing to the database are never held up for long.
  for (const a of answers) {
    db.transaction(() => {
      del.run(a.id);
      const already = new Set((kept.all(a.id) as { name: string }[]).map((r) => foldName(r.name)));
      const citations = JSON.parse(a.citations) as Citation[];
      const matched = new Set<string>();
      for (const b of all) {
        const m = isNamed(b, a.answer, citations);
        if (!m.named || already.has(foldName(b.name))) continue;
        ins.run(a.id, b.id, b.name, m.by);
        matched.add(foldName(b.name));
        for (const w of [coreName(b.name).join(' ')]) matched.add(w);
        n += 1;
      }
      for (const name of namedCandidates(a.answer)) {
        const f = foldName(name);
        if (already.has(f) || [...matched].some((m) => m && (f.includes(m) || m.includes(f)))) continue;
        ins.run(a.id, null, name, 'answer_text');
        n += 1;
      }
    })();
  }
  return n;
}

/**
 * How a business fares in the questions asked about its own activities. Every answer to every one
 * of those questions counts (runs times providers, for each question), so the finding built on
 * this fires only when the business is absent everywhere it was looked for.
 */
export function aiSummary(db: Db, business: Pick<Business, 'id' | 'name'>, batch: string): AiSummary | null {
  const keys = (db.prepare("SELECT question_key FROM ai_question_links WHERE business_id = ? AND batch = ? AND kind != 'brand' ORDER BY rowid").all(business.id, batch) as { question_key: string }[]).map((r) => r.question_key);
  type Row = { id: number; question: string; provider: string; asked_at: string; answer: string; citations: string };
  const tally = () => new Map<string, { name: string; answers: Set<number> }>();
  const count = (into: ReturnType<typeof tally>, m: { answer_id: number; business_id: number | null; name: string }) => {
    const k = m.business_id ? `b${m.business_id}` : foldName(m.name);
    const e = into.get(k) ?? { name: m.name, answers: new Set<number>() };
    e.answers.add(m.answer_id);
    into.set(k, e);
  };
  const ranked = (from: ReturnType<typeof tally>) => [...from.values()].map((o) => ({ name: o.name, answers: o.answers.size, ids: o.answers })).sort((x, y) => y.answers - x.answers);
  const sampleOf = (a: Row) => ({ provider: a.provider, askedAt: a.asked_at, answer: a.answer, citations: (JSON.parse(a.citations) as Citation[]).map((c) => c.url) });

  const all: Row[] = [];
  const named = new Set<number>();
  const others = tally();
  const asked: AiSummary['asked'] = [];
  for (const key of keys) {
    const answers = db.prepare('SELECT id, question, provider, asked_at, answer, citations FROM ai_answers WHERE question_key = ? ORDER BY provider, run_index').all(key) as Row[];
    if (!answers.length) continue;
    const ids = answers.map((a) => a.id);
    const mentions = db.prepare(`SELECT answer_id, business_id, name FROM ai_mentions WHERE answer_id IN (${ids.map(() => '?').join(',')}) AND (confirmed IS NULL OR confirmed = 1)`).all(...ids) as { answer_id: number; business_id: number | null; name: string }[];
    const here = new Set(mentions.filter((m) => m.business_id === business.id).map((m) => m.answer_id));
    const theirs = tally();
    for (const m of mentions) {
      if (m.business_id === business.id) continue;
      count(theirs, m);
      count(others, m);
    }
    for (const id of here) named.add(id);
    all.push(...answers);
    asked.push({ question: answers[0]!.question, answers: answers.length, namedIn: here.size, others: ranked(theirs).map(({ name, answers: n }) => ({ name, answers: n })).slice(0, 12), sample: sampleOf(answers.find((a) => !here.has(a.id)) ?? answers[0]!) });
  }
  if (all.length < 4) return null;
  // Split the answers into those asked within an hour of the first, and those asked later.
  const times = all.map((a) => new Date(a.asked_at).getTime());
  const first = Math.min(...times);
  const early = new Set(all.filter((a) => new Date(a.asked_at).getTime() - first < 60 * 60_000).map((a) => a.id));
  const late = new Set(all.filter((a) => !early.has(a.id)).map((a) => a.id));
  const otherList = ranked(others);
  const strong = otherList.filter((o) => o.answers >= 3);
  const unnamedIn = (ids: Set<number>) => ![...ids].some((id) => named.has(id));
  const othersIn = (ids: Set<number>) => strong.filter((o) => [...o.ids].some((id) => ids.has(id))).length >= 2;
  const without = all.find((a) => !named.has(a.id)) ?? all[0]!;
  return {
    questions: all.length,
    namedIn: named.size,
    others: otherList.map(({ name, answers: n }) => ({ name, answers: n })).slice(0, 12),
    sample: { question: without.question, ...sampleOf(without) },
    asked,
    spanMinutes: (Math.max(...times) - first) / 60_000,
    holdsInBothPasses: late.size > 0 && early.size > 0 && unnamedIn(early) && unnamedIn(late) && othersIn(early) && othersIn(late),
  };
}
