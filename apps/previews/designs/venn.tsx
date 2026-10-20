import type { CSSProperties } from 'react';
import { Pic } from '@/components/Pic';
import { Shown } from '@/components/Shown';
import { Cover } from '@/components/os/Cover';
import { pic, type PageData } from '@/lib/data';
import { SENDER, SENDER_SITE, demoNote } from '@/lib/offer';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Branch {
  name: string;
  address: string;
  phone: { tel: string; display: string };
  book: string;
  hours: { day: string; time: string }[];
}

interface Content {
  town: string;
  phone: { tel: string; display: string };
  email: string;
  headline: string[];
  lede: string;
  mission: string;
  circles: { name: string; sub: string }[];
  centre: string;
  services: { name: string; text: string }[];
  prices: { label: string; range: string; length: string }[];
  pricesNote: string;
  easy: string;
  forms: string;
  branches: Branch[];
  newPatient: string;
}

/**
 * Bodycare Clinic, Forrest Hill and Northcote. "Complete care": their own diagram, three disciplines that
 * meet at optimum health, drawn live and drawn together as it scrolls in. Then the five services in their
 * words, the price ranges from their pricing page, and each branch with its own Cliniko booking page.
 * Health page: no testimonials.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('venn', ['Sora', 'Petrona']);
  const c = data.demo as Content;
  return (
    <div className={s.root}>
      <style href="venn" precedence="design">
        {css}
      </style>

      <header className={s.top}>
        <p className={s.brand}>
          Bodycare <span>Clinic</span>
        </p>
        <a className={s.topCall} href={c.phone.tel} data-press>
          Call {c.phone.display}
        </a>
      </header>

      <section className={s.hero} data-hero aria-labelledby="hero-h">
        <div className={s.heroWords}>
          <p className={s.place}>{c.town}</p>
          <h1 id="hero-h" className={s.head}>
            {c.headline.map((l, i) => (
              <span key={l} className={s.line} style={{ '--i': i } as CSSProperties}>
                <span>{l}</span>
              </span>
            ))}
          </h1>
          <p className={s.lede}>{c.lede}</p>
          <div className={s.acts} data-covers>
            <a className={s.primary} href="#book" data-press>
              Book an appointment
            </a>
            <a className={s.secondary} href={c.phone.tel} data-press>
              Call {c.phone.display}
            </a>
          </div>
        </div>
        <figure className={s.heroPhoto}>
          <Pic pic={pic(data, 'hero')} sizes="(min-width: 960px) 46vw, 100vw" first />
        </figure>
      </section>

      <main>
        <section className={s.together} aria-labelledby="together-h">
          <div className={s.togetherWords}>
            <h2 id="together-h" className={s.h2}>
              Working together
            </h2>
            <p className={s.mission} data-reveal>
              {c.mission}
            </p>
          </div>
          <div className={s.diagram} data-show>
            <ul className={s.circles}>
              {c.circles.map((x, i) => (
                <li key={x.name} className={s[`c${i}`]}>
                  <span className={s.cName}>{x.name}</span>
                  <span className={s.cSub}>{x.sub}</span>
                </li>
              ))}
            </ul>
            <p className={s.centre}>{c.centre}</p>
          </div>
        </section>

        <section className={s.services} aria-labelledby="services-h">
          <h2 id="services-h" className={s.h2}>
            Our services
          </h2>
          <ul className={s.serviceList}>
            {c.services.map((x) => (
              <li key={x.name} data-reveal>
                <h3>{x.name}</h3>
                <p>{x.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className={s.team} aria-labelledby="team-h">
          <figure className={s.teamPhoto} data-reveal>
            <Pic pic={pic(data, 'team')} sizes="(min-width: 960px) 50vw, 100vw" />
          </figure>
          <div className={s.teamWords}>
            <h2 id="team-h" className={s.h2}>
              Prices
            </h2>
            <dl className={s.prices}>
              {c.prices.map((p) => (
                <div key={p.label}>
                  <dt>{p.label}</dt>
                  <dd className={s.range}>{p.range}</dd>
                  <dd className={s.length}>{p.length}</dd>
                </div>
              ))}
            </dl>
            <p className={s.note}>{c.pricesNote}</p>
          </div>
        </section>

        <section className={s.book} id="book" data-covers aria-labelledby="book-h">
          <h2 id="book-h" className={s.h2}>
            Book online
          </h2>
          <p className={s.easy}>{c.easy}</p>
          <div className={s.branches}>
            {c.branches.map((b) => (
              <article key={b.name} className={s.branch}>
                <h3 className={s.branchName}>{b.name}</h3>
                <p className={s.branchAddr}>{b.address}</p>
                <div className={s.branchActs}>
                  <a className={s.primary} href={b.book} data-press>
                    Book at {b.name}
                  </a>
                  <a className={s.branchCall} href={b.phone.tel} data-press>
                    Call {b.phone.display}
                  </a>
                </div>
                <dl className={s.hours}>
                  {b.hours.map((h) => (
                    <div key={h.day}>
                      <dt>{h.day}</dt>
                      <dd>{h.time}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
          <p className={s.newPatient}>{c.newPatient}</p>
          <p className={s.forms}>{c.forms}</p>
        </section>
      </main>

      <footer className={s.foot} data-covers>
        <p className={s.footName}>Bodycare Clinic</p>
        <p className={s.footLinks}>
          {c.branches.map((b) => (
            <a key={b.name} href={b.phone.tel}>
              {b.name} {b.phone.display}
            </a>
          ))}
          <a href={`mailto:${c.email}`}>{c.email}</a>
        </p>
        <p className={s.small}>
          {demoNote(data.domain)} Demo by{' '}
          <a href={SENDER_SITE} target="_blank" rel="noopener">
            {SENDER}
          </a>
          .
        </p>
      </footer>

      <nav className={s.bar} aria-label="Book or call">
        <a href="#book" className={s.barBook} data-press>
          Book online
        </a>
        <a href={c.phone.tel} className={s.barCall} data-press>
          Call
        </a>
      </nav>
      <Cover />
      <Shown />
    </div>
  );
}

export const venn: Design = { Demo, fonts: ['sora-latin-wght-normal', 'petrona-latin-wght-normal'], heroSizes: '(min-width: 960px) 46vw, 100vw' };
