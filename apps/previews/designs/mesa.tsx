import type { CSSProperties } from 'react';
import { Pic } from '@/components/Pic';
import { Cover } from '@/components/os/Cover';
import { Now } from '@/components/os/Now';
import { OnView } from '@/components/os/OnView';
import { clock, type Day } from '@/components/os/hours';
import { pic, type PageData } from '@/lib/data';
import { SENDER, SENDER_SITE } from '@/lib/offer';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Content {
  name: string;
  nameRest: string;
  nameFull: string;
  street: string;
  address: string[];
  phone: { tel: string; display: string };
  maps: string;
  hours: Day[];
  table: string[];
  credit: string;
}

/** Where each plate lands on the table and the edge it comes from: x, y in percent, a turn, and the side. */
const SPOTS = [
  { x: 4, y: 6, r: -5, from: 'left' },
  { x: 38, y: 2, r: 3, from: 'top' },
  { x: 70, y: 8, r: -2, from: 'right' },
  { x: 8, y: 52, r: 4, from: 'left' },
  { x: 40, y: 48, r: -3, from: 'bottom' },
  { x: 70, y: 54, r: 5, from: 'right' },
];

/**
 * El Tajin Taquería & Birriería, East Washington Street. Their spread full bleed under the name; then
 * one table, six of their plates set down on it from its edges; seven days in two lines; and their
 * yellow street sign, set in type, to close.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('mesa', ['Bricolage Grotesque', 'Fraunces']);
  const c = data.demo as Content;
  const usual = c.hours[0]!;
  const odd = c.hours.filter((d) => d.open !== usual.open || d.close !== usual.close);

  return (
    <div className={s.root}>
      <style href="mesa" precedence="design">
        {css}
      </style>

      <section className={s.hero} data-hero aria-labelledby="hero-h">
        <div className={s.photo}>
          <Pic pic={pic(data, 'hero')} sizes="100vw" first />
        </div>
        <div className={s.say}>
          <h1 id="hero-h" className={s.title} aria-label={c.nameFull}>
            <span className={s.titleBig} aria-hidden="true">
              {c.name}
            </span>
            <span className={s.titleRest} aria-hidden="true">
              {c.nameRest}
            </span>
          </h1>
          <p className={s.street}>{c.street}</p>
          <p className={s.now}>
            <Now week={c.hours} fallback="Open seven days a week" />
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
        <section className={s.tableSec} aria-labelledby="table-h">
          <h2 id="table-h" className={s.tableHead}>
            On the table
          </h2>
          <OnView className={s.table} threshold={0.25}>
            {c.table.map((k, i) => {
              const spot = SPOTS[i % SPOTS.length]!;
              return (
                <figure key={k} className={s.plate} data-from={spot.from} style={{ '--x': `${spot.x}%`, '--y': `${spot.y}%`, '--r': `${spot.r}deg`, '--i': i } as CSSProperties}>
                  <Pic pic={pic(data, k)} sizes="(min-width: 900px) 26vw, 46vw" low />
                </figure>
              );
            })}
          </OnView>
        </section>

        <section className={s.week} aria-labelledby="week-h">
          <h2 id="week-h" className={s.weekLine}>
            Every day <span>{clock(usual.open!)} to {clock(usual.close!)}</span>
          </h2>
          {odd.map((d) => (
            <p key={d.day} className={s.weekOdd}>
              {d.day} from {clock(d.open!)}
            </p>
          ))}
          <p className={s.weekNow}>
            <Now week={c.hours} fallback="Open seven days a week" />
          </p>
        </section>
      </main>

      <footer className={s.end} data-covers>
        <div className={s.sign}>
          <p className={s.signName}>{c.nameFull}</p>
          <a className={s.signTel} href={c.phone.tel} aria-label={`Call ${c.phone.display}`} data-press>
            {c.phone.display}
          </a>
        </div>
        <address className={s.endAddr}>
          {c.address.join(', ')}
        </address>
        <a className={s.endGo} href={c.maps} rel="noopener" target="_blank">
          Directions on Google Maps
        </a>
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
          Call {c.phone.display}
        </a>
        <a href={c.maps} className={s.barGo} rel="noopener" target="_blank" data-press>
          Map
        </a>
      </nav>
      <Cover />
    </div>
  );
}

export const mesa: Design = { Demo, fonts: ['bricolage-grotesque-latin-wght-normal', 'fraunces-latin-wght-normal'], heroSizes: '100vw' };
