import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { batchOf, checkRecipe, layoutOf, liveBatches, lookOf, pagesToPublish, recipeContent, recipeSlugs, recordLiveBatches, retireRecipe, varietyIssues, type Placed } from './recipe.ts';
import type { Recipe, Section } from './types.ts';

const hero = (variant: 'photo' | 'split' | 'type' | 'frame' = 'photo'): Section => ({ kind: 'hero', variant, place: 'Seal Cove, Example Coast', lines: ['Seals at', 'their own pace'] });
function recipe(patch: Partial<Recipe> = {}): Recipe {
  return {
    brief: { mood: 'wild, close, gentle', headline: 'Seals at their own pace', hero: 'The bay at dusk, full bleed', story: 'An evening at the cove', patterns: ['pinned story', 'tall swipe cards', 'quote on a band'] },
    palette: { family: 'ocean', paper: '#f6f4ef', ink: '#10222b', soft: '#e4ecec', deep: '#0c2a36', onDeep: '#ffffff', accent: '#e2733a', onAccent: '#1a0d05' },
    type: 'playfair-nunito',
    action: { label: 'Book', href: 'https://fareharbor.com/embeds/book/alpha/', variant: 'pill' },
    call: { tel: 'tel:+6435550142', display: '03 555 0142' },
    email: 'tours@alpha.co.nz',
    nav: [{ label: 'Tours', href: '#tours' }],
    images: { hero: { file: 'photos/003.jpg', alt: 'The bay at dusk' }, a: { file: 'photos/004.jpg', alt: 'A penguin' } },
    sections: [
      hero(),
      { kind: 'story', variant: 'wipe', subject: 'an evening with the colony', heading: 'An evening', steps: [{ image: 'a', label: 'Dusk', text: 'We drive over the hill.' }, { image: 'a', label: 'Dark', text: 'The birds come ashore.' }, { label: 'Home', text: 'Back by ten.' }] },
      { kind: 'rows', variant: 'tall', id: 'tours', heading: 'Tours', cue: 'Drag', items: [{ image: 'a', name: 'Evening tour', price: '$120', text: 'Two hours.' }] },
    ],
    ...patch,
  };
}

