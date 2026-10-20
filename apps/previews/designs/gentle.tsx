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
  address: string[];
  headline: string[];
  sub: string;
  know: string;
  numb: string;
  treat: string;
  specialises: string[];
  help: { title: string; text: string }[];
  week: { day: string; short: string; spans: number[][]; text: string }[];
  team: { name: string; role: string; line: string }[];
}

const FROM = 480;
const TO = 1140;
const at = (m: number) => `${((m - FROM) / (TO - FROM)) * 100}%`;
const clock = (m: number) => `${((Math.floor(m / 60) + 11) % 12) + 1}${m % 60 ? `:${String(m % 60).padStart(2, '0')}` : ''}${m >= 720 ? 'pm' : 'am'}`;

/**
 * Whakatane Dental Centre. "Catering for cowards": the line their own site opens on, set large and soft
 * on a warm ground, then their own reassurance in their words. The signature is their week, drawn to
 * scale from the hours they publish: the long lunch on three days, the short Friday, and the note
 * that late appointments are there when needed. Health page: no testimonials.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('gentle', ['Alegreya', 'Onest']);
  const c = data.demo as Content;
  const marks = [540, 720, 900, 1080];
  return (
    <div className={s.root}>
      <style href="gentle" precedence="design">
        {css}
      </style>

      <header className={s.top}>
        <p className={s.brand}>Whakatane Dental Centre</p>
        <a className={s.topCall} href={c.phone.tel} data-press>
          Call {c.phone.display}
        </a>
      </header>

      <section className={s.hero} data-hero aria-labelledby="hero-h">
        <p className={s.place}>The gentle dentist, {c.town}</p>
        <h1 id="hero-h" className={s.head}>
          {c.headline.map((l, i) => (
            <span key={l} className={s.line} style={{ '--i': i } as CSSProperties}>
              <span>{l}</span>
            </span>
          ))}
        </h1>
        <p className={s.sub}>{c.sub}</p>
        <div className={s.acts} data-covers>
          <a className={s.primary} href="#book" data-press>
            Make an appointment
          </a>
          <a className={s.secondary} href={c.phone.tel} data-press>
            Call {c.phone.display}
          </a>
        </div>
      </section>

      <main>
        <section className={s.know} aria-label="We know">
          <p className={s.knowText} data-reveal>
            {c.know}
          </p>
          <ul className={s.special}>
            {c.specialises.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>

        <section className={s.numb} aria-labelledby="numb-h">
          <h2 id="numb-h" className={s.kicker}>
            Gently, and thoroughly
          </h2>
          <p className={s.numbText} data-reveal>
            {c.numb}
          </p>
        </section>

        <section className={s.week} id="hours" aria-labelledby="week-h">
          <div className={s.weekHead}>
            <h2 id="week-h" className={s.h2}>
              The week
            </h2>
            <p className={s.body}>Opening hours, drawn to scale. Late night appointments are offered for emergencies.</p>
          </div>
          <div className={s.chart} data-show>
            <div className={s.axis} aria-hidden="true">
              {marks.map((m) => (
                <span key={m} style={{ left: at(m) }}>
                  {clock(m)}
                </span>
              ))}
            </div>
            <ol className={s.days}>
              {c.week.map((d, i) => (
                <li key={d.day} className={s.day} style={{ '--i': i } as CSSProperties}>
                  <span className={s.dayName}>{d.short}</span>
                  <span className={s.track} aria-hidden="true">
                    {d.spans.map(([a, b]) => (
                      <span key={a} className={s.span} style={{ left: at(a!), width: `calc(${at(b!)} - ${at(a!)})` }} />
                    ))}
                  </span>
                  <span className={s.dayText}>
                    <span className={s.vh}>{d.day}: </span>
                    {d.text}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={s.help} aria-labelledby="help-h">
          <h2 id="help-h" className={s.h2}>
            Help with the cost, and the hour
          </h2>
          <ul className={s.helpList}>
            {c.help.map((h) => (
              <li key={h.title} data-reveal>
                <h3>{h.title}</h3>
                <p>{h.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className={s.team} aria-labelledby="team-h">
          <figure className={s.teamPhoto} data-reveal>
            <Pic pic={pic(data, 'team')} sizes="(min-width: 960px) 50vw, 100vw" />
          </figure>
          <div>
            <h2 id="team-h" className={s.h2}>
              Our team
            </h2>
            <p className={s.treat}>{c.treat}</p>
            <ul className={s.people}>
              {c.team.map((p) => (
                <li key={p.name}>
                  <span className={s.personName}>{p.name}</span>
                  <span className={s.personRole}>{p.role}</span>
                  <span className={s.personLine}>{p.line}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={s.book} id="book" data-covers aria-labelledby="book-h">
          <h2 id="book-h" className={s.bookHead}>
            Make an appointment
          </h2>
          <p className={s.bookText}>An initial appointment with us includes a consultation explaining each patient’s diagnosis and treatment options.</p>
          <div className={s.bookWays}>
            <a className={s.wayCall} href={c.phone.tel} data-press>
              Call {c.phone.display}
            </a>
            <a className={s.wayMail} href={`mailto:${c.email}?subject=${encodeURIComponent('Appointment request')}`} data-press>
              Email {c.email}
            </a>
          </div>
        </section>
      </main>

      <footer className={s.foot} data-covers>
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
        <a href="#book" className={s.barBook} data-press>
          Make an appointment
        </a>
        <a href={c.phone.tel} className={s.barCall} data-press aria-label={`Call ${c.phone.display}`}>
          Call
        </a>
      </nav>
      <Cover />
      <Shown />
    </div>
  );
}

export const gentle: Design = { Demo, fonts: ['alegreya-latin-wght-italic', 'onest-latin-wght-normal'], heroSizes: '100vw' };
