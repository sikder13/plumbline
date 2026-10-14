'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

/**
 * Plays a part of the page once, when it comes into view. The part is marked `data-armed` while it
 * waits below the screen and `data-go` once seen; what those look like is left to the design's styles.
 * Anything already on screen when the page loads, anything without the script, and everything when
 * reduced motion is asked for, simply shows.
 */
export function SpinCue({ children, className, as = 'div', amount = 0.35, id, labelledBy, style }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'p'; amount?: number; id?: string; labelledBy?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.85) return;
    el.setAttribute('data-armed', '');
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        el.setAttribute('data-go', '');
      },
      { threshold: amount },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [amount]);

  const Tag = as;
  return (
    <Tag ref={ref as never} className={className} id={id} aria-labelledby={labelledBy} style={style}>
      {children}
    </Tag>
  );
}
