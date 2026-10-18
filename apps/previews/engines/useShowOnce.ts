'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Lets a signature show what it does in a passive scroll: the first time it is well in view it
 * steps through its states once, a step every `every` ms, then rests on `rest`. Nothing plays with
 * reduced motion asked for, and the visitor's first touch, click or key stops it at once.
 */
export function useShowOnce<T extends HTMLElement>(steps: number, opts: { every?: number; rest?: number } = {}): { ref: RefObject<T | null>; shown: number | null; stop: () => void } {
  const ref = useRef<T | null>(null);
  const [shown, setShown] = useState<number | null>(null);
  const stopped = useRef(false);
  const timers = useRef<number[]>([]);
  const every = opts.every ?? 520;
  const rest = opts.rest ?? 0;

  const stop = () => {
    stopped.current = true;
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
    setShown(null);
  };

  useEffect(() => {
    const el = ref.current;
    if (!el || steps < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const halt = () => stop();
    el.addEventListener('pointerdown', halt, { once: true });
    el.addEventListener('keydown', halt, { once: true });
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting || stopped.current) return;
        io.disconnect();
        // At most 2.4 seconds in all.
        const n = Math.min(steps, Math.floor(2400 / every));
        for (let i = 0; i < n; i++) timers.current.push(window.setTimeout(() => !stopped.current && setShown(i), 250 + i * every));
        timers.current.push(
          window.setTimeout(() => {
            if (!stopped.current) setShown(rest);
            stopped.current = true;
          }, 250 + n * every),
        );
      },
      { threshold: 0.55 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      el.removeEventListener('pointerdown', halt);
      el.removeEventListener('keydown', halt);
      for (const t of timers.current) window.clearTimeout(t);
    };
    // The demonstration is set up once per page.
  }, [steps]);

  return { ref, shown, stop };
}
