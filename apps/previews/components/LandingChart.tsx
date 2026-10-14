import type { CSSProperties } from 'react';
import { Kayak } from './LandingKayak';
import type { RouteTrack } from './LandingRoute';

type Point = readonly [number, number];

/** One drawing of the coast: the land, its two beaches, a few islands and rocks, the paddle route and where it stops. */
interface Geometry {
  key: 'phone' | 'desk';
  w: number;
  h: number;
  land: string;
  /** The waterline alone, for the shallows along it. */
  coast: string;
  beaches: string[];
  islands: { x: number; y: number; r: number; d?: number }[];
  rocks: Point[];
  /** The route, drawn with a move and cubic curves only. */
  route: string;
  stops: Point[];
  /** Where each stop's words sit, as a share of the drawing. */
  labels: { x: number; y: number }[];
  boat: number;
  cup: Point;
}

const PHONE: Geometry = {
  key: 'phone',
  w: 360,
  h: 600,
  land: 'M0 0H70C62 26 40 40 36 64C32 92 58 106 62 134C68 176 44 200 50 246C56 296 92 318 88 366C84 414 52 440 44 488C38 524 54 546 64 600H0Z',
  coast: 'M70 0C62 26 40 40 36 64C32 92 58 106 62 134C68 176 44 200 50 246C56 296 92 318 88 366C84 414 52 440 44 488C38 524 54 546 64 600',
  beaches: ['M45 38C37 50 33 62 35 78C36 88 41 96 47 102', 'M50 466C44 484 41 498 43 514C44 528 49 540 56 552'],
  islands: [
    { x: 312, y: 178, r: 11 },
    { x: 298, y: 338, r: 13, d: 7 },
    { x: 318, y: 482, r: 9 },
    { x: 206, y: 488, r: 6 },
  ],
  rocks: [
    [104, 296],
    [112, 304],
    [98, 306],
    [96, 428],
    [104, 436],
    [92, 440],
    [186, 168],
    [194, 176],
  ],
  route: 'M44 70C100 70 150 110 146 160C143 196 112 200 112 220C112 252 154 268 156 310C158 346 126 352 128 370C130 410 150 440 120 476C100 500 70 510 50 520',
  stops: [
    [44, 70],
    [112, 220],
    [128, 370],
    [50, 520],
  ],
  labels: [
    { x: 0.48, y: 0.085 },
    { x: 0.48, y: 0.335 },
    { x: 0.48, y: 0.585 },
    { x: 0.48, y: 0.835 },
  ],
  boat: 84,
  cup: [28, 560],
};

const DESK: Geometry = {
  key: 'desk',
  w: 1200,
  h: 430,
  land: 'M0 0H1200V74C1160 76 1130 92 1090 92C1050 92 1030 70 980 66C900 60 860 84 780 82C700 80 660 58 600 60C520 62 500 86 430 84C360 82 330 60 270 62C210 64 180 90 140 92C110 93 90 86 60 78C36 72 18 70 0 72Z',
  coast: 'M1200 74C1160 76 1130 92 1090 92C1050 92 1030 70 980 66C900 60 860 84 780 82C700 80 660 58 600 60C520 62 500 86 430 84C360 82 330 60 270 62C210 64 180 90 140 92C110 93 90 86 60 78C36 72 18 70 0 72',
  beaches: ['M62 80C86 88 110 93 140 92C160 91 176 86 190 80', 'M1030 76C1050 88 1068 92 1090 92C1114 92 1134 86 1150 80'],
  islands: [
    { x: 232, y: 150, r: 17 },
    { x: 690, y: 132, r: 24, d: 10 },
    { x: 996, y: 236, r: 13 },
    { x: 560, y: 168, r: 7 },
  ],
  rocks: [
    [372, 172],
    [384, 180],
    [364, 184],
    [896, 252],
    [908, 246],
    [904, 262],
    [520, 262],
    [532, 270],
  ],
  route: 'M110 104C150 190 260 236 350 236C400 236 420 226 450 226C520 226 560 180 620 186C690 192 720 250 780 250C860 250 900 190 960 160C1010 134 1050 116 1090 104',
  stops: [
    [110, 104],
    [450, 226],
    [780, 250],
    [1090, 104],
  ],
  labels: [
    { x: 0.017, y: 0.69 },
    { x: 0.29, y: 0.69 },
    { x: 0.565, y: 0.69 },
    { x: 0.8, y: 0.69 },
  ],
  boat: 124,
  cup: [1124, 70],
};

/** Places the kayak at a point on the drawing, pointing along the route. */
function boatAt(g: Geometry, [x, y]: Point, angle: number): string {
  const k = g.boat / 166;
  return `translate(${x} ${y}) rotate(${angle}) translate(${(-104 * k).toFixed(2)} ${(-24 * k).toFixed(2)})`;
}

const POINTS = 160;

/**
 * The route measured once, as the page is made: points evenly spaced along it, its length and how far
 * along it each stop is. The page then only looks the kayak's place up as the visitor scrolls.
 */
