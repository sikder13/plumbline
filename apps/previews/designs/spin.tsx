import type { CSSProperties } from 'react';
import { DemoFoot } from '@/components/DemoFoot';
import { Pic } from '@/components/Pic';
import { SpinChoose, type Choice } from '@/components/SpinChoose';
import { SpinCue } from '@/components/SpinCue';
import { SpinRun } from '@/components/SpinRun';
import { SpinTrail } from '@/components/SpinTrail';
import { StickyBar } from '@/components/StickyBar';
import { pic, type PageData } from '@/lib/data';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Link {
  label: string;
  href: string;
}

interface Fare {
  price: string;
  who: string;
}

interface Content {
  wordmark: string;
  place: string[];
  book: Link;
  call: { label: string; tel: string; display: string };
  mobile: { label: string; tel: string; display: string };
  email: string;
  fares: { label: string; rows: Fare[] };
  hero: { lines: string[]; sub: string };
  run: {
    heading: string;
    steps: { title: string; text: string }[];
    marks: { wharf: string; track: string; places: string[] };
    spin: { value: string; label: string };
  };
  choose: { heading: string; lead: string; group: string; choices: Choice[]; source: string };
  family: {
    kicker: string;
    lead: string;
    heading: string;
    many: string[];
    tail: string;
    before: string;
    year: string;
    after: string;
    personal: { heading: string; text: string };
  };
  safety: { kicker: string; lines: string[]; for: string; text: string[]; proof: { text: string; where: string }[] };
  end: { heading: string; news: string; enquiries: string; see: string; emailLabel: string };
  ticker: string;
}

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The boat as the mark: a hull seen from above, bow forward. */
function Hull({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 22" aria-hidden="true" focusable="false">
      <path d="M1 3H25L39 11L25 19H1Z" />
    </svg>
  );
}

/** Contour lines for a canyon wall, bunching toward its inner edge. */
function Wall({ className, side }: { className?: string; side: 'left' | 'right' }) {
  const lines = Array.from({ length: 14 }, (_, k) => k);
  return (
    <div className={className} data-side={side} aria-hidden="true">
      <svg viewBox="0 0 300 600" preserveAspectRatio="none" focusable="false">
        {lines.map((k) => {
          const x = 300 - 6 - k * k * 1.45;
          return <path key={k} d={`M${x} -10C${x - 26} 120 ${x + 22} 230 ${x - 14} 330S${x + 18} 520 ${x - 8} 610`} />;
        })}
      </svg>
    </div>
  );
}

/**
 * A river gorge at speed. The page opens on the headline and the one boat photograph held between
 * two slanted walls; the run is then drawn as the river from above, its banks closing in and opening
 * out as the boat holds its place and turns a full circle; the visitor weighs river against land on a
 * split stage with the real fares; the family's years on the river build as a sentence; and the walls
 * of the gorge part on the booking.
 */
