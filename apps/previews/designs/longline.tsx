import type { CSSProperties } from 'react';
import { DemoFoot } from '@/components/DemoFoot';
import { LonglineDeck, type DeckMode } from '@/components/LonglineDeck';
import { LonglineMotion } from '@/components/LonglineMotion';
import { LonglineTray } from '@/components/LonglineTray';
import { Pic } from '@/components/Pic';
import { Pinned } from '@/components/Pinned';
import { SectionLinks } from '@/components/SectionLinks';
import { StickyBar } from '@/components/StickyBar';
import { pic, type PageData } from '@/lib/data';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Link {
  label: string;
  href: string;
}

interface Price {
  label: string;
  value: string;
  unit: string;
}

interface Content {
  wordmark: string;
  nav: Link[];
  book: Link;
  call: { label: string; tel: string; display: string };
  email: string;
  hero: { kicker: string; place: string; lines: string[]; lead: string; prices: Price[]; boat: string };
  boat: { heading: string; name: string; notes: { title: string; text: string }[]; photoLabel: string; photoText: string };
  lines: { heading: string; run: string[]; text: string; fish: string[]; bed: string };
  deck: {
    kicker: string;
    heading: string;
    steps: string[];
    confirm: string;
    slotsLabel: string;
    slots: string[];
    sails: string;
    upTo: string;
    note: string;
    modes: DeckMode[];
    fine: string[];
  };
  bring: { label: string; heading: string; lead: string; toggle: string; price: string; own: string; board: string; items: { name: string; note?: string; hire?: boolean }[]; note: string };
  end: {
    kicker: string;
    heading: string;
    lead: string;
    memory: string;
    sequence: { when: string; what: string }[];
    doors: { kicker: string; price: string; unit: string; text: string; label: string; href: string }[];
    mail: { label: string; subject: string };
    callNote: string;
    where: { label: string; lines: string[] };
  };
}

type S = Record<string, string>;

/** The hull of the boat seen side on, bow to the right. */
const HULL = 'M118 212L132 296L690 304C812 306 922 288 992 196C780 194 450 200 118 212Z';

/**
 * The boat drawn side on and painted flat: a long aluminium hull with a dark bottom, a cabin forward,
 * a shade roof over the back deck, rods racked behind it, and white water where the jet and the bow
 * meet the sea. Each part is marked so the styles can paint and move it.
 */
function BoatSide({ id, name }: { id: string; name: string }) {
  return (
    <svg viewBox="0 0 1000 400" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={`${id}-hull`}>
          <path d={HULL} />
        </clipPath>
      </defs>
      <g data-part="wake">
        <path d="M140 300C60 296-40 306-190 300L-190 316C-40 322 60 318 140 316Z" />
        <path d="M60 322C10 324-60 330-150 328" data-line="" />
      </g>
      <g data-part="rods">
        <path d="M254 102Q232 60 196 22" />
        <path d="M268 102Q252 54 226 10" />
        <path d="M282 102Q276 50 262 4" />
        <path d="M296 102Q300 52 300 6" />
        <path d="M310 102Q324 56 338 14" />
        <path d="M324 102Q346 62 372 26" />
      </g>
      <g data-part="mast">
        <path d="M690 100V40M672 58H708M742 100L758 8" />
        <rect x="664" y="28" width="52" height="12" rx="6" />
      </g>
      <g data-part="posts">
        <rect x="258" y="112" width="5" height="96" />
        <rect x="396" y="112" width="5" height="96" />
        <path d="M120 194H250M140 194V212M175 194V211M212 194V210" data-rail="" />
      </g>
      <g data-part="cabin">
        <path d="M540 207V120L806 112L884 202Z" data-body="" />
        <path d="M556 130L796 124L846 178L556 180Z" data-glass="" />
        <path d="M616 127V180M676 125V180M736 124V180" data-mull="" />
      </g>
      <g data-part="roof">
        <rect x="246" y="98" width="572" height="14" rx="4" data-slab="" />
        <rect x="250" y="110" width="556" height="7" data-fascia="" />
      </g>
      <g data-part="hull">
        <path d={HULL} data-fill="" />
        <g clipPath={`url(#${id}-hull)`}>
          <path d="M0 252L1000 234V400H0Z" data-shade="" />
          <path d="M0 288L1000 258V400H0Z" data-keel="" />
        </g>
        <path d="M120 220C450 208 780 202 986 203" data-rub="" />
        <text x="842" y="250" data-name="">
          {name}
        </text>
      </g>
      <g data-part="jet">
        <path d="M134 292C104 262 74 238 30 230C8 228-14 236-30 248C0 252 30 266 54 290C70 304 100 312 134 312Z" />
        <circle cx="18" cy="212" r="6" />
        <circle cx="-8" cy="226" r="4" />
        <circle cx="46" cy="204" r="3.5" />
      </g>
      <path data-part="foam" d="M150 304C420 314 700 316 880 300C940 294 980 282 1004 270L1012 284C960 312 820 326 690 328C480 330 300 324 150 318Z" />
      <g data-part="spray">
        <path d="M600 300C720 300 830 292 906 262C934 250 962 256 990 270C1010 280 1030 292 1050 300C1000 314 940 322 880 324C780 328 680 322 600 314Z" />
        <circle cx="1012" cy="260" r="6" />
        <circle cx="1036" cy="276" r="4" />
        <circle cx="996" cy="246" r="3.5" />
        <circle cx="1056" cy="290" r="5" />
      </g>
    </svg>
  );
}

