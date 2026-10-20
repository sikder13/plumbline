'use client';

import { useEffect, useState } from 'react';

export interface NzDay {
  day: string;
  /** "08:00" in 24 hour time, or null when closed. */
  open: string | null;
  close: string | null;
}

const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const say = (t: string) => {
  const m = mins(t);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${((h + 11) % 12) + 1}${mm ? `:${String(mm).padStart(2, '0')}` : ''}${h >= 12 ? 'pm' : 'am'}`;
};

/** Whether the business is open at this moment in New Zealand, from the hours it publishes. Until the page wakes it shows `fallback`. */
export function NzNow({ week, fallback, className }: { week: NzDay[]; fallback: string; className?: string }) {
  const [line, setLine] = useState(fallback);
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    const tick = () => {
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en-NZ', { timeZone: 'Pacific/Auckland', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date()).map((p) => [p.type, p.value]));
      const today = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(String(parts.weekday));
      const now = Number(parts.hour) * 60 + Number(parts.minute);
      const d = week[today];
      if (d?.open && d.close && now >= mins(d.open) && now < mins(d.close)) {
        setOpen(true);
        setLine(`Open now, until ${say(d.close)}`);
        return;
      }
      setOpen(false);
      for (let i = 0; i < 8; i++) {
        const k = (today + i) % 7;
        const n = week[k];
        if (!n?.open) continue;
        if (i === 0 && now >= mins(n.open)) continue;
        setLine(`Closed now. Opens ${i === 0 ? 'today' : i === 1 ? 'tomorrow' : n.day} at ${say(n.open)}`);
        return;
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
