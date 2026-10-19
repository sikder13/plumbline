'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * A glass case of shelves that slide past in opposite directions as the page scrolls through it, so the
 * case seems to move by. Only on wide screens with motion allowed; on a phone each shelf is a swipe row.
 */
export function ShelfCase({ children, className }: { children: ReactNode; className: string }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = el.current;
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !window.matchMedia('(min-width: 900px)').matches) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = root.getBoundingClientRect();
      const k = Math.min(1, Math.max(0, (window.innerHeight - r.top) / (window.innerHeight + r.height)));
      root.style.setProperty('--slide', (k - 0.5).toFixed(3));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div className={className} ref={el}>
      {children}
    </div>
  );
}
