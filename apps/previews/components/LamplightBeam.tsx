'use client';

import { useEffect, useRef } from 'react';

/**
 * The dark around a headlamp's pool of light. On a screen with a mouse the pool follows the pointer,
 * easing after it; elsewhere the design moves it with the scroll. Only a transform changes, so the
 * browser moves it without repainting the photograph under it. With reduced motion asked for it stays
 * where the design puts it.
 */
export function LamplightBeam({ className }: { className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    const frame = el?.parentElement;
    if (!el || !frame) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let tx = 0;
    let ty = 0;
    let x = 0;
    let y = 0;
    let raf = 0;
    let aimed = false;
    const tick = () => {
      x += (tx - x) * 0.14;
      y += (ty - y) * 0.14;
      el.style.setProperty('--ax', `${x.toFixed(1)}px`);
      el.style.setProperty('--ay', `${y.toFixed(1)}px`);
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.6 ? requestAnimationFrame(tick) : 0;
    };
    const move = (e: PointerEvent) => {
      const box = frame.getBoundingClientRect();
      if (box.bottom < 0 || box.top > window.innerHeight) return;
      tx = e.clientX - box.left - box.width / 2;
      ty = e.clientY - box.top - box.height / 2;
      if (!aimed) {
        aimed = true;
        x = tx;
        y = ty;
        el.setAttribute('data-aim', '');
      }
      if (!raf) raf = requestAnimationFrame(tick);
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => {
      window.removeEventListener('pointermove', move);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <span ref={ref} className={className} aria-hidden="true" />;
}
