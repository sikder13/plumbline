import type { CSSProperties, ReactNode } from 'react';
import { DemoFoot } from '@/components/DemoFoot';
import { LatchFill } from '@/components/LatchFill';
import { LatchGates, type GateTour } from '@/components/LatchGates';
import { LatchSwing } from '@/components/LatchSwing';
import { Pic } from '@/components/Pic';
import { Pinned } from '@/components/Pinned';
import { SectionLinks } from '@/components/SectionLinks';
import { StickyBar } from '@/components/StickyBar';
import { pic, type PageData } from '@/lib/data';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Price {
  label: string;
  value: string;
}

type Point = [number, number];

interface Place {
  lines: string[];
  x: number;
  y: number;
  lx: number;
  ly: number;
  anchor: 'start' | 'end';
  t: number;
  start?: boolean;
  sea?: boolean;
  join?: Point;
}

interface MapContent {
  label: string;
  lead: string;
  approved: string;
  share: string;
  note: string;
  title: string;
  size: Point;
  coast: Point[];
  river: Point[];
  places: Place[];
}

interface Content {
  wordmark: string[];
  nav: { label: string; href: string }[];
  book: { label: string; href: string };
  call: { label: string; tel: string; display: string; local: string };
  email: string;
  from: { label: string; price: string };
  hero: { lines: string[]; sub: string; place?: string };
  access: {
    kicker: string;
    heading: string;
    text: string[];
    map: MapContent;
    gems: { label: string; statement: string; items: { image: string; line: string; tour?: string }[] };
  };
  sunrise: { kicker: string; heading: string; steps: { title: string; text: string }[]; prices: Price[]; season: string; bookLabel: string };
  gates: {
    kicker: string;
    heading: string;
    lead: string;
    chooseLabel: string;
    railLabel: string;
    clearLabel: string;
    pausedLabel: string;
    countLabel: string;
    countJoin: string;
    moreLabel: string;
    pause: { from: [number, number]; to: [number, number] };
    demo: string[][];
    chips: { id: string; label: string }[];
    tours: GateTour[];
    bookLabel: string;
  };
  end: {
    kicker: string;
    heading: string;
    line: string;
    lastLabel: string;
    lastLead: string;
    lastNote: string;
    mailLead: string;
    meetLabel: string;
    meet: string;
    park: string;
    image: string;
    ratingUnit: string;
    ratingSource: string;
  };
  foot: { line: string; address: string };
}

type Classes = Record<string, string>;

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M3 10h13M11.5 5.5 16 10l-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A farm gate's leaf, hinged at its left edge: the tube frame, three bars between, two stays, the brace, two hinge straps and a latch. */
const LEAF: [string, number][] = [
  ['M27 12H417A7 7 0 0 1 424 19V151A7 7 0 0 1 417 158H27A7 7 0 0 1 20 151V19A7 7 0 0 1 27 12Z', 11],
  ['M20 48.5H424M20 85H424M20 121.5H424', 7],
  ['M160 12V158M292 12V158', 5],
  ['M30 150L414 20', 7],
  ['M20 30H-2M20 140H-2', 9],
  ['M424 76H435V94H424', 6],
];
/** The light along the top of each tube. */
const SHINE = 'M30 9.5H414M24 46.5H420M24 83H420M24 119.5H420';

/** The gate between its two timber posts, with its shadow on the ground. The leaf is its own layer, so it can swing in depth. */
function Gate({ s, className, style }: { s: Classes; className?: string; style?: CSSProperties }) {
  return (
    <span className={className ? `${s.gate} ${className}` : s.gate} style={style} aria-hidden="true">
      <span className={s.gateShadow} />
      <span className={s.gatePost} />
      <span className={s.gatePost} />
      <svg className={s.gateLeaf} viewBox="0 0 440 170" focusable="false">
        <g data-shade transform="translate(3 5)">
          {LEAF.map(([d, w]) => (
            <path key={d} d={d} strokeWidth={w + 1} />
          ))}
        </g>
        <g data-gold>
          {LEAF.map(([d, w]) => (
            <path key={d} d={d} strokeWidth={w} />
          ))}
        </g>
        <path data-shine d={SHINE} strokeWidth="2" />
      </svg>
    </span>
  );
}

