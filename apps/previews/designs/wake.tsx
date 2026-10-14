import type { CSSProperties } from 'react';
import { DemoFoot } from '@/components/DemoFoot';
import { Pic } from '@/components/Pic';
import { Pinned } from '@/components/Pinned';
import { StickyBar } from '@/components/StickyBar';
import { BoatSide, BoatTop, Peaks, Pontoon, Trout, wake as wakeShape, type WakeShape } from '@/components/WakeArt';
import { WakeFill } from '@/components/WakeFill';
import { WakeHours, type HoursMode } from '@/components/WakeHours';
import { WakeLetter, type LetterWords } from '@/components/WakeLetter';
import { WakeSeen } from '@/components/WakeSeen';
import { pic, type PageData } from '@/lib/data';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Tel {
  label: string;
  tel: string;
  display: string;
}

interface Content {
  wordmark: [string, string];
  email: string;
  subject: string;
  call: Tel;
  free: Tel;
  intl: Tel;
  book: { label: string };
  hero: { lines: string[]; kicker: string; place: string; sub: string; price: { what: string; value: string; unit: string } };
  dive: { kicker: string; heading: string; steps: { word: string; text: string }[] };
  hours: { kicker: string; heading: string; lead: string; modeLabel: string; hoursLabel: string; recommended: string; modes: HoursMode[]; send: string; callLabel: string };
  boat: { kicker: string; name: string; spec: string[]; lead: string; aboard: string[]; cook: string; bring: string };
  clear: {
    kicker: string;
    heading: string;
    text: string;
    carving: { heading: string; text: string; year: string };
    price: { value: string; unit: string };
    surcharge: string;
    send: string;
    subject: string;
  };
  words: { heading: string; big: { text: string; who: string }; quotes: { text: string; who: string }[]; ratingFrom: string; ratingUnit: string; ratingSource: string };
  end: {
    heading: string;
    line: string;
    berth: string;
    berthLabel: string;
    place: string;
    address: string;
    letter: LetterWords;
    payment: string;
    vouchers: string;
  };
}

/** The opening lake, drawn twice: wide for a desktop screen and tall for a phone. */
const HERO_DESK = wakeShape(
  [
    [
      [-80, 660],
      [180, 550],
      [400, 700],
      [650, 610],
    ],
    [
      [650, 610],
      [850, 540],
      [910, 440],
      [1080, 400],
    ],
  ],
  { step: 9, spread: 0.2, max: 100, beam: 12, arcEvery: 4, bow: 66, scale: 1.45, trail: 250 },
);
const HERO_PHONE = wakeShape(
  [
    [
      [-40, 450],
      [50, 372],
      [118, 474],
      [196, 414],
    ],
    [
      [196, 414],
      [236, 382],
      [250, 340],
      [282, 312],
    ],
  ],
  { step: 6, spread: 0.2, max: 46, beam: 6, arcEvery: 4, bow: 66, scale: 0.7, trail: 118 },
);

/** Where the boat comes in to its berth on the pontoon drawing, and the line it takes. */
const BERTH = 4;
const SLOT = { x: 60 + BERTH * 140 + 76, y: 141 };
const DOCK_PATH = `M${SLOT.x - 600} ${SLOT.y + 112}C${SLOT.x - 240} ${SLOT.y + 112} ${SLOT.x} ${SLOT.y + 140} ${SLOT.x} ${SLOT.y}`;

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function mailto(email: string, subject: string) {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}

/** A boat's wake drawn over the lake: crests, a churned middle, two spreading lines, rods out, and a strike at one lure. */
function LakeWake({ w, id, scale, s }: { w: WakeShape; id: string; scale: number; s: Record<string, string> }) {
  const lure = w.lines[0]?.lure;
  return (
    <>
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={w.boat.x} y1={w.boat.y} x2={w.tail[0]} y2={w.tail[1]}>
          <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g className={s.crests}>
        {w.arcs.map((a, i) => (
          <path key={i} d={a.d} style={{ '--i': i, '--b': a.back } as CSSProperties} />
        ))}
      </g>
      <path className={s.wash} d={w.centre} pathLength={1} stroke={`url(#${id})`} />
      <path className={s.edge} d={w.left} pathLength={1} stroke={`url(#${id})`} />
      <path className={s.edge} d={w.right} pathLength={1} stroke={`url(#${id})`} />
      {w.lines.map((l, i) => (
        <g key={i} className={s.rig}>
          <path d={l.d} />
          <circle cx={l.lure[0]} cy={l.lure[1]} r={3.2 * Math.max(0.8, scale)} />
        </g>
      ))}
      {lure && (
        <g className={s.strike}>
          <circle cx={lure[0]} cy={lure[1]} r={12 * scale} />
          <circle cx={lure[0]} cy={lure[1]} r={12 * scale} />
        </g>
      )}
      <g transform={`translate(${w.boat.x} ${w.boat.y}) rotate(${w.boat.deg}) scale(${scale})`}>
        <BoatTop className={s.sail} />
      </g>
    </>
  );
}

