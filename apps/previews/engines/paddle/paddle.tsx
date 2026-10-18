import type { CSSProperties } from 'react';
import type { EngineDemo } from '@plumbline/preview/engine';
import { Pinned } from '@/components/Pinned';
import { SectionLinks } from '@/components/SectionLinks';
import { StickyBar } from '@/components/StickyBar';
import { QuietBar } from '../QuietBar';
import type { PageData } from '@/lib/data';
import { engineStyles } from '@/lib/styles';
import { SPLIT_SIZES } from '../sizes';
import { Go, Lines, Photo, rootVars, ways, type Cls } from '../kit';
import { Band, Foot, Gallery, Intro, Offers, People, Practical } from '../sections';
import { Chooser } from './Chooser';
import { Conditions } from './Conditions';
import { RouteLine } from './RouteLine';

/**
 * The paddle engine. Its device is the river itself: their own water behind the headline, the
 * trip told reach by reach while the visitor scrolls, and the booking at the close. Light grounds,
 * soft corners, a serif or a round face set large.
 */

function pick(cls: Cls, names: string[]): Cls {
  return Object.fromEntries(names.map((n) => [n, cls[n]!]));
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
        {c.hero.sub && <p className={cls.heroSub}>{c.hero.sub.text}</p>}
      </div>
      <div className={cls.heroFoot}>
        {c.hero.facts.length > 0 && (
          <ul className={cls.heroFacts} style={{ '--n': c.hero.facts.length } as CSSProperties} data-facts={c.hero.facts.length}>
            {c.hero.facts.map((f) => (
              <li key={f.label}>
                <span>{f.label}</span>
                <b>{f.value}</b>
              </li>
            ))}
          </ul>
        )}
        <div className={cls.heroActions}>
          <Go action={w.main} cls={cls} />
          {w.phone && w.main.kind !== 'phone' && (
            <a className={cls.quietLink} href={w.phone.href}>
              {w.phone.label}
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
  const photos = steps.filter((st) => st.photo && data.images[st.photo]);
  return (
    <section className={cls.story} id="trip" aria-labelledby="story-h">
      <Pinned steps={steps.length} className={cls.storyPin}>
        <h2 id="story-h" className={cls.storyTitle}>
          {c.story.heading}
        </h2>
        {photos.length > 0 && (
          <div className={cls.pool} aria-hidden="true">
            {steps.map((st, i) =>
              st.photo && data.images[st.photo] ? (
                <div key={st.photo} className={cls.poolPhoto} data-step={i} data-state={i === 0 ? 'on' : 'off'}>
                  <Photo data={data} id={st.photo} sizes="(min-width: 1100px) 44vw, 100vw" />
                </div>
              ) : null,
            )}
          </div>
        )}
        <ol className={cls.reaches}>
          {steps.map((st, i) => (
            <li key={st.title} data-step={i} data-state={i === 0 ? 'on' : 'off'}>
              {st.mark && <p className={cls.reachMark}>{st.mark}</p>}
              <h3 className={cls.reachTitle}>{st.title}</h3>
              <p className={cls.reachText}>{st.text}</p>
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
  const head = (id: string) => (
    <h2 id={id} className={cls.sectionTitle} data-reveal>
      {sig.heading}
    </h2>
  );
  if (sig.kind === 'chooser')
    return (
      <section className={cls.pick} id="choose" data-quiet aria-labelledby="pick-h">
        {head('pick-h')}
        <Chooser trips={sig.trips} book={w.booking ? { href: w.booking.href, label: w.booking.label } : null} email={c.contact.email?.address ?? null} phone={w.phone ? { href: w.phone.href, label: w.phone.label } : null} cls={pick(cls, ['chooser', 'choices', 'choice', 'note', 'noteLead', 'noteTrip', 'noteFacts', 'noteText', 'noteWays', 'noteSend', 'noteCall'])} />
      </section>
    );
  if (sig.kind === 'conditions')
    return (
      <section className={cls.cond} id="choose" data-quiet aria-labelledby="cond-h">
        {head('cond-h')}
        <Conditions items={sig.items} cls={pick(cls, ['conditions', 'gauge', 'gaugeMark', 'condPanel', 'condLabel', 'condText'])} />
      </section>
    );
  if (sig.kind === 'route')
    return (
      <section className={cls.routeSection} id="choose" data-quiet aria-labelledby="route-h">
        {head('route-h')}
        <RouteLine trip={sig.trip} stops={sig.stops} cls={pick(cls, ['route', 'routeStops', 'routeNote', 'routeKey'])} />
      </section>
    );
  return null;
}

function Close({ c, cls }: { c: EngineDemo; cls: Cls }) {
  const w = ways(c);
  return (
    <section className={cls.close} id="contact" aria-labelledby="close-h" data-quiet>
      <h2 id="close-h" className={cls.closeTitle} data-reveal>
        {c.close.heading}
      </h2>
      {c.close.line && (
        <p className={cls.closeLine} data-reveal>
          {c.close.line.text}
        </p>
      )}
      <div className={cls.closeGo}>
        <Go action={w.main} cls={cls} />
      </div>
      <ul className={cls.closeWays}>
        {w.phone && (
          <li>
            <span>Call</span>
            <a href={w.phone.href}>{w.phone.label}</a>
          </li>
        )}
        {w.email && (
          <li>
            <span>Email</span>
            <a href={w.email.href}>{w.email.label}</a>
          </li>
        )}
        {c.contact.address && (
          <li>
            <span>Find us</span>
            <p>{c.contact.address.text}</p>
          </li>
        )}
      </ul>
    </section>
  );
}

function Demo({ data }: { data: PageData }) {
  const c = data.demo as EngineDemo;
  const { css, s } = engineStyles('paddle', [c.pair.display, c.pair.text]);
  const w = ways(c);
  const nav = [c.story && { label: c.story.heading, href: '#trip' }, c.signature && { label: c.signature.heading, href: '#choose' }, c.offers && { label: c.offers.heading, href: '#offers' }, { label: c.close.heading, href: '#contact' }].filter((x): x is { label: string; href: string } => !!x);
  return (
    <div className={s.root} style={rootVars(c)} data-type={c.look.type} data-hero-kind={c.heroKind}>
      <style href={`paddle-${c.look.type}`} precedence="design">
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
        <Story c={c} data={data} cls={s} />
        <Signature c={c} cls={s} />
        <Band c={c} cls={s} />
        <Offers c={c} data={data} cls={s} />
        <Gallery c={c} data={data} cls={s} />
        <People c={c} data={data} cls={s} />
        <Practical c={c} cls={s} />
        <Close c={c} cls={s} />
      </main>
      <Foot c={c} cls={s}>
        <p className={s.footMark} aria-hidden="true">
          {c.wordmark ?? c.name}
        </p>
      </Foot>
      <QuietBar />
      <StickyBar main={{ label: w.main.kind === 'phone' ? 'Call to book' : w.main.label, href: w.main.href, external: w.main.external }} call={{ label: w.phone ? `Call ${w.phone.label}` : 'Email', tel: w.phone?.href ?? w.email?.href ?? w.main.href }} />
    </div>
  );
}

export const paddle = { Demo };
