'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

/**
 * A wall of photographs whose columns drift against each other as it passes through the screen.
 * It sets `--t` from -1 (the wall entering at the bottom) to 1 (leaving at the top); the styles
 * decide which columns move and how far. With reduced motion asked for, it stays still.
 */
export function IngrainedWall({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    void import('motion').then(({ scroll }) => {
      if (cancelled) return;
      stop = scroll((p: number) => el.style.setProperty('--t', (p * 2 - 1).toFixed(4)), { target: el, offset: ['start end', 'end start'] });
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);
  return (
    <div ref={ref} className={className} style={{ '--t': -1 } as CSSProperties}>
      {children}
    </div>
  );
}
