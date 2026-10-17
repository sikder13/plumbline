import type { CSSProperties, ReactNode } from 'react';
import { DemoFoot } from '@/components/DemoFoot';
import { Kayak } from '@/components/LandingKayak';
import { LandingChart, routeTracks } from '@/components/LandingChart';
import { LandingDeparts } from '@/components/LandingDeparts';
import { LandingGauge } from '@/components/LandingGauge';
import { LandingRoute } from '@/components/LandingRoute';
import { LandingSeasons, type LandingTour } from '@/components/LandingSeasons';
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
  wordmark: string[];
  nav: Link[];
  gaugeStart: string;
  book: Link;
  call: { label: string; tel: string; display: string };
  email: string;
  hero: { verb: string; place: string[]; sub: string; note: string };
  departs: { label: string; and: string };
  months: string[];
  initials: string[];
  tours: LandingTour[];
  paddle: { kicker: string; heading: string; facts: string; steps: { place: string; text: string }[] };
  plan: { kicker: string; heading: string; tourLabel: string; monthLabel: string; in: string; leaves: string; and: string; early: string; late: string; note: string };
  coast: { kicker: string; heading: string; line: string };
  landing: { kicker: string; heading: string; only: string; reward: string[]; rewardTail: string; local: string; since: string };
  first: { kicker: string; heading: string; lead: string; items: { q: string; a: string; text: string }[] };
  proof: { kicker: string; heading: string; marks: string[]; items: { name: string; text: string }[]; ratingLabel: string; ratingUnit: string; ratingSource: string };
  meet: {
    kicker: string;
    heading: string;
    lead: string;
    checkIn: string;
    boats: { kind: 'book' | 'tel' | 'mail'; label: string; value: string; href?: string; price?: string }[];
    extras: string[];
    office: string;
  };
}

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Where water meets sand: a wash of foam, the wet edge and the dry beach. The wash is a drawing of its
 * own, wider than the screen, so it can move back and forth as a whole without any work for the page.
 */
function Shore({ className, wash }: { className: string | undefined; wash: string | undefined }) {
  return (
    <span className={className} aria-hidden="true">
      <svg className={wash} viewBox="0 0 1440 90" preserveAspectRatio="none" focusable="false">
        <path d="M0 40C120 20 240 54 360 34C480 14 600 50 720 32C840 14 960 48 1080 30C1200 12 1320 46 1440 28V90H0Z" />
      </svg>
      <svg viewBox="0 0 1440 90" preserveAspectRatio="none" focusable="false">
        <path data-wet d="M0 52C120 36 240 64 360 48C480 32 600 62 720 46C840 30 960 60 1080 44C1200 28 1320 58 1440 42V90H0Z" />
        <path data-dry d="M0 62C120 50 240 74 360 60C480 46 600 72 720 58C840 44 960 70 1080 56C1200 42 1320 68 1440 54V90H0Z" />
        <path data-foam d="M0 52C120 36 240 64 360 48C480 32 600 62 720 46C840 30 960 60 1080 44C1200 28 1320 58 1440 42" />
      </svg>
    </span>
  );
}

/** The month it is in New Zealand as the page is made, January as 0. */
function nzMonth(): number {
  const m = Number(new Intl.DateTimeFormat('en-NZ', { timeZone: 'Pacific/Auckland', month: 'numeric' }).format(new Date())) - 1;
  return m >= 0 && m < 12 ? m : 0;
}

