import { Now } from '@/components/os/Now';
import { clock } from '@/components/os/hours';
import { MowStripes } from '@/components/MowStripes';
import { Pic } from '@/components/Pic';
import { Cover } from '@/components/os/Cover';
import { pic, type PageData } from '@/lib/data';
import { SENDER, SENDER_SITE } from '@/lib/offer';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Content {
  name: string[];
  town: string;
  address: string[];
  phone: { tel: string; display: string };
  maps: string;
  hours: { open: string; close: string; days: string };
  estimates: string;
  services: string[];
  servicesSource: string;
  work: { key: string; label: string }[];
  credit: string;
}

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M4 10h11M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * The Ranch Landscaping Professionals, East 16th Street, Indianapolis. Their own striped lawn fills the
 * first screen. Their services are mown into the page as stripes in the lawn's two greens, the stripes
 * cut up and back. Two of their own jobs follow, then their day from 6 AM to 11 PM, with now marked.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('mow', ['Big Shoulders Display', 'Work Sans']);
  const c = data.demo as Content;

  return (
    <div className={s.root}>
      <style href="mow" precedence="design">
        {css}
      </style>

      <section className={s.hero} data-hero aria-labelledby="hero-h">
        <div className={s.photo}>
          <Pic pic={pic(data, 'hero')} phone={data.images.heroPhone} sizes="100vw" first />
        </div>
        <div className={s.say}>
          <p className={s.town}>{c.town}</p>
          <h1 id="hero-h" className={s.title}>
            <span className={s.titleBig}>{c.name[0]}</span>
            <span className={s.titleSmall}>{c.name[1]}</span>
          </h1>
          <div className={s.acts} data-covers>
            <a className={s.call} href={c.phone.tel} data-press data-magnetic>
              Call {c.phone.display}
            </a>
            <a className={s.go} href={c.maps} rel="noopener" target="_blank" data-press>
              Directions
              <Arrow />
            </a>
          </div>
          <p className={s.free}>{c.estimates}</p>
        </div>
      </section>

      <main>
        <section className={s.lawn} aria-labelledby="lawn-h">
          <h2 id="lawn-h" className={s.lawnHead}>
            What they do
          </h2>
          <MowStripes items={c.services} s={{ stripes: s.stripes!, stripeIn: s.stripeIn!, stripeNo: s.stripeNo!, stripeName: s.stripeName! }} />
          <p className={s.lawnNote}>{c.servicesSource}</p>
        </section>

        <section className={s.work} aria-label="Two of their jobs">
          {c.work.map((w, i) => (
            <figure key={w.key} className={s.job} data-reveal>
              <Pic pic={pic(data, w.key)} sizes="(min-width: 900px) 44vw, 100vw" low />
              <figcaption>
                <b>{String(i + 1).padStart(2, '0')}</b> {w.label}
              </figcaption>
            </figure>
          ))}
        </section>

        <section className={s.hours} aria-labelledby="hours-h">
          <h2 id="hours-h" className={s.hoursLabel}>
            {c.hours.days}
          </h2>
          <p className={s.times}>
            <span>{clock(c.hours.open)}</span>
            <span className={s.timesTo}>to</span>
            <span>{clock(c.hours.close)}</span>
          </p>
          <p className={s.hoursNow}>
            <Now week={Array.from({ length: 7 }, (_, i) => ({ day: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i]!, open: c.hours.open, close: c.hours.close }))} fallback={`${c.hours.days}, ${clock(c.hours.open)} to ${clock(c.hours.close)}`} />
          </p>
        </section>
      </main>

      <footer className={s.end} data-covers>
        <div className={s.endMain}>
          <address className={s.addr}>
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
              <Arrow />
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

export const mow: Design = { Demo, fonts: ['big-shoulders-display-latin-wght-normal', 'work-sans-latin-wght-normal'], heroSizes: '100vw' };
