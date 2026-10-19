import { Pic } from '@/components/Pic';
import { TicketStamp } from '@/components/TicketStamp';
import { Cover } from '@/components/os/Cover';
import { span, type Day } from '@/components/os/hours';
import { pic, type PageData } from '@/lib/data';
import { SENDER, SENDER_SITE } from '@/lib/offer';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Content {
  name: string;
  work: string;
  workSource: string;
  manta: string;
  mantaSource: string;
  kinds: string[];
  street: string;
  address: string[];
  phone: { tel: string; display: string };
  maps: string;
  hours: Day[];
  credit: string;
}

/** Monday to Thursday, 9 AM to 6 PM: days with the same hours run together. */
function runs(week: Day[]): { days: string; hours: string }[] {
  const out: { days: string; hours: string; first: string; last: string }[] = [];
  for (const d of week) {
    const h = span(d);
    const prev = out.at(-1);
    if (prev && prev.hours === h) {
      prev.last = d.day;
      prev.days = `${prev.first} to ${d.day}`;
    } else out.push({ days: d.day, hours: h, first: d.day, last: d.day });
  }
  return out.map(({ days, hours }) => ({ days, hours }));
}

/**
 * South Indy Auto Repair, Lake Road. Their red building in its field beside a work order whose every
 * line is one of their facts, stamped with whether they are open now; their own words about every kind
 * of car; three photos of the shop; and the shop across its field to close.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('ticket', ['Roboto Slab', 'Martian Mono']);
  const c = data.demo as Content;

  return (
    <div className={s.root}>
      <style href="ticket" precedence="design">
        {css}
      </style>

      <section className={s.hero} data-hero aria-labelledby="hero-h">
        <div className={s.photo}>
          <Pic pic={pic(data, 'hero')} sizes="(min-width: 900px) 46vw, 100vw" first />
        </div>
        <div className={s.side}>
          <p className={s.street}>{c.street}</p>
          <h1 id="hero-h" className={s.title}>
            {c.work}
          </h1>
          <p className={s.source}>{c.workSource}</p>
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
        <section className={s.orderSec} aria-labelledby="order-h">
          <article className={s.order}>
            <header className={s.orderHead}>
              <h2 id="order-h">Work order</h2>
              <TicketStamp week={c.hours} s={{ stampWrap: s.stampWrap!, stamp: s.stamp!, stampLine: s.stampLine! }} />
            </header>
            <dl className={s.fields}>
              <div>
                <dt>Shop</dt>
                <dd>{c.name}</dd>
              </div>
              <div>
                <dt>Work</dt>
                <dd>{c.work}</dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>
                  {c.address.map((l) => (
                    <span key={l}>{l}</span>
                  ))}
                </dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>
                  <a href={c.phone.tel}>{c.phone.display}</a>
                </dd>
              </div>
              <div>
                <dt>Hours</dt>
                <dd>
                  {runs(c.hours).map((r) => (
                    <span key={r.days} className={s.run}>
                      <b>{r.days}</b> {r.hours}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
          </article>
        </section>

        <section className={s.kindsSec} aria-labelledby="kinds-h">
          <h2 id="kinds-h" className={s.kindsQuote}>
            {c.manta}
          </h2>
          <p className={s.kindsSource}>{c.mantaSource}</p>
          <ul className={s.kinds} aria-hidden="true">
            {c.kinds.map((k) => (
              <li key={k} data-reveal>
                {k}
              </li>
            ))}
          </ul>
        </section>

        <section className={s.shop} aria-label="The shop">
          <figure className={s.shopBig} data-reveal>
            <Pic pic={pic(data, 'near')} sizes="(min-width: 900px) 50vw, 100vw" low />
          </figure>
          <figure className={s.shopSmall} data-reveal>
            <Pic pic={pic(data, 'bay')} sizes="(min-width: 900px) 25vw, 50vw" low />
          </figure>
          <figure className={s.shopSmall} data-reveal>
            <Pic pic={pic(data, 'engine')} sizes="(min-width: 900px) 25vw, 50vw" low />
          </figure>
        </section>
      </main>

      <footer className={s.end} data-covers aria-label="Find the shop">
        <div className={s.endPhoto}>
          <Pic pic={pic(data, 'field')} sizes="100vw" low />
        </div>
        <div className={s.endCard}>
          <p className={s.endLabel}>{c.name}</p>
          <address className={s.endAddr}>
            {c.address.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </address>
          <div className={s.endActs}>
            <a className={s.call} href={c.phone.tel} data-press>
              Call {c.phone.display}
            </a>
            <a className={s.endGo} href={c.maps} rel="noopener" target="_blank" data-press>
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
        <b>Call</b>
        <span>{c.phone.display}</span>
      </a>
      <Cover />
    </div>
  );
}

export const ticket: Design = { Demo, fonts: ['roboto-slab-latin-wght-normal', 'martian-mono-latin-wght-normal'], heroSizes: '(min-width: 900px) 46vw, 100vw' };
