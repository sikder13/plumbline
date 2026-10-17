'use client';

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { CRATER_CENTRE, CRATER_VIEW, KayakTop, SHORE_PATH, SHORE_POINTS, WATER_PATH } from './HushCrater';

interface Text {
  from: string;
  pick: string;
  dirs: { short: string; name: string }[];
}

type Cls = Record<'box' | 'map' | 'land' | 'rim' | 'water' | 'air' | 'gust' | 'glow' | 'shore' | 'boats' | 'paddle' | 'drag' | 'range' | 'marks' | 'reading' | 'srOnly', string | undefined>;

type Vars = CSSProperties & Record<`--${string}`, string | number>;

/** Streaks of wind, drawn for a wind from the top and turned for any other: across, length, seconds, delay. */
const GUSTS: [number, number, number, number][] = [
  [-80, 80, 2.3, 0.1],
  [-40, 120, 2.0, 1.3],
  [0, 70, 2.6, 0.6],
  [36, 100, 2.2, 1.8],
  [72, 80, 1.9, 0.3],
  [108, 130, 2.5, 1.1],
  [144, 70, 2.1, 2.0],
  [180, 105, 2.3, 0.8],
  [216, 80, 2.0, 1.6],
  [252, 125, 2.6, 0.2],
  [288, 75, 2.2, 1.4],
  [324, 110, 1.9, 0.5],
  [360, 85, 2.4, 1.9],
  [396, 120, 2.1, 0.9],
  [432, 70, 2.5, 1.5],
  [468, 100, 2.0, 0.4],
];

/**
 * For a wind from a direction (0 is north, turning clockwise), the shore that faces it: there the
 * land breaks the wind and the water inside it lies sheltered. Worked out from the shape of the
 * sketch, so it lights up the same way the visitor would reason it out.
 */
function lee(deg: number): { d: string; boat: [number, number, number] } {
  const a = (deg * Math.PI) / 180;
  const w: [number, number] = [Math.sin(a), -Math.cos(a)];
  const pts = SHORE_POINTS;
  const lit: boolean[] = pts.map((p, i) => {
    const a0 = pts[Math.max(0, i - 1)]!;
    const a1 = pts[Math.min(pts.length - 1, i + 1)]!;
    let nx = a1[1] - a0[1];
    let ny = -(a1[0] - a0[0]);
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    if (nx * (p[0] - CRATER_CENTRE[0]) + ny * (p[1] - CRATER_CENTRE[1]) < 0) [nx, ny] = [-nx, -ny];
    // The open mouth of the crater shelters nothing.
    return p[1] < 500 && nx * w[0] + ny * w[1] > 0.55;
  });
  let d = '';
  let best: [number, number][] = [];
  let run: [number, number][] = [];
  pts.forEach((p, i) => {
    if (lit[i]) {
      d += `${run.length ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
      run.push(p);
    } else {
      if (run.length > best.length) best = run;
      run = [];
    }
  });
  if (run.length > best.length) best = run;
  // A few kayaks in the sheltered water, a little in from the middle of the lit shore.
  const mid = best[Math.floor(best.length / 2)] ?? CRATER_CENTRE;
  const tx = CRATER_CENTRE[0] - mid[0];
  const ty = CRATER_CENTRE[1] - mid[1];
  const k = 30 / (Math.hypot(tx, ty) || 1);
  const first = best[0] ?? mid;
  const last = best[best.length - 1] ?? mid;
  const angle = (Math.atan2(last[1] - first[1], last[0] - first[0]) * 180) / Math.PI;
  return { d, boat: [mid[0] + tx * k, mid[1] + ty * k, best.length > 1 ? angle : 0] };
}

/**
 * Where the water is sheltered, whichever way the wind blows: the wind streams across the same
 * sketch of the crater, and the shore that breaks it lights up with the kayaks in its lee. The eight
 * directions are a row the visitor drags along (or taps, or steps with the arrow keys). When it first
 * comes into view it turns once through every direction by itself, then waits.
 */
export function HushWind({ text, cls }: { text: Text; cls: Cls }) {
  const n = text.dirs.length;
  const step = 360 / n;
  const shores = useRef(text.dirs.map((_, i) => lee(i * step)));
  const [cur, setCur] = useState(0);
  const [turn, setTurn] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const touched = useRef(false);
  const state = useRef({ cur: 0, turn: 0 });
  const id = useId();

  const go = (i: number) => {
    const { cur: from, turn: was } = state.current;
    let delta = (((i - from) % n) + n) % n;
    if (delta > n / 2) delta -= n;
    const next = { cur: i, turn: was + delta * step };
    state.current = next;
    setCur(next.cur);
    setTurn(next.turn);
  };

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const seen = new IntersectionObserver(([e]) => el.toggleAttribute('data-live', !!e?.isIntersecting), { rootMargin: '120px 0px' });
    seen.observe(el);
    return () => seen.disconnect();
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timers: number[] = [];
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        for (let k = 1; k <= n; k++) timers.push(window.setTimeout(() => void (touched.current || go(k % n)), 300 + k * 520));
      },
      { threshold: 0.45 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      for (const t of timers) window.clearTimeout(t);
    };
    // The demonstration is set up once, when the sketch first mounts.
  }, [n]);

  const now = text.dirs[cur];
  return (
    <div ref={box} className={cls.box} style={{ '--deg': `${turn}deg`, '--at': cur / (n - 1) } as Vars}>
      <svg className={cls.map} viewBox={CRATER_VIEW} aria-hidden="true" focusable="false">
        <rect className={cls.land} width="400" height="520" />
        <path className={cls.rim} d={SHORE_PATH} strokeWidth="96" />
        <path className={cls.rim} d={SHORE_PATH} strokeWidth="52" />
        <path className={cls.water} d={WATER_PATH} />
        {shores.current.map((s, i) => (
          <g key={text.dirs[i]!.short} data-on={i === cur ? '' : undefined}>
            <path className={cls.glow} d={s.d} />
            <path className={cls.shore} d={s.d} />
            <g className={cls.boats} transform={`translate(${s.boat[0].toFixed(1)} ${s.boat[1].toFixed(1)}) rotate(${s.boat[2].toFixed(1)})`}>
              {[-26, 0, 26].map((x) => (
                <g key={x} transform={`translate(${x} ${x === 0 ? 8 : 0})`}>
                  <KayakTop paddle={cls.paddle} />
                </g>
              ))}
            </g>
          </g>
        ))}
        <g className={cls.air}>
          {GUSTS.map(([x, len, dur, w]) => (
            <line key={x} className={cls.gust} x1={x} x2={x} y1={0} y2={len} style={{ '--d': `${dur}s`, '--w': `${-w}s` } as Vars} />
          ))}
        </g>
      </svg>
      <div className={cls.drag}>
        <label className={cls.srOnly} htmlFor={id}>
          {text.pick}
        </label>
        <input
          id={id}
          className={cls.range}
          type="range"
          min={0}
          max={n - 1}
          step={1}
          value={cur}
          aria-valuetext={now ? `${text.from} ${now.name}` : undefined}
          onChange={(e) => {
            touched.current = true;
            go(Number(e.currentTarget.value));
          }}
        />
        <ol className={cls.marks} aria-hidden="true">
          {text.dirs.map((d, i) => (
            <li key={d.short} data-on={i === cur ? '' : undefined} style={{ '--k': i / (n - 1) } as Vars}>
              {d.short}
            </li>
          ))}
        </ol>
      </div>
      <p className={cls.reading} aria-live="polite">
        {text.from} <b>{now?.name}</b>
      </p>
    </div>
  );
}
