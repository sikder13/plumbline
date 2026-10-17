'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { stillWanted, whenIdle } from './ClearingIdle';

/** "start 0.95": which edge of the box (start, center or end) meets which height of the screen (0 to 1). */
function point(offset: string): [number, number] {
  const [edge, at] = offset.split(' ');
  return [edge === 'center' ? 0.5 : edge === 'end' ? 1 : 0, Number(at ?? 0)];
}

/**
 * A box that carries how far it has travelled up the screen as `--o`, from 0 when the `from` point is met
 * to 1 when the `to` point is met (as "start 0.95": the box's top at 95% down the screen). The design's
 * styles turn that into a shape opening or words lighting up. It listens only while the box is near the
 * screen, and only once the browser is first idle; until then it stands at `rest`. With reduced motion
 * asked for it is simply 1, all open.
 */
export function ClearingOpen({ children, className, style, from = 'start 0.95', to = 'center 0.55', rest = 0 }: { children: ReactNode; className?: string; style?: CSSProperties; from?: string; to?: string; rest?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (stillWanted()) {
      el.style.setProperty('--o', '1');
      return;
    }
    const [fromEdge, fromAt] = point(from);
    const [toEdge, toAt] = point(to);
    let frame = 0;
    let listening = false;
    let last = -1;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const span = (fromAt - toAt) * vh + (toEdge - fromEdge) * r.height;
      const p = Math.min(1, Math.max(0, (fromAt * vh - (r.top + fromEdge * r.height)) / (span || 1)));
      if (Math.abs(p - last) < 0.002) return;
      last = p;
      el.style.setProperty('--o', p.toFixed(3));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    let io: IntersectionObserver | undefined;
    const cancel = whenIdle(() => {
      // Served at rest (open, or closed); from here on it follows the scroll.
      update();
      io = new IntersectionObserver(
        ([e]) => {
          const near = !!e?.isIntersecting;
          if (near && !listening) {
            listening = true;
            window.addEventListener('scroll', onScroll, { passive: true });
            onScroll();
          } else if (!near && listening) {
            listening = false;
            window.removeEventListener('scroll', onScroll);
            onScroll();
          }
        },
        { rootMargin: '25% 0px' },
      );
      io.observe(el);
    });
    return () => {
      cancel();
      io?.disconnect();
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [from, to]);

  return (
    <div ref={ref} className={className} style={{ '--o': rest, ...style } as CSSProperties}>
      {children}
    </div>
  );
}
