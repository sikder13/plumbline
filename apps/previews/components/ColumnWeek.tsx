'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { clock, indianaNow, span, toMinutes, type Day } from './os/hours';

/**
 * The published week as seven columns, each a day of 24 hours from midnight to midnight. A column is
 * filled for the hours the business is open, and today carries a line at the Indiana time now. The
 * columns fill once, in turn, when the week first comes into view.
 */
export function ColumnWeek({ week, s }: { week: Day[]; s: Record<string, string> }) {
  const root = useRef<HTMLOListElement>(null);
  const [now, setNow] = useState<{ weekday: number; minutes: number } | null>(null);

  useEffect(() => {
    const tick = () => setNow(indianaNow());
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.setAttribute('data-waiting', '');
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        el.setAttribute('data-filled', '');
        io.disconnect();
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const hh = now ? `${Math.floor(now.minutes / 60)}:${String(now.minutes % 60).padStart(2, '0')}` : '';
  return (
    <ol className={s.week} ref={root}>
      {week.map((d, i) => {
        const today = now?.weekday === i;
        const from = d.open ? toMinutes(d.open) / 1440 : 0;
        const to = d.close ? toMinutes(d.close) / 1440 : 0;
        return (
          <li key={d.day} data-today={today ? '' : undefined} data-closed={d.open ? undefined : ''} style={{ '--i': i, '--from': from, '--to': to } as CSSProperties}>
            <span className={s.colDay}>
              <b>{d.day.slice(0, 3)}</b>
              <span>{d.day.slice(3)}</span>
            </span>
            <span className={s.colBar} aria-hidden="true">
              <i className={s.colFill} />
              {today && now && <i className={s.colNow} style={{ '--at': now.minutes / 1440 } as CSSProperties} data-time={clock(hh)} />}
            </span>
            <span className={s.colHours}>{span(d)}</span>
            {today && <span className={s.colToday}>Today</span>}
          </li>
        );
      })}
    </ol>
  );
}
