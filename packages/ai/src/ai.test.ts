import { describe, expect, it } from 'vitest';
import { memoryDb, type Business } from '@plumbline/core';
import { loadPrices, record, spent } from '@plumbline/budget';
import { questionsFor, type HomepageWords } from '@plumbline/checks';
import { aiSummary, coreName, indexMentions, isNamed, namedCandidates, parseOpenAi, parsePerplexity, plan, runPlan, type Answer } from './index.ts';

const prices = loadPrices();
const biz = (id: number, name: string, town: string, patch: Partial<Business> = {}): Business => ({ id, slug: `b${id}`, name, website: `https://b${id}.co.nz/`, domain: `b${id}.co.nz`, region: 'Northland', town, activity: 'Guided kayak tours', status: 'qualified', ...patch }) as Business;

const kayaks: HomepageWords = { title: 'Guided kayak tours', description: '', headings: [], nav: [], text: '' };
const homepage = () => kayaks;

function seed(db: ReturnType<typeof memoryDb>, list: Business[]) {
  for (const b of list) db.prepare("INSERT INTO businesses (id, slug, name, website, domain, region, town, activity, source, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'discovered', 'qualified', 'x')").run(b.id, b.slug, b.name, b.website, b.domain, b.region, b.town, b.activity);
}

describe('questions', () => {
  it('asks who to book the homepage activity with, then two neutral questions about the business', () => {
    const q = questionsFor({ name: 'Coastal Kayakers', region: 'Northland', town: 'Paihia (Waitangi)' }, kayaks);
    expect(q.map((x) => x.kind)).toEqual(['activity', 'brand', 'brand']);
    expect(q[0]!.question).toBe('Who should I book a kayak tour with in or near Paihia, New Zealand? Name specific operators.');
    expect(q[1]!.question).toBe('What can you tell me about Coastal Kayakers in Paihia, New Zealand?');
    expect(q[0]!.question).not.toContain('Coastal Kayakers');
  });
});

describe('provider responses', () => {
  it('reads an OpenAI answer, its url_citation annotations and its billable counts', () => {
    const a = parseOpenAi(
      {
        output: [
          { type: 'web_search_call', action: { type: 'search' } },
          { type: 'web_search_call', action: { type: 'open_page' } },
          { type: 'message', content: [{ type: 'output_text', text: 'Try **Coastal Kayakers**.', annotations: [{ type: 'url_citation', url: 'https://coastalkayakers.co.nz/', title: 'Coastal Kayakers' }, { type: 'url_citation', url: 'https://coastalkayakers.co.nz/', title: 'dup' }] }] },
        ],
        usage: { input_tokens: 8000, output_tokens: 600, input_tokens_details: { cached_tokens: 0 } },
      },
      'gpt-6-luna',
      prices,
    );
    expect(a.text).toBe('Try **Coastal Kayakers**.');
    expect(a.citations).toEqual([{ url: 'https://coastalkayakers.co.nz/', title: 'Coastal Kayakers' }]);
    expect(a.usage).toMatchObject({ web_search_calls: 1, input_tokens: 8000, output_tokens: 600 });
    expect(a.costUsd).toBeCloseTo(0.01 + 0.0008 + 0.0003, 6);
  });

  it('reads a Perplexity answer, takes citations from the search results and uses the reported cost', () => {
    const a = parsePerplexity(
      {
        output: [
          { type: 'search_results', results: [{ url: 'https://www.newzealand.com/x', title: 'NZ' }] },
          { type: 'message', content: [{ type: 'output_text', text: 'Coastal Kayakers [web:1].', annotations: [] }] },
        ],
        usage: { input_tokens: 4718, output_tokens: 450, tool_calls_details: { search_web: { invocation: 1 } }, cost: { total_cost: 0.00481 } },
      },
      'perplexity/sonar',
      prices,
    );
    expect(a.citations).toEqual([{ url: 'https://www.newzealand.com/x', title: 'NZ' }]);
    expect(a.costUsd).toBe(0.00481);
    expect(a.usage).toMatchObject({ web_search_calls: 1, reported_cost: 0.00481 });
  });

  it('computes the Perplexity cost from counts when none is reported', () => {
    const a = parsePerplexity({ output: [], usage: { input_tokens: 4000, output_tokens: 400, tool_calls_details: { search_web: { invocation: 1 } } } }, 'perplexity/sonar', prices);
    expect(a.costUsd).toBeCloseTo(0.0025 + 0.001 + 0.001, 6);
  });
});

