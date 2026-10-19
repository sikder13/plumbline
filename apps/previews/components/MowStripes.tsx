'use client';

import { useEffect, useRef, type CSSProperties } from 'react';

/**
 * Their services, one stripe each, mown into the page as it scrolls: each stripe is cut in the
 * opposite way to the one before, as a mower goes up the lawn and back. With reduced motion the lawn
 * is simply there.
 */
export function MowStripes({ items, s }: { items: string[]; s: Record<string, string> }) {
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (const li of el.children) li.setAttribute('data-cut', '');
      return;
    }
    el.setAttribute('data-waiting', '');
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute('data-cut', '');
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.6 },
    );
    for (const li of el.children) io.observe(li);
    return () => io.disconnect();
  }, []);
  return (
    <ol className={s.stripes} ref={list}>
      {items.map((t, i) => (
        // The stripe is watched and its inside is cut: a fully clipped element never counts as on screen.
        <li key={t} style={{ '--i': i } as CSSProperties} data-way={i % 2 ? 'back' : 'up'}>
          <span className={s.stripeIn}>
            <span className={s.stripeNo} aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className={s.stripeName}>{t}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
