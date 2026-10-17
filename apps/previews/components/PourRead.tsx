'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

/**
 * Tells what it holds how far the visitor has read, as `--r` from 0 to 1: from the moment it enters
 * at the foot of the screen until it reaches the middle, or, with `whole`, through the whole page.
 * Before the scripts arrive, and with reduced motion asked for, it reads 1, so everything shows.
 */
export function PourRead({ children, className, whole }: { children: ReactNode; className?: string; whole?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    const set = (p: number) => el.style.setProperty('--r', p.toFixed(3));
    void import('motion').then(({ scroll }) => {
      if (cancelled) return;
      stop = whole ? scroll(set) : scroll(set, { target: el, offset: ['start end', 'center center'] });
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [whole]);

  return (
    <div ref={ref} className={className} style={{ '--r': 1 } as CSSProperties}>
      {children}
    </div>
  );
}
