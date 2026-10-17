import type { CSSProperties } from 'react';
import { DemoFoot } from '@/components/DemoFoot';
import { Pic } from '@/components/Pic';
import { Pinned } from '@/components/Pinned';
import { SounderDepth } from '@/components/SounderDepth';
import { SounderMotion } from '@/components/SounderMotion';
import { SounderPick, type PickTrip } from '@/components/SounderPick';
import { SounderSwell } from '@/components/SounderSwell';
import { StickyBar } from '@/components/StickyBar';
import { pic, type PageData } from '@/lib/data';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Link {
  label: string;
  href: string;
}

interface Trip {
  name: string;
  tag?: string;
  text: string;
  facts: string[];
  price: string;
  unit: string;
  book: Link;
}

interface Content {
  wordmark: string;
  nav: Link[];
  depth: { label: string; marks: Link[] };
  book: Link;
  from: { label: string; value: string; unit: string };
  call: { label: string; tel: string; display: string };
  email: string;
  hero: { kicker: string; title: string; sub: string; place: string; scope: string[] };
  fish: {
    kicker: string;
    heading: string;
    quote: string;
    by: string;
    steps: { name: string; text: string; by?: string; image: string }[];
    end: { heading: string; trip: Trip; more: Link };
  };
  coast: {
    kicker: string;
    heading: string;
    ask: string;
    states: { key: string; label: string; image: string; tripKey: string; quote: { text: string; by: string }; trip: Trip }[];
    private: { text: string; link: Link };
  };
  cake: { kicker: string; words: string[]; quote: string; by: string; note: string };
  crew: { kicker: string; heading: string; people: { name: string; full: string; role: string; text: string; cert: string }[]; fill: string; image: string };
  boat: {
    kicker: string;
    heading: string;
    lead: string;
    facts: string[];
    image: string;
    unit: string;
    plotter: { label: string; track: string };
    cols: { label: string; note: string }[];
    rows: { label: string; note: string; cells: { name: string; price: string; href: string; label: string }[] }[];
    book: string;
  };
  end: {
    kicker: string;
    heading: string;
    how: string;
    seaLabel: string;
    groups: { label: string; keys: string[] }[];
    trips: PickTrip[];
    bookLabel: string;
    weather: string;
    contactLabel: string;
    callLabel: string;
    mailLabel: string;
    postLabel: string;
    post: string;
    image: string;
  };
}

type S = Record<string, string>;

const r1 = (n: number) => Math.round(n);

/** A seabed as points: sine waves whose cycles fit the width a whole number of times, so a copy laid beside it joins without a seam. */
function bed(width: number, base: number, waves: [number, number, number][], step = 12): [number, number][] {
  const pts: [number, number][] = [];
  for (let x = 0; x <= width; x += step) {
    let y = base;
    for (const [cycles, amp, phase] of waves) y += amp * Math.sin((2 * Math.PI * cycles * x) / width + phase);
    pts.push([x, y]);
  }
  return pts;
}

const linePath = (pts: [number, number][]) => `M${pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L')}`;
const fillPath = (pts: [number, number][], floor: number) => `${linePath(pts)}L${r1(pts[pts.length - 1]![0])} ${floor}L${r1(pts[0]![0])} ${floor}Z`;

/** The same scatter of small returns every time the page is drawn. */
function scatter(seed: number, count: number, width: number, top: number, floorAt: (x: number) => number): [number, number, number][] {
  let v = seed;
  const next = () => {
    v = (v * 16807) % 2147483647;
    return v / 2147483647;
  };
  const out: [number, number, number][] = [];
  for (let i = 0; i < count; i++) {
    const x = next() * width;
    const y = top + next() * Math.max(10, floorAt(x) - top - 18);
    out.push([r1(x), r1(y), 0.18 + next() * 0.5]);
  }
  return out;
}

