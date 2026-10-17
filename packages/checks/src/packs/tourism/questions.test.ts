import { describe, expect, it } from 'vitest';
import { block, link, page } from '../../testing.ts';
import { activitiesShown, homepageWords, ownActivities, type HomepageWords } from './activities.ts';
import { questionsFor } from './questions.ts';

const home = (patch: Partial<HomepageWords>): HomepageWords => ({ title: '', description: '', headings: [], nav: [], text: '', ...patch });

/** Homepages as their owners wrote them, each beside the search category that happened to find the business. */
const FIXTURES = {
  privateTours: {
    business: { name: 'Ridge Road Tours', town: 'Wellington', region: 'Wellington', activity: 'winery cellar door tastings' },
    home: home({
      title: 'Private Tours for the Discerning Traveller | Ridge Road Tours',
      description: 'Private tours of Wellington, the coast and the wine country for up to four guests.',
      headings: ['Private tours for the discerning traveller'],
      nav: ['Tours', 'Your guide', 'Enquire'],
      text: 'Your own guide and vehicle for the day. We call at two cellar doors for a wine tasting, then lunch at a winery restaurant before the drive home.',
    }),
    expected: ['private tour'],
  },
  boatTours: {
    business: { name: 'Outer Reef Adventures', town: 'Tairua', region: 'Coromandel', activity: 'fishing charters' },
    home: home({
      title: 'Outer Reef Adventures | Boat Tours and Snorkelling',
      description: 'Boat tours, snorkelling and private charters from Tairua.',
      headings: ['The coast most people never see'],
      nav: ['Boat tours', 'Snorkelling', 'Private charters', 'Book'],
      text: 'We take pride in visiting the lesser known bays. Every boat tour stops for a snorkel when the sea allows.',
    }),
    expected: ['boat tour', 'snorkelling trip'],
  },
  wineryRestaurant: {
    business: { name: 'Shingle Bank Winery', town: 'Napier', region: "Hawke's Bay", activity: 'winery cellar door tastings' },
    home: home({
      title: 'Shingle Bank Winery',
      description: 'A family owned winery and restaurant just out of Napier. The restaurant is open Thursday to Sunday for lunch.',
      headings: ['Shingle Bank Winery', 'Restaurant', 'Buy wine'],
      nav: ['About', 'Cellar door', 'Restaurant', 'Shop', 'Contact'],
      text: 'Wine tastings at the cellar door every day. Book a table for lunch among the vines.',
    }),
    expected: ['winery lunch', 'cellar door wine tasting'],
  },
  kayakToursAndHire: {
    business: { name: 'Inlet Paddlers', town: 'Paihia (Waitangi)', region: 'Northland', activity: 'kayak tours' },
    home: home({
      title: 'Inlet Paddlers : Sea Kayaking Tours and Kayak Hire, Bay of Islands',
      description: 'Guided kayak tours to the waterfall and kayak hire by the hour in Paihia.',
      headings: ['Guided kayak tours and rentals'],
      nav: ['Guided kayak tours', 'Kayak hire', 'Photos', 'Book now'],
      text: 'Come and join us on one of our guided kayak tours. Kayak hire is available from the beach all summer.',
    }),
    expected: ['kayak tour', 'kayak hire'],
  },
  guidedToursFoundAsKayaks: {
    business: { name: 'Steam Valley Adventures', town: 'Rotorua', region: 'Rotorua', activity: 'kayak tours' },
    home: home({
      title: 'Tours Rotorua | Geothermal Park Guided Tours',
      description: 'A small tour company offering guided tours of the geothermal parks.',
      headings: ['Steam Valley Adventures', 'Premier small-group guided Rotorua tours'],
      nav: ['Tours and excursions', 'About us', 'Contact us'],
      text: 'Welcome to Steam Valley Adventures, the specialist small-group tour operator.',
    }),
    expected: ['guided tour'],
  },
  ageGate: {
    business: { name: 'Terrace Block Wines', town: 'Renwick', region: 'Marlborough', activity: 'winery cellar door tastings' },
    home: home({
      title: 'Terrace Block Wines | Cellar Door | Marlborough',
      description: 'Tastings run at 11am, 1pm and 3pm at our family owned cellar door in Renwick.',
      text: 'I AM OVER 18 I AM UNDER 18',
    }),
    expected: ['cellar door wine tasting'],
  },
} as const;

const activities = (q: ReturnType<typeof questionsFor>) => q.filter((x) => x.kind === 'activity').map((x) => x.activity);

