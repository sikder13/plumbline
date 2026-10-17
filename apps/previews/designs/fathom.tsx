import type { CSSProperties } from 'react';
import { DemoFoot } from '@/components/DemoFoot';
import { FathomDepth } from '@/components/FathomDepth';
import { FathomDial, type DialMonth } from '@/components/FathomDial';
import { FathomFill } from '@/components/FathomFill';
import { FathomHold } from '@/components/FathomHold';
import { FathomSurface } from '@/components/FathomSurface';
import { FathomWarm } from '@/components/FathomWarm';
import { Pic } from '@/components/Pic';
import { SectionLinks } from '@/components/SectionLinks';
import { StickyBar } from '@/components/StickyBar';
import { pic, type PageData } from '@/lib/data';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Link {
  label: string;
  href: string;
}

interface Fare {
  who: string;
  price: string;
}

type Where = 'dry' | 'surface' | 'wet';

interface Stage {
  where: Where;
  label: string;
  title: string;
  lines: string[];
  kit?: string[];
  image?: string;
}

interface Content {
  wordmark: string;
  season: string;
  nav: Link[];
  book: Link;
  call: { label: string; tel: string; display: string };
  mark: { name: string; place: string };
  email: string;
  fares: { short: Fare[]; rows: Fare[] };
  hero: { lines: string[]; sub: string; team: string; flag: string };
  crew: { kicker: string; heading: string; year: string; lines: string[]; termsLabel: string; terms: string[] };
  dive: {
    kicker: string;
    heading: string;
    you: string;
    start: string;
    max: number;
    unit: string;
    stops: { kicker: string; title: string; text: string; note?: string }[];
  };
  year: { kicker: string; heading: string; lead: string; labels: Parameters<typeof FathomDial>[0]['labels']; months: DialMonth[]; zone: string };
  tour: {
    kicker: string;
    heading: string;
    lead: string;
    span: string;
    /** The part of the whole trip spent in the water, as the business gives the two times. */
    waterShare: number;
    chart: string[];
    stages: Stage[];
    promise: { label: string; text: string };
    card: { label: string; title: string; note: string; refund: string };
  };
  proof: {
    kicker: string;
    heading: string;
    line: string;
    ratingLabel: string;
    ratingSource: string;
    tripadvisor: { value: string; label: string };
    quotes: { text: string; who: string }[];
    where: string;
  };
  end: {
    kicker: string;
    heading: string;
    line: string;
    ways: { label: string; note: string; extra?: string; links: { text: string; href: string }[] }[];
  };
  foot: { line: string };
}

