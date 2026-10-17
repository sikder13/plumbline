import { type CSSProperties, type ReactNode } from 'react';
import { AfootSpotter } from '@/components/AfootSpotter';
import { AfootTally } from '@/components/AfootTally';
import { AfootTrailhead } from '@/components/AfootTrailhead';
import { AfootValley } from '@/components/AfootValley';
import { AfootWarm } from '@/components/AfootWarm';
import { DemoFoot } from '@/components/DemoFoot';
import { Pic } from '@/components/Pic';
import { Pinned } from '@/components/Pinned';
import { SectionLinks } from '@/components/SectionLinks';
import { StickyBar } from '@/components/StickyBar';
import { pic, type PageData } from '@/lib/data';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Fact {
  label: string;
  value: string;
}

interface Content {
  wordmark: string[];
  nav: { label: string; href: string }[];
  book: { label: string; href: string };
  call: { label: string; tel: string; display: string[]; digits: string };
  email: string;
  hero: { lines: string[]; sub: string; signLabel: string; walks: { name: string; time: string; priceLabel: string; price: string; image: string; phone: string }[] };
  path: { kicker: string; heading: string; steps: { year: string; title: string; text: string }[]; iceLabel: string };
  walks: {
    kicker: string;
    heading: string;
    mapLabel: string;
    fullLabel: string;
    bookLabel: string;
    /** Each walk's line: the distance it states (or the shortest and longest of a range), or none, when it is drawn without scale. */
    lanes: { name: string; km?: number[]; label: string; step: number }[];
    fullLanes: { name: string; parts?: number[]; label: string }[];
    items: { title: string; text: string; facts: string[]; prices: Fact[]; image: string }[];
    more: {
      heading: string;
      text: string;
      image: string;
      combos: { name: string; facts: string[]; price: string }[];
      priceLabel: string;
      private: string;
      enquire: { label: string; subject: string };
    };
  };
  birds: { kicker: string; heading: string; lead: string; hint: string; items: { name: string; label: string; image: string; x: number; y: number }[] };
  early: { kicker: string; heading: string; text: string; traps: number; trapsLabel: string; volunteers: string; volunteersLabel: string; plant: { heading: string; lines: string[]; image: string } };
  family: { kicker: string; heading: string; people: { name: string; role: string }[]; home: string; homeLine: string; statement: string; image: string };
  word: { heading: string; quote: string; by: string; ratingLabel: string; ratingUnit: string; ratingSource: string };
  end: { heading: string; line: string; callNote: string; signLabel: string; address: string[]; boardLabel: string };
  bar: { label: string };
}

