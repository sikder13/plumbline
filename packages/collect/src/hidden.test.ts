import { describe, expect, it } from 'vitest';
import { absentFrom, hiddenBlocks } from './hidden.ts';

const SPAM = [/\bcasino\b/i, /\bs[áa]zk\w+/i];
const CZECH = 'V dnešní digitální éře se sázková industrie dramaticky proměnila díky pokročilým technologiím a datové analytice. Platformy představují novou generaci služeb, které kombinují umělou inteligenci, statistické modely a lidskou expertízu k vytváření kvalitních podkladů pro rozhodování.';
const VISIBLE = 'Welcome to Fixture Horse Treks. I love meeting people and showing them our little piece of paradise with its spectacular views over the lakes.';
const page = (hidden: string) => `<!doctype html><html lang="en"><head><title>x</title><script>var a = "casino";</script></head><body>
<p>${VISIBLE}</p>
${hidden}
<footer><p>Contact us today</p></footer></body></html>`;
const find = (hidden: string, visible = VISIBLE) => hiddenBlocks(page(hidden), [`${visible}\nContact us today`], 'https://fixture.co.nz/', SPAM);

describe('hidden injected content', () => {
  it('finds a hidden foreign-language block with a link to an unrelated domain', () => {
    const blocks = find(`<div style="overflow: hidden; height: 1px;"><h1>Jak Betzoid</h1><p>${CZECH}</p><p>Více: <a href="https://betzoid.com/cz/">sportovní tipy</a></p></div>`);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ language: 'ces', links: [{ href: 'https://betzoid.com/cz/', domain: 'betzoid.com' }], line: 3 });
    expect(blocks[0]!.spamTerms.length).toBeGreaterThan(0);
    expect(blocks[0]!.html).toContain('overflow: hidden; height: 1px;');
    expect(blocks[0]!.before[0]).toContain('Welcome to Fixture Horse Treks');
  });

  it('finds hidden spam wording in English with an unrelated link', () => {
    const blocks = find('<div style="display:none">Play at the best online casino tonight and claim your welcome bonus, with hundreds of games to choose from. <a href="https://lucky-spins.example/">Play now</a></div>');
    expect(blocks.map((b) => [b.language, b.spamTerms, b.links[0]!.domain])).toEqual([[null, ['casino'], 'lucky-spins.example']]);
  });

  it('needs both conditions: no finding without an unrelated link', () => {
    expect(find(`<div style="display:none"><p>${CZECH}</p></div>`)).toEqual([]);
    expect(find(`<div style="display:none"><p>${CZECH}</p><a href="/kontakt">Kontakt</a><a href="https://www.facebook.com/fixture">Facebook</a><a href="https://fixture.rezdy.com/">Book</a></div>`)).toEqual([]);
  });

  it('needs both conditions: no finding for hidden ordinary text with an outside link', () => {
    expect(find('<div style="display:none">Our friends at the local garage look after our vans and trailers all year round, and we could not run the treks without their help and good humour. <a href="https://garage.example/">Visit them</a></div>')).toEqual([]);
  });

  it('does not report text a visitor can see', () => {
    expect(find(`<div><p>${CZECH}</p><a href="https://betzoid.com/cz/">tipy</a></div>`, `${VISIBLE}\n${CZECH}\ntipy`)).toEqual([]);
  });

  it('counts text as visible when any screen size shows it', () => {
    const html = page(`<div class="desktop-only"><p>${CZECH}</p><a href="https://betzoid.com/cz/">tipy</a></div>`);
    expect(hiddenBlocks(html, [VISIBLE, `${VISIBLE}\n${CZECH}`], 'https://fixture.co.nz/', SPAM)).toEqual([]);
  });

  it('ignores scripts, styles, noscript and templates', () => {
    expect(find(`<noscript><p>${CZECH}</p><a href="https://betzoid.com/">x</a></noscript><template><p>${CZECH}</p><a href="https://betzoid.com/">x</a></template><script type="text/plain">${CZECH} casino https://betzoid.com/</script>`)).toEqual([]);
  });

  it('reports one block for one injected article, not one per paragraph', () => {
    expect(find(`<div style="position:absolute;left:-9999px"><p>${CZECH}</p><p>${CZECH} <a href="https://betzoid.com/cz/">tipy</a></p><p>${CZECH}</p></div>`)).toHaveLength(1);
  });

  it('tells hidden text from visible text by samples from its start, middle and end', () => {
    expect(absentFrom(CZECH, VISIBLE.toLowerCase())).toBe(true);
    expect(absentFrom(VISIBLE, VISIBLE.toLowerCase())).toBe(false);
    expect(absentFrom('short', '')).toBe(false);
  });
});