describe('the question a visitor would ask', () => {
  it('follows the pattern, with the activity in plain words and the town', () => {
    const f = FIXTURES.kayakToursAndHire;
    const q = questionsFor(f.business, f.home, { brandQuestions: 0 });
    expect(q.map((x) => x.question)).toEqual([
      'Who should I book a kayak tour with in or near Paihia, New Zealand? Name specific operators.',
      'Who should I book a kayak hire with in or near Paihia, New Zealand? Name specific operators.',
    ]);
    expect(q.every((x) => x.kind === 'activity' && x.scope === 'shared')).toBe(true);
  });

  it.each(Object.entries(FIXTURES))('asks %s about what its own homepage offers', (_name, f) => {
    expect(activities(questionsFor(f.business, f.home, { brandQuestions: 0 }))).toEqual(f.expected);
  });

  it('never asks about an activity the homepage does not name where it says what it is', () => {
    // What each activity looks like in a business's own words, written out here by hand.
    const WORDS: Record<string, RegExp> = {
      'private tour': /private tours?/i,
      'boat tour': /boat tours?/i,
      'snorkelling trip': /snorkell?ing/i,
      'cellar door wine tasting': /cellar door/i,
      'winery lunch': /winery and restaurant/i,
      'kayak tour': /kayak(ing)? tours?/i,
      'kayak hire': /kayak hire/i,
      'guided tour': /guided tours?/i,
    };
    for (const f of Object.values(FIXTURES)) {
      const says = [f.home.title, f.home.description, ...f.home.headings, ...f.home.nav].join(' | ');
      const questions = questionsFor(f.business, f.home, { brandQuestions: 0 });
      expect(questions.length, f.business.name).toBeGreaterThan(0);
      for (const q of questions) {
        expect(WORDS[q.activity!], `no words listed for "${q.activity}"`).toBeDefined();
        expect(says, `${f.business.name}: "${q.activity}" is not named on the homepage`).toMatch(WORDS[q.activity!]!);
        expect(q.question).toContain(` ${q.activity} with in or near `);
      }
    }
  });

  it('does not read one activity into the words of another', () => {
    const shown = (title: string) => ownActivities(home({ title })).activities.map((a) => a.phrase);
    expect(shown('Boat tours and kayak hire')).toEqual(['boat tour', 'kayak hire']);
    expect(shown('Bike hire and kayak tours')).toEqual(['bike hire', 'kayak tour']);
    expect(shown('Jet boat tours on the river')).toEqual(['jet boat ride']);
    expect(shown('Wine tasting tours of the valley')).toEqual(['wine tour']);
    expect(shown('3 day horse treks in the high country')).toEqual(['horse trek']);
    expect(shown('Tours by kayak around the bay')).toEqual(['kayak tour']);
    expect(shown('Hire a kayak by the hour')).toEqual(['kayak hire']);
    expect(shown('Sunset cruises of the harbour')).toEqual(['harbour cruise']);
  });

  it('does not take the activity from the search category that found the business', () => {
    // The two wrong questions asked in the first wave: a private tour operator asked about cellar
    // doors, and a boat tour operator asked about fishing charters.
    const tours = questionsFor(FIXTURES.privateTours.business, FIXTURES.privateTours.home, { brandQuestions: 0 });
    expect(tours.map((q) => q.question).join(' ')).not.toMatch(/cellar door|winery/i);
    const boats = questionsFor(FIXTURES.boatTours.business, FIXTURES.boatTours.home, { brandQuestions: 0 });
    expect(boats.map((q) => q.question).join(' ')).not.toMatch(/fishing/i);
    // The same homepage gives the same questions whatever category is stored.
    const other = questionsFor({ ...FIXTURES.boatTours.business, activity: 'horse trekking' }, FIXTURES.boatTours.home, { brandQuestions: 0 });
    expect(other).toEqual(boats);
  });

  it('asks nothing about the place when the homepage shows no activity, or there is no homepage', () => {
    const b = { name: 'Quiet Ltd', town: 'Napier', region: "Hawke's Bay", activity: 'kayak tours' };
    expect(questionsFor(b, home({ title: 'Quiet Ltd', text: 'Welcome to our website.' }), { brandQuestions: 0 })).toEqual([]);
    expect(questionsFor(b, null, { brandQuestions: 0 })).toEqual([]);
    expect(questionsFor(b, null).map((q) => q.kind)).toEqual(['brand', 'brand']);
  });

  it('gives two businesses in one town and activity the same question', () => {
    const a = questionsFor({ name: 'A Kayaks', town: 'Paihia', region: 'Northland', activity: null }, home({ title: 'Guided kayak tours in Paihia' }));
    const b = questionsFor({ name: 'B Paddle', town: 'Paihia', region: 'Northland', activity: null }, home({ title: 'B Paddle', nav: ['Sea kayaking trips'] }));
    expect(a[0]!.key).toBe('activity:paihia:kayak-tour');
    expect(b[0]!.key).toBe(a[0]!.key);
    expect(a[1]!.key).not.toBe(b[1]!.key);
  });
});

