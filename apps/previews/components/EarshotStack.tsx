'use client';

import { useEffect, useRef, type ReactNode } from 'react';

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
 * Panels that stack: each holds at the top of the screen while the next slides up over it. A panel
 * taller than the screen holds only once its foot has come into view, so nothing in it is covered
 * before it has been read. It measures again when the window changes size.
 */
export function EarshotStack({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let ro: ResizeObserver | undefined;
    let fit = () => {};
    // Measured once the browser is idle, never while the page loads.
    const cancel = whenIdle(() => {
      const panels = [...el.querySelectorAll<HTMLElement>('[data-stack]')];
      fit = () => {
        const screen = window.innerHeight;
        const heights = panels.map((p) => p.offsetHeight);
        panels.forEach((p, i) => p.style.setProperty('--hold', `${Math.min(0, screen - heights[i]!)}px`));
      };
      fit();
      ro = new ResizeObserver(() => fit());
      for (const p of panels) ro.observe(p);
      window.addEventListener('resize', fit);
    });
    return () => {
      cancel();
      ro?.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
