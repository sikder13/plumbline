'use client';

import { useEffect, useRef, type CSSProperties } from 'react';

/**
 * A sentence that fills word by word as it moves up the screen: each word is told its place as `--i`,
 * the sentence its length as `--n`, and how far it has been read as `--fill`, from 0 to 1. Before the
 * scripts arrive, and with reduced motion asked for, `--fill` stays at 1, so every word shows.
 */
export function SettleRead({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    void import('motion').then(({ scroll }) => {
      if (cancelled) return;
      stop = scroll((p: number) => el.style.setProperty('--fill', p.toFixed(3)), { target: el, offset: ['start 0.9', 'end 0.5'] });
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  const words = text.split(' ');
  return (
    <p ref={ref} className={className} style={{ '--fill': 1, '--n': words.length } as CSSProperties}>
      {words.map((w, i) => (
        <span key={i} style={{ '--i': i } as CSSProperties}>
          {w}{' '}
        </span>
      ))}
    </p>
  );
}
