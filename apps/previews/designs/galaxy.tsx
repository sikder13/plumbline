import type { CSSProperties } from 'react';
import { DemoFoot } from '@/components/DemoFoot';
import { GalaxyDescent } from '@/components/GalaxyDescent';
import { GalaxyStars } from '@/components/GalaxyStars';
import { GalaxyTorch } from '@/components/GalaxyTorch';
import { GalaxyTours, type GalaxyTour } from '@/components/GalaxyTours';
import { GalaxyWays } from '@/components/GalaxyWays';
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

interface Content {
  wordmark: string;
  wordmarkSub: string;
  nav: Link[];
  book: Link & { from: string; fromNote: string; pill: string };
  call: { label: string; tel: string; display: string; kind: string };
  email: string;
  hero: { place: string; lines: string[]; sub: string; facts: string[] };
  eyes: {
    label: string;
    heading: string;
    quote: string;
    family: string;
    years: { before: string; value: string; after: string };
    people: { who: string; text: string }[];
    member: string;
  };
  tour: {
    label: string;
    heading: string;
    lead: string;
    duration: string;
    kinds: { surface: string; under: string };
    steps: { under: boolean; scene: string; title: string; text: string; note?: string; image?: string }[];
  };
  dark: {
    label: string;
    heading: string;
    strength: string;
    steps: { title: string; text?: string; quote?: string; who?: string }[];
    lamp: { on: string; off: string };
    hint: { touch: string; pointer: string };
  };
  tours: { label: string; heading: string; lead: string; choose: string; durationLabel: string; bring: { label: string; text: string }; list: GalaxyTour[] };
  questions: { label: string; heading: string; items: { q: string; a: string[]; beads?: number }[]; quote: { text: string; who: string } };
  here: {
    label: string;
    heading: string;
    lead: string;
    far: string;
    address: string;
    choose: string;
    mapNote: string;
    routes: { id: string; label: string; sub: string; heading: string; turns: { dir: string; text: string }[] }[];
  };
  end: {
    lines: string[];
    departLabel: string;
    depart: string;
    bookNote: string;
    emailLabel: string;
    callLabel: string;
    acknowledge: string;
    partners: string;
    post: string;
  };
}

/** A turn in the directions, drawn as the way the road goes. */
function Turn({ dir }: { dir: string }) {
  const d: Record<string, string> = {
    ahead: 'M12 20V5M7 10l5-5 5 5',
    right: 'M8 20v-7a4 4 0 0 1 4-4h8M16 5l4 4-4 4',
    left: 'M16 20v-7a4 4 0 0 0-4-4H4M8 5L4 9l4 4',
    turn: 'M12 20v-8M12 12l6-6M12 12L6 6',
    end: 'M12 3a6 6 0 0 1 6 6c0 4.5-6 11-6 11S6 13.5 6 9a6 6 0 0 1 6-6z',
  };
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path d={d[dir] ?? d.ahead} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      {dir === 'end' && <circle cx="12" cy="9" r="2.2" fill="currentColor" />}
    </svg>
  );
}

/**
 * A visit underground as your eyes adjust to the dark. The page opens on a field of glowworm light,
 * and a lamp opens a circle in it where the real cave shows. A glowworm's thread then runs on through
 * the tour, drawn as a cross section the view travels through; through a cave where the lights go
 * out; and through the tours, the questions and the way there, until the page comes back up into
 * daylight to book.
 */
