'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { whenNear } from './FathomNear';

/**
 * Lines that fill word by word as the visitor reads down the page. The progress through the block
 * is held as `--p` (0 to 1) and each word carries its place as `--i`, so the colour of every word is
 * worked out by the design's styles and nothing is measured. Before the script arrives, or with
 * reduced motion asked for, every word stays readable.
 */
export function FathomFill({ lines, className }: { lines: string[]; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.style.setProperty('--p', '1');
      return;
    }
    // Set up only as the lines come near the screen, so the opening screen pays nothing for them.
    return whenNear(el, () => {
      let stop: (() => void) | undefined;
      let cancelled = false;
      void import('motion').then(({ scroll }) => {
        if (cancelled) return;
        stop = scroll((p: number) => el.style.setProperty('--p', p.toFixed(3)), { target: el, offset: ['start 82%', 'end 52%'] });
      });
      return () => {
        cancelled = true;
        stop?.();
      };
    });
  }, []);

  let at = 0;
  const total = lines.reduce((sum, l) => sum + l.split(' ').length, 0);
  return (
    <div ref={ref} className={className} data-fill style={{ '--n': total, '--p': 0 } as CSSProperties}>
      {lines.map((line) => (
        <p key={line}>
          {line.split(' ').map((word, i) => {
            const k = at++;
            return (
              <span key={`${word}-${i}`} style={{ '--i': k } as CSSProperties}>
                {word}{' '}
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
}
