'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { whenNear } from './FathomNear';

/**
 * A section whose frame holds still while the visitor scrolls through its steps, as the shared held
 * section does: the frame carries its progress as `--p` (0 to 1) and `data-active`, and anything
 * marked `data-step` is told whether it is the current step, done or still to come. Here the scroll
 * is only watched once the section is near the screen and the browser is idle, so the opening screen
 * pays nothing for it. Until then the first step shows.
 */
export function FathomHold({ steps, children, className }: { steps: number; children: ReactNode; className?: string }) {
  const outer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const o = outer.current;
    if (!o) return;
    return whenNear(o, () => {
      let stop: (() => void) | undefined;
      let cancelled = false;
      let last = -1;
      const marks = [...o.querySelectorAll<HTMLElement>('[data-step]')];
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
    });
  }, [steps]);

  return (
    <div ref={outer} className={className} data-active="0" style={{ '--steps': steps, '--p': 0 } as CSSProperties}>
      <div data-frame>{children}</div>
    </div>
  );
}
