import type { CSSProperties, ReactNode } from 'react';
import { ClearingCount } from '@/components/ClearingCount';
import { ClearingOpen } from '@/components/ClearingOpen';
import { ClearingPlan } from '@/components/ClearingPlan';
import { ClearingPointer } from '@/components/ClearingPointer';
import { ClearingSeen } from '@/components/ClearingSeen';
import { ClearingWalk } from '@/components/ClearingWalk';
import { DemoFoot } from '@/components/DemoFoot';
import { Pic } from '@/components/Pic';
import { StickyBar } from '@/components/StickyBar';
import { pic, type PageData } from '@/lib/data';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Link {
  label: string;
  href: string;
}

interface Ask {
  label: string;
  pick: string;
}

interface Located {
  id: string;
  name: string;
  lon: number;
  lat: number;
}

interface Content {
  wordmark: string[];
  planLink: Link;
  side: Link;
  book: Link;
  call: { label: string; tel: string; display: string };
  email: string;
  hero: { pre: string; lines: string[]; post: string; where: string; pickup: string };
  whirinaki: { label: string; tag: string; steps: string[]; text: string; ask: Ask };
  birds: { heading: string; lead: string; familiesLabel: string; families: { name: string; shape: string }[]; day: string; ask: Ask; more: { text: string; link: Link } };
  tongariro: { label: string; heading: string; text: string; note: string; ask: Ask };
  plan: {
    heading: string;
    hint: string;
    listLabel: string;
    days: { id: string; name: string; meta: string; price: string; note?: string; places: string[] }[];
    pickup: string;
    towns: Located[];
    places: (Located & { kind: string; size: number })[];
    map: { west: number; east: number; north: number; south: number; coast: [number, number][]; lakes: [number, number][][] };
    demo: { mark?: string; town?: string }[];
    send: string;
    empty: string;
    subject: string;
    bodyDays: string;
    bodyTown: string;
    bodyEnd: string;
    lead: string;
    note: string;
  };
  guides: { heading: string; owners: string; before: string; count: string; after: string; people: { name: string; role: string; text: string; height: number }[]; policy: string };
  end: { line: string; sub: string; where: string; address: string };
}

type Classes = Record<string, string>;
type Vars = CSSProperties & Record<`--${string}`, string | number>;

/** A trunk: where it stands across the width and how wide and tall it is, all as percentages of its stage. */
type Trunk = [x: number, w: number, h: number];

/** The opening forest, back to front. Trunks are drawn as flat columns; tree ferns get a crown. */
const BACK: Trunk[] = [
  [1.5, 0.9, 96], [5, 0.6, 74], [8.5, 1.1, 100], [12, 0.5, 66], [16.5, 0.8, 88], [21, 1.2, 100], [25.5, 0.6, 70], [30, 0.9, 94],
  [35, 0.5, 64], [39.5, 1, 100], [44, 0.7, 80], [48.5, 1.2, 100], [53, 0.6, 72], [57.5, 0.9, 96], [62, 0.5, 68], [66.5, 1.1, 100],
  [91, 0.8, 92], [94.5, 0.5, 70], [97.5, 1, 100],
];
const MID: Trunk[] = [[3, 2.2, 100], [18.5, 1.6, 84], [33.5, 2.4, 100], [46, 1.8, 90], [59.5, 2.6, 100], [93, 2, 100]];
const FERNS: Trunk[] = [[10.5, 1.1, 30], [27, 0.9, 22], [52.5, 1.2, 34], [69, 1, 26], [96, 1, 24]];
const FRONT: Trunk[] = [[-1.5, 4.6, 100], [99, 3.6, 100]];

