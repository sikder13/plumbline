'use client';

import { useEffect, useState } from 'react';

/**
 * The season the business states, as a small tag. Once the page knows today's month in New Zealand
 * it lights the tag when the month is inside the season, and says when it comes back when it is not.
 */
export function PourSeason({ text, label, open, on, off, className, cls }: { text: string; label: string; open: number[]; on: string; off: string; className?: string; cls: { dot?: string; state?: string } }) {
  const [inSeason, setInSeason] = useState<boolean | null>(null);

  useEffect(() => {
    const month = Number(new Intl.DateTimeFormat('en-NZ', { timeZone: 'Pacific/Auckland', month: 'numeric' }).format(new Date()));
    setInSeason(open.includes(month));
  }, [open]);

  return (
    <p className={className} data-season={inSeason === null ? 'unknown' : inSeason ? 'on' : 'off'} title={label}>
      <i className={cls.dot} aria-hidden="true" />
      <b className={cls.state}>{inSeason === false ? off : on}</b>
      <span>{text}</span>
    </p>
  );
}
