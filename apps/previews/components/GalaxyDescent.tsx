'use client';

import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';

export interface DescentStep {
  /** Whether this step happens underground. */
  under: boolean;
  /** What the drawing shows there: "road", "path", "water" or "chamber". */
  scene: string;
  title: string;
  text: string;
  note?: string;
  picture?: ReactNode;
}

type Names = 'story' | 'frame' | 'world' | 'drawing' | 'place' | 'text' | 'note' | 'pool';

/* The world is drawn in its own units: each step is a thousand wide, the surface path runs at SURF and the caves at CAVE. */
const SW = 1000;
const PAD = 1000;
const SURF = 700;
const GROUND = 748;
const CAVE = 1470;
const H = 2600;

interface Pt {
  x: number;
  y: number;
}

/** A small seeded generator, so the server and the browser draw the same rock. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number) => Math.round(n * 10) / 10;

/** The path through the world: level between steps, curving down into a cave and back up again. */
function route(steps: DescentStep[]): { pts: Pt[]; all: Pt[]; d: string; W: number } {
  const pts = steps.map((st, i) => ({ x: PAD + i * SW + SW / 2, y: st.under ? CAVE : SURF }));
  const all = [{ x: pts[0]!.x - SW * 0.85, y: SURF }, ...pts, { x: pts[pts.length - 1]!.x + SW * 0.85, y: SURF }];
  let d = `M${all[0]!.x} ${all[0]!.y}`;
  for (let i = 1; i < all.length; i++) {
    const a = all[i - 1]!;
    const b = all[i]!;
    const dx = b.x - a.x;
    d += `C${a.x + dx / 2} ${a.y} ${b.x - dx / 2} ${b.y} ${b.x} ${b.y}`;
  }
  return { pts, all, d, W: PAD * 2 + steps.length * SW };
}

/** Where the path is at a given x: each piece is a curve with level ends, solved for x. */
function yAt(all: Pt[], x: number): number {
  for (let i = 1; i < all.length; i++) {
    const a = all[i - 1]!;
    const b = all[i]!;
    if (x > b.x && i < all.length - 1) continue;
    const dx = b.x - a.x;
    const want = Math.min(1, Math.max(0, (x - a.x) / dx));
    let lo = 0;
    let hi = 1;
    for (let k = 0; k < 22; k++) {
      const t = (lo + hi) / 2;
      if (1.5 * t - 1.5 * t * t + t * t * t < want) lo = t;
      else hi = t;
    }
    const t = (lo + hi) / 2;
    return a.y + (b.y - a.y) * (3 * t * t - 2 * t * t * t);
  }
  return SURF;
}

/** An edge of rock: points every 50 units with a little noise, smoothed. */
function edge(x0: number, x1: number, y: number, amp: number, r: () => number, step = 50): Pt[] {
  const out: Pt[] = [];
  let drift = 0;
  for (let x = x0; x <= x1 + 0.1; x += step) {
    drift = drift * 0.6 + (r() - 0.5) * amp;
    out.push({ x, y: y + drift });
  }
  return out;
}

function lineAt(pts: Pt[], x: number): number {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    if (x <= b.x) return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
  }
  return pts[pts.length - 1]!.y;
}

function smooth(pts: Pt[]): string {
  let d = '';
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    if (i === 0) d += `${f(p.x)} ${f(p.y)}`;
    else {
      const q = pts[i - 1]!;
      d += `Q${f(q.x)} ${f(q.y)} ${f((q.x + p.x) / 2)} ${f((q.y + p.y) / 2)}`;
    }
  }
  return d;
}

interface Cave {
  d: string;
  ceiling: Pt[];
  floor: Pt[];
  x0: number;
  x1: number;
  scenes: { scene: string; x0: number; x1: number }[];
}