describe('a page recipe', () => {
  it('passes when it is whole', () => {
    expect(checkRecipe(recipe())).toEqual([]);
  });

  it('is read as the page of a business prepared as part of a wave, so its findings are stated the wave\'s way', () => {
    expect(recipeContent(recipe()).wave).toBe(true);
  });

  it('is refused when its brief, its headline, its photos or its links do not hold together', () => {
    const problems = (r: unknown) => checkRecipe(r).join(' | ');
    expect(problems(recipe({ brief: { ...recipe().brief, mood: 'wild, close' } }))).toContain('the mood is three words');
    expect(problems(recipe({ brief: { ...recipe().brief, patterns: ['one', 'two'] } }))).toContain('the brief names three layout patterns');
    expect(problems(recipe({ sections: [{ ...hero(), lines: ['Penguins at their', 'own pace every evening'] } as Section] }))).toContain('the headline is 7 words; five at most');
    expect(problems(recipe({ sections: [hero(), hero()] }))).toContain('one hero, and it comes first');
    expect(problems(recipe({ sections: [recipe().sections[1]!, hero()] }))).toContain('one hero, and it comes first');
    expect(problems(recipe({ images: { a: { file: 'photos/004.jpg', alt: 'A penguin' } } }))).toContain('no image called "hero"');
    expect(problems(recipe({ sections: [hero(), { kind: 'wipes', variant: 'pair', images: ['a', 'nowhere'] }] }))).toContain('wipes names an image "nowhere" that the recipe does not list');
    expect(problems(recipe({ nav: [{ label: 'Wines', href: '#wines' }] }))).toContain('the menu links to #wines, which no section carries');
    expect(problems(recipe({ action: { label: 'Book', href: 'fareharbor.com', variant: 'pill' } }))).toContain('the action');
    expect(problems(recipe({ call: { tel: 'tel:035550142', display: '03 555 0142' } }))).toContain('the phone number');
    expect(problems({ ...recipe(), type: 'comic-sans' })).toContain('type');
    expect(problems(recipe({ sections: [hero(), { kind: 'story', variant: 'wipe', subject: 'x', heading: 'x', steps: [{ label: 'a', text: 'b' }] }] }))).toContain('a pinned story has three to five steps');
  });

  it('is refused when words would be hard to read on their ground', () => {
    const pale = { ...recipe().palette, accent: '#f2d48b', onAccent: '#ffffff' };
    expect(checkRecipe(recipe({ palette: pale })).join(' | ')).toContain('onAccent on accent has a contrast of 1.4; 4.5 is needed');
    expect(checkRecipe(recipe({ palette: { ...recipe().palette, ink: '#8a9aa0' } })).join(' | ')).toContain('ink on paper');
  });

  it('is refused when a figure from Google does not say so, with the month it was measured', () => {
    const problems = (r: unknown) => checkRecipe(r).join(' | ');
    const figures = (...items: { value: string; label: string; source?: string }[]): Section => ({ kind: 'numbers', variant: 'row', items });
    expect(problems(recipe({ sections: [hero(), figures({ value: '4.9', label: 'On Google', source: '120 reviews' })] }))).toContain('the figure "4.9 On Google" comes from Google and needs "Google, <month> <year>" as its source');
    expect(problems(recipe({ sections: [hero(), figures({ value: '52', label: 'Google reviews' })] }))).toContain('the figure "52 Google reviews" comes from Google');
    expect(problems(recipe({ sections: [hero(), figures({ value: '4.8', label: 'Rating', source: '310 Google reviews, October 2026' })] }))).toContain('the figure "4.8 Rating" comes from Google');
    expect(problems(recipe({ sections: [{ ...hero(), note: '4.9 from 240 Google reviews' } as Section] }))).toContain('the note under the action speaks of Google and needs "Google, <month> <year>" as its source');
    expect(problems(recipe({ sections: [{ ...hero(), note: '4.9 from 240 reviews', noteSource: 'Google' } as Section] }))).toContain('the note under the action speaks of Google');
  });

  it('passes when a figure from Google carries its source', () => {
    const sections: Section[] = [
      { ...hero(), note: '4.9 from 240 reviews', noteSource: 'Google, October 2026' } as Section,
      { kind: 'numbers', variant: 'row', items: [{ value: '5.0', label: 'From 180 Google reviews', source: 'Google, October 2026' }, { value: '25', label: 'Years guiding' }] },
      { kind: 'visit', variant: 'plain', heading: 'Find us', address: ['1 Cove Road'], notes: ['Search for us on Google Maps.', 'Enjoyed your day? Leave us a Google review.'] },
    ];
    expect(checkRecipe(recipe({ sections, nav: [] }))).toEqual([]);
  });

  it('is refused when a Google rating sits in running text, where no source can stand beside it', () => {
    const sections: Section[] = [hero(), { kind: 'words', variant: 'quote', paragraphs: ['Our guests rate us 4.9 on Google.'] }];
    expect(checkRecipe(recipe({ sections })).join(' | ')).toContain('words speaks of a Google rating in running text; it belongs in the note under the action or among the figures, with its source');
  });

  it('becomes a content file for the recipe design, with its sections as the page', () => {
    const c = recipeContent(recipe({ name: 'Alpha Penguins', video: { file: 'film/hero.mp4' } }));
    expect(c.design).toBe('recipe');
    expect(c.name).toBe('Alpha Penguins');
    expect(c.video).toEqual({ file: 'film/hero.mp4' });
    expect(Object.keys(c.images)).toEqual(['hero', 'a']);
    expect((c.demo as Recipe).sections).toHaveLength(3);
  });

  it('is summed up by its look and by its layout', () => {
    expect(lookOf(recipe())).toEqual({ hero: 'photo', type: 'playfair-nunito', family: 'ocean' });
    expect(layoutOf(recipe())).toBe('hero:photo > story:wipe > rows:tall');
  });
});

