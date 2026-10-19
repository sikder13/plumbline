'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { clock, indianaNow, toMinutes } from './os/hours';

/**
 * A day of 24 hours with their published hours filled, and a marker at the time in Indiana now. Every
 * mark is a fact: the span is their hours, the marker is the clock.
 */
export function MowDay({ open, close, days, s }: { open: string; close: string; days: string; s: Record<string, string> }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(indianaNow().minutes);
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);
  const a = toMinutes(open);
  const b = toMinutes(close);
  const isOpen = now !== null && now >= a && now < b;
  const line = now === null ? `${days}, ${clock(open)} to ${clock(close)}` : isOpen ? `Open now until ${clock(close)}` : now < a ? `Opens today at ${clock(open)}` : `Opens tomorrow at ${clock(open)}`;
  const pct = (m: number) => `${(m / 1440) * 100}%`;
  return (
    <div className={s.day}>
      <p className={s.dayLine} data-open={now === null ? undefined : isOpen ? 'yes' : 'no'}>
        {line}
      </p>
      <div className={s.dayTrack} aria-hidden="true">
        <i className={s.daySpan} style={{ left: pct(a), width: pct(b - a) } as CSSProperties} />
        {now !== null && <i className={s.dayNow} style={{ left: pct(now) } as CSSProperties} />}
        {[0, 6 * 60, 12 * 60, 18 * 60, 23 * 60].map((m) => (
          <span key={m} className={s.dayTick} style={{ left: pct(m) } as CSSProperties} data-edge={m === a || m === b ? '' : undefined}>
            {m === 0 ? '12 AM' : clock(`${Math.floor(m / 60)}:00`)}
          </span>
        ))}
      </div>
      <p className={s.dayPlain}>
        {days}: {clock(open)} to {clock(close)}
      </p>
    </div>
  );
}
