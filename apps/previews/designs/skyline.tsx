import type { CSSProperties } from 'react';
import { DemoFoot } from '@/components/DemoFoot';
import { Pic } from '@/components/Pic';
import { SectionLinks } from '@/components/SectionLinks';
import { SkylineLetter } from '@/components/SkylineLetter';
import { SkylineRoad } from '@/components/SkylineRoad';
import { areaPath, linePath, yAt, type Pt } from '@/components/SkylineShape';
import { SkylineSummary } from '@/components/SkylineSummary';
import { SkylineWays, type Way } from '@/components/SkylineWays';
import { SkylineYear, type Month, type YearTrip } from '@/components/SkylineYear';
import { StickyBar } from '@/components/StickyBar';
import { pic, type PageData } from '@/lib/data';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Link {
  label: string;
  href: string;
}

interface Quote {
  quote: string;
  who: string;
  trip: string;
  image?: string;
}

interface Content {
  wordmark: string;
  place: string;
  nav: Link[];
  book: Link;
  call: { label: string; tel: string; display: string };
  free: { tel: string; display: string; note: string };
  email: string;
  hero: { lines: string[]; sub: string; more: Link; labels: { x: number; name: string }[] };
  profile: Pt[];
  road: {
    kicker: string;
    heading: string;
    lead: string;
    from: string;
    to: string;
    note: string;
    chapters: { name: string; from: number; to: number; photo?: string; sky: [string, string]; stops: { x: number; name: string; figure: string; line: string }[] }[];
  };
  ways: { kicker: string; heading: string; lead: string; rates: string; ask: Link; options: (Way & { short: string })[] };
  locals: { kicker: string; heading: string; statement: string; owners: string; caption: string; traps: string; since: string; ribbonLabel: string; guides: { name: string; role: string; line: string }[] };
  summary: { label: string; notRuns: string };
  weather: {
    kicker: string;
    heading: string;
    lead: string;
    chartLabel: string;
    runsLabel: string;
    notRuns: string;
    unit: string;
    months: Month[];
    seasons: Record<string, string>;
    trips: YearTrip[];
  };
  reviews: { kicker: string; heading: string; ratingLabel: string; ratingUnit: string; ratingSource: string; lead: Quote; more: Quote[]; track: Quote };
  close: {
    kicker: string;
    heading: string;
    fund: string[];
    letter: { label: string; lead: string; hello: string; want: string; in: string; end: string; tripLabel: string; monthLabel: string; send: string; subject: string };
    phoneLabel: string;
    emailLabel: string;
    end: string;
  };
}

