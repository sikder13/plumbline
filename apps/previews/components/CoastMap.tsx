'use client';

import { useState } from 'react';

interface Spot {
  id: string;
  x: number;
  y: number;
  side: string;
  name: string;
  tag: string;
  text: string;
}

interface Props {
  viewBox: string;
  land: string;
  islands: string[];
  spots: Spot[];
  className?: string;
}

/** A simple drawn coast with spots to tap. The panel beside it shows what the business says about each. */
export function CoastMap({ viewBox, land, islands, spots, className }: Props) {
  const [active, setActive] = useState(0);
  const [, , w, h] = viewBox.split(' ').map(Number) as [number, number, number, number];
  const spot = spots[active]!;
  return (
    <div className={className}>
      <div data-map style={{ aspectRatio: `${w} / ${h}` }}>
        <svg viewBox={viewBox} aria-hidden="true" focusable="false">
          <path data-land d={land} />
          {islands.map((d) => (
            <path key={d} data-island d={d} />
          ))}
        </svg>
        {spots.map((s, i) => (
          <button key={s.id} type="button" data-side={s.side} aria-pressed={i === active} aria-controls="coast-panel" onClick={() => setActive(i)} style={{ left: `${(s.x / w) * 100}%`, top: `${(s.y / h) * 100}%` }}>
            <i aria-hidden="true" />
            <span>{s.name}</span>
          </button>
        ))}
      </div>
      <div data-panel id="coast-panel" aria-live="polite">
        <p data-tag>{spot.tag}</p>
        <h3>{spot.name}</h3>
        <p>{spot.text}</p>
      </div>
    </div>
  );
}