/** The forest walked into: trunks either side of a clearing, at three depths. */
const FAR: Trunk[] = [[4, 1, 100], [9, 0.8, 100], [14, 1.2, 100], [19, 0.9, 100], [25, 1.3, 100], [31, 0.8, 100], [36, 1.1, 100], [41, 0.9, 100], [58, 1, 100], [63, 0.8, 100], [68, 1.2, 100], [74, 0.9, 100], [80, 1.3, 100], [86, 0.8, 100], [91, 1.1, 100], [96, 0.9, 100]];
const NEAR: Trunk[] = [[6, 2.4, 100], [16, 2, 100], [27.5, 2.8, 100], [38.5, 2.2, 100], [60.5, 2.2, 100], [71.5, 2.8, 100], [83, 2, 100], [93, 2.4, 100]];
const NEAREST: Trunk[] = [[-2, 7, 100], [19.5, 5.5, 100], [33, 6, 100], [62, 6, 100], [76, 5.5, 100], [96, 7, 100]];
const WALK_FERNS: Trunk[] = [[11, 1.2, 34], [46, 1, 22], [55, 1, 26], [88, 1.2, 30]];
const NEAR_FERNS: Trunk[] = [[26, 1.6, 30], [70, 1.6, 36]];

/** A curtain of trunks that parts to the sides as its section arrives. */
const CURTAIN_BACK: Trunk[] = [[2, 1.2, 100], [8, 0.9, 100], [15, 1.4, 100], [23, 1, 100], [31, 1.3, 100], [38, 0.9, 100], [45, 1.5, 100], [52, 1, 100], [59, 1.3, 100], [66, 0.9, 100], [73, 1.4, 100], [80, 1, 100], [87, 1.2, 100], [94, 0.9, 100]];
const CURTAIN_MID: Trunk[] = [[5, 3, 100], [17, 2.6, 100], [28, 3.4, 100], [40, 2.8, 100], [54, 3.2, 100], [65, 2.6, 100], [77, 3.4, 100], [90, 2.8, 100]];
const CURTAIN_FRONT: Trunk[] = [[-1, 7, 100], [21, 6, 100], [43, 7.5, 100], [61, 6.5, 100], [82, 7, 100]];

/** The close, where the forest grows back up to the floor. */
const END_BACK: Trunk[] = [[1, 1, 88], [3, 0.8, 70], [9, 1.1, 92], [12, 0.6, 76], [15, 0.6, 60], [19, 0.9, 98], [22, 1, 84], [30, 0.7, 66], [34, 1.1, 90], [38, 1.2, 96], [44, 0.8, 80], [47, 0.6, 58], [55, 1, 88], [59, 0.7, 74], [63, 0.7, 64], [67, 1, 94], [71, 1.2, 100], [79, 0.6, 62], [83, 0.9, 82], [86, 1, 90], [91, 0.7, 76], [94, 0.7, 70], [98, 1, 96]];
const END_MID: Trunk[] = [[6, 2.8, 100], [26, 2.2, 78], [51, 3.2, 100], [75, 2.4, 86], [96.5, 3.2, 100]];
const END_FERNS: Trunk[] = [[17, 1, 40], [31, 0.9, 30], [42, 1.1, 46], [58, 0.9, 32], [66, 1, 38], [90, 1.1, 44]];

/**
 * Where each bird lands on the branch, in order of arrival: across the branch (percent), how wide it is
 * drawn (percent of the scene), where it flies in from (screen widths and heights), its tilt in flight,
 * and how far down the scroll it lands. The bird that cannot fly walks in along the ground instead.
 */
const FLOCK = [
  { x: 13, w: 8.5, dx: -38, dy: -34, r: -24, t: 0.04 },
  { x: 30, w: 14, dx: 34, dy: -42, r: 18, t: 0.14 },
  { x: 49, w: 10.5, dx: -26, dy: -50, r: -14, t: 0.24 },
  { x: 67, w: 11, dx: 42, dy: -30, r: 26, t: 0.34 },
  { x: 85, w: 10, dx: 28, dy: -46, r: -18, t: 0.44 },
];
const WALKER = { x: 40, w: 15, dx: -64, dy: 0, r: 0, t: 0.52 };

