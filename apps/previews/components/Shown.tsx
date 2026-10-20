'use client';

import { useEffect } from 'react';

/**
 * Marks each element with `data-show` as `data-shown` once it is on screen, so a signature can play
 * itself once when it arrives. With reduced motion asked for, everything is marked at once, still.
 */
export function Shown() {
  useEffect(() => {
    const els = [...document.querySelectorAll('[data-show]')];
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (const el of els) el.setAttribute('data-shown', '');
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute('data-shown', '');
          io.unobserve(e.target);
        }
      },
      { threshold: 0.35 },
    );
    for (const el of els) io.observe(el);
    return () => io.disconnect();
  }, []);
  return null;
}
