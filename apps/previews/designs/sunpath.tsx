import type { CSSProperties } from 'react';
import { DemoFoot } from '@/components/DemoFoot';
import { Pic } from '@/components/Pic';
import { SectionLinks } from '@/components/SectionLinks';
import { StickyBar } from '@/components/StickyBar';
import { SunpathDays } from '@/components/SunpathDays';
import { SunpathHouse, type HouseLabels, type HousePack } from '@/components/SunpathHouse';
import { SunpathMap } from '@/components/SunpathMap';
import { SunpathProgress } from '@/components/SunpathProgress';
import { SunpathStrings } from '@/components/SunpathStrings';
import { SunpathWarm } from '@/components/SunpathWarm';
import { pic, type PageData } from '@/lib/data';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Beat {
  at: number;
  lead?: string;
  text: string;
}

interface Step {
  kind: 'day' | 'night';
  name: string;
  title: string;
  image: string;
  sun?: [number, number];
  beats: Beat[];
}

interface Pin {
  id: string;
  name: string;
  place: string;
  x: number;
  y: number;
  image?: string;
  text: string;
}

interface Content {
  wordmark: string[];
  place: string;
  nav: { label: string; href: string }[];
  book: { label: string; href: string };
  mail: { label: string; subject: string };
  call: { label: string; tel: string; display: string };
  email: string;
  hero: {
    lead: string;
    word: string;
    lines: string[];
    sub: string;
    price: { label: string; from: string; value: string; unit: string };
    /** Where things stand in the opening photograph, in its own pixels: the sky above the land, the sun and the waterline. */
    scene: { sky: string; sun: { cx: number; cy: number; r: number }; waterline: number; focus: number };
  };
  map: {
    kicker: string;
    heading: string;
    hint: string;
    drawn: string;
    add: string;
    added: string;
    notes: string[];
    shapes: { kind: string; d: string }[];
    places: { text: string; x: number; y: number }[];
    pins: Pin[];
    demo: string[];
  };
  days: { kicker: string; heading: string; steps: Step[] };
  welcome: {
    heading: string;
    text: string;
    sign: string;
    objectivesLead: string;
    objectives: string[];
    image: string;
    ratingLabel: string;
    ratingUnit: string;
    ratingSource: string;
    quotes: { text: string; by: string }[];
  };
  plan: HouseLabels & {
    kicker: string;
    heading: string;
    lead: string;
    house: HouseLabels['house'] & { rooms: string; walk: string };
    couples: string[];
    packages: HousePack[];
  };
  end: { kicker: string; heading: string; travel: string[]; hours: string; place: string; action: { label: string; href: string }; phoneLabel: string; emailLabel: string };
  foot: { strings: string; hint: string; place: string };
}

/** Where each letter of the word held apart starts, in letter heights, before it gathers: scattered down through the sky. */
const SCATTER: [number, number, number][] = [
  [-0.4, 3.6, -16],
  [1.6, 1.4, 12],
  [-1.2, 5.2, -8],
  [2.4, 3.0, 20],
  [0.6, 6.4, -22],
  [-1.6, 2.2, 9],
  [2.8, 5.6, -12],
  [-0.8, 7.2, 18],
  [1.4, 4.4, -6],
  [3.2, 7.8, 14],
];

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * A stay told by the sun crossing the Hokianga. It rises behind the dune of their own photograph while the
 * scattered letters of "strangers" gather; the adventures are pinned on a drawn map of the harbour; the sun
 * crosses each day and the moon each night of the package in a sky of their own; "Kia ora" comes up out
 * of the horizon; the house is lit a window a couple and booked by its moons; and the sun goes down on the
 * contact line before the guitar comes out.
 */
