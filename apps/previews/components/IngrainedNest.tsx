'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { frameState, frameVars } from './IngrainedGeometry';

/**
 * A tall section whose frame holds still while the visitor scrolls, zooming out through frames held
 * one inside the corner of the next (`[data-k]`, numbered from the smallest). It sets `--p` (0 to 1)
 * on itself for anything else that follows the scroll. Before the script arrives, and with reduced
 * motion asked for, nothing moves: the styles lay the frames out without it.
 */
export function IngrainedNest({ children, className, ratio, last }: { children: ReactNode; className?: string; ratio: number; last: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const o = ref.current;
    if (!o || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    let lastF = -1;
    const frames = [...o.querySelectorAll<HTMLElement>('[data-k]')].map((el) => ({ el, k: Number(el.dataset.k) }));
    // Pictures waiting behind others are not fetched on their own, so once the page has painted they are all asked for.
    for (const img of o.querySelectorAll<HTMLImageElement>('img[loading="lazy"]')) img.loading = 'eager';
    const apply = (p: number) => {
      o.style.setProperty('--p', p.toFixed(4));
      // A short hold at each end: the first frame settles before the zoom starts, and the last one stays.
      const f = Math.min(1, Math.max(0, (p - 0.03) / 0.88)) * last;
      if (Math.abs(f - lastF) < 0.0005) return;
      lastF = f;
      for (const { el, k } of frames) {
        const vars = frameVars(frameState(k, f, ratio, last));
        for (const [name, value] of Object.entries(vars)) el.style.setProperty(name, value);
      }
    };
    void import('motion').then(({ scroll }) => {
      if (cancelled) return;
      stop = scroll(apply, { target: o, offset: ['start start', 'end end'] });
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [ratio, last]);

  return (
    <div ref={ref} className={className} style={{ '--p': 0 } as CSSProperties}>
      {children}
    </div>
  );
}
