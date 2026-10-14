'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

export interface Wine {
  /** Where on a rugby field the wine's name belongs: one of the spots below. */
  spot: string;
  name: string;
  variety: string;
  note: string;
  extra?: string;
}

/**
 * Named places on a rugby field, in metres on a field 70 wide and 112 long from dead ball line to dead
 * ball line, drawn upright with the line being attacked at the top. On a wide screen the field lies
 * on its side.
 */
const SPOTS: Record<string, { x: number; y: number; side: 'l' | 'r' }> = {
  corner: { x: 70, y: 6, side: 'l' },
  touchline: { x: 70, y: 66, side: 'l' },
  runaway: { x: 40, y: 15, side: 'r' },
  sidestep: { x: 56, y: 34, side: 'l' },
  freerun: { x: 14, y: 30, side: 'r' },
  ruck: { x: 40, y: 49, side: 'r' },
  offside: { x: 10, y: 58, side: 'r' },
  scrum: { x: 30, y: 82, side: 'r' },
  posts: { x: 35, y: 6, side: 'r' },
};

const W = 70;
const L = 112;

type Cmd = [string, ...number[]];

/** Turns a path given upright into the same path on a field lying on its side. */
function draw(cmds: Cmd[], side: boolean): string {
  return cmds
    .map(([op, ...n]) => {
      const out: number[] = [];
      for (let i = 0; i < n.length; i += 2) {
        const [x, y] = [n[i]!, n[i + 1]!];
        out.push(...(side ? [y, W - x] : [x, y]));
      }
      return op + out.map((v) => +v.toFixed(2)).join(' ');
    })
    .join('');
}

const line = (x1: number, y1: number, x2: number, y2: number): Cmd[] => [
  ['M', x1, y1],
  ['L', x2, y2],
];

/** The markings of a rugby field, and the runs that some of the names describe. */
const MARKS: { d: Cmd[]; kind: 'solid' | 'dash' | 'run' | 'gain' }[] = [
  { d: [['M', 0, 0], ['L', W, 0], ['L', W, L], ['L', 0, L], ['L', 0, 0]], kind: 'solid' },
  { d: line(0, 6, W, 6), kind: 'solid' },
  { d: line(0, L - 6, W, L - 6), kind: 'solid' },
  { d: line(0, L / 2, W, L / 2), kind: 'solid' },
  { d: line(0, 28, W, 28), kind: 'solid' },
  { d: line(0, L - 28, W, L - 28), kind: 'solid' },
  { d: line(0, L / 2 - 10, W, L / 2 - 10), kind: 'dash' },
  { d: line(0, L / 2 + 10, W, L / 2 + 10), kind: 'dash' },
  { d: line(5, 11, 5, L - 11), kind: 'dash' },
  { d: line(W - 5, 11, W - 5, L - 11), kind: 'dash' },
  { d: line(15, 11, 15, L - 11), kind: 'dash' },
  { d: line(W - 15, 11, W - 15, L - 11), kind: 'dash' },
  { d: line(0, 53, W, 53), kind: 'gain' },
  { d: [['M', 30, 52], ['C', 22, 46, 13, 41, 14, 31]], kind: 'run' },
  { d: [['M', 61, 52], ['L', 54, 46], ['L', 61, 41], ['L', 56, 35]], kind: 'run' },
  { d: [['M', 44, 37], ['C', 43, 29, 41, 22, 40, 16]], kind: 'run' },
];

