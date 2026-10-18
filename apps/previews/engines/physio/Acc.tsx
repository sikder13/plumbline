'use client';

import { useState } from 'react';
import { useShowOnce } from '../useShowOnce';

/**
 * ACC, plainly: each point a question a visitor might have, answered only in the clinic's own
 * words. One answer is open at a time; on first view they open in turn, then the first stays open.
 */
export function Acc({ points, cls }: { points: { title: string; text: string }[]; cls: Record<string, string> }) {
  const [open, setOpen] = useState(0);
  const { ref, shown, stop } = useShowOnce<HTMLDivElement>(points.length, { every: 560, rest: 0 });
  const i = shown ?? open;
  return (
    <div ref={ref} className={cls.acc}>
      {points.map((p, n) => (
        <div key={p.title} className={cls.accItem} data-on={n === i ? '' : undefined}>
          <h3>
            <button
              type="button"
              aria-expanded={n === i}
              aria-controls={`acc-${n}`}
              className={cls.accQ}
              onClick={() => {
                stop();
                setOpen(n);
              }}
            >
              {p.title}
            </button>
          </h3>
          <p id={`acc-${n}`} className={cls.accA} hidden={n !== i}>
            {p.text}
          </p>
        </div>
      ))}
    </div>
  );
}
