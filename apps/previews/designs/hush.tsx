import type { CSSProperties } from 'react';
import { DemoFoot } from '@/components/DemoFoot';
import { HushCrater } from '@/components/HushCrater';
import { HushDay } from '@/components/HushDay';
import { HushTouch } from '@/components/HushTouch';
import { HushWind } from '@/components/HushWind';
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

interface Tour {
  image: string;
  when: string;
  span?: [number, number];
  name: string;
  tag: string;
  text: string;
  facts: string[];
  price: string;
  per: string;
}

interface Content {
  wordmark: string;
  tagline: string;
  nav: Link[];
  book: Link;
  call: { label: string; tel: string; display: string };
  email: string;
  hero: { lines: string[]; no: string; quiet: string[]; quietLabel: string; sub: string; from: string; price: string };
  crater: { kicker: string; heading: string; lead: string; launch: string; stops: { image: string; label: string; text: string; tag?: string }[]; end: string };
  wind: Parameters<typeof HushWind>[0]['text'] & { kicker: string; heading: string; lead: string; note: string };
  tours: { heading: string; lead: string; dawn: string; dusk: string; book: string; items: Tour[] };
  wildlife: {
    kicker: string;
    heading: string;
    lead: string;
    sentence: { t: string; name?: boolean; image?: string }[];
    note: string;
    quoteLead: string;
    quote: string[];
    review: { text: string; who: string };
  };
  guides: {
    kicker: string;
    heading: string;
    group: string[];
    text: string;
    more: string;
    proof: string[];
    ratingFrom: string;
    ratingUnit: string;
    ratingSource: string;
    review: { text: string; who: string };
    guardian: { kicker: string; word: string; text: string; rule: string };
  };
  end: {
    heading: string[];
    line: string;
    where: string[];
    bookKicker: string;
    bookNote: string;
    trip: { kicker: string; link: string; detail: string; subject: string; body: string[] };
    callLabel: string;
    emailLabel: string;
    best: string;
    hours: string;
    open: string;
    speak: string;
    address: string;
  };
}

