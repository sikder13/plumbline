'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

/** Runs `fn` once the browser has nothing more pressing to do, or after two seconds at the latest. */
function whenIdle(fn: () => void): () => void {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(fn, { timeout: 2000 });
    return () => w.cancelIdleCallback?.(id);
  }
  const t = window.setTimeout(fn, 300);
  return () => window.clearTimeout(t);
}

/**
 * A block that marks itself `data-seen` the first time a good part of it comes into view, so its
 * styles can play an entrance once. Before the scripts arrive, and with reduced motion asked for,
 * it is marked at once and everything simply shows.
 */
export function EarshotSeen({ children, className, style, amount = 0.3, as = 'div' }: { children: ReactNode; className?: string; style?: CSSProperties; amount?: number; as?: 'div' | 'ul' }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let io: IntersectionObserver | undefined;
    // Nothing is measured while the page loads: once the browser is idle, what is already on screen shows and the rest waits to be seen.
    const cancel = whenIdle(() => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || el.getBoundingClientRect().top < window.innerHeight * 0.85) {
        el.setAttribute('data-seen', '');
        return;
      }
      el.setAttribute('data-wait', '');
      io = new IntersectionObserver(
        ([e]) => {
          if (!e?.isIntersecting) return;
          el.setAttribute('data-seen', '');
          io?.disconnect();
        },
        { threshold: amount },
      );
      io.observe(el);
    });
    return () => {
      cancel();
      io?.disconnect();
    };
  }, [amount]);

  const Tag = as;
  return (
    <Tag ref={ref as never} className={className} style={style}>
      {children}
    </Tag>
  );
}
