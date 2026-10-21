import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CSSProperties, ReactNode } from 'react';
import { Pic } from '@/components/Pic';
import { pic, type PageData } from '@/lib/data';
import { SENDER, SENDER_SITE } from '@/lib/offer';
import { designStyles } from '@/lib/styles';
import { PAGE_SCRIPT } from '@plumbline/preview/sample';
import type { Design } from './types';

interface Day {
  day: string;
  open: string | null;
  close: string | null;
}

interface Content {
  name: string;
  mast: string;
  town: string;
  /** Two lines: the first set solid, the second in outline after the one word set in the accent. */
  headline: { first: string; accent: string; second: string };
  /** One line under the headline, in their own words. */
  line: string;
  address: string[];
  /** The street, as the headline of the last section. */
  street: string;
  phone: { tel: string; display: string } | null;
  email: string;
  instagram: { handle: string; url: string };
  hours: Day[];
  artists: { name?: string; handle: string; url: string }[];
  bookLine: string;
  /** The photographs of the work, by key, a list to each row. */
  work: string[][];
  credit: string;
  /** Their mark, traced from their logo file. */
  mark: { viewBox: string; d: string };
  /** The tab's icon: their mark, small, as a data address. */
  icon?: string;
}

/** A script the page runs once it has been parsed: the ink, the rails, the tilt and the reveals. */
const MOTION = readFileSync(join(process.cwd(), 'designs', 'wall.motion.js'), 'utf8');

/** Set before anything below it is drawn, so content waiting to rise in is never seen first. */
const BEFORE = "if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.setAttribute('data-wall-motion','')";

const pad = (n: number) => String(n).padStart(2, '0');

