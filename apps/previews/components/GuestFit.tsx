'use client';

import { useState } from 'react';

export interface FitUnit {
  name: string;
  sleeps: number;
  count?: string;
  text: string;
}

/**
 * How many are coming, and which units sleep that many, from the numbers the business publishes. A
 * stepper from 1 to the largest unit; units that fit stay lit, the rest step back. Nothing is booked here.
 */
export function GuestFit({ units, book, s }: { units: FitUnit[]; book: string; s: Record<string, string> }) {
  const most = Math.max(...units.map((u) => u.sleeps));
  const [n, setN] = useState(2);
  const fit = units.filter((u) => u.sleeps >= n).length;
  return (
    <div className={s.fit}>
      <div className={s.stepper} role="group" aria-label="Guests">
        <button type="button" className={s.step} onClick={() => setN((v) => Math.max(1, v - 1))} disabled={n <= 1} aria-label="One fewer guest" data-dir="down" />
        <p className={s.count} aria-live="polite">
          <span className={s.countN}>{n}</span> {n === 1 ? 'guest' : 'guests'}
        </p>
        <button type="button" className={s.step} onClick={() => setN((v) => Math.min(most, v + 1))} disabled={n >= most} aria-label="One more guest" data-dir="up" />
      </div>
      <p className={s.fitLine}>
        {fit} of our {units.length} kinds of unit {fit === 1 ? 'sleeps' : 'sleep'} {n}.
      </p>
      <ul className={s.fitList}>
        {units.map((u) => (
          <li key={`${u.name}${u.sleeps}`} className={s.fitUnit} data-fits={u.sleeps >= n ? 'yes' : 'no'}>
            <span className={s.fitSleeps}>Sleeps {u.sleeps}</span>
            <span className={s.fitName}>
              {u.name}
              {u.count ? <span className={s.fitCount}> {u.count}</span> : null}
            </span>
            <span className={s.fitText}>{u.text}</span>
          </li>
        ))}
      </ul>
      <a className={s.fitBook} href={book} data-press>
        Check dates for {n} {n === 1 ? 'guest' : 'guests'}
      </a>
    </div>
  );
}
