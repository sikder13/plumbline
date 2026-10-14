import { Fragment, type CSSProperties } from 'react';
import { DemoFoot } from '@/components/DemoFoot';
import { HaulCrew } from '@/components/HaulCrew';
import { HaulKit } from '@/components/HaulKit';
import { HaulMotion } from '@/components/HaulMotion';
import { HaulReel } from '@/components/HaulReel';
import { HaulSwitch } from '@/components/HaulSwitch';
import { Pic } from '@/components/Pic';
import { StickyBar } from '@/components/StickyBar';
import { pic, type PageData, type Picture } from '@/lib/data';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Link {
  label: string;
  href: string;
}

interface Step {
  title: string;
  text: string;
  note?: string;
  image?: string;
  extra?: string;
  tags?: string[];
}

type Mark = 'length' | 'engines' | 'helm' | 'cabin';

interface Content {
  wordmark: string;
  book: Link;
  price: { value: string; unit: string; what: string; amount: number; symbol: string };
  call: { label: string; tel: string; display: string };
  mobile: { tel: string; display: string };
  email: string;
  hero: { lead: string; name: string; sub: string; dayLabel: string; day: string[] };
  haul: { kicker: string; heading: string; lead: string; steps: Step[] };
  skipper: { kicker: string; heading: string; lead: string; range: string; switchLabel: string; choices: { label: string; image: string; lines: string[] }[] };
  boat: {
    kicker: string;
    heading: string;
    lead: string;
    legend: { mark: Mark; text: string }[];
    crew: {
      min: number;
      comfort: number;
      max: number;
      words: string[];
      empty: string;
      group: string;
      add: string;
      remove: string;
      under: string;
      fits: string;
      roomy: string;
      full: string;
      short: string;
      fewer: string;
      times: string;
      mail: { label: string; subject: string; subjectNone: string; body: string };
    };
    trip: { name: string; facts: string[] };
    custom: { heading: string; ask: string; text: string; short: string; label: string; subject: string };
  };
  catch: { kicker: string; heading: string; text: string; prints: { image: string; shape: 'tall' | 'wide' }[] };
  kit: { kicker: string; heading: string; ready: string; bring: { label: string; items: string[] }; supply: { label: string; items: string[] }; answers: { q: string; a: string }[] };
  end: {
    kicker: string;
    heading: string;
    meet: string;
    parking: string;
    drive: string;
    talk: string;
    phoneLabel: string;
    mobileLabel: string;
    reply: string;
    wechat: { label: string; id: string };
    chinese: string;
    welcome: string;
    address: string;
    directions: Link;
    weather: string;
  };
}

type S = Record<string, string>;

/** On large screens the opening photograph fills the full height of the screen beside the headline, so it is drawn about 1.6 times as wide as the screen is tall. */
const HERO_SIZES = '(min-width: 1000px) calc(160vh - 58px), 100vw';

const HOOK = 'M17 8.6V40a8 8 0 0 1-16 0V28l5.5 6';

/** A fishing hook: the eye at the top, the shank, the bend and the barb. A hook that holds a button gets a halo, so it shows where it crosses it. */
function Hook({ className, halo }: { className?: string; halo?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 30 60" aria-hidden="true" focusable="false">
      {halo && <path d={HOOK} data-halo />}
      <circle cx="17" cy="5" r="3.6" />
      <path d={HOOK} />
    </svg>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
    </svg>
  );
}

/** A section's label, sometimes with a small piece of tackle before it: a sinker or a knot. */
function Drop({ s, label, mark }: { s: S; label: string; mark?: 'sinker' | 'knot' }) {
  return (
    <p className={s.drop} data-drop>
      {mark === 'sinker' && (
        <svg className={s.sinker} viewBox="0 0 20 30" aria-hidden="true" focusable="false">
          <circle cx="10" cy="4.2" r="2.8" data-eye />
          <path d="M10 8.5C5 14 3.6 20 5.6 24.6c1.6 3.6 7.2 3.6 8.8 0C16.4 20 15 14 10 8.5Z" />
        </svg>
      )}
      {mark === 'knot' && (
        <svg className={s.knot} viewBox="0 0 34 20" aria-hidden="true" focusable="false">
          <path d="M1 12h8c3 0 4-8 9-8 4 0 5 5 1 8-4 3-9 1-6-3 2-3 6-1 8 3h12" />
        </svg>
      )}
      <span>{label}</span>
    </p>
  );
}

