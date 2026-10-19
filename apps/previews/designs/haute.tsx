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
  words: string;
  artists: { name?: string; handle: string; url: string }[];
  bookLine: string;
  owned: string;
  instagram: { handle: string; url: string };
  name: string;
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

/** The ground of the seal: bands of the logo's jade marble, edged in gold leaf. The gold draws itself once. */
function Marble({ s }: { s: Record<string, string | undefined> }) {
  // Placed so that on a phone, which sees only the middle of the sheet, no vein crosses the words.
  const gold = [
    'M-60 150C170 90 360 230 560 200S900 80 1060 140',
    'M-60 300C180 252 330 340 520 326S860 236 1060 270',
    'M-60 560C160 600 330 900 520 905S860 640 1060 560',
    'M-60 640C170 690 330 960 520 965S850 720 1060 650',
  ];
  return (
    <svg className={s.marble} viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <path className={s.band} d="M-60 150C170 90 360 230 560 200S900 80 1060 140V270C860 236 700 340 520 326S180 252 -60 300Z" />
      <path className={s.bandDeep} d="M-60 560C160 600 330 900 520 905S860 640 1060 560V700C880 770 700 1010 500 1010S140 760 -60 700Z" />
      {gold.map((d, i) => (
        <path key={d} className={s.vein} d={d} pathLength={1} style={{ '--v': i } as CSSProperties} />
      ))}
    </svg>
  );
}

/**
 * Haute Ink Tattoo Studio, Terre Haute. The page opens on their own round mark, large, pressed into a
 * ground of its jade marble and gold, with their own words under it. Then the three artists their page
 * names, the book of their work one piece at a time, the week with today marked, and the close: the
 * name again, too big for the page.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('haute', ['Cinzel', 'Manrope']);
  const c = data.demo as Content;
  const run = openRun(c.hours);
  const items = c.book.map((b) => ({ ...b, pic: pic(data, b.key) }));

  return (
    <div className={s.root}>
      <style href="haute" precedence="design">
        {css}
      </style>

      <section className={s.seal} data-hero aria-labelledby="name-h">
        <Marble s={s} />
        <div className={s.mark}>
          <h1 id="name-h" className={s.markName}>
            <Pic pic={pic(data, 'hero')} sizes="(min-width: 900px) 500px, 272px" first />
          </h1>
          {/* The seal's legend: their name, street and town, once round. */}
          <svg className={s.legend} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
            <defs>
              <path id="legend-ring" d="M100 100m-93 0a93 93 0 1 1 186 0a93 93 0 1 1-186 0" />
            </defs>
            <text>
              <textPath href="#legend-ring" textLength="584" lengthAdjust="spacing">
                {`${c.name} \u2022 ${c.address[0]} \u2022 ${c.town} \u2022 `}
              </textPath>
            </text>
          </svg>
        </div>
        <div className={s.say}>
          <p className={s.words}>{c.words}</p>
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
        <section className={s.artists} aria-labelledby="artists-h">
          <h2 id="artists-h" className={s.artHead}>
            The artists
          </h2>
          <ul className={s.artList}>
            {c.artists.map((a) => (
              <li key={a.handle}>
                <a className={s.artist} href={a.url} rel="noopener" target="_blank">
                  {a.name ? <span className={s.artName}>{a.name}</span> : null}
                  <span className={s.artHandle}>
                    <span className={s.at}>@</span>
                    {a.handle.replace(/^@/, '')}
                  </span>
                  <span className={s.artWhere}>
                    Instagram
                    <Arrow />
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <figure className={s.theirs}>
            <blockquote className={s.theirsText}>
              <p>{c.bookLine}</p>
              <p>{c.owned}</p>
            </blockquote>
            <figcaption className={s.theirsBy}>The studio, on Facebook</figcaption>
          </figure>
          <a className={s.shop} href={c.instagram.url} rel="noopener" target="_blank">
            {c.instagram.handle} on Instagram
            <Arrow />
          </a>
        </section>

        <section className={s.inside} aria-labelledby="book-h">
          <header className={s.insideHead}>
            <h2 id="book-h">The book</h2>
            <p>
              {items.length} pieces from the studio, as posted to their Google profile.
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

      </main>

      <footer className={s.end} data-covers aria-labelledby="visit-h">
        <h2 id="visit-h" className={s.endLabel}>
          Find the studio
        </h2>
        <div className={s.colophon}>
          <div>
            <p className={s.colTitle}>Address</p>
            <address className={s.colText}>
              {c.address.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </address>
            <a className={s.colLink} href={c.maps} rel="noopener" target="_blank">
              Directions
              <Arrow />
            </a>
          </div>
          <div>
            <p className={s.colTitle}>Today</p>
            <p className={s.colText}>
              <Now week={c.hours} fallback={run} />
            </p>
            <a className={s.colLink} href="#week">
              The week
            </a>
          </div>
          <div>
            <p className={s.colTitle}>Phone</p>
            <p className={s.colText}>{c.phone.display}</p>
            <a className={s.call} href={c.phone.tel} data-press>
              Call the studio
            </a>
          </div>
        </div>
        <p className={s.endMark} aria-hidden="true">
          {c.mast}
        </p>
        <div className={s.endSmall}>
          <p>{c.credit}</p>
          <p>
            Demo made from their Google profile and Facebook page. Not an official site. Demo by{' '}
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

export const haute: Design = { Demo, fonts: ['cinzel-latin-wght-normal', 'manrope-latin-wght-normal'], heroSizes: '(min-width: 900px) 500px, 272px' };
