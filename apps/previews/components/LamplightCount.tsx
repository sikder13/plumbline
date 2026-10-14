'use client';

import { useEffect, useRef } from 'react';

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * A plain count that climbs once, from where a business started to where it is now, when it comes into
 * view. The page is served with the true figure, and keeps it with reduced motion asked for, when the
 * count is already on screen at load, or before the scripts arrive.
 */
export function LamplightCount({ from, text, className }: { from: number; text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    const to = Number(text.replace(/,/g, ''));
    if (!el || !Number.isFinite(to) || !Number.isFinite(from)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    const grouped = text.includes(',');
    const show = (v: number) => {
      const n = Math.round(v);
      el.textContent = grouped ? n.toLocaleString('en-NZ') : String(n);
    };
    show(from);
    let cancelled = false;
    let stop: (() => void) | undefined;
    void import('motion').then(({ animate, inView }) => {
      if (cancelled) return;
      stop = inView(
        el,
        () => {
          stop?.();
          void animate(from, to, { duration: 1.9, ease: EASE, onUpdate: show, onComplete: () => void (el.textContent = text) });
        },
        { amount: 0.7 },
      );
    });
    return () => {
      cancelled = true;
      stop?.();
      el.textContent = text;
    };
  }, [from, text]);

  return (
    <span ref={ref} className={className}>
      {text}
    </span>
  );
}
