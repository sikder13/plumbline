'use client';

import { useState, type CSSProperties } from 'react';
import { useShowOnce } from '../useShowOnce';

interface Place {
  name: string;
  distance?: string;
  reach?: number;
  note?: string;
}

/**
 * What is around them, grouped by the distances they state, nearest first: a clean list on a
 * phone, and from 600 px a ring for each distance beside it, labelled level and in words. The rings
 * put the groups in order; they are not a scale. Choosing a distance lights its ring and its places.
 * On first view the distances light in turn.
 */
export function Around({ here, places, cls }: { here: string; places: Place[]; cls: Record<string, string> }) {
  const order = [...places].sort((a, b) => (a.reach ?? 0) - (b.reach ?? 0));
  const groups: { far: string; places: Place[] }[] = [];
  for (const p of order) {
    const far = p.distance ?? '';
    const g = groups.find((x) => x.far === far);
    if (g) g.places.push(p);
    else groups.push({ far, places: [p] });
  }
  const [at, setAt] = useState(0);
  const { ref, shown, stop } = useShowOnce<HTMLDivElement>(groups.length, { every: 520, rest: 0 });
  const i = shown ?? at;
  const radius = (k: number) => 40 + (k * 150) / Math.max(1, groups.length - 1);
  return (
    <div ref={ref} className={cls.around} style={{ '--n': groups.length } as CSSProperties}>
      <svg className={cls.rings} viewBox="-30 -210 420 260" aria-hidden="true" focusable="false">
        {groups.map((g, k) => (
          <g key={g.far} data-on={k === i ? '' : undefined}>
            <circle cx="0" cy="40" r={radius(k)} className={cls.ringLine} />
            <text x={radius(k) * 0.72 + 10} y={40 - radius(k) * 0.69} className={cls.ringLabel}>
              {g.far}
            </text>
          </g>
        ))}
        <circle cx="0" cy="40" r="6" className={cls.hereDot} />
      </svg>
      <div className={cls.aroundList}>
        <p className={cls.hereName}>From {here}</p>
        <ol className={cls.placeGroups}>
          {groups.map((g, k) => (
            <li key={g.far} data-on={k === i ? '' : undefined}>
              <button
                type="button"
                className={cls.groupHead}
                aria-pressed={k === i}
                onClick={() => {
                  stop();
                  setAt(k);
                }}
              >
                {g.far}
              </button>
              <ul className={cls.groupPlaces}>
                {g.places.map((p) => (
                  <li key={p.name}>
                    <span className={cls.placeName}>{p.name}</span>
                    {p.note && <span className={cls.placeNote}>{p.note}</span>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
        <p className={cls.ringKey}>Distances as they give them. The rings show the order, not the scale.</p>
      </div>
    </div>
  );
}
