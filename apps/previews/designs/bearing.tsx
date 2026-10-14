import type { CSSProperties } from 'react';
import { BearingAim } from '@/components/BearingAim';
import { BearingContact, type ContactWay } from '@/components/BearingContact';
import { BearingDial } from '@/components/BearingDial';
import { BearingGuests, type GuestQuote } from '@/components/BearingGuests';
import { BearingMap, type MapPlace } from '@/components/BearingMap';
import { BearingSeen } from '@/components/BearingSeen';
import { DemoFoot } from '@/components/DemoFoot';
import { Pic } from '@/components/Pic';
import { Pinned } from '@/components/Pinned';
import { StickyBar } from '@/components/StickyBar';
import { pic, type PageData } from '@/lib/data';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Link {
  label: string;
  href: string;
}

interface Stop {
  at: number;
  bearing: string;
  kind: string;
  place: string;
  text: string;
  image: string;
}

interface Content {
  wordmark: string;
  place: string;
  nav: Link[];
  book: Link;
  call: { label: string; tel: string; display: string };
  email: string;
  points: string[];
  hero: { lines: string[]; kicker: string; sub: string };
  direct: { kicker: string; heading: string; lead: string; life: { tag: string; text: string }[]; name: string; team: string; jock: string; image: string };
  calls: { kicker: string; heading: string; lead: string; from: string; stops: Stop[] };
  map: {
    kicker: string;
    heading: string;
    lead: string;
    hint: string;
    centre: string;
    rings: { id: string; label: string }[];
    places: MapPlace[];
    askAbout: string;
    askNone: string;
    and: string;
    subject: string;
    hello: string;
    ask: string;
    fields: string[];
    start: string[];
    demo: string[];
  };
  guests: {
    kicker: string;
    heading: string;
    lead: string;
    next: string;
    quotes: GuestQuote[];
    award: { name: string; level: string; year: string; line: string };
  };
  end: { image: string; invite: string; sign: string; kicker: string; heading: string; ways: ContactWay[]; agents: string };
}

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
      <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
    </svg>
  );
}

/**
 * A guide's compass that always points at you. The compass of their logo stands between the two halves
 * of the headline, a lake in its face, and its needle settles on "you". Layers slide off the guide, whose
 * own story runs along a bearing line. A large dial turns as the visitor scrolls, carrying the places he
 * can open round to the marker at their true bearings. A chart of his day trips by bearing and length is
 * marked, and the marks become the request. Guests speak from every bearing. Four compass points are the
 * four direct ways to reach him, and the page ends there.
 */
