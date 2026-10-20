import type { CSSProperties } from 'react';
import { Pic } from '@/components/Pic';
import { TreatIndex } from '@/components/TreatIndex';
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
  lede: string;
  specialist: string;
  flagship: string;
  treatments: { name: string; text: string; image?: string }[];
  team: { name: string; role: string; line: string }[];
  quote: { text: string; by: string };
  hours: { day: string; time: string }[];
  afterHours: string;
}

/**
 * Tranquillo Beauty Clinic, Tauranga. "Beauty meets satisfaction" beside their own therapist, framed in
 * an arch. The signature is their treatment index: six treatments, one open at a time, each in their
 * words and each one tap from their own working Zenoti booking. Their hours, their two therapists,
 * and one client's words as their own site quotes them.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('serene', ['Bodoni Moda', 'Tenor Sans']);
  const c = data.demo as Content;
  const items = c.treatments.map((t) => ({ name: t.name, text: t.text, pic: t.image ? <Pic pic={pic(data, t.image)} sizes="(min-width: 900px) 280px, 100vw" /> : undefined }));
  return (
    <div className={s.root}>
      <style href="serene" precedence="design">
        {css}
      </style>

      <header className={s.top}>
        <p className={s.brand}>Tranquillo</p>
        <a className={s.topCall} href={c.phone.tel} data-press>
          {c.phone.display}
        </a>
      </header>

      <section className={s.hero} data-hero aria-labelledby="hero-h">
        <figure className={s.arch}>
          <Pic pic={pic(data, 'hero')} sizes="(min-width: 960px) 40vw, 86vw" first />
        </figure>
        <div className={s.heroWords}>
          <p className={s.place}>Tauranga’s Specialist Beauty Clinic</p>
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
              Book an appointment
            </a>
            <a className={s.secondary} href="#treatments" data-press>
              Treatments
            </a>
          </div>
        </div>
      </section>

      <main>
        <section className={s.about} aria-label="About the clinic">
          <p className={s.aboutText} data-reveal>
            {c.specialist}
          </p>
          <p className={s.flag}>{c.flagship}</p>
        </section>

        <section className={s.treat} id="treatments" aria-labelledby="treat-h">
          <h2 id="treat-h" className={s.h2}>
            Our treatments
          </h2>
          <TreatIndex items={items} book={c.book} s={{ index: s.index!, row: s.row!, rowBtn: s.rowBtn!, rowNo: s.rowNo!, rowName: s.rowName!, rowBody: s.rowBody!, rowText: s.rowText!, rowPic: s.rowPic!, rowBook: s.rowBook! }} />
        </section>

        <section className={s.desk} aria-labelledby="team-h">
          <figure className={s.deskPhoto} data-reveal>
            <Pic pic={pic(data, 'desk')} sizes="100vw" />
          </figure>
          <div className={s.teamWrap}>
            <h2 id="team-h" className={s.h2}>
              Meet the team
            </h2>
            <ul className={s.team}>
              {c.team.map((t) => (
                <li key={t.name}>
                  <span className={s.teamName}>{t.name}</span>
                  <span className={s.teamRole}>{t.role}</span>
                  <span className={s.teamLine}>{t.line}</span>
                </li>
              ))}
            </ul>
            <figure className={s.quote}>
              <blockquote>
                <p>{c.quote.text}</p>
              </blockquote>
              <figcaption>{c.quote.by}</figcaption>
            </figure>
          </div>
        </section>

        <section className={s.book} id="book" data-covers aria-labelledby="book-h">
          <div>
            <h2 id="book-h" className={s.h2}>
              Book an appointment
            </h2>
            <a className={s.primary} href={c.book} data-press>
              Book online
            </a>
            <a className={s.bookCall} href={c.phone.tel}>
              or call {c.phone.display}
            </a>
          </div>
          <dl className={s.hours}>
            {c.hours.map((h) => (
              <div key={h.day}>
                <dt>{h.day}</dt>
                <dd>{h.time}</dd>
              </div>
            ))}
            <p className={s.after}>{c.afterHours}</p>
          </dl>
        </section>
      </main>

      <footer className={s.foot} data-covers>
        <p className={s.footName}>Tranquillo Beauty Clinic</p>
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
          Book an appointment
        </a>
        <a href={c.phone.tel} className={s.barCall} data-press>
          Call
        </a>
      </nav>
      <Cover />
    </div>
  );
}

export const serene: Design = { Demo, fonts: ['bodoni-moda-latin-wght-normal', 'tenor-sans-latin-400-normal'], heroSizes: '(min-width: 960px) 40vw, 86vw' };
