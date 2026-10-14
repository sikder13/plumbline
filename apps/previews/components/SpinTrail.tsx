'use client';

import { useEffect, useRef } from 'react';

/**
 * A narrow river down the edge of a large screen, with the boat marking how far down the page the
 * visitor has come. Decorative: the page reads the same without it.
 */
export function SpinTrail({ cls }: { cls: Partial<Record<'root' | 'base' | 'done' | 'boat', string>> }) {
  const root = useRef<HTMLDivElement>(null);
  const boat = useRef<HTMLSpanElement>(null);
  const done = useRef<SVGPathElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el || !window.matchMedia('(min-width: 1100px)').matches) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    let h = el.getBoundingClientRect().height;
    const ro = new ResizeObserver(() => void (h = el.getBoundingClientRect().height));
    ro.observe(el);
    const apply = (p: number) => {
      const y = p * h;
      const x = 6 * Math.sin(p * Math.PI * 6);
      const d = (6 * Math.PI * 6 * Math.cos(p * Math.PI * 6)) / Math.max(1, h);
      const a = (-Math.atan(d) * 180) / Math.PI;
      if (boat.current) boat.current.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${a.toFixed(1)}deg)`;
      done.current?.style.setProperty('stroke-dashoffset', (1 - p).toFixed(4));
    };
    void import('motion').then(({ scroll }) => {
      if (cancelled) return;
      stop = scroll(apply);
    });
    return () => {
      cancelled = true;
      stop?.();
      ro.disconnect();
    };
  }, []);

  const pts: string[] = [];
  for (let i = 0; i <= 120; i++) {
    const t = i / 120;
    pts.push(`${(20 + 6 * Math.sin(t * Math.PI * 6)).toFixed(2)} ${(t * 1000).toFixed(1)}`);
  }
  const d = `M${pts.join('L')}`;

  return (
    <div ref={root} className={cls.root} aria-hidden="true">
      <svg viewBox="0 0 40 1000" preserveAspectRatio="none" focusable="false">
        <path className={cls.base} d={d} />
        <path ref={done} className={cls.done} d={d} pathLength={1} />
      </svg>
      <span ref={boat} className={cls.boat}>
        <svg viewBox="-14 -26 28 52" focusable="false">
          <path d="M-12 -21H12L14 3L0 25L-14 3Z" />
        </svg>
      </span>
    </div>
  );
}
