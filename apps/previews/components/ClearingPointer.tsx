'use client';

import { useEffect, useRef } from 'react';
import { stillWanted, whenIdle } from './ClearingIdle';

/**
 * On a large screen with a mouse, the box around this mark is told where the pointer is, as `--mx` and
 * `--my` from -1 to 1, so drawn layers can lean against it by their depth. It starts once the browser is
 * first idle; nothing happens on a phone or with reduced motion asked for. It draws nothing itself.
 */
export function ClearingPointer() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const box = ref.current?.parentElement;
    if (!box || stillWanted()) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 900px)').matches) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    let rect: DOMRect | null = null;
    const move = (e: PointerEvent) => {
      rect ??= box.getBoundingClientRect();
      x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        box.style.setProperty('--mx', x.toFixed(3));
        box.style.setProperty('--my', y.toFixed(3));
      });
    };
    const forget = () => {
      rect = null;
    };
    const cancel = whenIdle(() => {
      box.addEventListener('pointermove', move);
      box.addEventListener('pointerenter', forget);
      window.addEventListener('scroll', forget, { passive: true });
    });
    return () => {
      cancel();
      box.removeEventListener('pointermove', move);
      box.removeEventListener('pointerenter', forget);
      window.removeEventListener('scroll', forget);
      cancelAnimationFrame(frame);
    };
  }, []);

  return <span ref={ref} hidden />;
}