function Demo({ data }: { data: PageData }) {
  const c = data.demo as Content;
  const { css, s } = designStyles('galaxy', ['Bodoni Moda', 'Manrope']);
  const book = { href: c.book.href, rel: 'noopener' };
  const lit = <Pic pic={pic(data, 'dark')} phone={data.images.darkPhone} sizes="100vw" />;
  const steps = c.tour.steps.map((st) => ({
    under: st.under,
    scene: st.scene,
    title: st.title,
    text: st.text,
    note: st.note,
    picture: st.image ? <Pic pic={pic(data, st.image)} sizes="(min-width: 900px) 240px, 140px" /> : undefined,
  }));
  return (
    <div className={s.root}>
      <style href="galaxy" precedence="design">
        {css}
      </style>
      <svg className={s.defs} width="0" height="0" aria-hidden="true" focusable="false">
        <filter id="galaxy-glow-hero" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="-1.08 1.8 1.08 0 -0.24  -1.08 1.8 1.08 0 -0.24  -1.08 1.8 1.08 0 -0.24  0 0 0 0 1" result="v" />
          <feComponentTransfer in="v" result="g">
            <feFuncR type="gamma" amplitude="1" exponent="2.2" offset="0" />
            <feFuncG type="gamma" amplitude="1" exponent="2.2" offset="0" />
            <feFuncB type="gamma" amplitude="1" exponent="2.2" offset="0" />
          </feComponentTransfer>
          <feColorMatrix in="g" type="matrix" values="0.6 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="tint" />
          <feGaussianBlur in="tint" stdDeviation="3" result="blur" />
          <feComposite in="tint" in2="blur" operator="arithmetic" k1="0" k2="1" k3="1.5" k4="0" />
        </filter>
      </svg>

      <nav className={s.nav} aria-label="Sections">
        <a className={s.navMark} href="#top">
          {c.wordmark}
        </a>
        <SectionLinks className={s.navLinks} items={c.nav} />
        <a className={s.navBook} data-press data-magnetic {...book}>
          {c.book.label}
          <small>{c.book.from}</small>
        </a>
      </nav>

      <section className={s.hero} id="top" data-hero>
        <div className={s.heroMedia}>
          <span className={s.field}>
            <Pic pic={pic(data, 'hero')} phone={data.images.heroPhone} sizes="100vw" first />
          </span>
          <span className={s.veil} aria-hidden="true" />
          <span className={s.lit} aria-hidden="true">
            <Pic pic={pic(data, 'hero')} phone={data.images.heroPhone} sizes="100vw" alt="" />
          </span>
          <span className={s.ring} aria-hidden="true" />
        </div>
        <p className={s.mark}>
          <span>{c.wordmark}</span>
          <small>{c.wordmarkSub}</small>
        </p>
        <h1 className={s.title} aria-label={c.hero.lines.join(' ')}>
          {c.hero.lines.map((l, i) => (
            <span key={l} className={s.line} aria-hidden="true">
              <span style={{ '--i': i } as CSSProperties}>{l}</span>
            </span>
          ))}
        </h1>
        <div className={s.heroAside}>
          <p className={s.heroSub}>{c.hero.sub}</p>
          <p className={s.facts}>
            {c.hero.facts.map((fact) => (
              <span key={fact}>{fact}</span>
            ))}
          </p>
        </div>
        <div className={s.heroAct}>
          <a className={s.heroGo} data-press {...book}>
            <span>{c.book.label}</span>
            <b>{c.book.from}</b>
          </a>
          <p className={s.heroNote}>{c.book.fromNote}</p>
        </div>
      </section>

      <main>
        <section className={s.eyes} aria-labelledby="eyes-h">
          <span className={s.hang} aria-hidden="true" />
          <h2 id="eyes-h">{c.eyes.heading}</h2>
          <div className={s.eyesGrid}>
            <blockquote className={s.fill}>
              <p>
                {c.eyes.quote.split(' ').map((w, i) => (
                  <span key={i} style={{ '--i': i } as CSSProperties}>
                    {w}{' '}
                  </span>
                ))}
              </p>
            </blockquote>
            <figure className={s.eyesPic}>
              <Pic pic={pic(data, 'eyes')} sizes="(min-width: 900px) 420px, calc(100vw - 48px)" />
            </figure>
            <div className={s.eyesText}>
              <p className={s.family}>{c.eyes.family}</p>
              <p className={s.years}>
                {c.eyes.years.before} <b data-count>{c.eyes.years.value}</b> {c.eyes.years.after}
              </p>
              <ul className={s.people}>
                {c.eyes.people.map((p) => (
                  <li key={p.who} data-reveal>
                    <b>{p.who}</b>
                    <span>{p.text}</span>
                  </li>
                ))}
              </ul>
              <p className={s.member}>{c.eyes.member}</p>
            </div>
          </div>
        </section>

        <section className={s.tour} id="tour" aria-labelledby="tour-h">
          <header className={s.tourHead}>
            <span className={s.hang} aria-hidden="true" />
            <h2 id="tour-h">{c.tour.heading}</h2>
            <p>
              {c.tour.lead}, <span>{c.tour.duration}</span>
            </p>
          </header>
          <GalaxyDescent gid="galaxy-world" steps={steps} cls={{ story: s.story, frame: s.frame, world: s.world, drawing: s.drawing, place: s.place, text: s.placeText, note: s.note, pool: s.pool }} />
        </section>

        <section className={s.dark} id="dark" aria-labelledby="dark-h">
          <Pinned steps={c.dark.steps.length} className={s.darkStory}>
            <div className={s.darkMedia}>
              <div className={s.darkLit}>{lit}</div>
              <div className={s.darkGlow} aria-hidden="true">
                <Pic pic={pic(data, 'dark')} phone={data.images.darkPhone} sizes="100vw" alt="" />
                <GalaxyStars cls={{ stars: s.stars, still: s.still, shimmer: s.shimmer }} />
              </div>
              <span className={s.flash} aria-hidden="true" />
              <span className={s.finder} aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
              <GalaxyTorch
                picture={<Pic pic={pic(data, 'dark')} phone={data.images.darkPhone} sizes="100vw" alt="" />}
                labels={c.dark.lamp}
                hint={c.dark.hint}
                cls={{ lens: s.lens, lensInner: s.lensInner, lamp: s.lampButton, hint: s.hint, hintTouch: s.hintTouch, hintPointer: s.hintPointer, controls: s.controls }}
              />
            </div>
            <header className={s.darkHead}>
              <h2 id="dark-h">{c.dark.heading}</h2>
              <p className={s.strength}>{c.dark.strength}</p>
            </header>
            <ol className={s.darkSteps}>
              {c.dark.steps.map((st, i) => (
                <li key={st.title} data-step={i} data-state={i === 0 ? 'on' : 'off'}>
                  <h3>{st.title}</h3>
                  {st.text && <p>{st.text}</p>}
                  {st.quote && (
                    <blockquote>
                      <p>{st.quote}</p>
                      <footer>{st.who}</footer>
                    </blockquote>
                  )}
                </li>
              ))}
            </ol>
          </Pinned>
        </section>

        <section className={s.tours} id="tours" aria-labelledby="tours-h">
          <span className={s.hang} aria-hidden="true" />
          <h2 id="tours-h">{c.tours.heading}</h2>
          <p className={s.toursLead}>{c.tours.lead}</p>
          <GalaxyTours
            tours={c.tours.list}
            labels={{ choose: c.tours.choose, duration: c.tours.durationLabel }}
            cls={{
              chooser: s.chooser,
              tabs: s.tabs,
              tab: s.tab,
              tabThread: s.tabThread,
              tabName: s.tabName,
              tabFull: s.srOnly,
              tabTag: s.tabTag,
              tabPrice: s.tabPrice,
              ticket: s.ticket,
              section: s.mini,
              tName: s.tName,
              tText: s.tText,
              tFacts: s.tFacts,
              buy: s.buy,
              prices: s.prices,
              go: s.buyGo,
              tNote: s.tNote,
            }}
          />
          <p className={s.bring}>
            <b>{c.tours.bring.label}</b> {c.tours.bring.text}
          </p>
        </section>

        <section className={s.questions} id="questions" aria-labelledby="q-h">
          <span className={s.hang} aria-hidden="true" />
          <h2 id="q-h">{c.questions.heading}</h2>
          <div className={s.qGrid}>
            <div className={s.qList}>
              {c.questions.items.map((item, i) => (
                <details key={item.q} className={s.q} open={i === 0}>
                  <summary>
                    <i aria-hidden="true" />
                    {item.q}
                  </summary>
                  <div className={s.answer}>
                    {item.a.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                    {item.beads ? (
                      <span className={s.qBeads} aria-hidden="true">
                        {Array.from({ length: item.beads }, (_, k) => (
                          <i key={k} style={{ '--k': k } as CSSProperties} />
                        ))}
                      </span>
                    ) : null}
                  </div>
                </details>
              ))}
            </div>
            <aside className={s.qSide}>
              <figure className={s.qPic} data-wipe>
                <Pic pic={pic(data, 'walkway')} sizes="(min-width: 900px) 380px, calc(100vw - 48px)" />
              </figure>
              <blockquote className={s.voice}>
                <p>{c.questions.quote.text}</p>
                <footer>{c.questions.quote.who}</footer>
              </blockquote>
            </aside>
          </div>
        </section>

        <section className={s.here} id="here" aria-labelledby="here-h">
          <span className={s.hang} aria-hidden="true" />
          <h2 id="here-h">{c.here.heading}</h2>
          <div className={s.hereGrid}>
            <div className={s.hereText}>
              <p className={s.hereLead}>{c.here.lead}</p>
              <p className={s.far}>{c.here.far}</p>
              <p className={s.address}>
                <Turn dir="end" />
                {c.here.address}
              </p>
            </div>
            <GalaxyWays
              routes={c.here.routes}
              ask={c.here.choose}
              note={c.here.mapNote}
              icons={Object.fromEntries(['ahead', 'right', 'left', 'turn', 'end'].map((d) => [d, <Turn key={d} dir={d} />]))}
              cls={{ way: s.way, ask: s.ask, ways: s.ways, wayOption: s.wayOption, routes: s.routes, turns: s.turns, sketch: s.sketch, sketchNote: s.sketchNote }}
            />
          </div>
        </section>

        <section className={s.end} id="contact" aria-labelledby="end-h">
          <div className={s.mouth}>
            <h2 id="end-h" className={s.endTitle}>
              {c.end.lines.map((l, i) => (
                <span key={l} style={{ '--i': i } as CSSProperties}>
                  {l}
                </span>
              ))}
            </h2>
            <p className={s.endNote}>{c.end.bookNote}</p>
            <div className={s.drops}>
              <a className={`${s.dropItem} ${s.dropBook}`} data-press {...book}>
                <span>{c.book.label}</span>
                <b>{c.book.from}</b>
                <small>{c.book.fromNote}</small>
              </a>
              <a className={s.dropItem} href={c.call.tel} data-press>
                <span>{c.end.callLabel}</span>
                <b>{c.call.display}</b>
              </a>
              <a className={s.dropItem} href={`mailto:${c.email}`} data-press>
                <span>{c.end.emailLabel}</span>
                <b>{c.email}</b>
              </a>
            </div>
            <p className={s.depart}>
              <Turn dir="end" />
              <span>
                <small>{c.end.departLabel}</small>
                {c.end.depart}
              </span>
            </p>
            <footer className={s.small}>
              <p className={s.ack}>{c.end.acknowledge}</p>
              <p>{c.end.partners}</p>
              <p>{c.end.post}</p>
              <DemoFoot domain={data.domain} />
            </footer>
          </div>
        </section>
      </main>

      <StickyBar main={{ label: c.book.pill, href: c.book.href, external: true }} call={{ label: c.call.label, tel: c.call.tel }} />
    </div>
  );
}

export const galaxy: Design = { Demo, fonts: ['bodoni-moda-latin-wght-italic', 'manrope-latin-wght-normal'], heroSizes: '100vw' };
