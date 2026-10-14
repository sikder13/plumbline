'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { stillWanted, whenIdle } from './ClearingIdle';

/**
 * A box that is told once when it comes into view: it gains `data-seen`, and the design's styles play
 * an entrance from there. Only a box still below the screen when the browser is first idle is held back
 * (`data-armed`), and only when motion is welcome, so before the script runs, or with reduced motion
 * asked for, everything shows. Nothing is measured while the page loads: the observer reports positions.
 */
export function ClearingSeen({ children, className, style, amount = 0.25 }: { children: ReactNode; className?: string; style?: CSSProperties; amount?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || stillWanted()) return;
    let io: IntersectionObserver | undefined;
    const cancel = whenIdle(() => {
      let first = true;
      io = new IntersectionObserver(
        ([e]) => {
          if (!e) return;
          if (first) {
            first = false;
            // Already in view, or already passed: it simply stays as it is.
            if (e.isIntersecting || e.boundingClientRect.top < 0) {
              io?.disconnect();
              return;
            }
            el.setAttribute('data-armed', '');
            return;
          }
          if (e.isIntersecting && e.intersectionRatio >= amount * 0.98) {
            el.setAttribute('data-seen', '');
            io?.disconnect();
          }
        },
        { threshold: [0, amount] },
      );
      io.observe(el);
    });
    return () => {
      cancel();
      io?.disconnect();
    };
  }, [amount]);

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}
