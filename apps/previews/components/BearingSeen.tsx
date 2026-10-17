'use client';

import { useEffect } from 'react';

/**
 * Tells each element marked `data-seen` when it first comes into view, so the stylesheet can play its
 * entrance then: "0" while it waits below the fold, "1" once it is seen. Anything already on screen, any
 * page without this script and any visitor who asks for reduced motion simply sees the finished state.
 */
export function BearingSeen() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const els = [...document.querySelectorAll<HTMLElement>('[data-seen]')];
    const edge = window.innerHeight * 0.92;
    const waiting = els.filter((el) => el.getBoundingClientRect().top > edge);
    for (const el of waiting) el.dataset.seen = '0';
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).dataset.seen = '1';
          io.unobserve(e.target);
        }
      },
      { threshold: 0.28 },
    );
    for (const el of waiting) io.observe(el);
    return () => io.disconnect();
  }, []);
  return null;
}
