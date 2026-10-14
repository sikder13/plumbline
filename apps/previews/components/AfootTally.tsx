'use client';

import { useEffect, useRef, type CSSProperties } from 'react';

/**
 * A field of small marks, one for each of a number of things a business counts, that fill one after
 * another when the field comes into view. Without the script, or with reduced motion asked for, every
 * mark simply shows filled. The marks are decoration: the number itself is said in words beside them.
 */
export function AfootTally({ count, className }: { count: number; className?: string }) {
  const field = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = field.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // A field already on screen is left filled; one further down waits to fill until it is reached.
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    el.setAttribute('data-armed', '');
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        el.setAttribute('data-lit', '');
        io.disconnect();
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <span ref={field} className={className} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <i key={i} style={{ '--i': i } as CSSProperties} />
      ))}
    </span>
  );
}
