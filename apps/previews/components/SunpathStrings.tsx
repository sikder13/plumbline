'use client';

import { useEffect, useRef } from 'react';

const W = 1000;
const GAP = 22;
const TOP = 16;
const H = TOP * 2 + GAP * 5;

/**
 * Six strings across the foot of the page. A pointer or a finger drawn across them plucks each one it
 * crosses, where it crosses, and the string rings out and settles; they are strummed once as they come
 * into view, and the button strums them again. Decoration, with a button for those who use a keyboard.
 * With reduced motion asked for they lie still.
 */
export function SunpathStrings({ label, cls }: { label: string; cls: { box?: string; strum?: string } }) {
  const svg = useRef<SVGSVGElement>(null);
  const strum = useRef<() => void>(() => {});

  useEffect(() => {
    const el = svg.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const paths = [...el.querySelectorAll<SVGPathElement>('path')];
    const ring = paths.map(() => ({ amp: 0, x: W / 2, t0: 0 }));
    let frame = 0;
    const draw = (now: number) => {
      let busy = false;
      paths.forEach((p, i) => {
        const r = ring[i]!;
        const y = TOP + i * GAP;
        if (r.amp === 0) return;
        const t = (now - r.t0) / 1000;
        const decay = Math.exp(-t * 2.6);
        if (decay < 0.02) {
          r.amp = 0;
          p.setAttribute('d', `M0 ${y}H${W}`);
          return;
        }
        busy = true;
        const off = r.amp * decay * Math.sin(t * (34 - i * 3));
        p.setAttribute('d', `M0 ${y}Q${r.x.toFixed(0)} ${(y + off * 2).toFixed(1)} ${W} ${y}`);
      });
      frame = busy ? requestAnimationFrame(draw) : 0;
    };
    const pluck = (i: number, x: number, amp: number) => {
      const r = ring[i];
      if (!r) return;
      r.amp = amp;
      r.x = x;
      r.t0 = performance.now();
      if (!frame) frame = requestAnimationFrame(draw);
    };
    let lastY: number | null = null;
    const move = (e: PointerEvent) => {
      const box = el.getBoundingClientRect();
      const x = ((e.clientX - box.left) * W) / box.width;
      const y = ((e.clientY - box.top) * H) / box.height;
      if (lastY !== null) {
        for (let i = 0; i < paths.length; i++) {
          const sy = TOP + i * GAP;
          if ((lastY - sy) * (y - sy) <= 0 && lastY !== y) pluck(i, x, Math.min(9, 3 + Math.abs(y - lastY) * 0.4));
        }
      }
      lastY = y;
    };
    const leave = () => {
      lastY = null;
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    el.addEventListener('pointerdown', move);
    const timers: number[] = [];
    strum.current = () => paths.forEach((_, i) => timers.push(window.setTimeout(() => pluck(i, W * (0.3 + i * 0.07), 8), i * 70)));
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        strum.current();
        io.disconnect();
      },
      { threshold: 0.8 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
      for (const t of timers) clearTimeout(t);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
      el.removeEventListener('pointerdown', move);
    };
  }, []);

  return (
    <div className={cls.box}>
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
        {Array.from({ length: 6 }, (_, i) => (
          <path key={i} d={`M0 ${TOP + i * GAP}H${W}`} style={{ strokeWidth: 1 + (5 - i) * 0.35 }} />
        ))}
      </svg>
      <button type="button" className={cls.strum} onClick={() => strum.current()}>
        {label}
      </button>
    </div>
  );
}
