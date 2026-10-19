import { PlateWheel } from '@/components/PlateWheel';
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
  nameFull: string;
  kind: string;
  kindSource: string;
  street: string;
  address: string[];
  phone: { tel: string; display: string };
  maps: string;
  hours: Day[];
  plates: string[];
  credit: string;
}

/**
 * MISS FOOD Restaurant, Georgetown Road. One of their plates as a great round plate on their olive
 * wall; then the turning table of four more; their dining room; the week in one line; and a round card,
 * the size of a plate, to close.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('plate', ['Young Serif', 'Instrument Sans']);
  const c = data.demo as Content;
  const open = c.hours.filter((d) => d.open);
  const first = open[0]!;

  return (
    <div className={s.root}>
      <style href="plate" precedence="design">
        {css}
      </style>

      <section className={s.hero} data-hero aria-labelledby="hero-h">
        <div className={s.round}>
          <Pic pic={pic(data, 'hero')} sizes="(min-width: 900px) 46vw, 92vw" first />
        </div>
        <div className={s.say}>
          <p className={s.kind}>
            {c.kind} <span>{c.kindSource}</span>
          </p>
          <h1 id="hero-h" className={s.title} aria-label={c.nameFull}>
            <span aria-hidden="true">{c.name}</span>
          </h1>
          <p className={s.street}>{c.street}</p>
          <p className={s.now}>
            <Now week={c.hours} fallback="Open Monday to Saturday" />
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
        <section className={s.plates} aria-labelledby="plates-h">
          <h2 id="plates-h" className={s.platesHead}>
            From the kitchen
          </h2>
          <PlateWheel plates={c.plates.map((k) => pic(data, k))} s={{ wheel: s.wheel!, table: s.table!, plateSpot: s.plateSpot!, turns: s.turns!, count: s.count! }} />
        </section>

        <section className={s.room} aria-label="The dining room">
          <figure className={s.roomPhoto} data-reveal>
            <Pic pic={pic(data, 'room')} sizes="(min-width: 900px) 40vw, 100vw" low />
          </figure>
          <div className={s.roomText}>
            <h2 className={s.weekLine}>
              {first.day} to {open.at(-1)!.day}
              <span>
                {clock(first.open!)} to {clock(first.close!)}
              </span>
            </h2>
            <p className={s.weekNote}>Closed {c.hours.filter((d) => !d.open).map((d) => d.day).join(' and ')}.</p>
            <p className={s.weekNow}>
              <Now week={c.hours} fallback="Open Monday to Saturday" />
            </p>
          </div>
        </section>
      </main>

      <footer className={s.end} data-covers>
        <div className={s.endPlate}>
          <p className={s.endName}>{c.nameFull}</p>
          <address className={s.endAddr}>
            {c.address.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </address>
          <a className={s.endTel} href={c.phone.tel} data-press>
            {c.phone.display}
          </a>
          <a className={s.endGo} href={c.maps} rel="noopener" target="_blank">
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

      <a className={s.bar} href={c.phone.tel} data-press>
        Call {c.name}
      </a>
      <Cover />
    </div>
  );
}

export const plate: Design = { Demo, fonts: ['young-serif-latin-400-normal', 'instrument-sans-latin-wght-normal'], heroSizes: '(min-width: 900px) 46vw, 92vw' };
