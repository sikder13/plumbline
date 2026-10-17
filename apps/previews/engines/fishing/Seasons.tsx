'use client';

import { useState } from 'react';
import { useShowOnce } from '../useShowOnce';

interface Species {
  name: string;
  months?: number[];
  where?: string;
  note?: string;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * The fish they target through the year. Where they say which months, the months are a strip a
 * visitor can choose from, and the fish of that month stand out; on first view the strip runs
 * through the year once. Where they do not, each fish is a card with where and how, in their words.
 */
export function Seasons({ species, cls }: { species: Species[]; cls: Record<string, string> }) {
  const dated = species.filter((s) => s.months?.length);
  const grid = dated.length >= 2;
  const [month, setMonth] = useState<number | null>(null);
  const { ref, shown, stop } = useShowOnce<HTMLDivElement>(grid ? 12 : 0, { every: 190, rest: -1 });
  const current = shown !== null && shown >= 0 ? shown + 1 : month;

  if (!grid) {
    return (
      <ul className={cls.cards}>
        {species.map((s) => (
          <li key={s.name} className={cls.card} data-reveal>
            <h3>{s.name}</h3>
            {s.where && <p className={cls.cardWhere}>{s.where}</p>}
            {s.note && <p>{s.note}</p>}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div ref={ref} className={cls.grid}>
      <div className={cls.months} role="group" aria-label="Choose a month">
        {MONTHS.map((m, i) => (
          <button
            key={m}
            type="button"
            className={cls.month}
            aria-pressed={current === i + 1}
            aria-label={m}
            onClick={() => {
              stop();
              setMonth(month === i + 1 ? null : i + 1);
            }}
          >
            {m[0]}
          </button>
        ))}
      </div>
      <ul>
        {dated.map((s) => {
          const on = current !== null && s.months!.includes(current);
          return (
            <li key={s.name} className={cls.row} data-on={on ? '' : undefined} data-dim={current !== null && !on ? '' : undefined}>
              <span className={cls.speciesName}>{s.name}</span>
              <span className={cls.cell} aria-label={`${s.name}: ${s.months!.map((n) => MONTHS[n - 1]).join(', ')}`}>
                {MONTHS.map((m, i) => (
                  <i key={m} data-in={s.months!.includes(i + 1) ? '' : undefined} data-now={current === i + 1 ? '' : undefined} />
                ))}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
