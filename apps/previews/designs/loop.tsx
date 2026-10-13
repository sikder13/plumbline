import type { CSSProperties } from 'react';
import { DayPicker } from '@/components/DayPicker';
import { DemoFoot } from '@/components/DemoFoot';
import { FlapBoard, type BoardRow } from '@/components/FlapBoard';
import { Pic } from '@/components/Pic';
import { Pinned } from '@/components/Pinned';
import { SideScroll } from '@/components/SideScroll';
import { StickyBar } from '@/components/StickyBar';
import { pic, type PageData } from '@/lib/data';
import type { Design } from './types';
import s from './loop.module.css';

interface Stop {
  time: string;
  place: string;
}

interface Content {
  wordmark: string[];
  nav: { label: string; href: string }[];
  book: { label: string; href: string };
  call: { label: string; tel: string; display: string };
  email: string;
  hero: { kicker: string; lines: string[]; sub: string; stops: Stop[] };
  loop: { heading: string; lead: string; steps: { when: string; place: string; text: string }[]; places: number; placesLabel: string };
  day: { heading: string; lead: string; venues: string[]; max: number; labels: Parameters<typeof DayPicker>[0]['labels']; price?: { label: string; value: string } };
  board: { heading: string; service: string; columns: [string, string]; clock: string; zone: string; rows: BoardRow[]; back: { when: string; what: string }; note: string };
  bike: {
    kicker: string;
    first: string;
    later: string;
    lead: string;
    departures: Stop[];
    trailLabel: string;
    trail: { name: string; note?: string }[];
    laterText: string;
    prices: { label: string; value: string }[];
    book: { label: string; href: string };
  };
  onDay: { heading: string; lead: string; cue: string; items: { image: string; name: string; text: string; size: 'tall' | 'short' }[] };
  trust: { ratingLabel: string; ratingUnit: string; ratingSource: string; heading: string; text: string; year: string; yearLabel: string; caption: string };
  end: { heading: string; line: string; local: { label: string; value: string }; hours: { label: string; value: string }[]; post: string };
}

/** The loop line: two straights joined by half circles, drawn clockwise from its first stop at the top left. The named stops sit along the top. */
const X0 = 86;
const Y0 = 60;
const STRAIGHT = 190;
const RADIUS = 72;
const BETWEEN_STOPS = 86;
const LOOP = `M${X0} ${Y0}H${X0 + STRAIGHT}a${RADIUS} ${RADIUS} 0 0 1 0 ${2 * RADIUS}H${X0}a${RADIUS} ${RADIUS} 0 0 1 0-${2 * RADIUS}Z`;

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Small dots along the far end of the loop, one for each place the business lists. They are not a map. */
function Places({ count }: { count: number }) {
  const arc = Math.PI * RADIUS;
  const [far, middle, low] = [X0 + STRAIGHT, Y0 + RADIUS, Y0 + 2 * RADIUS];
  const dots = Array.from({ length: count }, (_, i) => {
    // Spread from just past the third stop, round the far end and most of the way back.
    const d = (0.3 + (i / Math.max(1, count - 1)) * 0.56) * (2 * STRAIGHT + 2 * arc);
    let x: number;
    let y: number;
    if (d <= STRAIGHT) [x, y] = [X0 + d, Y0];
    else if (d <= STRAIGHT + arc) {
      const a = (d - STRAIGHT) / RADIUS;
      [x, y] = [far + RADIUS * Math.sin(a), middle - RADIUS * Math.cos(a)];
    } else if (d <= 2 * STRAIGHT + arc) [x, y] = [far - (d - STRAIGHT - arc), low];
    else {
      const a = (d - 2 * STRAIGHT - arc) / RADIUS;
      [x, y] = [X0 - RADIUS * Math.sin(a), middle + RADIUS * Math.cos(a)];
    }
    return <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="3.4" style={{ '--i': i } as CSSProperties} />;
  });
  return <g data-places>{dots}</g>;
}

/**
 * A day you put together yourself, drawn as a line. A route draws itself across the opening
 * photograph and ends at the one action. The afternoon is then told as a loop held in view, stop
 * by stop; the visitor picks places onto a card; the times stand on a departures board; and the
 * morning by bike gives way to the afternoon by wine across one photograph.
 */
