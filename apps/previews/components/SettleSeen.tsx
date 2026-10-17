'use client';

import { useEffect } from 'react';

/**
 * Marks each element carrying `data-settle` as it comes into view: `wait` while it is still below the
 * screen, `in` once it arrives, so a design can lay it down with its own motion. Anything already on
 * screen is left alone, and with reduced motion asked for, or before the scripts arrive, nothing is
 * marked, so everything simply shows.
 */
export function SettleSeen() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const edge = window.innerHeight * 0.92;
    const waiting = [...document.querySelectorAll<HTMLElement>('[data-settle]')].filter((el) => el.getBoundingClientRect().top > edge);
    for (const el of waiting) el.dataset.settle = 'wait';
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).dataset.settle = 'in';
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -14% 0px' },
    );
    for (const el of waiting) io.observe(el);
    return () => io.disconnect();
  }, []);
  return null;
}
