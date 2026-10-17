'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

export interface Month {
  name: string;
  short: string;
  season: string;
  temp: string;
  low: number;
  high: number;
  note?: string;
}

export interface YearTrip {
  key: string;
  name: string;
  /** One entry a month: 1 runs, 2 runs on some dates, 0 does not run. */
  months: number[];
  note?: string;
}

type Cls = Record<'year' | 'plot' | 'yearLine' | 'months' | 'month' | 'range' | 'monthName' | 'trips' | 'tripNames' | 'cursor' | 'read' | 'readName' | 'readSeason' | 'readNote' | 'runs' | 'runLabel', string | undefined>;

/** Where each trip's line runs across the chart, as a share of its height. */
const rowY = (i: number) => 48 + i * 14;

/** The stretches of the year a trip runs, as x positions from 0 to 100. A month run on some dates only starts half way through. */
function runs(months: number[]): [number, number][] {
  const n = months.length;
  const out: [number, number][] = [];
  let start = -1;
  months.forEach((v, i) => {
    if (v && start < 0) start = v === 2 ? i + 0.5 : i;
    if ((!v || i === n - 1) && start >= 0) {
      const end = v ? i + 1 : i;
      out.push([(start / n) * 100, (end / n) * 100]);
      start = -1;
    }
  });
  return out;
}

/**
 * A year in one chart: each month's average daytime temperature as a bar from its low to its high,
 * joined into a line, with each trip drawn as a line across it in the months it runs. The visitor's
 * month is a cursor through the chart, and beside it the answer is written out. It sweeps the year
 * once when it comes into view and settles on the visitor's own month.
 */
export function SkylineYear({ months, trips, seasons, labels, cls }: { months: Month[]; trips: YearTrip[]; seasons: Record<string, string>; labels: { chart: string; runs: string; notRuns: string; unit: string }; cls: Cls }) {
  const [on, setOn] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const touched = useRef(false);
  const top = Math.max(...months.map((m) => m.high));

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const now = new Date().getMonth();
    const settle = () => {
      if (touched.current) return;
      setOn(now);
      window.dispatchEvent(new CustomEvent('skyline:month', { detail: now }));
    };
    setOn(now);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      settle();
      return;
    }
    const timers: number[] = [];
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        months.forEach((_, i) => timers.push(window.setTimeout(() => !touched.current && setOn(i), 260 + i * 120)));
        timers.push(window.setTimeout(settle, 260 + months.length * 120 + 220));
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [months]);

  const pick = (i: number) => {
    touched.current = true;
    setOn(i);
    window.dispatchEvent(new CustomEvent('skyline:month', { detail: i }));
  };

  const m = months[on]!;
  const n = months.length;
  const x = ((on + 0.5) / n) * 100;
  const line = months.map((mo, i) => `${i ? 'L' : 'M'}${(((i + 0.5) / n) * 100).toFixed(2)} ${((1 - (mo.low + mo.high) / 2 / top) * 100).toFixed(2)}`).join('');
  const side = on < n / 3 ? 'right' : on >= (2 * n) / 3 ? 'left' : 'mid';

  return (
    <div ref={root} className={cls.year}>
      <div className={cls.plot} style={{ '--x': `${x.toFixed(2)}%` } as CSSProperties}>
        <svg className={cls.yearLine} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <path d={`${line}L100 100L0 100Z`} />
          <path d={line} />
        </svg>

        <div className={cls.months} role="group" aria-label={labels.chart}>
          {months.map((mo, i) => (
            <button
              key={mo.name}
              type="button"
              className={cls.month}
              aria-pressed={i === on}
              aria-label={`${mo.name}, ${mo.temp}${labels.unit}`}
              onClick={() => pick(i)}
              style={{ '--lo': mo.low / top, '--hi': mo.high / top } as CSSProperties}
            >
              <span className={cls.range} aria-hidden="true" />
              <span className={cls.monthName} aria-hidden="true">
                {mo.short}
              </span>
            </button>
          ))}
        </div>

        <svg className={cls.trips} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          {trips.map((t, j) => (
            <g key={t.key} data-on={t.months[on] ? '' : undefined}>
              {runs(t.months).map(([a, b]) => (
                <path key={a} d={`M${a.toFixed(2)} ${rowY(j)}H${b.toFixed(2)}`} />
              ))}
            </g>
          ))}
        </svg>

        <ul className={cls.tripNames} aria-hidden="true">
          {trips.map((t, j) => (
            <li key={t.key} style={{ '--y': `${rowY(j)}%` } as CSSProperties}>
              {t.name}
            </li>
          ))}
        </ul>

        <span className={cls.cursor} aria-hidden="true">
          {trips.map((t, j) => (
            <i key={t.key} data-v={t.months[on] ?? 0} style={{ '--y': `${rowY(j)}%` } as CSSProperties} />
          ))}
        </span>

        <div className={cls.read} data-side={side} aria-live="polite">
          <p className={cls.readName}>
            {m.name}, {m.temp}
            {labels.unit}
          </p>
          <ul className={cls.runs}>
            {trips.map((t) => {
              const v = t.months[on] ?? 0;
              return (
                <li key={t.key} data-v={v}>
                  <b>{t.name}</b> <span className={cls.runLabel}>{v === 0 ? labels.notRuns : v === 2 && t.note ? t.note : labels.runs}</span>
                </li>
              );
            })}
          </ul>
          {m.note && <p className={cls.readNote}>{m.note}</p>}
        </div>
      </div>

      <p className={cls.readSeason}>{seasons[m.season]}</p>
    </div>
  );
}
