import type { CSSProperties } from 'react';
import { ApertureDay, type DayTour } from '@/components/ApertureDay';
import { ApertureFill } from '@/components/ApertureFill';
import { ApertureOpen } from '@/components/ApertureOpen';
import { DemoFoot } from '@/components/DemoFoot';
import { Pic } from '@/components/Pic';
import { StickyBar } from '@/components/StickyBar';
import { pic, type PageData } from '@/lib/data';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Link {
  label: string;
  href: string;
}

interface Content {
  wordmark: string;
  est: string;
  nav: Link[];
  book: { label: string; href: string; from: string; price: string; float: string };
  call: { label: string; tel: string; display: string };
  freephone: { label: string; tel: string; display: string };
  email: string;
  hero: {
    heading: string;
    tour: string;
    hours: string;
    leaves: string;
    back: string;
    dep: string;
    ret: string;
    start: number;
    end: number;
    promise: string;
    tags: string[];
    bookLabel: string;
    price: string;
  };
  day: {
    label: string;
    start: number;
    end: number;
    axis: [string, string];
    leaves: string;
    back: string;
    backShort: string;
    book: string;
    note: string;
    small: string;
    tours: (Omit<DayTour, 'picture'> & { image: string })[];
  };
  wildlife: { label: string; heading: string; lead: string; beliefLabel: string; statement: string; count: string; unit: string; text: string; creds: string[] };
  guests: { kicker: string; quote: string; who: string; title: string; ratingLabel: string; ratingUnit: string; ratingSource: string; facts: string[] };
  end: {
    label: string;
    heading: string;
    line: string;
    bookNote: string;
    private: { label: string; title: string; text: string; subject: string; body: string };
    reply: string;
    callLabel: string;
    hours: string;
    address: string;
    signoff: string;
  };
}

