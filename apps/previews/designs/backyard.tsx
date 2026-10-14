import type { CSSProperties, ReactNode } from 'react';
import { BackyardCrew } from '@/components/BackyardCrew';
import { BackyardDay, type DayTrip } from '@/components/BackyardDay';
import { BackyardDock } from '@/components/BackyardDock';
import { BackyardFill } from '@/components/BackyardFill';
import { BackyardWake } from '@/components/BackyardWake';
import { DemoFoot } from '@/components/DemoFoot';
import { Pic } from '@/components/Pic';
import { StickyBar } from '@/components/StickyBar';
import { pic, type PageData } from '@/lib/data';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Content {
  wordmark: string;
  place: string;
  nav: { label: string; id: string }[];
  book: { label: string; href: string };
  call: { label: string; tel: string; display: string };
  call2: { tel: string; display: string; lead: string };
  email: string;
  hero: { lines: string[]; sub: string; small: string; price: { before: string; value: string; after: string } };
  heaven: { line: string[]; label: string; sights: string[] };
  crew: { heading: string; lead: string; line: string; cue: string; next: string; start: number; people: { nick: string; name: string; text: string; image: string }[]; othersLabel: string; others: string[] };
  tide: {
    heading: string;
    lead: string;
    sand: string;
    sandLabel: string;
    low: string;
    rise: { before: string; big: string; text: string };
    lagoonText: string;
    tag: string;
    nelson: string;
    help: string;
    helpLink: { label: string; href: string };
  };
  day: {
    heading: string;
    lead: string;
    start: string;
    between: string;
    hint: string;
    modes: { id: string; label: string }[];
    lengths: Record<string, { id: string; label: string }[]>;
    ends: Record<string, { id: string; label: string; trip: string }[]>;
    legs: Record<string, string>;
    noPrice: string;
    bookLabel: string;
    demo: number[];
    trips: DayTrip[];
    fee: string;
    transport: string;
  };
  proof: { heading: string; ratingLabel: string; ratingUnit: string; ratingSource: string; quote: { text: string; who: string; where: string }; photo: { image: string; caption: string } };
  end: { kristin: { text: string }; callLabel: string; mailLabel: string; welcome: string; address: string };
}