type Vars = CSSProperties & Record<`--${string}`, string | number>;

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Three rings that spread on still water from whatever sits in their middle: the only mark a paddle leaves. */
function Rings({ className }: { className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

/** A sea kayak seen side on, with its paddler mid stroke. */
function Kayak({ className, paddle, style }: { className?: string; paddle?: string; style?: CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 120 40" aria-hidden="true" focusable="false">
      <path d="M2 27C30 33 90 33 118 26C92 29 30 30 2 27Z" />
      <circle cx="58" cy="9" r="4.2" />
      <path d="M54 26c0-7 1-11 4-12s5 2 6 6" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <g className={paddle}>
        <path d="M36 3L82 37" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <ellipse cx="34" cy="2" rx="5" ry="2.4" transform="rotate(36 34 2)" />
        <ellipse cx="84" cy="38.5" rx="5" ry="2.4" transform="rotate(36 84 38.5)" />
      </g>
    </svg>
  );
}

/**
 * Akaroa Harbour with the engines switched off. The page opens on their own sunrise photograph in
 * its true colour, and the four things they leave behind are struck out and fall silent one by one.
 * A kayak then paddles the shore of a sketched crater stop by stop, the wind swings across the same
 * sketch to light the sheltered shore, the day is laid out sunrise to dusk with each trip's price and
 * booking in its own span, the wildlife opens inside their own sentence, and the page ends on one
 * pool of still water with the booking in the middle.
 */
function Demo({ data }: { data: PageData }) {
  const c = data.demo as Content;
  const { css, s } = designStyles('hush', ['Literata', 'Plus Jakarta Sans']);
  const book = { href: c.book.href, rel: 'noopener' };
  const trip = c.end.trip;
  const tripMail = `mailto:${c.email}?subject=${encodeURIComponent(trip.subject)}&body=${encodeURIComponent(trip.body.join('\n'))}`;

  return (
    <div className={s.root}>
      <style href="hush" precedence="design">
        {css}
      </style>

      <nav className={s.nav} aria-label="Sections">
        <SectionLinks className={s.navLinks} items={c.nav} />
        <a className={s.navBook} data-press {...book}>
          {c.book.label}
        </a>
      </nav>

      <section className={s.hero} id="top" data-hero>
        <div className={s.heroMedia}>
          <Pic pic={pic(data, 'hero')} phone={data.images.heroPhone} sizes="100vw" first />
        </div>
        <HushTouch cls={{ layer: s.touch, ring: s.touchRing }} />
        <a className={s.mark} href="#top">
          <b>{c.wordmark}</b>
          <span>{c.tagline}</span>
        </a>
        <p className={s.heroSub}>{c.hero.sub}</p>
        <h1 className={s.title} aria-label={c.hero.lines.join(' ')}>
          {c.hero.lines.map((l, i) => (
            <span key={l} className={s.line} aria-hidden="true">
              <span style={{ '--i': i } as Vars}>{l}</span>
            </span>
          ))}
        </h1>
        <div className={s.foot0}>
          <p className={s.quiet}>
            <span className={s.srOnly}>{c.hero.quietLabel}</span>
            {c.hero.quiet.map((w, i) => (
              <span key={w} className={s.no} style={{ '--i': i } as Vars} aria-hidden="true">
                {c.hero.no} <s>{w}</s>
              </span>
            ))}
          </p>
          <div className={s.launch}>
            <a className={s.go} data-press data-magnetic {...book}>
              {c.book.label}
              <Arrow />
            </a>
            <p className={s.from}>
              {c.hero.from} <b>{c.hero.price}</b>
            </p>
          </div>
        </div>
      </section>

      <main>
        <section className={s.crater} id="crater" aria-labelledby="crater-h">
          <HushCrater
            launch={c.crater.launch}
            head={
              <header className={s.glideHead}>
                <p className={s.kicker}>
                  {c.hero.no} <s>{c.crater.kicker}</s>
                </p>
                <h2 id="crater-h">{c.crater.heading}</h2>
                <p className={s.glideLead}>{c.crater.lead}</p>
              </header>
            }
            end={<p className={s.glideEnd}>{c.crater.end}</p>}
            stops={c.crater.stops.map((st) => ({ label: st.label, text: st.text, tag: st.tag, picture: <Pic pic={pic(data, st.image)} sizes="(min-width: 900px) 300px, 46vw" /> }))}
            cls={{
              outer: s.glide,
              frame: s.glideFrame,
              map: s.cMap,
              svg: s.cSvg,
              land: s.land,
              rim: s.rim,
              water: s.water,
              route: s.route,
              trail: s.trail,
              node: s.node,
              place: s.place,
              boat: s.boat,
              paddle: s.strokeTop,
              stops: s.cStops,
              stop: s.cStop,
              shot: s.cShot,
              cap: s.cCap,
              label: s.stopLabel,
              text: s.stopText,
            }}
          />
        </section>

        <section className={s.wind} id="wind" aria-labelledby="wind-h">
          <header className={s.windHead}>
            <p className={s.kicker} data-reveal>
              {c.wind.kicker}
            </p>
            <h2 id="wind-h" data-reveal>
              {c.wind.heading}
            </h2>
            <p className={s.windLead} data-reveal>
              {c.wind.lead}
            </p>
            <p className={s.windNote} data-reveal>
              {c.wind.note}
            </p>
          </header>
          <HushWind
            text={c.wind}
            cls={{
              box: s.windBox,
              map: s.windMap,
              land: s.land,
              rim: s.rim,
              water: s.water,
              air: s.air,
              gust: s.gust,
              glow: s.glow,
              shore: s.shore,
              boats: s.boats,
              paddle: s.strokeTop,
              drag: s.drag,
              range: s.range,
              marks: s.marks,
              reading: s.reading,
              srOnly: s.srOnly,
            }}
          />
        </section>

        <section className={s.tours} id="tours" aria-labelledby="tours-h">
          <header className={s.toursHead}>
            <h2 id="tours-h" data-reveal>
              {c.tours.heading}
            </h2>
            <p data-reveal>{c.tours.lead}</p>
          </header>
          <HushDay
            trips={c.tours.items.map((t) => ({ ...t, picture: <Pic pic={pic(data, t.image)} sizes="(min-width: 900px) 46vw, 92vw" /> }))}
            labels={{ dawn: c.tours.dawn, dusk: c.tours.dusk, book: c.tours.book }}
            book={c.book.href}
            cls={{
              box: s.day,
              axis: s.axis,
              sky: s.sky,
              tick: s.tick,
              sun: s.sun,
              span: s.span,
              whole: s.whole,
              ends: s.ends,
              panels: s.panels,
              panel: s.panel,
              shot: s.dShot,
              body: s.dBody,
              name: s.dName,
              tag: s.tag,
              text: s.dText,
              facts: s.facts,
              buy: s.buy,
              price: s.price,
              go: s.goSmall,
            }}
          />
        </section>

        <section className={s.wild} id="wildlife" aria-labelledby="wild-h">
          <header className={s.wildHead}>
            <p className={s.kicker} data-reveal>
              {c.wildlife.kicker}
            </p>
            <h2 id="wild-h" data-reveal>
              {c.wildlife.heading}
            </h2>
            <p className={s.wildLead} data-reveal>
              {c.wildlife.lead}
            </p>
          </header>
          <p className={s.sighting}>
            {c.wildlife.sentence.map((part, i) =>
              part.name ? (
                <span key={part.t} className={s.named} style={{ '--i': i } as Vars}>
                  <span className={s.nameWord}>{part.t}</span>
                  {part.image && (
                    <span className={s.inline}>
                      <Pic pic={pic(data, part.image)} sizes="(min-width: 900px) 220px, 120px" />
                    </span>
                  )}
                </span>
              ) : (
                <span key={part.t}>{part.t}</span>
              ),
            )}
          </p>
          <p className={s.wildNote} data-reveal>
            {c.wildlife.note}
          </p>
          <div className={s.wildEnd}>
            <blockquote className={s.blessing} data-reveal>
              <p className={s.blessLead}>{c.wildlife.quoteLead}</p>
              <p className={s.bless}>
                {c.wildlife.quote.map((q) => (
                  <span key={q}>{q}</span>
                ))}
              </p>
            </blockquote>
            <figure className={s.voice} data-reveal>
              <blockquote>
                <p>{c.wildlife.review.text}</p>
              </blockquote>
              <figcaption>{c.wildlife.review.who}</figcaption>
            </figure>
          </div>
        </section>

        <section className={s.guides} id="guides" aria-labelledby="guides-h">
          <div className={s.guidesText}>
            <p className={s.kicker} data-reveal>
              {c.hero.no} <s>{c.guides.kicker}</s>
            </p>
            <h2 id="guides-h" data-reveal>
              {c.guides.heading}
            </h2>
            <p className={s.group} data-reveal>
              {c.guides.group[0]} <em>{c.guides.group[1]}</em> {c.guides.group[2]} <em>{c.guides.group[3]}</em> {c.guides.group[4]}
            </p>
            <p className={s.fleet} aria-hidden="true">
              {Array.from({ length: Number.parseInt(c.guides.group[1] ?? '', 10) || 0 }, (_, i) => (
                <Kayak key={i} className={s.fleetKayak} style={{ '--i': i } as Vars} />
              ))}
            </p>
            <p className={s.guidesLine} data-reveal>
              {c.guides.text}
            </p>
            <p className={s.guidesLine} data-reveal>
              {c.guides.more}
            </p>
          </div>
          <div className={s.proofs}>
            {data.rating && (
              <p className={s.rated} data-reveal>
                <b>{data.rating.value}</b>
                <span>
                  {c.guides.ratingFrom} {data.rating.count} {c.guides.ratingUnit}
                  <small>{c.guides.ratingSource}</small>
                </span>
              </p>
            )}
            <ul className={s.proof}>
              {c.guides.proof.map((p) => (
                <li key={p} data-reveal>
                  {p}
                </li>
              ))}
            </ul>
            <figure className={s.voiceLight} data-reveal>
              <blockquote>
                <p>{c.guides.review.text}</p>
              </blockquote>
              <figcaption>{c.guides.review.who}</figcaption>
            </figure>
          </div>
        </section>

        <section className={s.guard} aria-labelledby="guard-h">
          <p className={s.kicker} data-reveal>
            {c.hero.no} <s>{c.guides.guardian.kicker}</s>
          </p>
          <h2 id="guard-h" className={s.guardWord} data-reveal>
            {c.guides.guardian.word}
          </h2>
          <p className={s.guardText} data-reveal>
            {c.guides.guardian.text}
          </p>
          <p className={s.guardRule} data-reveal>
            {c.guides.guardian.rule}
          </p>
        </section>

        <section className={s.end} id="book" aria-labelledby="end-h">
          <h2 id="end-h" className={s.endHead} data-reveal>
            {c.end.heading.map((h) => (
              <span key={h}>{h}</span>
            ))}
          </h2>
          <p className={s.endLine} data-reveal>
            {c.end.line}
          </p>
          <ul className={s.where}>
            {c.end.where.map((w) => (
              <li key={w} data-reveal>
                {w}
              </li>
            ))}
          </ul>
          <div className={s.door}>
            <div className={s.pond}>
              <Rings className={s.endRings} />
              <p className={s.doorKicker}>{c.end.bookKicker}</p>
              <a className={s.go} data-press data-magnetic {...book}>
                {c.book.label}
                <Arrow />
              </a>
              <p className={s.doorNote}>{c.end.bookNote}</p>
            </div>
            <ul className={s.doorTours}>
              {c.tours.items.map((t) => (
                <li key={t.name}>
                  <a href={c.book.href} rel="noopener">
                    <span>{t.name}</span>
                    <b>{t.price}</b>
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <p className={s.tripLine}>
            <span>{trip.kicker}</span> <a href={tripMail}>{trip.link}</a> {trip.detail}
          </p>
          <div className={s.reach}>
            <a className={s.reachLine} href={c.call.tel}>
              <span>{c.end.callLabel}</span>
              <b>{c.call.display}</b>
            </a>
            <a className={s.reachLine} href={`mailto:${c.email}`}>
              <span>{c.end.emailLabel}</span>
              <b>{c.email}</b>
            </a>
            <p>{c.end.best}</p>
            <p>{c.end.hours}</p>
            <p>
              {c.end.open} {c.end.speak}
            </p>
          </div>
        </section>
      </main>

      <footer className={s.foot}>
        <span className={s.footMark} aria-hidden="true">
          <Rings className={s.footRings} />
          <Kayak className={s.footKayak} paddle={s.stroke} />
        </span>
        <p className={s.footAddress}>{c.end.address}</p>
        <DemoFoot domain={data.domain} />
      </footer>

      <StickyBar main={{ label: c.book.label, href: c.book.href, external: true }} call={{ label: c.call.label, tel: c.call.tel }} />
    </div>
  );
}

export const hush: Design = { Demo, fonts: ['literata-latin-wght-italic', 'plus-jakarta-sans-latin-wght-normal'], heroSizes: '100vw' };
