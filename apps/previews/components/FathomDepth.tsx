'use client';

import { useEffect, useRef } from 'react';
import { whenNear } from './FathomNear';

/** Where in the held section the descent starts and ends, as parts of its scroll. The styles use the same two. */
const FROM = 0.3;
const TO = 0.72;

/**
 * A depth that counts down with the scroll of the section it sits in: the word for the surface at
 * the top, then metres, ending on the deepest figure the business gives. With reduced motion asked
 * for, or before the script arrives, the start shows, and reduced motion shows the deepest at once.
 */
export function FathomDepth({ start, max, unit, className }: { start: string; max: number; unit: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    const held = el?.closest<HTMLElement>('[data-active]');
    if (!el || !held) return;
    let last = '';
    const show = (d: number) => {
      const text = d <= 0.004 ? start : `${Math.min(max, Math.max(1, Math.round(d * max)))}${unit}`;
      if (text !== last) el.textContent = last = text;
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      show(1);
      return;
    }
    return whenNear(held, () => {
      let stop: (() => void) | undefined;
      let cancelled = false;
      void import('motion').then(({ scroll }) => {
        if (cancelled) return;
        stop = scroll((p: number) => show(Math.min(1, Math.max(0, (p - FROM) / (TO - FROM)))), { target: held, offset: ['start start', 'end end'] });
      });
      return () => {
        cancelled = true;
        stop?.();
      };
    });
  }, [start, max, unit]);

  return (
    <span ref={ref} className={className} aria-hidden="true">
      {start}
    </span>
  );
}
