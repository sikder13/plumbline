'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { whenNear } from './MeanderIdle';
import { MeanderVan } from './MeanderVan';

export interface BendLove {
  key: string;
  label: string;
  stop: string;
  icon?: string;
  /** A love that slows the whole day: the road takes a lazy loop and the minibus eases off. */
  pace?: boolean;
}

type Pt = [number, number];
type Align = 'start' | 'middle' | 'end';

interface Detour {
  at: Pt;
  dir: Pt;
  reach: number;
  /** Where the stop's name sits, from the top of the bend; or, with `across`, level with it at that distance across. */
  label: Pt;
  across?: number;
  align: Align;
}

interface Geo {
  w: number;
  h: number;
  /** How far before and after a bend the road starts to lean into it, so a bend is a hill and not a spike. */
  shoulder: number;
  /** The axis the road wanders across (1: up and down, 0: side to side) and the line it wanders about. */
  axis: 0 | 1;
  centre: number;
  start: Pt;
  end: Pt;
  ends: [Pt, Align][];
  detours: Detour[];
  loop: (p: number) => [Pt, Pt];
  loopLabel: (p: number) => Pt;
  loopAlign: Align;
}

/** Wide screens: the day runs left to right, bending up to a view and down to lunch. */
const WIDE: Geo = {
  w: 800,
  h: 460,
  shoulder: 52,
  axis: 1,
  centre: 250,
  start: [-10, 250],
  end: [810, 250],
  ends: [
    [[22, 292], 'start'],
    [[792, 214], 'end'],
  ],
  detours: [
    { at: [165, 226], dir: [0, -1], reach: 158, label: [0, -34], align: 'middle' },
    { at: [318, 274], dir: [0, 1], reach: 128, label: [0, 34], align: 'middle' },
    { at: [468, 226], dir: [0, -1], reach: 150, label: [0, -34], align: 'middle' },
  ],
  loop: (p) => [
    [598 + 74 * p, 274 + 116 * p],
    [646 - 92 * p, 274 + 142 * p],
  ],
  loopLabel: (p) => [632, 274 + 142 * p + 36],
  loopAlign: 'middle',
};

/** Phones: the day runs down the screen, bending out to either side. */
const TALL: Geo = {
  w: 360,
  h: 540,
  shoulder: 40,
  axis: 0,
  centre: 180,
  start: [180, -10],
  end: [180, 550],
  ends: [
    [[202, 20], 'start'],
    [[202, 522], 'start'],
  ],
  detours: [
    { at: [160, 112], dir: [-1, 0], reach: 108, label: [0, 0], across: 348, align: 'end' },
    { at: [200, 214], dir: [1, 0], reach: 108, label: [0, 0], across: 12, align: 'start' },
    { at: [160, 316], dir: [-1, 0], reach: 108, label: [0, 0], across: 348, align: 'end' },
  ],
  loop: (p) => [
    [196 + 98 * p, 398 + 46 * p],
    [204 + 8 * p, 428 - 40 * p],
  ],
  loopLabel: (p) => [348, 398 + 46 * p + 40],
  loopAlign: 'end',
};

const GEOS = [WIDE, TALL];
const PHONE = '(max-width: 759px)';
const f = (n: number) => n.toFixed(1);

/** Where a bend's anchor sits once the pace has made the whole road wander more. */
function anchor(g: Geo, d: Detour, pace: number): Pt {
  const p: Pt = [d.at[0], d.at[1]];
  p[g.axis] = g.centre + (d.at[g.axis] - g.centre) * (1 + 0.9 * pace);
  return p;
}

/** The top of a bend, pushed out by its own amount. */
function apex(g: Geo, i: number, amps: number[], pace: number): Pt {
  const d = g.detours[i]!;
  const a = amps[i] ?? 0;
  const p = anchor(g, d, pace);
  return [p[0] + d.dir[0] * d.reach * a, p[1] + d.dir[1] * d.reach * a];
}

