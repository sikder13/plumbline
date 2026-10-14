'use client';

import { useEffect, useState } from 'react';
import { Kayak } from './LandingKayak';

interface Departure {
  months: number[];
  times: string[];
  season: string;
  special?: string;
}

/** The month it is in New Zealand, January as 0, without the cost of a time zone lookup: New Zealand is twelve hours ahead of UTC, thirteen in summer. */
function monthInNz(): number {
  const now = new Date();
  const m = now.getUTCMonth();
  return new Date(now.getTime() + (m >= 3 && m <= 8 ? 12 : 13) * 3600000).getUTCMonth();
}

/** Runs once the browser has a moment to spare. */
function whenIdle(run: () => void): () => void {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(run, { timeout: 2500 });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(run, 300);
  return () => window.clearTimeout(id);
}

/**
 * The departures from the beach for the month the visitor is in, in New Zealand, worked out from the
 * times the business publishes for each part of the year. Shown first for the month the page was made.
 */
export function LandingDeparts({ label, and, sets, startMonth, className }: { label: string; and: string; sets: Departure[]; startMonth: number; className: string | undefined }) {
  const [month, setMonth] = useState(startMonth);

  useEffect(() => whenIdle(() => setMonth(monthInNz())), []);

  const now = sets.filter((s) => s.months.includes(month));
  const regular = now.find((s) => !s.special);
  const special = now.find((s) => s.special);
  if (!regular) return null;
  return (
    <p className={className}>
      <Kayak />
      <b>{regular.times.join(` ${and} `)}</b>
      <small>
        {label}, {regular.season}
      </small>
      {special && (
        <small>
          {special.special} {special.times.join(` ${and} `)}
        </small>
      )}
    </p>
  );
}
