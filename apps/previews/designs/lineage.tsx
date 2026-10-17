import type { CSSProperties, ReactNode } from 'react';
import { DemoFoot } from '@/components/DemoFoot';
import { LineageAsk } from '@/components/LineageAsk';
import { LineageFill } from '@/components/LineageFill';
import { LineageJourneys, type JourneyTour } from '@/components/LineageJourneys';
import { Pic } from '@/components/Pic';
import { LineagePin } from '@/components/LineagePin';
import { SectionLinks } from '@/components/SectionLinks';
import { StickyBar } from '@/components/StickyBar';
import { pic, type PageData } from '@/lib/data';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

type Classes = Record<string, string>;

/** Something made of the business's own figures, set where a stop on the time line has no photograph. */
type Artefact = { kind: 'ledger'; rows: { label: string; value: string }[] } | { kind: 'cells'; total: number; lit: number };

interface Era {
  figure: string;
  unit?: string;
  title: string;
  text: string;
  image?: string;
  art?: Artefact;
  tag?: string;
  /** Time is left out before this stop. */
  break?: boolean;
  /** The stop is still to come: it sits after the guide's own mark, on the dashed part of the line. */
  future?: boolean;
}

interface Question {
  q: string;
  lines: string[];
  from: string;
  image?: string;
}

interface Content {
  wordmark: string;
  place: string;
  est: string;
  nav: { label: string; href: string }[];
  book: { label: string; href: string };
  call: { label: string; tel: string; display: string };
  email: string;
  hero: {
    big: string;
    small: string;
    sub: string;
    price: { label: string; value: string; note: string };
    line: { before: number; after: number; start: string; self: string; end: string; count: string; countLabel: string };
  };
  time: { kicker: string; heading: string; lead: string; eras: Era[] };
  ask: { kicker: string; heading: string; lead: string; chooseLabel: string; fromLabel: string; questions: Question[] };
  journeys: {
    heading: string;
    lead: string;
    chooseLabel: string;
    scale: string[];
    alongLabel: string;
    tours: (JourneyTour & { priceLine: string })[];
    custom: { name: string; form: string; line: string; price: string };
  };
  principle: { heading: string; statements: string[]; values: { word: string; maori: string; text: string }[]; promise: string };
  guests: {
    heading: string;
    count: string;
    countBefore: string;
    countAfter: string;
    earned: string;
    ratingLabel: string;
    ratingUnit: string;
    ratingSource: string;
    seals: { ring: string; centre: string; label: string }[];
    quotes: { text: string; by: string }[];
  };
  end: {
    heading: string;
    reply: string;
    phoneLabel: string;
    emailLabel: string;
    pickupLabel: string;
    postmark: string;
    foot: string;
    tourLabel: string;
    dateLabel: string;
    dateEmpty: string;
    prevMonth: string;
    nextMonth: string;
    adultsLabel: string;
    childrenLabel: string;
    fewer: string;
    more: string;
    none: string;
    estimate: string;
    estimateSuggested: string;
    estimateNote: string;
    nameLabel: string;
    needsLabel: string;
    postLabel: string;
    postNote: string;
    posted: string;
    formLabel: string;
    subject: string;
    health: string;
    toLabel: string;
    to: string;
    lines: string[];
    pickup: string[];
  };
}

const v = (vars: Record<string, string | number>) => vars as CSSProperties;

/** A number whose figures roll up into place, each a column of 0 to 9 moved by a transform. Read aloud once. */
function Roll({ s, value, className }: { s: Classes; value: string; className?: string }) {
  return (
    <span className={`${s.roll} ${className ?? ''}`}>
      <span className={s.srOnly}>{value}</span>
      <span aria-hidden="true">
        {[...value].map((ch, i) =>
          /\d/.test(ch) ? (
            <span key={i} className={s.rollCol} style={v({ '--d': Number(ch), '--c': i })}>
              <span className={s.rollGhost}>{ch}</span>
              <span className={s.rollStrip}>
                {Array.from({ length: 10 }, (_, n) => (
                  <span key={n}>{n}</span>
                ))}
              </span>
            </span>
          ) : (
            <span key={i}>{ch}</span>
          ),
        )}
      </span>
    </span>
  );
}

/** The line of generations, small, for the foot: those before, filled, then the ones still to come, hollow. */
function Generations({ s, before, after, className }: { s: Classes; before: number; after: number; className?: string }) {
  return (
    <div className={className} aria-hidden="true" style={v({ '--before': before, '--after': after })}>
      <span className={s.genRail} />
      <span className={s.genAhead} />
      {Array.from({ length: before - 1 }, (_, i) => (
        <i key={`b${i}`} className={s.genPast} style={v({ '--i': i })} />
      ))}
      <i className={s.genSelf} style={v({ '--i': before - 1 })} />
      {Array.from({ length: after }, (_, k) => (
        <i key={`a${k}`} className={s.genNext} style={v({ '--k': k })} />
      ))}
    </div>
  );
}