/** Joins points into a smooth line (Catmull-Rom as cubic curves), returning the first point and the curves after it. */
function smooth(points: Point[]): { first: string; curves: string } {
  const p = points;
  let curves = '';
  for (let i = 0; i < p.length - 1; i++) {
    const [x0, y0] = p[i - 1] ?? p[i]!;
    const [x1, y1] = p[i]!;
    const [x2, y2] = p[i + 1]!;
    const [x3, y3] = p[i + 2] ?? p[i + 1]!;
    const c1 = [x1 + (x2 - x0) / 6, y1 + (y2 - y0) / 6];
    const c2 = [x2 - (x3 - x1) / 6, y2 - (y3 - y1) / 6];
    curves += `C${c1[0]!.toFixed(1)} ${c1[1]!.toFixed(1)} ${c2[0]!.toFixed(1)} ${c2[1]!.toFixed(1)} ${x2} ${y2}`;
  }
  return { first: `${p[0]![0]} ${p[0]![1]}`, curves };
}

/** The coast as the business's tour pages name it: land, sea, the river to the meeting point, and a pin for each named place. It draws itself as `--fill` rises. */
function CoastMap({ s, map }: { s: Classes; map: MapContent }) {
  const [w, h] = map.size;
  const coast = smooth(map.coast);
  const river = smooth(map.river);
  const land = `M0 0L${coast.first}${coast.curves}Z`;
  return (
    <svg className={s.mapSvg} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={map.title} focusable="false">
      <defs>
        <pattern id="latch-sea" width="14" height="9" patternUnits="userSpaceOnUse">
          <path d="M0 4.5H8" stroke="rgba(201,163,90,0.16)" strokeWidth="1" />
        </pattern>
        <pattern id="latch-land" width="10" height="10" patternUnits="userSpaceOnUse">
          <circle cx="5" cy="5" r="1" fill="rgba(16,22,20,0.22)" />
        </pattern>
      </defs>
      <rect width={w} height={h} className={s.sea} />
      <rect width={w} height={h} fill="url(#latch-sea)" />
      <path d={land} className={s.cliff} transform="translate(0 9)" />
      <path d={land} className={s.land} />
      <path d={land} fill="url(#latch-land)" />
      <path d={`M${river.first}${river.curves}`} className={s.river} />
      <path d={`M${coast.first}${coast.curves}`} className={s.coast} pathLength={1} />
      {map.places.map((p) => (
        <g key={p.lines.join(' ')} className={s.pin} data-start={p.start ? '' : undefined} data-sea={p.sea ? '' : undefined} style={{ '--t': p.t } as CSSProperties}>
          {p.join && <path d={`M${p.x} ${p.y}L${p.join[0]} ${p.join[1]}`} className={s.join} />}
          <circle cx={p.x} cy={p.y} r="11" className={s.pinRing} />
          <circle cx={p.x} cy={p.y} r="5" className={s.pinDot} />
          <text x={p.lx} y={p.ly} textAnchor={p.anchor} className={s.pinText}>
            {p.lines.map((l, i) => (
              <tspan key={l} x={p.lx} dy={i === 0 ? 0 : 18} data-second={i > 0 ? '' : undefined}>
                {l}
              </tspan>
            ))}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** One composition of the dawn drawing: a tall one for phones, a wide one for large screens. */
interface Layout {
  key: string;
  box: string;
  horizon: number;
  width: number;
  far: string;
  clouds: string[];
  land: string;
  edge: string;
  furrows: number[];
  fence: string;
  wires?: string;
  fenceWidth: number;
  leaf: { frame: string; bars: string; brace: string; stays: string; widths: [number, number, number] };
  lamp: [number, number, number];
  trail: Point[];
  trailR: number;
  hide: string;
  slot: string;
  slotWidth: number;
  penguin: { x0: number; y0: number; dx: number; dy: number; s: number };
  sun: [number, number, number, number];
  rise: number;
  glint: string;
  glintWidth: number;
  moon: string;
  birds: string;
  birdWidth: number;
  fly: number;
  fore: string;
  tussock: string;
  stars: [number, number, number][];
}

const PHONE: Layout = {
  key: 'tall',
  box: '0 0 400 860',
  horizon: 520,
  width: 400,
  far: 'M96 520C124 510 150 497 180 493C204 490 222 497 240 507L258 520Z',
  clouds: ['M10 472C80 463 170 464 246 469C196 478 90 480 10 472Z', 'M206 444C256 437 330 438 396 444C342 451 262 452 206 444Z'],
  land: 'M0 940V606C40 602 90 600 130 604C170 608 200 624 228 648C262 678 292 720 322 762C346 796 372 824 400 840V940Z',
  edge: 'M0 606C40 602 90 600 130 604C170 608 200 624 228 648C262 678 292 720 322 762C346 796 372 824 400 840',
  furrows: [42, 94, 156, 226],
  fence: 'M10 572V607M118 574V606',
  fenceWidth: 5,
  leaf: { frame: 'M14 566H113V600H14Z', bars: 'M14 574.5H113M14 583H113M14 591.5H113', brace: 'M17 597L110 569', stays: 'M47 566V600M80 566V600', widths: [5, 3, 2.2] },
  lamp: [118, 562, 34],
  trail: [
    [128, 608],
    [136, 611],
    [144, 614],
    [152, 618],
    [159, 623],
    [165, 628],
  ],
  trailR: 2.8,
  hide: 'M168 640V610L192 595L216 608V662Z',
  slot: 'M176 622H208',
  slotWidth: 5,
  penguin: { x0: 238, y0: 660, dx: 96, dy: 120, s: 1.8 },
  sun: [300, 486, 42, 240],
  rise: 104,
  glint: 'M282 532H318M272 546H328M286 560H314M268 576H332M282 594H318',
  glintWidth: 3,
  moon: 'M332 100A22 22 0 1 0 332 144A17 17 0 1 1 332 100Z',
  birds: 'M60 420q7 -7 14 0q7 -7 14 0M108 400q6 -6 12 0q6 -6 12 0M140 432q7 -7 14 0q7 -7 14 0',
  birdWidth: 2.4,
  fly: 170,
  fore: 'M0 940V786C36 774 80 776 116 792C142 804 160 830 172 940Z',
  tussock: 'M16 790l-7 -26M26 788l2 -30M36 789l9 -24M66 782l-5 -28M76 782l6 -26M98 788l-9 -22M108 791l5 -20M124 798l9 -18',
  stars: [
    [26, 40, 1.2], [80, 120, 1], [140, 60, 1.3], [200, 150, 1], [256, 34, 1.4], [318, 182, 1.1], [372, 50, 1.3], [356, 230, 1], [40, 220, 1.1],
    [118, 260, 0.9], [230, 250, 1.1], [300, 300, 1], [386, 270, 1.2], [176, 330, 0.9], [60, 380, 1], [340, 370, 0.9], [250, 410, 1], [380, 410, 0.9],
  ],
};

const WIDE: Layout = {
  key: 'wide',
  box: '0 0 900 560',
  horizon: 300,
  width: 900,
  far: 'M760 300C790 288 820 274 852 270C874 268 890 274 900 278V300ZM380 300C410 292 440 284 470 283C495 282 512 290 526 300Z',
  clouds: ['M420 238C500 228 600 230 690 236C620 246 500 248 420 238Z', 'M600 202C660 194 760 195 840 201C780 209 670 210 600 202Z', 'M100 176C170 168 260 169 330 175C270 183 170 184 100 176Z'],
  land: 'M0 640V346C150 342 330 338 470 344C520 347 556 360 590 384C630 412 664 450 700 490C730 522 770 546 830 556C860 560 900 560 900 560V640Z',
  edge: 'M0 346C150 342 330 338 470 344C520 347 556 360 590 384C630 412 664 450 700 490C730 522 770 546 830 556',
  furrows: [34, 76, 124, 180],
  fence: 'M60 322V345M140 320V344M220 318V343M300 316V343M372 304V344M466 306V346',
  wires: 'M0 327L372 321M0 336L372 331',
  fenceWidth: 3.6,
  leaf: { frame: 'M376 311H462V341H376Z', bars: 'M376 318.5H462M376 326H462M376 333.5H462', brace: 'M378 339L460 313', stays: 'M405 311V341M433 311V341', widths: [3.8, 2.4, 1.8] },
  lamp: [466, 300, 28],
  trail: [
    [476, 347],
    [486, 349],
    [496, 352],
    [506, 356],
    [515, 361],
    [523, 366],
  ],
  trailR: 2.2,
  hide: 'M526 368V342L546 330L566 340V384Z',
  slot: 'M534 352H560',
  slotWidth: 4,
  penguin: { x0: 600, y0: 394, dx: 116, dy: 112, s: 1.3 },
  sun: [690, 262, 40, 300],
  rise: 92,
  glint: 'M670 312H710M660 324H720M674 336H706M654 350H726M670 366H710M662 384H718',
  glintWidth: 2.6,
  moon: 'M822 56A18 18 0 1 0 822 92A14 14 0 1 1 822 56Z',
  birds: 'M560 186q6 -6 12 0q6 -6 12 0M600 168q5 -5 10 0q5 -5 10 0M624 202q5.5 -5.5 11 0q5.5 -5.5 11 0M656 180q4 -4 8 0q4 -4 8 0',
  birdWidth: 2,
  fly: 150,
  fore: 'M0 640V500C60 488 140 492 200 512C230 522 250 540 262 640ZM900 640V520C870 512 840 516 810 530C796 538 786 548 778 640Z',
  tussock: 'M14 504l-6 -22M24 500l2 -26M36 500l8 -20M70 494l-4 -24M82 494l5 -22M110 498l-7 -18M840 524l-5 -20M852 520l3 -24M866 518l7 -20M884 516l-3 -22',
  stars: [
    [380, 40, 1.1], [430, 110, 0.8], [480, 30, 1], [530, 90, 0.8], [580, 22, 1.1], [620, 70, 0.8], [660, 130, 1], [700, 40, 0.9], [740, 160, 0.8],
    [790, 120, 1.1], [850, 150, 0.9], [880, 230, 0.8], [600, 150, 0.7], [520, 170, 0.8], [440, 200, 0.7], [700, 110, 0.8], [860, 30, 0.7],
    [40, 30, 0.9], [120, 80, 0.8], [200, 26, 1], [280, 70, 0.8], [330, 140, 0.7],
  ],
};

/** A penguin standing with its feet at the origin, facing down the bank. It waddles while the walk is on. */
function Penguin({ s, lag, at }: { s: Classes; lag: number; at: Layout['penguin'] }) {
  const style = { '--lag': lag, '--x0': `${at.x0}px`, '--y0': `${at.y0}px`, '--dx': `${at.dx}px`, '--dy': `${at.dy}px`, '--s': at.s } as CSSProperties;
  return (
    <g className={s.penguin} style={style}>
      <g className={s.waddle}>
        <path data-feet d="M-7 -1H0L-2 1.4H-8ZM2 -1H9L7 1.4H1Z" />
        <path data-body d="M0 -34C7 -34 10 -28 10 -21C12 -12 11 -5 8 -1H-7C-11 -5 -12 -12 -10 -21C-10 -28 -7 -34 0 -34Z" />
        <path data-back d="M-9 -22C-15 -15 -16 -8 -13 -4L-9 -12Z" />
        <ellipse data-belly cx="3" cy="-13" rx="5" ry="9.6" />
        <path data-bill d="M7 -30L14.5 -28.4L7 -26.8Z" />
        <path data-band d="M-5 -30.6Q1 -34.2 7 -30.8" />
      </g>
    </g>
  );
}

/**
 * The dawn story, drawn in layers: sky, clouds, a far headland, the sea, the bank with its gate
 * and hide, and grass in front. The frame's progress lights the lamp, swings the gate, draws the
 * path, walks the penguins down to the water and raises the sun; the layers move at different
 * speeds as it goes. Nothing here is a map.
 */
function Scene({ s, at, className }: { s: Classes; at: Layout; className?: string }) {
  const id = (name: string) => `latch-${at.key}-${name}`;
  const [sx, sy, sr, glow] = at.sun;
  const [lx, ly, lr] = at.lamp;
  return (
    <svg className={className} viewBox={at.box} preserveAspectRatio="xMidYMid slice" focusable="false" style={{ '--rise': `${at.rise}px`, '--fly': `${at.fly}px` } as CSSProperties}>
      <defs>
        <linearGradient id={id('night')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0a1224" />
          <stop offset="0.42" stopColor="#17243f" />
          <stop offset="0.6" stopColor="#3a4566" />
        </linearGradient>
        <linearGradient id={id('day')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#24315a" />
          <stop offset="0.3" stopColor="#5a5476" />
          <stop offset="0.5" stopColor="#d48d6b" />
          <stop offset="0.62" stopColor="#ffd08a" />
        </linearGradient>
        <radialGradient id={id('glow')}>
          <stop offset="0" stopColor="#ffdca0" stopOpacity="0.95" />
          <stop offset="0.3" stopColor="#ffb77a" stopOpacity="0.45" />
          <stop offset="1" stopColor="#ffb77a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('lamp')}>
          <stop offset="0" stopColor="#ffd98c" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffd98c" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('sea')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b2b3c" />
          <stop offset="1" stopColor="#060a0e" />
        </linearGradient>
        <linearGradient id={id('sea-day')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b08478" />
          <stop offset="0.3" stopColor="#47505e" />
          <stop offset="1" stopColor="#0c141a" />
        </linearGradient>
        <linearGradient id={id('land')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#24372e" />
          <stop offset="1" stopColor="#0d1613" />
        </linearGradient>
      </defs>
      <rect width={at.width} height="1000" fill={`url(#${id('night')})`} />
      <rect className={s.skyDawn} width={at.width} height="1000" fill={`url(#${id('day')})`} />
      <circle className={s.sunGlow} cx={sx} cy={at.horizon} r={glow} fill={`url(#${id('glow')})`} />
      <g className={s.stars}>
        {at.stars.map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
        ))}
      </g>
      <path className={s.moon} d={at.moon} />
      <g className={s.clouds}>
        {at.clouds.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g className={s.sun}>
        <circle cx={sx} cy={sy} r={sr} fill="#ffd27c" />
      </g>
      <g className={s.cloudsLit}>
        {at.clouds.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g className={s.birds}>
        <path d={at.birds} strokeWidth={at.birdWidth} />
      </g>
      <rect y={at.horizon} width={at.width} height="600" fill={`url(#${id('sea')})`} />
      <rect className={s.seaDawn} y={at.horizon} width={at.width} height="600" fill={`url(#${id('sea-day')})`} />
      <path className={s.glint} d={at.glint} strokeWidth={at.glintWidth} />
      <path className={s.horizon} d={`M0 ${at.horizon}H${at.width}`} />
      <path className={s.far} d={at.far} />
      <g className={s.near}>
        <path d={at.land} fill="#070c0a" />
        <path className={s.landDawn} d={at.land} fill={`url(#${id('land')})`} />
        <g className={s.furrows}>
          {at.furrows.map((dy) => (
            <path key={dy} d={at.edge} transform={`translate(0 ${dy})`} />
          ))}
        </g>
        <path className={s.rim} d={at.edge} />
        <g className={s.lamp}>
          <circle cx={lx} cy={ly} r={lr} fill={`url(#${id('lamp')})`} />
          <circle cx={lx} cy={ly} r={lr / 7} fill="#ffe3a6" />
        </g>
        <g className={s.fence}>
          <path d={at.fence} strokeWidth={at.fenceWidth} />
          {at.wires && <path d={at.wires} strokeWidth={1.4} opacity="0.7" />}
        </g>
        <g className={s.sceneLeaf}>
          <path d={at.leaf.frame} strokeWidth={at.leaf.widths[0]} />
          <path d={`${at.leaf.bars}${at.leaf.brace}`} strokeWidth={at.leaf.widths[1]} />
          <path d={at.leaf.stays} strokeWidth={at.leaf.widths[2]} />
        </g>
        <g className={s.trail}>
          {at.trail.map(([x, y], i) => (
            <circle key={x} cx={x} cy={y} r={at.trailR} style={{ '--k': i / at.trail.length } as CSSProperties} />
          ))}
        </g>
        <path className={s.hide} d={at.hide} />
        <path className={s.slot} d={at.slot} strokeWidth={at.slotWidth} />
        <Penguin s={s} lag={0} at={at.penguin} />
        <Penguin s={s} lag={0.05} at={at.penguin} />
        <Penguin s={s} lag={0.1} at={at.penguin} />
      </g>
      <g className={s.fore}>
        <path d={at.fore} />
        <path className={s.tussock} d={at.tussock} />
      </g>
    </svg>
  );
}

/**
 * A place seen through a local's gate. A heavy farm gate in a fence line swings open over the
 * coast as the page loads; the coast's named highlights draw themselves on public ground while
 * three more gates open onto private ground; the dawn tour is drawn as a night lifting; each
 * tour's gate opens or shuts for what the visitor came for; and the end is the same gate standing
 * open, with the way to book.
 */
function Demo({ data }: { data: PageData }) {
  const c = data.demo as Content;
  const { css, s } = designStyles('latch', ['Epilogue', 'Schibsted Grotesk', 'DM Mono']);
  const book = { href: c.book.href, rel: 'noopener' };
  const keys = [...new Set(c.gates.tours.flatMap((t) => [t.image, ...Object.values(t.images)]))];
  const pictures: Record<string, ReactNode> = Object.fromEntries(keys.map((k) => [k, <Pic key={k} pic={pic(data, k)} sizes="(min-width: 1000px) 60vw, 100vw" />]));
  const steps = c.sunrise.steps;
  const last = steps.length - 1;

  return (
    <div className={s.root}>
      <style href="latch" precedence="design">
        {css}
      </style>

      <section className={s.hero} id="top" data-hero>
        <div className={s.heroMedia}>
          <Pic pic={pic(data, 'hero')} phone={data.images.heroPhone} sizes="100vw" first />
        </div>
        <span className={s.heroGrade} aria-hidden="true" />
        <header className={s.top}>
          <a className={s.mark} href="#top" aria-label={data.name}>
            {c.wordmark.join(' ')}
          </a>
          <p className={s.place}>{c.hero.place}</p>
          <a className={s.topCall} href={c.call.tel}>
            {c.call.display}
          </a>
        </header>
        <h1 className={s.title} aria-label={c.hero.lines.join(' ')}>
          {c.hero.lines.map((l, i) => (
            <span key={l} className={s.line} aria-hidden="true">
              <span style={{ '--i': i } as CSSProperties}>{l}</span>
            </span>
          ))}
        </h1>
        <div className={s.ground}>
          <div className={s.yard} aria-hidden="true">
            <Gate s={s} className={s.heroGate} />
          </div>
          <p className={s.sub}>{c.hero.sub}</p>
          <div className={s.act}>
            <a className={s.go} data-press data-magnetic {...book}>
              {c.book.label}
              <Arrow />
            </a>
            <p className={s.from}>
              {c.from.label}
              <b>{c.from.price}</b>
            </p>
          </div>
        </div>
      </section>

      <main>
        <section className={s.access} id="access" aria-labelledby="access-h">
          <header className={s.accessHead}>
            <p className={s.kicker}>{c.access.kicker}</p>
            <h2 id="access-h">{c.access.heading}</h2>
            <div className={s.accessText}>
              {c.access.text.map((t) => (
                <p key={t}>{t}</p>
              ))}
            </div>
          </header>

          <div className={s.mapBlock}>
            <LatchFill className={s.mapFrame} from="start 0.8" to="end 0.55">
              <div className={s.mapPan}>
                <CoastMap s={s} map={c.access.map} />
              </div>
            </LatchFill>
            <div className={s.mapText}>
              <p className={s.label}>{c.access.map.label}</p>
              <p className={s.mapLead}>{c.access.map.lead}</p>
              <p className={s.mapApproved}>{c.access.map.approved}</p>
              <p className={s.mapShare}>{c.access.map.share}</p>
              <p className={s.mapNote}>{c.access.map.note}</p>
            </div>
          </div>

          <div className={s.gems}>
            <p className={s.label}>{c.access.gems.label}</p>
            <p className={s.statement}>{c.access.gems.statement}</p>
            <ul className={s.gemRow}>
              {c.access.gems.items.map((g, i) => (
                <li key={g.image}>
                  <LatchFill className={s.gem} from="start 0.92" to="start 0.3" style={{ '--k': i } as CSSProperties}>
                    <div className={s.gemView}>
                      <Pic pic={pic(data, g.image)} sizes="(min-width: 1000px) 30vw, 100vw" />
                      <span className={s.gemVeil} aria-hidden="true" />
                      <span className={s.gemGround} aria-hidden="true" />
                      <Gate s={s} className={s.gemGate} />
                    </div>
                    <p className={s.gemLine}>{g.line}</p>
                    {g.tour && <p className={s.gemTour}>{g.tour}</p>}
                  </LatchFill>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={s.sunrise} id="sunrise" aria-labelledby="sun-h">
          <Pinned steps={steps.length} className={s.dawn}>
            <div className={s.scene} aria-hidden="true">
              <Scene s={s} at={PHONE} className={s.scenePhone} />
              <Scene s={s} at={WIDE} className={s.sceneWide} />
            </div>
            <div className={s.dawnText}>
              <p className={s.kicker}>{c.sunrise.kicker}</p>
              <h2 id="sun-h">{c.sunrise.heading}</h2>
              <ol className={s.dawnSteps}>
                {steps.map((st, i) => (
                  <li key={st.title} data-step={i} data-state={i === 0 ? 'on' : 'off'}>
                    <h3>{st.title}</h3>
                    <p>{st.text}</p>
                    {i === last && (
                      <div className={s.dawnBook}>
                        <p className={s.fares}>
                          {c.sunrise.prices.map((p) => (
                            <span key={p.label}>
                              {p.label}
                              <b>{p.value}</b>
                            </span>
                          ))}
                        </p>
                        <a className={s.go} data-press {...book}>
                          {c.sunrise.bookLabel}
                          <Arrow />
                        </a>
                        <p className={s.season}>{c.sunrise.season}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </Pinned>
        </section>

        <section className={s.tours} id="tours" aria-labelledby="tours-h">
          <header className={s.toursHead}>
            <p className={s.kicker}>{c.gates.kicker}</p>
            <h2 id="tours-h">{c.gates.heading}</h2>
            <p className={s.toursLead}>{c.gates.lead}</p>
          </header>
          <LatchGates
            chips={c.gates.chips}
            tours={c.gates.tours}
            pictures={pictures}
            gate={<Gate s={s} />}
            labels={{
              choose: c.gates.chooseLabel,
              rail: c.gates.railLabel,
              clear: c.gates.clearLabel,
              paused: c.gates.pausedLabel,
              book: c.gates.bookLabel,
              count: c.gates.countLabel,
              join: c.gates.countJoin,
              more: c.gates.moreLabel,
            }}
            pause={c.gates.pause}
            demo={c.gates.demo}
            book={c.book}
            cls={{
              chooser: s.chooser!,
              chips: s.chips!,
              chip: s.chip!,
              status: s.status!,
              clear: s.clear!,
              stage: s.stage!,
              rail: s.rail!,
              row: s.row!,
              rowName: s.rowName!,
              rowPrice: s.rowPrice!,
              state: s.state!,
              feature: s.feature!,
              media: s.media!,
              shot: s.shot!,
              paused: s.paused!,
              body: s.body!,
              name: s.name!,
              line: s.tourLine!,
              facts: s.facts!,
              buy: s.buy!,
              price: s.price!,
              go: s.go!,
              more: s.more!,
              sees: s.sees!,
              prices: s.prices!,
              note: s.note!,
              sr: s.sr!,
            }}
          />
        </section>

        <section className={s.end} id="book" aria-labelledby="end-h">
          <div className={s.endScene}>
            <Pic pic={pic(data, c.end.image)} sizes="100vw" />
            <span className={s.endGrade} aria-hidden="true" />
            <div className={s.endGround} data-latch="">
              <div className={s.yard} aria-hidden="true">
                <Gate s={s} className={s.endGate} />
              </div>
              <p className={s.kicker}>{c.end.kicker}</p>
              <h2 id="end-h">{c.end.heading}</h2>
              <p className={s.endLine}>{c.end.line}</p>
            </div>
          </div>
          <ul className={s.bookList}>
            {c.gates.tours.map((t) => (
              <li key={t.id}>
                <a className={s.bookRow} data-press {...book}>
                  <span className={s.bookName}>{t.name}</span>
                  <span className={s.bookPrice}>
                    {t.prices[0]!.label}
                    <b>{t.prices[0]!.value}</b>
                  </span>
                  <span className={s.bookGo}>
                    <Arrow />
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <div className={s.reach}>
            <div>
              <p className={s.reachLabel}>{c.end.lastLabel}</p>
              <p className={s.reachLead}>{c.end.lastLead}</p>
              <a className={s.phone} href={c.call.tel}>
                {c.call.local}
              </a>
              <p className={s.reachNote}>{c.end.lastNote}</p>
            </div>
            <div>
              <p className={s.reachLabel}>{c.end.kicker}</p>
              <a className={s.mail} href={`mailto:${c.email}`}>
                {c.email}
              </a>
              <p className={s.reachNote}>{c.end.mailLead}</p>
            </div>
            <div>
              <p className={s.reachLabel}>{c.end.meetLabel}</p>
              <p className={s.meetPlace}>{c.end.meet}</p>
              <p className={s.reachNote}>{c.end.park}</p>
            </div>
          </div>
          {data.rating && (
            <p className={s.rated}>
              {data.rating.value} · {data.rating.count} {c.end.ratingUnit} · {c.end.ratingSource}
            </p>
          )}
        </section>
      </main>

      <footer className={s.foot}>
        <svg className={s.footFence} viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <path d="M40 4V40M200 4V40M360 4V40M520 4V40M680 4V40M840 4V40" />
          <path data-wire d="M0 12H1000M0 24H1000" />
        </svg>
        <p className={s.footMark}>{c.wordmark.join(' ')}</p>
        <p className={s.footLine}>{c.foot.line}</p>
        <p className={s.footAddress}>{c.foot.address}</p>
        <DemoFoot domain={data.domain} />
      </footer>

      <nav className={s.dock} aria-label="Sections">
        <SectionLinks className={s.dockLinks} items={c.nav} />
        <a className={s.dockBook} data-press {...book}>
          {c.book.label}
          <span>{c.from.price}</span>
        </a>
      </nav>

      <StickyBar main={{ label: c.book.label, href: c.book.href, external: true }} call={{ label: c.call.label, tel: c.call.tel }} />
      <LatchSwing />
    </div>
  );
}

export const latch: Design = { Demo, fonts: ['epilogue-latin-wght-normal'], heroSizes: '100vw' };
