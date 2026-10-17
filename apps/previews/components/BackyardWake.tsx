'use client';

import { useEffect } from 'react';

/** Runs `run` once the browser has nothing better to do, so nothing here competes with the page loading. */
function whenIdle(run: () => void): () => void {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(run, { timeout: 4000 });
    return () => w.cancelIdleCallback?.(id);
  }
  const t = window.setTimeout(run, 1500);
  return () => window.clearTimeout(t);
}

/**
 * Marks each section with `data-wake` as awake once it comes within a screen or so of the visitor. A design
 * keeps the face that only those sections use (a handwriting) and their idle motion off until then, so the
 * browser neither fetches nor animates them while the first screen is still loading.
 */
export function BackyardWake() {
  useEffect(() => {
    let io: IntersectionObserver | undefined;
    const cancel = whenIdle(() => {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            (e.target as HTMLElement).setAttribute('data-awake', '');
            io!.unobserve(e.target);
          }
        },
        { rootMargin: '360px 0px' },
      );
      for (const el of document.querySelectorAll<HTMLElement>('[data-wake]')) io.observe(el);
    });
    return () => {
      cancel();
      io?.disconnect();
    };
  }, []);
  return null;
}
