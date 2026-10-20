import type { CSSProperties } from 'react';
import { Pic } from '@/components/Pic';
import { Shown } from '@/components/Shown';
import { Cover } from '@/components/os/Cover';
import { pic, type PageData } from '@/lib/data';
import { SENDER, SENDER_SITE, demoNote } from '@/lib/offer';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Content {
  town: string;
  phone: { tel: string; display: string };
  intl: { tel: string; display: string };
  email: string;
  book: string;
  trips: string;
  headline: string[];
  lede: string;
  invite: string;
  kinds: string[];
  guaranteed: string;
  departures: { date: string; name: string; days: string; kind: string; from: string }[];
  quote: { text: string; by: string };
}

/**
 * Adventure South NZ. "Move Explore Connect" stacked over their own Southern Alps, riders small in the
 * tussock. The signature is their own departures ledger: the next guaranteed trips, date, name, days
 * and price as their page lists them, ticking in one after another, each line one tap from booking.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('trail', ['Geologica', 'JetBrains Mono']);
  const c = data.demo as Content;
  return (
    <div className={s.root}>
      <style href="trail" precedence="design">
        {css}
      </style>

      <section className={s.hero} data-hero aria-labelledby="hero-h">
        <figure className={s.heroPhoto}>
          <Pic pic={pic(data, 'hero')} sizes="100vw" first />
        </figure>
        <header className={s.top}>
          <p className={s.brand}>Adventure South NZ</p>
          <a className={s.topCall} href={c.phone.tel} data-press>
            {c.phone.display}
          </a>
        </header>
        <div className={s.heroWords}>
          <h1 id="hero-h" className={s.head}>
            {c.headline.map((l, i) => (
              <span key={l} className={s.line} style={{ '--i': i } as CSSProperties}>
                <span>{l}</span>
              </span>
            ))}
          </h1>
          <p className={s.lede}>{c.lede}</p>
          <div className={s.acts} data-covers>
            <a className={s.primary} href={c.book} data-press>
              Book a guaranteed trip
            </a>
            <a className={s.secondary} href="#departures" data-press>
              Next departures
            </a>
          </div>
        </div>
      </section>

      <main>
        <section className={s.invite} aria-label="Small group, guided adventures">
          <p className={s.inviteText} data-reveal>
            {c.invite}
          </p>
          <ul className={s.kinds}>
            {c.kinds.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        </section>

        <section className={s.board} id="departures" aria-labelledby="board-h">
          <div className={s.boardHead}>
            <h2 id="board-h" className={s.h2}>
              Next guaranteed departures
            </h2>
            <p className={s.body}>{c.guaranteed}</p>
          </div>
          <ol className={s.ledger} data-show>
            {c.departures.map((d, i) => (
              <li key={`${d.date}${d.name}`} className={s.dep} style={{ '--i': i } as CSSProperties}>
                <span className={s.depDate}>{d.date}</span>
                <span className={s.depName}>{d.name}</span>
                <span className={s.depMeta}>
                  {d.days} · {d.kind}
                </span>
                <span className={s.depFrom}>
                  from <strong>{d.from}</strong> NZD
                </span>
                <a className={s.depBook} href={c.book} aria-label={`Book ${d.name}, ${d.date}`} data-press>
                  Book
                </a>
              </li>
            ))}
          </ol>
        </section>

        <section className={s.gallery} aria-label="Where the trips go">
          {(['hike', 'group', 'cook', 'milford'] as const).map((k) => (
            <figure key={k} className={s[`g_${k}`]} data-reveal>
              <Pic pic={pic(data, k)} sizes="(min-width: 900px) 50vw, 100vw" />
            </figure>
          ))}
        </section>

        <section className={s.voice} aria-label="From a guest">
          <figure data-reveal>
            <blockquote>
              <p>{c.quote.text}</p>
            </blockquote>
            <figcaption>{c.quote.by}</figcaption>
          </figure>
        </section>

        <section className={s.book} id="book" data-covers aria-labelledby="book-h">
          <h2 id="book-h" className={s.h2}>
            Talk to us about a trip
          </h2>
          <div className={s.ways}>
            <a className={s.primary} href={c.book} data-press>
              See guaranteed trips
            </a>
            <a className={s.way} href={c.phone.tel} data-press>
              Call free in NZ, {c.phone.display}
            </a>
            <a className={s.way} href={c.intl.tel} data-press>
              From overseas, {c.intl.display}
            </a>
            <a className={s.way} href={`mailto:${c.email}`} data-press>
              {c.email}
            </a>
          </div>
        </section>
      </main>

      <footer className={s.foot} data-covers>
        <p className={s.footName}>Adventure South NZ</p>
        <p className={s.footLinks}>
          <a href={c.phone.tel}>{c.phone.display}</a>
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
        <a href={c.book} className={s.barBook} data-press>
          Guaranteed trips
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

export const trail: Design = { Demo, fonts: ['geologica-latin-wght-normal', 'jetbrains-mono-latin-wght-normal'], heroSizes: '100vw' };
