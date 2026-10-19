'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Pic } from './Pic';
import type { Picture } from '@/lib/data';

/** The largest file of a photo, for the lens: the last entry of its first srcset. */
function largest(pic: Picture): string {
  const set = pic.sources.find((x) => x.type === 'image/webp') ?? pic.sources[0]!;
  return set.srcset.split(',').at(-1)!.trim().split(' ')[0]!;
}

/**
 * One of their floors with a lens over it that shows the photo at its own full pixels, so a seam or a
 * line can be looked at closely. It follows the pointer, a finger, or the arrow keys. The first one
 * sweeps once across its floor when it comes into view.
 */
export function PlankLoupe({ pic, label, note, sweep, s }: { pic: Picture; label: string; note: string; sweep?: boolean; s: Record<string, string> }) {
  const frame = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const [pos, setPos] = useState({ x: 0.5, y: 0.5 });
  const [box, setBox] = useState({ w: 0, h: 0 });
  const touched = useRef(false);

  const measure = () => {
    const r = frame.current?.getBoundingClientRect();
    if (r) setBox({ w: r.width, h: r.height });
  };

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    const el = frame.current;
    if (!sweep || !el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        measure();
        const start = performance.now();
        const step = (t: number) => {
          if (touched.current) return;
          const k = Math.min(1, (t - start) / 2200);
          const ease = 1 - (1 - k) ** 3;
          setOn(k < 1);
          setPos({ x: 0.22 + 0.56 * ease, y: 0.3 + 0.4 * ease });
          if (k < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [sweep]);

  const at = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    touched.current = true;
    setBox({ w: r.width, h: r.height });
    setPos({ x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) });
    setOn(true);
  };

  const key = (e: KeyboardEvent<HTMLButtonElement>) => {
    const d = { ArrowLeft: [-0.05, 0], ArrowRight: [0.05, 0], ArrowUp: [0, -0.05], ArrowDown: [0, 0.05] }[e.key];
    if (!d) return;
    e.preventDefault();
    touched.current = true;
    setOn(true);
    setPos((p) => ({ x: Math.min(1, Math.max(0, p.x + d[0]!)), y: Math.min(1, Math.max(0, p.y + d[1]!)) }));
  };

  // The lens shows the photo at its own pixels: as many as the file has across, over the width drawn.
  const zoomW = Math.max(pic.width, box.w * 2);
  const zoomH = zoomW * (box.h / Math.max(1, box.w));
  const lens = 180;

  return (
    <figure className={s.floor}>
      <div className={s.frame} ref={frame} onPointerMove={at} onPointerDown={at} onPointerLeave={(e) => e.pointerType === 'mouse' && setOn(false)}>
        <Pic pic={pic} sizes="(min-width: 900px) 46vw, 100vw" low />
        <div
          className={s.lens}
          aria-hidden="true"
          data-on={on ? '' : undefined}
          style={{
            width: lens,
            height: lens,
            transform: `translate(${pos.x * box.w - lens / 2}px, ${pos.y * box.h - lens / 2}px)`,
            backgroundImage: on || touched.current ? `url(${largest(pic)})` : undefined,
            backgroundSize: `${zoomW}px ${zoomH}px`,
            backgroundPosition: `${-(pos.x * zoomW - lens / 2)}px ${-(pos.y * zoomH - lens / 2)}px`,
          }}
        />
      </div>
      <figcaption>
        <b>{label}</b>
        <span>{note}</span>
        <button type="button" className={s.closer} aria-pressed={on} onClick={() => setOn((v) => !v)} onKeyDown={key}>
          {on ? 'Lens on: arrow keys move it' : 'Look closer'}
        </button>
      </figcaption>
    </figure>
  );
}
