import { describe, expect, it } from 'vitest';
import { memoryDb, type Business } from '@plumbline/core';
import { loadPrices, record, spent } from '@plumbline/budget';
import { questionsFor } from '@plumbline/checks';
import { aiSummary, coreName, indexMentions, isNamed, namedCandidates, parseOpenAi, parsePerplexity, plan, runPlan, type Answer } from './index.ts';

const prices = loadPrices();
const biz = (id: number, name: string, town: string, patch: Partial<Business> = {}): Business => ({ id, slug: `b${id}`, name, website: `https://b${id}.co.nz/`, domain: `b${id}.co.nz`, region: 'Northland', town, activity: 'Guided kayak tours', status: 'qualified', ...patch }) as Business;

function seed(db: ReturnType<typeof memoryDb>, list: Business[]) {
  for (const b of list) db.prepare("INSERT INTO businesses (id, slug, name, website, domain, region, town, activity, source, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'discovered', 'qualified', 'x')").run(b.id, b.slug, b.name, b.website, b.domain, b.region, b.town, b.activity);
}

describe('questions', () => {
  it('asks about the area and the town, then two neutral questions about the business', () => {
    const q = questionsFor({ name: 'Coastal Kayakers', region: 'Northland', town: 'Paihia (Waitangi)', activity: 'Guided kayak tours and kayak hire' });
    expect(q.map((x) => x.kind)).toEqual(['area', 'town', 'brand', 'brand']);
    expect(q[0]!.question).toBe('What are the best kayak tours in Northland, New Zealand? Name the specific local operators you would recommend.');
    expect(q[1]!.question).toContain('in or near Paihia, New Zealand');
    expect(q[2]!.question).toBe('What can you tell me about Coastal Kayakers in Paihia, New Zealand?');
    expect(q.slice(0, 2).every((x) => !x.question.includes('Coastal Kayakers'))).toBe(true);
  });

  it('gives two businesses in one place and activity the same shared questions', () => {
    const a = questionsFor({ name: 'A Kayaks', region: 'Northland', town: 'Paihia', activity: 'kayak tours' });
    const b = questionsFor({ name: 'B Paddle', region: 'Northland', town: 'Paihia', activity: 'Sea kayaking' });
    expect(a.slice(0, 2).map((q) => q.key)).toEqual(b.slice(0, 2).map((q) => q.key));
    expect(a[2]!.key).not.toBe(b[2]!.key);
  });

  it('adds a landmark question when one is known and skips the town when it is the region', () => {
    expect(questionsFor({ name: 'X', region: 'Rotorua', town: 'Rotorua', activity: 'eco tours', landmark: 'Whirinaki Forest' }).map((q) => q.kind)).toEqual(['area', 'landmark', 'brand', 'brand']);
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
    expect(coreName('The Seventh Generation Tours')).toEqual(['seventh', 'generation']);
  });
  it('lists other names an answer puts forward', () => {
    const text = '## Top picks\n1. **Bay of Islands Kayaking** – small groups [web:1]\n2. **Coastal Kayakers**: waterfall trips\n- Pacific Coast Kayaks (Paihia): rentals\n\n**Tips:** book ahead.\n**Best time to visit** is summer.';
    expect(namedCandidates(text)).toEqual(['Bay of Islands Kayaking', 'Coastal Kayakers', 'Pacific Coast Kayaks']);
  });
});

