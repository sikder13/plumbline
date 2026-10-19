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
  bays: { key: string; label: string }[];
  credit: string;
}

const SLATS = 8;

/** A roll-up door over a photo: eight slats that lift one after another. */
function Door({ s }: { s: Record<string, string> }) {
  return (
    <div className={s.door} aria-hidden="true">
      {Array.from({ length: SLATS }, (_, i) => (
        <i key={i} style={{ '--i': SLATS - 1 - i } as CSSProperties} />
      ))}
    </div>
  );
}

/**
 * TURBO TIRE SHOP, Lafayette Road. Their blue building behind a roll-up door that lifts as the page
 * opens; three bays, each behind a door that lifts as it arrives; six days in one line; and a closed
 * door with the address painted on it to close.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('bay', ['Syne', 'Familjen Grotesk']);
  const c = data.demo as Content;
  const open = c.hours.filter((d) => d.open);
  const closed = c.hours.filter((d) => !d.open);

  return (
    <div className={s.root}>
      <style href="bay" precedence="design">
        {css}
      </style>

      <section className={s.hero} data-hero aria-labelledby="hero-h">
        <div className={s.photo}>
          <Pic pic={pic(data, 'hero')} sizes="100vw" first />
          <div className={s.heroDoor} aria-hidden="true">
            {Array.from({ length: SLATS }, (_, i) => (
              <i key={i} style={{ '--i': SLATS - 1 - i } as CSSProperties} />
            ))}
          </div>
        </div>
        <div className={s.say}>
          <h1 id="hero-h" className={s.title} aria-label={c.nameFull}>
            <span aria-hidden="true">{c.name}</span>
            <span aria-hidden="true">{c.nameRest}</span>
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
        <section className={s.baysSec} aria-labelledby="bays-h">
          <h2 id="bays-h" className={s.baysHead}>
            Open the doors
          </h2>
          <ol className={s.bays}>
            {c.bays.map((b, i) => (
              <li key={b.key}>
                <OnView className={s.bay} threshold={0.5}>
                  <Pic pic={pic(data, b.key)} sizes="(min-width: 900px) 30vw, 100vw" low />
                  <Door s={s} />
                </OnView>
                <p className={s.bayLabel}>
                  <b>{String(i + 1).padStart(2, '0')}</b> {b.label}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className={s.week} aria-labelledby="week-h">
          <h2 id="week-h" className={s.weekLine}>
            {open[0]!.day} to {open.at(-1)!.day}
          </h2>
          <p className={s.weekTime}>
            {clock(open[0]!.open!)} to {clock(open[0]!.close!)}
          </p>
          <p className={s.weekClosed}>Closed {closed.map((d) => d.day).join(' and ')}.</p>
          <p className={s.weekNow}>
            <Now week={c.hours} fallback="Open Monday to Saturday" />
          </p>
        </section>
      </main>

      <footer className={s.end} data-covers>
        <div className={s.shut}>
          <p className={s.shutName}>{c.nameFull}</p>
          <address className={s.shutAddr}>
            {c.address.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </address>
          <a className={s.shutTel} href={c.phone.tel} data-press>
            {c.phone.display}
          </a>
        </div>
        <div className={s.endActs}>
          <a className={s.call} href={c.phone.tel} data-press>
            Call {c.phone.display}
          </a>
          <a className={s.go} href={c.maps} rel="noopener" target="_blank" data-press>
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
          Call
        </a>
        <a href={c.maps} className={s.barGo} rel="noopener" target="_blank" data-press>
          Map
        </a>
      </nav>
      <Cover />
    </div>
  );
}

export const bay: Design = { Demo, fonts: ['syne-latin-wght-normal', 'familjen-grotesk-latin-wght-normal'], heroSizes: '100vw' };
