import type { EngineDemo } from '@plumbline/preview/engine';
import { SectionLinks } from '@/components/SectionLinks';
import { StickyBar } from '@/components/StickyBar';
import type { PageData } from '@/lib/data';
import { engineStyles } from '@/lib/styles';
import { Go, rootVars, ways, type Cls } from '../kit';
import { Foot, Gallery, Hero, Intro, Offers, People, Practical, Story } from '../sections';
import { Acc } from './Acc';
import { FirstVisit } from './FirstVisit';
import { Treats } from './Treats';


/**
 * The physio engine. Their own photo first, a serif headline on the warm ground, the facts as chips;
 * how they work told in steps; what they treat, ACC or a first visit, only as they state them. No
 * testimonials, reviews or ratings are ever shown.
 */
function pick(cls: Cls, names: string[]): Cls {
  return Object.fromEntries(names.map((n) => [n, cls[n]!]));
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
      <section className={cls.treatSection} id="treat" aria-labelledby="treat-h">
        {head('treat-h')}
        <Treats areas={sig.areas} cls={pick(cls, ['treats', 'treatList', 'treatCard', 'treatArea', 'treatNames', 'treatName'])} />
      </section>
    );
  if (sig.kind === 'acc')
    return (
      <section className={cls.accSection} id="treat" aria-labelledby="acc-h">
        {head('acc-h')}
        <Acc points={sig.points} cls={pick(cls, ['acc', 'accItem', 'accQ', 'accA'])} />
      </section>
    );
  if (sig.kind === 'firstVisit')
    return (
      <section className={cls.visitSection} id="treat" aria-labelledby="visit-h">
        {head('visit-h')}
        <FirstVisit steps={sig.steps} cls={pick(cls, ['visit', 'visitBar', 'visitSteps', 'visitStep', 'visitPanel', 'visitTitle', 'visitText', 'visitNav'])} />
      </section>
    );
  return null;
}

function Close({ c, cls }: { c: EngineDemo; cls: Cls }) {
  const w = ways(c);
  return (
    <section className={cls.close} id="contact" aria-labelledby="close-h">
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
        <Story c={c} data={data} cls={s} id="how" />
        <Signature c={c} cls={s} />
        <Offers c={c} data={data} cls={s} />
        <People c={c} data={data} cls={s} />
        <Gallery c={c} data={data} cls={s} />
        <Practical c={c} cls={s} />
        <Close c={c} cls={s} />
      </main>
      <Foot c={c} cls={s} />
      <StickyBar main={{ label: w.main.kind === 'phone' ? 'Call to book' : w.main.label, href: w.main.href, external: w.main.external }} call={{ label: w.phone ? `Call ${w.phone.label}` : 'Email', tel: w.phone?.href ?? w.email?.href ?? w.main.href }} />
    </div>
  );
}

export const physio = { Demo };
