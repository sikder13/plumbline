'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Holds something apart until the visitor first scrolls, then marks it `data-gathered` so the design can
 * bring its pieces together. With reduced motion asked for it is marked at once.
 */
export function SunpathGather({ children, className }: { children: ReactNode; className?: string }) {
  const box = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const gather = () => el.setAttribute('data-gathered', '');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.scrollY > 40) {
      gather();
      return;
    }
    window.addEventListener('scroll', gather, { once: true, passive: true });
    return () => window.removeEventListener('scroll', gather);
  }, []);

  return (
    <span ref={box} className={className}>
      {children}
    </span>
  );
}