/** The scoped names of the classes a client component is handed. */
function take<K extends string>(s: Record<string, string>, ...keys: K[]): Record<K, string> {
  return Object.fromEntries(keys.map((k) => [k, s[k]!])) as Record<K, string>;
}

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * A cruise passenger's day ashore, drawn as a window of time. The first screen is one day across a
 * faint photograph with only the hours of their most popular tour lit, its times at the window's
 * edges; the tours then stand as bars on one pinned timeline; the wildlife and the reason they look
 * after it get whole frames; and the page closes on two ways in.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('aperture', ['Plus Jakarta Sans', 'Crimson Pro']);
  const c = data.demo as Content;
  const book = { href: c.book.href, rel: 'noopener' };
  const mail = `mailto:${c.email}`;
  const privateMail = `${mail}?subject=${encodeURIComponent(c.end.private.subject)}&body=${encodeURIComponent(c.end.private.body)}`;
  const span = c.day.end - c.day.start;
  const pct = (h: number) => (((h - c.day.start) / span) * 100).toFixed(3);
  const tours: DayTour[] = c.day.tours.map(({ image, ...t }) => ({ ...t, picture: <Pic pic={pic(data, image)} sizes="(min-width: 1024px) 46vw, 100vw" /> }));

  return (
    <div className={s.root}>
      <style href="aperture" precedence="design">
        {css}
      </style>

      <a className={s.side} data-press href={c.book.href} rel="noopener">
        <span>{c.book.label}</span>
        <b>
          {c.book.from} {c.book.price}
        </b>
      </a>

      <section className={s.hero} id="top" data-hero aria-labelledby="hero-h">
        <header className={s.top}>
          <a className={s.mark} href="#top">
            <i aria-hidden="true" />
            {c.wordmark}
          </a>
          <nav className={s.links} aria-label="Sections">
            {c.nav.map((n) => (
              <a key={n.href} href={n.href}>
                {n.label}
              </a>
            ))}
          </nav>
          <span className={s.est}>{c.est}</span>
        </header>

        <h1 id="hero-h" className={s.title}>
          <span className={s.line}>
            <span>{c.hero.heading}</span>
          </span>
        </h1>

        <div className={s.band} style={{ '--from': pct(c.hero.start), '--to': pct(c.hero.end) } as CSSProperties}>
          <div className={s.ghost}>
            <Pic pic={pic(data, 'hero')} phone={data.images.heroPhone} sizes="100vw" first />
          </div>
          <div className={s.lit} aria-hidden="true">
            <Pic pic={pic(data, 'hero')} phone={data.images.heroPhone} sizes="100vw" first alt="" />
          </div>
          <span className={s.edge} data-edge="from" aria-hidden="true" />
          <span className={s.edge} data-edge="to" aria-hidden="true" />
          <p className={s.stamp} data-edge="from">
            <span>{c.hero.leaves}</span> <b>{c.hero.dep}</b>
          </p>
          <p className={s.stamp} data-edge="to">
            <span>{c.hero.back}</span> <b>{c.hero.ret}</b>
          </p>
          <p className={s.ends} aria-hidden="true">
            <span>{c.day.axis[0]}</span>
            <span>{c.day.axis[1]}</span>
          </p>
        </div>

        <div className={s.heroFoot}>
          <p className={s.heroTour}>
            <b>{c.hero.tour}</b> <span>{c.hero.hours}</span>
          </p>
          <p className={s.promise}>{c.hero.promise}</p>
          <ul className={s.tags}>
            {c.hero.tags.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <a className={s.go} data-press data-magnetic {...book}>
            <span>{c.hero.bookLabel}</span>
            <b>{c.hero.price}</b>
          </a>
        </div>
      </section>

      <main>
        <section className={s.day} id="day" aria-labelledby="day-h">
          <ApertureDay
            heading={c.day.label}
            tours={tours}
            start={c.day.start}
            end={c.day.end}
            axis={c.day.axis}
            words={{ leaves: c.day.leaves, back: c.day.back, backShort: c.day.backShort, book: c.day.book }}
            cls={take(s, 'pin', 'head', 'label', 'rule', 'panels', 'panel', 'readout', 'tourName', 'tourMeta', 'tourPrices', 'book', 'photos', 'photo', 'timeline', 'bars', 'barRow', 'barName', 'barTrack', 'bar', 'rail', 'railMove', 'railLabel', 'axis')}
          />
          <p className={s.dayNote}>
            <span>{c.day.note}</span>
            <span>{c.day.small}</span>
          </p>
        </section>

        <section className={s.wildlife} id="wildlife" aria-labelledby="wild-h">
          <header className={s.head}>
            <p className={s.label}>{c.wildlife.label}</p>
            <span className={s.rule} aria-hidden="true" />
            <h2 id="wild-h">{c.wildlife.heading}</h2>
            <p className={s.headLead}>{c.wildlife.lead}</p>
          </header>
          <ApertureOpen className={s.bleed!}>
            <Pic pic={pic(data, 'sealion')} phone={data.images.sealionPhone} sizes="100vw" />
          </ApertureOpen>

          <div className={s.belief}>
            <p className={s.label}>{c.wildlife.beliefLabel}</p>
            <span className={s.rule} aria-hidden="true" />
            <p className={s.statement}>
              <ApertureFill text={c.wildlife.statement} cls={{ fill: s.fill!, word: s.word! }} />
            </p>
          </div>
          <ApertureOpen className={s.bleedBig!}>
            <Pic pic={pic(data, 'penguin')} phone={data.images.penguinPhone} sizes="100vw" />
          </ApertureOpen>
          <div className={s.payoff}>
            <p className={s.hundred}>
              <b>{c.wildlife.count}</b>
              <span>{c.wildlife.unit}</span>
            </p>
            <div className={s.payText}>
              <p>{c.wildlife.text}</p>
              <ul className={s.creds}>
                {c.wildlife.creds.map((cr) => (
                  <li key={cr}>{cr}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className={s.guests} aria-labelledby="guests-h">
          <header className={s.head}>
            <h2 id="guests-h" className={s.label}>
              {c.guests.kicker}
            </h2>
            <span className={s.rule} aria-hidden="true" />
          </header>
          <figure className={s.quote}>
            <blockquote>
              <ApertureFill text={c.guests.quote} cls={{ fill: s.fill!, word: s.word! }} />
            </blockquote>
            <figcaption>
              <b>{c.guests.who}</b>
              <span>{c.guests.title}</span>
            </figcaption>
          </figure>
          <ul className={s.proof}>
            {data.rating && (
              <li>
                <b>{data.rating.value}</b> {c.guests.ratingLabel} {String(data.rating.count)} {c.guests.ratingUnit}
                <small>{c.guests.ratingSource}</small>
              </li>
            )}
            {c.guests.facts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </section>

        <section className={s.end} id="contact" aria-labelledby="end-h">
          <header className={s.head}>
            <p className={s.label}>{c.end.label}</p>
            <span className={s.rule} aria-hidden="true" />
            <h2 id="end-h">{c.end.heading}</h2>
            <p className={s.headLead}>{c.end.line}</p>
          </header>
          <ApertureOpen className={s.endWindow!}>
            <Pic pic={pic(data, 'harbour')} sizes="(min-width: 1024px) 46vw, 100vw" />
          </ApertureOpen>
          <div className={s.doors}>
            <div className={s.door}>
              <a className={s.doorMain} data-press data-magnetic {...book}>
                <span>{c.book.label}</span>
                <b>
                  {c.book.from} {c.book.price}
                </b>
                <Arrow />
              </a>
              <p>{c.end.bookNote}</p>
            </div>
            <div className={s.door}>
              <a className={s.doorAlt} data-press href={privateMail}>
                <span>{c.end.private.label}</span>
                <Arrow />
              </a>
              <p>
                <b>{c.end.private.title}.</b> {c.end.private.text}
              </p>
            </div>
          </div>
          <div className={s.reach}>
            <p className={s.reply}>{c.end.reply}</p>
            <p className={s.lines}>
              <a href={c.call.tel}>
                <span>{c.end.callLabel}</span> {c.call.display}
              </a>
              <a href={c.freephone.tel}>
                <span>{c.freephone.label}</span> {c.freephone.display}
              </a>
              <a href={mail}>{c.email}</a>
            </p>
            <p className={s.where}>
              <span>{c.end.hours}</span>
              <span>{c.end.address}</span>
            </p>
          </div>
        </section>
      </main>

      <footer className={s.foot}>
        <p className={s.signoff}>{c.end.signoff}</p>
        <DemoFoot domain={data.domain} />
      </footer>

      <StickyBar main={{ label: c.book.float, href: c.book.href, external: true }} call={{ label: c.call.label, tel: c.call.tel }} />
    </div>
  );
}

export const aperture: Design = {
  Demo,
  fonts: ['plus-jakarta-sans-latin-wght-normal', 'crimson-pro-latin-wght-normal'],
  heroSizes: '100vw',
};
