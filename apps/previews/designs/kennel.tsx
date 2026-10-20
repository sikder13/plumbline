import type { CSSProperties } from 'react';
import { Windows, type Week } from '@/components/Windows';
import { Cover } from '@/components/os/Cover';
import type { PageData } from '@/lib/data';
import { SENDER, SENDER_SITE, demoNote } from '@/lib/offer';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Content {
  town: string;
  phone: { tel: string; display: string };
  text: { sms: string; display: string };
  email: string;
  book: string;
  headline: string[];
  facts: string[];
  ways: { how: string; line: string; kind: 'form' | 'text' | 'call' }[];
  early: string;
  kennels: { what: string; price: string }[];
  cattery: { what: string; price: string }[];
  ratesNote: string;
  dogs: string[];
  cats: string;
  own: string;
  vaccines: string;
  week: Week;
  hours: { day: string; times: string[] }[];
  closed: string;
  near: string;
}

/**
 * St Georges Kennels and Cattery, Hawke's Bay. No photographs on their site, so the page is their own
 * promise set big: "clean, safe, warm and comfortable". The signature is the pair of drop-off windows,
 * live against the New Zealand clock, and their "3 easy ways to make a reservation" as three big doors.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('kennel', ['Unbounded', 'Zilla Slab']);
  const c = data.demo as Content;
  const href = (k: string) => (k === 'form' ? c.book : k === 'text' ? c.text.sms : c.phone.tel);
  return (
    <div className={s.root}>
      <style href="kennel" precedence="design">
        {css}
      </style>

      <header className={s.top}>
        <p className={s.brand}>St Georges</p>
        <a className={s.topCall} href={c.phone.tel} data-press>
          Call {c.phone.display}
        </a>
      </header>

      <section className={s.hero} data-hero aria-labelledby="hero-h">
        <p className={s.place}>Kennels and Cattery · {c.town}</p>
        <h1 id="hero-h" className={s.head}>
          {c.headline.map((l, i) => (
            <span key={l} className={s.line} style={{ '--i': i } as CSSProperties}>
              <span>{l}</span>
            </span>
          ))}
        </h1>
        <p className={s.now}>
          <Windows week={c.week} fallback="Drop-offs 8am to 10am every day" className={s.nowLine} />
        </p>
        <div className={s.acts} data-covers>
          <a className={s.primary} href={c.book} data-press>
            Book online now
          </a>
          <a className={s.secondary} href={c.text.sms} data-press>
            Text {c.text.display}
          </a>
        </div>
        <ul className={s.facts}>
          {c.facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </section>

      <main>
        <section className={s.ways} id="book" data-covers aria-labelledby="ways-h">
          <h2 id="ways-h" className={s.h2}>
            3 easy ways to make a reservation
          </h2>
          <ol className={s.doors}>
            {c.ways.map((w, i) => (
              <li key={w.how}>
                <a className={s.door} href={href(w.kind)} data-press>
                  <span className={s.doorN}>{i + 1}</span>
                  <span className={s.doorHow}>{w.how}</span>
                  <span className={s.doorLine}>{w.line}</span>
                </a>
              </li>
            ))}
          </ol>
          <p className={s.early}>{c.early}</p>
        </section>

        <section className={s.rates} aria-labelledby="rates-h">
          <h2 id="rates-h" className={s.h2}>
            Rates per night
          </h2>
          <div className={s.boards}>
            <div className={s.board}>
              <h3 className={s.boardTitle}>Kennels</h3>
              <dl className={s.rateList}>
                {c.kennels.map((r) => (
                  <div key={r.what}>
                    <dt>{r.what}</dt>
                    <dd>{r.price}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className={s.board}>
              <h3 className={s.boardTitle}>Cattery</h3>
              <dl className={s.rateList}>
                {c.cattery.map((r) => (
                  <div key={r.what}>
                    <dt>{r.what}</dt>
                    <dd>{r.price}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          <p className={s.note}>{c.ratesNote}</p>
        </section>

        <section className={s.stay} aria-labelledby="stay-h">
          <h2 id="stay-h" className={s.h2}>
            Their stay
          </h2>
          <div className={s.stayCols}>
            <div>
              <h3 className={s.h3}>Dogs</h3>
              <ul className={s.ticks}>
                {c.dogs.map((d) => (
                  <li key={d} data-reveal>
                    {d}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className={s.h3}>Cats</h3>
              <p className={s.body}>{c.cats}</p>
              <p className={s.body}>{c.own}</p>
            </div>
          </div>
          <p className={s.vaccines}>{c.vaccines}</p>
        </section>

        <section className={s.hours} aria-labelledby="hours-h">
          <h2 id="hours-h" className={s.h2}>
            Drop-off and collection
          </h2>
          <dl className={s.hourList}>
            {c.hours.map((h) => (
              <div key={h.day}>
                <dt>{h.day}</dt>
                {h.times.map((t) => (
                  <dd key={t}>{t}</dd>
                ))}
              </div>
            ))}
          </dl>
          <p className={s.note}>{c.closed}</p>
          <p className={s.near}>{c.near}</p>
        </section>
      </main>

      <footer className={s.foot} data-covers>
        <p className={s.footName}>St Georges Kennels and Cattery</p>
        <p className={s.footLinks}>
          <a href={c.phone.tel}>{c.phone.display}</a>
          <a href={c.text.sms}>Text {c.text.display}</a>
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
          Book online
        </a>
        <a href={c.phone.tel} className={s.barCall} data-press>
          Call
        </a>
      </nav>
      <Cover />
    </div>
  );
}

export const kennel: Design = { Demo, fonts: ['unbounded-latin-wght-normal', 'zilla-slab-latin-400-normal'], heroSizes: '100vw' };
