'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { Picture } from '@/lib/data';

/**
 * One wide photo of their room, shown taller than the screen is wide so it runs past both edges. The
 * visitor drags it, or uses the arrow keys or the slider, to look from one end to the other. It pans
 * once on its own when it first comes into view, then waits.
 */
export function PanoramaRoom({ pic, s, label }: { pic: Picture; s: Record<string, string>; label: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0.5);
  const drag = useRef<{ x: number; at: number } | null>(null);
  const touched = useRef(false);

  useEffect(() => {
    const el = frame.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const step = (t: number) => {
        if (touched.current) return;
        const k = Math.min(1, (t - t0) / 2200);
        setAt(0.5 - 0.5 * Math.sin(k * Math.PI));
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, { threshold: 0.6 });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  const down = (e: PointerEvent<HTMLDivElement>) => {
    touched.current = true;
    drag.current = { x: e.clientX, at };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const w = e.currentTarget.getBoundingClientRect().width;
    setAt(Math.min(1, Math.max(0, drag.current.at - (e.clientX - drag.current.x) / (w * 1.2))));
  };
  const key = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') touched.current = true;
  };

  const src = pic.sources.find((x) => x.type === 'image/webp') ?? pic.sources[0]!;
  return (
    <div className={s.pano}>
      <div className={s.panoFrame} ref={frame} onPointerDown={down} onPointerMove={move} onPointerUp={() => (drag.current = null)} onPointerCancel={() => (drag.current = null)}>
        <picture>
          {pic.sources.map((x) => (
            <source key={x.type} type={x.type} srcSet={x.srcset} sizes="300vw" />
          ))}
          <img src={pic.fallback} srcSet={src.srcset} width={pic.width} height={pic.height} alt={pic.alt} loading="lazy" decoding="async" draggable={false} style={{ objectPosition: `${at * 100}% 50%`, backgroundColor: pic.colour }} />
        </picture>
      </div>
      <label className={s.panoControl}>
        <span>{label}</span>
        <input type="range" min={0} max={100} value={Math.round(at * 100)} onKeyDown={key} onChange={(e) => {
          touched.current = true;
          setAt(Number(e.target.value) / 100);
        }} />
      </label>
    </div>
  );
}