/** Flax along the foot of the volcano frame: blades leaning a little each way, and a few flower stalks. */
function flax(): { blades: string[]; stalks: string[] } {
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const blades: string[] = [];
  const stalks: string[] = [];
  for (let i = 0; i < 46; i++) {
    const x = (i / 45) * 400 + (rnd() - 0.5) * 8;
    const h = 34 + rnd() * 52;
    const lean = (rnd() - 0.5) * 34;
    const w = 2.2 + rnd() * 2.4;
    blades.push(`M${(x - w).toFixed(1)} 100Q${(x + lean * 0.25).toFixed(1)} ${(100 - h * 0.6).toFixed(1)} ${(x + lean).toFixed(1)} ${(100 - h).toFixed(1)}Q${(x + lean * 0.1 + w * 0.3).toFixed(1)} ${(100 - h * 0.55).toFixed(1)} ${(x + w).toFixed(1)} 100Z`);
    if (i % 5 === 2) {
      const sh = h + 18 + rnd() * 16;
      stalks.push(`M${x.toFixed(1)} 100L${(x + lean * 0.4).toFixed(1)} ${(100 - sh).toFixed(1)}`);
    }
  }
  return { blades, stalks };
}
const FLAX = flax();

/** The map's own units: a fixed width, and a height from the area it shows, in a flat projection. */
function projector(m: Content['plan']['map']) {
  const w = 400;
  const cos = Math.cos((((m.north + m.south) / 2) * Math.PI) / 180);
  const k = w / ((m.east - m.west) * cos);
  const at = (lon: number, lat: number): [number, number] => [Number(((lon - m.west) * cos * k).toFixed(1)), Number(((m.north - lat) * k).toFixed(1))];
  const line = (pts: [number, number][]) => pts.map(([lon, lat], i) => `${i ? 'L' : 'M'}${at(lon, lat).join(' ')}`).join('');
  const coast = line(m.coast);
  const [lx, ly] = at(...m.coast[m.coast.length - 1]!);
  return { w, h: Number(((m.north - m.south) * k).toFixed(1)), at, coast, sea: `${coast}L${lx} ${ly}L${w} 0Z`, lakes: m.lakes.map((l) => `${line(l)}Z`) };
}

/** A tree fern's crown: arching fronds from one point, drawn flat. */
function Crown({ className }: { className: string }) {
  const frond = 'M0 0C26-15 62-17 96 7C64-5 29-3 0 6Z';
  const angles = [-64, -36, -11, 15];
  return (
    <svg className={className} viewBox="-100 -64 200 92" aria-hidden="true" focusable="false">
      {angles.map((a) => (
        <path key={`r${a}`} d={frond} transform={`rotate(${a})`} />
      ))}
      {angles.map((a) => (
        <path key={`l${a}`} d={frond} transform={`scale(-1 1) rotate(${a})`} />
      ))}
    </svg>
  );
}

/** One layer of trunks, each standing on the layer's floor, with its order kept for staggered growth. */
function Trunks({ list, cls, kind, start = 0 }: { list: Trunk[]; cls: Classes; kind: string; start?: number }) {
  return (
    <>
      {list.map(([x, w, h], i) => (
        <i key={`${kind}${x}`} className={`${cls.trunk} ${cls[kind]}`} style={{ '--x': `${x}%`, '--w': `${w}%`, '--h': `${h}%`, '--i': start + i, '--side': x + w / 2 < 50 ? -1 : 1, '--out': x + w / 2 < 50 ? x + w + 4 : 104 - x } as Vars} />
      ))}
    </>
  );
}

function Ferns({ list, cls, start = 0, extra = '' }: { list: Trunk[]; cls: Classes; start?: number; extra?: string }) {
  return (
    <>
      {list.map(([x, w, h], i) => (
        <span key={`fern${x}`} className={`${cls.fern} ${extra}`} style={{ '--x': `${x}%`, '--w': `${w}%`, '--h': `${h}%`, '--i': start + i, '--side': x < 50 ? -1 : 1, '--out': x < 50 ? x + w + 14 : 114 - x } as Vars}>
          <i />
          <Crown className={cls.crown!} />
        </span>
      ))}
    </>
  );
}

