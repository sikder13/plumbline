'use client';

import { useEffect, useRef } from 'react';
import { stillWanted, whenIdle } from './ClearingIdle';

/**
 * A plain count, written as the business writes it ("50,000"), that runs up once from nothing when it is
 * well in view. The page is served with the true figure in place, so without the script, with reduced
 * motion asked for, or when the figure is already on screen once the browser is idle, it simply stands.
 */
export function ClearingCount({ value, className }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || stillWanted()) return;
    const target = Number(value.replace(/[^\d]/g, ''));
    if (!Number.isFinite(target) || target <= 0) return;
    const grouped = value.includes(',');
    const show = (n: number) => (grouped ? Math.round(n).toLocaleString('en-NZ') : String(Math.round(n)));
    let frame = 0;
    let io: IntersectionObserver | undefined;
    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / 1400);
        // Quick away, long settle.
        const eased = 1 - Math.pow(1 - t, 4);
        el.textContent = show(target * eased);
        if (t < 1) frame = requestAnimationFrame(tick);
        else el.textContent = value;
      };
      frame = requestAnimationFrame(tick);
    };
    const cancel = whenIdle(() => {
      let first = true;
      io = new IntersectionObserver(
        ([e]) => {
          if (!e) return;
          if (first) {
            first = false;
            if (e.isIntersecting || e.boundingClientRect.top < 0) {
              io?.disconnect();
              return;
            }
            el.textContent = show(0);
            return;
          }
          if (e.isIntersecting) {
            io?.disconnect();
            run();
          }
        },
        { threshold: 0.8 },
      );
      io.observe(el);
    });
    return () => {
      cancel();
      io?.disconnect();
      cancelAnimationFrame(frame);
      el.textContent = value;
    };
  }, [value]);

  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  );
}