/** The boat seen from above, small, for the trip home. */
function BoatTop() {
  return (
    <svg viewBox="0 0 120 44" aria-hidden="true" focusable="false">
      <path d="M8 8L76 6C96 6 112 14 118 22C112 30 96 38 76 38L8 36C5 30 5 14 8 8Z" />
      <rect x="66" y="12" width="28" height="20" rx="5" data-cabin="" />
    </svg>
  );
}

/** Rows of mussel farm floats running to the horizon: far rows small and slow, the near row large and quick. */
const ROWS = [
  { y: 0, t: 4, s: 22, r: 2.2, d: 1.5 },
  { y: 1, t: 13, s: 30, r: 3, d: 1.2 },
  { y: 2, t: 26, s: 42, r: 4.2, d: 1.05 },
  { y: 3, t: 44, s: 60, r: 5.8, d: 0.95 },
  { y: 4, t: 100, s: 118, r: 11, d: 1.1 },
];

function Floats({ s }: { s: S }) {
  return (
    <div className={s.floats} aria-hidden="true">
      {ROWS.map((r) => (
        <span key={r.y} className={s.row} style={{ '--k': r.y, '--t': `${r.t}px`, '--s': `${r.s}px`, '--r': `${r.r}px`, '--d': `${r.d}s` } as CSSProperties}>
          <i />
        </span>
      ))}
    </div>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Where each note leads out from the drawing, as a share of the drawing's width and height: the jet at
 * the stern, the deck under the roof, the hull at the bow. Lines run down into the sea or up into the sky.
 */
const LEADS: { x: number; y: number; len: number; dir: 'up' | 'down'; align: 'start' | 'end' }[] = [
  { x: 0.13, y: 0.7, len: 0.24, dir: 'down', align: 'start' },
  { x: 0.46, y: 0.4, len: 0.36, dir: 'up', align: 'start' },
  { x: 0.86, y: 0.62, len: 0.3, dir: 'down', align: 'end' },
];

/** Mussels that have lost their grip, falling past the droppers. */
const SHELLS = [0.08, 0.27, 0.41, 0.58, 0.74, 0.9];

/**
 * A day on the toughest boat in the harbour. The boat runs in on her wake under a split headline,
 * then passes full size with her parts called out and gives way to her own photograph; the fish
 * hang from the farm's floats while mussels drop; the trip slots are lines of floats that light up
 * to the number she sails at; the tackle tray shows what is on board; the day closes on a dropper
 * line and two ways in.
 */
function Demo({ data }: { data: PageData }) {
  const c = data.demo as Content;
  const { css, s } = designStyles('longline', ['Schibsted Grotesk', 'IBM Plex Sans']);
  const book = { href: c.book.href, rel: 'noopener' };
  const shared = c.hero.prices[0]!;
  const mailEnd = `mailto:${c.email}?subject=${encodeURIComponent(c.end.mail.subject)}`;
  return (
    <div className={s.root}>
      <style href="longline" precedence="design">
        {css}
      </style>
      <LonglineMotion />

      <nav className={s.dock} aria-label="Sections">
        <SectionLinks className={s.dockLinks} items={c.nav} />
        <a className={s.dockBook} data-press {...book}>
          {c.book.label}
          <span>
            {shared.value} {shared.unit}
          </span>
        </a>
      </nav>

      <section className={s.hero} id="top" data-hero>
        <div className={s.sky}>
          <div className={s.top}>
            <a className={s.mark} href="#top" aria-label={data.name}>
              <i aria-hidden="true" />
              <span>{c.wordmark}</span>
            </a>
            <p className={s.place}>
              <span>{c.hero.place}</span>
              <a href={c.call.tel}>{c.call.display}</a>
            </p>
          </div>
          <p className={s.kicker}>{c.hero.kicker}</p>
          <h1 className={s.title} aria-label={c.hero.lines.join(' ')}>
            {c.hero.lines.map((l, i) => (
              <span key={l} className={s.line} aria-hidden="true" data-line={i}>
                <span style={{ '--i': i } as CSSProperties}>{l}</span>
              </span>
            ))}
          </h1>
        </div>
        <div className={s.water}>
          <Floats s={s} />
          <span className={s.trail} aria-hidden="true" />
          <div className={s.heroBoat}>
            <div className={`${s.ride} ${s.paint}`}>
              <BoatSide id="hero-boat" name={c.hero.boat} />
            </div>
          </div>
          <div className={s.heroFoot}>
            <p className={s.lead}>{c.hero.lead}</p>
            <ul className={s.prices}>
              {c.hero.prices.map((p) => (
                <li key={p.label}>
                  <span>{p.label}</span>
                  <b>{p.value}</b>
                  <small>{p.unit}</small>
                </li>
              ))}
            </ul>
            <a className={s.go} data-press data-magnetic {...book}>
              {c.book.label}
              <Arrow />
            </a>
          </div>
        </div>
      </section>

      <main>
        <section className={s.boat} id="boat" aria-labelledby="boat-h">
          <Pinned steps={4} className={s.story}>
            <h2 id="boat-h" className={s.boatTitle}>
              {c.boat.heading}
            </h2>
            <div className={s.stage}>
              <div className={s.rig}>
                <div className={`${s.rigBoat} ${s.paint}`}>
                  <BoatSide id="rig-boat" name={c.boat.name} />
                </div>
                {c.boat.notes.map((n, i) => {
                  const at = LEADS[i % LEADS.length]!;
                  return (
                    <div
                      key={n.title}
                      className={s.callout}
                      data-step={i}
                      data-state={i === 0 ? 'on' : 'off'}
                      data-dir={at.dir}
                      data-align={at.align}
                      style={{ '--x': at.x, '--y': at.y, '--len': at.len } as CSSProperties}
                    >
                      <p>
                        <b>{n.title}</b>
                        <span>{n.text}</span>
                      </p>
                    </div>
                  );
                })}
              </div>
              <figure className={s.real} data-step={3} data-state="off">
                <Pic pic={pic(data, 'hero')} sizes="(min-width: 1260px) 1200px, 100vw" />
                <figcaption>
                  <b>{c.boat.photoLabel}</b> {c.boat.photoText}
                </figcaption>
              </figure>
            </div>
          </Pinned>
        </section>

        <section className={s.lines} id="lines" aria-labelledby="lines-h">
          <header className={s.linesHead}>
            <h2 id="lines-h" data-reveal>
              {c.lines.heading}
            </h2>
            <p className={s.run} data-reveal>
              {c.lines.run.map((r, i) =>
                i % 2 === 0 ? (
                  <b key={r}>{r}</b>
                ) : (
                  <span key={r}>
                    <Arrow />
                    {r}
                    <Arrow />
                  </span>
                ),
              )}
            </p>
          </header>
          <div className={s.farm} data-farm="">
            <ul className={s.droppers}>
              {c.lines.fish.map((f, i) => (
                <li key={f} style={{ '--n': i } as CSSProperties} data-last={i === c.lines.fish.length - 1 ? '' : undefined}>
                  <b>{f}</b>
                </li>
              ))}
            </ul>
            <span className={s.shells} aria-hidden="true">
              {SHELLS.map((x, i) => (
                <i key={x} style={{ '--x': x, '--n': i } as CSSProperties} />
              ))}
            </span>
            <p className={s.bed}>{c.lines.bed}</p>
          </div>
          <p className={s.linesText} data-reveal>
            {c.lines.text}
          </p>
        </section>

        <section className={s.deck} id="book" aria-labelledby="book-h">
          <header className={s.deckHead}>
            <h2 id="book-h" data-reveal>
              {c.deck.heading}
            </h2>
            <p className={s.steps} data-reveal>
              {c.deck.steps.map((st) => (
                <span key={st}>{st} </span>
              ))}
            </p>
            <p className={s.confirm} data-reveal>
              {c.deck.confirm}
            </p>
          </header>
          <LonglineDeck
            cls={{
              wrap: s.planner,
              tabs: s.tabs,
              slotsLabel: s.slotsLabel,
              rows: s.slotRows,
              row: s.slotRow,
              time: s.time,
              rope: s.rope,
              end: s.ropeEnd,
              say: s.say,
              word: s.word,
              acts: s.acts,
              go: s.go,
              ghost: s.ghost,
              sr: s.sr,
              note: s.deckNote,
            }}
            modes={c.deck.modes}
            slots={c.deck.slots}
            labels={{ slots: c.deck.slotsLabel, sails: c.deck.sails, upTo: c.deck.upTo, note: c.deck.note }}
            email={c.email}
          />
          <ul className={s.fine}>
            {c.deck.fine.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </section>

        <section className={s.bring} id="bring" aria-labelledby="bring-h">
          <header className={s.bringHead}>
            <p className={s.label}>{c.bring.label}</p>
            <h2 id="bring-h" data-reveal>
              {c.bring.heading}
            </h2>
            <p data-reveal>{c.bring.lead}</p>
          </header>
          <LonglineTray
            cls={{ wrap: s.tray, toggle: s.toggle, grid: s.cells, cell: s.cell, note: s.trayNote }}
            items={c.bring.items}
            labels={{ toggle: c.bring.toggle, price: c.bring.price, own: c.bring.own, board: c.bring.board, note: c.bring.note }}
          />
        </section>

        <section className={s.end} id="contact" aria-labelledby="end-h">
          <figure className={s.dusk} data-wipe>
            <Pic pic={pic(data, 'dusk')} sizes="(min-width: 1260px) 1200px, 100vw" />
            <figcaption>{c.end.memory}</figcaption>
          </figure>
          <header className={s.endHead}>
            <p className={s.kicker}>{c.end.kicker}</p>
            <h2 id="end-h" data-reveal>
              {c.end.heading}
            </h2>
            <p data-reveal>{c.end.lead}</p>
          </header>
          <ol className={s.seq}>
            {c.end.sequence.map((q, i) => (
              <li key={q.when} data-reveal style={{ '--n': i } as CSSProperties}>
                <i aria-hidden="true" />
                <b>{q.when}</b>
                <span>{q.what}</span>
              </li>
            ))}
          </ol>
          <div className={s.doors}>
            {c.end.doors.map((d, i) => (
              <div key={d.kicker} className={s.door} data-door={i} data-reveal>
                <p className={s.doorKicker}>{d.kicker}</p>
                <p className={s.doorPrice}>
                  <b>{d.price}</b> <span>{d.unit}</span>
                </p>
                <p className={s.doorText}>{d.text}</p>
                <a className={s.doorGo} href={d.href} rel={d.href.startsWith('http') ? 'noopener' : undefined} data-press>
                  {d.label}
                  <Arrow />
                </a>
                {i === 1 && (
                  <a className={s.doorMail} href={mailEnd}>
                    {c.end.mail.label}
                  </a>
                )}
              </div>
            ))}
          </div>
          <div className={s.endFoot}>
            <p className={s.callNote}>{c.end.callNote}</p>
            <address className={s.where}>
              <b>{c.end.where.label}</b>
              {c.end.where.lines.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </address>
          </div>
        </section>
      </main>

      <footer className={s.foot}>
        <div className={s.home} aria-hidden="true" data-home="">
          <span className={s.homeBoat}>
            <BoatTop />
          </span>
        </div>
        <DemoFoot domain={data.domain} />
      </footer>

      <StickyBar main={{ label: c.book.label, href: c.book.href, external: true }} call={{ label: c.call.label, tel: c.call.tel }} />
    </div>
  );
}

export const longline: Design = {
  Demo,
  fonts: ['schibsted-grotesk-latin-wght-normal', 'ibm-plex-sans-latin-wght-normal'],
  heroSizes: '(min-width: 1260px) 1200px, 100vw',
};
