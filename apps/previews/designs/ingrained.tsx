import type { CSSProperties } from 'react';
import { DemoFoot } from '@/components/DemoFoot';
import { frameState, frameVars } from '@/components/IngrainedGeometry';
import { IngrainedNest } from '@/components/IngrainedNest';
import { IngrainedPlan, type PlanContent } from '@/components/IngrainedPlan';
import { IngrainedSeen } from '@/components/IngrainedSeen';
import { IngrainedWall } from '@/components/IngrainedWall';
import { Pic } from '@/components/Pic';
import { StickyBar } from '@/components/StickyBar';
import { pic, type PageData } from '@/lib/data';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Frame {
  image: string;
  who: string;
  line: string;
}

interface Content {
  wordmark: string;
  wordmarkSub: string;
  place: string;
  book: { label: string; href: string };
  call: { label: string; tel: string; display: string };
  email: string;
  hero: { kicker: string; lines: string[]; sub: string; priceLine: string; nest: string[]; now: string };
  story: { kicker: string; heading: string; quote: string; frames: Frame[]; you: { who: string; line: string; action: string } };
  boat: { kicker: string; heading: string; lead: string; length: string; beam: string; features: string[]; skipperLabel: string; skipper: string };
  plan: PlanContent;
  guests: {
    kicker: string;
    heading: string;
    ratingUnit: string;
    ratingFrom: string;
    ratingSource: string;
    quotes: { text: string; by: string }[];
    photos: string[];
    species: string[];
    speciesLabel: string;
  };
  end: {
    kicker: string;
    heading: string;
    line: string;
    role: string;
    callLabel: string;
    emailLabel: string;
    departLabel: string;
    departs: string[];
    when: string;
    vouchers: string;
    reg: string;
    frameLabel: string;
  };
}

/** Each generation's frame is half as big again as the one before, and they share a corner. */
const RATIO = 1.5;

/**
 * Frames drawn one inside the corner of the next, the oldest smallest, each with its label. The
 * same mark opens the page (in the corner of today's photograph) and closes it.
 */
function NestMark({ labels, s, className }: { labels: string[]; s: Record<string, string>; className?: string }) {
  const n = labels.length;
  const sizes = labels.map((_, i) => Math.pow(RATIO, i - (n - 1)));
  return (
    <div className={className} aria-hidden="true">
      <svg viewBox="0 0 400 300" focusable="false">
        {sizes.map((sc, i) => (
          <rect key={labels[i]} x="1" y={(300 * (1 - sc) + 1).toFixed(1)} width={(400 * sc - 2).toFixed(1)} height={(300 * sc - 2).toFixed(1)} pathLength={1} style={{ '--i': i } as CSSProperties} />
        ))}
      </svg>
      {sizes.map((sc, i) => (
        <span key={labels[i]} className={s.nestLabel} style={{ top: `${((1 - sc) * 100).toFixed(2)}%`, '--i': i } as CSSProperties}>
          {labels[i]}
        </span>
      ))}
    </div>
  );
}

/**
 * The opening frame: today's photograph fills it, and the family's earlier frames are drawn into its
 * top corner, the oldest smallest. The band left over, where the boat is, is today.
 */
function HeroNest({ labels, now, s }: { labels: string[]; now: string; s: Record<string, string> }) {
  const n = labels.length;
  const sizes = labels.map((_, i) => 0.56 * Math.pow(RATIO, i - (n - 1)));
  return (
    <div className={s.heroNest} aria-hidden="true">
      {sizes.map((sc, i) => (
        <span key={labels[i]} className={s.heroRing} style={{ width: `${(sc * 100).toFixed(2)}%`, height: `${(sc * 100).toFixed(2)}%`, '--i': i } as CSSProperties}>
          <span className={s.heroNestLabel}>{labels[i]}</span>
        </span>
      ))}
      <span className={s.heroNow}>{now}</span>
    </div>
  );
}

/**
 * A fishing family's water, handed down. Their drone photograph of today's boat opens the page with
 * the family's earlier frames drawn into its corner; the story zooms out through those frames, from
 * a 1960s print to an empty frame left for the visitor; the visitor's day writes itself as a
 * sentence with their real prices and today's blue cod rule; and the close is the next frame.
 */
