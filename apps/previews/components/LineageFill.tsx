'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Statements that fill in as they are read: each child marked `data-fill` is given `--fill`, from 0 as it
 * enters the screen to 1 once it has risen past the middle, and the design's styles darken its words in
 * turn. It starts with the visitor's first scroll. Without the script, or with reduced motion asked for,
 * `--fill` stays at 1 and every word shows.
 */
export function LineageFill({ children, className }: { children: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const stops: (() => void)[] = [];
    let cancelled = false;
    // Nothing is dimmed until the visitor starts to read down, so a page that is only loaded shows every word.
    const start = () => {
      void import('motion').then(({ scroll }) => {
        if (cancelled) return;
        for (const p of el.querySelectorAll<HTMLElement>('[data-fill]')) {
          stops.push(scroll((v: number) => p.style.setProperty('--fill', v.toFixed(3)), { target: p, offset: ['start 0.92', 'end 0.5'] }));
        }
      });
    };
    window.addEventListener('scroll', start, { once: true, passive: true });
    return () => {
      cancelled = true;
      window.removeEventListener('scroll', start);
      for (const stop of stops) stop();
    };
  }, []);

  return (
    <div ref={box} className={className}>
      {children}
    </div>
  );
}
