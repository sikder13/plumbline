import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { DemoFoot } from '@/components/DemoFoot';
import { PaddockPrints } from '@/components/PaddockPrints';
import { PaddockSign, PaddockYear, type Hours, type SignWords } from '@/components/PaddockSeason';
import { PaddockTeam, type Wine } from '@/components/PaddockTeam';
import { Pic } from '@/components/Pic';
import { Pinned } from '@/components/Pinned';
import { SectionLinks } from '@/components/SectionLinks';
import { StickyBar } from '@/components/StickyBar';
import { pic, type PageData } from '@/lib/data';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Content {
  wordmark: string[];
  place: string;
  nav: { label: string; href: string }[];
  book: { label: string; href: string };
  call: { label: string; tel: string; display: string };
  mobile?: { label: string; tel: string; display: string };
  email: string;
  hero: {
    lines: string[];
    sub: string;
    roads: { label: string; codes: string[] };
    stamp: { ring: string; number: string; label: string };
    shuffle: string;
  };
  sign: SignWords;
  story: { heading: string; steps: { year: string; label: string; text: string; image: string }[] };
  team: { heading: string; lead: string; hint: string; wines: Wine[] };
  farm: { kicker: string; heading: string; lines: string[] };
  visit: {
    heading: string;
    lead: string;
    free: { word: string; text: string };
    tiles: { icon: string; title: string; text: string }[];
    away: { title: string; text: string; extra: string; link: string };
  };
  hours: Hours & { heading: string; lead: string };
  proof: { heading: string; quote: string; by: string; source: string; aside: string; awards: { title: string; wine: string; event: string; year: string }[] };
  find: {
    heading: string;
    lead: string;
    roads: { code: string; name: string }[];
    address: string[];
    junction: string;
    ring: string;
    people: string;
    callLabel: string;
    emailLabel: string;
  };
  foot: { line: string; post: string };
}

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Line drawings for the cellar door's notes, one per kind of welcome. */
const ICONS: Record<string, ReactNode> = {
  picnic: (
    <>
      <path d="M8 22h32l-3 17H11z" />
      <path d="M14 22c0-7 4.5-11 10-11s10 4 10 11" />
      <path d="M10 29h28M12 34h24" />
    </>
  ),
  group: (
    <>
      <circle cx="14" cy="15" r="4" />
      <circle cx="34" cy="15" r="4" />
      <circle cx="24" cy="12" r="4" />
      <path d="M6 30c1-5 4-8 8-8s7 3 8 8M26 30c1-5 4-8 8-8s7 3 8 8M17 26c1.5-4 4-6 7-6s5.5 2 7 6" />
      <path d="M5 36h38M9 36v6M39 36v6" />
    </>
  ),
  ball: (
    <>
      <ellipse cx="24" cy="24" rx="19" ry="11" transform="rotate(-30 24 24)" />
      <path d="M12.5 30.5c7-2 16-9 23-13" />
      <path d="M20 23l3 4M24 20.5l3 4M28 18l3 4" />
    </>
  ),
  van: (
    <>
      <path d="M5 34V17a4 4 0 0 1 4-4h20l9 8h4a2 2 0 0 1 2 2v11z" />
      <path d="M29 13v9h9M10 18h13v6H10z" />
      <circle cx="13" cy="35" r="4" />
      <circle cx="35" cy="35" r="4" />
    </>
  ),
};

function Icon({ name, className }: { name: string; className: string }) {
  const art = ICONS[name];
  if (!art) return null;
  return (
    <svg className={className} viewBox="0 0 48 48" width="48" height="48" aria-hidden="true" focusable="false">
      {art}
    </svg>
  );
}

