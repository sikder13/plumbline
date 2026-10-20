'use client';

import { useEffect, useState } from 'react';

/** Monday first. Each day lists its windows as ["08:00", "10:00"] pairs, in New Zealand time. */
export type Week = [string, string][][];

const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const say = (t: string) => {
  const m = mins(t);
  const h = Math.floor(m / 60);
  return `${((h + 11) % 12) + 1}${m % 60 ? `:${String(m % 60).padStart(2, '0')}` : ''}${h >= 12 ? 'pm' : 'am'}`;
};
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Whether drop-off and collection is open right now in New Zealand, and when it opens next. */
export function Windows({ week, fallback, className }: { week: Week; fallback: string; className?: string }) {
  const [line, setLine] = useState(fallback);
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    const tick = () => {
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en-NZ', { timeZone: 'Pacific/Auckland', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date()).map((p) => [p.type, p.value]));
      const today = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(String(parts.weekday));
      const now = Number(parts.hour) * 60 + Number(parts.minute);
      const here = (week[today] ?? []).find(([a, b]) => now >= mins(a) && now < mins(b));
      if (here) {
        setOpen(true);
        setLine(`Drop-off and collection open now, until ${say(here[1])}`);
        return;
      }
      setOpen(false);
      for (let i = 0; i < 8; i++) {
        const k = (today + i) % 7;
        const next = (week[k] ?? []).find(([a]) => i > 0 || mins(a) > now);
        if (next) {
          setLine(`Next drop-off and collection: ${i === 0 ? 'today' : i === 1 ? 'tomorrow' : DAYS[k]} at ${say(next[0])}`);
          return;
        }
      }
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [week]);
  return (
    <span className={className} data-open={open === null ? undefined : open ? 'yes' : 'no'}>
      {line}
    </span>
  );
}