/** The headline: a short lead line, then the name set large, a word to each mask so the words rise one after another. */
function Title({ s, lead, name }: { s: S; lead: string; name: string }) {
  return (
    <>
      <span className={s.titleLead}>
        <span style={{ '--i': 0 } as CSSProperties}>{lead}</span>
      </span>{' '}
      <span className={s.titleName}>
        {name.split(' ').map((w, i) => (
          <Fragment key={w}>
            {i > 0 && ' '}
            <span className={s.word}>
              <span style={{ '--i': i + 1 } as CSSProperties}>{w}</span>
            </span>
          </Fragment>
        ))}
      </span>
    </>
  );
}

/** A sentence with its first figure set apart, so a number the business gives reads first. */
function Figure({ s, text }: { s: S; text: string }) {
  const m = /^(.*?)(\d[\d,.]*\+?)(.*)$/.exec(text);
  if (!m) return <>{text}</>;
  return (
    <>
      {m[1]}
      <b className={s.num}>{m[2]}</b>
      {m[3]}
    </>
  );
}

/** One of their snapshots in the page's two colours, yellow and black. A full colour copy can lie over it, uncovered by the styles. */
function Duo({ s, p, sizes, colour, className }: { s: S; p: Picture; sizes: string; colour?: boolean; className?: string }) {
  return (
    <span className={`${s.duo} ${className ?? ''}`}>
      <Pic pic={p} sizes={sizes} />
      {colour && (
        <span className={s.tint} aria-hidden="true">
          <Pic pic={p} sizes={sizes} alt="" />
        </span>
      )}
    </span>
  );
}

/** The one price, as the business states it, set beside a booking button. */
function Price({ s, c, className }: { s: S; c: Content; className?: string }) {
  return (
    <p className={`${s.price} ${className ?? ''}`}>
      <span className={s.priceTag}>
        <b>{c.price.value}</b> {c.price.unit}
      </span>
      <small>{c.price.what}</small>
    </p>
  );
}

/* The plan of the boat from above, bow up, in a box 220 wide and 500 long. Ten places on board: eight on the open deck and two in the cabin. */
const SEATS: [number, number][] = [
  [56, 312],
  [164, 312],
  [56, 352],
  [164, 352],
  [56, 392],
  [164, 392],
  [56, 432],
  [164, 432],
  [84, 252],
  [136, 252],
];

function Plan({ s, comfort, wide }: { s: S; comfort: number; wide?: boolean }) {
  const body = (
    <g>
      <path className={s.planDim} d="M6 10V452M1 10h10M1 452h10" />
      <path className={s.planHull} d="M110 10C150 40 196 110 200 175V452H20V175C24 110 70 40 110 10Z" />
      <path className={s.planRail} d="M110 30C145 58 183 118 186 178V440H34V178C37 118 75 58 110 30Z" />
      <rect className={s.planCabin} x="46" y="150" width="128" height="128" rx="5" />
      <path className={s.planGlass} d="M54 166C80 150 140 150 166 166" />
      <rect className={s.planPart} x="58" y="176" width="26" height="26" />
      <rect className={s.planPart} x="128" y="178" width="30" height="18" />
      <rect className={s.planMotor} x="58" y="452" width="34" height="36" rx="6" />
      <rect className={s.planMotor} x="128" y="452" width="34" height="36" rx="6" />
      <rect className={s.planBoard} x="94" y="410" width="32" height="34" />
      {SEATS.map(([x, y], i) => (
        <g key={i} className={s.seat} data-extra={i >= comfort ? '' : undefined} style={{ '--i': i } as CSSProperties} transform={`translate(${x} ${y})`}>
          <circle className={s.seatRing} r="14" />
          <g className={s.seatGuest}>
            <circle r="14" />
            <circle r="5.6" data-head />
          </g>
        </g>
      ))}
      <rect className={s.planMark} data-mark="cabin" x="64" y="182" width="14" height="14" />
      <path className={s.planMark} data-mark="helm" d="M143 177l8 8-8 8-8-8z" />
      <circle className={s.planMark} data-mark="engines" cx="75" cy="470" r="7" />
      <circle className={s.planMark} data-mark="engines" cx="145" cy="470" r="7" />
      <rect className={s.planMark} data-mark="length" x="2" y="226" width="8" height="10" />
    </g>
  );
  return wide ? (
    <svg className={`${s.plan} ${s.planWide}`} viewBox="0 0 500 220" aria-hidden="true" focusable="false">
      <g transform="translate(500 0) rotate(90)">{body}</g>
    </svg>
  ) : (
    <svg className={`${s.plan} ${s.planTall}`} viewBox="0 0 220 500" aria-hidden="true" focusable="false">
      {body}
    </svg>
  );
}

