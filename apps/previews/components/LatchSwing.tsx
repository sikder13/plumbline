'use client';

import { useEffect } from 'react';

/**
 * Gates that swing open as the visitor reaches them. Anything marked `data-latch` is drawn open
 * by default, so without this component, or with reduced motion asked for, every gate simply
 * stands open. Once the browser is idle, the ones still below the screen are shut, and each
 * swings open as it comes into view.
 */
export function LatchSwing() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let io: IntersectionObserver | undefined;
    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      const gates = [...document.querySelectorAll<HTMLElement>('[data-latch]')];
      const edge = window.innerHeight * 0.95;
      // Everything is measured first and changed afterwards, so the page is laid out once.
      const waiting = gates.filter((el) => el.getBoundingClientRect().top > edge);
      if (!waiting.length) return;
      for (const el of waiting) el.dataset.latch = 'shut';
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            (e.target as HTMLElement).dataset.latch = 'open';
            io?.unobserve(e.target);
          }
        },
        { rootMargin: '0px 0px -24% 0px' },
      );
      for (const el of waiting) io.observe(el);
    };
    // Safari has no idle callback, so a short wait stands in for it there.
    const idle = 'requestIdleCallback' in window;
    const handle = idle ? window.requestIdleCallback(start, { timeout: 2000 }) : window.setTimeout(start, 600);
    return () => {
      cancelled = true;
      if (idle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
      io?.disconnect();
    };
  }, []);
  return null;
}
