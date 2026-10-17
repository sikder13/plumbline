'use client';

import { useState } from 'react';
import { useShowOnce } from '../useShowOnce';

interface Stop {
  name: string;
  note?: string;
}

/**
 * Their stated trip as its stops in order, joined by a plain rule. A stop chosen shows what they
 * say of it. It shows the order only, and says so. On first view the stops light in turn.
 */
export function RouteLine({ trip, stops, cls }: { trip: string; stops: Stop[]; cls: Record<string, string> }) {
  const [at, setAt] = useState(0);
  const { ref, shown, stop } = useShowOnce<HTMLDivElement>(stops.length, { every: 480, rest: 0 });
  const i = shown ?? at;
  return (
    <div ref={ref} className={cls.route}>
      <ol className={cls.routeStops} aria-label={trip}>
        {stops.map((s, n) => (
          <li key={s.name} data-on={n === i ? '' : undefined} data-done={n < i ? '' : undefined}>
            <button
              type="button"
              aria-pressed={n === i}
              onClick={() => {
                stop();
                setAt(n);
              }}
            >
              {s.name}
            </button>
            {n === i && s.note && <p className={cls.routeNote}>{s.note}</p>}
          </li>
        ))}
      </ol>
      <p className={cls.routeKey}>The stops in the order they give them, not to scale.</p>
    </div>
  );
}
