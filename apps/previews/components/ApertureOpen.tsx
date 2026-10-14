'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * A window that opens from a line across its middle the first time it comes into view. It stays open
 * before the scripts arrive, when it is already on screen, and with reduced motion.
 */
export function ApertureOpen({ className, children, inline }: { className: string; children: ReactNode; inline?: boolean }) {
  const ref = useRef<HTMLDivElement & HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.85) return;
    el.setAttribute('data-shut', '');
    let stop: (() => void) | undefined;
    let cancelled = false;
    void import('motion').then(({ inView }) => {
      if (cancelled) return;
      stop = inView(el, () => void el.removeAttribute('data-shut'), { amount: 0.4 });
    });
    return () => {
      cancelled = true;
      stop?.();
      el.removeAttribute('data-shut');
    };
  }, []);

  const Tag = inline ? 'span' : 'div';
  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}