function caves(steps: DescentStep[], pts: Pt[]): Cave[] {
  const out: Cave[] = [];
  let i = 0;
  while (i < steps.length) {
    if (!steps[i]!.under) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < steps.length && steps[j + 1]!.under) j++;
    const r = seeded(97 + i * 31);
    const x0 = pts[i]!.x - SW * 0.44;
    const x1 = pts[j]!.x + SW * 0.44;
    const ceiling = edge(x0, x1, CAVE - 300, 38, r);
    const floor = edge(x0, x1, CAVE + 120, 22, r);
    const back = [...floor].reverse();
    const d = `M${smooth(ceiling)}C${f(x1 + 90)} ${f(CAVE - 260)} ${f(x1 + 90)} ${f(CAVE + 100)} ${f(back[0]!.x)} ${f(back[0]!.y)}${smooth(back).replace(/^[\d.-]+ [\d.-]+/, '')}C${f(x0 - 90)} ${f(CAVE + 100)} ${f(x0 - 90)} ${f(CAVE - 260)} ${f(ceiling[0]!.x)} ${f(ceiling[0]!.y)}Z`;
    const scenes = steps.slice(i, j + 1).map((st, k) => ({ scene: st.scene, x0: pts[i + k]!.x - SW / 2, x1: pts[i + k]!.x + SW / 2 }));
    out.push({ d, ceiling, floor, x0, x1, scenes });
    i = j + 1;
  }
  return out;
}

/** Glowworms on a cave's ceiling, each a light with its threads hanging below it. */
function Glowworms({ cave, x0, x1, seed }: { cave: Cave; x0: number; x1: number; seed: number }) {
  const r = seeded(seed);
  const lights: ReactNode[] = [];
  const threads: ReactNode[] = [];
  const mirror: ReactNode[] = [];
  const from = Math.max(x0, cave.x0 + 60);
  const to = Math.min(x1, cave.x1 - 60);
  for (let k = 0; k < 170; k++) {
    const x = from + r() * (to - from);
    const top = lineAt(cave.ceiling, x);
    const y = top + 14 + r() * r() * 190;
    const size = 1.6 + r() * r() * 4.4;
    const group = k % 3;
    lights.push(<circle key={k} cx={f(x)} cy={f(y)} r={f(size)} data-g={group} />);
    if (k % 2 === 0) threads.push(<path key={k} d={`M${f(x)} ${f(y)}v${f(10 + r() * 40)}`} />);
    if (k % 3 === 0) mirror.push(<circle key={k} cx={f(x)} cy={f(CAVE + 48 + (y - top) * 0.32)} r={f(size * 0.8)} />);
  }
  return (
    <g data-glow>
      <g data-threads>{threads}</g>
      <g data-lights>{lights}</g>
      <g data-mirror>{mirror}</g>
    </g>
  );
}

function Formations({ cave, x0, x1, seed }: { cave: Cave; x0: number; x1: number; seed: number }) {
  const r = seeded(seed);
  const shapes: ReactNode[] = [];
  const from = Math.max(x0, cave.x0 + 50);
  const to = Math.min(x1, cave.x1 - 50);
  for (let k = 0; k < 26; k++) {
    const x = from + r() * (to - from);
    const w = 8 + r() * 16;
    const top = lineAt(cave.ceiling, x) - 4;
    const len = 30 + r() * r() * 150;
    shapes.push(<path key={`c${k}`} d={`M${f(x - w / 2)} ${f(top)}Q${f(x - w / 5)} ${f(top + len * 0.6)} ${f(x)} ${f(top + len)}Q${f(x + w / 5)} ${f(top + len * 0.6)} ${f(x + w / 2)} ${f(top)}Z`} />);
  }
  for (let k = 0; k < 12; k++) {
    const x = from + r() * (to - from);
    const w = 14 + r() * 22;
    const base = lineAt(cave.floor, x) + 4;
    const len = 20 + r() * 70;
    shapes.push(<path key={`f${k}`} d={`M${f(x - w / 2)} ${f(base)}Q${f(x - w / 6)} ${f(base - len * 0.7)} ${f(x)} ${f(base - len)}Q${f(x + w / 6)} ${f(base - len * 0.7)} ${f(x + w / 2)} ${f(base)}Z`} />);
  }
  // Fossils in the rock: small spirals set into the wall beside the chamber.
  const fossils: ReactNode[] = [];
  for (let k = 0; k < 4; k++) {
    const cx = from + r() * (to - from);
    const cy = CAVE + 200 + r() * 160;
    const s = 12 + r() * 12;
    let d = `M${f(cx)} ${f(cy)}`;
    for (let a = 0; a < Math.PI * 5; a += 0.35) d += `L${f(cx + Math.cos(a) * s * (a / (Math.PI * 5)))} ${f(cy + Math.sin(a) * s * (a / (Math.PI * 5)))}`;
    fossils.push(<path key={`s${k}`} d={d} />);
  }
  return (
    <g data-formations>
      {shapes}
      <g data-fossils>{fossils}</g>
    </g>
  );
}

