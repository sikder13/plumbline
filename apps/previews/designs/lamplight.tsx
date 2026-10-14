import type { CSSProperties, ReactNode } from 'react';
import { DemoFoot } from '@/components/DemoFoot';
import { LamplightBeam } from '@/components/LamplightBeam';
import { LamplightChooser, type LamplightTrip } from '@/components/LamplightChooser';
import { LamplightSwitch } from '@/components/LamplightSwitch';
import { Pic } from '@/components/Pic';
import { Pinned } from '@/components/Pinned';
import { SectionLinks } from '@/components/SectionLinks';
import { StickyBar } from '@/components/StickyBar';
import { pic, type PageData } from '@/lib/data';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Link {
  label: string;
  href: string;
}

interface Phone {
  label: string;
  tel: string;
  display: string;
}

interface Mode {
  id: string;
  word: string;
  name: string;
  text: string;
  facts: string[];
  fromLabel: string;
  price: string;
  book: string;
  image: string;
}

interface Content {
  wordmark: string;
  place: string;
  nav: Link[];
  book: Link;
  call: Phone;
  freephone: Phone;
  email: string;
  hero: {
    lines: string[];
    wideLines: string[];
    glow: string;
    action: string;
    day: string;
    lamp: string;
    words: string[];
    counts: number[];
    lights: { wide: number[][]; narrow: number[][] };
    crop: { wide: number[]; narrow: number[] };
  };
  idea: { label: string; heading: string; lead: string; parts: { id: string; label: string }[]; real: string; text: string; image: string };
  trips: { label: string; heading: string; choose: string; joiner: string; mark: string; modes: Mode[]; departLabel: string; departs: { when: string; times: string }[]; soon: string };
  daylight: { label: string; through: string; heading: string; text: string; image: string };
  train: { label: string; heading: string; text: string; currency: string; fares: { price: string; who: string }[]; season: string; book: string };
  story: {
    label: string;
    heading: string;
    text: string;
    first: { pre: string; value: string; label: string };
    now: { pre: string; value: string; label: string };
    quote: { text: string; source: string };
    ratingUnit: string;
    ratingSource: string;
    proof: string[];
  };
  choose: {
    label: string;
    heading: string;
    sentence: Parameters<typeof LamplightChooser>[0]['sentence'];
    defaults: { water: string; age: number; hours: number };
    demo: { water?: string; age?: number; hours?: number }[];
    trips: LamplightTrip[];
    way: string;
    none: string;
    soon: string;
  };
  end: {
    callLabel: string;
    emailLabel: string;
    road: { label: string; from: string; fromTime: string; here: string; to: string; toTime: string };
    address: string;
    cafe: { name: string; hours: { when: string; time: string }[] };
    post: string;
  };
}

/**
 * The points of light of one photograph, as a mask: each point a soft disc where the picture shows
 * through, everything else dark. The points are found in the photograph itself and kept in the content
 * file, brightest first, as percentages of the picture's width and height.
 */