/** The six endemic families, drawn flat from simple shapes. Facing and posture differ so the six read apart. */
function Bird({ shape, acc }: { shape: string; acc: string }): ReactNode {
  switch (shape) {
    case 'kiwi':
      return (
        <>
          <path d="M50 60C50 38 72 26 98 28C126 30 142 50 140 72C138 92 118 100 94 100C70 100 52 88 50 70Z" />
          <circle cx="52" cy="58" r="14" />
          <path d="M42 60Q22 74 10 106" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
          <path className={acc} d="M84 96L80 110H90M106 96L108 110H118" fill="none" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="47" cy="54" r="2.6" fill="#fff" />
        </>
      );
    case 'parrot':
      return (
        <>
          <path d="M68 104L54 120L70 118L82 102Z" />
          <path d="M72 102C58 88 58 58 72 44C82 34 100 36 106 50C112 64 104 90 90 102Z" />
          <circle cx="96" cy="38" r="17" />
          <path d="M110 30C124 30 127 44 118 52C116 46 112 43 107 44Z" />
          <path className={acc} d="M76 62C86 58 94 68 90 88C82 84 75 76 76 62Z" />
          <circle cx="100" cy="35" r="2.8" fill="#fff" />
        </>
      );
    case 'wattlebird':
      return (
        <>
          <path d="M42 60C54 46 86 46 106 56C120 62 130 74 146 84L142 92C124 86 108 82 94 84C72 86 52 78 42 66Z" />
          <circle cx="44" cy="56" r="14" />
          <path d="M31 52L16 57L31 62Z" />
          <ellipse className={acc} cx="34" cy="69" rx="4.5" ry="7" />
          <path d="M76 84L72 106M88 84L90 106" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          <circle cx="40" cy="52" r="2.6" fill="#fff" />
        </>
      );
    case 'wren':
      return (
        <>
          <path d="M58 80L46 70L52 88Z" />
          <ellipse cx="80" cy="82" rx="27" ry="21" />
          <circle cx="103" cy="66" r="13" />
          <path d="M114 63L132 57" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
          <ellipse className={acc} cx="76" cy="86" rx="14" ry="8" />
          <path d="M74 100L72 108M86 100L88 108" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="106" cy="63" r="2.4" fill="#fff" />
        </>
      );
    case 'stitchbird':
      return (
        <>
          <path d="M98 72L130 38L139 46L108 82Z" />
          <ellipse cx="80" cy="78" rx="29" ry="20" transform="rotate(-10 80 78)" />
          <circle cx="55" cy="62" r="14" />
          <path d="M43 59L29 62L43 66Z" />
          <path className={acc} d="M66 66C75 60 87 62 92 70C83 73 73 72 66 66Z" />
          <path d="M72 96L70 108M84 96L86 108" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="51" cy="59" r="2.5" fill="#fff" />
        </>
      );
    default:
      return (
        <>
          <path d="M54 78L30 86L34 94L58 88Z" />
          <ellipse cx="78" cy="80" rx="29" ry="22" />
          <circle className={acc} cx="100" cy="62" r="15" />
          <path d="M113 59L124 62L113 66Z" />
          <path d="M72 100L70 108M84 100L86 108" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="104" cy="59" r="2.6" fill="#23170a" />
        </>
      );
  }
}

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A section's opening: its heading behind a stand of trunks that part to the sides as it arrives. */
function Curtain({ cls, id, heading, kinds, children }: { cls: Classes; id: string; heading: string; kinds: [string, string, string]; children?: ReactNode }) {
  return (
    <ClearingOpen className={cls.curtain} from="start 0.95" to="start 0.15" rest={1}>
      <div className={cls.curtainHead}>
        <h2 id={id}>{heading}</h2>
        {children}
      </div>
      <div className={cls.curtainTrees} aria-hidden="true">
        <Trunks list={CURTAIN_BACK} cls={cls} kind={kinds[0]} />
        <Trunks list={CURTAIN_MID} cls={cls} kind={kinds[1]} />
        <Trunks list={CURTAIN_FRONT} cls={cls} kind={kinds[2]} />
      </div>
    </ClearingOpen>
  );
}

