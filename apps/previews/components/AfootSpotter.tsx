'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export interface SpotterBird {
  name: string;
  label: string;
  /** Where the bird sits in the frame, in percent from the left and from the top. */
  x: number;
  y: number;
  /** The photograph. It is shown twice: in focus inside the lens, and out of focus, hidden from screen readers, around it. */
  sharp: ReactNode;
}

type Point = { x: number; y: number };

/**
 * A pair of binoculars over a patch of bush. Each bird sits out of focus in its photograph until the
 * lens finds it and brings it into focus. When the frame comes into view the lens hunts for the first
 * bird; then it moves on to the next every few seconds until the visitor takes over. A tap on a bird's
 * name sends the lens to find it; the lens follows the pointer on a large screen and a finger dragged
 * sideways on a phone. Before the script arrives, or with reduced motion asked for, the bird simply
 * shows in focus.
 */
export function AfootSpotter({ birds, label, hint, className }: { birds: SpotterBird[]; label: string; hint: string; className?: string }) {
  const [cur, setCur] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const choose = useRef<(i: number) => void>(() => undefined);
  const points = useRef<Point[]>(birds.map((b) => ({ x: b.x, y: b.y })));

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const spots = points.current;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const size = () => Math.round(Math.min(el.offsetWidth, el.offsetHeight) * 0.2);
    let at = 0;
    const pos = { x: spots[0]!.x, y: spots[0]!.y, r: size() };
    const drift = { x: 0, y: 0 };
    const write = () => {
      el.style.setProperty('--x', `${(pos.x + drift.x).toFixed(2)}%`);
      el.style.setProperty('--y', `${(pos.y + drift.y).toFixed(2)}%`);
      el.style.setProperty('--rr', pos.r.toFixed(1));
    };
    const state = (s: string) => el.setAttribute('data-state', s);
    write();
    state('locked');

    if (reduce) {
      choose.current = (i) => {
        at = i;
        setCur(i);
        Object.assign(pos, spots[i]);
        write();
      };
      return;
    }

    let cancelled = false;
    const timers: number[] = [];
    const later = (ms: number, run: () => void) => timers.push(window.setTimeout(run, ms));
    const clearTimers = () => {
      for (const t of timers.splice(0)) window.clearTimeout(t);
    };
    let teardown = () => undefined as void;

    void import('motion').then(({ animate, inView }) => {
      if (cancelled) return;
      type Run = { stop: () => void };
      let runs: Run[] = [];
      let wander: Run[] = [];
      const halt = () => {
        for (const r of runs.splice(0)) r.stop();
      };
      const still = () => {
        for (const r of wander.splice(0)) r.stop();
        drift.x = 0;
        drift.y = 0;
      };
      const glide = (to: Partial<typeof pos>, spring: { stiffness: number; damping: number }) => {
        halt();
        for (const key of Object.keys(to) as (keyof typeof pos)[]) {
          runs.push(animate(pos[key], to[key]!, { type: 'spring', ...spring, onUpdate: (v: number) => void ((pos[key] = v), write()) }));
        }
      };
      // While it rests on a bird the lens breathes a little, as hands holding binoculars do.
      const breathe = () => {
        still();
        const axis = (key: 'x' | 'y', reach: number, duration: number) =>
          animate(0, reach, { duration, repeat: Infinity, repeatType: 'mirror', ease: [0.45, 0, 0.55, 1], onUpdate: (v: number) => void ((drift[key] = v), write()) });
        wander = [axis('x', 1.4, 3.1), axis('y', 1.1, 2.3)];
      };
      const lock = (ms: number) =>
        later(ms, () => {
          state('locked');
          breathe();
        });

      /** The lens drops away from where it is, sweeps in from below the bird and settles on it. */
      const find = (i: number, first = false) => {
        clearTimers();
        still();
        state('search');
        const to = spots[i]!;
        const r = size();
        if (first) Object.assign(pos, { x: to.x - 24, y: to.y + 26, r: r * 0.5 });
        glide({ x: to.x - 9, y: to.y + 9, r: r * 0.62 }, { stiffness: 70, damping: 15 });
        later(first ? 80 : 240, () => {
          at = i;
          setCur(i);
        });
        later(first ? 520 : 620, () => glide({ x: to.x, y: to.y, r }, { stiffness: 110, damping: 11 }));
        lock(first ? 1150 : 1250);
      };

      let touched = false;
      let shown = false;
      let cycle = 0;
      const stopCycle = () => window.clearInterval(cycle);
      const startCycle = () => {
        stopCycle();
        if (touched || spots.length < 2) return;
        cycle = window.setInterval(() => find((at + 1) % spots.length), 4800);
      };

      choose.current = (i) => {
        touched = true;
        stopCycle();
        find(i);
      };

      const leaveView = inView(
        el,
        () => {
          if (!shown) {
            shown = true;
            find(at, true);
          } else breathe();
          startCycle();
          return () => {
            stopCycle();
            still();
          };
        },
        { amount: 0.5 },
      );

      // The visitor moves the lens: with the pointer on a large screen, or by dragging a finger on a phone.
      let pressed = false;
      let back = 0;
      const follow = (e: PointerEvent) => {
        if (!fine && !pressed) return;
        const box = el.getBoundingClientRect();
        const x = Math.max(4, Math.min(96, ((e.clientX - box.left) / box.width) * 100));
        const y = Math.max(4, Math.min(96, ((e.clientY - box.top) / box.height) * 100));
        touched = true;
        stopCycle();
        clearTimers();
        window.clearTimeout(back);
        still();
        state('free');
        glide({ x, y, r: size() }, { stiffness: 260, damping: 28 });
      };
      const home = () => {
        window.clearTimeout(back);
        back = window.setTimeout(() => {
          const to = spots[at]!;
          state('search');
          glide({ x: to.x, y: to.y, r: size() }, { stiffness: 120, damping: 14 });
          lock(700);
        }, 900);
      };
      const down = (e: PointerEvent) => {
        if (e.pointerType === 'mouse') return;
        pressed = true;
        follow(e);
      };
      const up = () => {
        if (!pressed) return;
        pressed = false;
        home();
      };
      el.addEventListener('pointermove', follow);
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      if (fine) el.addEventListener('pointerleave', home);

      teardown = () => {
        leaveView();
        stopCycle();
        halt();
        still();
        window.clearTimeout(back);
        el.removeEventListener('pointermove', follow);
        el.removeEventListener('pointerdown', down);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        el.removeEventListener('pointerleave', home);
      };
    });

    return () => {
      cancelled = true;
      clearTimers();
      teardown();
    };
  }, []);

  const first = birds[0]!;
  return (
    <div className={className}>
      <div ref={stage} data-stage data-state="locked" style={{ '--x': `${first.x}%`, '--y': `${first.y}%` } as CSSProperties}>
        {birds.map((b, i) => (
          <div key={b.name} data-bird data-on={i === cur ? '' : undefined} aria-hidden={i === cur ? undefined : true}>
            <div data-soft aria-hidden="true">
              {b.sharp}
            </div>
            <div data-sharp>{b.sharp}</div>
          </div>
        ))}
        <span data-lens aria-hidden="true">
          <svg viewBox="0 0 330 210" focusable="false">
            <circle cx="105" cy="105" r="100" />
            <circle cx="225" cy="105" r="100" />
            <path d="M105 5v14M105 191v14M5 105h14M225 5v14M225 191v14M311 105h14" data-ticks />
          </svg>
        </span>
        <p data-caption aria-live="polite">{birds[cur]!.label}</p>
      </div>
      <p data-hint>{hint}</p>
      <div data-choose role="group" aria-label={label}>
        {birds.map((b, i) => (
          <button key={b.name} type="button" aria-pressed={i === cur} onClick={() => choose.current(i)}>
            <i aria-hidden="true" />
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
