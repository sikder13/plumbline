import type { CSSProperties } from 'react';
import { Pic } from '@/components/Pic';
import { Shown } from '@/components/Shown';
import { Cover } from '@/components/os/Cover';
import { pic, type PageData } from '@/lib/data';
import { SENDER, SENDER_SITE, demoNote } from '@/lib/offer';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Training {
  name: string;
  dates: string;
  start: number[];
  end: number[];
  place: string;
  season: string;
  spaces: string;
  href: string;
  broken?: boolean;
}

interface Content {
  town: string;
  phone: { tel: string; display: string; who: string };
  whatsapp: { href: string; display: string; who: string };
  email: string;
  headline: string[];
  lede: string;
  since: string;
  poses: string;
  teach: string;
  checks: string[];
  small: string;
  trainings: Training[];
  quotes: { text: string; by: string }[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Months since November 2026, with the day as a fraction: where a date sits on the calendar strip. */
const pos = (d: number[]) => (d[0]! - 2026) * 12 + (d[1]! - 11) + (d[2]! - 1) / 31;
const SPAN = 14;

/**
 * Asia Pacific Yoga, Taupō. "We teach you how to teach." The page opens on their lake, then the line
 * that sets them apart, with "poses" struck out. The signature is their own calendar: every upcoming
 * training placed on a strip of the months to scale, each linking to its own page, or to a way to ask
 * where its page is missing.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('season', ['Instrument Serif', 'Plus Jakarta Sans']);
  const c = data.demo as Content;
  const months = Array.from({ length: SPAN }, (_, i) => ({ label: MONTHS[(10 + i) % 12]!, year: 2026 + Math.floor((10 + i) / 12), i }));
  return (
    <div className={s.root}>
      <style href="season" precedence="design">
        {css}
      </style>

      <header className={s.top}>
        <p className={s.brand}>Asia Pacific Yoga</p>
        <a className={s.topCall} href={c.phone.tel} data-press>
          Call {c.phone.who}
        </a>
      </header>

      <section className={s.hero} data-hero aria-labelledby="hero-h">
        <figure className={s.heroPhoto}>
          <Pic pic={pic(data, 'hero')} sizes="(min-width: 1000px) 56vw, 100vw" first />
        </figure>
        <div className={s.heroWords}>
          <p className={s.place}>Yoga Alliance teacher trainings, {c.town}</p>
          <h1 id="hero-h" className={s.head}>
            {c.headline.map((l, i) => (
              <span key={l} className={s.line} style={{ '--i': i } as CSSProperties}>
                <span>{l}</span>
              </span>
            ))}
          </h1>
          <p className={s.lede}>{c.lede}</p>
          <div className={s.acts} data-covers>
            <a className={s.primary} href="#trainings" data-press>
              See the trainings
            </a>
            <a className={s.secondary} href="#book" data-press>
              Talk to us
            </a>
          </div>
          <p className={s.since}>{c.since}</p>
        </div>
      </section>

      <main>
        <section className={s.poses} aria-labelledby="poses-h">
          <h2 id="poses-h" className={s.posesHead}>
            <span className={s.struck}>{c.poses}</span>
            <span className={s.teach}>{c.teach}</span>
          </h2>
          <ul className={s.checks}>
            {c.checks.map((x) => (
              <li key={x} data-reveal>
                {x}
              </li>
            ))}
          </ul>
        </section>

        <section className={s.cal} id="trainings" aria-labelledby="cal-h">
          <div className={s.calHead}>
            <h2 id="cal-h" className={s.h2}>
              Upcoming trainings
            </h2>
            <p className={s.body}>{c.small}</p>
          </div>
          <div className={s.strip} data-show aria-hidden="true">
            <div className={s.months}>
              {months.map((m) => (
                <span key={`${m.label}${m.year}`} style={{ '--m': m.i } as CSSProperties}>
                  {m.label}
                  {m.label === 'Jan' || m.i === 0 ? <em>{m.year}</em> : null}
                </span>
              ))}
            </div>
            <div className={s.runs}>
              {c.trainings.map((t, i) => (
                <a key={t.name} href={`#t-${i}`} tabIndex={-1} className={s.run} data-broken={t.broken ? '' : undefined} style={{ left: `${(pos(t.start) / SPAN) * 100}%`, width: `${((pos(t.end) - pos(t.start)) / SPAN) * 100}%`, '--i': i } as CSSProperties} />
              ))}
            </div>
          </div>
          <ol className={s.list}>
            {c.trainings.map((t, i) => (
              <li key={t.name} id={`t-${i}`} className={s.item} data-reveal>
                <p className={s.itemDates}>{t.dates}</p>
                <h3 className={s.itemName}>{t.name}</h3>
                <p className={s.itemPlace}>{t.place}</p>
                <p className={s.itemSeason}>{t.season}</p>
                <p className={s.itemSpaces}>{t.spaces}</p>
                <a className={s.itemBook} href={t.href} data-press>
                  {t.broken ? 'Ask to book this one' : 'Book Now'}
                </a>
              </li>
            ))}
          </ol>
        </section>

        <section className={s.pair} aria-label="Where you train">
          <figure data-reveal>
            <Pic pic={pic(data, 'farm')} sizes="(min-width: 900px) 46vw, 100vw" />
            <figcaption>The Farm, Northland</figcaption>
          </figure>
          <figure data-reveal>
            <Pic pic={pic(data, 'group')} sizes="(min-width: 900px) 46vw, 100vw" />
            <figcaption>Small groups, real teaching practice</figcaption>
          </figure>
        </section>

        <section className={s.voices} aria-label="From their students">
          {c.quotes.map((q) => (
            <figure key={q.by} className={s.voice} data-reveal>
              <blockquote>
                <p>{q.text}</p>
              </blockquote>
              <figcaption>{q.by}</figcaption>
            </figure>
          ))}
        </section>

        <section className={s.book} id="book" data-covers aria-labelledby="book-h">
          <figure className={s.bookPhoto}>
            <Pic pic={pic(data, 'founders')} sizes="(min-width: 900px) 40vw, 100vw" />
          </figure>
          <div>
            <h2 id="book-h" className={s.h2}>
              Talk to us about a training
            </h2>
            <p className={s.body}>Would you like help choosing the right training for you? Ask away.</p>
            <div className={s.ways}>
              <a className={s.way} href={`mailto:${c.email}?subject=${encodeURIComponent('Yoga teacher training')}`} data-press>
                <span>Email</span>
                {c.email}
              </a>
              <a className={s.way} href={c.whatsapp.href} target="_blank" rel="noopener" data-press>
                <span>WhatsApp {c.whatsapp.who}</span>
                {c.whatsapp.display}
              </a>
              <a className={s.way} href={c.phone.tel} data-press>
                <span>Mobile {c.phone.who}</span>
                {c.phone.display}
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className={s.foot} data-covers>
        <p className={s.footName}>Asia Pacific Yoga</p>
        <p className={s.footLinks}>
          <a href={`mailto:${c.email}`}>{c.email}</a>
          <a href={c.phone.tel}>{c.phone.display}</a>
        </p>
        <p className={s.small}>
          {demoNote(data.domain)} Demo by{' '}
          <a href={SENDER_SITE} target="_blank" rel="noopener">
            {SENDER}
          </a>
          .
        </p>
      </footer>

      <nav className={s.bar} aria-label="Trainings or talk to us">
        <a href="#trainings" className={s.barBook} data-press>
          Trainings
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

export const season: Design = { Demo, fonts: ['instrument-serif-latin-400-normal', 'plus-jakarta-sans-latin-wght-normal'], heroSizes: '(min-width: 1000px) 56vw, 100vw' };