function Art({ s, art }: { s: Classes; art: Artefact }) {
  if (art.kind === 'ledger')
    return (
      <dl className={s.ledger}>
        {art.rows.map((r) => (
          <div key={r.label}>
            <dt>{r.label}</dt>
            <dd>{/\d/.test(r.value) && !/\s/.test(r.value) ? <Roll s={s} value={r.value} /> : r.value}</dd>
          </div>
        ))}
      </dl>
    );
  // The squares burn out in a scattered order until only the stated share is left; then the ones around it
  // begin to come back.
  const side = Math.round(Math.sqrt(art.total));
  const survivor = art.total - Math.ceil(side * 3.5);
  const sr = Math.floor(survivor / side);
  const sc = survivor % side;
  return (
    <span className={s.cells} aria-hidden="true" style={v({ '--side': side })}>
      {Array.from({ length: art.total }, (_, i) => {
        const lit = i === survivor || (art.lit > 1 && i > survivor && i < survivor + art.lit);
        const ring = Math.max(Math.abs(Math.floor(i / side) - sr), Math.abs((i % side) - sc));
        return <i key={i} data-lit={lit ? '' : undefined} data-regrow={!lit && ring <= 2 ? '' : undefined} style={v({ '--b': (i * 37) % art.total, '--g': ring })} />;
      })}
    </span>
  );
}

function Words({ text }: { text: string }) {
  const words = text.split(' ');
  return (
    <>
      {words.map((w, i) => (
        <span key={`${w}-${i}`} style={v({ '--w': i })}>
          {w}{' '}
        </span>
      ))}
    </>
  );
}

function Badge({ s, centre, label }: { s: Classes; centre: string; label: string }) {
  return (
    <span className={s.badge}>
      <b>{centre}</b>
      <span>{label}</span>
    </span>
  );
}