/** The mark on every booking button: a short swell, not an arrow. */
function Wave() {
  return (
    <svg viewBox="0 0 24 12" width="22" height="11" aria-hidden="true" focusable="false">
      <path d="M1.5 6c2.4-3.6 4.8-3.6 7.2 0s4.8 3.6 7.2 0 4.8-3.6 6.6 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** A long low swell, drawn twice across so it can sway without showing an end. */
function Swell({ className }: { className?: string }) {
  const d = 'M0 30C60 30 90 12 150 12S240 30 300 30 390 12 450 12 540 30 600 30 690 12 750 12 840 30 900 30 990 12 1050 12 1140 30 1200 30V60H0Z';
  return (
    <svg className={className} viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  );
}

/** The prices, set beside a booking button. */
function Fares({ rows, className }: { rows: Fare[]; className?: string }) {
  return (
    <p className={className}>
      {rows.map((r) => (
        <span key={r.who}>
          {r.who} <b>{r.price}</b>
        </span>
      ))}
    </p>
  );
}

/** Heights of the trip's line in its drawing: ashore, on the surface, in the water. The waterline is at 100. */
const LEVEL: Record<Where, number> = { dry: 38, surface: 100, wet: 166 };

/** The trip in phases (ashore, out on the surface, in the water, back), each as wide as its share of the time. */
function phases(stages: Stage[], waterShare: number) {
  const groups: { where: Where; stages: Stage[] }[] = [];
  for (const st of stages) {
    const last = groups[groups.length - 1];
    if (last && last.where === st.where) last.stages.push(st);
    else groups.push({ where: st.where, stages: [st] });
  }
  const wet = groups.filter((g) => g.where === 'wet').length;
  const other = groups.length > wet ? (1 - waterShare * wet) / (groups.length - wet) : 0;
  let x = 0;
  const spans = groups.map((g) => {
    const w = g.where === 'wet' ? waterShare : other;
    const from = x;
    x += w;
    return { from, w };
  });
  let d = `M0 ${LEVEL[groups[0]!.where]}`;
  for (let i = 1; i < groups.length; i++) {
    const b = spans[i]!.from * 1000;
    const [y0, y1] = [LEVEL[groups[i - 1]!.where], LEVEL[groups[i]!.where]];
    d += `H${(b - 26).toFixed(1)}C${b.toFixed(1)} ${y0} ${b.toFixed(1)} ${y1} ${(b + 26).toFixed(1)} ${y1}`;
  }
  return { groups, spans, profile: `${d}H1000` };
}

/**
 * A swim on the seals' own terms, told along one waterline. The page opens on it with the name
 * surfacing through it and a buoy riding it; the seal dives from it while the depth counts and the
 * light goes; their year turns on a dial; the tour is drawn as the line a swimmer follows, ashore,
 * out on the surface, an hour in the water and back; and the page closes on the boat's yellow hull.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('fathom', ['Instrument Serif', 'Onest']);
  const c = data.demo as Content;
  const book = { href: c.book.href, rel: 'noopener' };
  const trip = phases(c.tour.stages, c.tour.waterShare);

  return (
    <div className={s.root}>
      <style href="fathom" precedence="design">
        {css}
      </style>
      <nav className={s.rail} aria-label="Sections">
        <SectionLinks className={s.railLinks} items={c.nav} />
      </nav>
      <main>
        <a className={s.dock} data-press data-magnetic {...book}>
          <Wave />
          <span>{c.book.label}</span>
        </a>

        <section className={s.hero} id="top" data-hero>
          <div className={s.sea}>
            <Pic pic={pic(data, 'hero')} phone={data.images.heroPhone} sizes="100vw" first />
            <span className={s.rays} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className={s.motes} aria-hidden="true">
              {Array.from({ length: 9 }, (_, i) => (
                <i key={i} style={{ '--i': i } as CSSProperties} />
              ))}
            </span>
          </div>
          <FathomSurface cls={{ ripple: s.ripple, air: s.rippleAir, line: s.rippleLine, bubbles: s.bubbles }} />

          <header className={s.top}>
            <a className={s.mark} href="#top" aria-label={c.wordmark}>
              <span aria-hidden="true">{c.mark.name}</span>
              <small aria-hidden="true">{c.mark.place}</small>
            </a>
            <p className={s.season}>
              <i aria-hidden="true" />
              {c.season}
            </p>
          </header>
          <p className={s.team}>{c.hero.team}</p>

          <h1 className={s.title} aria-label={c.hero.lines.join(' ')}>
            {c.hero.lines.map((line, i) => (
              <span key={line} className={s.row} aria-hidden="true" style={{ '--i': i } as CSSProperties}>
                <span className={s.dry}>
                  <span>{line}</span>
                </span>
                <span className={s.wet}>
                  <span>
                    <span>{line}</span>
                  </span>
                </span>
              </span>
            ))}
          </h1>

          <div className={s.buoy} data-buoy aria-hidden="true">
            <span className={s.buoyBob}>
              <span className={s.flag}>{c.hero.flag}</span>
              <i className={s.mast} />
              <i className={s.float} />
            </span>
          </div>

          <div className={s.heroFoot}>
            <p className={s.sub}>{c.hero.sub}</p>
            <div className={s.act}>
              <a className={s.go} data-press data-magnetic {...book}>
                <Wave />
                {c.book.label}
              </a>
              <Fares rows={c.fares.short} className={s.faresLine} />
            </div>
          </div>
        </section>

        <section className={s.crew} id="crew" aria-labelledby="crew-h">
          <p className={s.crewYear} aria-hidden="true" data-parallax>
            {c.crew.year}
          </p>
          <div className={s.crewHead}>
            <p className={s.kicker}>{c.crew.kicker}</p>
            <h2 id="crew-h">{c.crew.heading}</h2>
          </div>
          <FathomFill className={s.fill} lines={c.crew.lines} />
          <div className={s.terms}>
            <p className={s.termsLabel} data-reveal>
              {c.crew.termsLabel}
            </p>
            <ul>
              {c.crew.terms.map((t) => (
                <li key={t} data-reveal>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={s.dive} id="dive" aria-labelledby="dive-h">
          <FathomHold steps={c.dive.stops.length} className={s.descent}>
            <div className={s.deep} aria-hidden="true">
              <i className={s.glow} />
              <i className={s.dark} />
              <span className={s.snow}>
                {Array.from({ length: 14 }, (_, i) => (
                  <i key={i} style={{ '--i': i } as CSSProperties} />
                ))}
              </span>
            </div>
            <div className={s.air}>
              <header className={s.diveHead}>
                <p className={s.kicker}>{c.dive.kicker}</p>
                <h2 id="dive-h">{c.dive.heading}</h2>
              </header>
              <p className={s.you}>
                <i aria-hidden="true" />
                {c.dive.you}
              </p>
            </div>
            <span className={s.trail} aria-hidden="true" />
            <div className={s.seal}>
              <span className={s.face}>
                <Pic pic={pic(data, 'diver')} sizes="120px" />
              </span>
              <FathomDepth className={s.depth} start={c.dive.start} max={c.dive.max} unit={c.dive.unit} />
            </div>
            <ol className={s.stops}>
              {c.dive.stops.map((st, i) => (
                <li key={st.title} data-step={i} data-state={i === 0 ? 'on' : 'off'}>
                  <p className={s.stopKicker}>{st.kicker}</p>
                  <h3>{st.title}</h3>
                  <p className={s.stopText}>{st.text}</p>
                  {st.note && <p className={s.stopNote}>{st.note}</p>}
                </li>
              ))}
            </ol>
          </FathomHold>
        </section>

        <section className={s.year} id="year" aria-labelledby="year-h">
          <header className={s.yearHead}>
            <p className={s.kicker} data-reveal>
              {c.year.kicker}
            </p>
            <h2 id="year-h" data-reveal>
              {c.year.heading}
            </h2>
            <p className={s.yearLead} data-reveal>
              {c.year.lead}
            </p>
          </header>
          <FathomDial className={s.dial} months={c.year.months} labels={c.year.labels} zone={c.year.zone} />
          <div className={s.yearGo}>
            <a className={s.go} data-press data-magnetic {...book}>
              <Wave />
              {c.book.label}
            </a>
            <Fares rows={c.fares.short} className={s.faresLine} />
          </div>
        </section>

        <section className={s.tour} id="tour" aria-labelledby="tour-h">
          <header className={s.tourHead}>
            <p className={s.kicker} data-reveal>
              {c.tour.kicker}
            </p>
            <h2 id="tour-h" data-reveal>
              {c.tour.heading}
            </h2>
            <p className={s.tourLead} data-reveal>
              {c.tour.lead}
            </p>
            <p className={s.span}>
              <span>{c.tour.span}</span>
            </p>
          </header>
          <div className={s.trip}>
            <div className={s.chart}>
              <svg viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <defs>
                  <linearGradient id="fathom-trip" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="200">
                    <stop offset="0.5" stopColor="#012a6a" />
                    <stop offset="0.5" stopColor="#ffffff" />
                  </linearGradient>
                  <clipPath id="fathom-water">
                    <rect x="0" y="100" width="1000" height="100" />
                  </clipPath>
                </defs>
                <path className={s.chartHour} d={`${trip.profile}V100H0Z`} clipPath="url(#fathom-water)" />
                <path className={s.chartTrace} d={trip.profile} vectorEffect="non-scaling-stroke" />
                <path className={s.chartLine} d={trip.profile} pathLength={1} vectorEffect="non-scaling-stroke" />
              </svg>
              <ol className={s.chartLabels}>
                {trip.groups.map((g, i) => (
                  <li key={i} data-where={g.where} style={{ '--x0': trip.spans[i]!.from, '--w': trip.spans[i]!.w } as CSSProperties}>
                    {c.tour.chart[i] ?? g.stages[0]!.label}
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <div className={s.log} style={{ '--cols': trip.spans.map((sp) => `${sp.w.toFixed(3)}fr`).join(' ') } as CSSProperties}>
            {trip.groups.map((g, gi) => (
              <div key={gi} className={s.phase} data-where={g.where}>
                {g.stages.map((st) => (
                  <article key={st.label} className={s.stage} data-where={st.where} data-reveal>
                    <p className={s.stageLabel}>
                      <i aria-hidden="true" />
                      {st.label}
                    </p>
                    <h3>{st.title}</h3>
                    {st.image && (
                      <div className={s.stagePhoto} data-wipe>
                        <Pic pic={pic(data, st.image)} sizes={st.where === 'wet' ? '(min-width: 900px) 36vw, 100vw' : '(min-width: 900px) 20vw, 100vw'} />
                      </div>
                    )}
                    {st.kit && (
                      <ul className={s.kit}>
                        {st.kit.map((k) => (
                          <li key={k}>
                            <i aria-hidden="true">+</i>
                            {k}
                          </li>
                        ))}
                      </ul>
                    )}
                    {st.lines.map((l) => (
                      <p key={l} className={s.stageText}>
                        {l}
                      </p>
                    ))}
                  </article>
                ))}
              </div>
            ))}
          </div>
          <div className={s.close}>
            <div className={s.promise} data-reveal>
              <p className={s.stageLabel}>
                <i aria-hidden="true" />
                {c.tour.promise.label}
              </p>
              <p className={s.promiseText}>{c.tour.promise.text}</p>
            </div>
            <div className={s.priceCard} data-reveal>
              <p className={s.cardLabel}>{c.tour.card.label}</p>
              <h3>{c.tour.card.title}</h3>
              <dl>
                {c.fares.rows.map((r) => (
                  <div key={r.who}>
                    <dt>{r.who}</dt>
                    <dd>{r.price}</dd>
                  </div>
                ))}
              </dl>
              <p className={s.cardNote}>{c.tour.card.note}</p>
              <p className={s.cardNote}>{c.tour.card.refund}</p>
              <a className={s.go} data-press data-magnetic {...book}>
                <Wave />
                {c.book.label}
              </a>
            </div>
          </div>
        </section>

        <section className={s.proof} aria-labelledby="proof-h">
          <div className={s.proofHead}>
            <p className={s.kicker} data-reveal>
              {c.proof.kicker}
            </p>
            <h2 id="proof-h" data-reveal>
              {c.proof.heading}
            </h2>
            <p className={s.proofLine} data-reveal>
              {c.proof.line}
            </p>
          </div>
          <ul className={s.bubbleList}>
            {data.rating && (
              <li className={s.bubble} data-kind="rating" data-reveal style={{ '--i': 0 } as CSSProperties}>
                <div>
                  <b data-count>{data.rating.value}</b>{' '}
                  <span>
                    {String(data.rating.count)} {c.proof.ratingLabel}
                  </span>
                  <small>{c.proof.ratingSource}</small>
                </div>
              </li>
            )}
            {c.proof.quotes.map((q, i) => (
              <li key={q.who} className={s.bubble} data-kind="quote" data-reveal style={{ '--i': i + 1 } as CSSProperties}>
                <div>
                  <blockquote>
                    <p>{q.text}</p>
                  </blockquote>
                  <small>
                    {q.who}, {c.proof.where}
                  </small>
                </div>
              </li>
            ))}
            <li className={s.bubble} data-kind="count" data-reveal style={{ '--i': c.proof.quotes.length + 1 } as CSSProperties}>
              <div>
                <b data-count>{c.proof.tripadvisor.value}</b>{' '}
                <span>{c.proof.tripadvisor.label}</span>
              </div>
            </li>
          </ul>
        </section>

        <section className={s.harbour} id="contact" aria-labelledby="end-h">
          <div className={s.berth}>
            <p className={s.kicker} data-reveal>
              {c.end.kicker}
            </p>
            <h2 id="end-h" data-reveal>
              {c.end.heading}
            </h2>
            <p className={s.berthLine} data-reveal>
              {c.end.line}
            </p>
            <div className={s.berthGo} data-reveal>
              <a className={s.go} data-press data-magnetic {...book}>
                <Wave />
                {c.book.label}
              </a>
              <Fares rows={c.fares.short} className={s.faresLine} />
            </div>
            <p className={s.berthSeason}>{c.season}</p>
          </div>
          <div className={s.moorings}>
            <div className={s.mooringPhoto}>
              <Pic pic={pic(data, 'porthole')} sizes="100vw" />
            </div>
            <ul className={s.markers}>
              {c.end.ways.map((w, i) => (
                <li key={w.label} className={s.marker} style={{ '--i': i } as CSSProperties}>
                  <span className={s.markerBuoy} aria-hidden="true">
                    <i />
                  </span>
                  <div className={s.markerBody} data-reveal>
                    <h3>{w.label}</h3>
                    <p className={s.markerNote}>{w.note}</p>
                    {w.links.map((l) => (
                      <a key={l.text} className={s.markerLink} href={l.href}>
                        {l.text}
                      </a>
                    ))}
                    {w.extra && <p className={s.markerExtra}>{w.extra}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className={s.swells} aria-hidden="true">
            <Swell className={s.swellBack} />
            <Swell className={s.swellFront} />
          </div>
        </section>
      </main>

      <footer className={s.foot}>
        <div className={s.pano} data-parallax-frame>
          <Pic pic={pic(data, 'peninsula')} phone={data.images.peninsulaPhone} sizes="100vw" parallax />
        </div>
        <div className={s.footText}>
          <p className={s.footMark}>{c.wordmark}</p>
          <p className={s.footLine}>{c.foot.line}</p>
          <DemoFoot domain={data.domain} />
        </div>
      </footer>

      <StickyBar main={{ label: c.book.label, href: c.book.href, external: true }} call={{ label: c.call.label, tel: c.call.tel }} />
      <FathomWarm scope={s.root} />
    </div>
  );
}

export const fathom: Design = { Demo, fonts: ['instrument-serif-latin-400-normal', 'onest-latin-wght-normal'], heroSizes: '100vw' };