function lightsMask(points: number[][], count: number, [w, h]: number[], radius: number): string {
  const r = count === 1 ? radius * 2.4 : count <= 10 ? radius * 1.4 : radius;
  const dots = points
    .slice(0, count)
    .map(([x = 0, y = 0]) => `<circle cx="${((x / 100) * w!).toFixed(0)}" cy="${((y / 100) * h!).toFixed(0)}" r="${r.toFixed(0)}" fill="url(#g)"/>`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><defs><radialGradient id="g"><stop offset="0.28" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>${dots}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** One line of the headline, with the word that keeps its light set apart from the words that go dark. */
function Lit({ line, word, lit, dark }: { line: string; word: string; lit?: string; dark?: string }): ReactNode {
  const at = word ? line.indexOf(word) : -1;
  if (at < 0) return <span className={dark}>{line}</span>;
  return (
    <>
      {at > 0 && <span className={dark}>{line.slice(0, at)}</span>}
      <em className={lit}>{word}</em>
      {at + word.length < line.length && <span className={dark}>{line.slice(at + word.length)}</span>}
    </>
  );
}

/**
 * A show cave's walkway drawn over the real passage, in the photograph's own coordinates: a boardwalk
 * running in to the cavers, handrails along it and a concrete path off to the formations. The design
 * draws it, then switches it off.
 */
function ShowCave({ className, parts }: { className?: string; parts: string[] }) {
  const edge = (t: number, side: 0 | 1) => (side === 0 ? [180 + 215 * t, 598 - 158 * t] : [480 - 25 * t, 598 - 158 * t]);
  const planks = [0.12, 0.27, 0.4, 0.52, 0.62, 0.71, 0.79, 0.86, 0.92];
  const posts = [0.04, 0.3, 0.55, 0.76, 0.93];
  const rail = (side: 0 | 1) =>
    posts
      .map((t, i) => {
        const [x, y] = edge(t, side);
        return `${i ? 'L' : 'M'}${x!.toFixed(0)} ${(y! - 74 * (1 - 0.72 * t)).toFixed(0)}`;
      })
      .join('');
  const [walk, handrail, path] = parts;
  return (
    <svg className={className} viewBox="0 0 800 598" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <g data-part={walk}>
        <path d="M180 598L395 440M480 598L455 440" pathLength={1} />
        {planks.map((t) => {
          const [a, b] = [edge(t, 0), edge(t, 1)];
          return <path key={t} d={`M${a[0]!.toFixed(0)} ${a[1]!.toFixed(0)}L${b[0]!.toFixed(0)} ${b[1]!.toFixed(0)}`} pathLength={1} />;
        })}
      </g>
      <g data-part={handrail}>
        {([0, 1] as const).map((side) => (
          <g key={side}>
            <path d={rail(side)} pathLength={1} />
            {posts.map((t) => {
              const [x, y] = edge(t, side);
              return <path key={t} d={`M${x!.toFixed(0)} ${y!.toFixed(0)}V${(y! - 74 * (1 - 0.72 * t)).toFixed(0)}`} pathLength={1} />;
            })}
          </g>
        ))}
      </g>
      <g data-part={path}>
        <path d="M0 575L176 506M0 524L150 470" pathLength={1} />
        {[0.2, 0.45, 0.7, 0.95].map((t) => (
          <path key={t} d={`M${(176 * t).toFixed(0)} ${(575 - 69 * t).toFixed(0)}L${(150 * t).toFixed(0)} ${(524 - 54 * t).toFixed(0)}`} pathLength={1} />
        ))}
      </g>
    </svg>
  );
}

/**
 * Only the light you bring. The opening is one held frame that goes down into the dark as the visitor
 * scrolls: rainforest daylight, then a headlamp's pool over cavers under the stalactites, then the
 * glowworm ceiling coming on one, ten, a hundred, thousands, while only the word "light" stays lit.
 * After it a show cave's walkway is drawn and switched off, the question wet or dry floods or drains
 * the river, the cave mouth opens until the screen is daylight, and the end lights the trip that fits.
 */
function Demo({ data }: { data: PageData }) {
  const c = data.demo as Content;
  const { css, s } = designStyles('lamplight', ['Darker Grotesque', 'Hanken Grotesk']);
  const book = { href: c.book.href, rel: 'noopener' };
  const h = c.hero;
  const layers = h.counts.map((n) => ({ '--mw': lightsMask(h.lights.wide, n, h.crop.wide, 30), '--mn': lightsMask(h.lights.narrow, n, h.crop.narrow, 24) }) as CSSProperties);
  const wide = '(min-width: 760px) 2560px, 100vw';
  const glowPic = () => <Pic pic={pic(data, 'glow')} phone={data.images.glowPhone} sizes={wide} />;
  const steps = 2 + h.words.length;
  const road = c.end.road;
  const headline = (lines: string[], className?: string) => (
    <span className={className} aria-hidden="true">
      {lines.map((l, i) => (
        <span key={l} className={s.line}>
          <span style={{ '--i': i } as CSSProperties}>
            <Lit line={l} word={h.glow} lit={s.lit} dark={s.dark} />
          </span>
        </span>
      ))}
    </span>
  );

  return (
    <div className={s.root}>
      <style href="lamplight" precedence="design">
        {css}
      </style>

      <nav className={s.dock} aria-label="Sections">
        <SectionLinks className={s.dockLinks} items={c.nav} />
        <a className={s.dockBook} data-press {...book}>
          {c.book.label}
        </a>
      </nav>

      <main>
        <section className={s.descent} id="top" data-hero aria-labelledby="top-h">
          <Pinned steps={steps} className={s.story}>
            <div className={s.scene} data-scene="day" data-step={0} data-state="on">
              <Pic pic={pic(data, 'hero')} phone={data.images.heroPhone} sizes={wide} first />
            </div>
            <div className={s.scene} data-scene="lamp" data-step={1} data-state="off">
              <Pic pic={pic(data, 'lamp')} phone={data.images.lampPhone} sizes={wide} />
              <LamplightBeam className={s.night} />
            </div>
            <div className={s.scene} data-scene="glow" data-step={2} data-state="off">
              {layers.map((style, k) => (
                <div key={k} className={s.glowLayer} style={style} data-step={2 + k} data-state="off" aria-hidden={k > 0 ? true : undefined}>
                  {glowPic()}
                </div>
              ))}
              <div className={`${s.glowLayer} ${s.glowAll}`} data-step={2 + layers.length} data-state="off" aria-hidden="true">
                {glowPic()}
              </div>
            </div>
            <span className={s.veil} aria-hidden="true" />
            <div className={s.over}>
              <p className={s.mark}>
                {c.wordmark}
                <span>{c.place}</span>
              </p>
              <h1 id="top-h" className={s.title} aria-label={h.lines.join(' ')}>
                {headline(h.lines, s.narrow)}
                {headline(h.wideLines, s.wide)}
              </h1>
              <div className={s.say}>
                <p className={s.sayLine} data-step={0} data-state="on">
                  {h.day}
                </p>
                <p className={s.sayLine} data-step={1} data-state="off">
                  {h.lamp}
                </p>
                <p className={s.count} data-step={2} data-state="off">
                  {h.words.map((w, i) => (
                    <span key={w} data-step={2 + i} data-state="off">
                      {w}{' '}
                    </span>
                  ))}
                </p>
              </div>
              <a className={s.cta} data-press {...book}>
                {h.action}
              </a>
            </div>
          </Pinned>
        </section>

        <section className={s.idea} id="idea" aria-labelledby="idea-h">
          <header className={s.ideaHead}>
            <p className={s.label}>{c.idea.label}</p>
            <h2 id="idea-h" data-reveal>
              {c.idea.heading}
            </h2>
            <p className={s.ideaLead}>{c.idea.lead}</p>
          </header>
          <figure className={s.showcave}>
            <div className={s.showPic}>
              <Pic pic={pic(data, c.idea.image)} sizes="(min-width: 900px) 760px, 100vw" />
              <ShowCave className={s.rails} parts={c.idea.parts.map((p) => p.id)} />
            </div>
            <figcaption className={s.parts}>
              {c.idea.parts.map((p) => (
                <span key={p.id} data-part={p.id}>
                  {p.label}
                </span>
              ))}
            </figcaption>
          </figure>
          <div className={s.ideaEnd}>
            <p className={s.ideaReal}>{c.idea.real}</p>
            <p className={s.ideaNote}>{c.idea.text}</p>
          </div>
        </section>

        <section className={s.trips} id="trips" aria-labelledby="trips-h">
          <LamplightSwitch
            label={c.trips.choose}
            joiner={c.trips.joiner}
            mark={c.trips.mark}
            modes={c.trips.modes.map((m) => ({
              id: m.id,
              word: m.word,
              name: m.name,
              text: m.text,
              facts: m.facts,
              fromLabel: m.fromLabel,
              price: m.price,
              book: m.book,
              href: c.book.href,
              picture: <Pic pic={pic(data, m.image)} sizes="(min-width: 900px) 520px, 100vw" />,
            }))}
            head={
              <header className={s.tripsHead}>
                <p className={s.label}>{c.trips.label}</p>
                <h2 id="trips-h" className={s.srOnly}>
                  {c.trips.heading}
                </h2>
              </header>
            }
            foot={
              <div className={s.departs}>
                <p className={s.departLabel}>{c.trips.departLabel}</p>
                <ul>
                  {c.trips.departs.map((d) => (
                    <li key={d.when}>
                      <b>{d.times}</b>
                      <span>{d.when}</span>
                    </li>
                  ))}
                </ul>
                <p className={s.soon}>
                  {c.trips.soon}{' '}
                  <a href={c.call.tel} data-press>
                    {c.call.display}
                  </a>
                </p>
              </div>
            }
            cls={{
              root: s.switchRoot,
              water: s.water,
              surface: s.surface,
              ask: s.ask,
              option: s.option,
              joiner: s.joiner,
              panels: s.panels,
              panel: s.panel,
              media: s.tripPic,
              body: s.tripBody,
              name: s.tripName,
              text: s.tripText,
              facts: s.tripFacts,
              deal: s.deal,
              from: s.tripFrom,
              amount: s.amount,
              go: s.go,
            }}
          />
        </section>

        <section className={s.seam} id="daylight" aria-labelledby="seam-h">
          <div className={s.seamFrame}>
            <div className={s.seamDark}>
              <p className={s.label}>{c.daylight.label}</p>
              <p className={s.through}>{c.daylight.through}</p>
            </div>
            <figure className={s.mouth}>
              <Pic pic={pic(data, c.daylight.image)} sizes="(min-width: 900px) 560px, 100vw" />
            </figure>
            <span className={s.white} aria-hidden="true" />
            <div className={s.seamLight}>
              <h2 id="seam-h">{c.daylight.heading}</h2>
              <p>{c.daylight.text}</p>
            </div>
          </div>
        </section>

        <section className={s.chapter} aria-labelledby="train-h">
          <div className={s.trainPart}>
            <figure className={s.trainPic} data-wipe>
              <Pic pic={pic(data, 'train')} sizes="(min-width: 900px) 640px, 100vw" />
            </figure>
            <div className={s.trainText}>
              <p className={s.label}>{c.train.label}</p>
              <h2 id="train-h" data-reveal>
                {c.train.heading}
              </h2>
              <p className={s.body}>{c.train.text}</p>
              <ul className={s.fares}>
                {c.train.fares.map((f) => (
                  <li key={f.who}>
                    <b>
                      <small>{c.train.currency}</small>
                      {f.price}
                    </b>
                    <span>{f.who}</span>
                  </li>
                ))}
              </ul>
              <p className={s.season}>{c.train.season}</p>
              <a className={s.go} data-press {...book}>
                {c.train.book}
              </a>
            </div>
          </div>
          <div className={s.storyPart}>
            <figure className={s.van} data-wipe>
              <Pic pic={pic(data, 'van')} sizes="(min-width: 900px) 40vw, 100vw" />
            </figure>
            <div className={s.storyText}>
              <p className={s.label}>{c.story.label}</p>
              <h3>{c.story.heading}</h3>
              <p className={s.body}>{c.story.text}</p>
              <p className={s.grew}>
                {[c.story.first, c.story.now].map((f) => (
                  <span key={f.value}>
                    <small>{f.pre}</small>
                    <b>{f.value}</b> {f.label}
                  </span>
                ))}
              </p>
            </div>
            <div className={s.voice}>
              <blockquote className={s.quote}>
                <p>{c.story.quote.text}</p>
                <footer>{c.story.quote.source}</footer>
              </blockquote>
              {data.rating && (
                <p className={s.rating}>
                  <b>{data.rating.value}</b> {c.story.ratingUnit.replace('{count}', String(data.rating.count))} <small>{c.story.ratingSource}</small>
                </p>
              )}
              <ul className={s.proofList}>
                {c.story.proof.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className={s.choose} id="choose" aria-labelledby="choose-h">
          <header className={s.chooseHead}>
            <p className={s.label}>{c.choose.label}</p>
            <h2 id="choose-h" data-reveal>
              {c.choose.heading}
            </h2>
          </header>
          <LamplightChooser
            sentence={c.choose.sentence}
            defaults={c.choose.defaults}
            demo={c.choose.demo}
            trips={c.choose.trips}
            way={c.choose.way}
            none={c.choose.none}
            soon={c.choose.soon}
            call={{ tel: c.call.tel, display: c.call.display }}
            cls={{
              root: s.chooser,
              sentence: s.sentence,
              hint: s.hint,
              pick: s.pick,
              list: s.trail,
              trip: s.way,
              name: s.wayName,
              meta: s.wayMeta,
              price: s.wayPrice,
              way: s.lit2,
              wayLabel: s.litLabel,
              wayName: s.litName,
              wayPrice: s.litPrice,
              go: s.go,
              none: s.litNone,
              soon: s.litSoon,
            }}
          />
        </section>
      </main>

      <footer className={s.foot}>
        <div className={s.calls}>
          <a className={s.bigCall} href={c.call.tel} data-press>
            <small>{c.end.callLabel}</small>
            {c.call.display}
          </a>
          <a className={s.smallCall} href={c.freephone.tel} data-press>
            <small>{c.freephone.label}</small>
            {c.freephone.display}
          </a>
          <a className={s.smallCall} href={`mailto:${c.email}`} data-press>
            <small>{c.end.emailLabel}</small>
            {c.email}
          </a>
        </div>
        <div className={s.road}>
          <p className={s.roadLabel}>{road.label}</p>
          <div className={s.roadLine}>
            <span className={s.roadLeg}>{road.fromTime}</span>
            <span className={s.roadLeg}>{road.toTime}</span>
            <span className={s.roadTrack} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className={s.roadEnd}>{road.from}</span>
            <b className={s.roadHere}>{road.here}</b>
            <span className={s.roadEnd}>{road.to}</span>
          </div>
          <p className={s.address}>{c.end.address}</p>
        </div>
        <p className={s.cafe}>
          <b>{c.end.cafe.name}</b>
          {c.end.cafe.hours.map((x) => (
            <span key={x.when}>
              {x.when} <strong>{x.time}</strong>
            </span>
          ))}
        </p>
        <div className={s.small}>
          <p className={s.footMark}>
            {c.wordmark} <span>{c.end.post}</span>
          </p>
          <DemoFoot domain={data.domain} />
        </div>
      </footer>

      <StickyBar main={{ label: c.book.label, href: c.book.href, external: true }} call={{ label: c.call.label, tel: c.call.tel }} />
    </div>
  );
}

export const lamplight: Design = { Demo, fonts: ['darker-grotesque-latin-wght-normal', 'hanken-grotesk-latin-wght-normal'], heroSizes: '2560px' };
