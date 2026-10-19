import type { CSSProperties } from 'react';
import { HauteBook } from '@/components/HauteBook';
import { Pic } from '@/components/Pic';
import { Cover } from '@/components/os/Cover';
import { Now } from '@/components/os/Now';
import { span, type Day } from '@/components/os/hours';
import { pic, type PageData } from '@/lib/data';
import { SENDER, SENDER_SITE } from '@/lib/offer';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Content {
  mast: string;
  kind: string;
  town: string;
  address: string[];
  phone: { tel: string; display: string };
  maps: string;
  hours: Day[];
  cover: string;
  book: { key: string; label: string; where: string }[];
  credit: string;
}

/** Tuesday to Sunday, from the published week: the days that open, as one run where they run on. */
function openRun(week: Day[]): string {
  const open = week.map((d) => !!d.open);
  const first = open.indexOf(true);
  const last = open.lastIndexOf(true);
  const unbroken = open.slice(first, last + 1).every(Boolean);
  return unbroken ? `Open ${week[first]!.day} to ${week[last]!.day}` : `Open ${week.filter((d) => d.open).length} days a week`;
}

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M4 10h11M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Haute Ink Tattoo Studio, Terre Haute. The page is the cover of the studio's first issue: their
 * sharpest piece is the cover photograph, and their name runs across it as the masthead, ink on the
 * paper and paper on the photograph. Inside, the book turns through their other pieces one at a time,
 * the week says whether the door is open now, and the close is the name again, too big for the page.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('haute', ['Bodoni Moda', 'Schibsted Grotesk']);
  const c = data.demo as Content;
  const run = openRun(c.hours);
  const items = c.book.map((b) => ({ ...b, pic: pic(data, b.key) }));

  return (
    <div className={s.root}>
      <style href="haute" precedence="design">
        {css}
      </style>

      <section className={s.cover} data-hero aria-labelledby="mast">
        <div className={s.photo}>
          <Pic pic={pic(data, 'hero')} sizes="(min-width: 900px) 42vw, 100vw" first />
        </div>
        <h1 id="mast" className={s.mast}>
          <span className={s.mastInk}>{c.mast}</span>
          <span className={s.mastPaper} aria-hidden="true">
            {c.mast}
          </span>
        </h1>
        <p className={s.lineDays} aria-hidden="true">
          {run.replace('Open ', '')}
        </p>
        <p className={s.lineStreet} aria-hidden="true">
          {c.address[0]}
        </p>
        <div className={s.coverLeft}>
          <p className={s.lineKind}>{c.kind}</p>
          <p className={s.lineTown}>{c.town}</p>
        </div>
        <p className={s.lineCap}>
          <b>On the cover</b> {c.cover}
        </p>
        <div className={s.coverSide}>
          <p className={s.coverNow}>
            <Now week={c.hours} fallback={run} />
          </p>
          <p className={s.coverRun}>
            {run}. {c.address[0]}.
          </p>
          <div className={s.acts} data-covers>
            <a className={s.call} href={c.phone.tel} data-press data-magnetic>
              Call {c.phone.display}
            </a>
            <a className={s.go} href={c.maps} rel="noopener" target="_blank" data-press>
              Directions
              <Arrow />
            </a>
          </div>
        </div>
      </section>

      <main>
        <section className={s.inside} aria-labelledby="book-h">
          <header className={s.insideHead}>
            <h2 id="book-h">The book</h2>
            <p>
              {items.length} more pieces from the studio, as posted to their Google profile.
            </p>
          </header>
          <HauteBook items={items} s={{ book: s.book!, stage: s.stage!, page: s.page!, stageCap: s.stageCap!, turns: s.turns!, turn: s.turn!, count: s.count!, index: s.index!, swipe: s.swipe!, swipeCount: s.swipeCount! }} />
        </section>

        <section className={s.week} id="week" aria-labelledby="week-h">
          <div className={s.weekHead}>
            <h2 id="week-h">This week</h2>
            <p className={s.weekNow}>
              <Now week={c.hours} fallback={run} scope="#week" />
            </p>
          </div>
          <ol className={s.days}>
            {c.hours.map((d, i) => (
              <li key={d.day} data-day={i} data-closed={d.open ? undefined : ''} style={{ '--i': i } as CSSProperties}>
                <span className={s.dayName}>{d.day}</span>
                <span className={s.dayTime}>{span(d)}</span>
                <span className={s.dayMark}>Today</span>
              </li>
            ))}
          </ol>
        </section>

        <section className={s.visit} aria-labelledby="visit-h" data-covers>
          <h2 id="visit-h" className={s.visitLabel}>
            Find the studio
          </h2>
          <address className={s.visitAddr}>
            {c.address.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </address>
          <div className={s.visitActs}>
            <a className={s.call} href={c.phone.tel} data-press>
              Call {c.phone.display}
            </a>
            <a className={s.go} href={c.maps} rel="noopener" target="_blank" data-press>
              Directions
              <Arrow />
            </a>
          </div>
        </section>
      </main>

      <footer className={s.end} data-covers>
        <p className={s.endMark} aria-hidden="true">
          {c.mast}
        </p>
        <div className={s.endSmall}>
          <p>{data.name}. {c.address.join(', ')}.</p>
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
          Directions
        </a>
      </nav>
      <Cover />
    </div>
  );
}

export const haute: Design = { Demo, fonts: ['bodoni-moda-latin-wght-normal', 'schibsted-grotesk-latin-wght-normal'], heroSizes: '(min-width: 900px) 42vw, 100vw' };