function measure(g: Geometry): RouteTrack {
  const n = (g.route.match(/-?\d*\.?\d+/g) ?? []).map(Number);
  let [x0, y0] = [n[0]!, n[1]!];
  const fine: { l: number; x: number; y: number }[] = [{ l: 0, x: x0, y: y0 }];
  let length = 0;
  for (let i = 2; i + 5 < n.length; i += 6) {
    const [x1, y1, x2, y2, x3, y3] = n.slice(i, i + 6) as [number, number, number, number, number, number];
    for (let k = 1; k <= 48; k++) {
      const t = k / 48;
      const u = 1 - t;
      const x = u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3;
      const y = u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3;
      const prev = fine[fine.length - 1]!;
      length += Math.hypot(x - prev.x, y - prev.y);
      fine.push({ l: length, x, y });
    }
    [x0, y0] = [x3, y3];
  }
  const pts: number[] = [];
  let j = 0;
  for (let i = 0; i <= POINTS; i++) {
    const target = (i / POINTS) * length;
    while (j < fine.length - 2 && fine[j + 1]!.l < target) j++;
    const a = fine[j]!;
    const b = fine[j + 1]!;
    const f = b.l > a.l ? (target - a.l) / (b.l - a.l) : 0;
    pts.push(Number((a.x + (b.x - a.x) * f).toFixed(1)), Number((a.y + (b.y - a.y) * f).toFixed(1)));
  }
  const at = g.stops.map(([sx, sy]) => {
    let best = fine[0]!;
    let bestD = Infinity;
    for (const p of fine) {
      const d = (p.x - sx) ** 2 + (p.y - sy) ** 2;
      if (d < bestD) [bestD, best] = [d, p];
    }
    return Number(best.l.toFixed(1));
  });
  return { pts, len: Number(length.toFixed(1)), at, boat: g.boat };
}

/** The measured routes, for the part of the page that moves the kayak. */
export function routeTracks(): { phone: RouteTrack; desk: RouteTrack } {
  return { phone: measure(PHONE), desk: measure(DESK) };
}

function Drawing({ g, className }: { g: Geometry; className: string | undefined }) {
  const [sx, sy] = g.stops[0]!;
  return (
    <svg className={className} data-geo={g.key} viewBox={`0 0 ${g.w} ${g.h}`} aria-hidden="true" focusable="false">
      <defs>
        {/* The land fades away from the water, so the drawing has no hard edge where it meets the page. */}
        <linearGradient id={`landing-land-${g.key}`} x1="0" y1="0" x2={g.key === 'desk' ? '0' : '1'} y2={g.key === 'desk' ? '1' : '0'}>
          <stop offset="0" stopColor="#1c5a4d" stopOpacity="0" />
          <stop offset="0.62" stopColor="#1c5a4d" stopOpacity="0.92" />
          <stop offset="1" stopColor="#21614f" />
        </linearGradient>
      </defs>
      <path data-coast d={g.coast} />
      <path data-land d={g.land} fill={`url(#landing-land-${g.key})`} />
      {g.beaches.map((d) => (
        <path key={d} data-beach d={d} />
      ))}
      {g.islands.map((i) => (
        <g key={`${i.x}-${i.y}`} data-island>
          <ellipse cx={i.x} cy={i.y} rx={i.r * 1.3} ry={i.r} />
          {i.d && <ellipse cx={i.x + i.r * 1.8} cy={i.y + i.r * 0.6} rx={i.d} ry={i.d * 0.7} />}
        </g>
      ))}
      {g.rocks.map(([x, y]) => (
        <circle key={`${x}-${y}`} data-rock cx={x} cy={y} r={g.key === 'desk' ? 3.4 : 2.6} />
      ))}
      <path data-plan d={g.route} />
      <path data-wake d={g.route} />
      {g.stops.map(([x, y], i) => (
        <g key={`${x}-${y}`} data-step={i} data-state={i === 0 ? 'on' : 'off'} data-dot>
          <circle cx={x} cy={y} r={g.key === 'desk' ? 9 : 7} />
          {g.key === 'desk' && <path data-leader d={`M${x} ${y + 12}V${g.h * g.labels[i]!.y - 10}`} />}
        </g>
      ))}
      <g data-cup transform={`translate(${g.cup[0]} ${g.cup[1]}) scale(${g.key === 'desk' ? 1.5 : 1.1})`}>
        <path data-steam d="M-3 -10C-6 -14 0 -16 -3 -21M3 -10C0 -14 6 -16 3 -21" />
        <path data-mug d="M-7 -7H7V2C7 6 4 8 0 8C-4 8 -7 6 -7 2Z M7 -4C11 -4 11 2 7 2" />
      </g>
      <g data-boat transform={boatAt(g, [sx, sy], 0)}>
        <svg width={g.boat} height={(g.boat * 48) / 166} viewBox="-44 -10 166 48" overflow="visible">
          <Kayak sail />
        </svg>
      </g>
    </svg>
  );
}

/**
 * The drawn chart of the tour: two drawings of the same coast, one standing for a phone and one lying
 * along a wide screen, and the words of each stop placed beside it. Rendered as the page is made; the
 * kayak is moved by LandingRoute.
 */
export function LandingChart({ steps, cls }: { steps: { place: string; text: string }[]; cls: Record<'chart' | 'map' | 'stops', string | undefined> }) {
  return (
    <div className={cls.chart}>
      <Drawing g={PHONE} className={cls.map} />
      <Drawing g={DESK} className={cls.map} />
      <ol className={cls.stops}>
        {steps.map((st, i) => (
          <li
            key={st.place}
            data-step={i}
            data-state={i === 0 ? 'on' : 'off'}
            style={{ '--px': PHONE.labels[i]!.x, '--py': PHONE.labels[i]!.y, '--dx': DESK.labels[i]!.x, '--dy': DESK.labels[i]!.y } as CSSProperties}
          >
            <h3>{st.place}</h3>
            <p>{st.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
