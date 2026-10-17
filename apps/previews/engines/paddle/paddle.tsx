import type { EngineDemo } from '@plumbline/preview/engine';
import { SectionLinks } from '@/components/SectionLinks';
import { StickyBar } from '@/components/StickyBar';
import type { PageData } from '@/lib/data';
import { engineStyles } from '@/lib/styles';
import { Go, rootVars, ways, type Cls } from '../kit';
import { Band, Foot, Gallery, Hero, Intro, Offers, People, Practical, Story } from '../sections';
import { Chooser } from './Chooser';
import { Conditions } from './Conditions';
import { RouteLine } from './RouteLine';

/**
 * The paddle engine. Their own photo first, a serif headline on the warm ground, and the facts as
 * chips; their trip told in steps; a chooser, their own rules or their stated route; soft rounded
 * corners and a light, watery second ground.
 */

function pick(cls: Cls, names: string[]): Cls {
  return Object.fromEntries(names.map((n) => [n, cls[n]!]));
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
      <section className={cls.pick} id="choose" aria-labelledby="pick-h">
        {head('pick-h')}
        <Chooser trips={sig.trips} book={w.booking ? { href: w.booking.href, label: w.booking.label } : null} email={c.contact.email?.address ?? null} phone={w.phone ? { href: w.phone.href, label: w.phone.label } : null} cls={pick(cls, ['chooser', 'choices', 'choice', 'note', 'noteLead', 'noteTrip', 'noteFacts', 'noteText', 'noteWays', 'noteSend', 'noteCall'])} />
      </section>
    );
  if (sig.kind === 'conditions')
    return (
      <section className={cls.cond} id="choose" aria-labelledby="cond-h">
        {head('cond-h')}
        <Conditions items={sig.items} cls={pick(cls, ['conditions', 'gauge', 'gaugeMark', 'condPanel', 'condLabel', 'condText'])} />
      </section>
    );
  if (sig.kind === 'route')
    return (
      <section className={cls.routeSection} id="choose" aria-labelledby="route-h">
        {head('route-h')}
        <RouteLine trip={sig.trip} stops={sig.stops} cls={pick(cls, ['route', 'routeStops', 'routeNote', 'routeKey'])} />
      </section>
    );
  return null;
}

function Close({ c, cls }: { c: EngineDemo; cls: Cls }) {
  const w = ways(c);
  return (
    <section className={cls.close} id="contact" aria-labelledby="close-h">
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
        <Story c={c} data={data} cls={s} id="trip" />
        <Signature c={c} cls={s} />
        <Band c={c} cls={s} />
        <Offers c={c} data={data} cls={s} />
        <Gallery c={c} data={data} cls={s} />
        <People c={c} data={data} cls={s} />
        <Practical c={c} cls={s} />
        <Close c={c} cls={s} />
      </main>
      <Foot c={c} cls={s} />
      <StickyBar main={{ label: w.main.kind === 'phone' ? 'Call to book' : w.main.label, href: w.main.href, external: w.main.external }} call={{ label: w.phone ? `Call ${w.phone.label}` : 'Email', tel: w.phone?.href ?? w.email?.href ?? w.main.href }} />
    </div>
  );
}

export const paddle = { Demo };