/**
 * The page is the paddle. It launches from the beach in the opening photograph, where the name of
 * the cove lands on the sand and a yellow kayak paddles in beside the action; a chart holds while the
 * kayak paddles the tour stop by stop; a kayak slides along the months to set the day's departures;
 * the horizon opens on the coast; the kayak lands on the one beach they may land on, where the
 * cappuccinos are; and the page ends on the beach where the kayaks wait, each one a way to book.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('landing', ['Anton', 'DM Sans']);
  const c = data.demo as Content;
  const book = { href: c.book.href, rel: 'noopener' };
  const month = nzMonth();
  const cove = c.tours[0]!;

  const Mark = ({ children }: { children: ReactNode }) => (
    <p className={s.kicker}>
      <Kayak className={s.kickerBoat} wake />
      <span>{children}</span>
    </p>
  );

  return (
    <div className={s.root}>
      <style href="landing" precedence="design">
        {css}
      </style>

      <LandingGauge items={c.nav} start={c.gaugeStart} book={c.book} cls={{ gauge: s.gauge, track: s.gaugeTrack, boat: s.gaugeBoat, start: s.gaugeStart, links: s.gaugeLinks, book: s.gaugeBook }} />

      <section className={s.hero} id="top" data-hero>
        <div className={s.heroMedia}>
          <Pic pic={pic(data, 'hero')} phone={data.images.heroPhone} sizes="100vw" first />
        </div>
        <a className={s.mark} href="#top" aria-label={data.name}>
          <Kayak className={s.markBoat} />
          {c.wordmark.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </a>
        <LandingDeparts className={s.departs} label={c.departs.label} and={c.departs.and} sets={cove.departures} startMonth={month} />

        <div className={s.heroText}>
          <Shore className={s.heroShore} wash={s.wash} />
          <h1 aria-label={`${c.hero.verb} ${c.hero.place.join(' ')}`}>
            <span className={s.verb} aria-hidden="true">
              <span>{c.hero.verb}</span>
            </span>
            <span className={s.place} aria-hidden="true">
              {c.hero.place.map((w, i) => (
                <span key={w} className={s.word}>
                  <span style={{ '--i': i } as CSSProperties}>{w}</span>
                </span>
              ))}
              <span className={s.heroBoat}>
                <Kayak />
              </span>
            </span>
          </h1>
          <div className={s.heroFoot}>
            <p className={s.sub}>{c.hero.sub}</p>
            <div className={s.act}>
              <a className={s.go} data-press data-magnetic {...book}>
                {c.book.label}
                <Arrow />
              </a>
              <p className={s.note}>{c.hero.note}</p>
            </div>
          </div>
        </div>
      </section>

      <main>
        <section className={s.paddle} id="paddle" aria-labelledby="paddle-h">
          <LandingRoute tracks={routeTracks()} steps={c.paddle.steps.length} cls={{ track: s.track, frame: s.frame }}>
            <header className={s.paddleHead}>
              <Mark>{c.paddle.kicker}</Mark>
              <h2 id="paddle-h">{c.paddle.heading}</h2>
              <p>{c.paddle.facts}</p>
            </header>
            <LandingChart steps={c.paddle.steps} cls={{ chart: s.chart, map: s.map, stops: s.stops }} />
          </LandingRoute>
        </section>

        <section className={s.plan} id="plan" aria-labelledby="plan-h">
          <header className={s.planHead}>
            <Mark>{c.plan.kicker}</Mark>
            <h2 id="plan-h" data-reveal>
              {c.plan.heading}
            </h2>
          </header>
          <LandingSeasons
            tours={c.tours}
            months={c.months}
            initials={c.initials}
            labels={c.plan}
            bookHref={c.book.href}
            startMonth={month}
            day={<Pic pic={pic(data, 'day')} sizes="(min-width: 900px) 52vw, 100vw" />}
            sunrise={<Pic pic={pic(data, 'sunrise')} sizes="(min-width: 900px) 52vw, 100vw" alt="" />}
            cls={{
              plan: s.planner,
              scene: s.scene,
              photo: s.scenePhoto,
              sun: s.sceneSun,
              line: s.dayLine,
              mark: s.dayMark,
              ends: s.dayEnds,
              controls: s.controls,
              tours: s.tourPick,
              slider: s.slider,
              initials: s.initials,
              sentence: s.sentence,
              special: s.special,
              tourLine: s.tourLine,
              deal: s.deal,
              go: s.go,
              tag: s.tag,
            }}
          />
        </section>

        <section className={s.coast} aria-labelledby="coast-h">
          <div className={s.coastText}>
            <Mark>{c.coast.kicker}</Mark>
            <h2 id="coast-h" className={s.statement}>
              <span className={s.underline}>{c.coast.heading}</span>
            </h2>
            <p className={s.coastLine} data-reveal>
              {c.coast.line}
            </p>
          </div>
          <div className={s.horizon}>
            <Pic pic={pic(data, 'coast')} sizes="100vw" />
            <span className={s.horizonBoat} aria-hidden="true">
              <Kayak wake />
            </span>
          </div>
        </section>

        <section className={s.landing} id="landing" aria-labelledby="landing-h">
          <Shore className={s.landShore} wash={s.wash} />
          <div className={s.landText}>
            <Mark>{c.landing.kicker}</Mark>
            <h2 id="landing-h">
              <span className={s.landWord}>{c.landing.heading}</span>
              <span className={s.landBoat} aria-hidden="true">
                <Kayak wake />
              </span>
            </h2>
            <p className={s.only} data-reveal>
              {c.landing.only}
            </p>
            <p className={s.reward}>
              {c.landing.reward.map((w, i) => (
                <span key={w} style={{ '--i': i } as CSSProperties}>
                  {w}
                </span>
              ))}
              <em>{c.landing.rewardTail}</em>
            </p>
          </div>
          <div className={s.landPics}>
            <figure className={s.landPhoto} data-wipe>
              <Pic pic={pic(data, 'landing')} sizes="(min-width: 900px) 44vw, 100vw" />
            </figure>
            <figure className={s.print}>
              <Pic pic={pic(data, 'coffee')} sizes="(min-width: 900px) 22vw, 56vw" />
            </figure>
          </div>
          <div className={s.landNotes}>
            <p data-reveal>{c.landing.local}</p>
            <p data-reveal>{c.landing.since}</p>
          </div>
        </section>

        <section className={s.first} aria-labelledby="first-h">
          <div className={s.firstPhoto} data-wipe>
            <Pic pic={pic(data, 'drill')} sizes="(min-width: 900px) 40vw, 100vw" />
          </div>
          <div className={s.firstBody}>
            <header className={s.firstHead}>
              <Mark>{c.first.kicker}</Mark>
              <h2 id="first-h" data-reveal>
                {c.first.heading}
              </h2>
              <p data-reveal>{c.first.lead}</p>
            </header>
            <ul className={s.answers}>
              {c.first.items.map((it, i) => (
                <li key={it.q} data-reveal style={{ '--i': i } as CSSProperties}>
                  <p className={s.q}>{it.q}</p>
                  <p className={s.a}>{it.a}</p>
                  <p className={s.aText}>{it.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={s.proof} aria-labelledby="proof-h">
          <div className={s.proofTop}>
            <header className={s.proofHead}>
              <Mark>{c.proof.kicker}</Mark>
              <h2 id="proof-h" data-reveal>
                {c.proof.heading}
              </h2>
            </header>
            {data.rating && (
              <p className={s.rating} data-reveal>
                <b>{data.rating.value}</b>
                <span>
                  {c.proof.ratingLabel} <span>{String(data.rating.count)}</span> {c.proof.ratingUnit}
                </span>
                <small>{c.proof.ratingSource}</small>
              </p>
            )}
          </div>
          <div className={s.hull} aria-hidden="true">
            <div className={s.hullRun}>
              {[0, 1].map((k) => (
                <span key={k}>
                  {c.proof.marks.map((m) => (
                    <span key={m}>
                      {m}
                      <i />
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>
          <div className={s.proofBody}>
            <ul className={s.creds}>
              {c.proof.items.map((it) => (
                <li key={it.name} data-reveal>
                  <h3>{it.name}</h3>
                  <p>{it.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={s.meet} id="meet" aria-labelledby="meet-h">
          <div className={s.meetPhoto} data-wipe>
            <Pic pic={pic(data, 'meet')} sizes="100vw" />
          </div>
          <div className={s.meetBody}>
            <header className={s.meetHead}>
              <Mark>{c.meet.kicker}</Mark>
              <h2 id="meet-h" data-reveal>
                {c.meet.heading}
              </h2>
              <p data-reveal>{c.meet.lead}</p>
              <p className={s.checkIn} data-reveal>
                {c.meet.checkIn}
              </p>
            </header>
            <ul className={s.boats}>
              {c.meet.boats.map((b, i) => (
                <li key={b.label} style={{ '--i': i } as CSSProperties}>
                  {b.kind === 'book' ? (
                    <a className={s.boat} data-kind="book" href={c.book.href} rel="noopener" data-press data-magnetic>
                      <b>
                        {b.label}
                        <Arrow />
                      </b>
                      <span>{b.value}</span>
                      {b.price && <small>{b.price}</small>}
                    </a>
                  ) : (
                    <a className={s.boat} data-kind={b.kind} href={b.href} data-press>
                      <span>{b.label}</span>
                      <b>{b.value}</b>
                    </a>
                  )}
                </li>
              ))}
            </ul>
            <div className={s.meetNotes}>
              {c.meet.extras.map((e) => (
                <p key={e}>{e}</p>
              ))}
              <p>{c.meet.office}</p>
            </div>
          </div>
        </section>
      </main>

      <footer className={s.foot}>
        <p className={s.footMark}>
          <Kayak className={s.footBoat} />
          <span>{c.wordmark.join(' ')}</span>
        </p>
        <DemoFoot domain={data.domain} />
      </footer>

      <StickyBar main={{ label: c.book.label, href: c.book.href, external: true }} call={{ label: c.call.label, tel: c.call.tel }} />
    </div>
  );
}

export const landing: Design = { Demo, fonts: ['anton-latin-400-normal', 'dm-sans-latin-wght-normal'], heroSizes: '100vw' };
