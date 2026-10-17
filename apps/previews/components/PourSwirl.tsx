'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * A glass that answers the hand: on a large screen the wine's surface leans away from the pointer,
 * and a tap or click sets it swirling. Decoration only; with reduced motion asked for it stays still.
 */
export function PourSwirl({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    let timer = 0;
    const swirl = () => {
      el.removeAttribute('data-swirl');
      // Read the layout once so the animation starts again from the beginning.
      void el.offsetWidth;
      el.setAttribute('data-swirl', '');
      window.clearTimeout(timer);
      timer = window.setTimeout(() => el.removeAttribute('data-swirl'), 1600);
    };
    const lean = (e: PointerEvent) => {
      const box = el.getBoundingClientRect();
      const x = (e.clientX - (box.left + box.width / 2)) / box.width;
      el.style.setProperty('--tilt', `${Math.max(-1, Math.min(1, x)) * -7}deg`);
    };
    const rest = () => el.style.setProperty('--tilt', '0deg');
    el.addEventListener('pointerdown', swirl);
    if (fine) {
      window.addEventListener('pointermove', lean, { passive: true });
      el.addEventListener('pointerleave', rest);
    }
    return () => {
      window.clearTimeout(timer);
      el.removeEventListener('pointerdown', swirl);
      window.removeEventListener('pointermove', lean);
      el.removeEventListener('pointerleave', rest);
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
