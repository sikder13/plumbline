'use client';

import { useEffect } from 'react';

/**
 * The page's own small motions, fetched after it has painted. A label marked `data-drop` lets its
 * mark down as its section arrives, and a row marked `data-drift` travels sideways as its section
 * passes, the item nearest the middle of the screen marked `data-lit` (the row scrolls by hand before
 * this runs, and with reduced motion asked for the styles lay it out flat).
 */
export function HaulMotion() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const undo: (() => void)[] = [];
    let stopped = false;

    const edge = window.innerHeight * 0.92;
    const drops = [...document.querySelectorAll<HTMLElement>('[data-drop]')].filter((el) => el.getBoundingClientRect().top > edge);
    for (const el of drops) el.dataset.drop = 'wait';
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).dataset.drop = 'in';
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -14% 0px' },
    );
    for (const el of drops) io.observe(el);
    undo.push(() => io.disconnect());

    void import('motion').then(({ scroll }) => {
      if (stopped) return;
      for (const track of document.querySelectorAll<HTMLElement>('[data-drift]')) {
        const frame = track.parentElement;
        if (!frame) continue;
        let room = 0;
        let mids: number[] = [];
        let lit = -1;
        const items = [...track.children] as HTMLElement[];
        const measure = () => {
          room = Math.max(0, track.scrollWidth - frame.clientWidth);
          mids = items.map((el) => el.offsetLeft + el.offsetWidth / 2);
        };
        track.dataset.drift = 'on';
        measure();
        window.addEventListener('resize', measure);
        undo.push(() => window.removeEventListener('resize', measure));
        undo.push(
          scroll(
            (p: number) => {
              const t = Math.min(1, Math.max(0, (p - 0.12) / 0.76));
              const x = t * room;
              track.style.transform = `translate3d(${(-x).toFixed(1)}px,0,0)`;
              const centre = x + frame.clientWidth / 2;
              let best = 0;
              for (let k = 1; k < mids.length; k++) if (Math.abs(mids[k]! - centre) < Math.abs(mids[best]! - centre)) best = k;
              if (best !== lit) {
                items[lit]?.removeAttribute('data-lit');
                items[best]?.setAttribute('data-lit', '');
                lit = best;
              }
            },
            { target: frame, offset: ['start end', 'end start'] },
          ),
        );
      }
    });

    return () => {
      stopped = true;
      for (const u of undo) u();
    };
  }, []);
  return null;
}
