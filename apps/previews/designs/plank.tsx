import type { CSSProperties } from 'react';
import { PlankLoupe } from '@/components/PlankLoupe';
import { Pic } from '@/components/Pic';
import { Cover } from '@/components/os/Cover';
import { pic, type PageData } from '@/lib/data';
import { SENDER, SENDER_SITE } from '@/lib/offer';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Content {
  mark: string;
  word: string;
  headline: string[];
  town: string;
  address: string[];
  phone: { tel: string; display: string };
  maps: string;
  hours: string;
  hoursSource: string;
  floors: { key: string; label: string; note: string }[];
  credit: string;
}

/** The strips the top photograph is laid in, alternating sides, like planks going down. */
const STRIPS = 7;

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M4 10h11M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * L & R Flooring, Indianapolis. Their own floor opens the page, laid strip by strip; their own two words
 * from the logo, Residential & Commercial, are the headline. Then three more of their floors, each with
 * a lens that shows the seams at full size, a short spec sheet of the facts, and their number to close.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('plank', ['League Spartan', 'Source Serif 4']);
  const c = data.demo as Content;

  return (
    <div className={s.root}>
      <style href="plank" precedence="design">
        {css}
      </style>

      <section className={s.hero} data-hero aria-labelledby="hero-h">
        <div className={s.say}>
          <p className={s.mark}>
            <b>{c.mark}</b> <i>{c.word}</i>
          </p>
          <h1 id="hero-h" className={s.title} aria-label={c.headline.join(' ')}>
            <span aria-hidden="true" style={{ '--i': 0 } as CSSProperties}>
              {c.headline[0]}
            </span>
            <span aria-hidden="true" className={s.amp} style={{ '--i': 1 } as CSSProperties}>
              &amp;
            </span>
            <span aria-hidden="true" style={{ '--i': 2 } as CSSProperties}>
              {c.headline[1]!.replace(/^&\s*/, '')}
            </span>
          </h1>
          <ul className={s.facts}>
            <li>{c.town}</li>
            <li>{c.hours}</li>
          </ul>
        </div>
        <div className={s.photo}>
          <Pic pic={pic(data, 'hero')} sizes="(min-width: 900px) 54vw, 100vw" first />
          <div className={s.strips} aria-hidden="true">
            {Array.from({ length: STRIPS }, (_, i) => (
              <i key={i} style={{ '--i': i, '--side': i % 2 ? 1 : -1 } as CSSProperties} />
            ))}
          </div>
        </div>
        <div className={s.acts} data-covers>
          <a className={s.call} href={c.phone.tel} data-press data-magnetic>
            Call {c.phone.display}
          </a>
          <a className={s.go} href={c.maps} rel="noopener" target="_blank" data-press>
            Directions
            <Arrow />
          </a>
        </div>
      </section>

      <main>
        <section className={s.closerSec} aria-labelledby="closer-h">
          <header className={s.closerHead}>
            <h2 id="closer-h">Look closer</h2>
            <p>Three more of their floors. Move over a photo, or tap it, to see it at full size.</p>
          </header>
          <div className={s.floors}>
            {c.floors.map((f, i) => (
              <PlankLoupe key={f.key} pic={pic(data, f.key)} label={f.label} note={f.note} sweep={i === 0} s={{ floor: s.floor!, frame: s.frame!, lens: s.lens!, closer: s.closer! }} />
            ))}
          </div>
        </section>

      </main>

      <footer className={s.sheet} aria-labelledby="sheet-h" data-covers>
        <h2 id="sheet-h" className={s.sheetLabel}>
          {c.mark} {c.word}
        </h2>
        <dl className={s.specs}>
          <div>
            <dt>Work</dt>
            <dd>{c.headline.join(' ')}</dd>
          </div>
          <div>
            <dt>Hours</dt>
            <dd>
              {c.hours} <small>{c.hoursSource}</small>
            </dd>
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
        </dl>
        <div className={s.sheetActs}>
          <a className={s.call} href={c.phone.tel} data-press>
            Call {c.phone.display}
          </a>
          <a className={s.go} href={c.maps} rel="noopener" target="_blank" data-press>
            Directions on Google Maps
            <Arrow />
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
          Call {c.phone.display}
        </a>
        <a href={c.maps} className={s.barGo} rel="noopener" target="_blank" data-press>
          Directions
        </a>
      </nav>
      <Cover />
    </div>
  );
}

export const plank: Design = { Demo, fonts: ['league-spartan-latin-wght-normal', 'source-serif-4-latin-wght-normal'], heroSizes: '(min-width: 900px) 54vw, 100vw' };
