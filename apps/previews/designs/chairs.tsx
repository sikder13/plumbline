import type { CSSProperties } from 'react';
import { Pic } from '@/components/Pic';
import { Cover } from '@/components/os/Cover';
import { Shown } from '@/components/Shown';
import { pic, type PageData } from '@/lib/data';
import { SENDER, SENDER_SITE, demoNote } from '@/lib/offer';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Content {
  town: string;
  phone: { tel: string; display: string };
  email: string;
  address: string[];
  headline: string[];
  lede: string;
  tags: string[];
  welcome: string;
  chairsLine: string;
  dentists: { name: string; line: string }[];
  dentistsQuote: string;
  promise: string;
  cost: string;
  services: string[];
  sterile: string;
  bookNote: string;
}

/**
 * Dental@105, Hastings. "Your friendly dental practice", in the photo of the whole team. The signature
 * is their own three-chair practice: three columns, one for each dentist their about page names, that
 * fill one after another as they arrive. Then their promise about costs in their own words, the
 * services they list, and a plain way to book: the phone and the email, since their booking page is gone.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('chairs', ['Gelasio', 'Hanken Grotesk']);
  const c = data.demo as Content;
  return (
    <div className={s.root}>
      <style href="chairs" precedence="design">
        {css}
      </style>

      <header className={s.top}>
        <p className={s.brand}>Dental@105</p>
        <nav className={s.topNav} aria-label="On this page">
          <a href="#practice">The practice</a>
          <a href="#services">Services</a>
          <a href="#book">Book</a>
        </nav>
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
          <Pic pic={pic(data, 'hero')} sizes="(min-width: 960px) 52vw, 100vw" first />
        </figure>
        <ul className={s.tags}>
          {c.tags.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>

      <main>
        <section className={s.welcome} aria-labelledby="welcome-h">
          <h2 id="welcome-h" className={s.kicker}>
            Welcome to Dental @ 105
          </h2>
          <p className={s.welcomeText} data-reveal>
            {c.welcome}
          </p>
        </section>

        <section className={s.chairs} id="practice" aria-labelledby="chairs-h">
          <div className={s.chairsHead}>
            <h2 id="chairs-h" className={s.h2}>
              Three chairs
            </h2>
            <p className={s.body}>{c.chairsLine}</p>
          </div>
          <ol className={s.chairList} data-show>
            {c.dentists.map((d, i) => (
              <li key={d.name} className={s.chair} style={{ '--i': i } as CSSProperties}>
                <span className={s.chairNo}>{i + 1}</span>
                <span className={s.chairName}>{d.name}</span>
                <span className={s.chairLine}>{d.line}</span>
              </li>
            ))}
          </ol>
          <figure className={s.trio}>
            <Pic pic={pic(data, 'trio')} sizes="(min-width: 960px) 40vw, 100vw" />
            <figcaption>{c.dentistsQuote}</figcaption>
          </figure>
        </section>

        <section className={s.promise} aria-labelledby="promise-h">
          <h2 id="promise-h" className={s.kicker}>
            Your own informed choices
          </h2>
          <blockquote className={s.quote} data-reveal>
            <p>{c.promise}</p>
          </blockquote>
          <p className={s.cost} data-reveal>
            {c.cost}
          </p>
        </section>

        <section className={s.services} id="services" aria-labelledby="services-h">
          <h2 id="services-h" className={s.h2}>
            Services
          </h2>
          <ul className={s.serviceList}>
            {c.services.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <p className={s.sterile}>{c.sterile}</p>
        </section>

        <section className={s.book} id="book" data-covers aria-labelledby="book-h">
          <h2 id="book-h" className={s.h2}>
            Book an appointment
          </h2>
          <p className={s.bookNote}>{c.bookNote}</p>
          <div className={s.bookWays}>
            <a className={s.way} href={c.phone.tel} data-press>
              <span className={s.wayLabel}>Call reception</span>
              <span className={s.wayValue}>{c.phone.display}</span>
            </a>
            <a className={s.way} href={`mailto:${c.email}?subject=${encodeURIComponent('Appointment request')}`} data-press>
              <span className={s.wayLabel}>Email reception</span>
              <span className={s.wayValue}>{c.email}</span>
            </a>
          </div>
        </section>
      </main>

      <footer className={s.foot} data-covers>
        <div className={s.footGrid}>
          <address className={s.footAddr}>
            <strong>Dental@105</strong>{' '}
            {c.address.map((l) => (
              <span key={l}>{l} </span>
            ))}
          </address>
          <div className={s.footLinks}>
            <a href={c.phone.tel}>{c.phone.display}</a>
            <a href={`mailto:${c.email}`}>{c.email}</a>
          </div>
        </div>
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
          Book
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

export const chairs: Design = { Demo, fonts: ['gelasio-latin-wght-normal', 'hanken-grotesk-latin-wght-normal'], heroSizes: '(min-width: 960px) 52vw, 100vw' };