/**
 * Seven generations before, and after. Their harbour fills the first screen; across it runs the line of
 * generations at full weight, the marks lighting in turn to the guide's face in a ring, the years counting up,
 * the marks of those still to come drawing out to the right. A short pinned journey then carries the same line
 * through the place's story, a full frame to each stop; questions are answered in her words; and choosing a
 * journey writes it onto a postcard, posted as an email to her.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('lineage', ['Inter Tight', 'Instrument Sans', 'Cormorant Garamond']);
  const c = data.demo as Content;
  const e = c.end;
  const book = { href: c.book.href, rel: 'noopener' };
  const eras = c.time.eras;
  const line = c.hero.line;
  const numeric = (f: string) => /^[\d.,%]+$/.test(f);
  const picture = (key: string | undefined, sizes: string): ReactNode => (key ? <Pic pic={pic(data, key)} sizes={sizes} /> : null);
  const custom = c.journeys.custom;
  // Stops sit evenly along the track; the guide's own mark sits where the past ends and the future begins.
  const n = eras.length;
  const firstFuture = eras.findIndex((x) => x.future);
  const selfAt = firstFuture < 0 ? 1 : firstFuture / n;

  return (
    <div className={s.root}>
      <style href="lineage" precedence="design">
        {css}
      </style>
      <nav className={s.rail} aria-label="Sections">
        <SectionLinks className={s.railLinks} items={c.nav} />
      </nav>
      <a className={s.railBook} data-press {...book}>
        {c.book.label}
      </a>

      <section className={s.hero} id="top" data-hero aria-labelledby="hero-h">
        <div className={s.heroMedia}>
          <Pic pic={pic(data, 'hero')} phone={data.images.heroPhone} sizes="100vw" first />
        </div>
        <div className={s.heroBar}>
          <a className={s.mark} href="#top">
            <span className={s.tally} aria-hidden="true">
              {Array.from({ length: line.before }, (_, i) => (
                <i key={i} />
              ))}
            </span>
            <span>{c.wordmark}</span>
          </a>
          <p className={s.place}>
            <span>{c.place}</span> <span>{c.est}</span>
          </p>
        </div>
        <h1 id="hero-h" className={s.title}>
          <span className={s.big}>
            <span>{c.hero.big}</span>
          </span>{' '}
          <span className={s.small}>
            <span>{c.hero.small}</span>
          </span>
        </h1>
        <p className={s.count}>
          <Roll s={s} value={line.count} className={s.countNum} /> <span>{line.countLabel}</span>
        </p>
        <p className={`${s.note} ${s.noteStart}`}>{line.start}</p>
        <p className={`${s.note} ${s.noteSelf}`}>{line.self}</p>
        <div className={s.past} aria-hidden="true">
          {Array.from({ length: line.before - 1 }, (_, i) => (
            <i key={i} style={v({ '--i': i })} />
          ))}
        </div>
        <div className={s.ring}>
          <div className={s.ringPhoto}>
            <Pic pic={pic(data, 'ring')} sizes="(min-width: 900px) 200px, 124px" />
          </div>
        </div>
        <div className={s.ahead} aria-hidden="true">
          {Array.from({ length: line.after }, (_, k) => (
            <i key={k} style={v({ '--k': k })} />
          ))}
        </div>
        <p className={`${s.note} ${s.noteEnd}`}>{line.end}</p>
        <div className={s.heroFoot}>
          <a className={s.go} data-press data-magnetic {...book}>
            {c.book.label}
          </a>
          <p className={s.price}>
            <span>{c.hero.price.label}</span> <b>{c.hero.price.value}</b> <span>{c.hero.price.note}</span>
          </p>
          <p className={s.sub}>{c.hero.sub}</p>
        </div>
      </section>

      <main>
        <section className={s.time} id="time" aria-labelledby="time-h">
          <LineagePin steps={n} className={s.timePin}>
            <header className={s.timeTop}>
              <p className={s.kicker}>{c.time.kicker}</p>
              <h2 id="time-h">{c.time.heading}</h2>
            </header>
            <ol className={s.frames}>
              {eras.map((x, i) => (
                <li key={x.title} className={s.frame} data-step={i} data-state={i === 0 ? 'on' : 'off'} data-art={x.image ? 'photo' : x.art?.kind} data-future={x.future ? '' : undefined}>
                  <div className={s.frameArt}>{x.image ? picture(x.image, '(min-width: 900px) 58vw, 100vw') : x.art ? <Art s={s} art={x.art} /> : null}</div>
                  <div className={s.frameText}>
                    <p className={s.year} data-kind={numeric(x.figure) ? 'number' : 'word'}>
                      <b>{x.figure}</b>
                      {x.unit && <small>{x.unit}</small>}
                    </p>
                    <h3>{x.title}</h3>
                    {x.tag && <p className={s.tag}>{x.tag}</p>}
                    <p className={s.frameBody}>{x.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className={s.track} aria-hidden="true" style={v({ '--self': selfAt })}>
              <span className={s.trackPast} />
              <span className={s.trackAhead} />
              {eras.map((x, i) => (
                <i key={x.title} data-step={i} data-state={i === 0 ? 'on' : 'off'} data-break={x.break ? '' : undefined} style={v({ '--x': (i + 0.5) / n })} />
              ))}
              <span className={s.trackSelf}>{picture('ring', '40px')}</span>
              <span className={s.trackMarker} />
            </div>
          </LineagePin>
        </section>

        <section className={s.ask} id="ask" aria-labelledby="ask-h">
          <header className={s.askHead}>
            <p className={`${s.kicker} ${s.rise}`}>
              {c.ask.kicker}
            </p>
            <h2 id="ask-h" className={s.rise}>
              {c.ask.heading}
            </h2>
            <p className={`${s.askLead} ${s.rise}`}>
              {c.ask.lead}
            </p>
          </header>
          <LineageAsk
            className={s.asker}
            labels={{ choose: c.ask.chooseLabel, from: c.ask.fromLabel }}
            face={<Pic pic={pic(data, 'face')} sizes="72px" />}
            name={line.self}
            questions={c.ask.questions.map((q) => ({ q: q.q, lines: q.lines, from: q.from, picture: picture(q.image, '(min-width: 900px) 260px, 150px') }))}
          />
        </section>

        <section className={s.principle} id="principle" aria-labelledby="principle-h">
          <h2 id="principle-h" className={`${s.pHead} ${s.rise}`}>
            {c.principle.heading}
          </h2>
          <LineageFill className={s.fill}>
            {c.principle.statements.map((st) => (
              <p key={st} data-fill style={v({ '--n': st.split(' ').length })}>
                <Words text={st} />
              </p>
            ))}
          </LineageFill>
          <ol className={s.values}>
            {c.principle.values.map((val, i) => (
              <li key={val.maori} className={s.rise} style={v({ '--i': i })}>
                <i aria-hidden="true" />
                <p className={s.vWord}>{val.word}</p>
                <p className={s.vMaori} lang="mi">
                  {val.maori}
                </p>
                <p className={s.vText}>{val.text}</p>
              </li>
            ))}
          </ol>
          <p className={`${s.promise} ${s.rise}`}>
            {c.principle.promise}
          </p>
        </section>

        <section className={s.guests} id="guests" aria-labelledby="guests-h">
          <div className={s.guestsHead}>
            <h2 id="guests-h" className={s.rise}>
              {c.guests.heading}
            </h2>
            <p className={s.hundred}>
              <span>{c.guests.countBefore}</span> <b className={s.rise}>{c.guests.count}</b> <span>{c.guests.countAfter}</span>
            </p>
            <p className={s.earned}>{c.guests.earned}</p>
            {data.rating && (
              <p className={s.rating}>
                <b>{data.rating.value}</b> <span>{c.guests.ratingLabel}</span> <span>{data.rating.count}</span> <span>{c.guests.ratingUnit}</span>
                <small>{c.guests.ratingSource}</small>
              </p>
            )}
            <ul className={s.badges}>
              {c.guests.seals.map((seal) => (
                <li key={seal.label}>
                  <Badge s={s} centre={seal.centre} label={seal.label} />
                </li>
              ))}
            </ul>
          </div>
          <ul className={s.quotes}>
            {c.guests.quotes.map((q, i) => (
              <li key={q.by} className={s.rise} style={v({ '--i': i })}>
                <blockquote>
                  <p>{q.text}</p>
                </blockquote>
                <p className={s.by}>{q.by}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className={s.journeys} id="journeys" aria-labelledby="journeys-h">
          <header className={s.jHead}>
            <h2 id="journeys-h" className={s.rise}>
              {c.journeys.heading}
            </h2>
            <p className={s.rise}>{c.journeys.lead}</p>
          </header>
          <LineageJourneys
            className={s.book}
            tours={[...c.journeys.tours, { name: custom.name, form: custom.form, stops: [], price: custom.price, line: custom.line, priceLine: custom.price }]}
            scale={c.journeys.scale}
            labels={{
              choose: c.journeys.chooseLabel,
              card: e.heading,
              along: c.journeys.alongLabel,
              date: e.dateLabel,
              dateEmpty: e.dateEmpty,
              prevMonth: e.prevMonth,
              nextMonth: e.nextMonth,
              adults: e.adultsLabel,
              children: e.childrenLabel,
              fewer: e.fewer,
              more: e.more,
              none: e.none,
              estimate: e.estimate,
              estimateSuggested: e.estimateSuggested,
              estimateNote: e.estimateNote,
              name: e.nameLabel,
              needs: e.needsLabel,
              post: e.postLabel,
              note: e.postNote,
              posted: e.posted,
              form: e.formLabel,
              subject: e.subject,
              tour: e.tourLabel,
            }}
            email={c.email}
            formHref={c.book.href}
            address={
              <>
                <div className={s.stamp}>
                  <Pic pic={pic(data, 'face')} sizes="104px" />
                </div>
                <svg className={s.postmark} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
                  <defs>
                    <path id="lineage-postmark" d="M60 60m-43 0a43 43 0 1 1 86 0a43 43 0 1 1-86 0" />
                  </defs>
                  <circle cx="60" cy="60" r="55" />
                  <circle cx="60" cy="60" r="31" />
                  <text>
                    <textPath href="#lineage-postmark" textLength="268">
                      {e.postmark}
                    </textPath>
                  </text>
                </svg>
                {e.lines.map((l) => (
                  <p key={l} className={s.cardNote}>
                    {l}
                  </p>
                ))}
                <p className={s.toLabel}>{e.toLabel}</p>
                <p className={s.to}>{e.to}</p>
                <p className={s.address}>
                  <span>{e.pickupLabel}</span>
                  {e.pickup.map((l) => (
                    <span key={l}>{l}</span>
                  ))}
                </p>
                <div className={s.ways}>
                  <p>
                    <span>{e.phoneLabel}</span>
                    <a href={c.call.tel}>{c.call.display}</a>
                  </p>
                  <p>
                    <span>{e.emailLabel}</span>
                    <a href={`mailto:${c.email}`}>
                      {c.email.split('@')[0]}
                      <wbr />@{c.email.split('@')[1]}
                    </a>
                  </p>
                </div>
                <p className={s.reply}>{e.reply}</p>
              </>
            }
          />
          <p className={s.health}>{e.health}</p>
        </section>
      </main>

      <footer className={s.foot}>
        <p className={s.footLine}>{e.foot}</p>
        <Generations s={s} className={s.footGen} before={line.before} after={line.after} />
        <div className={s.footMeta}>
          <p>
            <b>{c.wordmark}</b> <span>{e.pickup.join(', ')}</span>
          </p>
          <DemoFoot domain={data.domain} />
        </div>
      </footer>

      <StickyBar main={{ label: c.book.label, href: c.book.href, external: true }} call={{ label: c.call.label, tel: c.call.tel }} />
    </div>
  );
}

export const lineage: Design = { Demo, fonts: ['inter-tight-latin-wght-normal'], heroSizes: '100vw' };
