'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * A row that is swiped on a phone, with the phone's own momentum and snap. With a mouse the row is
 * dragged: it follows the pointer, then settles on the nearest panel. It always starts with its
 * first panel whole at the left edge, and a small cue says it can be dragged until it has been.
 */
export function SideScroll({ children, className, head, label, cue }: { children: ReactNode; className?: string; head?: ReactNode; label: string; cue: string }) {
  const outer = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const o = outer.current;
    const t = track.current;
    if (!o || !t || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    // A row whose panels all fit has nothing to drag to, and says so, so that a design can drop its cue.
    o.toggleAttribute('data-fits', t.scrollWidth <= t.clientWidth + 1);
    let startX = 0;
    let startLeft = 0;
    let dragging = false;
    let moved = false;
    const used = () => o.setAttribute('data-dragged', '');
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging = true;
      moved = false;
      startX = e.clientX;
      startLeft = t.scrollLeft;
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) < 6) return;
      if (!moved) {
        moved = true;
        t.setAttribute('data-dragging', '');
        t.setPointerCapture(e.pointerId);
        used();
      }
      t.scrollLeft = startLeft - dx;
    };
    const up = () => {
      if (!dragging) return;
      dragging = false;
      if (!moved) return;
      // Settle on the panel whose left edge is nearest, the way the phone's snap does.
      const panels = [...t.children] as HTMLElement[];
      const pad = parseFloat(getComputedStyle(t).paddingLeft) || 0;
      const nearest = panels.reduce((best, el) => (Math.abs(el.offsetLeft - pad - t.scrollLeft) < Math.abs(best.offsetLeft - pad - t.scrollLeft) ? el : best), panels[0]!);
      t.removeAttribute('data-dragging');
      t.scrollTo({ left: nearest.offsetLeft - pad, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    };
    // A drag must not end as a click on something inside the row.
    const click = (e: MouseEvent) => {
      if (moved) e.preventDefault();
    };
    t.addEventListener('pointerdown', down);
    t.addEventListener('pointermove', move);
    t.addEventListener('pointerup', up);
    t.addEventListener('pointercancel', up);
    t.addEventListener('click', click, true);
    t.addEventListener('scroll', used, { once: true, passive: true });
    return () => {
      t.removeEventListener('pointerdown', down);
      t.removeEventListener('pointermove', move);
      t.removeEventListener('pointerup', up);
      t.removeEventListener('pointercancel', up);
      t.removeEventListener('click', click, true);
    };
  }, []);

  return (
    <div ref={outer} className={className} data-side>
      {head}
      <div data-side-wrap>
        <div ref={track} data-side-track role="group" aria-label={label} tabIndex={0}>
          {children}
        </div>
        <span data-side-cue aria-hidden="true">
          {cue}
        </span>
      </div>
    </div>
  );
}
