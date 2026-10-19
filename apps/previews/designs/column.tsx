import { ColumnWeek } from '@/components/ColumnWeek';
import { Cover } from '@/components/os/Cover';
import { Now } from '@/components/os/Now';
import type { Day } from '@/components/os/hours';
import type { PageData } from '@/lib/data';
import { SENDER, SENDER_SITE } from '@/lib/offer';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Content {
  mono: string;
  word: string;
  town: string;
  county: string;
  address: string[];
  phone: { tel: string; display: string };
  maps: string;
  hours: Day[];
  hoursSource: string;
}

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M4 10h11M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * LV Construction, Goshen. Nothing is on their profile yet but the name, the number, the address and
 * the week, so the page is built of those alone: the initials as a monogram on concrete, the week as
 * seven columns of 24 hours with today marked, and the number to close.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('column', ['Unbounded', 'Onest']);
  const c = data.demo as Content;

  return (
    <div className={s.root}>
      <style href="column" precedence="design">
        {css}
      </style>

      <section className={s.hero} data-hero aria-labelledby="hero-h">
        <p className={s.capTown}>{c.town}</p>
        <p className={s.capCounty}>{c.county}</p>
        <h1 id="hero-h" className={s.title} aria-label={`${c.mono} ${c.word}`}>
          <span className={s.mono} aria-hidden="true">
            {c.mono}
          </span>
          <span className={s.word} aria-hidden="true">
            {c.word}
          </span>
        </h1>
        <div className={s.side}>
          <p className={s.now}>
            <Now week={c.hours} fallback="Open 24 hours, Monday to Saturday" />
          </p>
          <div className={s.acts} data-covers>
            <a className={s.call} href={c.phone.tel} data-press data-magnetic>
              Call {c.phone.display}
            </a>
            <a className={s.go} href={c.maps} rel="noopener" target="_blank" data-press>
              Directions
              <Arrow />
            </a>
          </div>
        </div>
      </section>

      <main>
        <section className={s.weekSec} aria-labelledby="week-h">
          <h2 id="week-h" className={s.weekHead}>
            The week
          </h2>
          <ColumnWeek week={c.hours} s={{ week: s.week!, colDay: s.colDay!, colBar: s.colBar!, colFill: s.colFill!, colNow: s.colNow!, colHours: s.colHours!, colToday: s.colToday! }} />
          <p className={s.legend}>
            {c.hoursSource} Each bar is one day of 24 hours, from midnight to midnight, with lines at 6 AM, noon and 6 PM.
          </p>
        </section>
      </main>

      <footer className={s.end} data-covers>
        <p className={s.endLabel}>
          Call {c.mono} {c.word}
        </p>
        <a className={s.number} href={c.phone.tel} aria-label={`Call ${c.phone.display}`} data-press>
          {c.phone.display.split(' ').map((part) => (
            <span key={part}>{part}</span>
          ))}
        </a>
        <div className={s.endRow}>
          <address className={s.addr}>
            {c.address.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </address>
          <a className={s.go} href={c.maps} rel="noopener" target="_blank" data-press>
            Directions
            <Arrow />
          </a>
        </div>
        <p className={s.small}>
          Demo made from their Google profile. Not an official site. Demo by{' '}
          <a href={SENDER_SITE} target="_blank" rel="noopener">
            {SENDER}
          </a>
          .
        </p>
      </footer>

      <nav className={s.bar} aria-label="Call or get directions">
        <a href={c.phone.tel} className={s.barCall} data-press>
          Call
        </a>
        <a href={c.maps} className={s.barGo} rel="noopener" target="_blank" data-press>
          Directions
        </a>
      </nav>
      <Cover />
    </div>
  );
}

export const column: Design = { Demo, fonts: ['unbounded-latin-wght-normal', 'onest-latin-wght-normal'], heroSizes: '100vw' };