function Demo({ data }: { data: PageData }) {
  const c = data.demo as Content;
  const book = { href: c.book.href, rel: 'noopener' };
  return (
    <div className={s.root}>
      <nav className={s.nav} aria-label="Sections">
        <span className={s.navLinks}>
          {c.nav.map((n) => (
            <a key={n.href} href={n.href}>
              {n.label}
            </a>
          ))}
        </span>
        <a className={s.navBook} data-press data-magnetic {...book}>
          {c.book.label}
        </a>
      </nav>

      <section className={s.hero} id="top" data-hero>
        <div className={s.heroMedia}>
          <Pic pic={pic(data, 'hero')} phone={data.images.heroPhone} sizes="100vw" first />
        </div>
        <a className={s.mark} href="#top" aria-label={data.name}>
          <i aria-hidden="true" />
          {c.wordmark.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </a>
        <div className={s.heroText}>
          <p className={s.kicker}>{c.hero.kicker}</p>
          <h1 aria-label={c.hero.lines.join(' ')}>
            {c.hero.lines.map((l, i) => (
              <span key={l} className={s.line} aria-hidden="true">
                <span style={{ '--i': i } as CSSProperties}>{l}</span>
              </span>
            ))}
          </h1>
          <p className={s.sub}>{c.hero.sub}</p>
          <div className={s.route}>
            <span className={s.rail} aria-hidden="true" />
            <svg className={s.bend} viewBox="0 0 28 46" aria-hidden="true" focusable="false">
              <path d="M0 1H5Q27 1 27 23V46" pathLength={1} />
            </svg>
            <span className={s.drop} aria-hidden="true" />
            <ol className={s.stops}>
              {c.hero.stops.map((st, i) => (
                <li key={st.time} style={{ '--i': i } as CSSProperties}>
                  <i aria-hidden="true" />
                  <b>{st.time}</b>
                  <span>{st.place}</span>
                </li>
              ))}
            </ol>
            <a className={s.go} data-press data-magnetic {...book}>
              {c.book.label}
              <Arrow />
            </a>
          </div>
        </div>
      </section>

      <main>
        <section className={s.loop} id="loop" aria-labelledby="loop-h">
          <Pinned steps={c.loop.steps.length} className={s.story}>
            <header className={s.storyHead}>
              <h2 id="loop-h">{c.loop.heading}</h2>
              <p>{c.loop.lead}</p>
            </header>
            <div className={s.chart} aria-hidden="true">
              <svg viewBox="0 0 362 222" focusable="false">
                <path className={s.track} d={LOOP} />
                <Places count={c.loop.places} />
                <path className={s.travelled} d={LOOP} pathLength={1} />
                {c.loop.steps.slice(0, 3).map((st, i) => (
                  <g key={st.place} data-step={i} data-state={i === 0 ? 'on' : 'off'} className={s.station} transform={`translate(${X0 + i * BETWEEN_STOPS} ${Y0})`}>
                    <circle r="7" />
                    <text y="-18">{st.when}</text>
                    <text y="26" data-name>
                      {st.place}
                    </text>
                  </g>
                ))}
                <g className={s.inside} transform={`translate(${X0 + STRAIGHT / 2} ${Y0 + RADIUS})`}>
                  <text y="22">{c.loop.places}</text>
                  <text y="44" data-label>
                    {c.loop.placesLabel}
                  </text>
                </g>
                <path className={s.halo} d={LOOP} pathLength={1} />
                <path className={s.bus} d={LOOP} pathLength={1} />
                <path className={s.busCore} d={LOOP} pathLength={1} />
              </svg>
            </div>
            <ol className={s.steps}>
              {c.loop.steps.map((st, i) => (
                <li key={st.place} data-step={i} data-state={i === 0 ? 'on' : 'off'}>
                  <p className={s.when}>{st.when}</p>
                  <h3>{st.place}</h3>
                  <p className={s.stepText}>{st.text}</p>
                </li>
              ))}
            </ol>
            <p className={s.count} aria-hidden="true">
              {c.loop.steps.map((st, i) => (
                <i key={st.place} data-step={i} data-state={i === 0 ? 'on' : 'off'} />
              ))}
            </p>
          </Pinned>
        </section>

        <section className={s.day} id="day" aria-labelledby="day-h">
          <header className={s.dayHead}>
            <h2 id="day-h" data-reveal>
              {c.day.heading}
            </h2>
            <p data-reveal>{c.day.lead}</p>
          </header>
          <DayPicker className={s.picker} venues={c.day.venues} max={c.day.max} labels={c.day.labels} price={c.day.price} book={c.book} />
        </section>

        <section className={s.board} id="departures" aria-labelledby="board-h">
          <header className={s.boardHead}>
            <h2 id="board-h" data-reveal>
              {c.board.heading}
            </h2>
            <p className={s.service}>
              <i aria-hidden="true" />
              {c.board.service}
            </p>
          </header>
          <FlapBoard className={s.flaps} rows={c.board.rows} columns={c.board.columns} clock={{ label: c.board.clock, zone: c.board.zone }} />
          <p className={s.back} data-reveal>
            <b>{c.board.back.when}</b>
            <span>{c.board.back.what}</span>
          </p>
          <p className={s.boardNote} data-reveal>
            {c.board.note}
          </p>
        </section>

        <section className={s.bike} id="bike" aria-labelledby="bike-h">
          <Pinned steps={3} className={s.scenes}>
            <h2 id="bike-h" className={s.srOnly}>
              {c.bike.first} {c.bike.later}
            </h2>
            <div className={s.scene} data-scene="bike">
              <Pic pic={pic(data, 'bike')} phone={data.images.bikePhone} sizes="100vw" />
              <div className={s.sceneText}>
                <p className={s.kicker}>{c.bike.kicker}</p>
                <p className={s.sceneTitle} aria-hidden="true">
                  {c.bike.first}
                </p>
                <div className={s.sceneSteps}>
                  <div data-step={0} data-state="on">
                    <p className={s.sceneLead}>{c.bike.lead}</p>
                    <ol className={s.miniLine}>
                      {c.bike.departures.map((d) => (
                        <li key={d.time}>
                          <b>{d.time}</b>
                          <span>{d.place}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div data-step={1} data-state="off">
                    <p className={s.trailLabel}>{c.bike.trailLabel}</p>
                    <ol className={s.trail}>
                      {c.bike.trail.map((t) => (
                        <li key={t.name}>
                          <b>{t.name}</b>
                          {t.note && <span>{t.note}</span>}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>
            </div>
            <div className={s.scene} data-scene="wine">
              <Pic pic={pic(data, 'pour')} phone={data.images.pourPhone} sizes="100vw" />
              <div className={s.sceneText}>
                <p className={s.kicker}>{c.bike.kicker}</p>
                <p className={s.sceneTitle} aria-hidden="true">
                  {c.bike.later}
                </p>
                <p className={s.sceneLead}>{c.bike.laterText}</p>
                <dl className={s.fares}>
                  {c.bike.prices.map((p) => (
                    <div key={p.label}>
                      <dt>{p.label}</dt>
                      <dd>{p.value}</dd>
                    </div>
                  ))}
                </dl>
                <a className={s.go} data-press href={c.bike.book.href} rel="noopener">
                  {c.bike.book.label}
                  <Arrow />
                </a>
              </div>
            </div>
            <span className={s.seam} aria-hidden="true" />
          </Pinned>
        </section>

        <section className={s.onDay} id="on-the-day" aria-labelledby="on-h">
          <SideScroll
            className={s.side}
            label={c.onDay.heading}
            cue={c.onDay.cue}
            head={
              <header className={s.onHead}>
                <h2 id="on-h" data-reveal>
                  {c.onDay.heading}
                </h2>
                <p data-reveal>{c.onDay.lead}</p>
              </header>
            }
          >
            {c.onDay.items.map((it, i) => (
              <article key={it.name} className={s.card} data-size={it.size}>
                <p className={s.cardNo} aria-hidden="true">
                  <i />
                  {String(i + 1).padStart(2, '0')}
                </p>
                <div className={s.cardPhoto} data-wipe>
                  <Pic pic={pic(data, it.image)} sizes="(min-width: 900px) 30vw, 72vw" />
                </div>
                <h3>{it.name}</h3>
                <p className={s.cardText}>{it.text}</p>
              </article>
            ))}
          </SideScroll>
        </section>

        <section className={s.trust} aria-labelledby="trust-h">
          <figure className={s.trustPhoto} data-wipe data-parallax-frame>
            <Pic pic={pic(data, 'guide')} sizes="(min-width: 900px) 50vw, 100vw" parallax />
            <figcaption>{c.trust.caption}</figcaption>
          </figure>
          <div className={s.trustText}>
            <h2 id="trust-h" data-reveal>
              {c.trust.heading}
            </h2>
            <p className={s.trustLine} data-reveal>
              {c.trust.text}
            </p>
            <div className={s.figures}>
              {data.rating && (
                <p data-reveal>
                  <b data-count>{data.rating.value}</b>
                  <span>
                    {c.trust.ratingLabel} <span data-count>{String(data.rating.count)}</span> {c.trust.ratingUnit}
                    <small>{c.trust.ratingSource}</small>
                  </span>
                </p>
              )}
              <p data-reveal>
                <b>{c.trust.year}</b>
                <span>{c.trust.yearLabel}</span>
              </p>
            </div>
          </div>
        </section>

        <section className={s.end} id="contact" aria-labelledby="end-h">
          <h2 id="end-h" data-reveal>
            {c.end.heading}
          </h2>
          <p className={s.endLine} data-reveal>
            {c.end.line}
          </p>
          <div className={s.reach} data-reveal>
            <a href={c.call.tel}>{c.call.display}</a>
            <a href={`mailto:${c.email}`}>{c.email}</a>
          </div>
          <dl className={s.hours}>
            <div>
              <dt>{c.end.local.label}</dt>
              <dd>{c.end.local.value}</dd>
            </div>
            {c.end.hours.map((h) => (
              <div key={h.label}>
                <dt>{h.label}</dt>
                <dd>{h.value}</dd>
              </div>
            ))}
          </dl>
          <a className={s.go} data-press data-magnetic {...book}>
            {c.book.label}
            <Arrow />
          </a>
        </section>
      </main>

      <footer className={s.foot}>
        <span className={s.footMark}>
          <i aria-hidden="true" />
          {c.wordmark.join(' ')}
        </span>
        <p className={s.post}>{c.end.post}</p>
        <DemoFoot domain={data.domain} />
      </footer>

      <StickyBar main={{ label: c.book.label, href: c.book.href, external: true }} call={{ label: c.call.label, tel: c.call.tel }} />
    </div>
  );
}

export const loop: Design = { Demo, fonts: ['archivo-latin-wdth-normal', 'archivo-latin-wght-normal'], heroSizes: '100vw' };
