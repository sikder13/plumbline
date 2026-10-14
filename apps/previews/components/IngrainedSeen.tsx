'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Marks its box `data-seen` once a good part of it has come into view, so its styles can draw what
 * is inside. Only a box still below the screen when the page loads is held back (`data-armed`);
 * one already in view, or any box with reduced motion asked for, simply shows.
 */
export function IngrainedSeen({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'figure' | 'ul' }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || el.getBoundingClientRect().top < window.innerHeight * 0.85) {
      el.setAttribute('data-seen', '');
      return;
    }
    el.setAttribute('data-armed', '');
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        el.setAttribute('data-seen', '');
        io.disconnect();
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const Tag = as;
  return (
    <Tag ref={ref as never} className={className}>
      {children}
    </Tag>
  );
}
