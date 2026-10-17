import type { CSSProperties } from 'react';
import type { EngineDemo } from '@plumbline/preview/engine';
import { Pinned } from '@/components/Pinned';
import { SectionLinks } from '@/components/SectionLinks';
import { StickyBar } from '@/components/StickyBar';
import { QuietBar } from '../QuietBar';
import type { PageData } from '@/lib/data';
import { engineStyles } from '@/lib/styles';
import { SPLIT_SIZES } from '../sizes';
import { Go, Lines, Photo, mailto, rootVars, ways, type Cls } from '../kit';
import { Band, Foot, Gallery, Intro, Offers, People, Practical } from '../sections';
import { DayLine } from './DayLine';
import { Seasons } from './Seasons';
import { TripBoard } from './TripBoard';

/**
 * The fishing engine. Its device is the horizon: a line where sea meets sky that the headline
 * stands on, that the day's legs run out along, and that the page closes on. The type is set large and upright, the grounds are the sea's.
 */

function Horizon({ cls }: { cls: Cls }) {
  return (
    <div className={cls.horizon} aria-hidden="true">
      <span className={cls.horizonLine} />
      <span className={cls.glint} />
    </div>
  );
}

function Hero({ c, data, cls }: { c: EngineDemo; data: PageData; cls: Cls }) {
  const w = ways(c);
  const kind = c.heroKind;
  return (
    <section className={cls.hero} data-kind={kind} id="top" data-hero>
      {kind !== 'type' && data.images.hero && (
        <div className={cls.heroMedia} style={{ '--px': `${data.images.hero.width}px` } as CSSProperties}>
          <Photo data={data} id="hero" sizes={kind === 'photo' ? '100vw' : SPLIT_SIZES} first />
        </div>
      )}
      <header className={cls.heroTop}>
        <a className={cls.mark} href="#top">
          {c.wordmark ?? c.name}
        </a>
        <span className={cls.place}>
          {c.place.town}
          {c.place.region ? `, ${c.place.region}` : ''}
        </span>
      </header>
      <div className={cls.heroWords}>
        <Lines lines={c.hero.lines} cls={cls} className={cls.heroTitle} />
        <Horizon cls={cls} />
      </div>
      <div className={cls.heroFoot}>
        {c.hero.sub && <p className={cls.heroSub}>{c.hero.sub.text}</p>}
        {c.hero.facts.length > 0 && (
          <dl className={cls.heroFacts} data-facts>
            {c.hero.facts.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className={cls.heroActions}>
          <Go action={w.main} cls={cls} />
          {w.email && w.main.kind !== 'email' && (
            <a className={cls.quietLink} href={w.email.href}>
              {w.email.label}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function Story({ c, data, cls }: { c: EngineDemo; data: PageData; cls: Cls }) {
  if (!c.story) return null;
  const steps = c.story.steps;
  return (
    <section className={cls.story} id="trip" aria-labelledby="story-h">
      <Pinned steps={steps.length} className={cls.storyPin}>
        <h2 id="story-h" className={cls.storyTitle}>
          {c.story.heading}
        </h2>
        <div className={cls.sky} aria-hidden="true">
          {steps.map((st, i) =>
            st.photo && data.images[st.photo] ? (
              <div key={st.photo} className={cls.skyPhoto} data-step={i} data-state={i === 0 ? 'on' : 'off'}>
                <Photo data={data} id={st.photo} sizes="(min-width: 1100px) 50vw, 100vw" />
              </div>
            ) : null,
          )}
        </div>
        <div className={cls.voyage} aria-hidden="true">
          <span className={cls.voyageLine} />
          <span className={cls.voyageDone} />
          <ol className={cls.ticks}>
            {steps.map((st, i) => (
              <li key={st.title} data-step={i} data-state={i === 0 ? 'on' : 'off'} />
            ))}
          </ol>
        </div>
        <ol className={cls.legs}>
          {steps.map((st, i) => (
            <li key={st.title} data-step={i} data-state={i === 0 ? 'on' : 'off'}>
              {st.mark && <p className={cls.legMark}>{st.mark}</p>}
              <h3 className={cls.legTitle}>{st.title}</h3>
              <p className={cls.legText}>{st.text}</p>
            </li>
          ))}
        </ol>
      </Pinned>
    </section>
  );
}

function Signature({ c, cls }: { c: EngineDemo; cls: Cls }) {
  const sig = c.signature;
  if (!sig) return null;
  const w = ways(c);
  if (sig.kind === 'tripboard') {
    const trips = sig.trips.map((t) => {
      const href = w.booking ? w.booking.href : w.phone ? w.phone.href : mailto(c.contact.email!.address, `${t.name}: enquiry`);
      const ask = w.booking ? w.booking.label : w.phone ? `Call ${w.phone.label}` : 'Email about this trip';
      return { ...t, href, ask, external: !!w.booking };
    });
    return (
      <section className={cls.board} id="board" data-quiet aria-labelledby="board-h">
        <header className={cls.boardHead}>
          <h2 id="board-h" className={cls.sectionTitle} data-reveal>
            {sig.heading}
          </h2>
          {sig.note && (
            <p className={cls.boardNote} data-reveal>
              {sig.note.text}
            </p>
          )}
        </header>
        <TripBoard trips={trips} barOf={sig.barOf ?? null} cls={pick(cls, ['trips', 'trip', 'tripHead', 'tripName', 'tripTarget', 'tripPrice', 'tripBar', 'tripMore', 'tripFacts', 'tripAsk', 'barKey'])} />
      </section>
    );
  }
  if (sig.kind === 'seasons') {
    return (
      <section className={cls.seasons} id="board" data-quiet aria-labelledby="seasons-h">
        <h2 id="seasons-h" className={cls.sectionTitle} data-reveal>
          {sig.heading}
        </h2>
        <Seasons species={sig.species} cls={pick(cls, ['grid', 'months', 'month', 'row', 'cell', 'speciesName', 'cards', 'card', 'cardWhere'])} />
      </section>
    );
  }
  if (sig.kind === 'day') {
    return (
      <section className={cls.day} id="board" data-quiet aria-labelledby="day-h">
        <h2 id="day-h" className={cls.sectionTitle} data-reveal>
          {sig.heading}
        </h2>
        <DayLine steps={sig.steps} cls={pick(cls, ['dayLine', 'dayStep', 'dayTime', 'dayText', 'dayFill'])} />
      </section>
    );
  }
  return null;
}

/** The names a client part needs, from the page's scoped class names. */
function pick(cls: Cls, names: string[]): Cls {
  return Object.fromEntries(names.map((n) => [n, cls[n]!]));
}

function Close({ c, cls }: { c: EngineDemo; cls: Cls }) {
  const w = ways(c);
  return (
    <section className={cls.close} id="contact" aria-labelledby="close-h" data-quiet>
      <Horizon cls={cls} />
      <h2 id="close-h" className={cls.closeTitle} data-reveal>
        {c.close.heading}
      </h2>
      {c.close.line && (
        <p className={cls.closeLine} data-reveal>
          {c.close.line.text}
        </p>
      )}
      <div className={cls.closeWays}>
        {w.phone && (
          <a className={cls.closePhone} href={w.phone.href} data-reveal>
            {w.phone.label}
          </a>
        )}
        {w.email && (
          <a className={cls.closeMail} href={w.email.href} data-reveal>
            {w.email.label}
          </a>
        )}
        {c.contact.address && (
          <p className={cls.closeWhere} data-reveal>
            {c.contact.address.text}
          </p>
        )}
      </div>
      {w.main.kind === 'booking' && <Go action={w.main} cls={cls} />}
    </section>
  );
}

function Demo({ data }: { data: PageData }) {
  const c = data.demo as EngineDemo;
  const { css, s } = engineStyles('fishing', [c.pair.display, c.pair.text]);
  const w = ways(c);
  const nav = [
    c.story && { label: c.story.heading, href: '#trip' },
    c.signature && { label: c.signature.heading, href: '#board' },
    c.offers && { label: c.offers.heading, href: '#offers' },
    { label: c.close.heading, href: '#contact' },
  ].filter((x): x is { label: string; href: string } => !!x);
  return (
    <div className={s.root} style={rootVars(c)} data-type={c.look.type} data-hero-kind={c.heroKind}>
      <style href={`fishing-${c.look.type}`} precedence="design">
        {css}
      </style>
      <nav className={s.nav} aria-label="Sections">
        <a className={s.navMark} href="#top">
          {c.wordmark ?? c.name}
        </a>
        <SectionLinks className={s.navLinks} items={nav} />
        <a className={s.navGo} href={w.main.href} rel={w.main.external ? 'noopener' : undefined} data-press>
          {w.main.kind === 'phone' ? 'Call' : w.main.label}
        </a>
      </nav>
      <Hero c={c} data={data} cls={s} />
      <main>
        <Intro c={c} cls={s} />
        <Band c={c} cls={s} />
        <Story c={c} data={data} cls={s} />
        <Signature c={c} cls={s} />
        <Offers c={c} data={data} cls={s} />
        <Gallery c={c} data={data} cls={s} />
        <People c={c} data={data} cls={s} />
        <Practical c={c} cls={s} />
        <Close c={c} cls={s} />
      </main>
      <Foot c={c} cls={s}>
        <p className={s.footMark} style={{ '--len': (c.wordmark ?? c.name).length } as CSSProperties} aria-hidden="true">
          {c.wordmark ?? c.name}
        </p>
      </Foot>
      <QuietBar />
      <StickyBar main={{ label: w.main.kind === 'phone' ? 'Call to book' : w.main.label, href: w.main.href, external: w.main.external }} call={{ label: w.phone ? `Call ${w.phone.label}` : 'Email', tel: w.phone?.href ?? w.email?.href ?? w.main.href }} />
    </div>
  );
}

export const fishing = { Demo };

