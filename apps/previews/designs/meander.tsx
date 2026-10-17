import type { CSSProperties } from 'react';
import { DemoFoot } from '@/components/DemoFoot';
import { MeanderBend, type BendLove } from '@/components/MeanderBend';
import { MeanderLive } from '@/components/MeanderLive';
import { MeanderPin } from '@/components/MeanderPin';
import { MeanderPlan } from '@/components/MeanderPlan';
import { MeanderRoad, MeanderVan } from '@/components/MeanderVan';
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

interface Route {
  road: string;
  spurs: string[];
  stops: { x: number; y: number; kind: string }[];
  labels: { x: number; y: number; text: string; anchor: 'start' | 'middle' | 'end'; kind: string }[];
}

interface Tour {
  headline: string[];
  short: string;
  name: string;
  length: string;
  season: string;
  meta: string;
  text: string;
  note: string;
  price: string;
  priceShort: string;
  months: number[];
  image?: string;
  tone: string;
  route: Route;
  action: Link;
}

interface Content {
  wordmark: string;
  zone: string;
  months: string[];
  nav: Link[];
  book: Link;
  call: { label: string; tel: string; display: string };
  email: string;
  hero: { kicker: string; lines: string[]; sub: string; price: string; pickup: string; season: { label: string; value: string; on: string; off: string } };
  tours: { heading: string; nowLabel: string; items: Tour[] };
  bend: { heading: string; lead: string; text: string; hint: string; start: string; end: string; loves: BendLove[]; tour: string; meta: string; price: string; after: string; action: string };
  host: { kicker: string; struck: string; heading: string; text: string; faq: string; years: string; yearsLabel: string; team: string; ratingLabel: string; ratingCount: string; ratingSource: string };
  plan: Parameters<typeof MeanderPlan>[0]['labels'] & { heading: string; lead: string; talk: string; end: string; endNote: string };
  foot: { place: string; links: Link[] };
}

/** The opening photograph fills the right of a wide screen and a band across a phone. */
const HERO_SIZES = '(min-width: 900px) 44vw, 100vw';

/** The roads the page is drawn with. Shapes only: what they carry comes from the content file. */
const HERO_ROAD = 'M-90 822C70 822 200 804 356 792S600 770 684 646S748 418 846 334S1064 168 1204 160S1404 196 1530 126';
const HERO_ROAD_PHONE = 'M-40 30C40 30 80 36 130 64S230 160 270 206S350 262 440 250';
const SIDE_TALL = 'M40 0C72 36 72 114 40 150S8 264 40 300S72 414 40 450S8 564 40 600';
const SIDE_WIDE = 'M0 20C26 4 54 4 80 20S134 36 160 20S214 4 240 20S294 36 320 20';
const PARK = 'M-40 60C80 60 130 128 250 128S400 92 470 104';

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M3 10h13M11.5 5.5 16 10l-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * One unhurried day on a single road. The road is drawn in fine line work: it sweeps across the first
 * screen from Pickup, carries the four tours as stops on a side road, bends to what the guest loves,
 * strikes through "just a driver" and ends at Drop-off beside the plan. Their minibus is on it the whole way.
 */
