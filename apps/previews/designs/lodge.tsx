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
  email: string;
  book: string;
  address: string[];
  headline: string[];
  lede: string;
  stamp: { figure: string; words: string };
  back: string;
  units: { n: string; name: string; who: string; text: string }[];
  facilities: string[];
  near: string[];
  city: string;
  stays: string;
}

/**
 * Takapuna Motor Lodge, Auckland's North Shore. "Your home away from home", their own phrase, written on a
 * postcard from their sunny deck, stamped with the 21 apartments they count. Then the four ways to stay,
 * set as big numerals in their words, and what is close by. Every Book goes to their own Cloudbeds page.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('lodge', ['Young Serif', 'Instrument Sans']);
  const c = data.demo as Content;
  return (
    <div className={s.root}>
      <style href="lodge" precedence="design">
        {css}
      </style>

      <header className={s.top}>
        <p className={s.brand}>Takapuna Motor Lodge</p>
        <a className={s.topCall} href={c.phone.tel} data-press>
          Call {c.phone.display}
        </a>
      </header>

      <section className={s.hero} data-hero aria-labelledby="hero-h">
        <div className={s.card}>
          <figure className={s.cardPhoto}>
            <Pic pic={pic(data, 'hero')} sizes="(min-width: 960px) 34vw, 92vw" first />
          </figure>
          <div className={s.cardBack}>
            <p className={s.stamp} aria-label={`${c.stamp.figure} ${c.stamp.words}`}>
              <span className={s.stampFigure}>{c.stamp.figure}</span>
              <span className={s.stampWords}>{c.stamp.words}</span>
            </p>
            <p className={s.postmark} aria-hidden="true">
              Takapuna · North Shore
            </p>
            <h1 id="hero-h" className={s.head}>
              {c.headline.map((l, i) => (
                <span key={l} className={s.line} style={{ '--i': i } as CSSProperties}>
                  <span>{l}</span>
                </span>
              ))}
            </h1>
            <p className={s.lede}>{c.lede}</p>
          </div>
        </div>
        <div className={s.acts} data-covers>
          <a className={s.primary} href={c.book} data-press>
            Check dates and book
          </a>
          <a className={s.secondary} href={c.phone.tel} data-press>
            Call {c.phone.display}
          </a>
        </div>
      </section>

      <main>
        <section className={s.back} aria-label="Why guests come back">
          <p className={s.backText} data-reveal>
            {c.back}
          </p>
        </section>

        <section className={s.units} aria-labelledby="units-h">
          <h2 id="units-h" className={s.h2}>
            Four ways to stay
          </h2>
          <ol className={s.unitList} data-show>
            {c.units.map((u, i) => (
              <li key={u.name} className={s.unit} style={{ '--i': i } as CSSProperties}>
                <span className={s.unitN} aria-hidden="true">
                  {u.n}
                </span>
                <h3 className={s.unitName}>{u.name}</h3>
                <p className={s.unitWho}>{u.who}</p>
                <p className={s.unitText}>{u.text}</p>
                <a className={s.unitBook} href={c.book} aria-label={`Check dates for ${u.name}`} data-press>
                  Check dates
                </a>
              </li>
            ))}
          </ol>
        </section>

        <section className={s.inside} aria-labelledby="inside-h">
          <div className={s.insideHead}>
            <h2 id="inside-h" className={s.h2}>
              Serviced daily
            </h2>
            <ul className={s.facts}>
              {c.facilities.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
          <div className={s.strip}>
            {(['lounge', 'kitchen', 'dining', 'bench'] as const).map((k) => (
              <figure key={k} className={s.snap} data-reveal>
                <Pic pic={pic(data, k)} sizes="(min-width: 960px) 25vw, 80vw" />
              </figure>
            ))}
          </div>
        </section>

        <section className={s.near} aria-labelledby="near-h">
          <h2 id="near-h" className={s.h2}>
            Close by
          </h2>
          <ul className={s.nearList}>
            {c.near.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <p className={s.city} data-reveal>
            {c.city}
          </p>
        </section>

        <section className={s.book} id="book" data-covers aria-labelledby="book-h">
          <h2 id="book-h" className={s.h2}>
            Book your stay
          </h2>
          <p className={s.stays}>{c.stays}</p>
          <div className={s.ways}>
            <a className={s.primary} href={c.book} data-press>
              Check dates and book
            </a>
            <a className={s.way} href={c.phone.tel} data-press>
              Call {c.phone.display}
            </a>
            <a className={s.way} href={`mailto:${c.email}`} data-press>
              {c.email}
            </a>
          </div>
        </section>
      </main>

      <footer className={s.foot} data-covers>
        <p className={s.footName}>Takapuna Motor Lodge</p>
        <address className={s.footAddr}>
          {c.address.map((l) => (
            <span key={l}>{l} </span>
          ))}
        </address>
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
          Check dates
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

export const lodge: Design = { Demo, fonts: ['young-serif-latin-400-normal', 'instrument-sans-latin-wght-normal'], heroSizes: '(min-width: 960px) 34vw, 92vw' };
