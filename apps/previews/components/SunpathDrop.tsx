'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * A pile that falls into place. When the box is still below the screen once the page has loaded, it is
 * marked `data-armed` (the design lifts its blocks out of sight), and as it comes into
 * view it is marked `data-in` so they drop, one after another, and pack into place.
 * Before the script arrives, or with reduced motion asked for, the pile simply shows.
 */
export function SunpathDrop({ children, className }: { children: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const undo: (() => void)[] = [];

    if (el.getBoundingClientRect().top > window.innerHeight * 0.9) {
      el.setAttribute('data-armed', '');
      const io = new IntersectionObserver(
        ([e]) => {
          if (!e?.isIntersecting) return;
          el.setAttribute('data-in', '');
          io.disconnect();
        },
        { threshold: 0.3 },
      );
      io.observe(el);
      undo.push(() => io.disconnect());
    }

    return () => {
      for (const u of undo) u();
    };
  }, []);

  return (
    <div ref={box} className={className}>
      {children}
    </div>
  );
}
