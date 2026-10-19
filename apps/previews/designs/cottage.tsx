import type { CSSProperties } from 'react';
import { CottageWalk } from '@/components/CottageWalk';
import { Pic } from '@/components/Pic';
import { Cover } from '@/components/os/Cover';
import { Now } from '@/components/os/Now';
import { span, type Day } from '@/components/os/hours';
import { pic, type PageData } from '@/lib/data';
import { SENDER, SENDER_SITE } from '@/lib/offer';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Content {
  name: string;
  line: string;
  lineSource: string;
  street: string;
  address: string[];
  phone: { tel: string; display: string };
  maps: string;
  hours: Day[];
  offers: string[];
  offersSource: string;
  walk: { key: string; label: string }[];
  credit: string;
}

/**
 * Biz On Fletcher, Fletcher Avenue. The cottage first, seen through window panes; then the walk in,
 * from their lettered door glass to the floor at night to the chair; what Google says they offer; the
 * uneven week on an appointment card with today circled; and the address to close.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('cottage', ['Marcellus', 'Alegreya']);
  const c = data.demo as Content;
  const steps = c.walk.map((w) => ({ ...w, pic: pic(data, w.key) }));

  return (
    <div className={s.root}>
      <style href="cottage" precedence="design">
        {css}
      </style>

      <section className={s.hero} data-hero aria-labelledby="hero-h">
        <div className={s.photo}>
          <Pic pic={pic(data, 'hero')} sizes="(min-width: 900px) 58vw, 100vw" first />
          <i className={s.paneV} aria-hidden="true" />
          <i className={s.paneH} aria-hidden="true" />
        </div>
        <div className={s.say}>
          <p className={s.street}>{c.street}, Indianapolis</p>
          <h1 id="hero-h" className={s.title}>
            {c.name}
          </h1>
          <p className={s.line}>
            <span>{c.line}</span>
            <small>{c.lineSource}</small>
          </p>
          <p className={s.now}>
            <Now week={c.hours} fallback="Open five days a week" />
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
        <section className={s.walkSec} aria-labelledby="walk-h">
          <h2 id="walk-h" className={s.walkHead}>
            Walk in
          </h2>
          <CottageWalk steps={steps} s={{ walk: s.walk!, walkPin: s.walkPin!, walkFrame: s.walkFrame!, walkStep: s.walkStep!, walkDots: s.walkDots!, walkMark: s.walkMark! }} />
        </section>

        <section className={s.offers} aria-labelledby="offers-h">
          <h2 id="offers-h" className={s.offersLabel}>
            Under one roof
          </h2>
          <ul className={s.offerList}>
            {c.offers.map((o, i) => (
              <li key={o} style={{ '--i': i } as CSSProperties} data-reveal>
                {o}
              </li>
            ))}
          </ul>
          <p className={s.offersSource}>{c.offersSource}</p>
        </section>

        <section className={s.card} id="week" aria-labelledby="week-h" data-covers>
          <div className={s.cardInner}>
            <h2 id="week-h" className={s.cardTitle}>
              Appointment card
            </h2>
            <p className={s.cardNow}>
              <Now week={c.hours} fallback="Open five days a week" scope="#week" />
            </p>
            <ol className={s.cardDays}>
              {c.hours.map((d, i) => (
                <li key={d.day} data-day={i} data-closed={d.open ? undefined : ''}>
                  <span>{d.day}</span>
                  <i aria-hidden="true" />
                  <span>{span(d)}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className={s.end} data-covers>
        <p className={s.endName}>{c.name}</p>
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

      <a className={s.bar} href={c.phone.tel} aria-label={`Call ${c.name}`} data-press>
        Call
      </a>
      <Cover />
    </div>
  );
}

export const cottage: Design = { Demo, fonts: ['marcellus-latin-400-normal', 'alegreya-latin-wght-normal'], heroSizes: '(min-width: 900px) 58vw, 100vw' };