/**
 * A field guide to a frankly bizarre forest, drawn in flat colour, where the drawing keeps opening into the
 * real place. Their own sentence stands as a poster among trunks that grow up through it, with one slot of
 * the real forest among them; the visitor walks into the drawn forest until that slot is the whole
 * photograph; trunks part again on the birds, which fly onto one branch while the one that cannot fly
 * walks in; the volcano opens out of its own ridge behind drawn flax; and the trunks part a last time on a
 * drawn map of their country where the day is planned and sent, before the forest grows back.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('clearing', ['Red Hat Display', 'Source Serif 4']);
  const c = data.demo as Content;
  const m = projector(c.plan.map);
  const fliers = c.birds.families.filter((f) => f.shape !== 'kiwi');
  const landing = (f: { shape: string }) => (f.shape === 'kiwi' ? WALKER : FLOCK[fliers.indexOf(f as (typeof fliers)[number])] ?? FLOCK[0]!);

  return (
    <div className={s.root}>
      <style href="clearing" precedence="design">
        {css}
      </style>

      <nav aria-label={c.side.label}>
        <a className={s.sideTab} href={c.side.href} data-press>
          {c.side.label}
        </a>
      </nav>

      <section className={s.hero} id="top" data-hero aria-labelledby="hero-h">
        <ClearingPointer />
        <div className={s.grove} aria-hidden="true">
          <Trunks list={BACK} cls={s} kind="back" />
          <Ferns list={FERNS} cls={s} start={4} />
          <Trunks list={MID} cls={s} kind="mid" start={6} />
        </div>

        <header className={s.top}>
          <a className={s.mark} href="#top" aria-label={data.name}>
            <b>{c.wordmark[0]}</b>
            <span>{c.wordmark.slice(1).join(' ')}</span>
          </a>
          <a className={s.topCall} href={c.call.tel}>
            {c.call.display}
          </a>
        </header>

        <div className={s.say}>
          <p className={s.pre}>{c.hero.pre}</p>
          <h1 id="hero-h" className={s.title} aria-label={`${c.hero.lines.join(' ')} ${c.hero.post}`}>
            {c.hero.lines.map((line, li) => (
              <span key={line} className={s.word} aria-hidden="true">
                {[...line].map((ch, i) => (
                  <span key={`${ch}${i}`} style={{ '--i': li * 7 + i } as Vars}>
                    {ch}
                  </span>
                ))}
                {li === c.hero.lines.length - 1 && <em className={s.post}>{c.hero.post}</em>}
              </span>
            ))}
          </h1>
        </div>

        <div className={s.slit}>
          <div className={s.slitPhoto}>
            <Pic pic={pic(data, 'hero')} sizes="(min-width: 900px) 7vw, 16vw" first />
          </div>
        </div>

        <div className={s.frontRow} aria-hidden="true">
          <Trunks list={FRONT} cls={s} kind="front" start={8} />
        </div>

        <svg className={s.kiwi} viewBox="0 0 160 120" aria-hidden="true" focusable="false">
          <Bird shape="kiwi" acc={s.acc!} />
        </svg>

        <div className={s.floor}>
          <p className={s.where}>
            <b>{c.hero.where}</b>
            <span>{c.hero.pickup}</span>
          </p>
          <a className={s.plan} href={c.planLink.href} data-press data-magnetic>
            {c.planLink.label}
            <Arrow />
          </a>
        </div>
      </section>

      <main>
        <section className={s.walk} id="whirinaki" aria-labelledby="walk-h">
          <ClearingWalk steps={c.whirinaki.steps.length} className={s.walkPin}>
            <div className={s.walkPhoto}>
              <Pic pic={pic(data, 'forest')} phone={data.images.forestPhone} sizes="100vw" />
            </div>
            <div className={s.walkGlow} aria-hidden="true" />
            <div className={s.woods} aria-hidden="true">
              <Trunks list={FAR} cls={s} kind="far" />
              <Ferns list={WALK_FERNS} cls={s} />
              <Trunks list={NEAR} cls={s} kind="near" />
              <Ferns list={NEAR_FERNS} cls={s} extra={s.fernNear} />
              <Trunks list={NEAREST} cls={s} kind="nearest" />
              <i className={s.walkFloor} />
            </div>
            <div className={s.walkShade} aria-hidden="true" />
            <p className={s.walkLabel}>
              <b>{c.whirinaki.label}</b>
              <span>{c.whirinaki.tag}</span>
            </p>
            <h2 id="walk-h" className={s.srOnly}>
              {c.whirinaki.label}
            </h2>
            <ol className={s.lines}>
              {c.whirinaki.steps.map((line, i) => (
                <li key={line} data-step={i} data-state={i === 0 ? 'on' : 'off'}>
                  {line}
                </li>
              ))}
            </ol>
          </ClearingWalk>
          <div className={s.walkAfter}>
            <p data-reveal>{c.whirinaki.text}</p>
            <a className={s.chip} href="#plan" data-pick={c.whirinaki.ask.pick} data-press data-reveal>
              {c.whirinaki.ask.label}
              <Arrow />
            </a>
          </div>
        </section>

        <section className={s.birds} id="birds" aria-labelledby="birds-h">
          <Curtain cls={s} id="birds-h" heading={c.birds.heading} kinds={['far', 'near', 'nearest']}>
            <p className={s.curtainLead}>{c.birds.lead}</p>
          </Curtain>
          <ClearingOpen className={s.perch} from="start 0.92" to="end 0.62" rest={1}>
            <div className={s.scene}>
            <i className={s.branch} aria-hidden="true" />
            <i className={s.ground} aria-hidden="true" />
            <ul className={s.flock} aria-hidden="true">
              {c.birds.families.map((f) => {
                const at = landing(f);
                return (
                  <li key={f.name} className={f.shape === 'kiwi' ? s.walker : s.flier} style={{ '--x': `${at.x}%`, '--w': `${at.w}%`, '--dx': `${at.dx}vw`, '--dy': `${at.dy}vh`, '--r': `${at.r}deg`, '--t': at.t } as Vars}>
                    <svg viewBox="0 0 160 120" focusable="false">
                      <Bird shape={f.shape} acc={s.acc!} />
                    </svg>
                  </li>
                );
              })}
            </ul>
            </div>
            <div className={s.tally}>
              <p>{c.birds.familiesLabel}</p>
              <ul>
                {c.birds.families.map((f) => (
                  <li key={f.name} style={{ '--t': landing(f).t } as Vars}>
                    <i aria-hidden="true" />
                    {f.name}
                  </li>
                ))}
              </ul>
            </div>
          </ClearingOpen>
          <div className={s.birdFoot}>
            <p data-reveal>{c.birds.day}</p>
            <a className={s.chip} href="#plan" data-pick={c.birds.ask.pick} data-press data-reveal>
              {c.birds.ask.label}
              <Arrow />
            </a>
            <p className={s.birdMore} data-reveal>
              <span>{c.birds.more.text}</span>
              <a href={c.birds.more.link.href} rel="noopener">
                {c.birds.more.link.label}
              </a>
            </p>
          </div>
        </section>

        <section className={s.volcano} id="tongariro" aria-labelledby="vol-h">
          <header className={s.volHead}>
            <p className={s.label} data-reveal>
              {c.tongariro.label}
            </p>
            <h2 id="vol-h" data-reveal>
              {c.tongariro.heading}
            </h2>
          </header>
          <ClearingOpen className={s.peak} rest={1}>
            <div className={s.peakPhoto}>
              <Pic pic={pic(data, 'volcano')} phone={data.images.volcanoPhone} sizes="100vw" />
            </div>
            <svg className={s.flax} viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
              {FLAX.stalks.map((d) => (
                <path key={d} d={d} data-stalk="" />
              ))}
              {FLAX.blades.map((d) => (
                <path key={d} d={d} />
              ))}
            </svg>
          </ClearingOpen>
          <div className={s.volBody}>
            <p className={s.volText} data-reveal>
              {c.tongariro.text}
            </p>
            <p className={s.volNote} data-reveal>
              {c.tongariro.note}
            </p>
            <a className={s.chip} href="#plan" data-pick={c.tongariro.ask.pick} data-press data-reveal>
              {c.tongariro.ask.label}
              <Arrow />
            </a>
          </div>
        </section>

        <section className={s.planner} id="plan" aria-labelledby="plan-h">
          <Curtain cls={s} id="plan-h" heading={c.plan.heading} kinds={['back', 'mid', 'front']}>
            <p className={s.curtainLead}>{c.plan.hint}</p>
          </Curtain>
          <ClearingPlan
            email={c.email}
            days={c.plan.days}
            towns={c.plan.towns.map((t) => {
              const [x, y] = m.at(t.lon, t.lat);
              return { id: t.id, name: t.name, x, y };
            })}
            places={c.plan.places.map((p) => {
              const [x, y] = m.at(p.lon, p.lat);
              return { id: p.id, name: p.name, kind: p.kind, size: p.size, x, y };
            })}
            map={{ w: m.w, h: m.h, sea: m.sea, coast: m.coast, lakes: m.lakes }}
            demo={c.plan.demo}
            words={{ listLabel: c.plan.listLabel, pickup: c.plan.pickup, send: c.plan.send, empty: c.plan.empty, subject: c.plan.subject, bodyDays: c.plan.bodyDays, bodyTown: c.plan.bodyTown, bodyEnd: c.plan.bodyEnd }}
            cls={{ root: s.board!, map: s.map!, mapArt: s.mapArt!, town: s.town!, list: s.list!, listLabel: s.listLabel!, day: s.day!, dayMark: s.dayMark!, dayName: s.dayName!, dayMeta: s.dayMeta!, dayPrice: s.dayPrice!, send: s.send!, sendRow: s.sendRow!, sendNote: s.sendNote! }}
            after={
              <div className={s.planNote}>
                <p>{c.plan.lead}</p>
                <p>{c.plan.note}</p>
              </div>
            }
          />
        </section>

        <section className={s.guides} id="guides" aria-labelledby="guides-h">
          <div className={s.guidesText}>
            <h2 id="guides-h" className={s.label} data-reveal>
              {c.guides.heading}
            </h2>
            <p className={s.owners} data-reveal>
              {c.guides.owners}
            </p>
            <p className={s.hosted} data-reveal>
              {c.guides.before} <ClearingCount className={s.count} value={c.guides.count} /> {c.guides.after}
            </p>
            <p className={s.policy} data-reveal>
              {c.guides.policy}
            </p>
          </div>
          <ClearingSeen className={s.stand} amount={0.3}>
            <div className={s.columns} aria-hidden="true">
              {c.guides.people.map((p, i) => (
                <span key={p.name} style={{ '--h': `${p.height}%`, '--i': i } as Vars}>
                  <b>{p.name}</b>
                </span>
              ))}
            </div>
            <ul className={s.people}>
              {c.guides.people.map((p) => (
                <li key={p.name}>
                  <b>{p.name}</b>
                  <span>{p.role}</span>
                  <p>{p.text}</p>
                </li>
              ))}
            </ul>
          </ClearingSeen>
        </section>
      </main>

      <footer className={s.end}>
        <ClearingSeen className={s.endGrove} amount={0.15}>
          <div className={s.endWords}>
            <p className={s.endLine}>{c.end.line}</p>
            <p className={s.endSub}>{c.end.sub}</p>
          </div>
          <div className={s.endTrees} aria-hidden="true">
            <Trunks list={END_BACK} cls={s} kind="back" />
            <Ferns list={END_FERNS} cls={s} start={3} />
            <Trunks list={END_MID} cls={s} kind="endMid" start={5} />
          </div>
        </ClearingSeen>
        <div className={s.endFloor}>
          <p className={s.endWhere}>
            <b>{c.end.where}</b>
            <span>{c.end.address}</span>
          </p>
          <p className={s.endContact}>
            <a href={c.call.tel}>{c.call.display}</a>
            <a href={`mailto:${c.email}`}>{c.email}</a>
          </p>
          <DemoFoot domain={data.domain} />
        </div>
      </footer>

      <StickyBar main={{ label: c.book.label, href: c.book.href, external: true }} call={{ label: c.call.label, tel: c.call.tel }} />
    </div>
  );
}

export const clearing: Design = { Demo, fonts: ['red-hat-display-latin-wght-normal', 'source-serif-4-latin-wght-normal'], heroSizes: '(min-width: 900px) 7vw, 16vw' };
