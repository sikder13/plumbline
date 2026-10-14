'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

/**
 * A box that knows how far the visitor has scrolled through it: it carries `--s`, from 0 to 1 between
 * the two edges given (as the motion library writes them, "start end" and so on), for the design's
 * styles to move things by. Before the script arrives `--s` holds `initial`; with reduced motion asked
 * for it is set to `still` and nothing moves.
 */
export function SunpathProgress({
  children,
  className,
  offset = ['start end', 'end start'],
  initial = 0,
  still = 1,
  watch,
}: {
  children: ReactNode;
  className?: string;
  offset?: string[];
  initial?: number;
  still?: number;
  /** A selector inside the box to measure instead of the box itself. */
  watch?: string;
}) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.style.setProperty('--s', String(still));
      return;
    }
    const target = (watch && el.querySelector<HTMLElement>(watch)) || el;
    let stop: (() => void) | undefined;
    let cancelled = false;
    let last = -1;
    void import('motion').then(({ scroll }) => {
      if (cancelled) return;
      stop = scroll(
        (p: number) => {
          const v = Math.round(p * 1000) / 1000;
          if (v === last) return;
          last = v;
          el.style.setProperty('--s', String(v));
        },
        { target, offset: offset as never },
      );
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [offset, still, watch]);

  return (
    <div ref={box} className={className} style={{ '--s': String(initial) } as CSSProperties}>
      {children}
    </div>
  );
}
