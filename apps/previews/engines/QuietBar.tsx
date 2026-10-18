'use client';

import { useEffect } from 'react';

/**
 * Hides the floating book button and the tab switch while the page's own actions are on screen: the
 * signature, the close and the footer, each marked `data-quiet`. A floating copy never sits on top
 * of the button it repeats.
 */
export function QuietBar() {
  useEffect(() => {
    const root = document.documentElement;
    const seen = new Set<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) seen.add(e.target);
          else seen.delete(e.target);
        }
        root.toggleAttribute('data-quiet', seen.size > 0);
      },
      { threshold: 0 },
    );
    for (const zone of document.querySelectorAll('#demo [data-quiet], #demo footer')) io.observe(zone);
    return () => {
      io.disconnect();
      root.removeAttribute('data-quiet');
    };
  }, []);
  return null;
}
