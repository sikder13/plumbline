'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Picture } from '@/lib/data';

/**
 * Their plates on a turning table. The plate at the front is shown large; the others wait round the
 * edge. Buttons, the arrow keys and a swipe turn it. It turns three plates once when it first comes
 * into view, then waits. With reduced motion the plates simply change.
 */
export function PlateWheel({ plates, s }: { plates: Picture[]; s: Record<string, string> }) {
  const [at, setAt] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const touched = useRef(false);
  const start = useRef<number | null>(null);
  const n = plates.length;

  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timers: number[] = [];
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      [1, 2, 3].forEach((k, i) => timers.push(window.setTimeout(() => !touched.current && setAt(k % n), 600 * (i + 1))));
    }, { threshold: 0.5 });
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [n]);

  const turn = (d: number) => {
    touched.current = true;
    setAt((v) => (v + d + n) % n);
  };

  return (
    <div
      className={s.wheel}
      ref={root}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') turn(1);
        if (e.key === 'ArrowLeft') turn(-1);
      }}
      onPointerDown={(e) => (start.current = e.clientX)}
      onPointerUp={(e) => {
        if (start.current === null) return;
        const dx = e.clientX - start.current;
        start.current = null;
        if (Math.abs(dx) > 40) turn(dx < 0 ? 1 : -1);
      }}
    >
      <div className={s.table} aria-live="polite">
        {plates.map((p, i) => {
          // The chosen plate sits in the middle; the others wait round the rim, in order.
          const k = (i - at + n) % n;
          const angle = ((k - 1) * 360) / Math.max(1, n - 1) - 90;
          const x = k === 0 ? 0 : Math.cos((angle * Math.PI) / 180);
          const y = k === 0 ? 0 : Math.sin((angle * Math.PI) / 180);
          return (
          <figure key={p.fallback} className={s.plateSpot} style={{ '--x': x, '--y': y } as CSSProperties} data-front={k === 0 ? '' : undefined} aria-hidden={k === 0 ? undefined : true}>
            <picture>
              {p.sources.map((x) => (
                <source key={x.type} type={x.type} srcSet={x.srcset} sizes="(min-width: 900px) 34vw, 70vw" />
              ))}
              <img src={p.fallback} width={p.width} height={p.height} alt={p.alt} loading="lazy" decoding="async" draggable={false} style={{ backgroundColor: p.colour }} />
            </picture>
          </figure>
          );
        })}
      </div>
      <div className={s.turns}>
        <button type="button" onClick={() => turn(-1)} aria-label="Turn to the previous plate" data-press>
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path d="M12.5 4 6.5 10l6 6" />
          </svg>
        </button>
        <span className={s.count}>
          {at + 1} of {n}
        </span>
        <button type="button" onClick={() => turn(1)} aria-label="Turn to the next plate" data-press>
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path d="M7.5 4 13.5 10l-6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
