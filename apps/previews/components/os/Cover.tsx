'use client';

import { useEffect } from 'react';

/**
 * Marks the page while any element with `data-covers` is on screen, so a floating bar never sits
 * over the buttons it repeats. Plumbing only: each page styles its own bar from `[data-covered]`.
 */
export function Cover() {
  useEffect(() => {
    const root = document.documentElement;
    const seen = new Set<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) seen.add(e.target);
          else seen.delete(e.target);
        }
        root.toggleAttribute('data-covered', seen.size > 0);
      },
      { threshold: 0 },
    );
    for (const el of document.querySelectorAll('[data-covers]')) io.observe(el);
    return () => io.disconnect();
  }, []);
  return null;
}
