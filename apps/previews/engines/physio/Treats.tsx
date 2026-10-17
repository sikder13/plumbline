'use client';

import { useState } from 'react';
import { useShowOnce } from '../useShowOnce';

type Area = 'head' | 'neck' | 'shoulder' | 'back' | 'hip' | 'knee' | 'ankle' | 'hand' | 'whole';

/** Where each part of the body is marked on the figure. */
const SPOTS: Record<Area, [number, number][]> = {
  head: [[100, 34]],
  neck: [[100, 62]],
  shoulder: [
    [70, 80],
    [130, 80],
  ],
  back: [[100, 138]],
  hip: [
    [84, 176],
    [116, 176],
  ],
  knee: [
    [86, 252],
    [114, 252],
  ],
  ankle: [
    [87, 322],
    [113, 322],
  ],
  hand: [
    [50, 182],
    [150, 182],
  ],
  whole: [],
};

/**
 * "What we treat": the conditions they name, found on a figure. Each one they list is marked where
 * it is, and choosing one, on the figure or in the list, shows the others they treat in the same
 * place. Nothing is marked that they do not name. On first view the marks light in turn.
 */
export function Treats({ areas, cls }: { areas: { area: Area; name: string }[]; cls: Record<string, string> }) {
  const [at, setAt] = useState(0);
  const { ref, shown, stop } = useShowOnce<HTMLDivElement>(areas.length, { every: 380, rest: 0 });
  const i = shown ?? at;
  const current = areas[i]!;
  const same = areas.filter((a) => a.area === current.area);
  const marked = [...new Set(areas.map((a) => a.area))];
  return (
    <div ref={ref} className={cls.treats}>
      <div className={cls.figureBox}>
        <svg className={cls.figure} viewBox="0 0 200 360" aria-hidden="true" focusable="false" data-whole={current.area === 'whole' ? '' : undefined}>
          <g className={cls.body}>
            <circle cx="100" cy="34" r="20" />
            <path d="M100 56v12M70 76q30-10 60 0l-4 92q-26 12-52 0zM70 80q-14 44-20 100M130 80q14 44 20 100M84 172l2 80-1 74M116 172l-2 80 1 74M80 330h12M108 330h12" />
          </g>
          {marked.map((area) =>
            SPOTS[area].map(([x, y]) => (
              <g key={`${area}-${x}`} transform={`translate(${x} ${y})`} className={cls.spot} data-on={area === current.area ? '' : undefined}>
                <circle r="13" className={cls.spotHalo} />
                <circle r="5.5" />
              </g>
            )),
          )}
        </svg>
      </div>
      <div className={cls.treatWords}>
        <ul className={cls.treatList} aria-label="Conditions">
          {areas.map((a, n) => (
            <li key={a.name}>
              <button
                type="button"
                aria-pressed={n === i}
                onClick={() => {
                  stop();
                  setAt(n);
                }}
              >
                {a.name}
              </button>
            </li>
          ))}
        </ul>
        <div className={cls.treatCard} aria-live="polite">
          <p className={cls.treatName}>{current.name}</p>
          {same.length > 1 && (
            <p className={cls.treatAlso}>
              Also treated here: {same.filter((a) => a.name !== current.name).map((a) => a.name).join(', ')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