function Demo({ data }: { data: PageData }) {
  const c = data.demo as Content;
  const { css, s } = designStyles('bearing', ['Italiana', 'Instrument Sans']);
  const book = { href: c.book.href, rel: 'noopener' };
  const dial = { svg: s.dialSvg, ring: s.dialRing, ticks: s.dialTicks, major: s.dialMajor, points: s.dialPoints, needle: s.dialNeedle, tip: s.dialTip, tail: s.dialTail, hub: s.dialHub };
  const stops = c.calls.stops;
  const storyVars = Object.fromEntries(stops.map((st, i) => [`--a${i}`, st.at])) as CSSProperties;
  const aimId = 'bearing-you';
  const [first, ...rest] = c.hero.lines;
  const award = c.guests.award;

  return (
    <div className={s.root}>
      <style href="bearing" precedence="design">
        {css}
      </style>

      <header className={s.hero} id="top" data-hero>
        <div className={s.top}>
          <a className={s.mark} href="#top" aria-label={c.wordmark}>
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
              <circle cx="10" cy="10" r="8.6" fill="none" stroke="currentColor" strokeWidth="1.2" />
              <path d="M10 2.6L12 10H8Z" fill="currentColor" />
              <path d="M8 10H12L10 17.4Z" fill="currentColor" opacity="0.4" />
            </svg>
            <span>{c.wordmark}</span>
          </a>
          <p className={s.where}>{c.place}</p>
          <nav className={s.nav} aria-label="Sections">
            {c.nav.map((n) => (
              <a key={n.href} href={n.href}>
                {n.label}
              </a>
            ))}
          </nav>
        </div>

        <h1 className={s.title} aria-label={c.hero.lines.join(' ')}>
          <span className={s.line} data-line="first" aria-hidden="true">
            <span style={{ '--i': 0 } as CSSProperties}>{first}</span>
          </span>
          <BearingAim target={aimId} className={s.heroDial}>
            <span className={s.heroFace}>
              <Pic pic={pic(data, 'hero')} sizes="(min-width: 900px) 360px, 66vw" first />
            </span>
            <BearingDial points={c.points} cls={dial} pointsAt={108} />
          </BearingAim>
          <span className={s.line} data-line="last" aria-hidden="true">
            <span id={aimId} style={{ '--i': 1 } as CSSProperties}>
              {rest.join(' ')}
            </span>
          </span>
        </h1>

        <div className={s.heroText}>
          <p className={s.kicker}>{c.hero.kicker}</p>
          <p className={s.sub}>{c.hero.sub}</p>
          <a className={s.go} data-press data-magnetic {...book}>
            <span>{c.book.label}</span>
            <i>
              <Arrow />
            </i>
          </a>
        </div>
      </header>

      <main>
        <section className={s.direct} id="direct" aria-labelledby="direct-h">
          <header className={s.directHead}>
            <p className={s.kicker} data-reveal>
              {c.direct.kicker}
            </p>
            <h2 id="direct-h" data-reveal>
              {c.direct.heading}
            </h2>
            <p className={s.directLead} data-reveal>
              {c.direct.lead}
            </p>
          </header>
          <figure className={s.portrait} data-seen>
            <Pic pic={pic(data, c.direct.image)} sizes="(min-width: 900px) 34vw, 100vw" />
            <span className={s.layers} aria-hidden="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <i key={i} style={{ '--i': i } as CSSProperties} />
              ))}
            </span>
            <figcaption className={s.portraitName}>{c.direct.name}</figcaption>
          </figure>
          <span className={s.lifeLine} aria-hidden="true" />
          <ol className={s.life}>
            {c.direct.life.map((l, i) => (
              <li key={l.tag} data-seen style={{ '--i': i } as CSSProperties}>
                <span className={s.lifeTag}>{l.tag}</span>
                <p>{l.text}</p>
              </li>
            ))}
          </ol>
          <p className={s.team} data-reveal>
            {c.direct.team} {c.direct.jock}
          </p>
        </section>

        <section className={s.calls} id="calls" aria-labelledby="calls-h">
          <Pinned steps={stops.length} className={s.story} style={storyVars}>
            <header className={s.storyHead}>
              <p className={s.kicker}>{c.calls.kicker}</p>
              <h2 id="calls-h">{c.calls.heading}</h2>
              <p className={s.storyLead}>{c.calls.lead}</p>
            </header>
            <div className={s.wheel}>
              <div className={s.bigDial} aria-hidden="true">
                <BearingDial points={c.points} cls={dial} needle={false} />
              </div>
              <span className={s.marker} aria-hidden="true">
                <i />
                <b>{c.calls.from}</b>
              </span>
              <ul className={s.orbit}>
                {stops.map((st, i) => (
                  <li key={st.place} className={s.sat} data-step={i} data-state={i === 0 ? 'on' : 'off'} style={{ '--at': st.at } as CSSProperties}>
                    <span className={s.satIn}>
                      <Pic pic={pic(data, st.image)} sizes="(min-width: 900px) 440px, 240px" />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <ol className={s.reads}>
              {stops.map((st, i) => (
                <li key={st.place} className={s.read} data-step={i} data-state={i === 0 ? 'on' : 'off'}>
                  <p className={s.bear}>{st.bearing}</p>
                  <p className={s.kind}>{st.kind}</p>
                  <h3>{st.place}</h3>
                  <p className={s.readText}>{st.text}</p>
                </li>
              ))}
            </ol>
          </Pinned>
        </section>

        <section className={s.mapSection} id="map" aria-labelledby="map-h">
          <header className={s.mapHead}>
            <p className={s.kicker} data-reveal>
              {c.map.kicker}
            </p>
            <h2 id="map-h" data-reveal>
              {c.map.heading}
            </h2>
            <p className={s.mapLead} data-reveal>
              {c.map.lead}
            </p>
            <p className={s.hint} data-reveal>
              {c.map.hint}
            </p>
          </header>
          <BearingMap
            places={c.map.places}
            rings={c.map.rings}
            centre={c.map.centre}
            points={c.points}
            email={c.email}
            start={c.map.start}
            demo={c.map.demo}
            labels={{ askAbout: c.map.askAbout, askNone: c.map.askNone, and: c.map.and, subject: c.map.subject, hello: c.map.hello, ask: c.map.ask, fields: c.map.fields }}
            cls={{
              map: s.map,
              chart: s.chart,
              chartSvg: s.chartSvg,
              spoke: s.spoke,
              ringLine: s.ringLine,
              ringLabel: s.ringLabel,
              point: s.point,
              needle: s.mapNeedle,
              needleTip: s.mapNeedleTip,
              dot: s.dot,
              ping: s.ping,
              pulse: s.pulse,
              dotCore: s.dotCore,
              centreDot: s.centreDot,
              centre: s.centre,
              place: s.place,
              panel: s.panel,
              focus: s.focus,
              send: s.send,
            }}
          />
        </section>

        <section className={s.guestsSection} id="guests" aria-labelledby="guests-h">
          <header className={s.guestsHead}>
            <p className={s.kicker} data-reveal>
              {c.guests.kicker}
            </p>
            <h2 id="guests-h" data-reveal>
              {c.guests.heading}
            </h2>
            <p className={s.guestsLead} data-reveal>
              {c.guests.lead}
            </p>
          </header>
          <BearingGuests
            quotes={c.guests.quotes}
            next={c.guests.next}
            points={c.points}
            dial={dial}
            cls={{ guests: s.guests, guestDial: s.guestDial, guestBearing: s.guestBearing, says: s.says, say: s.say, nextGuest: s.nextGuest }}
          />
          <div className={s.award} data-reveal>
            <p className={s.awardMark}>
              <span>{award.name}</span> <b>{award.level}</b> <i>{award.year}</i>
            </p>
            <p className={s.awardLine}>{award.line}</p>
          </div>
        </section>

        <section className={s.end} id="contact" aria-labelledby="end-h">
          <figure className={s.endPic} data-wipe>
            <Pic pic={pic(data, c.end.image)} sizes="(min-width: 900px) 40vw, 100vw" />
          </figure>
          <blockquote className={s.invite} data-reveal>
            <p>{c.end.invite}</p>
            <footer>{c.end.sign}</footer>
          </blockquote>
          <div className={s.endMain}>
            <p className={s.kicker} data-reveal>
              {c.end.kicker}
            </p>
            <h2 id="end-h" data-reveal>
              {c.end.heading}
            </h2>
            <BearingContact ways={c.end.ways} points={c.points} dial={dial} cls={{ compass: s.compass, dialBox: s.dialBox, ways: s.ways, way: s.way }} />
            <p className={s.agents}>{c.end.agents}</p>
            <footer className={s.endFoot}>
              <DemoFoot domain={data.domain} />
            </footer>
          </div>
        </section>
      </main>

      <BearingSeen />
      <StickyBar main={{ label: c.book.label, href: c.book.href, external: true }} call={{ label: c.call.label, tel: c.call.tel }} />
    </div>
  );
}

export const bearing: Design = { Demo, fonts: ['italiana-latin-400-normal', 'instrument-sans-latin-wght-normal'], heroSizes: '(min-width: 900px) 360px, 66vw' };