function Demo({ data }: { data: PageData }) {
  const c = data.demo as Content;
  const { css, s } = designStyles('ingrained', ['Cormorant Garamond', 'Sora']);
  const frames = c.story.frames;
  const last = frames.length;
  const words = c.story.quote.split(' ');
  const rating = data.rating;
  const g = c.guests;
  const rows = [g.photos.slice(0, 4), g.photos.slice(4)];
  const mail = `mailto:${c.email}`;

  return (
    <div className={s.root}>
      <style href="ingrained" precedence="design">
        {css}
      </style>

      <section className={s.hero} id="top" data-hero>
        <a className={s.heroTab} href="#top">
          <b>
            {c.wordmark} {c.wordmarkSub}
          </b>
          <span>{c.place}</span>
        </a>
        <div className={s.heroFrame}>
          <div className={s.heroMedia}>
            <Pic pic={pic(data, 'hero')} phone={data.images.heroPhone} sizes="(min-width: 900px) 62vw, 100vw" first />
          </div>
          <HeroNest labels={c.hero.nest} now={c.hero.now} s={s} />
        </div>
        <div className={s.heroText}>
          <p className={s.heroKicker}>{c.hero.kicker}</p>
          <h1 className={s.title} aria-label={c.hero.lines.join(' ')}>
            {c.hero.lines.map((l, i) => (
              <span key={l} className={s.line} aria-hidden="true">
                <span style={{ '--i': i } as CSSProperties}>{l}</span>
              </span>
            ))}
          </h1>
          <p className={s.heroSub}>{c.hero.sub}</p>
          <a className={s.block} href={c.book.href} data-press data-magnetic>
            <b>{c.book.label}</b>
            <span>{c.hero.priceLine}</span>
          </a>
        </div>
      </section>

      <main>
        <section className={s.story} id="story" aria-labelledby="story-h">
          <IngrainedNest className={s.nest} ratio={RATIO} last={last}>
            <div className={s.storyFrame}>
              <header className={s.storyHead}>
                <p className={s.kicker}>{c.story.kicker}</p>
                <h2 id="story-h">{c.story.heading}</h2>
                <p className={s.quote} style={{ '--n': words.length } as CSSProperties}>
                  {words.map((w, i) => (
                    <span key={`${w}${i}`} style={{ '--i': i } as CSSProperties}>
                      {w}{' '}
                    </span>
                  ))}
                </p>
              </header>
              <div className={s.stage}>
                {frames.map((f, k) => (
                  <figure key={f.image} className={s.frame} data-k={k} style={{ '--k': k, ...frameVars(frameState(k, 0, RATIO, last)) } as CSSProperties}>
                    <div className={s.framePic}>
                      <Pic pic={pic(data, f.image)} sizes="(min-width: 900px) 960px, 480px" />
                    </div>
                    <figcaption className={s.cap}>
                      <b>{f.who}</b>
                      <span>{f.line}</span>
                    </figcaption>
                  </figure>
                ))}
                <div className={s.you} data-k={last} style={{ '--k': last, ...frameVars(frameState(last, 0, RATIO, last)) } as CSSProperties}>
                  <div className={s.youText}>
                    <p className={s.youWho}>{c.story.you.who}</p>
                    <p className={s.youLine}>{c.story.you.line}</p>
                    <a className={s.youGo} href={c.book.href} data-press>
                      {c.story.you.action}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </IngrainedNest>
        </section>

        <section className={s.boat} id="boat" aria-labelledby="boat-h">
          <header className={s.boatHead}>
            <p className={s.kicker}>{c.boat.kicker}</p>
            <h2 id="boat-h" data-reveal>
              {c.boat.heading}
            </h2>
            <p className={s.boatLead} data-reveal>
              {c.boat.lead}
            </p>
          </header>
          <IngrainedSeen className={s.boatPic} as="figure">
            <IngrainedWall className={s.boatMove}>
              <Pic pic={pic(data, 'boat')} sizes="(min-width: 900px) 64vw, 108vw" />
              <svg className={s.dim} viewBox="0 0 1000 708" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <path d="M114 582V630M114 606H984M984 582V630" pathLength={1} />
              </svg>
              <p className={s.dimLabel} aria-hidden="true">
                <b>{c.boat.length}</b>
                <span>{c.boat.beam}</span>
              </p>
            </IngrainedWall>
          </IngrainedSeen>
          <div className={s.boatSide}>
            <IngrainedSeen className={s.kit} as="ul">
              {c.boat.features.map((f, i) => (
                <li key={f} style={{ '--i': i } as CSSProperties}>
                  {f}
                </li>
              ))}
            </IngrainedSeen>
            <p className={s.skipper} data-reveal>
              <span>{c.boat.skipperLabel}</span>
              {c.boat.skipper}
            </p>
          </div>
        </section>

        <section className={s.plan} id="plan" aria-labelledby="plan-h">
          <IngrainedPlan
            c={c.plan}
            email={c.email}
            cls={{
              root: s.planRoot!,
              inner: s.planInner!,
              kicker: s.kicker!,
              heading: s.planHeading!,
              waters: s.waters!,
              water: s.water!,
              waterName: s.waterName!,
              waterOpen: s.waterOpen!,
              surface: s.surface!,
              controls: s.controls!,
              switch: s.switch!,
              counter: s.counter!,
              panelPrice: s.panelPrice!,
              result: s.result!,
              option: s.option!,
              optText: s.optText!,
              prices: s.prices!,
              cod: s.cod!,
              codSay: s.codSay!,
              codRule: s.codRule!,
              include: s.include!,
              send: s.send!,
            }}
          />
        </section>

        <section className={s.guests} id="guests" aria-labelledby="guests-h">
          <header className={s.guestsHead}>
            <div>
              <p className={s.kicker}>{g.kicker}</p>
              <h2 id="guests-h" data-reveal>
                {g.heading}
              </h2>
            </div>
            {rating && (
              <div className={s.rated} data-reveal>
                <p className={s.ratedValue}>
                  <b>{rating.value}</b>
                  <span aria-hidden="true">★★★★★</span>
                </p>
                <p className={s.ratedText}>
                  {g.ratingFrom} {rating.count} {g.ratingUnit}
                  <small>{g.ratingSource}</small>
                </p>
              </div>
            )}
          </header>
          <IngrainedWall className={s.wall}>
            {rows.map((row) => (
              <div key={row.join()} className={s.row}>
                {row.map((key) => (
                  <div key={key} className={s.tile}>
                    <Pic pic={pic(data, key)} sizes="(min-width: 900px) 22vw, 46vw" />
                  </div>
                ))}
              </div>
            ))}
          </IngrainedWall>
          <div className={s.said}>
            {g.quotes.map((q) => (
              <blockquote key={q.by} data-reveal>
                <p>{q.text}</p>
                <footer>{q.by}</footer>
              </blockquote>
            ))}
          </div>
          <p className={s.species}>
            <span>{g.speciesLabel}</span>
            {g.species.map((sp) => (
              <b key={sp}>{sp}</b>
            ))}
          </p>
        </section>

        <section className={s.end} id="contact" aria-labelledby="end-h">
          <div className={s.endFrame}>
            <p className={s.endTab} aria-hidden="true">
              {c.end.frameLabel}
            </p>
            <div className={s.endPic}>
              <Pic pic={pic(data, 'bay')} sizes="(min-width: 900px) 46vw, 100vw" />
            </div>
            <div className={s.endText}>
              <p className={s.kicker}>{c.end.kicker}</p>
              <h2 id="end-h" data-reveal>
                {c.end.heading}
              </h2>
              <p className={s.endLine}>{c.end.line}</p>
              <div className={s.doors}>
                <a className={s.door} href={c.call.tel} data-press>
                  <span>{c.end.callLabel}</span>
                  <b>{c.call.display}</b>
                </a>
                <a className={s.door} href={mail} data-press>
                  <span>{c.end.emailLabel}</span>
                  <b>{c.email}</b>
                </a>
              </div>
              <p className={s.role}>{c.end.role}</p>
            </div>
            <div className={s.departs}>
              <p>{c.end.departLabel}</p>
              <ul>
                {c.end.departs.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
            <p className={s.endWhen}>
              {c.end.when} {c.end.vouchers}
            </p>
            <div className={s.endFoot}>
              <NestMark labels={c.hero.nest} s={s} className={s.endNest} />
              <div className={s.foot}>
                <p>{c.end.reg}</p>
                <DemoFoot domain={data.domain} />
              </div>
            </div>
          </div>
        </section>
      </main>

      <nav className={s.dock} aria-label={c.book.label}>
        <a href={c.call.tel}>{c.call.display}</a>
        <a className={s.dockGo} href={c.book.href} data-press>
          {c.book.label}
        </a>
      </nav>

      <StickyBar main={{ label: c.book.label, href: c.book.href }} call={{ label: c.call.label, tel: c.call.tel }} />
    </div>
  );
}

export const ingrained: Design = { Demo, fonts: ['cormorant-garamond-latin-wght-italic', 'sora-latin-wght-normal'], heroSizes: '100vw' };