function Surface({ x0, x1, scene, seed }: { x0: number; x1: number; scene: string; seed: number }) {
  const r = seeded(seed);
  const marks: ReactNode[] = [];
  if (scene === 'road') {
    for (let x = x0 + 30; x < x1 - 20; x += 54) marks.push(<path key={x} d={`M${f(x)} ${GROUND + 2}v-34`} />);
    marks.push(<path key="w1" d={`M${x0 + 30} ${GROUND - 24}H${x1 - 24}M${x0 + 30} ${GROUND - 12}H${x1 - 24}`} data-wire />);
    for (let k = 0; k < 3; k++) {
      const x = x0 + 120 + r() * (x1 - x0 - 240);
      const s = 26 + r() * 26;
      marks.push(<path key={`t${k}`} d={`M${f(x)} ${GROUND}v-${f(s * 1.3)}`} data-trunk />);
      marks.push(<circle key={`c${k}`} cx={f(x)} cy={f(GROUND - s * 1.3 - s * 0.6)} r={f(s)} data-crown />);
    }
  } else {
    for (let k = 0; k < 18; k++) {
      const x = x0 + 20 + r() * (x1 - x0 - 40);
      const h = 10 + r() * 16;
      marks.push(<path key={k} d={`M${f(x - 6)} ${GROUND}l6 -${f(h)}l5 ${f(h)}M${f(x + 3)} ${GROUND}l7 -${f(h * 0.7)}`} />);
    }
  }
  return <g data-surface={scene}>{marks}</g>;
}

