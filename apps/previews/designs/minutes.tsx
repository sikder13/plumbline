import type { CSSProperties } from 'react';
import { Minutes, type Place } from '@/components/Minutes';
import { Pic } from '@/components/Pic';
import { Cover } from '@/components/os/Cover';
import { pic, type PageData } from '@/lib/data';
import { SENDER, SENDER_SITE, demoNote } from '@/lib/offer';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Content {
  town: string;
  phone: { tel: string; display: string };
  free: { tel: string; display: string };
  email: string;
  book: string;
  address: string[];
  headline: string[];
  lede: string;
  places: Place[];
  rooms: { name: string; max: number; text: string }[];
  services: string[];
}

/**
 * Central Park Motor Lodge, Riccarton. "2 minutes walk to Hagley Park", their first line, beside their
 * own sign on Riccarton Road. The signature is that line made into a scale: every place their homepage
 * lists, on foot or by car, in the minutes it gives. Book goes to their own SiteMinder page.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('minutes', ['Gloock', 'Schibsted Grotesk']);
  const c = data.demo as Content;
  return (
    <div className={s.root}>
      <style href="minutes" precedence="design">
        {css}
      </style>

      <header className={s.top}>
        <p className={s.brand}>
          Central Park <span>Motor Lodge</span>
        </p>
        <a className={s.topCall} href={c.phone.tel} data-press>
          Call {c.phone.display}
        </a>
      </header>

      <section className={s.hero} data-hero aria-labelledby="hero-h">
        <div className={s.heroWords}>
          <p className={s.where}>{c.town}</p>
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
              Book now
            </a>
            <a className={s.secondary} href={c.free.tel} data-press>
              Free phone {c.free.display}
            </a>
          </div>
        </div>
        <figure className={s.sign}>
          <Pic pic={pic(data, 'hero')} sizes="(min-width: 960px) 44vw, 100vw" first />
        </figure>
      </section>

      <main>
        <section className={s.near} aria-labelledby="near-h">
          <h2 id="near-h" className={s.h2}>
            Everything close
          </h2>
          <p className={s.body}>In minutes, as we give them.</p>
          <Minutes places={c.places} s={s} />
        </section>

        <section className={s.rooms} aria-labelledby="rooms-h">
          <h2 id="rooms-h" className={s.h2}>
            Our rooms
          </h2>
          <ul className={s.roomList}>
            {c.rooms.map((r) => (
              <li key={r.name} className={s.room} data-reveal>
                <span className={s.roomMax}>
                  Max <strong>{r.max}</strong>
                </span>
                <h3 className={s.roomName}>{r.name}</h3>
                <p className={s.roomText}>{r.text}</p>
                <a className={s.roomBook} href={c.book} aria-label={`Book the ${r.name}`} data-press>
                  Book now
                </a>
              </li>
            ))}
          </ul>
          <div className={s.photos}>
            {(['bed', 'suite', 'studio'] as const).map((k) => (
              <figure key={k} className={s[`p_${k}`]} data-reveal>
                <Pic pic={pic(data, k)} sizes="(min-width: 960px) 33vw, 100vw" />
              </figure>
            ))}
          </div>
        </section>

        <section className={s.services} aria-labelledby="services-h">
          <h2 id="services-h" className={s.h2}>
            Service
          </h2>
          <ul className={s.serviceList}>
            {c.services.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>

        <section className={s.book} id="book" data-covers aria-labelledby="book-h">
          <h2 id="book-h" className={s.h2}>
            Book your room
          </h2>
          <div className={s.ways}>
            <a className={s.primary} href={c.book} data-press>
              Book now
            </a>
            <a className={s.way} href={c.free.tel} data-press>
              Free phone {c.free.display}
            </a>
            <a className={s.way} href={c.phone.tel} data-press>
              Call {c.phone.display}
            </a>
            <a className={s.way} href={`mailto:${c.email}`} data-press>
              {c.email}
            </a>
          </div>
        </section>
      </main>

      <footer className={s.foot} data-covers>
        <p className={s.footName}>Central Park Motor Lodge</p>
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
          Book now
        </a>
        <a href={c.phone.tel} className={s.barCall} data-press>
          Call
        </a>
      </nav>
      <Cover />
    </div>
  );
}

export const minutes: Design = { Demo, fonts: ['gloock-latin-400-normal', 'schibsted-grotesk-latin-wght-normal'], heroSizes: '(min-width: 960px) 44vw, 100vw' };
