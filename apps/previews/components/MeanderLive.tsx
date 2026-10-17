'use client';

import { useEffect } from 'react';
import { whenIdle } from './MeanderIdle';

/**
 * The small live parts of the page, done once the browser is idle after loading:
 * - the month it is now where the business is, marked on every season row, with each row told
 *   whether it is in season (`[data-season]` lists its months, `[data-season-state]` gets the words);
 * - minibuses that drive on their own (`svg[data-drive]`) run only while they can be seen, and with
 *   reduced motion asked for they are parked part way along;
 * - anything marked `data-watch` is marked `data-seen` once it comes into view.
 */
export function MeanderLive({ zone, on, off }: { zone: string; on: string; off: string }) {
  useEffect(() => {
    const undo: (() => void)[] = [];

    const season = () => {
      let month = new Date().getMonth();
      try {
        month = Number(new Intl.DateTimeFormat('en-NZ', { timeZone: zone, month: 'numeric' }).format(new Date())) - 1;
      } catch {
        /* the visitor's own month will do */
      }
      for (const row of document.querySelectorAll<HTMLElement>('[data-season]')) {
        const months = (row.dataset.season ?? '').split(',').map(Number);
        const running = months.includes(month);
        row.setAttribute(running ? 'data-on' : 'data-off', '');
        row.querySelector<HTMLElement>(`[data-m="${month}"]`)?.setAttribute('data-now', '');
        const state = row.querySelector<HTMLElement>('[data-season-state]');
        if (state) {
          state.textContent = running ? on : off;
          state.hidden = false;
        }
      }
    };

    const watch = () => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      for (const svg of document.querySelectorAll<SVGSVGElement>('svg[data-drive]')) {
        if (reduce) {
          svg.pauseAnimations();
          svg.setCurrentTime(Number(svg.dataset.park ?? 0));
          continue;
        }
        const io = new IntersectionObserver(([e]) => (e!.isIntersecting ? svg.unpauseAnimations() : svg.pauseAnimations()));
        io.observe(svg);
        undo.push(() => io.disconnect());
      }
      const watched = [...document.querySelectorAll<HTMLElement>('[data-watch]')];
      if (reduce) {
        for (const el of watched) el.setAttribute('data-seen', '');
        return;
      }
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            e.target.setAttribute('data-seen', '');
            io.unobserve(e.target);
          }
        },
        { rootMargin: '0px 0px -18% 0px' },
      );
      for (const el of watched) io.observe(el);
      undo.push(() => io.disconnect());
    };

    // Two small pieces of work, each in its own idle moment, so neither lengthens the load.
    undo.push(whenIdle(season, 2000));
    undo.push(whenIdle(watch, 2500));
    return () => {
      for (const u of undo) u();
    };
  }, [zone, on, off]);
  return null;
}