/** "21:00" as "9 PM". */
function clock(t: string): string {
  const [h, m] = t.split(':').map(Number) as [number, number];
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}${m ? `:${pad(m)}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
}

function Arrow({ up }: { up?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      {up ? <path d="M6 14 14 6M7.5 6H14v6.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /> : <path d="M4 10h12M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

function Mark({ className }: { className?: string }) {
  return (
    <svg className={className} aria-hidden="true" focusable="false">
      <use href="#wall-mark" />
    </svg>
  );
}

/** Each word on its own, so the headline can rise in a word at a time. */
function words(text: string, from: number, cls: string): ReactNode[] {
  return text.split(' ').flatMap((w, i) => [i ? ' ' : '', <span key={w + i} className={cls} style={{ '--i': from + i } as CSSProperties}>{w}</span>]);
}

/**
 * Haute Ink Tattoo Studio, Terre Haute: a sample homepage. "The wall": the studio and its three artists
 * told the way a modern design studio would tell them. Black, their gold, one large headline a section,
 * and a slow ink drawing behind the first screen that traces their dagger mark. Then the artists, two
 * rows of their work running past, how to book, and the street they are on.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('wall', ['Clash Display', 'Inter', 'JetBrains Mono']);
  const c = data.demo as Content;
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address.join(', '))}`;
  const rows = c.work.map((row) => row.map((key) => ({ key, pic: pic(data, key) })));
  const eyebrow = (n: number, label: string) => (
    <p className={s.eyebrow}>
      <span className={s.num}>{pad(n)}</span> / {label}
    </p>
  );

  return (
    <div className={s.root}>
      <style href="wall" precedence="design">
        {css}
      </style>
      {c.icon && <link rel="icon" href={c.icon} />}
      <script {...{ [PAGE_SCRIPT]: '' }} dangerouslySetInnerHTML={{ __html: BEFORE }} />
      <svg className={s.defs} aria-hidden="true" focusable="false">
        <symbol id="wall-mark" viewBox={c.mark.viewBox}>
          <path fillRule="evenodd" d={c.mark.d} />
        </symbol>
      </svg>

      <header className={s.bar}>
        <div className={s.barIn}>
          <a href="#top" className={s.brand}>
            <Mark className={s.brandMark} />
            <span className={s.brandName}>{c.mast}</span>
          </a>
          <nav className={s.nav} aria-label="Sections">
            <a href="#artists">Artists</a>
            <a href="#work">Work</a>
            <a href="#book">Book</a>
            <a href="#find">Find us</a>
          </nav>
          <a href="#book" className={`${s.primary} ${s.barBook}`}>
            Book
          </a>
        </div>
      </header>

      <main>
        <section id="top" className={s.hero} aria-labelledby="wall-title">
          <canvas className={s.ink} data-ink aria-hidden="true" />
          <Mark className={s.heroMark} />
          <div className={`${s.wrap} ${s.heroIn}`}>
            {eyebrow(1, 'The studio')}
            <div className={s.heroText}>
              <h1 id="wall-title" className={s.title}>
                <span className={s.line}>{words(c.headline.first, 0, s.word!)}</span>
                <span className={`${s.line} ${s.outline}`}>
                  <span className={`${s.word} ${s.accent}`} style={{ '--i': c.headline.first.split(' ').length } as CSSProperties}>
                    {c.headline.accent}
                  </span>{' '}
                  {words(c.headline.second, c.headline.first.split(' ').length + 1, s.word!)}
                </span>
              </h1>
              <p className={s.lead}>{c.line}</p>
              <div className={s.actions}>
                <a href="#book" className={s.primary}>
                  Book
                </a>
                <a href="#artists" className={s.textLink}>
                  See the artists <Arrow />
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="artists" className={s.section} aria-labelledby="wall-artists" data-section>
          <div className={s.wrap} data-reveal>
            {eyebrow(2, 'Artists')}
            <h2 id="wall-artists" className={s.h2}>
              The artists.
            </h2>
          </div>
          <div className={s.artistRail} data-reveal>
            <ol className={s.artists}>
              {c.artists.map((a, i) => {
                const shown = a.name ?? a.handle;
                return (
                  <li key={a.handle} className={s.artist} data-tilt>
                    <div className={s.art} aria-hidden="true">
                      <span className={s.initial}>{shown.replace(/^@/, '').charAt(0).toUpperCase()}</span>
                      <Mark className={s.artMark} />
                    </div>
                    <span className={s.tag}>{a.handle}</span>
                    <span className={s.count} aria-hidden="true">
                      {pad(i + 1)} / {pad(c.artists.length)}
                    </span>
                    <h3 className={s.artistName}>{shown}</h3>
                    <a className={s.cover} href={a.url} aria-label={`Message ${a.handle}`}>
                      <span className={s.round}>
                        <Arrow up />
                      </span>
                    </a>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section id="work" className={s.section} aria-labelledby="wall-work" data-section>
          <div className={`${s.wrap} ${s.workHead}`}>
            <div data-reveal>
              {eyebrow(3, 'The work')}
              <h2 id="wall-work" className={s.h2}>
                The work.
              </h2>
            </div>
            <div className={s.controls} data-rail-controls>
              <button type="button" className={`${s.ctrl} ${s.pause}`} data-rail-pause aria-pressed="false" aria-label="Pause the work">
                <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
                  <path className={s.paused} d="M7 5v10M13 5v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                  <path className={s.playing} d="M7 5.5v9l7.5-4.5z" fill="currentColor" />
                </svg>
              </button>
              <button type="button" className={s.ctrl} data-rail-step="-1" aria-label="Previous piece">
                <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
                  <path d="M16 10H4M9 5l-5 5 5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button type="button" className={s.ctrl} data-rail-step="1" aria-label="Next piece">
                <Arrow />
              </button>
            </div>
          </div>
          <div className={s.rows} data-rails data-reveal>
            {rows.map((row, r) => (
              <div key={r} className={s.row} data-row data-dir={r % 2 ? 1 : -1} role="group" aria-label={`Their work, row ${r + 1} of ${rows.length}`} tabIndex={0}>
                <ul className={s.track} data-track>
                  {[false, true].flatMap((clone) =>
                    row.map(({ key, pic: p }) => (
                      <li key={`${key}${clone ? '-again' : ''}`} className={s.piece} data-piece data-clone={clone ? '' : undefined} aria-hidden={clone ? true : undefined} style={{ '--ar': `${p.width} / ${p.height}` } as CSSProperties}>
                        <Pic pic={p} sizes={`(min-width: 1100px) ${Math.round((440 * p.width) / p.height)}px, (min-width: 768px) ${Math.round((340 * p.width) / p.height)}px, ${Math.round((260 * p.width) / p.height)}px`} alt={clone ? '' : undefined} low={clone} />
                      </li>
                    )),
                  )}
                </ul>
              </div>
            ))}
          </div>
          <div className={s.wrap}>
            <a href={c.instagram.url} className={`${s.textLink} ${s.more}`}>
              More on Instagram <Arrow up />
            </a>
          </div>
        </section>

        <section id="book" className={s.section} aria-labelledby="wall-book" data-section>
          <div className={`${s.wrap} ${s.bookGrid}`}>
            <div className={s.bookHead} data-reveal>
              {eyebrow(4, 'Book')}
              <h2 id="wall-book" className={s.h2}>
                Book.
              </h2>
            </div>
            <div className={s.glassWrap} data-reveal>
              <Mark className={s.glassMark} />
              <div className={s.glass}>
                <p className={s.bookLine}>{c.bookLine}</p>
              </div>
            </div>
            <ul className={`${s.ways} ${c.phone ? s.ways4 : ''}`}>
              <li>
                <a className={s.way} href={c.instagram.url} data-visit="cta_click">
                  Message the shop <Arrow up />
                </a>
              </li>
              <li>
                <a className={s.way} href="#artists">
                  Message an artist <Arrow />
                </a>
              </li>
              <li>
                <a className={s.way} href={`mailto:${c.email}`} data-visit="cta_click">
                  Email <Arrow />
                </a>
              </li>
              {c.phone && (
                <li>
                  <a className={s.way} href={c.phone.tel} data-visit="cta_click">
                    Call <Arrow />
                  </a>
                </li>
              )}
            </ul>
          </div>
        </section>

        <section id="find" className={`${s.section} ${s.find}`} aria-labelledby="wall-find" data-section>
          <div className={s.wrap}>
            <div data-reveal>
              {eyebrow(5, 'Find us')}
              <h2 id="wall-find" className={s.h2}>
                {c.street}
              </h2>
            </div>
            <div className={s.place} data-reveal>
              <div className={s.where}>
                <h3 className={s.label}>Address</h3>
                <address className={s.address}>
                  {c.address.map((l) => (
                    <span key={l}>{l}</span>
                  ))}
                </address>
                <a className={`${s.primary} ${s.directions}`} href={maps} data-visit="cta_click">
                  Directions <Arrow up />
                </a>
              </div>
              <div className={s.when}>
                <h3 className={s.label}>Hours</h3>
                <dl className={s.hours}>
                  {c.hours.map((d) => (
                    <div key={d.day} className={s.day}>
                      <dt>
                        <abbr title={d.day}>{d.day.slice(0, 3)}</abbr>
                      </dt>
                      <dd>{d.open && d.close ? `${clock(d.open)} to ${clock(d.close)}` : 'Closed'}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className={s.foot}>
        <div className={`${s.wrap} ${s.footIn}`}>
          <p className={s.footName}>
            <Mark className={s.footMark} />
            <span>
              {c.name}, {c.town}
            </span>
          </p>
          <ul className={s.footLinks}>
            <li>
              <a href={c.instagram.url}>Instagram</a>
            </li>
            <li>
              <a href={`mailto:${c.email}`}>{c.email}</a>
            </li>
          </ul>
          <p className={s.credit}>{c.credit}</p>
          <p className={s.sample}>
            <a href={SENDER_SITE}>Sample by {SENDER}</a>
          </p>
        </div>
      </footer>
      <script {...{ [PAGE_SCRIPT]: '' }} dangerouslySetInnerHTML={{ __html: MOTION }} />
    </div>
  );
}

export const wall: Design = {
  Demo,
  // The headline that opens the page is set in this face, at this weight.
  fonts: ['clash-display-latin-600-normal'],
  heroSizes: '100vw',
};