describe('planning and running', () => {
  const list = [biz(1, 'Coastal Kayakers', 'Paihia'), biz(2, 'Bay Paddle Co', 'Paihia'), biz(3, 'Hokianga Kayaks', 'Opononi')];

  it('shares regional questions across businesses and counts three runs per question per provider', () => {
    const db = memoryDb();
    seed(db, list);
    const p = plan(db, { businesses: list, batch: 'b' });
    // One Northland question, two town questions, two brand questions each.
    expect(p).toMatchObject({ businesses: 3, shared: 3, brand: 6, callsPerProvider: 27, cached: 0 });
    expect(p.toRun).toHaveLength(54);
    expect(p.items.find((i) => i.question.key.startsWith('area:'))!.businessIds).toEqual([1, 2, 3]);
    expect(p.totalUsd).toBeCloseTo(27 * p.perCall.openai + 27 * p.perCall.perplexity, 6);
    expect(plan(db, { businesses: list, batch: 'b', brandQuestions: 0 }).callsPerProvider).toBe(9);
  });

  it('records every call, reuses stored answers and stops at the ask line without passing it', async () => {
    const db = memoryDb();
    seed(db, list);
    let calls = 0;
    const ask = async (): Promise<Answer> => {
      calls += 1;
      return { text: 'Try **Bay Paddle Co** and **Rival One**.', citations: [], model: 'm', usage: { input_tokens: 1, output_tokens: 1 }, costUsd: 0.01 };
    };
    const p = plan(db, { businesses: list, batch: 'b', providers: ['openai'] });
    const r1 = await runPlan(db, p, { asks: { openai: ask }, log: () => undefined });
    expect(r1).toMatchObject({ asked: 27, failed: 0, stopped: null });
    expect(calls).toBe(27);
    expect(spent(db)).toBeCloseTo(0.27, 6);
    const again = plan(db, { businesses: list, batch: 'b', providers: ['openai'] });
    expect(again).toMatchObject({ cached: 27 });
    expect(again.toRun).toHaveLength(0);

    record(db, { provider: 'openai', operation: 'other', units: {}, estimatedUsd: 24.7, actualUsd: 24.7 });
    seed(db, [biz(4, 'Fourth Kayaks', 'Russell')]);
    const more = plan(db, { businesses: [...list, biz(4, 'Fourth Kayaks', 'Russell')], batch: 'b', providers: ['openai'] });
    const r2 = await runPlan(db, more, { asks: { openai: ask }, concurrency: 1, log: () => undefined });
    expect(r2.stopped?.kind).toBe('ask');
    expect(spent(db)).toBeLessThanOrEqual(25);
    expect(r2.asked).toBeLessThan(more.toRun.length);
  });

  it('summarises how often a business is named against others, from the question where it does best', async () => {
    const db = memoryDb();
    seed(db, list);
    const p = plan(db, { businesses: list, batch: 'b', brandQuestions: 0 });
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

  it('asks each question once in pass 1 and twice more in pass 2, and sees agreement across the two', async () => {
    const db = memoryDb();
    seed(db, list);
    const ask = async (): Promise<Answer> => ({ text: 'Try **Bay Paddle Co** and **Rival One**.', citations: [], model: 'm', usage: {}, costUsd: 0 });
    const p1 = plan(db, { businesses: list, batch: 'b', brandQuestions: 0, pass: 1 });
    expect(p1.toRun).toHaveLength(6);
    expect(p1.toRun.every((t) => t.runIndex === 0)).toBe(true);
    await runPlan(db, p1, { asks: { openai: ask, perplexity: ask }, log: () => undefined });
    const p2 = plan(db, { businesses: list, batch: 'b', brandQuestions: 0, pass: 2 });
    expect(p2.toRun).toHaveLength(12);
    expect(p2.toRun.every((t) => t.runIndex > 0)).toBe(true);
    await runPlan(db, p2, { asks: { openai: ask, perplexity: ask }, log: () => undefined });
    // Move the second pass 90 minutes on, as it would be in real use.
    db.prepare("UPDATE ai_answers SET asked_at = ? WHERE run_index > 0").run(new Date(Date.now() + 90 * 60_000).toISOString());
    indexMentions(db, 'b');
    const coastal = aiSummary(db, list[0]!, 'b')!;
    expect(coastal).toMatchObject({ questions: 6, namedIn: 0, holdsInBothPasses: true });
    expect(coastal.spanMinutes).toBeGreaterThanOrEqual(89);
    expect(plan(db, { businesses: list, batch: 'b', brandQuestions: 0 }).toRun).toHaveLength(0);
  });
});