/** Everything drawn once: sky, hills, the ground with its strata, the caves, and the path through them. */
function World({ steps, gid }: { steps: DescentStep[]; gid: string }) {
  const { pts, d, W } = route(steps);
  const r = seeded(11);
  const ground = edge(0, W, GROUND, 14, r);
  const far = edge(0, W, GROUND - 150, 90, seeded(5), 90);
  const near = edge(0, W, GROUND - 60, 60, seeded(7), 70);
  const holes = caves(steps, pts);
  const strata: ReactNode[] = [];
  for (let y = GROUND + 80, k = 0; y < H; y += 78, k++) {
    const line = edge(0, W, y, 26, seeded(200 + k), 160);
    strata.push(<path key={k} d={`M${smooth(line)}`} />);
  }
  // The passage from the surface into each cave and back out, cut through the rock below the ground line.
  const passages: string[] = [];
  steps.forEach((st, i) => {
    const prevUnder = i > 0 && steps[i - 1]!.under;
    if (st.under && !prevUnder) {
      const a = i > 0 ? pts[i - 1]! : { x: pts[i]!.x - SW * 0.85, y: SURF };
      const b = pts[i]!;
      const dx = b.x - a.x;
      passages.push(`M${a.x} ${a.y}C${a.x + dx / 2} ${a.y} ${b.x - dx / 2} ${b.y} ${b.x} ${b.y}`);
    }
    const nextUnder = i < steps.length - 1 && steps[i + 1]!.under;
    if (st.under && !nextUnder) {
      const a = pts[i]!;
      const b = i < steps.length - 1 ? pts[i + 1]! : { x: pts[i]!.x + SW * 0.85, y: SURF };
      const dx = b.x - a.x;
      passages.push(`M${a.x} ${a.y}C${a.x + dx / 2} ${a.y} ${b.x - dx / 2} ${b.y} ${b.x} ${b.y}`);
    }
  });
  return (
    <g id={`${gid}-g`}>
      <defs>
        <linearGradient id={`${gid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b9cdc8" />
          <stop offset="1" stopColor="#e6eeeb" />
        </linearGradient>
        <linearGradient id={`${gid}-earth`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a3330" />
          <stop offset="0.4" stopColor="#1c2422" />
          <stop offset="1" stopColor="#0d1211" />
        </linearGradient>
        <clipPath id={`${gid}-below`}>
          <rect x="0" y={GROUND - 6} width={W} height={H} />
        </clipPath>
      </defs>
      <rect x="0" y="0" width={W} height={GROUND + 40} fill={`url(#${gid}-sky)`} />
      <path d={`M0 ${GROUND}L${smooth(far)}L${W} ${GROUND}Z`} data-hill="far" />
      <path d={`M0 ${GROUND}L${smooth(near)}L${W} ${GROUND}Z`} data-hill="near" />
      <path d={`M${smooth(ground)}L${W} ${H}L0 ${H}Z`} fill={`url(#${gid}-earth)`} />
      <path d={`M${smooth(ground)}`} data-grass />
      <g data-strata>{strata}</g>
      <g clipPath={`url(#${gid}-below)`} data-passage>
        {passages.map((p) => (
          <path key={p} d={p} />
        ))}
      </g>
      {holes.map((c, k) => (
        <g key={k}>
          <clipPath id={`${gid}-v${k}`}>
            <path d={c.d} />
          </clipPath>
          <path d={c.d} data-void />
          {c.scenes.map((sc, m) =>
            sc.scene === 'water' ? (
              <g key={m} clipPath={`url(#${gid}-v${k})`}>
                <rect x={f(Math.max(sc.x0, c.x0 - 40))} y={CAVE + 40} width={f(Math.min(sc.x1, c.x1 + 40) - Math.max(sc.x0, c.x0 - 40))} height={130} data-water />
                <path d={`M${f(Math.max(sc.x0, c.x0))} ${CAVE + 40}H${f(Math.min(sc.x1, c.x1))}`} data-waterline />
                <Glowworms cave={c} x0={sc.x0} x1={sc.x1} seed={300 + k * 7 + m} />
                <path d={`M${f((sc.x0 + sc.x1) / 2 - 58)} ${CAVE + 22}h116a12 12 0 0 1 0 24h-116a12 12 0 0 1 0-24z`} data-raft />
              </g>
            ) : (
              <Formations key={m} cave={c} x0={sc.x0} x1={sc.x1} seed={400 + k * 7 + m} />
            ),
          )}
        </g>
      ))}
      {steps.map((st, i) => (st.under ? null : <Surface key={i} x0={pts[i]!.x - SW / 2} x1={pts[i]!.x + SW / 2} scene={st.scene} seed={500 + i} />))}
      <path d={d} data-trail />
    </g>
  );
}

/**
 * The tour told as a cross section of the ground, and nothing else in the frame: the farm and its sky
 * above, the rock and its caves below, and one glowing thread through it all. Each step's words are
 * written into the drawing where the step happens, in the sky over the farm or in the rock under a
 * cave. The frame holds while the view itself travels along the thread, diving underground for each
 * cave and climbing back to the light between them. With reduced motion asked for, the drawing shows
 * whole, as one strip, and the steps follow it as plain text.
 */
export function GalaxyDescent({ steps, cls, gid }: { steps: DescentStep[]; cls: Record<Names, string | undefined>; gid: string }) {
  const outer = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const travelled = useRef<SVGPathElement>(null);
  const { pts, all, d, W } = useMemo(() => route(steps), [steps]);
  const n = steps.length;

  useEffect(() => {
    const o = outer.current;
    const wv = world.current;
    const line = travelled.current;
    if (!o || !wv || !line) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    let last = -1;
    const frame = o.querySelector<HTMLElement>('[data-frame]')!;
    const marks = [...o.querySelectorAll<HTMLElement>('[data-step]')];
    // How far along the line each x is, measured once from the drawn path.
    const total = line.getTotalLength();
    const table: number[] = [];
    for (let k = 0; k <= 300; k++) table.push(line.getPointAtLength((total * k) / 300).x);
    const along = (x: number) => {
      let k = 0;
      while (k < 300 && table[k + 1]! < x) k++;
      const a = table[k]!;
      const b = table[Math.min(300, k + 1)]!;
      return Math.min(1, (k + (b > a ? (x - a) / (b - a) : 0)) / 300);
    };
    let s = 1;
    let fx = 0;
    let fy = 0;
    let p = 0;
    const size = () => {
      const w = frame.clientWidth;
      const h = frame.clientHeight;
      const wide = w >= 900;
      s = wide ? Math.min(0.9, w / 1650) : w / 780;
      fx = w * 0.5;
      fy = h * (wide ? 0.48 : 0.4);
      o.style.setProperty('--s', s.toFixed(4));
    };
    const apply = (progress: number) => {
      p = progress;
      const u = Math.min(n - 1, Math.max(0, progress * n - 0.5));
      const k = Math.floor(u);
      const g = Math.min(1, Math.max(0, (u - k - 0.22) / 0.56));
      const eased = g * g * (3 - 2 * g);
      const at = k >= n - 1 ? n - 1 : k + eased;
      const i = Math.min(n - 1, Math.floor(at));
      const x = pts[i]!.x + (at - i) * (pts[Math.min(n - 1, i + 1)]!.x - pts[i]!.x);
      const y = yAt(all, x);
      wv.style.transform = `translate3d(${(fx - x * s).toFixed(1)}px, ${(fy - y * s).toFixed(1)}px, 0)`;
      o.style.setProperty('--t', along(x).toFixed(4));
      const active = Math.round(at);
      // A step's words show only once the view has arrived there, so none is ever seen cut at the frame's edge.
      const here = Math.abs(at - active) < 0.16 ? active : -1;
      const key = active * 2 + (here < 0 ? 0 : 1);
      if (key === last) return;
      last = key;
      o.setAttribute('data-active', String(active));
      o.setAttribute('data-scene', steps[active]!.scene);
      for (const m of marks) {
        const j = Number(m.dataset.step);
        m.dataset.state = j === here ? 'on' : j < active ? 'done' : 'off';
      }
    };
    size();
    apply(0);
    o.setAttribute('data-live', '');
    const resize = () => {
      size();
      last = -1;
      apply(p);
    };
    window.addEventListener('resize', resize);
    void import('motion').then(({ scroll }) => {
      if (cancelled) return;
      stop = scroll(apply, { target: o, offset: ['start start', 'end end'] });
    });
    return () => {
      cancelled = true;
      stop?.();
      window.removeEventListener('resize', resize);
    };
  }, [all, pts, steps, n, W]);

  return (
    <div ref={outer} className={cls.story} data-active="0" data-scene={steps[0]?.scene} style={{ '--steps': n, '--t': 0, '--ww': W, '--wh': H } as CSSProperties}>
      <div className={cls.frame} data-frame>
        <div ref={world} className={cls.world}>
          <svg className={cls.drawing} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMinYMin meet" aria-hidden="true" focusable="false">
            <World steps={steps} gid={gid} />
            <path d={d} pathLength={1} data-halo />
            <path ref={travelled} d={d} pathLength={1} data-travelled />
          </svg>
          <ol>
            {steps.map((st, i) => (
              <li key={st.title} className={cls.place} data-step={i} data-state={i === 0 ? 'on' : 'off'} data-under={st.under ? '' : undefined} style={{ '--x': pts[i]!.x, '--y': pts[i]!.y } as CSSProperties}>
                <h3>{st.title}</h3>
                <p className={cls.text}>{st.text}</p>
                {st.note && <p className={cls.note}>{st.note}</p>}
              </li>
            ))}
          </ol>
          {steps.map((st, i) =>
            st.picture ? (
              <div key={st.title} className={cls.pool} data-step={i} data-state={i === 0 ? 'on' : 'off'} style={{ '--x': pts[i]!.x + 230, '--y': st.under ? CAVE - 130 : SURF - 260 } as CSSProperties}>
                {st.picture}
              </div>
            ) : null,
          )}
        </div>
      </div>
    </div>
  );
}