/** A state highway shield, drawn as a plain red shield with its number. */
function Shield({ code, x, y, size = 1, className }: { code: string; x: number; y: number; size?: number; className: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`} className={className}>
      <path d="M-15 -17h30c0 13 -2 24 -15 33c-13 -9 -15 -20 -15 -33z" />
      <text y="4">{code}</text>
    </g>
  );
}

/**
 * The family paddock. A working farm where the vines are grazed by lambs, the wines take the field
 * by their rugby names, and the cellar door is the family's own home. The page opens on a fan of
 * family prints and a hanging sign that says, by the hours they keep, whether today is a drop in
 * day; tells the family's years as a farm calendar whose pages flip over; puts the wines on a rugby field; and ends at
 * the junction of two highways, with the ways to reach them as finger posts.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('paddock', ['Big Shoulders Display', 'Literata']);
  const c = data.demo as Content;
  const book = { href: c.book.href, rel: 'noopener' };
  const steps = c.story.steps;
  const mail = `mailto:${c.email}`;

  return (
    <div className={s.root}>
      <style href="paddock" precedence="design">
        {css}
      </style>
      <nav className={s.nav} aria-label="Sections">
        <a className={s.navMark} href="#top">
          {c.wordmark.join(' ')}
        </a>
        <SectionLinks className={s.navLinks} items={c.nav} />
        <a className={s.navBook} data-press data-magnetic {...book}>
          {c.book.label}
        </a>
      </nav>

      <section className={s.hero} id="top" data-hero aria-labelledby="hero-h">
        <div className={s.heroTop}>
          <a className={s.mark} href="#top">
            {c.wordmark.map((w, i) => (
              <Fragment key={w}>
                {i > 0 && ' '}
                <span>{w}</span>
              </Fragment>
            ))}
          </a>
          <p className={s.place}>{c.place}</p>
          <p className={s.roads}>
            <span className={s.srOnly}>{c.hero.roads.label}</span>
            {c.hero.roads.codes.map((code, i) => (
              <svg key={code} className={s.road} viewBox="-17 -18 34 36" style={{ '--i': i } as CSSProperties} aria-hidden="true" focusable="false">
                <Shield code={code} x={0} y={0} className={s.shieldMark!} />
              </svg>
            ))}
          </p>
        </div>

        <div className={s.stage}>
          <div className={s.fan}>
            <PaddockPrints
              className={s.prints}
              label={c.hero.shuffle}
              prints={[
                <Pic key="hero" pic={pic(data, 'hero')} sizes="(min-width: 900px) 27vw, 56vw" first />,
                <Pic key="vines" pic={pic(data, 'printVines')} sizes="(min-width: 900px) 27vw, 56vw" />,
                <Pic key="bottles" pic={pic(data, 'printBottles')} sizes="(min-width: 900px) 27vw, 56vw" />,
              ]}
            />
            <p className={s.stamp}>
              <span className={s.srOnly}>{c.hero.stamp.label}</span>
              <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
                <defs>
                  <path id="paddock-ring" d="M60 60m-45 0a45 45 0 1 1 90 0a45 45 0 1 1 -90 0" />
                </defs>
                <circle cx="60" cy="60" r="58" />
                <text className={s.stampRing}>
                  <textPath href="#paddock-ring" textLength="282" lengthAdjust="spacing">
                    {c.hero.stamp.ring}
                  </textPath>
                </text>
                <text className={s.stampNumber} x="60" y="72">
                  {c.hero.stamp.number}
                </text>
              </svg>
            </p>
          </div>
        </div>

        <h1 id="hero-h" className={s.title} aria-label={c.hero.lines.join(' ')}>
          {c.hero.lines.map((l, i) => (
            <span key={l} className={s.line} aria-hidden="true">
              <span style={{ '--i': i } as CSSProperties}>{l}</span>
            </span>
          ))}
        </h1>

        <div className={s.heroFoot}>
          <p className={s.sub}>{c.hero.sub}</p>
          <div className={s.heroActs}>
            <PaddockSign className={s.sign} words={c.sign} hours={c.hours} />
            <a className={s.go} data-press data-magnetic {...book}>
              {c.book.label}
              <Arrow />
            </a>
          </div>
        </div>
      </section>

      <main>
        <section className={s.story} id="story" aria-labelledby="story-h">
          <Pinned steps={steps.length} className={s.storyPin}>
            {/* A farm calendar hung on a nail. Each year is a page; scrolling flips the page up and over, and the next year is underneath. */}
            <div className={s.calendar}>
              <h2 id="story-h" className={s.calTitle}>
                {c.story.heading}
              </h2>
              <ol className={s.calPages}>
                {steps.map((st, i) => (
                  <li key={st.year} className={s.calPage} data-step={i} data-state={i === 0 ? 'on' : 'off'} style={{ '--k': i, zIndex: steps.length - i } as CSSProperties}>
                    <div className={s.calFront}>
                      <span className={s.calRings} aria-hidden="true" />
                      <div className={s.calPhoto}>
                        <Pic pic={pic(data, st.image)} sizes="(min-width: 900px) 64vw, 92vw" />
                      </div>
                      <div className={s.calPad}>
                        <h3>
                          <span className={s.calYear}>{st.year}</span>{' '}
                          <span className={s.calLabel}>{st.label}</span>
                        </h3>
                        <p>{st.text}</p>
                      </div>
                    </div>
                    <span className={s.calBack} aria-hidden="true" />
                  </li>
                ))}
              </ol>
            </div>
          </Pinned>
        </section>

        <section className={s.team} id="team" aria-labelledby="team-h">
          <header className={s.teamHead}>
            <h2 id="team-h" data-reveal>
              {c.team.heading}
            </h2>
            <p data-reveal>{c.team.lead}</p>
          </header>
          <PaddockTeam className={s.pitch} wines={c.team.wines} hint={c.team.hint} label={c.team.heading} />
        </section>

        <section className={s.farm} aria-labelledby="farm-h">
          <div className={s.farmMedia}>
            <Pic pic={pic(data, 'farm')} phone={data.images.farmPhone} sizes="100vw" parallax />
          </div>
          <div className={s.bands}>
            <p className={s.bandKicker}>
              <span>{c.farm.kicker}</span>
            </p>
            <h2 id="farm-h" className={s.bandHead}>
              <span>{c.farm.heading}</span>
            </h2>
            {c.farm.lines.map((l, i) => (
              <p key={l} className={s.bandLine} data-side={i % 2 ? 'right' : 'left'}>
                <span>{l}</span>
              </p>
            ))}
          </div>
        </section>

        <section className={s.visit} id="visit" aria-labelledby="visit-h">
          <header className={s.visitHead}>
            <h2 id="visit-h" data-reveal>
              {c.visit.heading}
            </h2>
            <p data-reveal>{c.visit.lead}</p>
          </header>
          <div className={s.board}>
            <div className={s.free} data-reveal>
              <p className={s.freeWord} aria-hidden="true" style={{ backgroundImage: `url(${pic(data, 'pour').fallback})` }}>
                {c.visit.free.word}
              </p>
              <p className={s.freeText}>{c.visit.free.text}</p>
            </div>
            <div className={s.guest} data-wipe>
              <Pic pic={pic(data, 'guest')} sizes="(min-width: 900px) 30vw, 100vw" />
            </div>
            {c.visit.tiles.map((t, i) => (
              <div key={t.title} className={s.tile} data-tone={i % 4} data-reveal>
                <Icon name={t.icon} className={s.icon!} />
                <h3>{t.title}</h3>
                <p>{t.text}</p>
              </div>
            ))}
            <div className={s.away} data-reveal>
              <h3>{c.visit.away.title}</h3>
              <p>{c.visit.away.text}</p>
              <p className={s.awayExtra}>{c.visit.away.extra}</p>
              <a className={s.awayLink} data-press {...book}>
                {c.visit.away.link}
                <Arrow />
              </a>
            </div>
          </div>
        </section>

        <section className={s.hours} id="hours" aria-labelledby="hours-h">
          <header className={s.hoursHead}>
            <h2 id="hours-h" data-reveal>
              {c.hours.heading}
            </h2>
            <p data-reveal>{c.hours.lead}</p>
          </header>
          <PaddockYear className={s.year} hours={c.hours} />
        </section>

        <section className={s.proof} aria-labelledby="proof-h">
          <h2 id="proof-h" className={s.proofHead} data-reveal>
            {c.proof.heading}
          </h2>
          <figure className={s.quote} data-reveal>
            <blockquote>
              <p>“{c.proof.quote}”</p>
            </blockquote>
            <figcaption>
              <b>{c.proof.by}</b>
              <cite>{c.proof.source}</cite>
            </figcaption>
          </figure>
          <ul className={s.rosettes}>
            {c.proof.awards.map((a, i) => (
              <li key={a.title} className={s.rosette} data-tone={i} style={{ '--i': i } as CSSProperties}>
                <span className={s.ribbon} aria-hidden="true">
                  <span className={s.tails} />
                  <span className={s.frill} />
                  <span className={s.disc}>
                    <b>{a.title}</b>
                    <i>{a.year}</i>
                  </span>
                </span>
                <p className={s.award}>
                  <b>{a.wine}</b>
                  <span>
                    {a.title}, {a.event} {a.year}
                  </span>
                </p>
              </li>
            ))}
          </ul>
          <p className={s.aside} data-reveal>
            “{c.proof.aside}” <span>{c.proof.by}</span>
          </p>
        </section>

        <section className={s.find} id="find" aria-labelledby="find-h">
          <header className={s.findHead}>
            <h2 id="find-h" data-reveal>
              {c.find.heading}
            </h2>
            <p data-reveal>{c.find.lead}</p>
          </header>
          <div className={s.junction}>
            <div className={s.gate} data-wipe>
              <Pic pic={pic(data, 'gate')} sizes="(min-width: 900px) 34vw, 70vw" />
            </div>
            <svg className={s.map} viewBox="0 0 320 420" aria-hidden="true" focusable="false">
              <path className={s.roadBed} d="M200 -10V430" />
              <path className={s.roadBed} d="M-20 40C60 90 150 160 200 250" />
              <path className={s.roadLine} d="M200 -10V430" pathLength={1} />
              <path className={s.roadLine} data-late="" d="M-20 40C60 90 150 160 200 250" pathLength={1} />
              {c.find.roads[0] && <Shield code={c.find.roads[0].code} x={236} y={70} size={1.25} className={s.shieldMark!} />}
              {c.find.roads[1] && <Shield code={c.find.roads[1].code} x={92} y={62} size={1.25} className={s.shieldMark!} />}
              <g className={s.pin} transform="translate(200 250)">
                <circle r="16" />
                <circle r="6" />
              </g>
            </svg>
            <ul className={s.roadNames}>
              {c.find.roads.map((r) => (
                <li key={r.code}>{r.name}</li>
              ))}
            </ul>
          </div>
          <div className={s.signposts}>
            <span className={s.pole} aria-hidden="true" />
            <a className={s.finger} data-dir="right" data-main="" data-press {...book}>
              <span>{c.book.label}</span>
            </a>
            <a className={s.finger} data-dir="left" data-press href={c.call.tel}>
              <small>{c.find.callLabel}</small>
              <span>{c.call.display}</span>
            </a>
            <a className={s.finger} data-dir="right" data-press href={mail}>
              <small>{c.find.emailLabel}</small>
              <span>{c.email}</span>
            </a>
            {c.mobile && (
              <a className={s.finger} data-dir="left" data-press href={c.mobile.tel}>
                <small>{c.mobile.label}</small>
                <span>{c.mobile.display}</span>
              </a>
            )}
          </div>
          <div className={s.findText}>
            <address>
              {c.find.address.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </address>
            <p>{c.find.junction}</p>
            <p className={s.ring}>{c.find.ring}</p>
            <p className={s.people}>{c.find.people}</p>
          </div>
        </section>
      </main>

      <footer className={s.foot}>
        <p className={s.footLine}>{c.foot.line}</p>
        <p className={s.footPost}>{c.foot.post}</p>
        <DemoFoot domain={data.domain} />
      </footer>

      <StickyBar main={{ label: c.book.label, href: c.book.href, external: true }} call={{ label: c.call.label, tel: c.call.tel }} />
    </div>
  );
}

export const paddock: Design = { Demo, fonts: ['big-shoulders-display-latin-wght-normal', 'literata-latin-wght-normal'], heroSizes: '(min-width: 900px) 27vw, 56vw' };
