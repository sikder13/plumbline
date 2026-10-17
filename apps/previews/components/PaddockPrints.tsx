'use client';

import { useState, type ReactNode } from 'react';

/**
 * A small fan of photographic prints. The one on top is the opening photograph; a tap or a click
 * tosses it to the back of the fan, so the next one comes forward. Each print carries its place in
 * the fan as `data-print` (0 on top), and the one just tossed carries `data-tossed`, for the design
 * to move as it likes. Before the scripts arrive, the fan simply shows.
 */
export function PaddockPrints({ prints, label, className }: { prints: ReactNode[]; label: string; className?: string }) {
  const [top, setTop] = useState(0);
  const [tossed, setTossed] = useState<number | null>(null);
  const n = prints.length;

  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      onClick={() => {
        setTossed(top);
        setTop((t) => (t + 1) % n);
      }}
    >
      {prints.map((p, i) => (
        <span key={i} data-print={(i - top + n) % n} data-tossed={tossed === i ? '' : undefined}>
          {p}
        </span>
      ))}
    </button>
  );
}
