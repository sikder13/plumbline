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
  /** "Estd 1894", as their logo and crew shirts say. */
  estd: string;
  phone: { tel: string; display: string };
  email: string;
  book: string;
  address: string[];
  maps: string;
  headline: string[];
  lede: string;
  open: string;
  eat: string;
  drink: string;
  family: string;
  menu: { title: string; items: { name: string; price: string; text: string }[] }[];
  functions: string;
}

/**
 * The Comm. Whakatane. "Good beer, good cider, great mates" set like a pub poster over their own
 * building on The Strand. The signature is a pint that pours as it scrolls in beside their own words on
 * beer, and their menu board at the prices it prints. Book a table goes to their own NowBookIt page.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('tap', ['Anton', 'Libre Franklin']);
  const c = data.demo as Content;
  return (
    <div className={s.root}>
      <style href="tap" precedence="design">
        {css}
      </style>

      <section className={s.hero} data-hero aria-labelledby="hero-h">
        <figure className={s.heroPhoto}>
          <Pic pic={pic(data, 'hero')} sizes="100vw" first />
        </figure>
        <header className={s.top}>
          <p className={s.brand}>
            The Comm<span>.</span>
          </p>
          <a className={s.topCall} href={c.phone.tel} data-press>
            Call {c.phone.display}
          </a>
        </header>
        <div className={s.heroWords}>
          <p className={s.place}>
            {c.town} · {c.estd}
          </p>
          <h1 id="hero-h" className={s.head}>
            {c.headline.map((l, i) => (
              <span key={l} className={s.line} style={{ '--i': i } as CSSProperties}>
                <span>{l}</span>
              </span>
            ))}
          </h1>
          <p className={s.open}>{c.open}</p>
          <div className={s.acts} data-covers>
            <a className={s.primary} href={c.book} data-press>
              Book a table
            </a>
            <a className={s.secondary} href="#menu" data-press>
              See the menu
            </a>
          </div>
        </div>
      </section>

      <main>
        <section className={s.intro} aria-label="The home of Good George in Whakatane">
          <p className={s.introText} data-reveal>
            {c.lede}
          </p>
        </section>

        <section className={s.drink} aria-labelledby="drink-h">
          <div className={s.pint} data-show aria-hidden="true">
            <span className={s.glass}>
              <span className={s.beer} />
              <span className={s.foam} />
            </span>
          </div>
          <div className={s.drinkWords}>
            <h2 id="drink-h" className={s.h2}>
              Let’s drink
            </h2>
            <p className={s.big}>{c.drink}</p>
            <p className={s.body}>{c.family}</p>
          </div>
          <figure className={s.taps} data-reveal>
            <Pic pic={pic(data, 'taps')} sizes="(min-width: 960px) 26vw, 100vw" />
          </figure>
        </section>

        <section className={s.menu} id="menu" aria-labelledby="menu-h">
          <div className={s.menuHead}>
            <h2 id="menu-h" className={s.h2}>
              Let’s eat
            </h2>
            <p className={s.body}>{c.eat}</p>
          </div>
          <div className={s.board}>
            {c.menu.map((g) => (
              <section key={g.title} className={s.group} aria-label={g.title} data-reveal>
                <h3 className={s.groupTitle}>{g.title}</h3>
                <ul className={s.items}>
                  {g.items.map((x) => (
                    <li key={x.name} className={s.item}>
                      <span className={s.itemName}>{x.name}</span>
                      <span className={s.leader} aria-hidden="true" />
                      <span className={s.itemPrice}>{x.price}</span>
                      <span className={s.itemText}>{x.text}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </section>

        <section className={s.room} aria-label="Inside The Comm">
          {(['bar', 'plates', 'salad'] as const).map((k) => (
            <figure key={k} className={s[`r_${k}`]} data-reveal>
              <Pic pic={pic(data, k)} sizes="(min-width: 960px) 40vw, 100vw" />
            </figure>
          ))}
        </section>

        <section className={s.book} id="book" data-covers aria-labelledby="book-h">
          <h2 id="book-h" className={s.bookHead}>
            Book at The Comm<span>.</span>
          </h2>
          <p className={s.body}>{c.functions}</p>
          <div className={s.ways}>
            <a className={s.primary} href={c.book} data-press>
              Book a table
            </a>
            <a className={s.way} href={c.phone.tel} data-press>
              Call {c.phone.display}
            </a>
            <a className={s.way} href={`mailto:${c.email}?subject=${encodeURIComponent('Function enquiry')}`} data-press>
              Ask about a function
            </a>
          </div>
        </section>
      </main>

      <footer className={s.foot} data-covers>
        <p className={s.footName}>The Comm. Whakatane</p>
        <a className={s.footAddr} href={c.maps} target="_blank" rel="noopener">
          {c.address.join(', ')}
        </a>
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
          Book a table
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

export const tap: Design = { Demo, fonts: ['anton-latin-400-normal', 'libre-franklin-latin-wght-normal'], heroSizes: '100vw' };
