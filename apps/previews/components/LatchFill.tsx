'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

type Edge = `${'start' | 'center' | 'end'} ${number}`;

/**
 * A block that knows how far the visitor has scrolled through it: it sets `--fill`, from 0 to 1,
 * between the two edges given (as motion's scroll offsets), for its styles to draw with. It is drawn
 * at 1 before the scripts arrive and with reduced motion asked for, so everything simply shows.
 */
export function LatchFill({ className, style, children, from = 'start 0.9', to = 'start 0.35', label }: { className?: string; style?: CSSProperties; children: ReactNode; from?: Edge; to?: Edge; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    void import('motion').then(({ scroll }) => {
      if (cancelled) return;
      stop = scroll((p: number) => el.style.setProperty('--fill', p.toFixed(3)), { target: el, offset: [from, to] });
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [from, to]);

  return (
    <div ref={ref} className={className} style={{ '--fill': 1, ...style } as CSSProperties} role={label ? 'group' : undefined} aria-label={label}>
      {children}
    </div>
  );
}
