import type { CSSProperties } from 'react';
import type { EngineDemo } from '@plumbline/preview/engine';
import { Pic } from '@/components/Pic';
import { Pinned } from '@/components/Pinned';
import { SectionLinks } from '@/components/SectionLinks';
import { StickyBar } from '@/components/StickyBar';
import { QuietBar } from '../QuietBar';
import type { PageData } from '@/lib/data';
import { engineStyles } from '@/lib/styles';
import { SPLIT_SIZES } from '../sizes';
import { Go, Lines, Photo, rootVars, ways, type Cls } from '../kit';
import { Foot, Gallery, Intro, Offers, People, Practical } from '../sections';
import { Acc } from './Acc';
import { FirstVisit } from './FirstVisit';
import { Treats } from './Treats';

/**
 * The physio engine. Its device is the path back to moving: a clean sheet rising over their own
 * photo, then the clinic's own account of how it works, step by step.
 * Clear grounds, a round sans for headings and a serif for reading. No testimonials, reviews or
 * ratings are ever shown.
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
        <span className={cls.place}>{c.place.town}</span>
      </header>
      {/* A page with no photo wide enough for the hero shows their best one framed, at its own landscape shape on every screen. */}
      {kind === 'type' && c.hero.inset && data.images[c.hero.inset] && (
        <figure className={cls.heroInset}>
          <Pic pic={data.images[c.hero.inset]!} sizes="(min-width: 1100px) 40vw, calc(100vw - 40px)" first />
        </figure>
      )}
      <div className={cls.sheet}>
        <Lines lines={c.hero.lines} cls={cls} className={cls.heroTitle} />
        {c.hero.sub && <p className={cls.heroSub}>{c.hero.sub.text}</p>}
        {c.hero.facts.length > 0 && (
          <ul className={cls.heroFacts} data-facts>
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
              Call {w.phone.label}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function Story({ c, cls }: { c: EngineDemo; cls: Cls }) {
  if (!c.story) return null;
  const steps = c.story.steps;
  return (
    <section className={cls.story} id="how" aria-labelledby="story-h">
      <Pinned steps={steps.length} className={cls.storyPin}>
        <h2 id="story-h" className={cls.storyTitle}>
          {c.story.heading}
        </h2>
        <div className={cls.range} aria-hidden="true">
          <ol className={cls.rangeLegend} style={{ '--n': steps.length } as CSSProperties}>
            {steps.map((st, i) => (
              <li key={st.title} data-step={i} data-state={i === 0 ? 'on' : 'off'}>
                {st.title}
              </li>
            ))}
          </ol>
        </div>
        <ol className={cls.phases}>
          {steps.map((st, i) => (
            <li key={st.title} data-step={i} data-state={i === 0 ? 'on' : 'off'}>
              {st.mark && <p className={cls.phaseMark}>{st.mark}</p>}
              <h3 className={cls.phaseTitle}>{st.title}</h3>
              <p className={cls.phaseText}>{st.text}</p>
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
  const head = (id: string) => (
    <h2 id={id} className={cls.sectionTitle} data-reveal>
      {sig.heading}
    </h2>
  );
  if (sig.kind === 'treats')
    return (
      <section className={cls.treatSection} id="treat" data-quiet aria-labelledby="treat-h">
        {head('treat-h')}
        <Treats areas={sig.areas} cls={pick(cls, ['treats', 'treatList', 'treatCard', 'treatArea', 'treatNames', 'treatName'])} />
      </section>
    );
  if (sig.kind === 'acc')
    return (
      <section className={cls.accSection} id="treat" data-quiet aria-labelledby="acc-h">
        {head('acc-h')}
        <Acc points={sig.points} cls={pick(cls, ['acc', 'accItem', 'accQ', 'accA'])} />
      </section>
    );
  if (sig.kind === 'firstVisit')
    return (
      <section className={cls.visitSection} id="treat" data-quiet aria-labelledby="visit-h">
        {head('visit-h')}
        <FirstVisit steps={sig.steps} cls={pick(cls, ['visit', 'visitBar', 'visitSteps', 'visitStep', 'visitPanel', 'visitTitle', 'visitText', 'visitNav'])} />
      </section>
    );
  return null;
}

function Close({ c, cls }: { c: EngineDemo; cls: Cls }) {
  const w = ways(c);
  return (
    <section className={cls.close} id="contact" aria-labelledby="close-h" data-quiet>
      <div className={cls.closeCard}>
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
              <dt>Clinic</dt>
              <dd>{c.contact.address.text}</dd>
            </div>
          )}
          {c.contact.hours && (
            <div>
              <dt>Hours</dt>
              <dd>
                {c.contact.hours.rows.map((h) => (
                  <span key={h.label} className={cls.hoursRow}>
                    {h.label} <b>{h.value}</b>
                  </span>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </section>
  );
}

function Demo({ data }: { data: PageData }) {
  const c = data.demo as EngineDemo;
  const { css, s } = engineStyles('physio', [c.pair.display, c.pair.text]);
  const w = ways(c);
  const nav = [c.story && { label: c.story.heading, href: '#how' }, c.signature && { label: c.signature.heading, href: '#treat' }, c.offers && { label: c.offers.heading, href: '#offers' }, { label: c.close.heading, href: '#contact' }].filter((x): x is { label: string; href: string } => !!x);
  return (
    <div className={s.root} style={rootVars(c)} data-type={c.look.type} data-hero-kind={c.heroKind}>
      <style href={`physio-${c.look.type}`} precedence="design">
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
        <Story c={c} cls={s} />
        <Signature c={c} cls={s} />
        <Offers c={c} data={data} cls={s} />
        <People c={c} data={data} cls={s} />
        <Gallery c={c} data={data} cls={s} />
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

export const physio = { Demo };
