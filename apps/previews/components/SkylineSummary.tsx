'use client';

import { useEffect, useState } from 'react';

export interface SummaryTrip {
  name: string;
  price?: { value: string; label: string };
  /** One entry a month: 1 runs, 2 runs on some dates, 0 does not run. */
  months: number[];
  note?: string;
}

type Cls = Record<'summary' | 'sumLabel' | 'sumTrip' | 'sumWhen' | 'sumPrice' | 'sumGo', string | undefined>;

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * The visitor's day so far, following them down the page: the way they chose above, the month they
 * read on the weather chart and that trip's own price, beside the real booking link. Where the trip
 * does not run in that month, it says so instead of a price.
 */
export function SkylineSummary({ trips, months, label, notRuns, book, cls }: { trips: SummaryTrip[]; months: string[]; label: string; notRuns: string; book: { label: string; href: string }; cls: Cls }) {
  const [trip, setTrip] = useState(0);
  const [month, setMonth] = useState(0);

  useEffect(() => {
    setMonth(new Date().getMonth());
    const onWay = (e: Event) => setTrip(Number((e as CustomEvent).detail) || 0);
    const onMonth = (e: Event) => setMonth(Number((e as CustomEvent).detail) || 0);
    window.addEventListener('skyline:way', onWay);
    window.addEventListener('skyline:month', onMonth);
    return () => {
      window.removeEventListener('skyline:way', onWay);
      window.removeEventListener('skyline:month', onMonth);
    };
  }, []);

  const t = trips[trip] ?? trips[0]!;
  const runs = t.months[month] ?? 1;

  return (
    <aside className={cls.summary} aria-label={label}>
      <p className={cls.sumLabel}>{label}</p>
      <p className={cls.sumTrip} key={`t${trip}`}>
        {t.name}
      </p>
      <p className={cls.sumWhen} key={`m${trip}-${month}`}>
        {months[month]}
        {runs === 0 ? (
          <span className={cls.sumPrice}>{notRuns}</span>
        ) : runs === 2 && t.note ? (
          <span className={cls.sumPrice}>{t.note}</span>
        ) : (
          t.price && (
            <span className={cls.sumPrice}>
              <b>{t.price.value}</b> {t.price.label}
            </span>
          )
        )}
      </p>
      <a className={cls.sumGo} href={book.href} rel="noopener" data-press>
        {book.label}
        <Arrow />
      </a>
    </aside>
  );
}
