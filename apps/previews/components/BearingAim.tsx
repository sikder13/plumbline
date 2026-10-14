'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Holds a compass and turns its needle (through `--aim`) towards one element of the page, the word it
 * is about. On a screen with a mouse the needle follows the pointer while it is over the section, and
 * goes back to the word when the pointer leaves. Before the script arrives the stylesheet's own angle
 * stands, and with reduced motion asked for the needle only ever points at the word.
 */
export function BearingAim({ target, className, children }: { target: string; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let current = Number.NaN;
    const angleTo = (x: number, y: number) => {
      const b = el.getBoundingClientRect();
      return (Math.atan2(x - (b.left + b.width / 2), -(y - (b.top + b.height / 2))) * 180) / Math.PI;
    };
    // The needle takes the short way round to its new angle.
    const set = (deg: number) => {
      let d = deg;
      if (!Number.isNaN(current)) {
        while (d - current > 180) d -= 360;
        while (d - current < -180) d += 360;
      }
      current = d;
      el.style.setProperty('--aim', `${d.toFixed(1)}deg`);
    };
    const home = () => {
      const goal = document.getElementById(target);
      if (!goal) return;
      const g = goal.getBoundingClientRect();
      set(angleTo(g.left + g.width * 0.42, g.top + g.height * 0.56));
    };
    const fallback = Number.parseFloat(getComputedStyle(el).getPropertyValue('--aim'));
    if (!Number.isNaN(fallback)) current = fallback;
    home();
    // The display face can arrive after the first aim and move the word a little.
    void document.fonts?.ready.then(home);

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const zone = el.closest<HTMLElement>('[data-hero]') ?? el.parentElement;
    let frame = 0;
    const follow = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => set(angleTo(e.clientX, e.clientY)));
    };
    const leave = () => {
      cancelAnimationFrame(frame);
      home();
    };
    if (fine && !still && zone) {
      zone.addEventListener('pointermove', follow);
      zone.addEventListener('pointerleave', leave);
    }
    window.addEventListener('resize', home);
    return () => {
      cancelAnimationFrame(frame);
      zone?.removeEventListener('pointermove', follow);
      zone?.removeEventListener('pointerleave', leave);
      window.removeEventListener('resize', home);
    };
  }, [target]);

  return (
    <span ref={ref} className={className} aria-hidden="true">
      {children}
    </span>
  );
}
