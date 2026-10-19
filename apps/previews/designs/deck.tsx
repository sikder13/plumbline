import { CardDeck } from '@/components/CardDeck';
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
  nameRest: string;
  nameFull: string;
  street: string;
  address: string[];
  phone: { tel: string; display: string };
  maps: string;
  hours: Day[];
  deck: string[];
  credit: string;
}

/**
 * Roatan Barbershop & Salon, South Keystone Avenue. The name over a band of their own three colours with
 * their shirts as a tilted card on it, and their week beside the call; a deck of their cuts to flick
 * through; and the dot of their barber capes, with the address on it, to close.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('deck', ['Rozha One', 'Outfit']);
  const c = data.demo as Content;
  const weekday = c.hours[0]!;
  const sunday = c.hours[6]!;

  return (
    <div className={s.root}>
      <style href="deck" precedence="design">
        {css}
      </style>

      <section className={s.hero} data-hero aria-labelledby="hero-h">
        <h1 id="hero-h" className={s.title} aria-label={c.nameFull}>
          <span aria-hidden="true">{c.name}</span>
          <small aria-hidden="true">{c.nameRest}</small>
        </h1>
        <div className={s.stage}>
          <div className={s.fields} aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div className={s.card}>
            <Pic pic={pic(data, 'hero')} sizes="(min-width: 900px) 34vw, 78vw" first />
          </div>
        </div>
        <div className={s.say}>
          <div className={s.where}>
            <p className={s.now}>
              <Now week={c.hours} fallback="Open every day" />
            </p>
            <p className={s.street}>{c.street}</p>
          </div>
          <p className={s.days}>
            <span>
              <b>Monday to Saturday</b> {clock(weekday.open!)} to {clock(weekday.close!)}
            </span>
            <span>
              <b>Sunday</b> {clock(sunday.open!)} to {clock(sunday.close!)}
            </span>
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
        <section className={s.cuts} aria-labelledby="cuts-h">
          <h2 id="cuts-h" className={s.cutsHead}>
            Fresh cuts
          </h2>
          <CardDeck cards={c.deck.map((k) => pic(data, k))} s={{ deck: s.deck!, stack: s.stack!, card: s.dcard!, deckRow: s.deckRow!, deckCount: s.deckCount!, deckNext: s.deckNext! }} />
        </section>

      </main>

      <footer className={s.end} data-covers>
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
          <a className={s.goLight} href={c.maps} rel="noopener" target="_blank" data-press>
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

export const deck: Design = { Demo, fonts: ['rozha-one-latin-400-normal', 'outfit-latin-wght-normal'], heroSizes: '(min-width: 900px) 34vw, 78vw' };
