import type { CSSProperties } from 'react';
import { GuestFit, type FitUnit } from '@/components/GuestFit';
import { Pic } from '@/components/Pic';
import { Cover } from '@/components/os/Cover';
import { pic, type PageData } from '@/lib/data';
import { SENDER, SENDER_SITE, demoNote } from '@/lib/offer';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Content {
  town: string;
  phone: { tel: string; display: string };
  free: { tel: string; display: string };
  email: string;
  book: string;
  address: string[];
  headline: string[];
  kicker: string;
  lede: string;
  beach: { figure: string; unit: string; words: string };
  town3: string;
  units: FitUnit[];
  have: string[];
  welcome: string;
  office: string;
}

/**
 * Greymouth Motel, on the West Coast. Their one photograph, the beach at sundown, as a wide panorama with
 * "True West Coast hospitality" over it, and the sky's colours carried down the page. The signature is
 * a guest count: pick how many are coming and the units that sleep that many stay lit, from the numbers
 * their accommodation page gives. Book goes to their own Little Hotelier page.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('sunset', ['Bricolage Grotesque', 'Crimson Pro']);
  const c = data.demo as Content;
  return (
    <div className={s.root}>
      <style href="sunset" precedence="design">
        {css}
      </style>

      <header className={s.top}>
        <p className={s.brand}>Greymouth Motel</p>
        <a className={s.topCall} href={c.phone.tel} data-press>
          Call {c.phone.display}
        </a>
      </header>

      <section className={s.hero} data-hero aria-labelledby="hero-h">
        <div className={s.heroWords}>
          <p className={s.kicker}>{c.kicker}</p>
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
              Check dates and book
            </a>
            <a className={s.secondary} href={c.free.tel} data-press>
              Free phone {c.free.display}
            </a>
          </div>
        </div>
        <figure className={s.pano}>
          <Pic pic={pic(data, 'hero')} sizes="100vw" first />
        </figure>
      </section>

      <main>
        <section className={s.beach} aria-label="Close to the beach">
          <p className={s.beachFigure} data-reveal>
            <span className={s.beachN}>{c.beach.figure}</span> <span className={s.beachUnit}>{c.beach.unit}</span>
          </p>
          <p className={s.beachWords}>{c.beach.words}</p>
          <p className={s.where}>{c.town3}</p>
        </section>

        <section className={s.units} aria-labelledby="units-h">
          <h2 id="units-h" className={s.h2}>
            How many are coming?
          </h2>
          <GuestFit units={c.units} book={c.book} s={s} />
        </section>

        <section className={s.have} aria-labelledby="have-h">
          <h2 id="have-h" className={s.h2}>
            In every unit, and out the back
          </h2>
          <ul className={s.haveList}>
            {c.have.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </section>

        <section className={s.book} id="book" data-covers aria-labelledby="book-h">
          <p className={s.welcome}>“{c.welcome}”</p>
          <h2 id="book-h" className={s.h2}>
            Book your stay
          </h2>
          <div className={s.ways}>
            <a className={s.primary} href={c.book} data-press>
              Check dates and book
            </a>
            <a className={s.way} href={c.free.tel} data-press>
              Free phone {c.free.display} (within NZ)
            </a>
            <a className={s.way} href={c.phone.tel} data-press>
              Call {c.phone.display}
            </a>
            <a className={s.way} href={`mailto:${c.email}`} data-press>
              {c.email}
            </a>
          </div>
          <p className={s.office}>{c.office}</p>
        </section>
      </main>

      <footer className={s.foot} data-covers>
        <p className={s.footName}>Greymouth Motel</p>
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
          Photograph by NicksPlace, from their site. {demoNote(data.domain)} Demo by{' '}
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
    </div>
  );
}

export const sunset: Design = { Demo, fonts: ['bricolage-grotesque-latin-wght-normal', 'crimson-pro-latin-wght-normal'], heroSizes: '100vw' };