/** A few closed contour lines, as on a topographic map, drawn behind a section. Decoration only. */
function Contours({ className }: { className?: string }) {
  const rings = [
    'M120 40c70-22 160-10 196 34s8 112-58 134-162 10-200-36-8-110 62-132Z',
    'M132 66c52-16 118-6 144 26s4 82-44 98-118 6-146-26-6-82 46-98Z',
    'M146 92c34-10 76-2 92 18s2 52-28 62-76 4-94-16-4-54 30-64Z',
    'M160 116c16-4 34 0 42 8s0 22-12 26-34 2-42-6-2-24 12-28Z',
    'M40 250c90-40 260-46 340 6M10 300c120-56 330-60 420 4M60 20c-40 30-52 90-30 140',
  ];
  return (
    <svg className={className} viewBox="0 0 440 320" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      {rings.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** A heading in which any ampersand is set apart, in the italic. */
function withAmp(text: string, amp?: string): ReactNode {
  return text.split('&').map((p, i) => (
    <span key={i}>
      {i > 0 && <em className={amp}>&amp;</em>}
      {p}
    </span>
  ));
}

/** Where each year's flag stands on the map, in the map's own units: on the ice, at the closed mark, at the new lookout. */
const FLAGS: [number, number][] = [
  [770, 240],
  [640, 258],
  [332, 150],
];

/**
 * Glacier Country on foot, as one walking track. It is drawn from the headline through a signpost of
 * walks into the booking button; it runs up a drawn valley for the story of the business; it measures
 * every walk on a map; and it runs down the close of the page to the trailhead.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('afoot', ['Fraunces', 'Geologica']);
  const c = data.demo as Content;
  const book = { href: c.book.href, rel: 'noopener' };
  const steps = c.path.steps;
  const w = c.walks;
  const docks = w.items.length + 1;
  const scale = Math.max(...w.fullLanes.map((l) => (l.parts ?? [0]).reduce((a, b) => a + b, 0)), ...w.lanes.map((l) => Math.max(...(l.km ?? [0]))));
  const mail = `mailto:${c.email}`;

  return (
    <div className={s.root}>
      <style href="afoot" precedence="design">
        {css}
      </style>

      <nav className={s.gauge} aria-label="Sections">
        <SectionLinks className={s.gaugeLinks} items={c.nav} />
      </nav>

      <section className={s.hero} id="top" data-hero>
        <AfootTrailhead
          label={c.hero.signLabel}
          walks={c.hero.walks.map((h) => ({ name: h.name, time: h.time, priceLabel: h.priceLabel, price: h.price }))}
          pictures={[
            <Pic key="hero" pic={pic(data, 'hero')} phone={data.images.heroPhone} sizes="100vw" first />,
            ...c.hero.walks.map((h) => <Pic key={h.image} pic={pic(data, h.image)} phone={data.images[h.phone]} sizes="100vw" />),
          ]}
          cls={{ photos: s.heroPics, photo: s.heroPic, trail: s.trailLine, walker: s.walker, sign: s.sign, board: s.board }}
        />
        <a className={s.mark} href="#top">
          {data.name}
        </a>
        <h1 className={s.heroTitle}>
          <span className={s.line}>
            <span>
              {c.hero.lines.join(' ')}
              <i className={s.trailStart} data-trail-start />
            </span>
          </span>
        </h1>
        <div className={s.band}>
          <p className={s.heroSub}>{c.hero.sub}</p>
          <div className={s.heroActs}>
            <a className={s.go} data-press data-magnetic {...book}>
              {c.book.label}
            </a>
            <a className={s.heroCall} href={c.call.tel}>
              {c.call.display.join(' ')}
            </a>
          </div>
        </div>
      </section>

      <main>
        <section className={s.path} id="path" aria-labelledby="path-h">
          <Pinned steps={steps.length} className={s.story}>
            <header className={s.storyHead}>
              <p className={s.kicker}>{c.path.kicker}</p>
              <h2 id="path-h">{c.path.heading}</h2>
            </header>
            <div className={s.valleyBox}>
              <AfootValley className={s.valley} />
              <span className={s.iceLabel} aria-hidden="true">
                {c.path.iceLabel}
              </span>
              {steps.map((st, i) => (
                <span key={st.year} className={s.flag} data-step={i} data-state={i === 0 ? 'on' : 'off'} aria-hidden="true" style={{ '--fx': FLAGS[i]?.[0] ?? 0, '--fy': FLAGS[i]?.[1] ?? 0 } as CSSProperties}>
                  {st.year}
                </span>
              ))}
            </div>
            <ol className={s.notes}>
              {steps.map((st, i) => (
                <li key={st.year} data-step={i} data-state={i === 0 ? 'on' : 'off'}>
                  <p className={s.noteYear}>{st.year}</p>
                  <h3>{st.title}</h3>
                  <p className={s.noteText}>{st.text}</p>
                </li>
              ))}
            </ol>
          </Pinned>
        </section>

        <section className={s.walks} id="walks" aria-labelledby="walks-h">
          <div className={s.mapWrap}>
            <Pinned steps={docks} className={s.trail} style={{ '--n': docks } as CSSProperties}>
              <header className={s.trailHead}>
                <p className={s.kicker}>{w.kicker}</p>
                <h2 id="walks-h">{w.heading}</h2>
              </header>
              <div className={s.map} role="group" aria-label={w.mapLabel}>
                {w.lanes.map((l) => {
                  const far = l.km ? Math.max(...l.km) : 0;
                  const near = l.km ? Math.min(...l.km) : 0;
                  return (
                    <div
                      key={l.name}
                      className={s.lane}
                      data-step={l.step}
                      data-state={l.step === 0 ? 'on' : 'off'}
                      data-stub={l.km ? undefined : ''}
                      style={{ '--i': l.step, '--len': l.km ? (far / scale).toFixed(4) : 0, '--near': l.km ? (near / far).toFixed(4) : 1 } as CSSProperties}
                    >
                      <span className={s.laneName}>{l.name}</span>
                      <span className={s.laneKm}>{l.label}</span>
                      <span className={s.laneLine} aria-hidden="true">
                        <i data-walked />
                        <b data-walker />
                      </span>
                    </div>
                  );
                })}
                <p className={s.fullLabel}>{w.fullLabel}</p>
                {w.fullLanes.map((l) => {
                  const total = (l.parts ?? []).reduce((a, b) => a + b, 0);
                  return (
                    <div
                      key={l.name}
                      className={`${s.lane} ${s.fullLane}`}
                      data-step={w.items.length}
                      data-state="off"
                      data-stub={l.parts ? undefined : ''}
                      style={{ '--i': w.items.length, '--len': l.parts ? (total / scale).toFixed(4) : 0, '--near': 1 } as CSSProperties}
                    >
                      <span className={s.laneName}>{l.name}</span>
                      <span className={s.laneKm}>{l.label}</span>
                      <span className={s.laneLine} aria-hidden="true">
                        <i data-walked />
                        {(l.parts ?? []).slice(0, -1).map((p, k) => (
                          <em key={k} data-join style={{ '--at': ((l.parts ?? []).slice(0, k + 1).reduce((a, b) => a + b, 0) / total).toFixed(4) } as CSSProperties} />
                        ))}
                        <b data-walker />
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className={s.docks}>
                {w.items.map((it, i) => (
                  <article key={it.title} className={s.dock} data-step={i} data-dock={i} data-state={i === 0 ? 'on' : 'off'}>
                    <div className={s.dockPic}>
                      <Pic pic={pic(data, it.image)} sizes="(min-width: 900px) 38vw, 92vw" />
                    </div>
                    <div className={s.dockText}>
                      <h3>{it.title}</h3>
                      <p className={s.dockLead}>{it.text}</p>
                      <ul className={s.facts}>
                        {it.facts.map((f) => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>
                      <div className={s.buy}>
                        <p className={s.fares}>
                          {it.prices.map((p) => (
                            <span key={p.label}>
                              <small>{p.label}</small> <b>{p.value}</b>
                            </span>
                          ))}
                        </p>
                        <a className={s.go} data-press {...book}>
                          {w.bookLabel}
                        </a>
                      </div>
                    </div>
                  </article>
                ))}
                <article className={`${s.dock} ${s.dockFull}`} data-step={w.items.length} data-dock={w.items.length} data-state="off">
                  <div className={s.dockPic}>
                    <Pic pic={pic(data, w.more.image)} sizes="(min-width: 900px) 38vw, 92vw" />
                  </div>
                  <div className={s.dockText}>
                    <h3>{w.more.heading}</h3>
                    <p className={s.dockLead}>{w.more.text}</p>
                    <ul className={s.combos}>
                      {w.more.combos.map((m) => (
                        <li key={m.name}>
                          <b>{m.name}</b>
                          <span>{m.facts.join(', ')}</span>
                          <em>
                            {m.price} <small>{w.more.priceLabel}</small>
                          </em>
                        </li>
                      ))}
                    </ul>
                    <div className={s.moreActs}>
                      <a className={s.go} data-press {...book}>
                        {c.book.label}
                      </a>
                      <a className={s.ghost} href={`${mail}?subject=${encodeURIComponent(w.more.enquire.subject)}`}>
                        {w.more.enquire.label}
                      </a>
                    </div>
                  </div>
                </article>
              </div>
            </Pinned>
          </div>
        </section>

        <section className={s.birds} id="birds" aria-labelledby="birds-h">
          <header className={s.birdsHead}>
            <p className={`${s.kicker} ${s.wipe}`}>{c.birds.kicker}</p>
            <h2 id="birds-h" className={s.wipe}>
              {c.birds.heading}
            </h2>
            <p className={s.birdsLead}>{c.birds.lead}</p>
          </header>
          <AfootSpotter
            className={s.spotter}
            label={c.birds.heading}
            hint={c.birds.hint}
            birds={c.birds.items.map((b) => ({
              name: b.name,
              label: b.label,
              x: b.x,
              y: b.y,
              sharp: <Pic pic={pic(data, b.image)} sizes="(min-width: 900px) 40vw, 92vw" />,
            }))}
          />
        </section>

        <div className={s.closing}>
          <Contours className={s.contours} />
          <span className={s.closeTrail} aria-hidden="true" />

          <section className={s.early} id="early" aria-labelledby="early-h">
            <span className={s.wayMark} aria-hidden="true" />
            <div className={s.earlyHead}>
              <p className={s.kicker}>{c.early.kicker}</p>
              <h2 id="early-h" className={s.wipe}>
                {c.early.heading}
              </h2>
              <p className={s.earlyText}>{c.early.text}</p>
            </div>
            <div className={s.count}>
              <AfootTally className={s.tally} count={c.early.traps} />
              <p className={s.traps}>
                <b>{String(c.early.traps)}</b>
                <span>{c.early.trapsLabel}</span>
              </p>
              <p className={s.crew}>
                <b>{c.early.volunteers}</b>
                <span>{c.early.volunteersLabel}</span>
              </p>
            </div>
            <div className={s.plant}>
              <div className={s.plantPic}>
                <Pic pic={pic(data, c.early.plant.image)} sizes="(min-width: 900px) 14vw, 30vw" />
              </div>
              <div className={s.plantText}>
                <h3>{c.early.plant.heading}</h3>
                {c.early.plant.lines.map((l) => (
                  <p key={l}>{l}</p>
                ))}
              </div>
            </div>
          </section>

          <section className={s.family} id="family" aria-labelledby="family-h">
            <span className={s.wayMark} aria-hidden="true" />
            <div className={s.familyHead}>
              <p className={s.kicker}>{c.family.kicker}</p>
              <h2 id="family-h" className={s.wipe}>
                {withAmp(c.family.heading, s.amp)}
              </h2>
              <blockquote className={s.statement}>
                <p>{c.family.statement}</p>
              </blockquote>
            </div>
            <div className={s.fork}>
              <svg className={s.forkLines} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <path d="M50 0 C50 8 25 6 25 16V64 C25 76 50 72 50 84V100M50 0 C50 8 75 6 75 16V64 C75 76 50 72 50 84" />
              </svg>
              <ul className={s.people}>
                {c.family.people.map((p) => (
                  <li key={p.name}>
                    <b>{p.name}</b>
                    <span>{p.role}</span>
                  </li>
                ))}
              </ul>
              <div className={s.homeCard}>
                <div className={s.homePic}>
                  <Pic pic={pic(data, c.family.image)} sizes="(min-width: 900px) 40vw, 86vw" />
                </div>
                <p className={s.homeName}>{c.family.home}</p>
                <p className={s.homeLine}>{c.family.homeLine}</p>
              </div>
            </div>
          </section>

          <section className={s.word} aria-labelledby="word-h">
            <span className={s.wayMark} aria-hidden="true" />
            <h2 id="word-h" className={s.wordHead}>
              {c.word.heading}
            </h2>
            <figure className={s.review}>
              <blockquote>
                <p>{c.word.quote}</p>
              </blockquote>
              <figcaption>
                <span className={s.byLine}>{c.word.by}</span>
                {data.rating && (
                  <span className={s.rated}>
                    {data.rating.value} {c.word.ratingLabel} {String(data.rating.count)} {c.word.ratingUnit} <small>{c.word.ratingSource}</small>
                  </span>
                )}
              </figcaption>
            </figure>
          </section>

          <section className={s.end} id="contact" aria-labelledby="end-h">
            <span className={`${s.wayMark} ${s.wayEnd}`} aria-hidden="true" />
            <div className={s.endHead}>
              <h2 id="end-h" className={s.wipe}>
                {c.end.heading}
              </h2>
              <p className={s.endLine}>{c.end.line}</p>
            </div>
            <div className={s.trailhead}>
              <p className={s.boardLabel}>{c.end.boardLabel}</p>
              <a className={s.vanity} href={c.call.tel}>
                <small>{c.end.callNote}</small>
                <span>{c.call.display[0]}</span>
                <b>{c.call.display.slice(1).join(' ')}</b>
                <em>{c.call.digits}</em>
              </a>
              <div className={s.address} role="group" aria-label={c.end.signLabel}>
                <small>{c.end.signLabel}</small>
                {c.end.address.map((a) => (
                  <span key={a}>{a}</span>
                ))}
                <a className={s.mail} href={mail}>
                  {c.email}
                </a>
              </div>
              <a className={`${s.go} ${s.signGo}`} data-press data-magnetic {...book}>
                {c.book.label}
              </a>
            </div>
          </section>
        </div>
      </main>

      <footer className={s.foot}>
        <span className={s.trailEnd} aria-hidden="true" />
        <DemoFoot domain={data.domain} />
      </footer>

      <nav className={s.deskBar} aria-label="Book a walk">
        <span className={s.deskName}>{c.bar.label}</span>
        <a className={s.deskCall} href={c.call.tel}>
          {c.call.display.join(' ')}
        </a>
        <a className={s.deskGo} data-press {...book}>
          {c.book.label}
        </a>
      </nav>

      <AfootWarm scope={s.root!} />
      <StickyBar main={{ label: c.book.label, href: c.book.href, external: true }} call={{ label: c.call.label, tel: c.call.tel }} />
    </div>
  );
}

export const afoot: Design = { Demo, fonts: ['fraunces-latin-wght-normal'], heroSizes: '100vw' };
