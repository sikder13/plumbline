'use client';

import { useEffect, useRef } from 'react';

/** Points along the waterline, its width in drawing units, and where it rests in its strip. */
const N = 64;
const W = 1000;
const REST = 24;

function drawn(h: Float32Array): { line: string; air: string } {
  const pts: string[] = [];
  for (let i = 0; i < N; i++) pts.push(`${((i / (N - 1)) * W).toFixed(1)} ${(REST + h[i]!).toFixed(2)}`);
  return { line: `M${pts.join('L')}`, air: `M0 0H${W}V${(REST + h[N - 1]!).toFixed(2)}L${pts.slice().reverse().join('L')}Z` };
}

const FLAT = drawn(new Float32Array(N));

/**
 * The waterline of the opening screen, and what touches it. A finger or pointer moving near the line
 * pushes a ripple along it, a tap sends a bigger one, and bubbles rise where it moves through the
 * water. A buoy marked `data-buoy` rides the line. The line only moves while something disturbs it,
 * and with reduced motion asked for it stays flat and nothing is made.
 */
export function FathomSurface({ cls }: { cls: { ripple?: string; air?: string; line?: string; bubbles?: string } }) {
  const svg = useRef<SVGSVGElement>(null);
  const air = useRef<SVGPathElement>(null);
  const line = useRef<SVGPathElement>(null);
  const layer = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const strip = svg.current;
    const hero = strip?.closest<HTMLElement>('[data-hero]');
    const bubbles = layer.current;
    if (!strip || !hero || !bubbles || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const buoy = hero.querySelector<HTMLElement>('[data-buoy]');
    // Where the buoy floats is read the first time the water moves, not while the page loads.
    let buoyAt = -1;
    const h = new Float32Array(N);
    const v = new Float32Array(N);
    let frame = 0;
    let lastBubble = 0;
    let alive = 0;

    const render = () => {
      const d = drawn(h);
      air.current?.setAttribute('d', d.air);
      line.current?.setAttribute('d', d.line);
      if (buoy) {
        if (buoyAt < 0) buoyAt = Number(getComputedStyle(buoy).getPropertyValue('--at')) || 0.8;
        buoy.style.transform = `translateY(${h[Math.round(buoyAt * (N - 1))]!.toFixed(2)}px)`;
      }
    };

    const tick = () => {
      let energy = 0;
      for (let i = 0; i < N; i++) {
        const lap = (h[i - 1] ?? h[i]!) + (h[i + 1] ?? h[i]!) - 2 * h[i]!;
        v[i] = (v[i]! + 0.2 * lap - 0.014 * h[i]!) * 0.962;
      }
      for (let i = 0; i < N; i++) {
        h[i] = Math.max(-16, Math.min(16, h[i]! + v[i]!));
        energy += Math.abs(h[i]!) + Math.abs(v[i]!);
      }
      render();
      if (energy > 0.25) frame = requestAnimationFrame(tick);
      else {
        h.fill(0);
        v.fill(0);
        render();
        frame = 0;
      }
    };

    const push = (x: number, amount: number) => {
      const at = x * (N - 1);
      for (let i = Math.max(0, Math.floor(at - 8)); i <= Math.min(N - 1, Math.ceil(at + 8)); i++) v[i] = v[i]! - amount * Math.exp(-((i - at) ** 2) / 8);
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const bubble = (e: PointerEvent) => {
      const t = performance.now();
      if (t - lastBubble < 50 || alive > 16) return;
      const box = bubbles.getBoundingClientRect();
      const x = e.clientX - box.left;
      const y = e.clientY - box.top;
      if (y < 0 || y > box.height || x < 0 || x > box.width) return;
      lastBubble = t;
      const b = document.createElement('i');
      const size = 6 + Math.random() * 16;
      b.style.cssText = `left:${x.toFixed(0)}px;top:${y.toFixed(0)}px;--s:${size.toFixed(1)}px;--x:${((Math.random() - 0.5) * 48).toFixed(0)}px;--d:${(1.4 + Math.random() * 1.2).toFixed(2)}s`;
      alive++;
      bubbles.appendChild(b);
      b.addEventListener(
        'animationend',
        () => {
          b.remove();
          alive--;
        },
        { once: true },
      );
    };

    let lastY = 0;
    const move = (e: PointerEvent) => {
      const box = strip.getBoundingClientRect();
      const fromLine = e.clientY - (box.top + REST);
      const speed = Math.min(1, Math.abs(e.clientY - lastY) / 20 + 0.25);
      lastY = e.clientY;
      if (Math.abs(fromLine) < 140) push((e.clientX - box.left) / box.width, 1.7 * speed * (1 - Math.abs(fromLine) / 140));
      bubble(e);
    };
    const down = (e: PointerEvent) => {
      const box = strip.getBoundingClientRect();
      push((e.clientX - box.left) / box.width, 5);
      bubble(e);
    };

    hero.addEventListener('pointermove', move, { passive: true });
    hero.addEventListener('pointerdown', down, { passive: true });
    return () => {
      hero.removeEventListener('pointermove', move);
      hero.removeEventListener('pointerdown', down);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      <span ref={layer} className={cls.bubbles} aria-hidden="true" />
      <svg ref={svg} className={cls.ripple} viewBox={`0 0 ${W} ${REST * 2}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path ref={air} className={cls.air} d={FLAT.air} />
        <path ref={line} className={cls.line} d={FLAT.line} pathLength={1} vectorEffect="non-scaling-stroke" />
      </svg>
    </>
  );
}
