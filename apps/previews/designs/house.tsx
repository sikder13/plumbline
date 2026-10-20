import type { CSSProperties } from 'react';
import { Pic } from '@/components/Pic';
import { WaysIn } from '@/components/WaysIn';
import { Cover } from '@/components/os/Cover';
import { pic, type PageData } from '@/lib/data';
import { SENDER, SENDER_SITE, demoNote } from '@/lib/offer';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Content {
  town: string;
  phone: { tel: string; display: string };
  email: string;
  address: string[];
  book: string;
  headline: string[];
  tagline: string;
  intro: string;
  offers: string[];
  ways: { id: string; label: string; items: { name: string; price: string; text: string }[] }[];
  newTo: string;
  facilities: string;
  aerialLine: string;
  meg: { name: string; tel: string; display: string };
}

/**
 * House of Wellness, Mount Maunganui. "Welcome Home." over their own sunlit studio. The signature is
 * every way in from their rates page, chosen by how often you will come: trying us out, every week,
 * now and then, or from home. Every card is one of their prices, and every Book button goes to their
 * own working timetable.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('house', ['Cormorant Garamond', 'Work Sans']);
  const c = data.demo as Content;
  return (
    <div className={s.root}>
      <style href="house" precedence="design">
        {css}
      </style>

      <section className={s.hero} data-hero aria-labelledby="hero-h">
        <figure className={s.heroPhoto}>
          <Pic pic={pic(data, 'hero')} sizes="100vw" first />
        </figure>
        <header className={s.top}>
          <p className={s.brand}>House of Wellness</p>
          <a className={s.topCall} href={c.phone.tel} data-press>
            Call {c.phone.display}
          </a>
        </header>
        <div className={s.heroWords}>
          <p className={s.place}>{c.town}</p>
          <h1 id="hero-h" className={s.head}>
            {c.headline.map((l, i) => (
              <span key={l} className={s.line} style={{ '--i': i } as CSSProperties}>
                <span>{l}</span>
              </span>
            ))}
          </h1>
          <p className={s.tagline}>{c.tagline}</p>
          <div className={s.acts} data-covers>
            <a className={s.primary} href={c.book} data-press>
              Book a class
            </a>
            <a className={s.secondary} href="#ways" data-press>
              See the rates
            </a>
          </div>
        </div>
      </section>

      <main>
        <section className={s.intro} aria-label="Welcome">
          <p className={s.introText} data-reveal>
            {c.intro}
          </p>
          <ul className={s.offers}>
            {c.offers.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </section>

        <section className={s.ways} id="ways" aria-labelledby="ways-h">
          <h2 id="ways-h" className={s.h2}>
            How often will you come?
          </h2>
          <WaysIn ways={c.ways} book={c.book} s={{ tabs: s.tabs!, tab: s.tab!, cards: s.cards!, card: s.card!, cardName: s.cardName!, cardPrice: s.cardPrice!, cardText: s.cardText!, cardBook: s.cardBook! }} />
        </section>

        <section className={s.studio} aria-labelledby="studio-h">
          <figure className={s.studioPhoto} data-reveal>
            <Pic pic={pic(data, 'studio')} sizes="(min-width: 900px) 58vw, 100vw" />
          </figure>
          <div className={s.studioWords}>
            <h2 id="studio-h" className={s.h2}>
              New to yoga?
            </h2>
            <p className={s.body}>{c.newTo}</p>
            <p className={s.body}>{c.facilities}</p>
          </div>
          <figure className={s.aerial} data-reveal>
            <Pic pic={pic(data, 'aerial')} sizes="(min-width: 900px) 24vw, 60vw" />
            <figcaption>{c.aerialLine}</figcaption>
          </figure>
        </section>

        <section className={s.book} id="book" data-covers aria-labelledby="book-h">
          <h2 id="book-h" className={s.bookHead}>
            Come home to yourself.
          </h2>
          <div className={s.bookWays}>
            <a className={s.bookMain} href={c.book} data-press>
              Book a class on the timetable
            </a>
            <a className={s.bookAlt} href={c.phone.tel} data-press>
              Call the studio, {c.phone.display}
            </a>
            <a className={s.bookAlt} href={c.meg.tel} data-press>
              {c.meg.name}, {c.meg.display}
            </a>
          </div>
        </section>
      </main>

      <footer className={s.foot} data-covers>
        <figure className={s.footPhoto}>
          <Pic pic={pic(data, 'teach')} sizes="(min-width: 900px) 30vw, 100vw" />
        </figure>
        <div>
          <p className={s.footName}>House of Wellness</p>
          <address className={s.footAddr}>
            {c.address.map((l) => (
              <span key={l}>{l}</span>
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
        </div>
      </footer>

      <nav className={s.bar} aria-label="Book or call">
        <a href={c.book} className={s.barBook} data-press>
          Book a class
        </a>
        <a href={c.phone.tel} className={s.barCall} data-press>
          Call
        </a>
      </nav>
      <Cover />
    </div>
  );
}

export const house: Design = { Demo, fonts: ['cormorant-garamond-latin-wght-normal', 'work-sans-latin-wght-normal'], heroSizes: '100vw' };