function Arrow({ down }: { down?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d={down ? 'M10 3v13M5 11l5 5 5-5' : 'M3 10h13M11 5l5 5-5 5'} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Words that fill with a highlight as they are read. */
function Fill({ text, className }: { text: string; className?: string }) {
  const words = text.split(' ');
  return (
    <span className={className}>
      {words.map((w, i) => (
        <span key={`${w}-${i}`} style={{ '--i': i, '--n': words.length } as CSSProperties}>
          {w}
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  );
}

/** The hero's view of the land: the road's profile squeezed into one screen, its top a few units above the highest point. */
const HERO_TOP = 10;
const HERO_DEPTH = 150;

/**
 * Fiordland as one skyline. The road from the lake over the alpine pass to the sea is drawn as a
 * profile: it rises as land in front of the opening photograph, is travelled stretch by stretch in a
 * cross section held on screen, becomes the walking profile of each way to Milford Sound, and ends
 * flat at sea level where the visitor books.
 */
function Demo({ data }: { data: PageData }) {
  const c = data.demo as Content;
  const { css, s } = designStyles('skyline', ['Oswald', 'IBM Plex Sans', 'EB Garamond']);
  const book = { href: c.book.href, rel: 'noopener' };
  const pts = c.profile;
  const width = Math.max(...pts.map(([x]) => x));
  const heroY = (y: number) => `${(((y - HERO_TOP) / HERO_DEPTH) * 100).toFixed(2)}%`;

  return (
    <div className={s.root}>
      <style href="skyline" precedence="design">
        {css}
      </style>

      <nav className={s.rail} aria-label="Sections">
        <SectionLinks className={s.railLinks} items={c.nav} />
      </nav>

      <main>
        <section className={s.hero} id="top" data-hero aria-labelledby="hero-h">
          <div className={s.heroPhoto}>
            <Pic pic={pic(data, 'hero')} phone={data.images.heroPhone} sizes="(min-width: 1600px) 1600px, 100vw" first />
          </div>
          <div className={s.heroType}>
            <p className={s.mark}>
              <b>{c.wordmark}</b>
              <span>{c.place}</span>
            </p>
            <h1 id="hero-h" className={s.title} aria-label={c.hero.lines.join(' ')}>
              {c.hero.lines.map((l, i) => (
                <span key={l} className={s.line} aria-hidden="true">
                  <span style={{ '--i': i } as CSSProperties}>{l}</span>
                </span>
              ))}
            </h1>
            <div className={s.heroFoot}>
              <p className={s.sub}>{c.hero.sub}</p>
              <p className={s.actions}>
                <a className={s.go} data-press data-magnetic {...book}>
                  {c.book.label}
                  <Arrow />
                </a>
                <a className={s.more} href={c.hero.more.href}>
                  <span className={s.moreText}>{c.hero.more.label}</span>
                  <Arrow down />
                </a>
              </p>
            </div>
          </div>
          <div className={s.land} aria-hidden="true">
            <svg className={s.landSvg} viewBox={`0 ${HERO_TOP} ${width} ${HERO_DEPTH}`} preserveAspectRatio="none" focusable="false">
              <path className={s.landFill} d={areaPath(pts, HERO_TOP + HERO_DEPTH)} />
              <path className={s.crest} d={linePath(pts)} pathLength={1} />
            </svg>
            {c.hero.labels.map((l, i) => (
              <span key={l.name} className={s.peak} data-end={i === 0 ? 'start' : i === c.hero.labels.length - 1 ? 'end' : undefined} style={{ '--x': `${((l.x / width) * 100).toFixed(2)}%`, '--y': heroY(yAt(pts, l.x)), '--i': i } as CSSProperties}>
                {l.name}
              </span>
            ))}
          </div>
          <ul className={s.heroWays}>
            {c.ways.options.map((o) => (
              <li key={o.key}>
                <a href={c.hero.more.href}>
                  <span>{o.tag}</span>
                  <b>{o.short}</b>
                  {o.prices[0] && (
                    <em>
                      {o.prices[0].value} {o.prices[0].label}
                    </em>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className={s.roadSec} id="road" aria-labelledby="road-h">
          <header className={s.roadHead}>
            <p className={s.kicker}>{c.road.kicker}</p>
            <h2 id="road-h" data-reveal>
              {c.road.heading}
            </h2>
            <p className={s.lead} data-reveal>
              {c.road.lead}
            </p>
          </header>
          <SkylineRoad
            points={pts}
            from={c.road.from}
            to={c.road.to}
            chapters={c.road.chapters.map((ch) => ({
              name: ch.name,
              from: ch.from,
              to: ch.to,
              sky: ch.sky,
              stops: ch.stops,
              photo: ch.photo ? <Pic pic={pic(data, ch.photo)} sizes="(min-width: 900px) 800px, 100vw" /> : undefined,
            }))}
            cls={{
              road: s.road,
              frame: s.frame,
              mini: s.mini,
              miniSvg: s.miniSvg,
              miniEnds: s.miniEnds,
              miniMark: s.miniMark,
              chapter: s.chapter,
              chapterTitle: s.chapterTitle,
              band: s.band,
              bandPhoto: s.bandPhoto,
              bandSvg: s.bandSvg,
              contour: s.contour,
              under: s.under,
              ridge: s.ridge,
              dot: s.dot,
              label: s.dotLabel,
              marker: s.marker,
              read: s.read2,
              readFigure: s.readFigure,
              readName: s.readName2,
              readLine: s.readLine,
            }}
          />
          <p className={s.roadNote} data-reveal>
            {c.road.note}
          </p>
        </section>

        <section className={s.waysSec} id="ways" aria-labelledby="ways-h">
          <header className={s.waysHead}>
            <p className={s.kicker}>{c.ways.kicker}</p>
            <h2 id="ways-h" data-reveal>
              {c.ways.heading}
            </h2>
            <p className={s.lead} data-reveal>
              {c.ways.lead}
            </p>
          </header>
          <SkylineWays
            ways={c.ways.options}
            book={c.book}
            rates={c.ways.rates}
            ask={c.ways.ask}
            label={c.ways.heading}
            cls={{
              ways: s.ways,
              tabs: s.tabs,
              tab: s.tab,
              spark: s.spark,
              tabName: s.tabName,
              tabTag: s.tabTag,
              panel: s.panel,
              chart: s.chart,
              chartSvg: s.chartSvg,
              area: s.area,
              line: s.chartLine,
              base: s.base,
              marks: s.marks,
              figure: s.figure,
              body: s.wayBody,
              copy: s.wayCopy,
              name: s.wayName,
              line2: s.wayLine,
              chips: s.chips,
              deal: s.deal,
              prices: s.prices,
              go: s.go,
              rates: s.rates,
              ask: s.ask,
            }}
          />
        </section>

        <section className={s.weatherSec} id="weather" aria-labelledby="weather-h">
          <header className={s.weatherHead}>
            <p className={s.kicker}>{c.weather.kicker}</p>
            <h2 id="weather-h" data-reveal>
              {c.weather.heading}
            </h2>
            <p className={s.lead} data-reveal>
              {c.weather.lead}
            </p>
            <p className={s.chartLabel}>{c.weather.chartLabel}</p>
          </header>
          <SkylineYear
            months={c.weather.months}
            trips={c.weather.trips}
            seasons={c.weather.seasons}
            labels={{ chart: c.weather.chartLabel, runs: c.weather.runsLabel, notRuns: c.weather.notRuns, unit: c.weather.unit }}
            cls={{
              year: s.year,
              plot: s.plot,
              yearLine: s.yearLine,
              months: s.months,
              month: s.month,
              range: s.range,
              monthName: s.monthName,
              trips: s.trips,
              tripNames: s.tripNames,
              cursor: s.cursor,
              read: s.read,
              readName: s.readName,
              readSeason: s.readSeason,
              readNote: s.readNote,
              runs: s.runs,
              runLabel: s.runLabel,
            }}
          />
        </section>

        <section className={s.localsSec} id="locals" aria-labelledby="locals-h">
          <header className={s.localsHead}>
            <p className={s.kicker}>{c.locals.kicker}</p>
            <h2 id="locals-h" className={s.srOnly}>
              {c.locals.heading}
            </h2>
            <p className={s.statement}>
              <Fill text={c.locals.statement} className={s.fill} />
            </p>
          </header>
          <div className={s.owners}>
            <figure className={s.steve} data-wipe>
              <Pic pic={pic(data, 'steve')} sizes="(min-width: 900px) 46vw, 100vw" />
              <figcaption>{c.locals.caption}</figcaption>
            </figure>
            <div className={s.ownersText}>
              <p className={s.ownersLead} data-reveal>
                {c.locals.owners}
              </p>
              <p data-reveal>{c.locals.traps}</p>
              <p className={s.since} data-reveal>
                {c.locals.since}
              </p>
            </div>
          </div>
          <div className={s.crew}>
            <p className={s.kicker}>{c.locals.ribbonLabel}</p>
            <div className={s.ribbon} aria-hidden="true">
              <p className={s.ribbonTrack}>
                {[...c.locals.guides, ...c.locals.guides].map((g, i) => (
                  <span key={`${g.name}-${i}`}>
                    <b>{g.name}</b>
                    {g.role && <em>{g.role}</em>}
                  </span>
                ))}
              </p>
            </div>
            <ul className={s.guides}>
              {c.locals.guides.map((g) => (
                <li key={g.name} data-reveal>
                  <b>{g.name}</b>
                  {g.role && <span>{g.role}</span>}
                  <p>{g.line}</p>
                </li>
              ))}
            </ul>
            <figure className={s.guidePhoto} data-wipe>
              <Pic pic={pic(data, 'guide')} sizes="(min-width: 900px) 34vw, 100vw" />
            </figure>
          </div>
        </section>

        <section className={s.reviewsSec} id="reviews" aria-labelledby="reviews-h">
          <header className={s.reviewsHead}>
            <p className={s.kicker}>{c.reviews.kicker}</p>
            <h2 id="reviews-h" data-reveal>
              {c.reviews.heading}
            </h2>
            {data.rating && (
              <p className={s.rating} data-reveal>
                <b>{data.rating.value}</b>
                <span>
                  {c.reviews.ratingLabel} {data.rating.count} {c.reviews.ratingUnit}
                  <small>{c.reviews.ratingSource}</small>
                </span>
              </p>
            )}
          </header>
          <blockquote className={s.bigQuote}>
            <p>
              <Fill text={c.reviews.lead.quote} className={s.fill} />
            </p>
            <footer>
              <b>{c.reviews.lead.who}</b> {c.reviews.lead.trip}
            </footer>
          </blockquote>
          <div className={s.quotes}>
            {c.reviews.more.map((q) => (
              <blockquote key={q.who} data-reveal>
                <p>{q.quote}</p>
                <footer>
                  <b>{q.who}</b> {q.trip}
                </footer>
              </blockquote>
            ))}
          </div>
          <figure className={s.track}>
            <div className={s.trackPhoto} data-wipe>
              <Pic pic={pic(data, c.reviews.track.image ?? 'falls')} sizes="(min-width: 900px) 40vw, 100vw" />
            </div>
            <blockquote data-reveal>
              <p>{c.reviews.track.quote}</p>
              <footer>
                <b>{c.reviews.track.who}</b> {c.reviews.track.trip}
              </footer>
            </blockquote>
          </figure>
        </section>

        <section className={s.closeSec} id="book" aria-labelledby="book-h">
          <svg className={s.sea} viewBox={`0 ${HERO_TOP} ${width} ${HERO_DEPTH}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <path d={linePath(pts)} pathLength={1} />
          </svg>
          <p className={s.kicker}>{c.close.kicker}</p>
          <h2 id="book-h" data-reveal>
            {c.close.heading}
          </h2>
          <div className={s.closeGrid}>
            <div className={s.fund}>
              {c.close.fund.map((line) => (
                <p key={line} data-reveal>
                  {line}
                </p>
              ))}
              <a className={s.goDark} data-press data-magnetic {...book}>
                {c.book.label}
                <Arrow />
              </a>
            </div>
            <div className={s.write}>
              <p className={s.writeLabel}>{c.close.letter.label}</p>
              <p className={s.writeLead}>{c.close.letter.lead}</p>
              <SkylineLetter
                trips={c.ways.options.map((o) => o.short)}
                months={c.weather.months.map((m) => m.name)}
                email={c.email}
                words={c.close.letter}
                cls={{ letter: s.letter, sentence: s.sentence, pick: s.pick, send: s.send, srOnly: s.srOnly }}
              />
            </div>
          </div>
          <ul className={s.reach}>
            <li>
              <a href={c.call.tel}>
                <b>{c.call.display}</b>
                <span>{c.close.phoneLabel}</span>
              </a>
            </li>
            <li>
              <a href={c.free.tel}>
                <b>{c.free.display}</b>
                <span>{c.free.note}</span>
              </a>
            </li>
            <li>
              <a href={`mailto:${c.email}`}>
                <b>{c.email}</b>
                <span>{c.close.emailLabel}</span>
              </a>
            </li>
          </ul>
        </section>
      </main>

      <footer className={s.foot}>
        <p className={s.footMark}>
          <b>{c.wordmark}</b> {c.close.end}
        </p>
        <DemoFoot domain={data.domain} />
      </footer>

      <SkylineSummary
        trips={c.ways.options.map((o) => {
          const run = c.weather.trips.find((t) => t.key === o.key);
          return { name: o.short, price: o.prices[0], months: run?.months ?? [], note: run?.note };
        })}
        months={c.weather.months.map((m) => m.name)}
        label={c.summary.label}
        notRuns={c.summary.notRuns}
        book={c.book}
        cls={{ summary: s.summary, sumLabel: s.sumLabel, sumTrip: s.sumTrip, sumWhen: s.sumWhen, sumPrice: s.sumPrice, sumGo: s.sumGo }}
      />

      <StickyBar main={{ label: c.book.label, href: c.book.href, external: true }} call={{ label: c.call.label, tel: c.call.tel }} />
    </div>
  );
}

export const skyline: Design = { Demo, fonts: ['oswald-latin-wght-normal', 'eb-garamond-latin-wght-italic'], heroSizes: '(min-width: 1600px) 1600px, 100vw' };