/** The road's points for the given bends: each detour a rounded hill pushed out by its own amount, the lazy loop opened by the pace. */
function points(g: Geo, amps: number[], pace: number): Pt[] {
  const pts: Pt[] = [g.start];
  const along: 0 | 1 = g.axis ? 0 : 1;
  g.detours.forEach((d, i) => {
    const a = amps[i] ?? 0;
    const p = anchor(g, d, pace);
    for (const [k, share] of [
      [-1, 0.46],
      [0, 1],
      [1, 0.46],
    ] as const) {
      const q: Pt = [p[0] + d.dir[0] * d.reach * a * share, p[1] + d.dir[1] * d.reach * a * share];
      q[along] += k * g.shoulder;
      pts.push(q);
    }
  });
  pts.push(...g.loop(pace), g.end);
  return pts;
}

/** Where the name of a bend's stop sits. */
function labelAt(g: Geo, i: number, amps: number[], pace: number): Pt {
  const d = g.detours[i]!;
  const top = apex(g, i, amps, pace);
  return d.across === undefined ? [top[0] + d.label[0], top[1] + d.label[1]] : [d.across, top[1]];
}

/** A smooth line through the points (Catmull-Rom, written as Bezier curves). */
function smooth(pts: Pt[]): string {
  const first = pts[0]!;
  let d = `M${f(first[0])} ${f(first[1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p0 = pts[i - 1] ?? p1;
    const p3 = pts[i + 2] ?? p2;
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

function place(g: Geo, [x, y]: Pt, align: Align): CSSProperties {
  const shift = align === 'start' ? '0%' : align === 'end' ? '-100%' : '-50%';
  return { left: `${((x / g.w) * 100).toFixed(2)}%`, top: `${((y / g.h) * 100).toFixed(2)}%`, transform: `translate(${shift}, -50%)` };
}

function Icon({ name }: { name?: string }) {
  const paths: Record<string, string> = {
    peak: 'M2 17 8.5 7l3.6 5.4L14.5 9 20 17Z',
    plate: 'M6 3v6a2 2 0 0 0 4 0V3M8 3v16M16 3c-2 1.5-2 6 0 8v8',
    glass: 'M6 5h10l-1.2 13H7.2ZM16 8h2.5a1.5 1.5 0 0 1 0 6H15.5M7 9h8',
    loop: 'M2 15c4 0 5-9 9-9s3 7 0 7-3-7 1-7 4 9 8 9',
  };
  return (
    <svg viewBox="0 0 22 22" width="22" height="22" aria-hidden="true" focusable="false">
      <path d={paths[name ?? ''] ?? 'M11 4a7 7 0 1 0 0.01 0Z'} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface Cls {
  hint: string;
  toggles: string;
  toggle: string;
  canvas: string;
  wide: string;
  tall: string;
  road: string;
  fill: string;
  lane: string;
  van: string;
  stop: string;
  end: string;
}

/**
 * The day can bend: the visitor taps what their group loves and the road springs out to each one,
 * wobbling as it settles. A slower pace opens a lazy loop and the minibus driving the road eases off.
 * The choices are shared with the plan at the end of the page, and taken from it.
 */
export function MeanderBend({ loves, start, end, hint, cls }: { loves: BendLove[]; start: string; end: string; hint: string; cls: Cls }) {
  const [on, setOn] = useState<Set<string>>(() => new Set());
  const host = useRef<HTMLDivElement>(null);
  const roads = useRef<(SVGPathElement | null)[]>([]);
  const lanes = useRef<(SVGPathElement | null)[]>([]);
  const fills = useRef<(SVGPathElement | null)[]>([]);
  const vans = useRef<(SVGGElement | null)[]>([]);
  const stops = useRef<(HTMLSpanElement | null)[]>([]);
  const target = useRef<number[]>([]);
  const kick = useRef<() => void>(() => {});
  const touched = useRef(false);
  const detours = loves.filter((l) => !l.pace);
  const pace = loves.find((l) => l.pace);
  const order = [...detours, ...(pace ? [pace] : [])];

  useEffect(() => {
    target.current = order.map((l) => (on.has(l.key) ? 1 : 0));
    kick.current();
  });

  useEffect(() => {
    const hear = (e: Event) => {
      const { keys, from } = (e as CustomEvent<{ keys: string[]; from: string }>).detail;
      if (from === 'bend') return;
      touched.current = true;
      setOn(new Set(keys));
    };
    window.addEventListener('meander:loves', hear);
    return () => window.removeEventListener('meander:loves', hear);
  }, []);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const phone = window.matchMedia(PHONE);
    const n = order.length;
    const amp = new Array<number>(n).fill(0);
    const vel = new Array<number>(n).fill(0);
    let dist = 0;
    let wait = 0;
    let visited = new Set<number>();
    let seen = false;
    let frame = 0;
    let last = 0;

    const draw = () => {
      const p = pace ? (amp[n - 1] ?? 0) : 0;
      GEOS.forEach((g, gi) => {
        const d = smooth(points(g, amp.slice(0, g.detours.length), p));
        roads.current[gi]?.setAttribute('d', d);
        fills.current[gi]?.setAttribute('d', d);
        lanes.current[gi]?.setAttribute('d', d);
        order.forEach((l, i) => {
          const s = stops.current[gi * n + i];
          if (!s) return;
          const a = Math.max(0, Math.min(1, amp[i] ?? 0));
          let at: Pt;
          let align: Align;
          if (l.pace) {
            at = g.loopLabel(p);
            align = g.loopAlign;
          } else {
            at = labelAt(g, i, amp, p);
            align = g.detours[i]!.align;
          }
          Object.assign(s.style, place(g, at, align));
          s.style.setProperty('--a', a.toFixed(3));
        });
      });
    };

    const drive = (dt: number) => {
      const gi = phone.matches ? 1 : 0;
      const path = roads.current[gi];
      const van = vans.current[gi];
      if (!path || !van) return;
      const length = path.getTotalLength();
      if (wait > 0) wait -= dt;
      else {
        const slow = pace ? (amp[n - 1] ?? 0) : 0;
        dist += dt * (gi ? 46 : 62) * (1 - 0.55 * Math.max(0, Math.min(1, slow)));
      }
      if (dist >= length) {
        dist = 0;
        visited = new Set();
        wait = 0.9;
      }
      const pt = path.getPointAtLength(dist);
      const ahead = path.getPointAtLength(Math.min(length, dist + 1));
      const angle = (Math.atan2(ahead.y - pt.y, ahead.x - pt.x) * 180) / Math.PI;
      van.setAttribute('transform', `translate(${f(pt.x)} ${f(pt.y)}) rotate(${f(angle)})`);
      // A stop the group asked for is a stop: the minibus waits a moment at the top of each bend.
      const g = GEOS[gi]!;
      const pace0 = pace ? (amp[n - 1] ?? 0) : 0;
      g.detours.forEach((_, i) => {
        if ((target.current[i] ?? 0) < 1 || (amp[i] ?? 0) < 0.9 || visited.has(i)) return;
        const top = apex(g, i, amp, pace0);
        if (Math.hypot(top[0] - pt.x, top[1] - pt.y) < 9) {
          visited.add(i);
          wait = 1.1;
        }
      });
    };

    const settle = (dt: number) => {
      let moving = false;
      for (let i = 0; i < n; i++) {
        const t = target.current[i] ?? 0;
        if (reduce) {
          amp[i] = t;
          vel[i] = 0;
          continue;
        }
        // A spring a little short of damped, so a bend overshoots and settles like a road being pulled into place.
        const force = 150 * (t - amp[i]!) - 13 * vel[i]!;
        vel[i] = vel[i]! + force * dt;
        amp[i] = amp[i]! + vel[i]! * dt;
        if (Math.abs(t - amp[i]!) > 0.002 || Math.abs(vel[i]!) > 0.002) moving = true;
        else {
          amp[i] = t;
          vel[i] = 0;
        }
      }
      return moving;
    };

    const tick = (time: number) => {
      const dt = Math.min(0.05, last ? (time - last) / 1000 : 0.016);
      last = time;
      const moving = settle(dt);
      if (moving) draw();
      drive(dt);
      frame = seen ? requestAnimationFrame(tick) : 0;
    };

    const start = () => {
      if (frame || reduce) return;
      last = 0;
      frame = requestAnimationFrame(tick);
    };

    kick.current = () => {
      if (reduce) {
        settle(0);
        draw();
        return;
      }
      start();
    };

    let io: IntersectionObserver | undefined;
    const timers: number[] = [];
    // Nothing is set up until the road is near the screen and the browser is idle.
    const setup = () => {
      if (reduce) {
        // With motion turned down the road simply shows bent, as it would after a few taps.
        const keys = [detours[0]?.key, detours[2]?.key ?? detours[1]?.key, pace?.key].filter((k): k is string => !!k);
        setOn(new Set(keys));
        queueMicrotask(() => window.dispatchEvent(new CustomEvent('meander:loves', { detail: { keys, from: 'bend' } })));
        draw();
        GEOS.forEach((g, gi) => {
          const path = roads.current[gi];
          const van = vans.current[gi];
          if (!path || !van) return;
          const pt = path.getPointAtLength(path.getTotalLength() * 0.06);
          van.setAttribute('transform', `translate(${f(pt.x)} ${f(pt.y)}) rotate(${g.axis ? 0 : 90})`);
        });
        return;
      }

      // The first time the road comes into view it shows what a tap does: a few of the loves are taken, one after the other.
      let shown = false;
      const demo = () => {
        const keys = [detours[0]?.key, detours[2]?.key ?? detours[1]?.key, pace?.key].filter((k): k is string => !!k);
        keys.forEach((key, i) => {
          timers.push(
            window.setTimeout(() => {
              if (touched.current) return;
              setOn((prev) => {
                if (prev.has(key)) return prev;
                const next = new Set(prev).add(key);
                queueMicrotask(() => window.dispatchEvent(new CustomEvent('meander:loves', { detail: { keys: [...next], from: 'bend' } })));
                return next;
              });
            }, 700 + i * 1100),
          );
        });
      };
      io = new IntersectionObserver(
        ([e]) => {
          seen = !!e?.isIntersecting;
          if (!seen) return;
          start();
          if (!shown) {
            shown = true;
            demo();
          }
        },
        { threshold: 0.35 },
      );
      io.observe(el);
    };
    const cancelNear = whenNear(el, setup, '60% 0px');
    return () => {
      cancelNear();
      io?.disconnect();
      for (const t of timers) window.clearTimeout(t);
      cancelAnimationFrame(frame);
      frame = 0;
      kick.current = () => {};
    };
    // The loves are fixed for the life of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (key: string) => {
    touched.current = true;
    const next = new Set(on);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setOn(next);
    window.dispatchEvent(new CustomEvent('meander:loves', { detail: { keys: [...next], from: 'bend' } }));
  };

  return (
    <div ref={host}>
      <p className={cls.hint}>{hint}</p>
      <div className={cls.toggles} role="group" aria-label={hint}>
        {loves.map((l) => (
          <button key={l.key} type="button" className={cls.toggle} aria-pressed={on.has(l.key)} onClick={() => toggle(l.key)} data-press>
            <Icon name={l.icon} />
            <span>{l.label}</span>
          </button>
        ))}
      </div>
      <div className={cls.canvas} aria-hidden="true">
        {GEOS.map((g, gi) => {
          const d = smooth(points(g, [0, 0, 0], 0));
          return (
            <div key={gi} className={gi ? cls.tall : cls.wide} style={{ aspectRatio: `${g.w} / ${g.h}` }}>
              <svg viewBox={`0 0 ${g.w} ${g.h}`} focusable="false">
                <path ref={(r) => void (roads.current[gi] = r)} className={cls.road} d={d} />
                <path ref={(r) => void (fills.current[gi] = r)} className={cls.fill} d={d} />
                <path ref={(r) => void (lanes.current[gi] = r)} className={cls.lane} d={d} />
                <g ref={(r) => void (vans.current[gi] = r)} transform={`translate(${f(g.start[0] + (g.axis ? 40 : 0))} ${f(g.start[1] + (g.axis ? 0 : 40))}) rotate(${g.axis ? 0 : 90})`}>
                  <MeanderVan className={cls.van} />
                </g>
              </svg>
              {g.ends.map(([at, align], i) => (
                <span key={i} className={cls.end} style={place(g, at, align)}>
                  {i ? end : start}
                </span>
              ))}
              {order.map((l, i) => {
                const at: Pt = l.pace ? g.loopLabel(0) : labelAt(g, i, [0, 0, 0], 0);
                return (
                  <span key={l.key} ref={(r) => void (stops.current[gi * order.length + i] = r)} className={cls.stop} style={{ ...place(g, at, l.pace ? g.loopAlign : g.detours[i]!.align), '--a': 0 } as CSSProperties}>
                    {l.stop}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
