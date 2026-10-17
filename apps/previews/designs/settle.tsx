import type { CSSProperties } from 'react';
import { DemoFoot } from '@/components/DemoFoot';
import { Pic } from '@/components/Pic';
import { Pinned } from '@/components/Pinned';
import { SettleCase, type SettleCaseText, type SettleWine } from '@/components/SettleCase';
import { SettleDock } from '@/components/SettleDock';
import { SettleFit } from '@/components/SettleFit';
import { SettleRead } from '@/components/SettleRead';
import { SettleSeen } from '@/components/SettleSeen';
import { StickyBar } from '@/components/StickyBar';
import { pic, type PageData } from '@/lib/data';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Link {
  label: string;
  href: string;
}

interface Step {
  season: string;
  verbs: string[];
  text: string;
  image: string;
  /** A drawing on white paper, laid onto its layer rather than framed. */
  drawing?: boolean;
}

interface Band {
  label: string;
  value?: string;
  note: string;
}

interface Content {
  wordmark: string;
  nav: Link[];
  dock: { top: string; contact: string };
  shop: Link;
  call: { label: string; tel: string; display: string };
  email: string;
  age: string;
  ageLong: string;
  hero: { kicker: string; on: string[]; off: string[]; sub: string; from: string; fromPrice: string; visit: Link; caption: string };
  year: { label: string; heading: string[]; lead: string; steps: Step[] };
  still: { label: string; heading: string[]; read: string; quote: string; garage: string };
  crew: { label: string; heading: string[]; roles: string[]; line: string; captain: string };
  wines: SettleCaseText & { label: string; heading: string[]; shipping: string; list: SettleWine[]; demo: number[] };
  wharf: {
    label: string;
    heading: string[];
    lead: string;
    view: string;
    start: string;
    rows: { name: string; when: string; end: string; text: string }[];
    music: string;
    try: string;
    noBook: string;
  };
  contact: { heading: string[]; rated: { label: string; unit: string; count: string; source: string }; call: Band; mail: Band; shop: Band; find: Band };
  foot: { line: string };
}

/** The opening drawing: the whole width on a phone, the right hand side of the first screen on a large one. */
const HERO_SIZES = '(min-width: 1100px) min(60vw, 860px), (min-width: 760px) 58vw, 100vw';

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * A heading in one of the page's two voices: heavy and wide for the hand work, light and narrow for
 * leaving the wine alone, or the two in turn, line by line. Each word rises from behind its own mask
 * as the heading arrives.
 */
function Voices({ lines, id, s, className, voice = 'mixed' }: { lines: string[]; id: string; s: Record<string, string>; className?: string; voice?: 'mixed' | 'light' | 'heavy' }) {
  let w = 0;
  return (
    <h2 id={id} className={`${s.voices} ${className ?? ''}`} data-settle="">
      {lines.map((line, i) => (
        <span key={line} className={voice === 'heavy' || (voice === 'mixed' && i % 2) ? s.heavy : s.light}>
          {line.split(' ').map((word, j) => (
            <span key={`${word}-${j}`}>
              <span className={s.mask}>
                <span style={{ '--w': w++ } as CSSProperties}>{word}</span>
              </span>{' '}
            </span>
          ))}
        </span>
      ))}
    </h2>
  );
}

/**
 * Hands on, then hands off. The page speaks in two voices, heavy and wide for the hand work, light and
 * narrow for leaving the wine alone, and is built in layers: the opening headline is split by a claret
 * line that rises and settles still; the year is laid down a job at a time, each layer darker than the
 * last, until the claret fills the frame and the winery goes quiet; the wines go into a half case; the
 * day on the wharf and the ways to get in touch are layers again.
 */
