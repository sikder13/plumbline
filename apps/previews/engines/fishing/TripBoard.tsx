'use client';

import { useState, type CSSProperties } from 'react';
import { useShowOnce } from '../useShowOnce';

interface Trip {
  name: string;
  target?: string;
  duration?: string;
  departs?: string;
  price?: string;
  group?: string;
  bar?: number;
  href: string;
  ask: string;
  external: boolean;
}

/**
 * Their trips as a board: each row a trip with what it targets and its price, a bar drawn from a
 * figure they state, and, opened, the details and the way to book it. On first view the rows open
 * one after another, then the first stays open.
 */
export function TripBoard({ trips, barOf, cls }: { trips: Trip[]; barOf: 'price' | 'length' | null; cls: Record<string, string> }) {
  const [open, setOpen] = useState(0);
  const { ref, shown, stop } = useShowOnce<HTMLDivElement>(trips.length, { every: 440, rest: 0 });
  const active = shown ?? open;
  const max = Math.max(0, ...trips.map((t) => t.bar ?? 0));
  return (
    <div ref={ref}>
      {max > 0 && barOf && (
        <p className={cls.barKey} aria-hidden="true">
          {barOf === 'price' ? 'Bars follow the price' : 'Bars follow the length of the trip'}
        </p>
      )}
      <ol className={cls.trips}>
        {trips.map((t, i) => {
          const on = i === active;
          return (
            <li key={`${t.name}-${t.target ?? i}`} className={cls.trip} data-on={on ? '' : undefined} style={{ '--i': i } as CSSProperties}>
              <button
                type="button"
                className={cls.tripHead}
                aria-expanded={on}
                aria-controls={`trip-${i}`}
                onClick={() => {
                  stop();
                  setOpen(i);
                }}
              >
                <span className={cls.tripName}>{t.name}</span>
                {t.target && <span className={cls.tripTarget}>{t.target}</span>}
                {t.price && <span className={cls.tripPrice}>{t.price}</span>}
                {max > 0 && t.bar && (
                  <span className={cls.tripBar} style={{ '--w': (t.bar / max).toFixed(3) } as CSSProperties} aria-hidden="true">
                    <i />
                  </span>
                )}
              </button>
              <div id={`trip-${i}`} className={cls.tripMore} hidden={!on}>
                {(t.duration || t.departs || t.group) && (
                  <dl className={cls.tripFacts}>
                    {t.duration && (
                      <div>
                        <dt>Length</dt>
                        <dd>{t.duration}</dd>
                      </div>
                    )}
                    {t.departs && (
                      <div>
                        <dt>Leaves</dt>
                        <dd>{t.departs}</dd>
                      </div>
                    )}
                    {t.group && (
                      <div>
                        <dt>Group</dt>
                        <dd>{t.group}</dd>
                      </div>
                    )}
                  </dl>
                )}
                <a className={cls.tripAsk} href={t.href} rel={t.external ? 'noopener' : undefined} data-press>
                  {t.ask}
                </a>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