function Demo({ data }: { data: PageData }) {
  const c = data.demo as Content;
  const { css, s } = designStyles('meander', ['Gloock', 'Familjen Grotesk']);
  const book = { href: c.book.href, rel: 'noopener' };
  const road = { edge: s.edge!, fill: s.fill!, lane: s.lane! };
  const wine = c.tours.items.find((t) => t.months.length < 12);

  /** The headline, set once in ink and once in white over the photograph; the two meet exactly at the photograph's edge. */
  const Headline = ({ light }: { light?: boolean }) => (
    <div className={s.heroType} aria-hidden={light ? 'true' : undefined}>
      <p className={s.kicker}>{c.hero.kicker}</p>
      {light ? (
        <p className={s.h1}>
          {c.hero.lines.map((l, i) => (
            <span key={l} className={s.line}>
              <span style={{ '--i': i } as CSSProperties}>{l}</span>
            </span>
          ))}
        </p>
      ) : (
        <h1 className={s.h1} aria-label={c.hero.lines.join(' ')}>
          {c.hero.lines.map((l, i) => (
            <span key={l} className={s.line} aria-hidden="true">
              <span style={{ '--i': i } as CSSProperties}>{l}</span>
            </span>
          ))}
        </h1>
      )}
    </div>
  );

  const Season = ({ months }: { months: number[] }) => (
    <div className={s.season} data-season={months.join(',')}>
      <ol className={s.months} aria-hidden="true">
        {c.months.map((m, i) => (
          <li key={m} data-m={i} data-run={months.includes(i) ? '' : undefined}>
            <i />
            <span>{m}</span>
          </li>
        ))}
      </ol>
      <p className={s.seasonState} data-season-state hidden />
    </div>
  );

  const Map = ({ route }: { route: Route }) => (
    <div className={s.mapDraw}>
      <svg viewBox="0 0 560 380" aria-hidden="true" focusable="false">
        {route.spurs.map((d) => (
          <path key={d} d={d} className={s.spur} />
        ))}
        <MeanderRoad d={route.road} cls={road} />
        {route.stops.map((st, k) => (
          <circle key={k} cx={st.x} cy={st.y} r={st.kind === 'start' ? 9 : 7} className={s.stopDot} data-kind={st.kind} />
        ))}
      </svg>
      {route.labels.map((l) => (
        <span key={l.text} className={s.mapLabel} data-kind={l.kind} data-anchor={l.anchor} style={{ left: `${((l.x / 560) * 100).toFixed(2)}%`, top: `${((l.y / 380) * 100).toFixed(2)}%` }}>
          {l.text}
        </span>
      ))}
    </div>
  );

  return (
    <div className={s.root}>
      <style href="meander" precedence="design">
        {css}
      </style>

      <nav className={s.dock} aria-label="Sections">
        <SectionLinks className={s.dockLinks} items={c.nav} />
        <a className={s.dockBook} data-press data-magnetic {...book}>
          {c.book.label}
        </a>
      </nav>

      <header className={s.hero} id="top" data-hero>
        <div className={s.heroPhoto}>
          <Pic pic={pic(data, 'hero')} phone={data.images.heroPhone} sizes={HERO_SIZES} first />
          <span className={s.heroShade} aria-hidden="true" />
          <svg className={s.roadPhone} viewBox="0 0 390 280" data-drive data-park="9.6" aria-hidden="true" focusable="false">
            <MeanderRoad d={HERO_ROAD_PHONE} cls={road} />
            <g className={s.pickupLight} transform="translate(46 32)">
              <path d="M0 18V40" />
              <text x="8" y="58">
                {c.hero.pickup}
              </text>
            </g>
            <g transform="scale(0.9)">
              <g>
                <MeanderVan className={s.van} />
                <animateMotion dur="30s" repeatCount="indefinite" rotate="auto" calcMode="linear" keyPoints="0.12;0.42;0.42;0.7;0.7;1" keyTimes="0;0.3;0.38;0.66;0.74;1" path={scalePath(HERO_ROAD_PHONE, 1 / 0.9)} />
              </g>
            </g>
          </svg>
        </div>
        <svg className={s.roadWide} viewBox="0 0 1440 864" preserveAspectRatio="xMidYMid slice" data-drive data-park="14" aria-hidden="true" focusable="false">
          <MeanderRoad d={HERO_ROAD} cls={road} />
          <g className={s.pickup} transform="translate(128 770)">
            <path d="M0 0V-58" />
            <text y="-70">{c.hero.pickup}</text>
          </g>
          <g transform="scale(1.6)">
            <g>
              <MeanderVan className={s.van} />
              <animateMotion dur="48s" repeatCount="indefinite" rotate="auto" calcMode="linear" keyPoints="0.07;0.07;0.5;0.5;1" keyTimes="0;0.1;0.55;0.62;1" path={scalePath(HERO_ROAD, 1 / 1.6)} />
            </g>
          </g>
        </svg>
        <div className={s.heroInk}>
          <div className={s.heroTop}>
            <a className={s.mark} href="#top">
              {c.wordmark}
            </a>
          </div>
          <Headline />
          <div className={s.heroFoot}>
            <p className={s.sub}>{c.hero.sub}</p>
            <div className={s.heroAct}>
              <a className={s.go} data-press data-magnetic {...book}>
                {c.book.label}
                <Arrow />
              </a>
              <p className={s.from}>{c.hero.price}</p>
            </div>
          </div>
        </div>
        <div className={s.heroLight}>
          <Headline light />
        </div>
        <p className={s.tag} data-season={wine?.months.join(',') ?? ''}>
          <i aria-hidden="true" />
          <b>{c.hero.season.label}</b>
          <span>{c.hero.season.value}</span>
          <em data-season-state hidden />
        </p>
      </header>

      <main>
        <section className={s.tours} id="tours" aria-labelledby="tours-h">
          <MeanderPin steps={c.tours.items.length} className={s.pin}>
            <h2 id="tours-h" className={s.toursHead}>
              {c.tours.heading}
            </h2>
            <div className={s.side}>
              <svg className={s.sideTall} viewBox="0 0 80 600" width="80" height="600" aria-hidden="true" focusable="false">
                <MeanderRoad d={SIDE_TALL} cls={road} track />
                <g data-van transform="translate(40 0) rotate(90)">
                  <MeanderVan className={s.van} />
                </g>
              </svg>
              <svg className={s.sideWide} viewBox="0 0 320 40" aria-hidden="true" focusable="false">
                <MeanderRoad d={SIDE_WIDE} cls={road} track />
                <g data-van transform="translate(0 20)">
                  <g transform="scale(0.62)">
                    <MeanderVan className={s.van} />
                  </g>
                </g>
              </svg>
              <ol className={s.sideStops}>
                {c.tours.items.map((t, i) => (
                  <li key={t.short} data-step={i} data-state={i === 0 ? 'on' : 'off'} style={{ '--k': i } as CSSProperties}>
                    <b>{t.short}</b>
                    <span className={s.sideMeta}>
                      {t.length} · {t.season}
                    </span>
                    <span className={s.sidePrice}>{t.priceShort}</span>
                  </li>
                ))}
              </ol>
            </div>
            {c.tours.items.map((t, i) => (
              <article key={t.name} className={s.beat} data-step={i} data-state={i === 0 ? 'on' : 'off'} data-tone={t.tone} aria-labelledby={`tour-${i}`}>
                <p className={s.headline} aria-hidden="true">
                  {t.headline.map((w, j) => (
                    <span key={w} className={s.pl}>
                      <span style={{ '--j': j } as CSSProperties}>{w}</span>
                    </span>
                  ))}
                </p>
                <div className={s.beatText}>
                  <h3 id={`tour-${i}`} className={s.tourName}>
                    {t.name}
                  </h3>
                  <p className={s.meta}>{t.meta}</p>
                  <p className={s.text}>{t.text}</p>
                  <p className={s.note}>{t.note}</p>
                  <div className={s.buy}>
                    <p className={s.price}>{t.price}</p>
                    <a className={s.go} href={t.action.href} rel={t.action.href.startsWith('http') ? 'noopener' : undefined} data-press>
                      {t.action.label}
                      <Arrow />
                    </a>
                  </div>
                </div>
                <figure className={s.map}>
                  {t.image ? (
                    <div className={s.mapPhoto}>
                      <Pic pic={pic(data, t.image)} sizes="(min-width: 900px) 38vw, 100vw" />
                    </div>
                  ) : (
                    <svg className={s.ridges} viewBox="0 0 560 380" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
                      <path d="M-10 300C80 250 140 200 220 214S360 280 440 230S520 170 570 180" />
                      <path d="M-10 340C100 310 200 290 300 304S460 340 570 300" />
                    </svg>
                  )}
                  <Map route={t.route} />
                </figure>
                <Season months={t.months} />
              </article>
            ))}
          </MeanderPin>
        </section>

        <section className={s.bend} id="day" aria-labelledby="day-h">
          <div className={s.bendHead}>
            <p className={s.lead} data-reveal>
              {c.bend.lead}
            </p>
            <h2 id="day-h" data-reveal>
              {c.bend.heading}
            </h2>
            <p className={s.bendText} data-reveal>
              {c.bend.text}
            </p>
          </div>
          <div className={s.bendPlay}>
            <MeanderBend
              loves={c.bend.loves}
              start={c.bend.start}
              end={c.bend.end}
              hint={c.bend.hint}
              cls={{ hint: s.hint!, toggles: s.toggles!, toggle: s.toggle!, canvas: s.canvas!, wide: s.canvasWide!, tall: s.canvasTall!, road: s.edge!, fill: s.fill!, lane: s.lane!, van: s.van!, stop: s.stop!, end: s.roadEnd! }}
            />
          </div>
          <div className={s.bendBuy} data-reveal>
            <p className={s.bendTour}>{c.bend.tour}</p>
            <p className={s.meta}>{c.bend.meta}</p>
            <p className={s.bendAfter}>{c.bend.after}</p>
            <div className={s.buy}>
              <p className={s.price}>{c.bend.price}</p>
              <a className={s.go} data-press {...book}>
                {c.bend.action}
                <Arrow />
              </a>
            </div>
          </div>
        </section>

        <section className={s.host} id="host" aria-labelledby="host-h">
          <figure className={s.portrait} data-wipe>
            <Pic pic={pic(data, 'team')} sizes="(min-width: 900px) 42vw, 100vw" />
            <figcaption>{c.host.team}</figcaption>
          </figure>
          <div className={s.hostText}>
            <p className={s.lead}>{c.host.kicker}</p>
            <p className={s.struck} data-watch>
              <s>{c.host.struck}</s>
              <span className={s.strikeRoad} aria-hidden="true" />
              <span className={s.strikeVan} aria-hidden="true">
                <svg viewBox="-20 -12 40 24" width="46" height="28" focusable="false">
                  <MeanderVan className={s.van} />
                </svg>
              </span>
            </p>
            <h2 id="host-h">{c.host.heading}</h2>
            <p className={s.hostLine} data-reveal>
              {c.host.text}
            </p>
            <p className={s.faq} data-reveal>
              {c.host.faq}
            </p>
            <div className={s.facts} data-reveal>
              <p>
                <b>{c.host.years}</b>
                <span>{c.host.yearsLabel}</span>
              </p>
              {data.rating && (
                <p>
                  <b>{data.rating.value}</b>
                  <span>
                    {c.host.ratingLabel}, {String(data.rating.count)} {c.host.ratingCount}
                    <small>{c.host.ratingSource}</small>
                  </span>
                </p>
              )}
            </div>
          </div>
        </section>

        <section className={s.plan} id="plan" aria-labelledby="plan-h">
          <div className={s.planHead}>
            <h2 id="plan-h" data-reveal>
              {c.plan.heading}
            </h2>
            <p className={s.planLead} data-reveal>
              {c.plan.lead}
            </p>
            <div className={s.park} data-watch aria-hidden="true">
              <svg viewBox="0 0 480 170" focusable="false">
                <MeanderRoad d={PARK} cls={road} />
                <g className={s.parkSign} transform="translate(466 104)">
                  <path d="M0 0V-60" />
                  <text x="-10" y="-68">
                    {c.plan.end}
                  </text>
                </g>
                <g className={s.parkVan}>
                  <g transform="translate(410 102) rotate(10) scale(1.4)">
                    <MeanderVan className={s.van} />
                  </g>
                </g>
              </svg>
            </div>
            <p className={s.endNote} data-reveal>
              {c.plan.endNote}
            </p>
            <p className={s.talk}>
              <span>{c.plan.talk}</span>
              <a href={c.call.tel}>
                {c.call.label} {c.call.display}
              </a>
              <a href={`mailto:${c.email}`}>{c.email}</a>
            </p>
          </div>
          <MeanderPlan
            tours={c.tours.items.map((t) => ({ short: t.short, name: t.name, meta: t.meta, price: t.price, href: t.action.href, route: t.route }))}
            loves={c.bend.loves.map((l) => ({ key: l.key, label: l.label }))}
            labels={c.plan}
            email={c.email}
            cls={{
              plan: s.composer!,
              group: s.group!,
              legend: s.legend!,
              tours: s.choices!,
              tour: s.choice!,
              tourName: s.choiceName!,
              tourMeta: s.choiceMeta!,
              tourPrice: s.choicePrice!,
              tourMap: s.choiceMap!,
              chips: s.chips!,
              chip: s.chip!,
              summary: s.summary!,
              actions: s.actions!,
              go: s.go!,
              ghost: s.ghost!,
              note: s.planNote!,
            }}
          />
        </section>
      </main>

      <footer className={s.foot}>
        <div className={s.ridgeBand} data-watch aria-hidden="true">
          <svg viewBox="0 0 1440 160" preserveAspectRatio="none" focusable="false">
            <circle className={s.sunset} cx="1060" cy="70" r="34" />
            <path className={s.hillBack} d="M0 120C150 116 250 50 420 56S650 126 820 108S1090 34 1240 50S1380 86 1440 82V160H0Z" />
            <path className={s.hillFront} d="M0 160V136C200 132 330 88 520 96S800 146 980 134S1260 96 1440 112V160Z" />
            <path className={s.seaLine} d="M0 148H1440" />
          </svg>
        </div>
        <div className={s.footBody}>
          <p className={s.footMark}>{c.wordmark}</p>
          <p className={s.footPlace}>{c.foot.place}</p>
          <ul className={s.footLinks}>
            {c.foot.links.map((l) => (
              <li key={l.href}>
                <a href={l.href} rel="noopener">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <p className={s.footContact}>
            <a href={c.call.tel}>{c.call.display}</a>
            <a href={`mailto:${c.email}`}>{c.email}</a>
          </p>
          <DemoFoot domain={data.domain} />
        </div>
      </footer>

      <MeanderLive zone={c.zone} on={c.hero.season.on} off={c.hero.season.off} />
      <StickyBar main={{ label: c.book.label, href: c.book.href, external: true }} call={{ label: c.call.label, tel: c.call.tel }} />
    </div>
  );
}

/**
 * The same road at another scale, for a minibus drawn inside a scaled group: its motion path is given
 * in the group's own units, so it still runs along the road as drawn.
 */
function scalePath(d: string, k: number): string {
  return d.replace(/-?\d+(\.\d+)?/g, (n) => (Number(n) * k).toFixed(1));
}

export const meander: Design = { Demo, fonts: ['gloock-latin-400-normal', 'familjen-grotesk-latin-wght-normal'], heroSizes: HERO_SIZES };
