'use client';

import { Fragment, useState } from 'react';
import { useShowOnce } from '../useShowOnce';

interface Place {
  name: string;
  distance?: string;
  reach?: number;
  note?: string;
}

/**
 * What is around them, as rings about the stay: each ring is one of the distances they give, and
 * its places are written along it, so every name sits on its own distance. The rings put the places
 * in order; they are not a scale. A place chosen, on a ring or in the list, is set in the accent
 * with what they say of it. On first view the places light in turn, nearest first.
 */
export function Around({ here, places, cls }: { here: string; places: Place[]; cls: Record<string, string> }) {
  const [at, setAt] = useState(0);
  const order = places.map((p, i) => ({ ...p, i })).sort((a, b) => (a.reach ?? 0) - (b.reach ?? 0));
  const reaches = [...new Set(order.map((p) => p.reach ?? 0))];
  const { ref, shown, stop } = useShowOnce<HTMLDivElement>(order.length, { every: 300, rest: 0 });
  const current = order[shown ?? at]!;
  const radius = (k: number) => 66 + (k * 114) / Math.max(1, reaches.length - 1);
  return (
    <div ref={ref} className={cls.around}>
      <svg className={cls.rings} viewBox="-196 -196 392 392" role="img" aria-label={`${here}: ${order.map((p) => `${p.name}${p.distance ? `, ${p.distance}` : ''}`).join('; ')}`}>
        <defs>
          {reaches.map((r, k) => {
            const R = radius(k);
            // Each ring is drawn from its lowest point, clockwise, so words centred on it sit upright at the top.
            return <path key={r} id={`ring-${k}`} d={`M0 ${R}A${R} ${R} 0 1 1 0.01 ${R}`} />;
          })}
        </defs>
        {reaches.map((r, k) => {
          const R = radius(k);
          const on = order.filter((p) => (p.reach ?? 0) === r);
          const chars = (on[0]?.distance?.length ?? 0) + on.reduce((n, p) => n + p.name.length + 3, 0);
          // The words fill most of the ring, never more than it holds.
          const size = Math.min(13.5, (2 * Math.PI * R * 0.92) / (Math.max(chars, 1) * 0.56));
          return (
            <g key={r}>
              <circle r={R} className={cls.ringLine} />
              <text className={cls.ringWords} style={{ fontSize: `${size.toFixed(1)}px` }}>
                <textPath href={`#ring-${k}`} startOffset="50%" textAnchor="middle">
                  {on[0]?.distance && <tspan className={cls.ringLabel}>{on[0].distance.toUpperCase()}</tspan>}
                  {on.map((p) => (
                    <Fragment key={p.name}>
                      <tspan className={cls.ringDot}>{'  ·  '}</tspan>
                      <tspan className={cls.placeOn} data-on={p.name === current.name ? '' : undefined}>
                        {p.name}
                      </tspan>
                    </Fragment>
                  ))}
                </textPath>
              </text>
            </g>
          );
        })}
        <circle r="6" className={cls.hereDot} />
        <circle r="16" className={cls.hereHalo} />
      </svg>
      <p className={cls.hereName}>{here}</p>
      <ul className={cls.placeList}>
        {order.map((p, n) => (
          <li key={p.name}>
            <button
              type="button"
              aria-pressed={n === (shown ?? at)}
              onClick={() => {
                stop();
                setAt(n);
              }}
            >
              {p.name}
            </button>
          </li>
        ))}
      </ul>
      <div className={cls.placeCard} aria-live="polite">
        <p className={cls.placeName}>{current.name}</p>
        {current.distance && <p className={cls.placeFar}>{current.distance}</p>}
        {current.note && <p className={cls.placeNote}>{current.note}</p>}
      </div>
      <p className={cls.ringKey}>The rings put the places in order of distance. They are not to scale.</p>
    </div>
  );
}