describe('named or not', () => {
  const b = { name: 'Coastal Kayakers', domain: 'coastalkayakers.co.nz' };
  it('matches the name loosely, ignoring case, macrons and punctuation', () => {
    expect(isNamed(b, 'We suggest coastal  kayakers, in Waitangi.', []).by).toBe('name');
    expect(isNamed({ name: 'Ōkārito Kayaks', domain: null }, 'Okarito Kayaks runs lagoon trips.', []).named).toBe(true);
    expect(isNamed({ name: 'Trek Lake Okareka (Horse Trekking Lake Okareka)', domain: null }, 'Book with Trek Lake Okareka.', []).named).toBe(true);
    expect(isNamed({ name: 'The Seventh Generation Tours', domain: null }, 'Marie at Seventh Generation leads walks.', []).named).toBe(true);
    expect(isNamed({ name: 'Spellbound Glowworm & Cave Tours', domain: null }, 'Spellbound is a small operator.', []).named).toBe(true);
    expect(isNamed({ name: 'Marlborough Sounds Adventure Company', domain: null }, 'Marlborough has many operators.', []).named).toBe(false);
    expect(isNamed({ name: 'Hokianga Express Charters', domain: null, town: 'Opononi', region: 'Northland (Hokianga)' }, 'The Hokianga harbour is lovely.', []).named).toBe(false);
  });
  it('matches the domain in the text or in a citation', () => {
    expect(isNamed(b, 'See coastalkayakers.co.nz for times.', []).by).toBe('domain');
    expect(isNamed(b, 'Several operators run tours.', [{ url: 'https://www.coastalkayakers.co.nz/tours', title: '' }]).by).toBe('citation');
  });
  it('does not match on generic words alone', () => {
    expect(isNamed(b, 'Many coastal operators hire kayaks. Kayakers love the bay.', []).named).toBe(false);
    expect(isNamed({ name: 'Kayak Tours', domain: null }, 'There are many kayak tours in the area.', []).named).toBe(true);
    expect(isNamed({ name: 'Bay Tours', domain: null }, 'The bay has many tours.', []).named).toBe(false);
    expect(isNamed({ name: 'Bay of Islands Tours', domain: null }, 'Fishing in the Bay of Islands is superb.', []).named).toBe(false);
    expect(isNamed({ name: 'Bay of Islands Tours', domain: null }, 'Book with Bay of Islands Tours.', []).named).toBe(true);
    expect(isNamed({ name: 'Bay of Islands Adventures Ltd', domain: null }, 'Bay of Islands Adventures runs trips; the Bay of Islands is lovely.', []).named).toBe(true);
    expect(namedCandidates('- **Captain Bucko — Paihia**: good')).toEqual(['Captain Bucko']);
    expect(coreName('The Seventh Generation Tours')).toEqual(['seventh', 'generation']);
  });
  it('lists other names an answer puts forward', () => {
    const text = '## Top picks\n1. **Bay of Islands Kayaking** – small groups [web:1]\n2. **Coastal Kayakers**: waterfall trips\n- Pacific Coast Kayaks (Paihia): rentals\n\n**Tips:** book ahead.\n**Best time to visit** is summer.';
    expect(namedCandidates(text)).toEqual(['Bay of Islands Kayaking', 'Coastal Kayakers', 'Pacific Coast Kayaks']);
  });
});

