'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * A frame that marks itself `data-seen` the first time enough of it comes into view, so its styles can
 * play a change once: a haze lifting, a boat coming in to its berth. With reduced motion asked for it
 * is marked at once, and every state simply shows.
 */
export function WakeSeen({ className, children, amount = 0.35 }: { className?: string; children: ReactNode; amount?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.setAttribute('data-seen', '');
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        el.setAttribute('data-seen', '');
        io.disconnect();
      },
      { threshold: amount },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [amount]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
