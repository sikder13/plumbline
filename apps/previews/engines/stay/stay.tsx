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
import { Around } from './Around';
import { Builder } from './Builder';
import { Rooms } from './Rooms';

/**
 * The stay engine. Its device is the view: the opening photograph is a window that opens as the
 * page loads, the story is told through a pane that widens and changes its light from morning to
 * evening as the visitor scrolls, and each room is shown by the view from it. Warm paper, a
 * serif set large, plenty of air.
 */

function pick(cls: Cls, names: string[]): Cls {
  return Object.fromEntries(names.map((n) => [n, cls[n]!]));
}

function Hero({ c, data, cls }: { c: EngineDemo; data: PageData; cls: Cls }) {
  const w = ways(c);
  const kind = c.heroKind;
  return (
    <section className={cls.hero} data-kind={kind} id="top" data-hero>
      <header className={cls.heroTop}>
        <a className={cls.mark} href="#top">
          {c.wordmark ?? c.name}
        </a>
        <span className={cls.place}>
          {c.place.town}
          {c.place.region ? `, ${c.place.region}` : ''}
        </span>
      </header>
      {kind !== 'type' && data.images.hero && (
        <div className={cls.window} style={{ '--px': `${data.images.hero.width}px` } as CSSProperties}>
          <Photo data={data} id="hero" sizes={kind === 'photo' ? '100vw' : SPLIT_SIZES} first />
        </div>
      )}
      {kind === 'type' && <span className={cls.pane0} aria-hidden="true" />}
      <div className={cls.heroWords}>
        <Lines lines={c.hero.lines} cls={cls} className={cls.heroTitle} />
        {c.hero.sub && <p className={cls.heroSub}>{c.hero.sub.text}</p>}
      </div>
      {c.hero.facts.length > 0 && (
        <dl className={cls.stayLine} data-facts>
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
        {w.phone && w.main.kind !== 'phone' && (
          <a className={cls.quietLink} href={w.phone.href}>
            Call {w.phone.label}
          </a>
        )}
      </div>
    </section>
  );
}

function Story({ c, data, cls }: { c: EngineDemo; data: PageData; cls: Cls }) {
  if (!c.story) return null;
  const steps = c.story.steps;
  return (
    <section className={cls.story} id="stay" aria-labelledby="story-h">
      <Pinned steps={steps.length} className={cls.storyPin}>
        <h2 id="story-h" className={cls.storyTitle}>
          {c.story.heading}
        </h2>
        <div className={cls.pane} aria-hidden="true">
          {steps.map((st, i) =>
            st.photo && data.images[st.photo] ? (
              <div key={st.photo} className={cls.panePhoto} data-step={i} data-state={i === 0 ? 'on' : 'off'}>
                <Photo data={data} id={st.photo} sizes="(min-width: 1100px) 56vw, 100vw" />
              </div>
            ) : null,
          )}
          <span className={cls.light} />
        </div>
        <ol className={cls.moments}>
          {steps.map((st, i) => (
            <li key={st.title} data-step={i} data-state={i === 0 ? 'on' : 'off'}>
              {st.mark && <p className={cls.momentMark}>{st.mark}</p>}
              <h3 className={cls.momentTitle}>{st.title}</h3>
              <p className={cls.momentText}>{st.text}</p>
            </li>
          ))}
        </ol>
      </Pinned>
    </section>
  );
}

function Signature({ c, data, cls }: { c: EngineDemo; data: PageData; cls: Cls }) {
  const sig = c.signature;
  if (!sig) return null;
  const w = ways(c);
  const head = (id: string) => (
    <h2 id={id} className={cls.sectionTitle} data-reveal>
      {sig.heading}
    </h2>
  );
  if (sig.kind === 'around')
    return (
      <section className={cls.aroundSection} id="around" data-quiet aria-labelledby="around-h">
        {head('around-h')}
        <Around here={c.wordmark ?? c.name} places={sig.places} cls={pick(cls, ['around', 'rings', 'ringLine', 'ringLabel', 'hereDot', 'aroundList', 'hereName', 'placeGroups', 'groupHead', 'groupPlaces', 'placeName', 'placeNote', 'ringKey'])} />
      </section>
    );
  if (sig.kind === 'builder')
    return (
      <section className={cls.builderSection} id="around" data-quiet aria-labelledby="build-h">
        {head('build-h')}
        <Builder units={sig.units} maxNights={sig.maxNights} maxGuests={sig.maxGuests} book={w.booking ? { href: w.booking.href, label: w.booking.label } : null} email={c.contact.email?.address ?? null} phone={w.phone ? { href: w.phone.href, label: w.phone.label } : null} cls={pick(cls, ['builder', 'build', 'buildRow', 'buildChip', 'buildLabel', 'stepper', 'buildSelect', 'stayCard', 'stayLead', 'staySentence', 'stayPrice', 'stayWays', 'staySend', 'stayCall'])} />
      </section>
    );
  if (sig.kind === 'rooms')
    return (
      <section className={cls.roomsSection} id="around" data-quiet aria-labelledby="rooms-h">
        {head('rooms-h')}
        <Rooms
          units={sig.units.map((u) => ({ ...u, view: u.photo && data.images[u.photo] ? <Photo data={data} id={u.photo} sizes="(min-width: 1100px) 50vw, 100vw" /> : undefined }))}
          book={{ href: w.main.href, label: w.main.kind === 'phone' ? `Call ${w.phone!.label}` : w.main.label, external: w.main.external }}
          cls={pick(cls, ['rooms', 'roomTabs', 'roomTab', 'roomPanel', 'roomView', 'roomWords', 'roomName', 'roomMeta', 'roomText', 'roomBook'])}
        />
      </section>
    );
  return null;
}

function Close({ c, cls }: { c: EngineDemo; cls: Cls }) {
  const w = ways(c);
  return (
    <section className={cls.close} id="contact" aria-labelledby="close-h" data-quiet>
      <div className={cls.frame}>
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
        <dl className={cls.closeWays}>
          {w.phone && (
            <div>
              <dt>Phone</dt>
              <dd>
                <a href={w.phone.href}>{w.phone.label}</a>
              </dd>
            </div>
          )}
          {w.email && (
            <div>
              <dt>Email</dt>
              <dd>
                <a href={w.email.href}>{w.email.label}</a>
              </dd>
            </div>
          )}
          {c.contact.address && (
            <div>
              <dt>Address</dt>
              <dd>{c.contact.address.text}</dd>
            </div>
          )}
        </dl>
      </div>
    </section>
  );
}

function Demo({ data }: { data: PageData }) {
  const c = data.demo as EngineDemo;
  const { css, s } = engineStyles('stay', [c.pair.display, c.pair.text]);
  const w = ways(c);
  const nav = [c.story && { label: c.story.heading, href: '#stay' }, c.signature && { label: c.signature.heading, href: '#around' }, c.offers && { label: c.offers.heading, href: '#offers' }, { label: c.close.heading, href: '#contact' }].filter((x): x is { label: string; href: string } => !!x);
  return (
    <div className={s.root} style={{ ...rootVars(c), '--float-bg': c.palette.deep, '--float-ink': c.palette.onDeep } as CSSProperties} data-type={c.look.type} data-hero-kind={c.heroKind}>
      <style href={`stay-${c.look.type}`} precedence="design">
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
        <Signature c={c} data={data} cls={s} />
        <Offers c={c} data={data} cls={s} />
        <Band c={c} cls={s} />
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

export const stay = { Demo };