function Field({ side }: { side: boolean }) {
  const posts = (y: number): Cmd[] => [
    ['M', 32.2, y],
    ['L', 37.8, y],
  ];
  return (
    <svg data-lines={side ? 'side' : 'up'} viewBox={side ? `0 0 ${L} ${W}` : `0 0 ${W} ${L}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      {MARKS.map((m, i) => (
        <path key={i} d={draw(m.d, side)} data-mark={m.kind} />
      ))}
      <path d={draw(posts(6), side)} data-mark="posts" />
      <path d={draw(posts(L - 6), side)} data-mark="posts" />
      {/* Two packs bound in a scrum, and the bodies over a ruck. */}
      <g data-mark="pack">
        {[-1, 1].flatMap((dir) =>
          [-1.6, 0, 1.6].map((dx) => {
            const [x, y] = [SPOTS.scrum!.x - 7 + dx, SPOTS.scrum!.y + dir * 1.4];
            const [cx, cy] = side ? [y, W - x] : [x, y];
            return <circle key={`${dir}${dx}`} cx={cx} cy={cy} r="0.9" />;
          }),
        )}
        {[
          [-1.4, -1],
          [1.2, -0.8],
          [0, 1.3],
          [-2, 1.2],
        ].map(([dx, dy], i) => {
          const [x, y] = [SPOTS.ruck!.x - 6 + dx!, SPOTS.ruck!.y + 2 + dy!];
          const [cx, cy] = side ? [y, W - x] : [x, y];
          return <circle key={`r${i}`} cx={cx} cy={cy} r="0.9" />;
        })}
      </g>
    </svg>
  );
}

/** Where a spot sits, as percentages of the field upright and on its side. */
function place(spot: string) {
  const p = SPOTS[spot] ?? SPOTS.posts!;
  return { '--px': ((p.x / W) * 100).toFixed(2), '--py': ((p.y / L) * 100).toFixed(2), '--lx': ((p.y / L) * 100).toFixed(2), '--ly': (((W - p.x) / W) * 100).toFixed(2) };
}

/**
 * The team sheet. Each wine stands on a rugby field where its name belongs, and choosing one passes
 * the ball to it and turns its card over. The first time the field comes into view the ball goes
 * round a few of the names on its own, and stops the moment the visitor chooses one; with reduced
 * motion asked for it stays where it is.
 */
export function PaddockTeam({ wines, hint, label, className }: { wines: Wine[]; hint: string; label: string; className?: string }) {
  const [active, setActive] = useState(0);
  const [flight, setFlight] = useState(0);
  const [live, setLive] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const touched = useRef(false);
  const current = useRef(0);

  const pass = (i: number) => {
    if (current.current === i) return;
    current.current = i;
    setActive(i);
    setFlight((f) => f + 1);
  };

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let timer = 0;
    let ran = false;
    const tour = [...Array(Math.min(wines.length - 1, 6)).keys()].map((k) => k + 1).concat(0);
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting || ran || touched.current) return;
        ran = true;
        let k = 0;
        timer = window.setInterval(() => {
          if (touched.current || k >= tour.length) {
            window.clearInterval(timer);
            return;
          }
          pass(tour[k++]!);
        }, 720);
      },
      { threshold: 0.45 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearInterval(timer);
    };
  }, [wines.length]);

  const w = wines[active]!;
  const ball = place(w.spot);

  return (
    <div ref={ref} className={className} data-team>
      <div
        data-field
        role="group"
        aria-label={label}
        style={{ '--bx': ball['--px'], '--by': ball['--py'], '--blx': ball['--lx'], '--bly': ball['--ly'] } as CSSProperties}
      >
        <Field side={false} />
        <Field side />
        {wines.map((wine, i) => {
          const at = place(wine.spot);
          return (
            <button
              key={wine.name}
              type="button"
              data-spot={wine.spot}
              data-side={SPOTS[wine.spot]?.side ?? 'r'}
              aria-pressed={i === active}
              style={at as CSSProperties}
              onClick={() => {
                touched.current = true;
                setLive(true);
                pass(i);
              }}
            >
              <i aria-hidden="true" />
              <span>{wine.name}</span>
              <span data-sr>, {wine.variety}</span>
            </button>
          );
        })}
        <span data-ball-x aria-hidden="true">
          <span data-ball-y>
            <i key={flight} data-ball data-flying={flight ? '' : undefined} />
          </span>
        </span>
      </div>
      <p data-hint>{hint}</p>
      <div data-card aria-live={live ? 'polite' : 'off'}>
        <div key={active} data-card-inner>
          <p data-card-variety>{w.variety}</p>
          <h3 data-card-name>{w.name}</h3>
          <p data-card-note>{w.note}</p>
          {w.extra && <p data-card-extra>{w.extra}</p>}
        </div>
      </div>
    </div>
  );
}
