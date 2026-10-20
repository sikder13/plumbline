import type { CSSProperties } from 'react';
import { NzNow, type NzDay } from '@/components/NzNow';
import { Cover } from '@/components/os/Cover';
import type { PageData } from '@/lib/data';
import { SENDER, SENDER_SITE, demoNote } from '@/lib/offer';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Content {
  town: string;
  phone: { tel: string; display: string };
  email: string;
  address: string[];
  maps: string;
  headline: string[];
  since: string;
  lede: string;
  facts: string[];
  services: string[];
  week: NzDay[];
  hoursText: { day: string; time: string }[];
}

/**
 * Henderson Valley Tyre Centre, West Auckland. A tyre shop people ring or drive into, so the page is a
 * sign: their own line set big on asphalt, the shop's open state live from their own hours, their
 * services, and the number to tap, everywhere.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('tread', ['Epilogue', 'Space Mono']);
  const c = data.demo as Content;
  return (
    <div className={s.root}>
      <style href="tread" precedence="design">
        {css}
      </style>

      <header className={s.top}>
        <p className={s.brand}>HV Tyres</p>
        <a className={s.topCall} href={c.phone.tel} data-press>
          Call now
        </a>
      </header>

      <section className={s.hero} data-hero aria-labelledby="hero-h">
        <p className={s.now}>
          <NzNow week={c.week} fallback="Mon to Fri 8am to 5pm, Sat 8am to 12pm" className={s.nowLine} />
        </p>
        <h1 id="hero-h" className={s.head}>
          {c.headline.map((l, i) => (
            <span key={l} className={s.line} style={{ '--i': i } as CSSProperties}>
              <span>{l}</span>
            </span>
          ))}
        </h1>
        <p className={s.since}>{c.since}</p>
        <p className={s.lede}>{c.lede}</p>
        <div className={s.acts} data-covers>
          <a className={s.call} href={c.phone.tel} data-press>
            <span className={s.callLabel}>Call</span>
            <span className={s.callNo}>{c.phone.display}</span>
          </a>
          <a className={s.go} href={c.maps} target="_blank" rel="noopener" data-press>
            Directions
          </a>
        </div>
        <ul className={s.facts}>
          {c.facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </section>

      <main>
        <section className={s.services} aria-labelledby="services-h">
          <h2 id="services-h" className={s.h2}>
            Our services
          </h2>
          <ol className={s.serviceList}>
            {c.services.map((x, i) => (
              <li key={x} data-reveal>
                <span className={s.serviceNo}>{String(i + 1).padStart(2, '0')}</span>
                {x}
              </li>
            ))}
          </ol>
        </section>

        <section className={s.visit} id="book" data-covers aria-labelledby="visit-h">
          <div>
            <h2 id="visit-h" className={s.h2}>
              Drive in or call ahead
            </h2>
            <address className={s.addr}>
              {c.address.map((l) => (
                <span key={l}>{l} </span>
              ))}
            </address>
            <div className={s.visitActs}>
              <a className={s.call} href={c.phone.tel} data-press>
                <span className={s.callLabel}>Call</span>
                <span className={s.callNo}>{c.phone.display}</span>
              </a>
              <a className={s.go} href={`mailto:${c.email}`} data-press>
                Email us
              </a>
            </div>
          </div>
          <dl className={s.hours}>
            {c.hoursText.map((h) => (
              <div key={h.day}>
                <dt>{h.day}</dt>
                <dd>{h.time}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <footer className={s.foot} data-covers>
        <p className={s.footName}>Henderson Valley Tyre Centre</p>
        <p className={s.footLinks}>
          <a href={c.phone.tel}>{c.phone.display}</a>
          <a href={`mailto:${c.email}`}>{c.email}</a>
        </p>
        <p className={s.small}>
          Family owned business. {demoNote(data.domain)} Demo by{' '}
          <a href={SENDER_SITE} target="_blank" rel="noopener">
            {SENDER}
          </a>
          .
        </p>
      </footer>

      <nav className={s.bar} aria-label="Call">
        <a href={c.phone.tel} className={s.barCall} data-press>
          Call {c.phone.display}
        </a>
      </nav>
      <Cover />
    </div>
  );
}

export const tread: Design = { Demo, fonts: ['epilogue-latin-wght-normal', 'space-mono-latin-400-normal'], heroSizes: '100vw' };