function Demo({ data }: { data: PageData }) {
  const c = data.demo as Content;
  const { css, s } = designStyles('spin', ['DM Sans', 'Instrument Sans']);
  const book = { href: c.book.href, rel: 'noopener' };
  const pictures = Object.fromEntries(
    c.choose.choices.filter((ch) => ch.image).map((ch) => [ch.image!, <Pic key={ch.image} pic={pic(data, ch.image!)} sizes="(min-width: 900px) 90vw, 100vw" />]),
  );

  const fares = (cls?: string) => (
    <p className={cls}>
      <span className={s.faresLabel}>{c.fares.label}</span>
      {c.fares.rows.map((f) => (
        <span key={f.price} className={s.fare}>
          <b>{f.price}</b> {f.who}
        </span>
      ))}
    </p>
  );

  return (
    <div className={s.root}>
      <style href="spin" precedence="design">
        {css}
      </style>

      <section className={s.hero} id="top" data-hero aria-labelledby="spin-h1">
        <Wall className={s.heroLines} side="right" />
        <div className={s.heroTop}>
          <a className={s.mark} href="#top" aria-label={data.name}>
            <Hull className={s.markHull} />
            <span>{c.wordmark}</span>
          </a>
          <p className={s.place}>
            {c.place.map((p) => (
              <span key={p}>{p}</span>
            ))}
          </p>
        </div>
        <h1 className={s.title} id="spin-h1" aria-label={c.hero.lines.join(' ')}>
          {c.hero.lines.map((l, i) => (
            <span key={l} className={s.line} aria-hidden="true">
              <span style={{ '--i': i } as CSSProperties}>{l}</span>
            </span>
          ))}
        </h1>
        <div className={s.channel}>
          <Pic pic={pic(data, 'hero')} phone={data.images.heroPhone} sizes="100vw" first />
          <span className={s.flash} aria-hidden="true" />
        </div>
        <div className={s.heroFoot}>
          <p className={s.sub}>{c.hero.sub}</p>
          {fares(s.heroFares)}
          <a className={s.go} data-press data-magnetic {...book}>
            {c.book.label}
            <Arrow />
          </a>
        </div>
      </section>

      <main>
        <SpinRun
          id="run"
          heading={c.run.heading}
          steps={c.run.steps}
          marks={c.run.marks}
          spin={c.run.spin}
          cls={{
            run: s.run,
            frame: s.runFrame,
            scene: s.runScene,
            copy: s.runCopy,
            head: s.runHead,
            steps: s.runSteps,
            turn: s.turn,
            turnValue: s.turnValue,
            turnLabel: s.turnLabel,
            line: s.rvLine,
            lines: s.rvLines,
            bed: s.rvBed,
            body: s.rvBody,
            shine: s.rvShine,
            isle: s.rvIsle,
            rapid: s.rvRapid,
            label: s.rvLabel,
            track: s.rvTrack,
            wharf: s.rvWharf,
            boat: s.rvBoat,
            spinner: s.rvSpinner,
            ring: s.rvRing,
            wake: s.rvWake,
            hull: s.rvHull,
          }}
        />

        <section className={s.choose} id="choose" aria-labelledby="choose-h">
          <header className={s.chooseHead}>
            <h2 id="choose-h" data-reveal>
              {c.choose.heading}
            </h2>
            <p data-reveal>{c.choose.lead}</p>
          </header>
          <SpinChoose
            group={c.choose.group}
            choices={c.choose.choices}
            pictures={pictures}
            cls={{
              root: s.chooser,
              pick: s.pick,
              stage: s.stage,
              land: s.landSide,
              shot: s.shot,
              drawn: s.drawnSide,
              word: s.sideWord,
              seam: s.seam,
              info: s.info,
              prices: s.infoPrices,
              also: s.also,
              go: s.go,
              lines: s.miniLines,
              body: s.miniBody,
              boat: s.miniBoat,
            }}
          />
          <p className={s.source}>{c.choose.source}</p>
        </section>

        <section className={s.family} id="since" aria-labelledby="since-h">
          <p className={s.kicker}>{c.family.kicker}</p>
          <SpinCue className={s.sentence} amount={0.15}>
            <p className={s.lead}>{c.family.lead}</p>
            <h2 id="since-h">{c.family.heading}</h2>
            <p className={s.many}>
              {c.family.many.map((m, i) => (
                <span key={i} className={s.manyWord} style={{ '--i': i } as CSSProperties}>
                  {m}
                  {i < c.family.many.length - 1 && <i className={s.dots} aria-hidden="true" />}
                </span>
              ))}
              <span className={s.tail} style={{ '--i': c.family.many.length } as CSSProperties}>
                {c.family.tail}
              </span>
            </p>
          </SpinCue>
          <SpinCue className={s.yearRow} amount={0.3}>
            <p className={s.before}>{c.family.before}</p>
            <p className={s.year}>{c.family.year}</p>
            <p className={s.after}>{c.family.after}</p>
          </SpinCue>
          <div className={s.personal}>
            <div className={s.personalPic} data-wipe>
              <Pic pic={pic(data, 'guests')} sizes="(min-width: 900px) 52vw, 100vw" />
            </div>
            <div className={s.personalText}>
              <h3 data-reveal>{c.family.personal.heading}</h3>
              <p data-reveal>{c.family.personal.text}</p>
            </div>
          </div>
        </section>

        <section className={s.safety} id="safety" aria-labelledby="safety-h">
          <SpinCue className={s.safetyHead} amount={0.3}>
            <p className={s.kicker}>{c.safety.kicker}</p>
            <h2 id="safety-h" className={s.twin}>
              {c.safety.lines.map((l, i) => (
                <span key={l} style={{ '--i': i } as CSSProperties}>
                  {l}
                </span>
              ))}
            </h2>
            <p className={s.forLine}>{c.safety.for}</p>
          </SpinCue>
          <div className={s.safetyPic} data-wipe>
            <Pic pic={pic(data, 'snow')} sizes="(min-width: 900px) 46vw, 100vw" />
          </div>
          <div className={s.safetyText}>
            {c.safety.text.map((t) => (
              <p key={t} className={s.safetyLine} data-reveal>
                {t}
              </p>
            ))}
          </div>
          <SpinCue className={s.proof} amount={0.3}>
            <ul>
              {c.safety.proof.map((p, i) => (
                <li key={p.text} style={{ '--i': i } as CSSProperties}>
                  <b>{p.text}</b>
                  <span>{p.where}</span>
                </li>
              ))}
            </ul>
          </SpinCue>
        </section>

        <SpinCue as="section" className={s.end} id="book" labelledBy="book-h" amount={0.25}>
          <Wall className={s.wall} side="left" />
          <Wall className={s.wall} side="right" />
          <div className={s.endInner}>
            <h2 id="book-h" className={s.endHead}>
              {c.end.heading}
            </h2>
            {fares(s.endFares)}
            <a className={s.goDark} data-press data-magnetic {...book}>
              {c.book.label}
              <Arrow />
            </a>
            <div className={s.news}>
              <p>{c.end.news}</p>
              <p>{c.end.enquiries}</p>
              <p className={s.see}>{c.end.see}</p>
            </div>
            <ul className={s.reach}>
              <li>
                <a href={c.call.tel}>
                  <span>{c.call.label}</span>
                  <b>{c.call.display}</b>
                </a>
              </li>
              <li>
                <a href={c.mobile.tel}>
                  <span>{c.mobile.label}</span>
                  <b>{c.mobile.display}</b>
                </a>
              </li>
              <li>
                <a href={`mailto:${c.email}`}>
                  <span>{c.end.emailLabel}</span>
                  <b>{c.email}</b>
                </a>
              </li>
            </ul>
          </div>
        </SpinCue>
      </main>

      <footer className={s.foot}>
        <div className={s.ticker} aria-hidden="true">
          <div className={s.tickerTrack}>
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i}>
                {c.ticker}
                <Hull className={s.tickerHull} />
              </span>
            ))}
          </div>
        </div>
        <div className={s.footNote}>
          <DemoFoot domain={data.domain} />
        </div>
      </footer>

      <SpinTrail cls={{ root: s.trail, base: s.trailBase, done: s.trailDone, boat: s.trailBoat }} />

      <StickyBar main={{ label: c.book.label, href: c.book.href, external: true }} call={{ label: c.call.label, tel: c.call.tel }} />
    </div>
  );
}

export const spin: Design = { Demo, fonts: ['dm-sans-latin-wght-italic', 'instrument-sans-latin-wght-normal'], heroSizes: '100vw' };
