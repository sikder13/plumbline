'use client';

import { useState } from 'react';
import { useShowOnce } from '../useShowOnce';
import { riverPath, riverPoints } from './river';

interface Stop {
  name: string;
  note?: string;
}

/**
 * Their stated trip as a drawn line through its stops, in their order. A stop chosen shows what
 * they say of it. It is a diagram, not a map, and says so. On first view the stops light in turn.
 */
export function RouteLine({ trip, stops, cls }: { trip: string; stops: Stop[]; cls: Record<string, string> }) {
  const [at, setAt] = useState(0);
  const { ref, shown, stop } = useShowOnce<HTMLDivElement>(stops.length, { every: 480, rest: 0 });
  const i = shown ?? at;
  const pts = riverPoints(stops.length, 360, 150, 24);
  return (
    <div ref={ref} className={cls.route}>
      <svg className={cls.routeArt} viewBox="0 0 360 150" aria-hidden="true" focusable="false">
        <path className={cls.routeBed} d={riverPath(pts, 30)} />
        <path className={cls.routeLine} d={riverPath(pts, 30)} pathLength={1} />
        {pts.map(([x, y], n) => (
          <circle key={stops[n]!.name} cx={x} cy={y} r={n === i ? 9 : 6} data-on={n <= i ? '' : undefined} />
        ))}
      </svg>
      <ol className={cls.routeStops} aria-label={trip}>
        {stops.map((s, n) => (
          <li key={s.name}>
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
          </li>
        ))}
      </ol>
      {stops[i]!.note && (
        <p className={cls.routeNote} aria-live="polite">
          {stops[i]!.note}
        </p>
      )}
      <p className={cls.routeKey}>Drawn to show the order of the stops, not to scale.</p>
    </div>
  );
}
