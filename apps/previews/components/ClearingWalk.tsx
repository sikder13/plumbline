'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { stillWanted, whenIdle } from './ClearingIdle';

/**
 * The clearing design's held frame: a tall section whose frame stays still while the visitor scrolls
 * through its steps. It carries the progress as `--p` (0 to 1) and marks each `[data-step]` as the
 * current one, passed or still to come, as the shared pinned frame does, but it starts only once the
 * browser is first idle and listens only while the section is near the screen, so it costs the first
 * screen nothing. Before the script runs, the first step shows.
 */
export function ClearingWalk({ steps, children, className }: { steps: number; children: ReactNode; className?: string }) {
  const outer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const o = outer.current;
    if (!o || stillWanted()) return;
    let frame = 0;
    let last = -1;
    let lastP = -1;
    let listening = false;
    let marks: HTMLElement[] = [];
    const update = () => {
      frame = 0;
      const r = o.getBoundingClientRect();
      const travel = r.height - window.innerHeight;
      const p = Math.min(1, Math.max(0, travel > 0 ? -r.top / travel : 0));
      if (Math.abs(p - lastP) >= 0.001) {
        lastP = p;
        o.style.setProperty('--p', p.toFixed(4));
      }
      const i = Math.min(steps - 1, Math.max(0, Math.floor(p * steps)));
      if (i === last) return;
      last = i;
      o.setAttribute('data-active', String(i));
      for (const m of marks) {
        const n = Number(m.dataset.step);
        m.dataset.state = n === i ? 'on' : n < i ? 'done' : 'off';
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    let io: IntersectionObserver | undefined;
    const cancel = whenIdle(() => {
      marks = [...o.querySelectorAll<HTMLElement>('[data-step]')];
      io = new IntersectionObserver(
        ([e]) => {
          const near = !!e?.isIntersecting;
          if (near && !listening) {
            listening = true;
            // A photograph waiting in the frame is asked for before the visitor arrives.
            for (const img of o.querySelectorAll<HTMLImageElement>('img[loading="lazy"]')) img.loading = 'eager';
            window.addEventListener('scroll', onScroll, { passive: true });
            onScroll();
          } else if (!near && listening) {
            listening = false;
            window.removeEventListener('scroll', onScroll);
            onScroll();
          }
        },
        { rootMargin: '60% 0px' },
      );
      io.observe(o);
    });
    return () => {
      cancel();
      io?.disconnect();
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [steps]);

  return (
    <div ref={outer} className={className} data-active="0" style={{ '--steps': steps, '--p': 0 } as CSSProperties}>
      <div data-frame>{children}</div>
    </div>
  );
}