function LegendMark({ s, mark }: { s: S; mark: Mark }) {
  return (
    <svg className={s.legendMark} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      {mark === 'cabin' && <rect x="4" y="4" width="12" height="12" />}
      {mark === 'helm' && <path d="M10 2l8 8-8 8-8-8z" />}
      {mark === 'engines' && <circle cx="10" cy="10" r="6.5" />}
      {mark === 'length' && <path d="M2 4v12M18 4v12M2 10h16" data-line />}
    </svg>
  );
}

/**
 * A day on one man's yellow boat, told as a line. It drops from the top of the opening screen behind
 * the boat's name to a hook that holds the booking. Then a reel hauls the day up in order: the pots,
 * the fish on a rig, the catch on the filleting board. The plan of the boat takes the visitor's group
 * aboard; their guests' catches hang from the line; and the page ends at the boat itself, its
 * numbers sign-written on the hull.
 */
function Demo({ data }: { data: PageData }) {
  const c = data.demo as Content;
  const { css, s } = designStyles('haul', ['Antonio', 'Libre Franklin']);
  const book = { href: c.book.href, rel: 'noopener' };
  const quote = `mailto:${c.email}?subject=${encodeURIComponent(c.boat.custom.subject)}`;

  return (
    <div className={s.root}>
      <style href="haul" precedence="design">
        {css}
      </style>

      <section className={s.hero} id="top" data-hero aria-labelledby="hero-h">
        <div className={s.heroPic}>
          <Pic pic={pic(data, 'hero')} phone={data.images.heroPhone} sizes={HERO_SIZES} first />
          <span className={s.heroVeil} aria-hidden="true" />
          <span className={s.heroLineOver} aria-hidden="true" />
        </div>
        <ol className={s.dayRow} aria-label={c.hero.dayLabel}>
          {c.hero.day.map((d, i) => (
            <li key={d} style={{ '--i': i } as CSSProperties}>
              {d}
            </li>
          ))}
        </ol>
        <a className={s.mark} href="#top" aria-label={c.wordmark}>
          <Hook className={s.markHook} />
          <span aria-hidden="true">{c.wordmark}</span>
        </a>
        <h1 className={s.title} id="hero-h">
          <Title s={s} lead={c.hero.lead} name={c.hero.name} />
        </h1>
        <p className={s.titleOver} aria-hidden="true">
          <Title s={s} lead={c.hero.lead} name={c.hero.name} />
        </p>
        <p className={s.heroSub}>{c.hero.sub}</p>
        <div className={s.heroAct}>
          <span className={s.heroLine} aria-hidden="true" />
          <Hook className={s.heroHook} halo />
          <a className={s.go} data-press data-magnetic {...book}>
            {c.book.label}
            <Arrow />
          </a>
          <Price s={s} c={c} className={s.heroPrice} />
        </div>
      </section>

      <main>
        <section className={s.haul} id="day" aria-labelledby="haul-h">
          <header className={s.haulHead}>
            <Drop s={s} label={c.haul.kicker} mark="sinker" />
            <h2 id="haul-h" data-reveal>
              {c.haul.heading}
            </h2>
            <p className={s.haulLead} data-reveal>
              {c.haul.lead}
            </p>
          </header>
          <HaulReel steps={c.haul.steps.length} className={s.reel}>
            <span className={s.reelLine} aria-hidden="true" />
            <span className={s.reelBeads} aria-hidden="true" />
            <svg className={s.spool} viewBox="0 0 60 60" aria-hidden="true" focusable="false">
              <circle cx="30" cy="30" r="26" />
              <circle cx="30" cy="30" r="9" />
              <path d="M30 4v17M30 39v17M4 30h17M39 30h17" />
            </svg>
            <ol className={s.stops}>
              {c.haul.steps.map((st, i) => (
                <li key={st.title} className={s.stop} data-step={i} data-state={i === 0 ? 'on' : 'off'} style={{ '--i': i, '--d': i } as CSSProperties}>
                  <div className={s.hang} data-kind={st.tags ? 'rig' : 'photo'}>
                    {st.image && (
                      <figure className={s.frame} data-shape={pic(data, st.image).width > pic(data, st.image).height ? 'wide' : 'tall'}>
                        <i className={s.eye} aria-hidden="true" />
                        <Duo s={s} p={pic(data, st.image)} sizes="(min-width: 1000px) 46vw, 80vw" colour />
                      </figure>
                    )}
                    {st.extra && (
                      <figure className={s.bird}>
                        <Duo s={s} p={pic(data, st.extra)} sizes="(min-width: 1000px) 340px, 46vw" colour />
                      </figure>
                    )}
                    {st.tags && (
                      <ul className={s.rig}>
                        {st.tags.map((t, j) => (
                          <li key={t} style={{ '--j': j } as CSSProperties} data-side={j % 2 ? 'r' : 'l'}>
                            <span className={s.snood} aria-hidden="true" />
                            <Hook className={s.tagHook} />
                            <span className={s.tag}>
                              <span className={s.srOnly}>{t}</span>
                              <span aria-hidden="true" data-settle>
                                {t}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className={s.say}>
                    <h3>{st.title}</h3>
                    <p>{st.text}</p>
                    {st.note && <p className={s.note}>{st.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </HaulReel>
        </section>

        <section className={s.skipper} id="skipper" data-on="0" aria-labelledby="skipper-h">
          <div className={s.skipperHead}>
            <Drop s={s} label={c.skipper.kicker} />
            <h2 id="skipper-h" data-reveal>
              {c.skipper.heading}
            </h2>
            <p className={s.skipperLead} data-reveal>
              <Figure s={s} text={c.skipper.lead} />
            </p>
            <p className={s.skipperRange} data-reveal>
              {c.skipper.range}
            </p>
          </div>
          <HaulSwitch target="skipper" label={c.skipper.switchLabel} options={c.skipper.choices.map((ch) => ch.label)} cls={{ root: s.switch!, knob: s.knob! }} />
          <div className={s.skipperPics}>
            {c.skipper.choices.map((ch, i) => (
              <figure key={ch.label} className={s.skipperPic} data-choice={i}>
                <Duo s={s} p={pic(data, ch.image)} sizes="(min-width: 1000px) 48vw, 100vw" />
              </figure>
            ))}
          </div>
          <div className={s.skipperSays}>
            {c.skipper.choices.map((ch, i) => (
              <div key={ch.label} className={s.skipperSay} data-choice={i}>
                {ch.lines.map((l) => (
                  <p key={l}>{l}</p>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section className={s.boat} id="boat" data-band="fits" style={{ '--n': c.boat.crew.min } as CSSProperties} aria-labelledby="boat-h">
          <header className={s.boatHead}>
            <Drop s={s} label={c.boat.kicker} mark="knot" />
            <h2 id="boat-h" data-reveal>
              {c.boat.heading}
            </h2>
            <p className={s.boatLead} data-reveal>
              {c.boat.lead}
            </p>
          </header>
          <div className={s.deck}>
            <Plan s={s} comfort={c.boat.crew.comfort} />
            <Plan s={s} comfort={c.boat.crew.comfort} wide />
            <ul className={s.legend}>
              {c.boat.legend.map((l) => (
                <li key={l.text} data-mark={l.mark}>
                  <LegendMark s={s} mark={l.mark} />
                  {l.text}
                </li>
              ))}
            </ul>
          </div>
          <div className={s.crewWrap}>
            <HaulCrew
              target="boat"
              min={c.boat.crew.min}
              comfort={c.boat.crew.comfort}
              max={c.boat.crew.max}
              words={c.boat.crew.words}
              price={c.price}
              book={c.book}
              text={c.boat.crew}
              mail={{ ...c.boat.crew.mail, address: c.email }}
              cls={{ root: s.crew!, controls: s.crewControls!, step: s.crewStep!, count: s.crewCount!, total: s.crewTotal!, act: s.crewAct!, go: s.go!, say: s.crewSay!, fewer: s.crewFewer!, mail: s.crewMail! }}
            >
              <p className={s.tripName}>{c.boat.trip.name}</p>
              <ul className={s.tripFacts}>
                {c.boat.trip.facts.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </HaulCrew>
            <aside className={s.custom} aria-labelledby="custom-h">
              <h3 id="custom-h">{c.boat.custom.heading}</h3>
              <p className={s.customAsk}>{c.boat.custom.ask}</p>
              <p>{c.boat.custom.text}</p>
              <p className={s.customShort}>{c.boat.custom.short}</p>
              <a className={s.customGo} href={quote} data-press>
                {c.boat.custom.label}
                <Arrow />
              </a>
            </aside>
          </div>
        </section>

        <section className={s.catch} id="catch" aria-labelledby="catch-h">
          <header className={s.catchHead}>
            <Drop s={s} label={c.catch.kicker} />
            <h2 id="catch-h" data-reveal>
              {c.catch.heading}
            </h2>
            <p className={s.catchText} data-reveal>
              {c.catch.text}
            </p>
          </header>
          <div className={s.lineFrame}>
            <ul className={s.prints} data-drift>
              {c.catch.prints.map((p, i) => (
                <li key={p.image} className={s.printWrap} data-shape={p.shape} style={{ '--i': i } as CSSProperties}>
                  <figure className={s.print}>
                    <Duo s={s} p={pic(data, p.image)} sizes={p.shape === 'wide' ? '(min-width: 1000px) 560px, 84vw' : '(min-width: 1000px) 320px, 52vw'} colour />
                  </figure>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={s.kit} id="know" aria-labelledby="kit-h">
          <header className={s.kitHead}>
            <Drop s={s} label={c.kit.kicker} mark="sinker" />
            <h2 id="kit-h" data-reveal>
              {c.kit.heading}
            </h2>
          </header>
          <div className={s.kitCols}>
            <HaulKit label={c.kit.bring.label} items={c.kit.bring.items} ready={c.kit.ready} book={c.book} cls={{ root: s.bring!, label: s.bringLabel!, tick: s.tick!, done: s.packed!, go: s.go! }} />
            <div className={s.supply}>
              <h3>{c.kit.supply.label}</h3>
              <ul>
                {c.kit.supply.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            </div>
          </div>
          <dl className={s.answers}>
            {c.kit.answers.map((a) => (
              <div key={a.q} data-reveal>
                <dt>{a.q}</dt>
                <dd>{a.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={s.end} id="contact" aria-labelledby="end-h">
          <div className={s.endText}>
            <Drop s={s} label={c.end.kicker} />
            <h2 id="end-h" data-reveal>
              {c.end.heading}
            </h2>
            <p className={s.endMeet} data-reveal>
              {c.end.meet}
            </p>
            <p data-reveal>{c.end.parking}</p>
            <p data-reveal>{c.end.drive}</p>
            <a className={s.endWay} href={c.end.directions.href} rel="noopener">
              {c.end.directions.label}
              <Arrow />
            </a>
          </div>
          <figure className={s.endPic} data-wipe>
            <Pic pic={pic(data, 'boat')} sizes="(min-width: 1000px) 50vw, 100vw" />
          </figure>
          <div className={s.endAct} data-drop>
            <span className={s.endLine} aria-hidden="true" />
            <Hook className={s.endHook} halo />
            <a className={s.go} data-press data-magnetic {...book}>
              {c.book.label}
              <Arrow />
            </a>
            <Price s={s} c={c} className={s.endPrice} />
            <p className={s.endWeather}>{c.end.weather}</p>
          </div>
          <div className={s.hull}>
            <p className={s.hullTalk}>{c.end.talk}</p>
            <p className={s.hullName}>{c.wordmark}</p>
            <ul className={s.hullNums}>
              <li>
                <a href={c.call.tel}>
                  <small>{c.end.phoneLabel}</small>
                  {c.call.display}
                </a>
              </li>
              <li>
                <a href={c.mobile.tel}>
                  <small>{c.end.mobileLabel}</small>
                  {c.mobile.display}
                </a>
              </li>
              <li>
                <a href={`mailto:${c.email}`}>{c.email}</a>
              </li>
              <li>
                <span>
                  <small>{c.end.wechat.label}</small>
                  {c.end.wechat.id}
                </span>
              </li>
            </ul>
            <p className={s.hullWelcome}>
              {c.end.welcome}
              <span lang="zh">{c.end.chinese}</span>
            </p>
            <p className={s.hullReply}>{c.end.reply}</p>
          </div>
        </section>
      </main>

      <footer className={s.water}>
        <p className={s.waterWhere}>
          <Hook className={s.waterHook} />
          {c.end.address}
        </p>
        <DemoFoot domain={data.domain} />
      </footer>

      <nav className={s.dock} aria-label={c.book.label}>
        <Price s={s} c={c} className={s.dockPrice} />
        <a className={s.go} data-press {...book}>
          {c.book.label}
          <Arrow />
        </a>
      </nav>

      <HaulMotion />
      <StickyBar main={{ label: c.book.label, href: c.book.href, external: true }} call={{ label: c.call.label, tel: c.call.tel }} />
    </div>
  );
}

export const haul: Design = { Demo, fonts: ['antonio-latin-wght-normal', 'libre-franklin-latin-wght-normal'], heroSizes: HERO_SIZES };
