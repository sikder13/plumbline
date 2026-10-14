'use client';

import { useEffect, useRef, type ReactNode } from 'react';

type Pt = [number, number];
/** A cubic curve's two control points and its end, the start being the end of the curve before. */
type Seg = [number, number, number, number, number, number];

/** The sketch is drawn in a box 400 wide and 520 tall. It is a drawing of a flooded crater, not a map. */
export const CRATER_VIEW = '0 0 400 520';
export const CRATER_CENTRE: Pt = [205, 290];

/** The shore, open at the foot where the crater meets the sea. */
const SHORE_START: Pt = [168, 520];
const SHORE: Seg[] = [
  [150, 488, 104, 470, 80, 430],
  [58, 394, 74, 360, 62, 326],
  [48, 288, 56, 256, 70, 228],
  [84, 200, 66, 170, 78, 140],
  [94, 98, 132, 72, 172, 60],
  [214, 48, 258, 52, 292, 72],
  [326, 92, 344, 124, 340, 160],
  [336, 190, 352, 214, 350, 246],
  [348, 282, 330, 306, 334, 340],
  [338, 374, 318, 404, 300, 430],
  [284, 454, 262, 480, 254, 520],
];

/** The paddle, hugging the shore from the launch: each curve ends at a stop. */
const ROUTE_START: Pt = [322, 250];
const ROUTE: Seg[] = [
  [326, 214, 322, 170, 306, 136],
  [288, 104, 248, 86, 200, 88],
  [152, 90, 108, 130, 100, 200],
  [94, 252, 88, 292, 100, 330],
];

const d = (start: Pt, segs: Seg[]) => `M${start[0]} ${start[1]}${segs.map((s) => `C${s.join(' ')}`).join('')}`;
export const SHORE_PATH = d(SHORE_START, SHORE);
export const WATER_PATH = `${SHORE_PATH}Z`;
const ROUTE_PATH = d(ROUTE_START, ROUTE);

function bez(a: Pt, s: Seg, t: number): Pt {
  const u = 1 - t;
  return [u * u * u * a[0] + 3 * u * u * t * s[0] + 3 * u * t * t * s[2] + t * t * t * s[4], u * u * u * a[1] + 3 * u * u * t * s[1] + 3 * u * t * t * s[3] + t * t * t * s[5]];
}

/** Points along a chain of curves, each with its distance from the start. */
export function sample(start: Pt, segs: Seg[], per = 40): { pts: Pt[]; at: number[]; ends: number[] } {
  const pts: Pt[] = [start];
  const at = [0];
  const ends = [0];
  let from = start;
  for (const s of segs) {
    for (let k = 1; k <= per; k++) {
      const p = bez(from, s, k / per);
      const q = pts[pts.length - 1]!;
      at.push(at[at.length - 1]! + Math.hypot(p[0] - q[0], p[1] - q[1]));
      pts.push(p);
    }
    ends.push(at[at.length - 1]!);
    from = [s[4], s[5]];
  }
  return { pts, at, ends };
}

export const SHORE_POINTS = sample(SHORE_START, SHORE, 30).pts;
const R = sample(ROUTE_START, ROUTE, 60);
const TOTAL = R.at[R.at.length - 1]!;
/** Where along the paddle each stop is, from 0 to 1. */
const STOPS = R.ends.map((e) => e / TOTAL);

function pointAt(f: number): { p: Pt; angle: number } {
  const want = Math.max(0, Math.min(1, f)) * TOTAL;
  let i = R.at.findIndex((a) => a >= want);
  if (i <= 0) i = 1;
  const a = R.pts[i - 1]!;
  const b = R.pts[i]!;
  const span = R.at[i]! - R.at[i - 1]! || 1;
  const k = (want - R.at[i - 1]!) / span;
  return { p: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], angle: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI };
}

/** A sea kayak seen from above, pointing along its course, its paddle mid stroke. */
export function KayakTop({ paddle }: { paddle?: string }) {
  return (
    <>
      <path d="M-15 0C-9-4.2 9-4.2 15 0C9 4.2-9 4.2-15 0Z" />
      <circle r="2.6" fill="currentColor" />
      <g className={paddle}>
        <path d="M0-12V12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <ellipse cy="-12.5" rx="1.8" ry="3.4" />
        <ellipse cy="12.5" rx="1.8" ry="3.4" />
      </g>
    </>
  );
}

interface Stop {
  label: string;
  text: string;
  tag?: string;
  picture: ReactNode;
}

type Cls = Record<'outer' | 'frame' | 'map' | 'svg' | 'land' | 'rim' | 'water' | 'route' | 'trail' | 'node' | 'place' | 'boat' | 'paddle' | 'stops' | 'stop' | 'shot' | 'cap' | 'label' | 'text', string | undefined>;

/**
 * The paddle, drawn on a sketch of the crater: as the visitor scrolls, the kayak follows the shore
 * from the launch to each stop in turn, the line it has paddled draws in behind it, and the
 * photograph of each stop opens out of the water beside it. Before the script arrives, and with
 * reduced motion asked for, the whole paddle is drawn and the stops read as a list.
 */