/**
 * A lifetime on one lake, drawn as the wake of a boat that keeps running. The opening screen is the
 * lake from above with the boat trolling across it; the methods are a dive under the boat; the hours
 * are a strip of water the boat runs up; and the page ends with the boat coming in to its berth
 * beside a letter to the skipper.
 */
function Demo({ data }: { data: PageData }) {
  const c = data.demo as Content;
  const { css, s } = designStyles('wake', ['Geologica', 'Source Serif 4']);
  const mail = mailto(c.email, c.subject);
  const steps = c.dive.steps;
  return (
    <div className={s.root}>
      <style href="wake" precedence="design">
        {css}
      </style>

      <section className={s.hero} id="top" data-hero aria-labelledby="hero-h">
        <div className={s.ripples} aria-hidden="true" />
        <svg className={`${s.lake} ${s.lakeDesk}`} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
          <LakeWake w={HERO_DESK} id="wake-desk" scale={1.45} s={s} />
        </svg>
        <svg className={`${s.lake} ${s.lakePhone}`} viewBox="0 0 390 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
          <LakeWake w={HERO_PHONE} id="wake-phone" scale={0.7} s={s} />
        </svg>

        <header className={s.top}>
          <a className={s.mark} href="#top">
            <i aria-hidden="true" />
            {c.wordmark[0]}
            <span>{c.wordmark[1]}</span>
          </a>
          <a className={s.topCall} href={c.free.tel}>
            {c.free.label} <b>{c.free.display}</b>
          </a>
        </header>

        <h1 id="hero-h" className={s.title} aria-label={c.hero.lines.join(' ')}>
          {c.hero.lines.map((l, i) => (
            <span key={l} className={s.line} aria-hidden="true">
              <span style={{ '--i': i } as CSSProperties}>{l}</span>
            </span>
          ))}
        </h1>

        <div className={s.heroFoot}>
          <div className={s.heroText}>
            <p className={s.kicker}>
              <i aria-hidden="true" />
              {c.hero.kicker}, {c.hero.place}
            </p>
            <p className={s.sub}>{c.hero.sub}</p>
          </div>
          <div className={s.heroAct}>
            <p className={s.from}>
              <span>{c.hero.price.what}</span>
              <b>{c.hero.price.value}</b>
              <span>{c.hero.price.unit}</span>
            </p>
            <div className={s.buttons}>
              <a className={s.btn} href={mail} data-press data-magnetic>
                <span>{c.book.label}</span>
                <i aria-hidden="true">
                  <Arrow />
                </i>
              </a>
              <a className={s.ghost} href={c.call.tel} data-press>
                {c.call.label}
              </a>
            </div>
          </div>
        </div>
      </section>

      <main>
        <section className={s.dive} id="methods" aria-labelledby="dive-h">
          <Pinned steps={steps.length} className={s.diveRun}>
            <div className={s.depth}>
              <div className={s.sky}>
                <p className={s.label}>{c.dive.kicker}</p>
                <h2 id="dive-h">{c.dive.heading}</h2>
              </div>
              <div className={s.rays} aria-hidden="true" />
              <svg className={s.bed} viewBox="0 0 1440 240" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <path d="M0 120C120 96 210 132 330 112C460 90 540 60 660 84C790 110 860 70 980 64C1110 58 1190 100 1300 92C1370 88 1410 76 1440 80V240H0Z" fill="#0a2a4a" />
                <path d="M0 168C150 150 260 176 400 160C560 142 640 120 780 136C920 152 1010 126 1150 124C1280 122 1360 146 1440 140V240H0Z" fill="#071d36" />
              </svg>
              <div className={s.stage} aria-hidden="true">
                <svg className={`${s.rig2} ${s.rigHarl}`} data-step={0} data-state="on" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
                  <path d="M100 0C70 12 34 62 0 100" vectorEffect="non-scaling-stroke" />
                </svg>
                <i className={`${s.rig2} ${s.rigJig}`} data-step={1} data-state="off" />
                <svg className={`${s.rig2} ${s.rigCable}`} data-step={2} data-state="off" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
                  <path d="M100 0L0 100" vectorEffect="non-scaling-stroke" />
                </svg>
                <svg className={`${s.rig2} ${s.rigLeader}`} data-step={2} data-state="off" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
                  <path d="M100 0C66 34 34 72 0 100" vectorEffect="non-scaling-stroke" />
                </svg>
                <BoatSide className={s.sideBoat} />
                <i className={`${s.lure} ${s.fly}`} data-step={0} data-state="on" />
                <i className={`${s.lure} ${s.jig}`} data-step={1} data-state="off" />
                <i className={`${s.lure} ${s.ball}`} data-step={2} data-state="off" />
                <i className={`${s.lure} ${s.spoon}`} data-step={2} data-state="off" />
                <span className={`${s.fish} ${s.f1}`} data-step={0} data-state="on">
                  <Trout kind="rainbow" />
                </span>
                <span className={`${s.fish} ${s.f2}`} data-step={1} data-state="off">
                  <Trout kind="brown" />
                </span>
                <span className={`${s.fish} ${s.f3}`} data-step={2} data-state="off">
                  <Trout kind="rainbow" />
                </span>
                <span className={`${s.fish} ${s.big} ${s.bigRainbow}`} data-step={3} data-state="off">
                  <Trout kind="rainbow" />
                </span>
                <span className={`${s.fish} ${s.big} ${s.bigBrown}`} data-step={3} data-state="off">
                  <Trout kind="brown" />
                </span>
              </div>
            </div>
            <ol className={s.steps}>
              {steps.map((st, i) => (
                <li key={st.word} data-step={i} data-state={i === 0 ? 'on' : 'off'}>
                  <p className={s.word}>
                    <span>{st.word}</span>
                  </p>
                  <p className={s.wordText}>{st.text}</p>
                </li>
              ))}
            </ol>
          </Pinned>
        </section>

        <section className={s.hours} id="hours" aria-labelledby="hours-h">
          <header className={s.hoursHead}>
            <p className={s.label}>{c.hours.kicker}</p>
            <h2 id="hours-h" data-reveal>
              {c.hours.heading}
            </h2>
            <p className={s.hoursLead} data-reveal>
              {c.hours.lead}
            </p>
          </header>
          <WakeHours
            modes={c.hours.modes}
            labels={{ mode: c.hours.modeLabel, hours: c.hours.hoursLabel, recommended: c.hours.recommended, send: c.hours.send, call: c.hours.callLabel }}
            email={c.email}
            call={{ tel: c.call.tel, display: c.call.display }}
            body={{ interests: c.end.letter.body.interests, hours: c.end.letter.body.hours, sign: c.end.letter.body.sign, greeting: c.end.letter.greeting }}
            cls={{
              root: s.hoursBox!,
              modes: s.modes!,
              mode: s.mode!,
              strip: s.strip!,
              run: s.run!,
              boat: s.stripBoat!,
              ticks: s.ticks!,
              tick: s.tick!,
              rec: s.rec!,
              sum: s.sum!,
              price: s.price!,
              amount: s.amount!,
              unit: s.unit!,
              notes: s.notes!,
              actions: s.actions!,
              btn: `${s.btn} ${s.btnInk}`,
              ghost: `${s.ghost} ${s.ghostInk}`,
            }}
          />
        </section>

        <section className={s.boat} id="boat" aria-labelledby="boat-h">
          <header className={s.boatHead}>
            <p className={s.label}>{c.boat.kicker}</p>
            <h2 id="boat-h" data-reveal>
              {c.boat.name}
            </h2>
            <ul className={s.spec}>
              {c.boat.spec.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </header>
          <figure className={s.boatPic} data-wipe>
            <Pic pic={pic(data, 'hero')} sizes="(min-width: 1100px) 720px, (min-width: 760px) 56vw, 100vw" />
          </figure>
          <div className={s.aboard}>
            <p className={s.boatLead} data-reveal>
              {c.boat.lead}
            </p>
            <ul className={s.plus}>
              {c.boat.aboard.map((a) => (
                <li key={a} data-reveal>
                  <i aria-hidden="true">+</i>
                  {a}
                </li>
              ))}
            </ul>
            <p className={s.cook} data-reveal>
              {c.boat.cook}
            </p>
            <p className={s.bring}>{c.boat.bring}</p>
          </div>
        </section>

        <section className={s.clear} id="cruise" aria-labelledby="clear-h">
          <WakeSeen className={s.vista} amount={0.3}>
            <h2 id="clear-h" className={s.clearHead}>
              {c.clear.heading}
            </h2>
            <Peaks className={s.peaks} />
            <div className={s.haze} aria-hidden="true" />
            <div className={s.water} aria-hidden="true">
              <span className={s.cruiser}>
                <i className={s.trail} />
                <BoatSide />
              </span>
            </div>
          </WakeSeen>
          <div className={s.clearBody}>
            <div className={s.clearText}>
              <p className={s.label}>{c.clear.kicker}</p>
              <p className={s.clearLine} data-reveal>
                {c.clear.text}
              </p>
            </div>
            <div className={s.carving} data-reveal>
              <h3>{c.clear.carving.heading}</h3>
              <p>{c.clear.carving.text}</p>
            </div>
            <div className={s.cruiseAct} data-reveal>
              <p className={s.cruisePrice}>
                <b>{c.clear.price.value}</b>
                <span>{c.clear.price.unit}</span>
              </p>
              <p className={s.small}>{c.clear.surcharge}</p>
              <a className={`${s.btn} ${s.btnInk}`} href={mailto(c.email, c.clear.subject)} data-press>
                <span>{c.clear.send}</span>
                <i aria-hidden="true">
                  <Arrow />
                </i>
              </a>
            </div>
          </div>
        </section>

        <section className={s.voices} id="words" aria-labelledby="words-h">
          <h2 id="words-h" className={s.label}>
            {c.words.heading}
          </h2>
          <figure className={s.bigQuote}>
            <blockquote>
              <WakeFill text={c.words.big.text} className={s.fill} />
            </blockquote>
            <figcaption>{c.words.big.who}</figcaption>
          </figure>
          <ul className={s.quotes}>
            {c.words.quotes.map((q) => (
              <li key={q.who} data-reveal>
                <blockquote>
                  <p>{q.text}</p>
                </blockquote>
                <p className={s.who}>{q.who}</p>
              </li>
            ))}
          </ul>
          {data.rating && (
            <p className={s.rating}>
              <b>{data.rating.value}</b>
              <span>
                {c.words.ratingFrom} {data.rating.count} {c.words.ratingUnit}
              </span>
              <small>{c.words.ratingSource}</small>
            </p>
          )}
        </section>

        <section className={s.end} id="contact" aria-labelledby="end-h">
          <WakeSeen className={s.marina} amount={0.5}>
            <svg viewBox="0 0 1200 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
              <Pontoon className={s.pontoon} mark={BERTH} />
              <text className={s.berthMark} x={SLOT.x} y="58" textAnchor="middle">
                {c.end.berth}
              </text>
              <path className={s.dockTrail} d={DOCK_PATH} pathLength={1} />
              <g transform={`translate(${SLOT.x} ${SLOT.y})`}>
                <g className={s.dockX}>
                  <g className={s.dockY}>
                    <g className={s.dockTurn}>
                      <path className={s.dockWake} d="M-66 -9L-170 -40M-66 9L-170 40" />
                      <BoatTop />
                    </g>
                  </g>
                </g>
              </g>
            </svg>
            <p className={s.berthTag}>
              {c.end.berthLabel} {c.end.berth}, {c.end.place}
            </p>
          </WakeSeen>
          <div className={s.endGrid}>
            <div className={s.endWrite}>
              <h2 id="end-h" data-reveal>
                {c.end.heading}
              </h2>
              <WakeLetter
                modes={c.hours.modes}
                words={c.end.letter}
                email={c.email}
                cls={{
                  root: s.letter!,
                  head: s.letterHead!,
                  sheet: s.sheet!,
                  sentence: s.sentence!,
                  token: s.token!,
                  count: s.count!,
                  step: s.stepBtn!,
                  flag: s.flag!,
                  date: s.date!,
                  rate: s.rate!,
                  send: `${s.btn} ${s.btnInk}`,
                  note: s.note!,
                }}
              />
            </div>
            <div className={s.endCall}>
              <p className={s.endLine}>{c.end.line}</p>
              <a className={s.bigPhone} href={c.call.tel} data-press>
                <span>{c.call.label}</span>
                <b>{c.call.display}</b>
              </a>
              <p className={s.phones}>
                <a href={c.free.tel}>
                  <span>{c.free.label}</span> {c.free.display}
                </a>
                <a href={c.intl.tel}>
                  <span>{c.intl.label}</span> {c.intl.display}
                </a>
              </p>
              <a className={s.mailLink} href={mail}>
                {c.email}
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className={s.foot}>
        <p className={s.footMark}>
          {c.wordmark[0]} <span>{c.wordmark[1]}</span>
        </p>
        <p>{c.end.address}</p>
        <p>{c.end.payment}</p>
        <p>{c.end.vouchers}</p>
        <DemoFoot domain={data.domain} />
      </footer>

      <StickyBar main={{ label: c.book.label, href: mail, external: true }} call={{ label: c.call.label, tel: c.call.tel }} />
    </div>
  );
}

export const wake: Design = {
  Demo,
  fonts: ['geologica-latin-wght-normal', 'source-serif-4-latin-wght-normal'],
  heroSizes: '(min-width: 1100px) 720px, (min-width: 760px) 56vw, 100vw',
};