function Demo({ data }: { data: PageData }) {
  const c = data.demo as Content;
  const { css, s } = designStyles('settle', ['Syne', 'Work Sans']);
  const shop = { href: c.shop.href, rel: 'noopener' };
  const rows = c.wharf.rows;

  return (
    <div className={s.root}>
      <style href="settle" precedence="design">
        {css}
      </style>

      <SettleDock className={s.dock} name={c.wordmark} items={[...c.nav, { label: c.dock.contact, href: '#contact' }]} shop={c.shop} cls={{ mark: s.dockMark, where: s.dockWhere, shop: s.dockShop }} />

      <section className={s.hero} id="top" data-hero aria-labelledby="hero-h">
        <div className={s.top}>
          <a className={s.mark} href="#top">
            {c.wordmark}
          </a>
          <nav className={s.links} aria-label="Sections">
            {c.nav.map((n) => (
              <a key={n.href} href={n.href}>
                {n.label}
              </a>
            ))}
          </nav>
          <a className={s.topCall} href={c.call.tel} aria-label={`${c.call.label}, ${c.call.display}`}>
            {c.call.display}
          </a>
          <a className={s.topShop} {...shop} data-press>
            {c.shop.label}
          </a>
          <p className={s.kicker}>{c.hero.kicker}</p>
        </div>

        <h1 id="hero-h" className={s.title} aria-label={c.hero.on.join(' ')}>
          <span className={s.on} aria-hidden="true">
            {c.hero.on.map((w, i) => (
              <span key={w}>
                <span className={s.word}>
                  <span style={{ '--i': i } as CSSProperties}>{w}</span>
                </span>{' '}
              </span>
            ))}
          </span>
        </h1>
        <div className={s.wine}>
        <p className={s.off}>
          {c.hero.off.map((l) => (
            <span key={l}>
              <span>{l}</span>{' '}
            </span>
          ))}
        </p>

        <div className={s.below}>
          <div className={s.lede}>
            <p className={s.sub}>{c.hero.sub}</p>
            <div className={s.acts}>
              <a className={s.go} {...shop} data-press data-magnetic>
                <span className={s.goText}>
                  <b>{c.shop.label}</b>
                  <small>
                    {c.hero.from} {c.hero.fromPrice}
                  </small>
                </span>
                <Arrow />
              </a>
            </div>
            <p className={s.meta}>
              <span className={s.age}>{c.age}</span>
              <a className={s.soft} href={c.hero.visit.href}>
                {c.hero.visit.label}
              </a>
            </p>
          </div>
          <figure className={s.etch}>
            <div className={s.etchArt}>
              <Pic pic={pic(data, 'hero')} sizes={HERO_SIZES} first style={{ backgroundColor: 'transparent' }} />
            </div>
            <figcaption>{c.hero.caption}</figcaption>
          </figure>
        </div>
        </div>
      </section>

      <main>
        <section className={s.year} id="year" aria-labelledby="year-h">
          <Pinned steps={c.year.steps.length + 1} className={s.story} style={{ '--layers': c.year.steps.length } as CSSProperties}>
            <header className={s.yearHead}>
              <div>
                <p className={s.label}>{c.year.label}</p>
                <Voices id="year-h" lines={c.year.heading} s={s} />
              </div>
              <p className={s.yearLead}>{c.year.lead}</p>
            </header>
            <span className={s.flood} aria-hidden="true" />
            <ol className={s.stack}>
              {c.year.steps.map((st, k) => (
                <li key={st.season} className={s.layer} data-step={k} data-state={k === 0 ? 'on' : 'off'} data-season={k} style={{ '--k': k } as CSSProperties}>
                  <div className={s.layerBody}>
                    <h3 className={s.verbs}>
                      {st.verbs.map((v, j) => (
                        <span key={v} className={s.verbMask}>
                          <span style={{ '--j': j } as CSSProperties}>{v}</span>
                        </span>
                      ))}
                    </h3>
                    <div className={st.drawing ? s.layerArt : s.layerPic}>
                      <Pic pic={pic(data, st.image)} sizes="(min-width: 1100px) 560px, 360px" style={st.drawing ? { backgroundColor: 'transparent' } : undefined} />
                    </div>
                    <p className={s.layerText}>{st.text}</p>
                  </div>
                  <p className={s.tab}>
                    <span>{st.season}</span>
                    <span className={s.tabVerb} aria-hidden="true">
                      {st.verbs.join(' ')}
                    </span>
                  </p>
                </li>
              ))}
            </ol>
          </Pinned>
        </section>

        <section className={s.still} id="winery" aria-labelledby="still-h">
          <div className={s.stillText}>
            <p className={s.label}>{c.still.label}</p>
            <Voices id="still-h" lines={c.still.heading} s={s} voice="light" />
            <SettleRead className={s.read} text={c.still.read} />
          </div>
          <figure className={s.tanks} data-wipe>
            <Pic pic={pic(data, 'tanks')} sizes="(min-width: 1100px) 880px, 100vw" style={{ backgroundColor: 'transparent' }} parallax />
          </figure>
          <div className={s.stillSide}>
            <blockquote className={s.quote} data-reveal>
              <p>{c.still.quote}</p>
            </blockquote>
            <p className={s.garage} data-reveal>
              {c.still.garage}
            </p>
          </div>
        </section>

        <section className={s.crew} id="crew" aria-labelledby="crew-h">
          <Voices id="crew-h" lines={c.crew.heading} s={s} className={s.crewHeading} voice="heavy" />
          <p className={`${s.label} ${s.crewLabel}`}>{c.crew.label}</p>
          <SettleFit className={s.roles} lines={c.crew.roles} cls={{ line: s.role }} />
          <div className={s.crewFoot}>
            <figure className={s.boots}>
              <Pic pic={pic(data, 'boots')} sizes="(min-width: 1100px) 620px, 100vw" style={{ backgroundColor: 'transparent' }} parallax />
            </figure>
            <p className={s.captain} data-reveal>
              {c.crew.captain}
            </p>
            <p className={s.crewLine} data-reveal>
              {c.crew.line}
            </p>
          </div>
        </section>

        <section className={s.wines} id="wines" aria-labelledby="wines-h">
          <header className={s.winesHead}>
            <div>
              <p className={s.label}>{c.wines.label}</p>
              <Voices id="wines-h" lines={c.wines.heading} s={s} voice="heavy" />
            </div>
            <p className={s.shipping}>{c.wines.shipping}</p>
          </header>
          <SettleCase
            wines={c.wines.list}
            text={c.wines}
            age={`${c.age}. ${c.ageLong}`}
            demo={c.wines.demo}
            cls={{
              root: s.case,
              shelf: s.shelf,
              shelfLabel: s.shelfLabel,
              top: s.bottleTop,
              cap: s.cap,
              topName: s.topName,
              topPrice: s.topPrice,
              pips: s.pips,
              side: s.caseSide,
              carton: s.carton,
              slot: s.slot,
              disc: s.disc,
              slotName: s.slotName,
              status: s.status,
              order: s.order,
              note: s.caseNote,
            }}
          />
        </section>

        <section className={s.wharf} id="wharf" aria-labelledby="wharf-h">
          <header className={s.wharfHead}>
            <div>
              <p className={s.label}>{c.wharf.label}</p>
              <Voices id="wharf-h" lines={c.wharf.heading} s={s} voice="light" />
            </div>
            <div className={s.wharfIntro}>
              <p className={s.wharfLead}>{c.wharf.lead}</p>
              <p className={s.view}>{c.wharf.view}</p>
            </div>
          </header>

          <div className={s.day} data-settle="">
            <p className={s.dayStart}>{c.wharf.start}</p>
            {rows.map((r, i) => (
              <div key={r.name} className={s.dayRow} data-last={i === rows.length - 1 ? '' : undefined} style={{ '--i': i } as CSSProperties}>
                <div className={s.dayLine}>
                  <p className={s.dayBand}>
                    <b>{r.name}</b>
                    <span>{r.when}</span>
                  </p>
                  <span className={s.dayEnd} aria-hidden="true">
                    {r.end}
                  </span>
                </div>
                <p className={s.dayText}>{r.text}</p>
              </div>
            ))}
            <p className={s.music}>{c.wharf.music}</p>
          </div>

          <div className={s.shots}>
            <figure className={s.shotPour} data-wipe>
              <Pic pic={pic(data, 'pour')} sizes="(min-width: 1100px) 420px, 240px" />
            </figure>
            <figure className={s.shotBottles} data-wipe>
              <Pic pic={pic(data, 'bottles')} sizes="(min-width: 1100px) 206px, 120px" />
            </figure>
            <figure className={s.shotSign} data-wipe>
              <Pic pic={pic(data, 'sign')} sizes="(min-width: 1100px) 420px, 230px" />
            </figure>
            <div className={s.wharfNotes}>
              <p>{c.wharf.try}</p>
              <p className={s.noBook}>{c.wharf.noBook}</p>
            </div>
          </div>
        </section>

        <section className={s.contact} id="contact" aria-labelledby="contact-h">
          <div className={s.contactHead}>
            <Voices id="contact-h" lines={c.contact.heading} s={s} voice="light" />
          </div>
          <ul className={s.bands}>
            {data.rating && (
              <li className={`${s.band} ${s.rated}`} data-settle="">
                <div>
                  <span className={s.bandLabel}>{c.contact.rated.label}</span>
                  <p className={s.bandValue}>
                    {data.rating.value}{' '}
                    <span className={s.bandLight}>
                      {c.contact.rated.unit} {data.rating.count} {c.contact.rated.count}
                    </span>
                  </p>
                  <span className={s.bandNote}>{c.contact.rated.source}</span>
                </div>
              </li>
            )}
            <li className={s.band} data-settle="">
              <a href={c.call.tel} data-press>
                <span className={s.bandLabel}>{c.contact.call.label}</span>
                <b className={s.bandValue}>{c.call.display}</b>
                <span className={s.bandNote}>{c.contact.call.note}</span>
                <Arrow />
              </a>
            </li>
            <li className={s.band} data-settle="">
              <a href={`mailto:${c.email}`} data-press>
                <span className={s.bandLabel}>{c.contact.mail.label}</span>
                <b className={`${s.bandValue} ${s.bandLight}`}>{c.email}</b>
                <span className={s.bandNote}>{c.contact.mail.note}</span>
                <Arrow />
              </a>
            </li>
            <li className={s.band} data-settle="">
              <a {...shop} data-press>
                <span className={s.bandLabel}>{c.contact.shop.label}</span>
                <b className={s.bandValue}>{c.contact.shop.value}</b>
                <span className={s.bandNote}>{c.contact.shop.note}</span>
                <Arrow />
              </a>
            </li>
          </ul>
        </section>
      </main>

      <footer className={s.foot}>
        <div className={s.find}>
          <span className={s.bandLabel}>{c.contact.find.label}</span>
          <b className={`${s.bandValue} ${s.bandLight}`}>{c.contact.find.value}</b>
          <span className={s.bandNote}>{c.contact.find.note}</span>
        </div>
        <figure className={s.shelf}>
          <Pic pic={pic(data, 'shelf')} sizes="(min-width: 1100px) 760px, 100vw" style={{ backgroundColor: 'transparent' }} parallax />
        </figure>
        <div className={s.footBase}>
          <p className={s.footLine}>{c.foot.line}</p>
          <DemoFoot domain={data.domain} />
        </div>
      </footer>

      <SettleSeen />
      <StickyBar main={{ label: c.shop.label, href: c.shop.href, external: true }} call={{ label: c.call.label, tel: c.call.tel }} />
    </div>
  );
}

export const settle: Design = { Demo, fonts: ['syne-latin-wght-normal', 'work-sans-latin-wght-normal'], heroSizes: HERO_SIZES };