describe('planning and running', () => {
  const list = [biz(1, 'Coastal Kayakers', 'Paihia'), biz(2, 'Bay Paddle Co', 'Paihia'), biz(3, 'Hokianga Kayaks', 'Opononi')];

  it('shares a town question between businesses with the same activity and counts three runs per question per provider', () => {
    const db = memoryDb();
    seed(db, list);
    const p = plan(db, { homepage, businesses: list, batch: 'b' });
    // One question for each of the two towns, two brand questions each.
    expect(p).toMatchObject({ businesses: 3, shared: 2, brand: 6, callsPerProvider: 24, cached: 0 });
    expect(p.toRun).toHaveLength(48);
    expect(p.items.find((i) => i.question.key === 'activity:paihia:kayak-tour')!.businessIds).toEqual([1, 2]);
    expect(p.totalUsd).toBeCloseTo(24 * p.perCall.openai + 24 * p.perCall.perplexity, 6);
    expect(plan(db, { homepage, businesses: list, batch: 'b', brandQuestions: 0 }).callsPerProvider).toBe(6);
  });

  it('asks nothing about the place for a business whose homepage shows no activity', () => {
    const db = memoryDb();
    seed(db, list);
    const blank: HomepageWords = { title: 'Welcome', description: '', headings: [], nav: [], text: '' };
    const p = plan(db, { homepage: (b) => (b.id === 1 ? blank : b.id === 2 ? null : kayaks), businesses: list, batch: 'b', brandQuestions: 0 });
    expect(p.items.map((i) => [i.question.key, i.businessIds])).toEqual([['activity:opononi:kayak-tour', [3]]]);
    expect(p.unasked).toEqual([{ businessId: 1, slug: 'b1', reason: 'the homepage shows no activity' }, { businessId: 2, slug: 'b2', reason: 'no homepage has been read' }]);
    expect(aiSummary(db, list[0]!, 'b')).toBeNull();
  });

  it('uses the activities stated for a business only when its homepage shows them', () => {
    const db = memoryDb();
    seed(db, list);
    const p = plan(db, { homepage, stated: (b) => (b.id === 1 ? ['kayak tour', 'horse trek'] : []), businesses: list.slice(0, 1), batch: 'b', brandQuestions: 0 });
    expect(p.items.map((i) => i.question.activity)).toEqual(['kayak tour']);
    expect(p.unasked).toEqual([{ businessId: 1, slug: 'b1', reason: 'the homepage does not show: horse trek' }]);
  });

  it('replaces the questions of the businesses it is given and leaves the rest of the batch alone', () => {
    const db = memoryDb();
    seed(db, list);
    plan(db, { homepage, businesses: list, batch: 'b', brandQuestions: 0 });
    const links = () => (db.prepare("SELECT business_id, question_key FROM ai_question_links WHERE batch = 'b' ORDER BY business_id, question_key").all() as { business_id: number; question_key: string }[]).map((l) => `${l.business_id} ${l.question_key}`);
    expect(links()).toEqual(['1 activity:paihia:kayak-tour', '2 activity:paihia:kayak-tour', '3 activity:opononi:kayak-tour']);
    const cruises: HomepageWords = { ...kayaks, title: 'Harbour cruises' };
    plan(db, { homepage: () => cruises, businesses: list.slice(0, 1), batch: 'b', brandQuestions: 0 });
    expect(links()).toEqual(['1 activity:paihia:harbour-cruise', '2 activity:paihia:kayak-tour', '3 activity:opononi:kayak-tour']);
  });

  it('records every call, reuses stored answers and stops at the ask line without passing it', async () => {
    const db = memoryDb();
    seed(db, list);
    let calls = 0;
    const ask = async (): Promise<Answer> => {
      calls += 1;
      return { text: 'Try **Bay Paddle Co** and **Rival One**.', citations: [], model: 'm', usage: { input_tokens: 1, output_tokens: 1 }, costUsd: 0.01 };
    };
    const p = plan(db, { homepage, businesses: list, batch: 'b', providers: ['openai'] });
    const r1 = await runPlan(db, p, { asks: { openai: ask }, log: () => undefined });
    expect(r1).toMatchObject({ asked: 24, failed: 0, stopped: null });
    expect(calls).toBe(24);
    expect(spent(db)).toBeCloseTo(0.24, 6);
    const again = plan(db, { homepage, businesses: list, batch: 'b', providers: ['openai'] });
    expect(again).toMatchObject({ cached: 24 });
    expect(again.toRun).toHaveLength(0);

    record(db, { provider: 'openai', operation: 'other', units: {}, estimatedUsd: 24.7, actualUsd: 24.7 });
    seed(db, [biz(4, 'Fourth Kayaks', 'Russell')]);
    const more = plan(db, { homepage, businesses: [...list, biz(4, 'Fourth Kayaks', 'Russell')], batch: 'b', providers: ['openai'] });
    const r2 = await runPlan(db, more, { asks: { openai: ask }, concurrency: 1, log: () => undefined });
    expect(r2.stopped?.kind).toBe('ask');
    expect(spent(db)).toBeLessThanOrEqual(25);
    expect(r2.asked).toBeLessThan(more.toRun.length);
  });

  it('adds up the answers to every activity question of a business, and keeps each question apart', async () => {
    const db = memoryDb();
    seed(db, list);
    const both: HomepageWords = { ...kayaks, title: 'Guided kayak tours and kayak hire' };
    const p = plan(db, { homepage: (b) => (b.id === 1 ? both : kayaks), businesses: list.slice(0, 2), batch: 'b', brandQuestions: 0 });
    expect(p.items.map((i) => i.question.activity)).toEqual(['kayak tour', 'kayak hire']);
    const ask = async (question: string): Promise<Answer> => ({ text: question.includes('kayak hire') ? 'Try **Rival One** or **Rival Two**.' : 'Try **Coastal Kayakers**, **Rival One** or **Rival Two**.', citations: [], model: 'm', usage: {}, costUsd: 0 });
    await runPlan(db, p, { asks: { openai: ask, perplexity: ask }, log: () => undefined });
    indexMentions(db, 'b');
    const coastal = aiSummary(db, list[0]!, 'b')!;
    expect(coastal).toMatchObject({ questions: 12, namedIn: 6 });
    expect(coastal.asked.map((q) => [q.question, q.answers, q.namedIn])).toEqual([
      ['Who should I book a kayak tour with in or near Paihia, New Zealand? Name specific operators.', 6, 6],
      ['Who should I book a kayak hire with in or near Paihia, New Zealand? Name specific operators.', 6, 0],
    ]);
    expect(coastal.asked[1]!.others.map((o) => o.name)).toEqual(['Rival One', 'Rival Two']);
    expect(coastal.asked[1]!.sample!.answer).toBe('Try **Rival One** or **Rival Two**.');
    expect(coastal.others.find((o) => o.name === 'Rival One')!.answers).toBe(12);
    // The other business offers tours only, so it is judged on that question alone.
    expect(aiSummary(db, list[1]!, 'b')).toMatchObject({ questions: 6, namedIn: 0 });
  });

  it('summarises how often a business is named against others', async () => {
    const db = memoryDb();
    seed(db, list);
    const p = plan(db, { homepage, businesses: list, batch: 'b', brandQuestions: 0 });
    await runPlan(db, p, { asks: { openai: async () => ({ text: 'Try **Bay Paddle Co** and **Rival One**.', citations: [], model: 'm', usage: {}, costUsd: 0 }), perplexity: async () => ({ text: 'Bay Paddle Co, or Rival One.\n- Rival One: great', citations: [], model: 'm', usage: {}, costUsd: 0 }) }, log: () => undefined });
    indexMentions(db, 'b');
    const coastal = aiSummary(db, list[0]!, 'b')!;
    expect(coastal).toMatchObject({ questions: 6, namedIn: 0 });
    expect(coastal.others.find((o) => o.name === 'Bay Paddle Co')!.answers).toBe(6);
    expect(coastal.others.find((o) => o.name === 'Rival One')!.answers).toBe(6);
    expect(coastal.sample!.question).toContain('New Zealand');
    expect(aiSummary(db, list[1]!, 'b')).toMatchObject({ questions: 6, namedIn: 6 });
    // All six answers were asked together, so nothing has been shown twice over time.
    expect(coastal.holdsInBothPasses).toBe(false);
    expect(coastal.spanMinutes).toBeLessThan(1);
  });

  it('indexes the answers of the businesses it is given and leaves the rest of the batch alone', async () => {
    const db = memoryDb();
    seed(db, list);
    const p = plan(db, { homepage, businesses: list, batch: 'b', brandQuestions: 0 });
    await runPlan(db, p, { asks: { openai: async () => ({ text: 'Try **Bay Paddle Co**.', citations: [], model: 'm', usage: {}, costUsd: 0 }) }, log: () => undefined });
    const answersWithMentions = () => (db.prepare('SELECT DISTINCT a.question_key FROM ai_mentions m JOIN ai_answers a ON a.id = m.answer_id ORDER BY 1').all() as { question_key: string }[]).map((r) => r.question_key);
    indexMentions(db, 'b', [3]);
    expect(answersWithMentions()).toEqual(['activity:opononi:kayak-tour']);
    indexMentions(db, 'b');
    expect(answersWithMentions()).toEqual(['activity:opononi:kayak-tour', 'activity:paihia:kayak-tour']);
  });

  it('asks each question once in pass 1 and twice more in pass 2, and sees agreement across the two', async () => {
    const db = memoryDb();
    seed(db, list);
    const ask = async (): Promise<Answer> => ({ text: 'Try **Bay Paddle Co** and **Rival One**.', citations: [], model: 'm', usage: {}, costUsd: 0 });
    const p1 = plan(db, { homepage, businesses: list, batch: 'b', brandQuestions: 0, pass: 1 });
    expect(p1.toRun).toHaveLength(4);
    expect(p1.toRun.every((t) => t.runIndex === 0)).toBe(true);
    await runPlan(db, p1, { asks: { openai: ask, perplexity: ask }, log: () => undefined });
    const p2 = plan(db, { homepage, businesses: list, batch: 'b', brandQuestions: 0, pass: 2 });
    expect(p2.toRun).toHaveLength(8);
    expect(p2.toRun.every((t) => t.runIndex > 0)).toBe(true);
    await runPlan(db, p2, { asks: { openai: ask, perplexity: ask }, log: () => undefined });
    // Move the second pass 90 minutes on, as it would be in real use.
    db.prepare("UPDATE ai_answers SET asked_at = ? WHERE run_index > 0").run(new Date(Date.now() + 90 * 60_000).toISOString());
    indexMentions(db, 'b');
    const coastal = aiSummary(db, list[0]!, 'b')!;
    expect(coastal).toMatchObject({ questions: 6, namedIn: 0, holdsInBothPasses: true });
    expect(coastal.spanMinutes).toBeGreaterThanOrEqual(89);
    expect(plan(db, { homepage, businesses: list, batch: 'b', brandQuestions: 0 }).toRun).toHaveLength(0);
  });
});
