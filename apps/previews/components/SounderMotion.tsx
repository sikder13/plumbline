'use client';

import { useEffect } from 'react';

/**
 * The page's own small motions, fetched after it has painted. A paragraph marked `data-fill` darkens
 * word by word as it is read past (`--fill`, 0 to 1); a heading marked `data-slide` carries its
 * passage through the screen as `--slide`; a line marked `data-draw` below the first screen waits,
 * then draws itself once it comes into view. With reduced motion asked for, all of it simply shows.
 */
export function SounderMotion() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const undo: (() => void)[] = [];
    let stopped = false;

    const edge = window.innerHeight * 0.9;
    const draws = [...document.querySelectorAll<SVGElement>('[data-draw]')].filter((el) => el.getBoundingClientRect().top > edge);
    for (const el of draws) el.setAttribute('data-draw', 'wait');
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute('data-draw', 'in');
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    for (const el of draws) io.observe(el);
    undo.push(() => io.disconnect());

    void import('motion').then(({ scroll }) => {
      if (stopped) return;
      for (const el of document.querySelectorAll<HTMLElement>('[data-fill]')) {
        el.style.setProperty('--fill', '0');
        undo.push(scroll((p: number) => el.style.setProperty('--fill', p.toFixed(3)), { target: el, offset: ['start 0.88', 'end 0.5'] }));
      }
      for (const el of document.querySelectorAll<HTMLElement>('[data-slide]')) {
        undo.push(scroll((p: number) => el.style.setProperty('--slide', p.toFixed(3)), { target: el, offset: ['start end', 'end start'] }));
      }
    });

    return () => {
      stopped = true;
      for (const u of undo) u();
    };
  }, []);
  return null;
}
