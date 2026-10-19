import type { CSSProperties } from 'react';
import { NeonOpen } from '@/components/NeonOpen';
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
  word: string;
  nameFull: string;
  street: string;
  address: string[];
  phone: { tel: string; display: string };
  maps: string;
  hours: Day[];
  tiers: { key: string; label: string }[];
  credit: string;
}

/**
 * Alexiva bakery, North Mitthoefer Road. Their sign's word glowing over the night above a shop window of
 * their pastries; three cakes stacking into tiers; their case as one long band; and a neon OPEN sign,
 * lit only while they are open, over the week to close.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('tier', ['Yeseva One', 'Sora']);
  const c = data.demo as Content;
  const weekday = c.hours[0]!;
  const sunday = c.hours[6]!;

  return (
    <div className={s.root}>
      <style href="tier" precedence="design">
        {css}
      </style>

      <section className={s.hero} data-hero aria-labelledby="hero-h">
        <h1 id="hero-h" className={s.title} aria-label={c.nameFull}>
          <span className={s.titleName} aria-hidden="true">
            {c.name}
          </span>
          <span className={s.titleWord} aria-hidden="true">
            {c.word}
          </span>
        </h1>
        <div className={s.photo}>
          <Pic pic={pic(data, 'hero')} sizes="(min-width: 900px) 30vw, 72vw" first />
        </div>
        <div className={s.say}>
          <p className={s.street}>{c.street}</p>
          <p className={s.now}>
            <Now week={c.hours} fallback="Open every day" />
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
        <section className={s.cakes} aria-labelledby="cakes-h">
          <h2 id="cakes-h" className={s.cakesHead}>
            Cakes
          </h2>
          <ol className={s.tiers}>
            {c.tiers.map((t, i) => (
              <li key={t.key} className={s.tierItem} style={{ '--i': i } as CSSProperties}>
                <figure>
                  <Pic pic={pic(data, t.key)} sizes="(min-width: 900px) 46vw, 88vw" low />
                  <figcaption>
                    <b>{String(i + 1).padStart(2, '0')}</b> {t.label}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ol>
        </section>

        <section className={s.counter} aria-label="The counter">
          <figure className={s.band} data-reveal>
            <Pic pic={pic(data, 'case')} sizes="100vw" low />
          </figure>
          <figure className={s.tray} data-reveal>
            <Pic pic={pic(data, 'tray')} sizes="(min-width: 900px) 30vw, 60vw" low />
          </figure>
        </section>
      </main>

      <footer className={s.end} data-covers>
        <div className={s.endNight}>
          <NeonOpen week={c.hours} s={{ neonWrap: s.neonWrap!, neon: s.neon!, neonLine: s.neonLine! }} />
          <h2 className={s.hoursHead}>
            <span>Monday to Saturday</span> {clock(weekday.open!)} to {clock(weekday.close!)}
          </h2>
          <p className={s.hoursSun}>
            <span>Sunday</span> {clock(sunday.open!)} to {clock(sunday.close!)}
          </p>
        </div>
        <div className={s.endFind}>
          <p className={s.endName}>{c.nameFull}</p>
          <address className={s.endAddr}>
            {c.address.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </address>
          <div className={s.endActs}>
            <a className={s.call} href={c.phone.tel} data-press>
              Call {c.phone.display}
            </a>
            <a className={s.go} href={c.maps} rel="noopener" target="_blank" data-press>
              Directions
            </a>
          </div>
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
        Call
      </a>
      <Cover />
    </div>
  );
}

export const tier: Design = { Demo, fonts: ['yeseva-one-latin-400-normal', 'sora-latin-wght-normal'], heroSizes: '(min-width: 900px) 30vw, 72vw' };