/** Many small square returns as three paths, one for each strength, so the screen stays light to send. */
function Specks({ pts, size, data }: { pts: [number, number, number][]; size: number; data: string }) {
  const bins = [0.25, 0.42, 0.62];
  return (
    <>
      {bins.map((o, b) => {
        const d = pts
          .filter(([, , op]) => Math.min(2, Math.floor(((op - 0.18) / 0.5) * 3)) === b)
          .map(([x, y]) => `M${x} ${y}h${size}v${size}h-${size}z`)
          .join('');
        return d ? <path key={o} d={d} opacity={o} {...{ [`data-${data}`]: '' }} /> : null;
      })}
    </>
  );
}

function at(pts: [number, number][], x: number): number {
  const i = pts.findIndex(([px]) => px >= x);
  return i < 0 ? pts[pts.length - 1]![1] : pts[i]![1];
}

/** A fish return on a sounder: a short arch, with a soft glow under it. */
function Arch({ x, y, w = 15 }: { x: number; y: number; w?: number }) {
  const d = `M${x - w} ${y + 5}Q${x} ${y - 7} ${x + w} ${y + 5}`;
  return (
    <g data-arch>
      <path d={d} data-glow />
      <path d={d} />
    </g>
  );
}

/** The seabed under the opening photograph: one stretch of it, twice, so it can slide by for ever. */
const HERO_W = 1200;
const HERO_H = 300;
const HERO_BED = bed(HERO_W, 238, [
  [1, 16, 0.4],
  [3, 10, 1.9],
  [7, 5, 0.3],
  [13, 2.2, 2.2],
]);
const HERO_ARCHES: [number, number][] = [
  [286, 160],
  [318, 174],
  [300, 190],
  [752, 132],
  [786, 146],
  [1036, 178],
];

function HeroRun({ shift }: { shift: number }) {
  const specks = scatter(7, 70, HERO_W, 26, (x) => at(HERO_BED, x));
  return (
    <g transform={shift ? `translate(${shift} 0)` : undefined}>
      <Specks pts={specks} size={3} data="speck" />
      <path d={fillPath(HERO_BED, HERO_H)} fill="url(#sounder-hero-floor)" />
      <path d={linePath(HERO_BED)} transform="translate(0 16)" data-echo="3" />
      <path d={linePath(HERO_BED)} transform="translate(0 7)" data-echo="2" />
      <path d={linePath(HERO_BED)} data-echo="1" />
      <path d={linePath(HERO_BED)} transform="translate(0 58)" data-echo="double" />
      {HERO_ARCHES.map(([x, y]) => (
        <Arch key={`${x}`} x={x} y={y} />
      ))}
    </g>
  );
}

/** Three copies side by side: the run slides one copy's width and starts again, so it never shows an end. */
function HeroTrace({ s, labels }: { s: S; labels: string[] }) {
  return (
    <div className={s.trace} aria-hidden="true">
      <div className={s.traceRun}>
        <svg viewBox={`0 0 ${HERO_W * 3} ${HERO_H}`} focusable="false">
          <defs>
            <linearGradient id="sounder-hero-floor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0f3d48" />
              <stop offset="1" stopColor="#03202a" />
            </linearGradient>
          </defs>
          <HeroRun shift={0} />
          <HeroRun shift={HERO_W} />
          <HeroRun shift={HERO_W * 2} />
        </svg>
      </div>
      <span className={s.gauge} />
      <span className={s.scopeSpot}>{labels[1]}</span>
    </div>
  );
}

/** The seabed of the fishing story: rolling ground for the first stretch, then rising towards the shore at the end. */
const WORLD_W = 2600;
const WORLD_H = 400;
const WORLD_BED: [number, number][] = (() => {
  const flat = bed(1900, 300, [
    [2, 20, 1],
    [5, 9, 0.2],
    [11, 4, 1.3],
  ]);
  const last = flat[flat.length - 1]![1];
  const rise: [number, number][] = [];
  for (let x = 1912; x <= WORLD_W; x += 12) {
    const t = (x - 1900) / (WORLD_W - 1900);
    const ease = t * t * (3 - 2 * t);
    rise.push([x, last + (150 - last) * ease + 4 * Math.sin(x / 37)]);
  }
  return [...flat, ...rise];
})();

