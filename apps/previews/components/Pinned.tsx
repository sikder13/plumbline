'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

/**
 * A section whose frame holds still while the visitor scrolls through a number of steps. Anything
 * inside marked `data-step` is told whether its step is the current one, already passed or still
 * to come, and the frame carries the overall progress as `--p`, from 0 to 1. What a step looks like
 * is left to each design's styles. Before the scripts arrive, the first step shows.
 */
export function Pinned({ steps, children, className, style }: { steps: number; children: ReactNode; className?: string; style?: CSSProperties }) {
  const outer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const o = outer.current;
    if (!o) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    let last = -1;
    const marks = [...o.querySelectorAll<HTMLElement>('[data-step]')];
    // A photograph waiting behind another is not fetched on its own, so by the time this runs, after the page has painted, they are all asked for.
    for (const img of o.querySelectorAll<HTMLImageElement>('img[loading="lazy"]')) img.loading = 'eager';
    const apply = (progress: number) => {
      o.style.setProperty('--p', progress.toFixed(4));
      const i = Math.min(steps - 1, Math.max(0, Math.floor(progress * steps)));
      if (i === last) return;
      last = i;
      o.setAttribute('data-active', String(i));
      for (const m of marks) {
        const n = Number(m.dataset.step);
        m.dataset.state = n === i ? 'on' : n < i ? 'done' : 'off';
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
  }, [steps]);

  return (
    <div ref={outer} className={className} data-active="0" style={{ '--steps': steps, '--p': 0, ...style } as CSSProperties}>
      <div data-frame>{children}</div>
    </div>
  );
}