describe('activities stated for a business', () => {
  const f = FIXTURES.privateTours;

  it('are used in the order given when the homepage confirms them', () => {
    const r = ownActivities(f.home, ['private wine tour', 'private tour']);
    expect(r.activities.map((a) => a.phrase)).toEqual(['private wine tour', 'private tour']);
    expect(r.unconfirmed).toEqual([]);
    expect(r.activities[0]!.quote).toBeTruthy();
  });

  it('are refused when the homepage does not show them', () => {
    const r = ownActivities(f.home, ['fishing charter', 'private tour']);
    expect(r.activities.map((a) => a.phrase)).toEqual(['private tour']);
    expect(r.unconfirmed).toEqual(['fishing charter']);
    expect(activities(questionsFor(f.business, f.home, { stated: ['fishing charter'], brandQuestions: 0 }))).toEqual([]);
  });

  it('need the same showing as an activity read from the page: named where the business says what it is, or mentioned again and again', () => {
    // The body mentions a wine tasting once, as a stop on the tour. That does not make this a cellar door.
    expect(ownActivities(f.home, ['cellar door wine tasting']).unconfirmed).toEqual(['cellar door wine tasting']);
    // "Private charters" in the menu and "fish" somewhere else do not make a fishing charter.
    const charters = home({ title: 'Outer Reef Adventures', nav: ['Boat tours', 'Private charters'], text: 'We often see fish from the boat.' });
    expect(ownActivities(charters, ['fishing charter']).unconfirmed).toEqual(['fishing charter']);
    // Words outside the list must stand together in one such place.
    expect(ownActivities(charters, ['private boat charter']).unconfirmed).toEqual(['private boat charter']);
    expect(ownActivities(home({ title: 'Private boat charters from Tairua' }), ['private boat charter']).activities.map((a) => a.phrase)).toEqual(['private boat charter']);
    // Three mentions in the body are enough for a known activity.
    const often = home({ title: 'Shingle Bank', text: 'Our cellar door is open daily. Wine tastings run on the hour. Find the cellar door past the gate.' });
    expect(ownActivities(often, ['cellar door wine tasting']).activities).toHaveLength(1);
  });

  it('are limited to two', () => {
    const k = FIXTURES.kayakToursAndHire;
    expect(ownActivities(k.home, ['kayak tour', 'kayak hire', 'guided kayak tour']).activities).toHaveLength(2);
  });
});

describe('reading a homepage', () => {
  it('ranks what the title, description, headings and menu say above what the body mentions', () => {
    const shown = activitiesShown(FIXTURES.privateTours.home).map((a) => a.phrase);
    expect(shown[0]).toBe('private tour');
    // The body mentions a cellar door and a winery lunch as stops on the tour. They are not the business.
    expect(ownActivities(FIXTURES.privateTours.home).activities.map((a) => a.phrase)).toEqual(['private tour']);
  });

  it('quotes the words that show each activity', () => {
    const shown = activitiesShown(FIXTURES.wineryRestaurant.home);
    expect(shown.find((a) => a.phrase === 'winery lunch')!.quote).toBe('A family owned winery and restaurant just out of Napier. The restaurant is open Thursday to Sunday for lunch.');
    expect(shown.find((a) => a.phrase === 'cellar door wine tasting')!.quote).toBe('Cellar door');
  });

  it('takes the title, description, headings, menu and visible text from a captured page', () => {
    const p = page(
      'https://fixture.co.nz/',
      [block('Harbour cruises', { heading: 'h2' }), block('Public cruises', { inNav: true }), block('Join a narrated harbour cruise at sunset.'), block('Quick links', { heading: 'h2', inFooter: true })],
      { links: [link('https://fixture.co.nz/charters', 'Private charters', { inNav: true }), link('https://fixture.co.nz/x', 'Not shown', { inNav: true, visible: false })] },
    );
    p.meta.title = 'Sunset Cruises | Fixture';
    p.meta.description = 'A relaxing harbour cruise.';
    p.meta.h1 = ['Relax on the harbour'];
    const w = homepageWords(p);
    expect(w).toMatchObject({ title: 'Sunset Cruises | Fixture', description: 'A relaxing harbour cruise.' });
    expect(w.headings).toEqual(['Relax on the harbour', 'Harbour cruises']);
    expect(w.nav).toEqual(['Public cruises', 'Private charters']);
    expect(w.text).toContain('narrated harbour cruise');
    expect(ownActivities(w).activities[0]!.phrase).toBe('harbour cruise');
  });
});

describe('the place in the question', () => {
  const kayaks = home({ title: 'Guided kayak tours on the lagoon' });
  it('is the town, without the notes kept beside it', () => {
    expect(questionsFor({ name: 'X', town: 'Paihia (Waitangi)', region: 'Northland', activity: null }, kayaks, { brandQuestions: 0 })[0]!.question).toContain('in or near Paihia, New Zealand');
  });
  it('is the part of the town the homepage itself names, when it names one', () => {
    const named = home({ title: 'Guided kayak tours on Stewart Island' });
    expect(questionsFor({ name: 'X', town: 'Halfmoon Bay / Stewart Island', region: 'Southland', activity: null }, named, { brandQuestions: 0 })[0]!.question).toContain('in or near Stewart Island, New Zealand');
    expect(questionsFor({ name: 'X', town: 'Halfmoon Bay / Stewart Island', region: 'Southland', activity: null }, kayaks, { brandQuestions: 0 })[0]!.question).toContain('in or near Halfmoon Bay, New Zealand');
  });
  it('falls back to the region when there is no town', () => {
    expect(questionsFor({ name: 'X', town: null, region: 'Nelson Tasman (Golden Bay)', activity: null }, kayaks, { brandQuestions: 0 })[0]!.question).toContain('in or near Nelson Tasman, New Zealand');
  });
});
