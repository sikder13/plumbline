'use client';

import { useEffect } from 'react';

/**
 * Gentle reveals as sections scroll into view. Everything is visible without it: only elements
 * still below the screen when the page loads are held back, and none are when the visitor has
 * asked for reduced motion.
 */
export function Motion() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const waiting = [...document.querySelectorAll<HTMLElement>('[data-reveal]')].filter((el) => el.getBoundingClientRect().top > window.innerHeight * 0.92);
    for (const el of waiting) el.classList.add('reveal-wait');
    const seen = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.remove('reveal-wait');
          seen.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    for (const el of waiting) seen.observe(el);
    return () => seen.disconnect();
  }, []);
  return null;
}