describe('variety across a wave', () => {
  const placed = (slug: string, patch: Partial<Recipe> = {}, groups: string[] = []): Placed => ({ slug, groups, recipe: recipe(patch) });
  const other = { type: 'bebas-karla' as const, palette: { ...recipe().palette, family: 'forest' as const } };

  it('refuses two pages with the same hero, type pair and palette family', () => {
    expect(varietyIssues([placed('alpha'), placed('bravo')], [])).toEqual(['alpha and bravo share a hero (photo), a type pair (playfair-nunito) and a palette family (ocean)']);
    expect(varietyIssues([placed('alpha'), placed('bravo', { type: 'bebas-karla' })], [])).toEqual([]);
  });

  it('asks more of two businesses of one kind or one place: they may share one of the three, never two', () => {
    const issue = 'alpha and bravo are both wineries and must differ at a glance: they share';
    expect(varietyIssues([placed('alpha', {}, ['wineries']), placed('bravo', { type: 'bebas-karla' }, ['wineries'])], [])).toEqual([`${issue} a hero (photo) and a palette family (ocean)`]);
    expect(varietyIssues([placed('alpha', {}, ['wineries']), placed('bravo', other, ['wineries'])], [])).toEqual([]);
    // Businesses in different groups are held only to the first rule.
    expect(varietyIssues([placed('alpha', {}, ['wineries']), placed('bravo', { type: 'bebas-karla' }, ['Kaikōura'])], [])).toEqual([]);
  });

  it('refuses a page laid out like a wave 1 page', () => {
    expect(varietyIssues([placed('alpha')], [{ name: 'Waterline', layout: 'hero:photo > story:wipe > rows:tall' }])).toEqual(['alpha is laid out like the wave 1 page for Waterline (hero:photo > story:wipe > rows:tall)']);
    expect(varietyIssues([placed('alpha')], [{ name: 'Waterline', layout: 'hero:photo > story:rail > rows:tall' }])).toEqual([]);
  });
});

describe('build batches', () => {
  it('publishes the pages with a design of their own and the recipe pages of the batches named, and no page still being worked on', () => {
    const order = { A: ['alpha', 'bravo'], B: ['charlie'], C: ['delta'] };
    const built = ['alpha', 'bravo', 'charlie', 'delta', 'old-one', 'old-two'];
    expect(pagesToPublish(built, ['old-one', 'old-two'], order, ['A'])).toEqual(['alpha', 'bravo', 'old-one', 'old-two']);
    expect(pagesToPublish(built, ['old-one', 'old-two'], order, ['A', 'B'])).toEqual(['alpha', 'bravo', 'charlie', 'old-one', 'old-two']);
    // A page of a named batch that has not been built is simply not there to publish.
    expect(pagesToPublish(['alpha', 'old-one'], ['old-one'], order, ['A'])).toEqual(['alpha', 'old-one']);
    expect(() => pagesToPublish(built, [], order, ['Z'])).toThrow('no batch Z');
  });

  it('finds the batch a business is built in from the written order', () => {
    const order = { A: ['alpha', 'bravo'], B: ['charlie'], C: ['delta'] };
    expect(batchOf(order, 'charlie')).toBe('B');
    expect(batchOf(order, 'nobody')).toBeNull();
  });
});

describe('the batches that are live', () => {
  it('are written down by a build that names them, and read back by a build that does not', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'plumbline-live-')), 'live-batches.json');
    expect(liveBatches(file)).toBeNull();
    recordLiveBatches(['A', 'B'], file);
    expect(liveBatches(file)).toEqual(['A', 'B']);
  });

  it('carry no recipe page whose batch has not been named', () => {
    expect(pagesToPublish(['alpha', 'bravo', 'charlie'], ['alpha'], { A: ['bravo'], B: ['charlie'] }, [])).toEqual(['alpha']);
  });
});

describe('a recipe set aside when its page is taken down', () => {
  it('is no longer built, and is kept', () => {
    const dir = mkdtempSync(join(tmpdir(), 'plumbline-recipes-'));
    writeFileSync(join(dir, 'alpha.json'), '{}');
    writeFileSync(join(dir, 'bravo.json'), '{}');
    expect(retireRecipe('alpha', dir)).toBe(true);
    expect(recipeSlugs(dir)).toEqual(['bravo']);
    expect(existsSync(join(dir, 'removed', 'alpha.json'))).toBe(true);
    expect(retireRecipe('alpha', dir)).toBe(false);
  });
});