function Demo({ data }: { data: PageData }) {
  const c = data.demo as Content;
  const { css, s } = designStyles('sunpath', ['Yeseva One', 'Outfit']);
  const mailto = `mailto:${c.email}?subject=${encodeURIComponent(c.mail.subject)}`;
  const word = [...c.hero.word];
  const hero = pic(data, 'hero');
  const scene = c.hero.scene;
  const kia = [...c.welcome.heading];
  const steps = c.days.steps;
  const p = c.plan;
  const least = Number.parseInt(p.couples[0] ?? '', 10) || 1;

  return (
    <div className={s.root}>
      <style href="sunpath" precedence="design">
        {css}
      </style>

      <a className={s.dock} href={c.book.href} data-press data-magnetic>
        <i aria-hidden="true" />
        <span>{c.book.label}</span>
        <small>
          {c.hero.price.from} {c.hero.price.value} {c.hero.price.unit}
        </small>
      </a>

      <section className={s.hero} id="top" data-hero aria-labelledby="hero-h" style={{ '--wl': scene.waterline, '--focus': scene.focus, '--ar': (hero.height / hero.width).toFixed(4) } as CSSProperties}>
        <div className={s.heroPhoto}>
          <div className={s.heroFrame} style={{ aspectRatio: `${hero.width} / ${hero.height}` }}>
            <Pic pic={hero} sizes="(min-width: 900px) min(100vw, 1535px), 260vw" first />
            <svg viewBox={`0 0 ${hero.width} ${hero.height}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
              <defs>
                <clipPath id="sunpath-sky">
                  <path d={scene.sky} />
                </clipPath>
              </defs>
              <g clipPath="url(#sunpath-sky)">
                <circle className={s.sun} cx={scene.sun.cx} cy={scene.sun.cy} r={scene.sun.r} />
              </g>
            </svg>
          </div>
        </div>
        <div className={s.heroTop}>
          <a className={s.mark} href="#top">
            <i aria-hidden="true" />
            <span>{c.wordmark[0]}</span> <span>{c.wordmark[1]}</span>
          </a>
          <nav className={s.heroNav} aria-label="Sections">
            <SectionLinks className={s.heroLinks} items={c.nav} />
          </nav>
          <p className={s.place}>{c.place}</p>
        </div>
        <div className={s.heroWords}>
          <p className={s.lead}>
            <span className={s.leadSmall}>{c.hero.lead} </span>
            <span className={s.srOnly}>{c.hero.word}</span>
            <span className={s.gather} aria-hidden="true">
              {word.map((ch, i) => {
                const [x, y, r] = SCATTER[i % SCATTER.length]!;
                return (
                  <span key={i} style={{ '--k': i, '--fx': `${x}em`, '--fy': `${y}em`, '--fr': `${r}deg` } as CSSProperties}>
                    {ch}
                  </span>
                );
              })}
            </span>
          </p>
          <h1 id="hero-h" aria-label={c.hero.lines.join(' ')}>
            {c.hero.lines.map((l, i) => (
              <span key={l} className={s.line} aria-hidden="true">
                <span style={{ '--i': i } as CSSProperties}>{l}</span>
              </span>
            ))}
          </h1>
        </div>
        <div className={s.heroFoot}>
          <p className={s.sub}>{c.hero.sub}</p>
          <div className={s.act}>
            <a className={s.go} href={c.book.href} data-press data-magnetic>
              {c.book.label}
              <Arrow />
            </a>
            <p className={s.price}>
              <span>
                {c.hero.price.from} <b>{c.hero.price.value}</b>
              </span>
              <small>
                {c.hero.price.unit}, {c.hero.price.label}
              </small>
            </p>
          </div>
        </div>
      </section>

      <main>
        <section className={s.play} id="play" aria-labelledby="play-h">
          <header className={s.playHead}>
            <p className={s.kicker} data-reveal>
              {c.map.kicker}
            </p>
            <h2 id="play-h" data-reveal>
              {c.map.heading}
            </h2>
          </header>
          <SunpathMap
            pins={c.map.pins.map((pin) => ({ ...pin, picture: pin.image ? <Pic pic={pic(data, pin.image)} sizes="(min-width: 900px) 40vw, 100vw" /> : undefined }))}
            demo={c.map.demo}
            labels={{ add: c.map.add, added: c.map.added, hint: c.map.hint }}
            drawing={
              <>
                <svg className={s.mapSvg} viewBox="0 0 1000 1000" aria-hidden="true" focusable="false">
                  <rect className={s.mLand} width="1000" height="1000" />
                  {c.map.shapes.map((sh, i) => (
                    <path key={i} className={s.mShape} data-kind={sh.kind} d={sh.d} />
                  ))}
                </svg>
                {c.map.places.map((pl) => (
                  <span key={pl.text} className={s.mPlace} aria-hidden="true" style={{ '--x': `${pl.x / 10}%`, '--y': `${pl.y / 10}%` } as CSSProperties}>
                    {pl.text}
                  </span>
                ))}
                <span className={s.mDrawn}>{c.map.drawn}</span>
              </>
            }
            cls={{
              box: s.mapBox,
              map: s.map,
              pin: s.pin,
              tag: s.pinTag,
              panel: s.panel,
              card: s.card,
              photo: s.cardPhoto,
              place: s.cardPlace,
              name: s.cardName,
              text: s.cardText,
              add: s.add,
              hint: s.hint,
            }}
          />
          <div className={s.playNotes}>
            {c.map.notes.map((n) => (
              <p key={n} data-reveal>
                {n}
              </p>
            ))}
          </div>
        </section>

        <section className={s.days} id="days" aria-labelledby="days-h">
          <SunpathDays className={s.daysTrack} path={steps.map((st) => (st.kind === 'day' && st.sun ? st.sun : null))}>
            <div className={s.stage} aria-hidden="true">
              <i className={s.skyDawn} />
              <i className={s.skyDusk} />
              <i className={s.skyNight} />
              <i className={s.stars} />
              <span className={s.lane}>
                <span className={s.daySun} />
                <span className={s.nightMoon} />
              </span>
            </div>
            <div className={s.water} aria-hidden="true">
              <i className={s.waterNight} />
              <i className={s.moonGlint} />
            </div>
            <header className={s.daysHead}>
              <p className={s.kicker}>{c.days.kicker}</p>
              <h2 id="days-h">{c.days.heading}</h2>
              <p className={s.tally} aria-hidden="true">
                {steps.map((st, k) => (
                  <i key={st.name} data-k={k} data-kind={st.kind} data-lit={k === 0 ? '' : undefined} />
                ))}
              </p>
            </header>
            {steps.map((st, i) => (
              <article key={st.name} className={s.step} data-step={i} data-kind={st.kind} data-state={i === 0 ? 'on' : 'off'} aria-labelledby={`step-${i}`}>
                <p className={s.stepName} aria-hidden="true">
                  {st.name}
                </p>
                <div className={s.stepBody}>
                  <div className={s.stepPhoto}>
                    <Pic pic={pic(data, st.image)} sizes="(min-width: 900px) 46vw, 100vw" />
                  </div>
                  <div className={s.stepText}>
                    <h3 id={`step-${i}`}>
                      <span className={s.srOnly}>{st.name}: </span>
                      {st.title}
                    </h3>
                    <ul className={s.beats}>
                      {st.beats.map((b) => (
                        <li key={b.text} data-at={b.at} data-of={i} data-on={i === 0 ? '' : undefined}>
                          {b.lead && <b>{b.lead} </b>}
                          {b.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            ))}
          </SunpathDays>
        </section>

        <section className={s.welcome} id="kia-ora" aria-labelledby="kia-h">
          <SunpathProgress className={s.welcomeSky} offset={['start 92%', 'start 30%']} initial={1}>
            <span className={s.lowSun} aria-hidden="true" />
            <h2 id="kia-h" aria-label={c.welcome.heading}>
              {kia.map((ch, i) => (
                <span key={i} aria-hidden="true" style={{ '--i': i } as CSSProperties}>
                  {ch === ' ' ? ' ' : ch}
                </span>
              ))}
            </h2>
          </SunpathProgress>
          <div className={s.welcomeBody}>
            <div className={s.hosts}>
              <p className={s.hostsText} data-reveal>
                {c.welcome.text}
              </p>
              <p className={s.sign} data-reveal>
                {c.welcome.sign}
              </p>
              <div className={s.aims}>
                <p data-reveal>{c.welcome.objectivesLead}</p>
                <ol>
                  {c.welcome.objectives.map((o) => (
                    <li key={o} data-reveal>
                      {o}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
            <div className={s.welcomePic} data-wipe>
              <Pic pic={pic(data, c.welcome.image)} sizes="(min-width: 900px) 44vw, 100vw" />
            </div>
            {c.welcome.quotes.slice(0, 1).map((q) => (
              <figure key={q.by} className={s.quote} data-reveal>
                <blockquote>
                  <p>{q.text}</p>
                </blockquote>
                <figcaption>
                  <span className={s.by}>{q.by}</span>
                  {data.rating && (
                    <span className={s.rated}>
                      <b>{data.rating.value}</b> {c.welcome.ratingLabel} {data.rating.count} {c.welcome.ratingUnit}
                      <small>{c.welcome.ratingSource}</small>
                    </span>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className={s.plan} id="plan" aria-labelledby="plan-h">
          <header className={s.planHead}>
            <p className={s.kicker} data-reveal>
              {p.kicker}
            </p>
            <h2 id="plan-h" data-reveal>
              {p.heading.split(/(?<=\.)\s+/).map((part) => (
                <span key={part} className={s.sentence}>
                  {part}{' '}
                </span>
              ))}
            </h2>
            <div className={s.planLead}>
              <p data-reveal>{p.house.rooms}</p>
              <p data-reveal>{p.house.walk}</p>
            </div>
          </header>
          <SunpathHouse
            packs={p.packages}
            couples={p.couples}
            least={least}
            labels={p}
            email={c.email}
            cls={{
              box: s.houseBox,
              scene: s.scene,
              svg: s.house,
              win: s.win,
              moons: s.moons,
              moon: s.moonBtn,
              tap: s.tapHint,
              side: s.houseSide,
              days: s.dayRow,
              daysLine: s.daysLine,
              meta: s.meta,
              row: s.costRow,
              figure: s.figure,
              send: s.send,
              toggle: s.toggle,
              extra: s.extra,
              note: s.sendNote,
              wish: s.wish,
              plus: s.plus,
              minimum: s.minimum,
            }}
          />
        </section>

        <section className={s.end} id="contact" aria-labelledby="end-h">
          <SunpathProgress className={s.dusk} offset={['start end', 'end end']} still={0.3}>
            <div className={s.duskSky}>
              <h2 id="end-h" data-reveal>
                {c.end.heading}
              </h2>
              <div className={s.travel}>
                {c.end.travel.map((t) => (
                  <p key={t} data-reveal>
                    {t}
                  </p>
                ))}
              </div>
              <span className={s.setSun} aria-hidden="true" />
              <div className={s.onLine}>
                <p className={s.linePlace}>{c.end.place}</p>
                <a className={s.lineLink} href={c.call.tel}>
                  <span>{c.end.phoneLabel}</span> {c.call.display}
                </a>
                <a className={s.lineLink} href={`mailto:${c.email}`}>
                  <span>{c.end.emailLabel}</span> {c.email}
                </a>
              </div>
            </div>
            <div className={s.duskSea}>
              <i className={s.setGlint} aria-hidden="true" />
              <p className={s.hours}>{c.end.hours}</p>
              <a className={s.go} href={c.end.action.href} data-press data-magnetic>
                {c.end.action.label}
                <Arrow />
              </a>
            </div>
          </SunpathProgress>
        </section>
      </main>

      <footer className={s.foot}>
        <span className={s.crescent} aria-hidden="true" />
        <p className={s.footLine}>{c.foot.strings}</p>
        <SunpathStrings label={c.foot.hint} cls={{ box: s.strings, strum: s.strum }} />
        <div className={s.footBase}>
          <p className={s.footName}>
            <i aria-hidden="true" />
            {c.wordmark.join(' ')}
            <span>{c.foot.place}</span>
          </p>
          <DemoFoot domain={data.domain} />
        </div>
      </footer>

      <StickyBar main={{ label: c.mail.label, href: mailto }} call={{ label: c.call.label, tel: c.call.tel }} />
      <SunpathWarm />
    </div>
  );
}

export const sunpath: Design = { Demo, fonts: ['yeseva-one-latin-400-normal', 'outfit-latin-wght-normal'], heroSizes: '(min-width: 900px) min(100vw, 1535px), 260vw' };
