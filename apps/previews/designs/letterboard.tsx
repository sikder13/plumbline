import { LetterBoard } from '@/components/LetterBoard';
import { Pic } from '@/components/Pic';
import { Cover } from '@/components/os/Cover';
import { Now } from '@/components/os/Now';
import { clock, type Day } from '@/components/os/hours';
import { pic, type PageData } from '@/lib/data';
import { SENDER, SENDER_SITE } from '@/lib/offer';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Content {
  name: string;
  nameBoard: string[];
  street: string;
  address: string[];
  phone: { tel: string; display: string };
  maps: string;
  hours: Day[];
  board: string[];
  boardSource: string;
  cuts: string[];
  credit: string;
}

/** "12 TO 7 PM" for a board: capitals, and AM only when the two times differ. */
function boardSpan(d: Day): string {
  if (!d.open || !d.close) return 'CLOSED';
  const a = clock(d.open);
  const b = clock(d.close);
  const same = a.slice(-2) === b.slice(-2);
  return `${same ? a.slice(0, -3) : a} TO ${b}`.toUpperCase();
}

/**
 * Players Way Barbershop, West 16th Street. Their red front beside the name on black felt; the services
 * Google lists for them put up on a letterboard, letter by letter; their own cuts; the week on a smaller
 * board with today in red; and the shop's red to close.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('letterboard', ['Oswald', 'Space Mono']);
  const c = data.demo as Content;

  return (
    <div className={s.root}>
      <style href="letterboard" precedence="design">
        {css}
      </style>

      <section className={s.hero} data-hero aria-labelledby="hero-h">
        <div className={s.photo}>
          <Pic pic={pic(data, 'hero')} sizes="(min-width: 900px) 44vw, 100vw" first />
        </div>
        <div className={s.felt}>
          <p className={s.street}>{c.street}</p>
          <h1 id="hero-h" className={s.title} aria-label={c.name}>
            {c.nameBoard.map((l) => (
              <span key={l} aria-hidden="true">
                {l}
              </span>
            ))}
          </h1>
          <p className={s.now}>
            <Now week={c.hours} fallback="Open Tuesday to Saturday" />
          </p>
          <div className={s.acts} data-covers>
            <a className={s.call} href={c.phone.tel} data-press data-magnetic>
              Call {c.phone.display}
            </a>
            <a className={s.go} href={c.maps} rel="noopener" target="_blank" data-press>
              Directions
            </a>
          </div>
        </div>
      </section>

      <main>
        <section className={s.boardSec} aria-labelledby="board-h">
          <h2 id="board-h" className={s.label}>
            On the board
          </h2>
          <LetterBoard lines={c.board} label={c.board.join(', ')} s={{ board: s.board!, boardLine: s.boardLine!, tile: s.tile!, gap: s.gap! }} />
          <p className={s.source}>{c.boardSource}</p>
        </section>

        <section className={s.cuts} aria-labelledby="cuts-h">
          <h2 id="cuts-h" className={s.cutsHead}>
            From the chair
          </h2>
          <div className={s.cutGrid}>
            <figure className={s.cutWide}>
              <Pic pic={pic(data, 'floor')} sizes="(min-width: 900px) 50vw, 100vw" low />
            </figure>
            {c.cuts.map((k) => (
              <figure key={k} className={s.cut}>
                <Pic pic={pic(data, k)} sizes="(min-width: 900px) 25vw, 50vw" low />
              </figure>
            ))}
          </div>
        </section>

        <section className={s.week} id="week" aria-labelledby="week-h">
          <h2 id="week-h" className={s.label}>
            Hours
          </h2>
          <p className={s.weekNow}>
            <Now week={c.hours} fallback="Open Tuesday to Saturday" scope="#week" />
          </p>
          <ol className={s.weekBoard}>
            {c.hours.map((d, i) => (
              <li key={d.day} data-day={i} data-closed={d.open ? undefined : ''}>
                <span>{d.day.slice(0, 3).toUpperCase()}</span>
                <span>{boardSpan(d)}</span>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className={s.end} data-covers>
        <p className={s.endLabel}>Find the shop</p>
        <address className={s.addrBoard}>
          {c.address.map((l) => (
            <span key={l}>{l.toUpperCase()}</span>
          ))}
        </address>
        <div className={s.endActs}>
          <a className={s.callDark} href={c.phone.tel} data-press>
            Call {c.phone.display}
          </a>
          <a className={s.goDark} href={c.maps} rel="noopener" target="_blank" data-press>
            Directions
          </a>
        </div>
        <div className={s.small}>
          <p>{c.credit}</p>
          <p>
            Demo made from their Google profile. Not an official site. Demo by{' '}
            <a href={SENDER_SITE} target="_blank" rel="noopener">
              {SENDER}
            </a>
            .
          </p>
        </div>
      </footer>

      <nav className={s.bar} aria-label="Call or get directions">
        <a href={c.phone.tel} className={s.barCall} data-press>
          CALL
        </a>
        <a href={c.maps} className={s.barGo} rel="noopener" target="_blank" data-press>
          DIRECTIONS
        </a>
      </nav>
      <Cover />
    </div>
  );
}

export const letterboard: Design = { Demo, fonts: ['oswald-latin-wght-normal', 'space-mono-latin-400-normal'], heroSizes: '(min-width: 900px) 44vw, 100vw' };
