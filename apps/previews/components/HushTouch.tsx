'use client';

import { useEffect, useRef } from 'react';

/**
 * Still water that answers: a tap, or a pointer drifting across the opening screen, leaves a ring
 * that spreads and fades where it touched. Listens on the section it sits in. Nothing happens with
 * reduced motion asked for.
 */
export function HushTouch({ cls }: { cls: { layer: string | undefined; ring: string | undefined } }) {
  const layer = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = layer.current;
    const host = el?.parentElement;
    if (!el || !host) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    let lastX = -999;
    let lastY = -999;
    let lastT = 0;

    const drop = (x: number, y: number, big: boolean) => {
      if (el.childElementCount > 7) el.firstElementChild?.remove();
      const box = host.getBoundingClientRect();
      const ring = document.createElement('i');
      ring.className = cls.ring ?? '';
      ring.style.left = `${x - box.left}px`;
      ring.style.top = `${y - box.top}px`;
      if (big) ring.dataset.big = '';
      ring.addEventListener('animationend', () => ring.remove(), { once: true });
      el.appendChild(ring);
    };

    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('a, button')) return;
      drop(e.clientX, e.clientY, true);
    };
    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastT < 140 || Math.hypot(e.clientX - lastX, e.clientY - lastY) < 48) return;
      lastT = now;
      lastX = e.clientX;
      lastY = e.clientY;
      drop(e.clientX, e.clientY, false);
    };

    host.addEventListener('pointerdown', onDown);
    if (fine) host.addEventListener('pointermove', onMove);
    return () => {
      host.removeEventListener('pointerdown', onDown);
      host.removeEventListener('pointermove', onMove);
    };
  }, [cls.ring]);

  return <span ref={layer} className={cls.layer} aria-hidden="true" />;
}