function WorldBed({ s }: { s: S }) {
  const specks = scatter(23, 160, WORLD_W, 30, (x) => at(WORLD_BED, x));
  const line = linePath(WORLD_BED);
  return (
    <div className={s.world} aria-hidden="true">
      <svg viewBox={`0 0 ${WORLD_W} ${WORLD_H}`} preserveAspectRatio="none" focusable="false">
        <defs>
          <linearGradient id="sounder-world-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0f3d48" />
            <stop offset="1" stopColor="#021820" />
          </linearGradient>
        </defs>
        <Specks pts={specks} size={3} data="speck" />
        <path d={fillPath(WORLD_BED, WORLD_H)} fill="url(#sounder-world-floor)" />
        <path d={line} transform="translate(0 18)" data-echo="3" vectorEffect="non-scaling-stroke" />
        <path d={line} transform="translate(0 8)" data-echo="2" vectorEffect="non-scaling-stroke" />
        <path d={line} data-echo="1" vectorEffect="non-scaling-stroke" />
        <path d={line} transform="translate(0 62)" data-echo="double" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

/** The boat from the side, bow to the right: hull, wheelhouse, canopy and mast. */
function Boat({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 96 40" aria-hidden="true" focusable="false">
      <path d="M12 9h34v2.4H12zM14 11v10M29 11v10M58 10V1M54 4h8" data-rig />
      <path d="M46 21V10h22l7 11z" data-cabin />
      <path d="M3 21h82q6 0 10-5l-6 15H8z" data-hull />
      <path d="M8 27h82" data-band />
    </svg>
  );
}

/** The shore at the end: the seabed rises to a wharf, where the boat lies alongside. */
const SHORE_W = 1600;
const SHORE_H = 220;
const SHORE_BED: [number, number][] = (() => {
  const pts: [number, number][] = [];
  for (let x = 0; x <= SHORE_W; x += 12) {
    const t = Math.min(1, x / 1330);
    const ease = t * t * (3 - 2 * t);
    pts.push([x, 196 - 150 * ease + 6 * Math.sin(x / 41) * (1 - ease) + 3 * Math.sin(x / 13)]);
  }
  return pts;
})();

function Shore({ s }: { s: S }) {
  const line = linePath(SHORE_BED);
  const specks = scatter(5, 70, 1300, 28, (x) => at(SHORE_BED, x));
  return (
    <div className={s.shore} aria-hidden="true">
      <svg viewBox={`0 0 ${SHORE_W} ${SHORE_H}`} preserveAspectRatio="xMaxYMax slice" focusable="false">
        <Specks pts={specks} size={3} data="speck" />
        <path d={fillPath(SHORE_BED, SHORE_H)} data-floor />
        <path d={line} transform="translate(0 7)" data-echo="2" />
        <path d={line} data-echo="1" data-draw pathLength={1} />
        <Arch x={260} y={120} />
        <Arch x={292} y={134} />
        <Arch x={700} y={96} />
        <path d="M1218 22V122M1262 22V100M1306 22V80M1350 22V58M1180 20H1440" data-wharf />
        <path d="M0 20H1180" data-surface />
        <g transform="translate(1100 1)">
          <g data-moored>
            <path d="M12 9h34v2.4H12zM14 11v10M29 11v10M58 10V1M54 4h8" data-rig />
            <path d="M46 21V10h22l7 11z" data-cabin />
            <path d="M3 21h82q6 0 10-5l-6 15H8z" data-hull />
          </g>
        </g>
      </svg>
    </div>
  );
}

/** The sea under the view: five even swells a band wide, filled down to the foot, so a copy shifted by one swell lines up. */
const SWELL = (() => {
  let d = 'M0 45';
  for (let i = 0; i < 5; i++) d += `C${i * 300 + 75} 5 ${i * 300 + 75} 5 ${i * 300 + 150} 45S${i * 300 + 225} 85 ${i * 300 + 300} 45`;
  return `${d}V90H0Z`;
})();

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Price({ s, value, unit, className }: { s: S; value: string; unit: string; className?: string }) {
  return (
    <p className={`${s.price} ${className ?? ''}`}>
      <b>{value}</b> <span>{unit}</span>
    </p>
  );
}

function TripBody({ s, trip, level = 3 }: { s: S; trip: Trip; level?: 3 | 4 }) {
  const H = level === 3 ? 'h3' : 'h4';
  return (
    <>
      {trip.tag && <p className={s.tag}>{trip.tag}</p>}
      <H className={s.tripName}>{trip.name}</H>
      <p className={s.tripText}>{trip.text}</p>
      <ul className={s.facts}>
        {trip.facts.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <div className={s.deal}>
        <Price s={s} value={trip.price} unit={trip.unit} />
        <a className={s.go} href={trip.book.href} rel="noopener" data-press aria-label={`${trip.book.label}: ${trip.name}`}>
          {trip.book.label}
          <Arrow />
        </a>
      </div>
    </>
  );
}

/** A photograph seen by the sounder: the guest's snapshot shown as a return, navy to aqua, never larger than its pixels. */
function Return({ s, data, image, sizes, className }: { s: S; data: PageData; image: string; sizes: string; className?: string }) {
  return (
    <figure className={`${s.sonar} ${className ?? ''}`}>
      <Pic pic={pic(data, image)} sizes={sizes} />
    </figure>
  );
}

/** The plotter's chart: grid lines, and the loop the boat runs between the four whole boat charters. */
function PlotTrack({ s }: { s: S }) {
  return (
    <svg className={s.plotTrack} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d="M46 35H82V78H46Z" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * The sea off the island read from the inside. The opening photograph is the calm surface, the only picture
 * in full colour; under it a sounder screen shows what the skippers know. A depth rail on the screen's edge
 * carries every section as a deeper mark. The trace runs on through the fishing story, rides the swell of
 * the sea switch, plots the whole boat prices and rises at the end to the wharf, where the booking console
 * waits already set to the trip the sea chose.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('sounder', ['Martian Mono', 'Inter Tight']);
  const c = data.demo as Content;
  const book = { href: c.book.href, rel: 'noopener' };
  let n = 0;
  const title = c.hero.title.split(' ').map((w) => [...w].map((ch) => ({ ch, i: n++ })));
  const fillWords = c.crew.fill.split(' ');
  const steps = c.fish.steps.length + 1;
  return (
    <div className={s.root}>
      <style href="sounder" precedence="design">
        {css}
      </style>
      <SounderMotion />
      <SounderDepth label={c.depth.label} marks={c.depth.marks} cls={{ rail: s.rail, ticks: s.ticks, strip: s.strip, now: s.now, marks: s.marks, mark: s.depthMark }} />

      <nav className={s.nav} aria-label={c.book.label}>
        <p className={s.navFrom}>
          {c.from.label} <b>{c.from.value}</b> {c.from.unit}
        </p>
        <a className={s.navBook} data-press data-magnetic {...book}>
          {c.book.label}
        </a>
      </nav>

      <section className={s.hero} id="top" data-hero aria-labelledby="hero-h">
        <div className={s.heroPhoto}>
          <Pic pic={pic(data, 'hero')} phone={data.images.heroPhone} sizes="100vw" first />
        </div>
        <a className={s.mark} href="#top">
          <svg viewBox="0 0 30 16" aria-hidden="true" focusable="false">
            <path d="M3 13Q15 -3 27 13" />
          </svg>
          {c.wordmark}
        </a>
        <div className={s.heroHead}>
          <h1 id="hero-h" aria-label={c.hero.title}>
            {title
              .map((word, w) => (
                <span key={w} className={s.word} aria-hidden="true">
                  {word.map(({ ch, i }) => (
                    <span key={i} className={s.ch} style={{ '--i': i } as CSSProperties}>
                      {ch}
                    </span>
                  ))}
                </span>
              ))
              .flatMap((el, w) => (w > 0 ? [' ', el] : [el]))}
          </h1>
        </div>
        <div className={s.screen}>
          <span className={s.scopeTop} aria-hidden="true">
            {c.hero.scope[0]}
          </span>
          <HeroTrace s={s} labels={c.hero.scope} />
          <div className={s.heroText}>
            <p className={s.sub}>{c.hero.sub}</p>
            <p className={s.place}>
              {c.hero.kicker}
              <span>{c.hero.place}</span>
            </p>
          </div>
          <div className={s.heroAct}>
            <p className={s.from}>
              <span>{c.from.label}</span> <b>{c.from.value}</b> <span>{c.from.unit}</span>
            </p>
            <a className={s.go} data-press data-magnetic {...book}>
              {c.book.label}
              <Arrow />
            </a>
          </div>
        </div>
      </section>

      <main>
        <section className={s.fish} id="fishing" aria-labelledby="fish-h">
          <Pinned steps={steps} className={s.story}>
            <header className={s.storyHead}>
              <p className={s.kicker}>{c.fish.kicker}</p>
              <h2 id="fish-h">{c.fish.heading}</h2>
              <p className={s.storyQuote}>
                {c.fish.quote} <cite>{c.fish.by}</cite>
              </p>
            </header>
            <WorldBed s={s} />
            <div className={s.surface} aria-hidden="true">
              <Boat className={s.boatMark} />
              <span className={s.beam} />
            </div>
            <span className={s.gaugeTall} aria-hidden="true">
              <i />
            </span>
            <ol className={s.spots}>
              {c.fish.steps.map((st, i) => (
                <li key={st.name} className={s.spot} data-step={i} data-state={i === 0 ? 'on' : 'off'} style={{ '--k': i } as CSSProperties}>
                  <div className={s.read}>
                    <h3 className={s.species}>{st.name}</h3>
                    <p className={s.readText}>{st.text}</p>
                    {st.by && <p className={s.by}>{st.by}</p>}
                  </div>
                  <Return s={s} data={data} image={st.image} sizes="(min-width: 900px) 31vw, 76vw" className={s.catch} />
                  <svg className={s.school} viewBox="0 0 120 60" aria-hidden="true" focusable="false">
                    <Arch x={44} y={22} />
                    <Arch x={76} y={30} />
                    <Arch x={58} y={44} />
                  </svg>
                </li>
              ))}
              <li className={s.spotEnd} data-step={c.fish.steps.length} data-state="off">
                <div className={s.endRead}>
                  <p className={s.endHead}>{c.fish.end.heading}</p>
                  <TripBody s={s} trip={c.fish.end.trip} />
                  <a className={s.more} href={c.fish.end.more.href}>
                    {c.fish.end.more.label}
                    <Arrow />
                  </a>
                </div>
              </li>
            </ol>
          </Pinned>
        </section>

        <section className={s.coast} id="coast" data-sea="0" aria-labelledby="coast-h">
          <div className={s.coastText}>
            <p className={s.kicker}>{c.coast.kicker}</p>
            <h2 id="coast-h" className={s.rock}>
              {c.coast.heading
                .split(' ')
                .map((w, i) => (
                  <span key={i} style={{ '--i': i } as CSSProperties}>
                    {w}
                  </span>
                ))
                .flatMap((el, i) => (i > 0 ? [' ', el] : [el]))}
            </h2>
            <SounderSwell
              target="coast"
              label={c.coast.ask}
              options={c.coast.states.map((st) => st.label)}
              cls={{ wrap: s.switch, ask: s.ask, track: s.track, opt: s.opt, knob: s.knob, boat: s.knobBoat }}
            />
            <div className={s.trips}>
              {c.coast.states.map((st, i) => (
                <article key={st.key} className={s.trip} data-for={i}>
                  <TripBody s={s} trip={st.trip} />
                </article>
              ))}
            </div>
            <p className={s.private}>
              {c.coast.private.text}{' '}
              <a href={c.coast.private.link.href}>
                {c.coast.private.link.label}
                <Arrow />
              </a>
            </p>
          </div>
          <div className={s.coastMedia}>
            <div className={s.views}>
              {c.coast.states.map((st, i) => (
                <Return key={st.key} s={s} data={data} image={st.image} sizes="(min-width: 900px) 48vw, 100vw" className={`${s.view} ${i ? s.viewNext : ''}`} />
              ))}
            </div>
            <svg className={s.swell} viewBox="0 0 1200 90" preserveAspectRatio="none" aria-hidden="true" focusable="false">
              <g data-wave="back">
                <path d={SWELL} />
              </g>
              <g data-wave="front">
                <path d={SWELL} />
              </g>
            </svg>
            <div className={s.quotes}>
              {c.coast.states.map((st, i) => (
                <blockquote key={st.key} className={s.quote} data-for={i}>
                  <p>{st.quote.text}</p>
                  <cite>{st.quote.by}</cite>
                </blockquote>
              ))}
            </div>
          </div>
        </section>

        <section className={s.cake} aria-labelledby="cake-h">
          <p className={s.kicker}>{c.cake.kicker}</p>
          <h2 id="cake-h" className={s.cakeWords} data-slide>
            {c.cake.words.map((w, i) => (
              <span key={w} style={{ '--i': i } as CSSProperties}>
                {w}{' '}
              </span>
            ))}
          </h2>
          <blockquote className={s.cakeQuote}>
            <p>{c.cake.quote}</p>
            <cite>{c.cake.by}</cite>
          </blockquote>
          <p className={s.cakeNote}>{c.cake.note}</p>
        </section>

        <section className={s.crew} id="skippers" aria-labelledby="crew-h">
          <header className={s.crewHead}>
            <p className={s.kicker}>{c.crew.kicker}</p>
            <h2 id="crew-h" data-reveal>
              {c.crew.heading}
            </h2>
          </header>
          <div className={s.people}>
            {c.crew.people.map((p) => (
              <article key={p.full} className={s.person} data-reveal>
                <p className={s.first} aria-hidden="true">
                  {p.name}
                </p>
                <h3 className={s.full}>{p.full}</h3>
                <p className={s.role}>{p.role}</p>
                <p className={s.personText}>{p.text}</p>
                <p className={s.cert}>
                  <svg viewBox="0 0 30 16" aria-hidden="true" focusable="false">
                    <path d="M3 13Q15 -3 27 13" />
                  </svg>
                  {p.cert}
                </p>
              </article>
            ))}
          </div>
          <Return s={s} data={data} image={c.crew.image} sizes="(min-width: 900px) 40vw, 100vw" className={s.crewPic} />
          <p className={s.fill} data-fill style={{ '--n': fillWords.length } as CSSProperties}>
            {fillWords.map((w, i) => (
              <span key={i} style={{ '--i': i } as CSSProperties}>
                {w}{' '}
              </span>
            ))}
          </p>
        </section>

        <section className={s.boat} id="boat" aria-labelledby="boat-h">
          <div className={s.boatText}>
            <p className={s.kicker}>{c.boat.kicker}</p>
            <h2 id="boat-h" data-reveal>
              {c.boat.heading}
            </h2>
          </div>
          <div className={s.boatSide}>
            <Return s={s} data={data} image={c.boat.image} sizes="(min-width: 900px) 40vw, 100vw" className={s.boatPic} />
            <p className={s.boatLead} data-reveal>
              {c.boat.lead}
            </p>
            <ul className={s.boatFacts} data-reveal>
              {c.boat.facts.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
          <div className={s.plotter}>
            <p className={s.plotBar} aria-hidden="true">
              <span>{c.boat.plotter.label}</span>
              <span>{c.boat.plotter.track}</span>
            </p>
            <div className={s.chart}>
              <PlotTrack s={s} />
              <span className={s.ship} aria-hidden="true" />
              {c.boat.cols.map((col, i) => (
                <p key={col.label} className={s.colHead} style={{ '--c': i } as CSSProperties} aria-hidden="true">
                  {col.label}
                  <small>{col.note}</small>
                </p>
              ))}
              {c.boat.rows.map((row, r) => (
                <div key={row.label} className={s.plotRow} style={{ '--r': r } as CSSProperties}>
                  <h3 className={s.rowHead}>
                    {row.label}
                    <small>{row.note}</small>
                  </h3>
                  {row.cells.map((cell, i) => (
                    <a key={cell.href} className={s.wpt} href={cell.href} rel="noopener" style={{ '--c': i, '--w': r * 2 + (r ? 1 - i : i) } as CSSProperties} aria-label={`${cell.label}: ${cell.name}, ${c.boat.cols[i]!.note}, ${cell.price} ${c.boat.unit}`} data-press>
                      <i aria-hidden="true" />
                      <b>{cell.price}</b>
                      <span>{c.boat.unit}</span>
                      <em>
                        {c.boat.cols[i]!.label} <small>{c.boat.cols[i]!.note}</small>
                      </em>
                      <span className={s.wptGo}>
                        {c.boat.book}
                        <Arrow />
                      </span>
                    </a>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={s.end} id="book" aria-labelledby="end-h">
          <Shore s={s} />
          <div className={s.endWrap}>
            <header className={s.endHeadBlock}>
              <p className={s.kicker}>{c.end.kicker}</p>
              <h2 id="end-h" data-reveal>
                {c.end.heading}
              </h2>
              <p className={s.weather}>{c.end.weather}</p>
            </header>
            <Return s={s} data={data} image={c.end.image} sizes="(min-width: 900px) 30vw, 100vw" className={s.endPic} />
            <SounderPick
              trips={c.end.trips}
              groups={c.end.groups}
              seaKeys={c.coast.states.map((st) => st.tripKey)}
              seaLabels={c.coast.states.map((st) => st.label)}
              seaLabel={c.end.seaLabel}
              how={c.end.how}
              bookLabel={c.end.bookLabel}
              cls={{
                console: s.console,
                list: s.pickList,
                group: s.pickGroup,
                row: s.pickRow,
                rowName: s.pickName,
                rowPrice: s.pickPrice,
                read: s.pickRead,
                sea: s.pickSea,
                tag: s.tag,
                name: s.pickTitle,
                text: s.pickText,
                facts: s.facts,
                deal: s.deal,
                price: s.price,
                go: s.go,
                how: s.pickHow,
              }}
            />
            <div className={s.contact}>
              <p className={s.contactHead}>{c.end.contactLabel}</p>
              <dl className={s.readout}>
                <div>
                  <dt>{c.end.callLabel}</dt>
                  <dd>
                    <a href={c.call.tel}>{c.call.display}</a>
                  </dd>
                </div>
                <div>
                  <dt>{c.end.mailLabel}</dt>
                  <dd>
                    <a href={`mailto:${c.email}`}>{c.email}</a>
                  </dd>
                </div>
                <div>
                  <dt>{c.end.postLabel}</dt>
                  <dd>{c.end.post}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>
      </main>

      <footer className={s.foot}>
        <p className={s.footMark}>
          <svg viewBox="0 0 30 16" aria-hidden="true" focusable="false">
            <path d="M3 13Q15 -3 27 13" />
          </svg>
          {c.wordmark}
        </p>
        <DemoFoot domain={data.domain} />
      </footer>

      <StickyBar main={{ label: c.book.label, href: c.book.href, external: true }} call={{ label: c.call.label, tel: c.call.tel }} />
    </div>
  );
}

export const sounder: Design = { Demo, fonts: ['martian-mono-latin-wght-normal', 'inter-tight-latin-wght-normal'], heroSizes: '100vw' };
