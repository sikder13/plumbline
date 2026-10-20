'use client';

import { useState, type CSSProperties } from 'react';

export interface Place {
  name: string;
  walk?: number;
  drive?: number;
}

/** How far each place is, on foot or by car, in the minutes the business publishes, drawn to one scale. */
export function Minutes({ places, s }: { places: Place[]; s: Record<string, string> }) {
  const [mode, setMode] = useState<'walk' | 'drive'>('walk');
  const most = Math.max(...places.flatMap((p) => [p.walk ?? 0, p.drive ?? 0]));
  return (
    <div className={s.minutes}>
      <div className={s.modes} role="group" aria-label="On foot or by car">
        <button type="button" className={s.mode} aria-pressed={mode === 'walk'} onClick={() => setMode('walk')}>
          On foot
        </button>
        <button type="button" className={s.mode} aria-pressed={mode === 'drive'} onClick={() => setMode('drive')}>
          By car
        </button>
      </div>
      <ol className={s.places}>
        {places.map((p) => {
          const m = p[mode];
          return (
            <li key={p.name} className={s.place} data-has={m ? 'yes' : 'no'}>
              <span className={s.placeName}>{p.name}</span>
              <span className={s.track} aria-hidden="true">
                <span className={s.fill} style={{ '--w': m ? m / most : 0 } as CSSProperties} />
              </span>
              <span className={s.placeTime}>{m ? `${m} min` : mode === 'walk' ? 'by car' : 'on foot'}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