export function HushCrater({ head, end, launch, stops, cls }: { head: ReactNode; end: ReactNode; launch: string; stops: Stop[]; cls: Cls }) {
  const outer = useRef<HTMLDivElement>(null);
  const boat = useRef<SVGGElement>(null);
  const trail = useRef<SVGPathElement>(null);
  const items = useRef<HTMLOListElement>(null);
  const nodes = useRef<SVGGElement>(null);
  const n = Math.min(stops.length, STOPS.length);

  useEffect(() => {
    const o = outer.current;
    if (!o) return;
    const place = (f: number) => {
      const { p, angle } = pointAt(f);
      boat.current?.setAttribute('transform', `translate(${p[0].toFixed(1)} ${p[1].toFixed(1)}) rotate(${angle.toFixed(1)}) scale(1.45)`);
      trail.current?.style.setProperty('stroke-dashoffset', (1 - f).toFixed(4));
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      place(1);
      return;
    }
    o.dataset.live = '';
    let last = -1;
    const mark = (i: number) => {
      if (i === last) return;
      last = i;
      for (const [k, el] of [...(items.current?.children ?? [])].entries()) (el as HTMLElement).dataset.state = k === i ? 'on' : k < i ? 'done' : 'off';
      for (const [k, el] of [...(nodes.current?.children ?? [])].entries()) (el as SVGElement).dataset.state = k <= i ? 'on' : 'off';
    };
    // The kayak rests a moment at each stop and paddles between them.
    const hold = 0.05;
    const apply = (progress: number) => {
      const at = progress * (n - 1);
      const i = Math.min(n - 1, Math.max(0, Math.floor(at + hold * (n - 1))));
      const leg = Math.min(n - 2, Math.floor(at));
      const within = at - leg;
      const h = hold * (n - 1);
      const k = Math.max(0, Math.min(1, (within - h) / Math.max(0.01, 1 - 2 * h)));
      const eased = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      place(STOPS[leg]! + (STOPS[leg + 1]! - STOPS[leg]!) * eased);
      mark(i);
    };
    apply(0);
    let stop: (() => void) | undefined;
    let cancelled = false;
    void import('motion').then(({ scroll }) => {
      if (cancelled) return;
      stop = scroll(apply, { target: o, offset: ['start start', 'end end'] });
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [n]);

  const start = pointAt(0);
  return (
    <div ref={outer} className={cls.outer}>
      <div className={cls.frame}>
        {head}
        <div className={cls.map}>
          <svg className={cls.svg} viewBox={CRATER_VIEW} aria-hidden="true" focusable="false">
            <rect className={cls.land} width="400" height="520" />
            <path className={cls.rim} d={SHORE_PATH} strokeWidth="96" />
            <path className={cls.rim} d={SHORE_PATH} strokeWidth="52" />
            <path className={cls.water} d={WATER_PATH} />
            <path className={cls.route} d={ROUTE_PATH} />
            <path ref={trail} className={cls.trail} d={ROUTE_PATH} pathLength={1} style={{ strokeDashoffset: 1 }} />
            <g ref={nodes}>
              {STOPS.slice(0, n).map((f, i) => {
                const { p } = pointAt(f);
                return <circle key={f} className={cls.node} cx={p[0]} cy={p[1]} r="6" data-state={i === 0 ? 'on' : 'off'} />;
              })}
            </g>
            <text className={cls.place} x={start.p[0]} y={start.p[1] - 16} textAnchor="middle">
              {launch}
            </text>
            <g ref={boat} className={cls.boat} transform={`translate(${start.p[0]} ${start.p[1]}) rotate(${start.angle.toFixed(1)}) scale(1.45)`}>
              <KayakTop paddle={cls.paddle} />
            </g>
          </svg>
          <ol ref={items} className={cls.stops}>
            {stops.slice(0, n).map((st, i) => {
              const { p } = pointAt(STOPS[i]!);
              // Each photograph opens from its stop out over the open water towards the middle of the crater.
              const right = p[0] < CRATER_CENTRE[0];
              const down = p[1] < CRATER_CENTRE[1];
              const x = (p[0] / 400) * 100;
              const y = (p[1] / 520) * 100;
              return (
                <li key={st.label} className={cls.stop} data-state={i === 0 ? 'on' : 'off'}>
                  <div
                    className={cls.shot}
                    style={{
                      left: right ? `calc(${x}% + 3%)` : undefined,
                      right: right ? undefined : `calc(${100 - x}% + 3%)`,
                      top: down ? `calc(${y}% + 2.4%)` : undefined,
                      bottom: down ? undefined : `calc(${100 - y}% + 2.4%)`,
                      transformOrigin: `${right ? 'left' : 'right'} ${down ? 'top' : 'bottom'}`,
                    }}
                  >
                    {st.picture}
                  </div>
                  <div className={cls.cap}>
                    <p className={cls.label}>
                      {st.label}
                      {st.tag && <span>{st.tag}</span>}
                    </p>
                    <p className={cls.text}>{st.text}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
        {end}
      </div>
    </div>
  );
}
