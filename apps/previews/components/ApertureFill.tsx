'use client';

import { useEffect, useRef, type CSSProperties } from 'react';

/**
 * Words that light one after another as the visitor reads down past them. The progress is set as
 * `--r` (0 to 1) on the wrapper; each word knows its place as `--i` of `--n`, and the design's styles
 * decide how a word looks before and after. Before the scripts arrive, and with reduced motion, every
 * word simply shows.
 */
export function ApertureFill({ text, cls }: { text: string; cls: { fill: string; word: string } }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    void import('motion').then(({ scroll }) => {
      if (cancelled) return;
      stop = scroll((p: number) => el.style.setProperty('--r', p.toFixed(3)), { target: el, offset: ['start 0.9', 'end 0.5'] });
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  const words = text.split(' ');
  return (
    <span ref={ref} className={cls.fill} style={{ '--n': words.length, '--r': 1 } as CSSProperties}>
      {words.map((w, i) => (
        <span key={i} className={cls.word} style={{ '--i': i } as CSSProperties}>
          {w}{' '}
        </span>
      ))}
    </span>
  );
}
