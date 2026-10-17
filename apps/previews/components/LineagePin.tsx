'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

/**
 * A section whose frame holds still while the visitor scrolls through a number of steps, as the shared pinned
 * section does, but which does nothing at all while the page loads: from the visitor's first scroll it waits for
 * the section to come near the screen, and only then are its photographs asked for and the scroll library
 * fetched. Anything inside marked `data-step` is told whether its step is the current one, already passed or
 * still to come, and the outer box carries the progress as `--p`, from 0 to 1. Before the script arrives, the
 * first step shows.
 */
export function LineagePin({ steps, children, className }: { steps: number; children: ReactNode; className?: string }) {
  const outer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const o = outer.current;
    if (!o) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    let last = -1;
    const apply = (progress: number) => {
      o.style.setProperty('--p', progress.toFixed(4));
      const i = Math.min(steps - 1, Math.max(0, Math.floor(progress * steps)));
      if (i === last) return;
      last = i;
      o.setAttribute('data-active', String(i));
      for (const m of o.querySelectorAll<HTMLElement>('[data-step]')) {
        const n = Number(m.dataset.step);
        m.dataset.state = n === i ? 'on' : n < i ? 'done' : 'off';
      }
    };
    const start = () => {
      // Pictures behind the first step are not on screen, so they are asked for now, ahead of being shown.
      for (const img of o.querySelectorAll<HTMLImageElement>('img[loading="lazy"]')) img.loading = 'eager';
      void import('motion').then(({ scroll }) => {
        if (cancelled) return;
        stop = scroll(apply, { target: o, offset: ['start start', 'end end'] });
      });
    };
    // Nothing is done while the page loads: the watch begins with the visitor's first scroll.
    let io: IntersectionObserver | undefined;
    const arm = () => {
      io = new IntersectionObserver(
        ([e]) => {
          if (!e?.isIntersecting) return;
          io?.disconnect();
          start();
        },
        { rootMargin: '100% 0px 100% 0px' },
      );
      io.observe(o);
    };
    window.addEventListener('scroll', arm, { once: true, passive: true });
    return () => {
      cancelled = true;
      window.removeEventListener('scroll', arm);
      io?.disconnect();
      stop?.();
    };
  }, [steps]);

  return (
    <div ref={outer} className={className} data-active="0" style={{ '--steps': steps, '--p': 0 } as CSSProperties}>
      <div data-frame>{children}</div>
    </div>
  );
}
