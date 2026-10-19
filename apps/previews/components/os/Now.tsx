'use client';

import { useEffect, useState } from 'react';
import { indianaNow, stateAt, type Day } from './hours';

/**
 * The line that says whether the business is open at this moment, from its published hours and the
 * Indiana clock. Until the page wakes it shows `fallback`, a plain fact that is always true. It also
 * marks today's row: the element with `data-day="<n>"` inside `scope` gets `data-today`.
 */
export function Now({ week, fallback, className, scope }: { week: Day[]; fallback: string; className?: string; scope?: string }) {
  const [line, setLine] = useState(fallback);
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    const tick = () => {
      const now = indianaNow();
      const s = stateAt(week, now);
      setLine(s.line);
      setOpen(s.open);
      const root = scope ? document.querySelector(scope) : document;
      root?.querySelectorAll('[data-day]').forEach((el) => el.toggleAttribute('data-today', Number((el as HTMLElement).dataset.day) === now.weekday));
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [week, scope]);
  return (
    <span className={className} data-open={open === null ? undefined : open ? 'yes' : 'no'}>
      {line}
    </span>
  );
}
