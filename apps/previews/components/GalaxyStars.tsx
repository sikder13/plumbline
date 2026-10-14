'use client';

import { useEffect, useRef } from 'react';

/** A small seeded generator, so the sky is the same on every visit. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Glowworm light drawn into the dark: points thickest along the ceiling and in a band across it, some
 * with a thread hanging below, and a faint few on the water. Drawn once, when the section comes near,
 * into two layers so that one can shimmer against the other without the page doing any work.
 */
export function GalaxyStars({ cls }: { cls: { stars?: string; still?: string; shimmer?: string } }) {
  const still = useRef<HTMLCanvasElement>(null);
  const shimmer = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const a = still.current;
    const b = shimmer.current;
    const box = a?.parentElement;
    if (!a || !b || !box) return;
    let drawn = '';
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 64;
    const sg = sprite.getContext('2d')!;
    const grad = sg.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(240, 255, 255, 1)');
    grad.addColorStop(0.12, 'rgba(184, 250, 255, 0.9)');
    grad.addColorStop(0.35, 'rgba(110, 230, 245, 0.32)');
    grad.addColorStop(1, 'rgba(60, 200, 230, 0)');
    sg.fillStyle = grad;
    sg.fillRect(0, 0, 64, 64);

    const draw = () => {
      const w = box.clientWidth;
      const h = box.clientHeight;
      const key = `${w}x${h}`;
      if (!w || !h || key === drawn) return;
      drawn = key;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const ctxs = [a, b].map((c) => {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
        const g = c.getContext('2d')!;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, w, h);
        return g;
      });
      const r = seeded(4021);
      const n = Math.min(1500, Math.round((w * h) / 420));
      const ceiling = h * 0.66;
      const gauss = () => r() + r() + r() - 1.5;
      // Glowworms gather in patches on the rock, thickest where the ceiling is highest.
      const patches = Array.from({ length: 30 }, () => ({ x: r() * w, y: ceiling * Math.pow(r(), 1.3), spread: 0.025 + r() * 0.05 }));
      for (let i = 0; i < n; i++) {
        let x: number;
        let y: number;
        const pick = r();
        if (pick < 0.5) {
          const p = patches[Math.floor(r() * patches.length)]!;
          x = p.x + gauss() * w * p.spread;
          y = p.y + gauss() * h * p.spread * 0.8;
        } else if (pick < 0.75) {
          // The band of light across the ceiling, low on one side and high on the other.
          const t = r();
          x = w * (0.02 + 0.96 * t);
          y = h * (0.48 - 0.34 * t) + gauss() * h * 0.06;
        } else {
          x = r() * w;
          y = ceiling * Math.pow(r(), 1.7);
        }
        if (y < 0 || y > ceiling || x < 0 || x > w) continue;
        const near = 1 - y / ceiling;
        const size = (0.45 + r() * r() * 2) * (0.75 + near * 0.4);
        const g = ctxs[i % 10 < 3 ? 1 : 0]!;
        g.globalAlpha = 0.35 + r() * 0.65;
        const s = size * 7;
        g.drawImage(sprite, x - s / 2, y - s / 2, s, s);
        g.fillStyle = 'rgba(236, 255, 255, 0.95)';
        g.beginPath();
        g.arc(x, y, size * 0.55, 0, Math.PI * 2);
        g.fill();
        if (r() < 0.36) {
          const len = 8 + r() * 30;
          const line = g.createLinearGradient(x, y, x, y + len);
          line.addColorStop(0, 'rgba(184, 250, 255, 0.45)');
          line.addColorStop(1, 'rgba(184, 250, 255, 0)');
          g.strokeStyle = line;
          g.lineWidth = 0.7;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x + (r() - 0.5) * 1.5, y + len);
          g.stroke();
        }
        // A faint copy on the water below.
        if (r() < 0.12) {
          const ry = h * 0.82 + (ceiling - y) * 0.12;
          ctxs[0]!.globalAlpha = 0.18;
          ctxs[0]!.drawImage(sprite, x - s / 2, ry - s / 4, s, s / 2);
        }
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) draw();
      },
      { rootMargin: '900px 0px' },
    );
    io.observe(box);
    const resize = () => {
      if (drawn) draw();
    };
    window.addEventListener('resize', resize);
    return () => {
      io.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <span className={cls.stars} aria-hidden="true">
      <canvas ref={still} className={cls.still} />
      <canvas ref={shimmer} className={cls.shimmer} />
    </span>
  );
}
