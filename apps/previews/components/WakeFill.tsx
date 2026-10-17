'use client';

import { useEffect, useRef, type CSSProperties } from 'react';

/**
 * A line that fills word by word as it is read: each word darkens as the reader scrolls it past the
 * middle of the screen. The progress is carried as `--f`, from 0 to 1, and each word knows its place
 * as `--i`. Before the script arrives, or with reduced motion asked for, the line is simply whole.
 */
export function WakeFill({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const words = text.split(' ');
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    void import('motion').then(({ scroll }) => {
      if (cancelled) return;
      stop = scroll((p: number) => el.style.setProperty('--f', p.toFixed(3)), { target: el, offset: ['start 0.92', 'end 0.5'] });
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);
  return (
    <p ref={ref} className={className} style={{ '--n': words.length } as CSSProperties}>
      {words.map((w, i) => (
        <span key={i} style={{ '--i': i } as CSSProperties}>
          {w}{' '}
        </span>
      ))}
    </p>
  );
}