/** The small wave that leads every booking button. */
function Wave() {
  return (
    <svg viewBox="0 0 24 12" width="24" height="12" aria-hidden="true" focusable="false">
      <path d="M1 7c2.5-4 5-4 7.5 0s5 4 7.5 0 5-4 7 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- Drawing the coast. Everything is worked out once, on the server, from a few numbers. ---------- */

/** A seeded sequence of numbers between 0 and 1, so a drawing comes out the same on every render. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number) => n.toFixed(1);

interface Slope {
  /** Where the slope meets the water, and where it reaches its top. `x1` may lie left of `x0`. */
  x0: number;
  x1: number;
  low: number;
  high: number;
  /** How quickly it rises: higher is steeper at the foot. */
  k?: number;
}

/** The height of a slope at `x`: rising from `low` at `x0` to `high` at `x1`, quickly at first and then levelling. */
function heightAt(o: Slope, x: number): number {
  const span = Math.abs(o.x1 - o.x0);
  const t = Math.min(1, Math.abs(x - o.x0) / span);
  return o.low - (o.low - o.high) * (1 - Math.pow(1 - t, o.k ?? 2.3));
}

/** A ridge of rounded tree crowns along a slope, `step` wide and up to `amp` tall, closed down to `floor`. */
function ridge(o: Slope & { floor: number; step: number; amp: number; seed: number }): string {
  const rand = seeded(o.seed);
  const dir = Math.sign(o.x1 - o.x0);
  let d = `M${f(o.x0)} ${f(o.floor)}L${f(o.x0)} ${f(o.low)}`;
  for (let x = o.x0; dir > 0 ? x < o.x1 : x > o.x1; ) {
    const w = o.step * (0.75 + rand() * 0.5);
    const nx = dir > 0 ? Math.min(o.x1, x + w) : Math.max(o.x1, x - w);
    const top = Math.min(heightAt(o, x), heightAt(o, nx)) - o.amp * (0.55 + rand() * 0.45);
    d += `Q${f((x + nx) / 2)} ${f(top)} ${f(nx)} ${f(heightAt(o, nx))}`;
    x = nx;
  }
  return `${d}L${f(o.x1)} ${f(o.floor)}Z`;
}

/**
 * Tree crowns over a slope, in rows from its top edge down: the top row in the sunlit tones, lower
 * rows darker, each crown lit from the upper left. The light comes from the same low sun as the sky.
 */
function Canopy({ o, rows, gap, size, tones, lit, seed }: { o: Slope; rows: number; gap: number; size: [number, number]; tones: string[]; lit: string; seed: number }) {
  const rand = seeded(seed);
  const crowns: ReactNode[] = [];
  const lo = Math.min(o.x0, o.x1);
  const hi = Math.max(o.x0, o.x1);
  for (let r = 0; r < rows; r++) {
    for (let x = lo + rand() * size[0]; x < hi; x += size[0] * (0.8 + rand() * 0.45)) {
      const radius = size[0] + rand() * (size[1] - size[0]);
      const cx = x + (rand() - 0.5) * 8;
      const cy = heightAt(o, x) + r * gap + radius * 0.4 + (rand() - 0.5) * 10;
      const tone = tones[Math.min(tones.length - 1, r + (rand() < 0.35 ? 1 : 0))]!;
      const k = crowns.length;
      // The sunlit rim: a lighter crown, then the crown itself a little lower and to the right, leaving a crescent of light.
      if (r < 3) crowns.push(<circle key={k} cx={f(cx - radius * 0.12)} cy={f(cy - radius * 0.14)} r={f(radius)} fill={lit} opacity={r === 0 ? 0.9 : r === 1 ? 0.55 : 0.3} />);
      crowns.push(<circle key={k + 1} cx={f(cx + radius * 0.04)} cy={f(cy + radius * 0.06)} r={f(radius * 0.94)} fill={tone} />);
    }
  }
  return <g>{crowns}</g>;
}

/** Rounded granite rocks standing on a line, each [left, width, height], with a lit top and a shaded side. */
function Rocks({ base, list, id }: { base: number; list: [number, number, number][]; id: string }) {
  return (
    <g>
      {list.map(([x, w, h], i) => {
        const shape = `M${x} ${base}C${x} ${base - h * 0.9} ${x + w * 0.18} ${base - h} ${x + w * 0.5} ${base - h}C${x + w * 0.82} ${base - h} ${x + w} ${base - h * 0.55} ${x + w} ${base}Z`;
        const top = `M${x + w * 0.1} ${base - h * 0.55}C${x + w * 0.12} ${base - h * 0.95} ${x + w * 0.3} ${base - h * 0.98} ${x + w * 0.5} ${base - h * 0.98}C${x + w * 0.66} ${base - h * 0.98} ${x + w * 0.74} ${base - h * 0.9} ${x + w * 0.78} ${base - h * 0.78}C${x + w * 0.5} ${base - h * 0.7} ${x + w * 0.3} ${base - h * 0.62} ${x + w * 0.1} ${base - h * 0.55}Z`;
        return (
          <g key={i}>
            <path d={shape} fill={`url(#${id}-rock)`} />
            <path d={top} fill="#f1e2c2" opacity="0.55" />
          </g>
        );
      })}
    </g>
  );
}

/** A round boulder split in two, its halves standing a little apart, sitting on the line `base`. */
function Boulder({ cx, base, r, gap }: { cx: number; base: number; r: number; gap: number }) {
  const cy = base - r * 0.82;
  const g = gap / 2;
  return (
    <g>
      <ellipse cx={cx} cy={base} rx={r * 1.25} ry={r * 0.12} fill="#b68a45" opacity="0.5" />
      <path d={`M${cx - g} ${cy - r}A${r} ${r} 0 0 0 ${cx - g} ${cy + r}Z`} fill="#e4cfa6" />
      <path d={`M${cx + g} ${cy - r}A${r} ${r} 0 0 1 ${cx + g} ${cy + r}Z`} fill="#b99a70" />
      <path d={`M${cx - g - r * 0.72} ${cy - r * 0.2}C${cx - g - r * 0.6} ${cy - r * 0.62} ${cx - g - r * 0.32} ${cy - r * 0.84} ${cx - g - r * 0.08} ${cy - r * 0.88}`} fill="none" stroke="#fbf1dc" strokeWidth={r * 0.1} strokeLinecap="round" opacity="0.85" />
    </g>
  );
}

/** Gradients shared by the drawings: granite, sand, and the low sun's glow. */
function Defs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-rock`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#d9c39c" />
        <stop offset="1" stopColor="#9c7e59" />
      </linearGradient>
      <linearGradient id={`${id}-sand`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f4d898" />
        <stop offset="1" stopColor="#dcae5f" />
      </linearGradient>
      <radialGradient id={`${id}-sun`}>
        <stop offset="0" stopColor="#fff6d8" stopOpacity="0.95" />
        <stop offset="0.25" stopColor="#fbe7b0" stopOpacity="0.55" />
        <stop offset="1" stopColor="#fbe7b0" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

const BUSH = ['#2c6646', '#24583c', '#1c4a33', '#163f2b'];
const BUSH_LIT = '#5f9a63';

/** The coast above the waterline on a wide screen. Its bottom edge is the waterline. */
function CoastWide({ className }: { className: string }) {
  const back: Slope = { x0: 880, x1: 1600, low: 760, high: 150, k: 2.6 };
  const main: Slope = { x0: 990, x1: 1600, low: 760, high: 250, k: 2.4 };
  const front: Slope = { x0: 1160, x1: 1600, low: 760, high: 450, k: 2.1 };
  return (
    <svg className={className} viewBox="0 0 1600 760" preserveAspectRatio="xMidYMax slice" focusable="false">
      <Defs id="bw" />
      <circle cx="930" cy="230" r="300" fill="url(#bw-sun)" />
      <circle cx="930" cy="230" r="44" fill="#fff7dc" />
      <path d="M760 168l12 8 12-8M800 150l9 6 9-6" fill="none" stroke="#5c7d78" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={ridge({ x0: 640, x1: 0, low: 760, high: 690, floor: 760, step: 50, amp: 7, seed: 3, k: 1.5 })} fill="#c4d6cf" />
      <path d={ridge({ x0: 690, x1: 860, low: 760, high: 716, floor: 760, step: 26, amp: 6, seed: 4, k: 1.3 })} fill="#adc6bd" />
      <path d={ridge({ ...back, floor: 760, step: 34, amp: 12, seed: 7 })} fill="#9dbab0" />
      <path d={ridge({ ...main, floor: 760, step: 28, amp: 12, seed: 11 })} fill={BUSH[2]} />
      <Canopy o={main} rows={6} gap={30} size={[16, 30]} tones={BUSH} lit={BUSH_LIT} seed={12} />
      <path d={ridge({ ...front, floor: 760, step: 24, amp: 10, seed: 19 })} fill={BUSH[3]} />
      <Canopy o={front} rows={5} gap={26} size={[14, 26]} tones={[BUSH[1]!, BUSH[2]!, BUSH[3]!]} lit={BUSH_LIT} seed={20} />
      <Rocks id="bw" base={760} list={[[1010, 70, 34], [1066, 54, 24], [1128, 98, 46], [1214, 70, 30], [1272, 120, 52], [1380, 74, 34], [1440, 110, 44], [1536, 70, 30]]} />
      <path d="M800 760C860 744 950 734 1060 738C1080 739 1096 742 1110 746L1110 760Z" fill="url(#bw-sand)" />
      <path d="M806 760C866 746 952 738 1056 742" fill="none" stroke="#c9944a" strokeWidth="3" opacity="0.6" />
      <Boulder cx={905} base={748} r={48} gap={7} />
    </svg>
  );
}

/** The same coast drawn for a phone: the headland at the right, the beach and the split boulder at its foot. */
function CoastNarrow({ className }: { className: string }) {
  const back: Slope = { x0: 256, x1: 400, low: 460, high: 40, k: 2.6 };
  const main: Slope = { x0: 322, x1: 400, low: 460, high: 120, k: 2.4 };
  const front: Slope = { x0: 352, x1: 400, low: 460, high: 270, k: 2.1 };
  return (
    <svg className={className} viewBox="0 0 400 460" preserveAspectRatio="xMidYMax slice" focusable="false">
      <Defs id="bn" />
      <circle cx="214" cy="104" r="150" fill="url(#bn-sun)" />
      <circle cx="214" cy="104" r="24" fill="#fff7dc" />
      <path d="M150 90l8 5 8-5M178 78l6 4 6-4" fill="none" stroke="#5c7d78" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d={ridge({ x0: 210, x1: 0, low: 460, high: 430, floor: 460, step: 26, amp: 4, seed: 3, k: 1.5 })} fill="#c4d6cf" />
      <path d={ridge({ ...back, floor: 460, step: 16, amp: 6, seed: 5 })} fill="#9dbab0" />
      <path d={ridge({ ...main, floor: 460, step: 13, amp: 6, seed: 9 })} fill={BUSH[2]} />
      <Canopy o={main} rows={6} gap={16} size={[8, 15]} tones={BUSH} lit={BUSH_LIT} seed={10} />
      <path d={ridge({ ...front, floor: 460, step: 11, amp: 5, seed: 13 })} fill={BUSH[3]} />
      <Canopy o={front} rows={4} gap={14} size={[7, 13]} tones={[BUSH[1]!, BUSH[2]!, BUSH[3]!]} lit={BUSH_LIT} seed={14} />
      <Rocks id="bn" base={460} list={[[352, 28, 13], [372, 30, 16]]} />
      <path d="M298 460C314 452 334 449 360 450L362 460Z" fill="url(#bn-sand)" />
      <Boulder cx={336} base={456} r={15} gap={3} />
    </svg>
  );
}

/** The ground of the lagoon in cross section: a bush headland on granite, the lagoon floor, a sand bar, the sea floor falling away. */
function Lagoon({ className }: { className: string }) {
  const head: Slope = { x0: 360, x1: 0, low: 380, high: 60, k: 2.2 };
  return (
    <svg className={className} viewBox="0 0 1000 600" preserveAspectRatio="none" focusable="false">
      <Defs id="bl" />
      <path d={ridge({ x0: 420, x1: 0, low: 400, high: 20, floor: 600, step: 32, amp: 12, seed: 23, k: 2.3 })} fill="#9dbab0" />
      <path d={ridge({ ...head, floor: 600, step: 26, amp: 12, seed: 29 })} fill={BUSH[2]} />
      <path d={ridge({ x0: 320, x1: 0, low: 420, high: 170, floor: 600, step: 22, amp: 10, seed: 31, k: 2 })} fill={BUSH[3]} />
      <Rocks id="bl" base={430} list={[[230, 70, 46], [286, 80, 60], [350, 50, 30]]} />
      <path d="M0 600V470C120 440 260 420 380 400C410 420 440 456 480 474C530 492 580 488 630 452C660 430 690 400 722 392C760 384 790 420 820 480C850 540 900 584 1000 590V600Z" fill="url(#bl-sand)" />
      <path d="M380 400C410 420 440 456 480 474C530 492 580 488 630 452C660 430 690 400 722 392C760 384 790 420 820 480C850 540 900 584 1000 590" fill="none" stroke="#c48d40" strokeWidth="3" vectorEffect="non-scaling-stroke" opacity="0.7" />
    </svg>
  );
}

/**
 * A backyard told by its tide. The page opens at low tide on golden sand below a drawn coast; in the
 * first second the sea comes in over the sand and up the headline, tinting the lower half of its last
 * word through a wavy surface. The crew deal themselves out by their faces; a lagoon fills as the
 * visitor scrolls; their words about avoiding the crowd fill in beside a guide on calm water; and the
 * page ends with a sentence that becomes the one trip to book, on the sand.
 */
function Demo({ data }: { data: PageData }) {
  const c = data.demo as Content;
  const { css, s } = designStyles('backyard', ['League Spartan', 'DM Mono', 'Caveat']);
  const book = { href: c.book.href, rel: 'noopener' };
  const title = (cls: string) => (
    <>
      {c.hero.lines.map((l, i) => (
        <span key={l} className={cls} aria-hidden="true">
          <span style={{ '--i': i } as CSSProperties}>{l}</span>
        </span>
      ))}
    </>
  );
  return (
    <div className={s.root}>
      <style href="backyard" precedence="design">
        {css}
      </style>

      <BackyardWake />
      <BackyardDock brand={c.wordmark} items={c.nav} book={c.book} cls={{ dock: s.dock!, mark: s.dockMark!, now: s.dockNow!, book: s.dockBook!, gauge: s.gauge!, fill: s.gaugeFill! }} />

      <section className={s.hero} id="top" data-hero>
        <div className={s.coast} aria-hidden="true">
          <CoastWide className={s.wide!} />
          <CoastNarrow className={s.narrow!} />
        </div>
        <div className={s.flats} aria-hidden="true" />

        <div className={s.top}>
          <a className={s.mark} href="#top">
            {c.wordmark}
          </a>
          <p className={s.place}>{c.place}</p>
        </div>

        <h1 className={s.title} aria-label={c.hero.lines.join(' ')}>
          {title(s.line!)}
        </h1>

        <div className={s.sea} aria-hidden="true">
          <i className={s.foam} />
          <div className={s.seaIn}>
            <p className={`${s.title} ${s.titleUnder}`}>{title(s.line!)}</p>
          </div>

        </div>

        <div className={s.boat} aria-hidden="true">
            <svg className={s.paddlers} viewBox="0 0 160 48" focusable="false">
              <path className={s.hull} d="M4 34C40 42 120 42 156 34C130 28 30 28 4 34Z" />
              <path d="M58 30C58 22 60 16 64 14C68 16 70 22 70 30Z M98 30C98 22 100 16 104 14C108 16 110 22 110 30Z" fill="#0b2e36" />
              <circle cx="64" cy="10" r="5" fill="#0b2e36" />
              <circle cx="104" cy="10" r="5" fill="#0b2e36" />
              <path d="M44 6L86 34M84 6L126 34" stroke="#0b2e36" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
        </div>

        <div className={s.offer}>
          <div className={s.offerText}>
            <p className={s.sub}>{c.hero.sub}</p>
            <p className={s.small}>{c.hero.small}</p>
          </div>
          <div className={s.offerAct}>
            <a className={s.go} data-press data-magnetic {...book}>
              <Wave />
              {c.book.label}
            </a>
            <p className={s.from}>
              {c.hero.price.before} <b>{c.hero.price.value}</b> {c.hero.price.after}
            </p>
          </div>
        </div>
      </section>

      <main>
        <section className={s.heaven} aria-labelledby="heaven-h">
          <h2 id="heaven-h" className={s.heavenLine}>
            {c.heaven.line.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </h2>
          <p className={s.sightsLabel}>{c.heaven.label}</p>
          <div className={s.sightsWrap}>
            <ul className={s.sights}>
              {c.heaven.sights.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className={s.crew} data-wake id="crew" aria-labelledby="crew-h">
          <header className={s.crewHead}>
            <h2 id="crew-h">{c.crew.heading}</h2>
            <p className={s.lead}>{c.crew.lead}</p>
          </header>
          <BackyardCrew
            people={c.crew.people.map((p) => ({
              nick: p.nick,
              name: p.name,
              text: p.text,
              picture: <Pic pic={pic(data, p.image)} sizes="(min-width: 900px) 420px, 80vw" />,
              thumb: <Pic pic={pic(data, p.image)} sizes="56px" alt="" />,
            }))}
            start={c.crew.start}
            cue={c.crew.cue}
            next={c.crew.next}
            label={c.crew.heading}
            cls={{
              stage: s.stage!,
              deck: s.deck!,
              card: s.card!,
              photo: s.cardPhoto!,
              tag: s.tag!,
              caption: s.caption!,
              who: s.who!,
              said: s.said!,
              cue: s.cue!,
              faces: s.faces!,
              face: s.face!,
              nextBtn: s.nextBtn!,
            }}
          />
          <div className={s.crewFoot}>
            <p className={s.crewLine}>{c.crew.line}</p>
            <p className={s.others}>
              {c.crew.othersLabel}: {c.crew.others.join(', ')}.
            </p>
          </div>
        </section>

        <section className={s.tide} id="tide" aria-labelledby="tide-h">
          <div className={s.tideSky}>
            <h2 id="tide-h">{c.tide.heading}</h2>
            <div className={s.tideWords}>
              <p className={s.tideLead}>
                {c.tide.lead} {c.tide.rise.text}
              </p>
              <p className={s.tideLead}>{c.tide.lagoonText}</p>
              <p className={s.tideLead}>{c.tide.sand}</p>
              <p className={s.tideNote}>
                {c.tide.nelson} {c.tide.help} <a href={c.tide.helpLink.href}>{c.tide.helpLink.label}</a>
              </p>
            </div>
          </div>
          <div className={s.basin} aria-hidden="true">
            <p className={s.sandWord}>{c.tide.sandLabel}</p>
            <div className={s.tideWater}>
              <i className={s.tideFoam} />
            </div>
            <Lagoon className={s.ground!} />
            <p className={s.lowMark}>
              <span>{c.tide.low}</span>
            </p>
            <div className={s.surface}>
              <p className={s.rider}>
                <small>{c.tide.rise.before}</small>
                <b>{c.tide.rise.big}</b>
              </p>
              <div className={s.arrival}>
                <svg className={s.tideKayak} viewBox="0 0 160 48" focusable="false">
                  <path className={s.hull} d="M4 34C40 42 120 42 156 34C130 28 30 28 4 34Z" />
                  <path d="M58 30C58 22 60 16 64 14C68 16 70 22 70 30Z M98 30C98 22 100 16 104 14C108 16 110 22 110 30Z" fill="#0b2e36" />
                  <circle cx="64" cy="10" r="5" fill="#0b2e36" />
                  <circle cx="104" cy="10" r="5" fill="#0b2e36" />
                  <path d="M44 6L86 34M84 6L126 34" stroke="#0b2e36" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                <p className={s.kayakTag}>{c.tide.tag}</p>
              </div>
            </div>
          </div>
        </section>

        <section className={s.proof} data-wake id="reviews" aria-labelledby="proof-h">
          <h2 id="proof-h" className={s.srOnly}>
            {c.proof.heading}
          </h2>
          <figure className={s.proofPhoto}>
            <Pic pic={pic(data, c.proof.photo.image)} sizes="(min-width: 900px) 420px, 88vw" />
            <figcaption>{c.proof.photo.caption}</figcaption>
          </figure>
          <blockquote className={s.quote}>
            <p>
              <BackyardFill text={c.proof.quote.text} word={s.fillWord!} />
            </p>
            <footer>
              {c.proof.quote.who}, {c.proof.quote.where}
            </footer>
          </blockquote>
          {data.rating && (
            <p className={s.score}>
              <b>{data.rating.value}</b>
              <span>
                {c.proof.ratingLabel} {String(data.rating.count)} {c.proof.ratingUnit}
              </span>
              <small>{c.proof.ratingSource}</small>
            </p>
          )}
        </section>

        <section className={s.trips} data-wake id="book" aria-labelledby="trips-h">
          <header className={s.tripsHead}>
            <h2 id="trips-h">{c.day.heading}</h2>
            <p className={s.lead}>{c.day.lead}</p>
          </header>
          <BackyardDay
            start={c.day.start}
            between={c.day.between}
            hint={c.day.hint}
            modes={c.day.modes}
            lengths={c.day.lengths}
            ends={c.day.ends}
            trips={c.day.trips}
            legs={c.day.legs}
            noPrice={c.day.noPrice}
            bookLabel={c.day.bookLabel}
            demo={c.day.demo}
            cls={{
              wrap: s.day!,
              sentence: s.sentence!,
              slot: s.slot!,
              fixed: s.fixed!,
              word: s.word!,
              hint: s.hint!,
              answer: s.answer!,
              tripName: s.tripName!,
              when: s.when!,
              legs: s.legs!,
              tripText: s.tripText!,
              buy: s.buy!,
              price: s.price!,
              noPrice: s.noPrice!,
              book: s.tripBook!,
              srOnly: s.srOnly!,
            }}
          />
          <div className={s.notes}>
            <p>{c.day.fee}</p>
            <p>{c.day.transport}</p>
          </div>
        </section>
      </main>

      <footer className={s.foot} data-wake>
        <p className={s.kristin}>{c.end.kristin.text}</p>
        <div className={s.lines}>
          <a href={c.call.tel} data-press>
            <span>{c.end.callLabel}</span>
            {c.call.display}
          </a>
          <a href={`mailto:${c.email}`} data-press>
            <span>{c.end.mailLabel}</span>
            {c.email}
          </a>
        </div>
        <p className={s.alt}>
          {c.call2.lead} <a href={c.call2.tel}>{c.call2.display}</a>
        </p>
        <div className={s.footBase}>
          <p className={s.welcome}>{c.end.welcome}</p>
          <p className={s.address}>
            {c.wordmark}, {c.end.address}
          </p>
          <DemoFoot domain={data.domain} />
        </div>
      </footer>

      <StickyBar main={{ label: c.book.label, href: c.book.href, external: true }} call={{ label: c.call.label, tel: c.call.tel }} />
    </div>
  );
}

export const backyard: Design = { Demo, fonts: ['league-spartan-latin-wght-normal', 'dm-mono-latin-400-normal'], heroSizes: '(min-width: 900px) 420px, 88vw' };
