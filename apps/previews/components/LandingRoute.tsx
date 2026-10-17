'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

/** A route measured as the page was made: evenly spaced points (x, y, x, y ...), its length, where each stop is along it, and the kayak's size. */
export interface RouteTrack {
  pts: number[];
  len: number;
  at: number[];
  boat: number;
}

/** Runs once the browser has a moment to spare. */
function whenIdle(run: () => void): () => void {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(run, { timeout: 2500 });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(run, 300);
  return () => window.clearTimeout(id);
}

const DWELL = 0.6;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Holds the chart still while the visitor scrolls and moves the kayak along its route, pausing at each
 * stop while that stop's words light; a sail goes up for the sailing stop and a cup steams when it
 * lands. Nothing runs until the browser is idle and the chart is near the screen; then one passive
 * scroll listener looks the kayak's place up in the measured route once a frame. With reduced motion
 * asked for, the kayak is simply shown on the last beach.
 */
export function LandingRoute({ tracks, steps, cls, children }: { tracks: { phone: RouteTrack; desk: RouteTrack }; steps: number; cls: Record<'track' | 'frame', string | undefined>; children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const o = outer.current;
    if (!o) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const wide = window.matchMedia('(min-width: 900px)');
    let last = -1;
    let frame = 0;
    let listening = false;
    let marks: HTMLElement[] | SVGElement[] = [];

    const apply = (p: number) => {
      const key = wide.matches ? 'desk' : 'phone';
      const t = tracks[key];
      const svg = o.querySelector(`svg[data-geo="${key}"]`);
      const boat = svg?.querySelector('[data-boat]');
      const wake = svg?.querySelector<SVGPathElement>('[data-wake]');
      if (!boat || !wake) return;
      const n = t.at.length;
      // The scroll is shared out as a pause at each stop and a paddle between each two.
      let u = Math.min(1, Math.max(0, p)) * (n * DWELL + (n - 1));
      let d = t.at[n - 1]!;
      for (let i = 0; i < n; i++) {
        if (u <= DWELL) {
          d = t.at[i]!;
          break;
        }
        u -= DWELL;
        if (i === n - 1) break;
        if (u <= 1) {
          d = t.at[i]! + (t.at[i + 1]! - t.at[i]!) * ease(u);
          break;
        }
        u -= 1;
      }
      const count = t.pts.length / 2 - 1;
      const f = Math.min(count, Math.max(0, (d / t.len) * count));
      const i = Math.min(count - 1, Math.floor(f));
      const r = f - i;
      const x = t.pts[2 * i]! + (t.pts[2 * i + 2]! - t.pts[2 * i]!) * r;
      const y = t.pts[2 * i + 1]! + (t.pts[2 * i + 3]! - t.pts[2 * i + 1]!) * r;
      const a = Math.max(0, i - 1);
      const b = Math.min(count, i + 2);
      const angle = (Math.atan2(t.pts[2 * b + 1]! - t.pts[2 * a + 1]!, t.pts[2 * b]! - t.pts[2 * a]!) * 180) / Math.PI;
      const k = t.boat / 166;
      boat.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(1)}) translate(${(-104 * k).toFixed(2)} ${(-24 * k).toFixed(2)})`);
      wake.style.strokeDasharray = `${d.toFixed(1)} ${Math.ceil(t.len + 10)}`;
      let active = 0;
      t.at.forEach((s, j) => {
        if (d >= s - 1.5) active = j;
      });
      const landed = active === n - 1 && d >= t.at[n - 1]! - 1.5;
      o.toggleAttribute('data-sail', active >= 2 && !landed);
      o.toggleAttribute('data-landed', landed);
      o.toggleAttribute('data-moving', d > t.at[active]! + 1.5);
      if (active === last) return;
      last = active;
      o.setAttribute('data-active', String(active));
      if (!marks.length) marks = [...o.querySelectorAll<HTMLElement>('[data-step]')];
      for (const m of marks) {
        const j = Number(m.dataset.step);
        m.dataset.state = j === active ? 'on' : j < active ? 'done' : 'off';
      }
    };

    const progress = () => {
      const box = o.getBoundingClientRect();
      const room = box.height - window.innerHeight;
      return room > 0 ? -box.top / room : 1;
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        apply(progress());
      });
    };
    const onWide = () => {
      last = -1;
      if (reduce) apply(1);
      else onScroll();
    };

    let io: IntersectionObserver | undefined;
    const cancel = whenIdle(() => {
      wide.addEventListener('change', onWide);
      if (reduce) {
        apply(1);
        return;
      }
      io = new IntersectionObserver(
        ([e]) => {
          if (e?.isIntersecting && !listening) {
            listening = true;
            window.addEventListener('scroll', onScroll, { passive: true });
            onScroll();
          } else if (!e?.isIntersecting && listening) {
            listening = false;
            window.removeEventListener('scroll', onScroll);
          }
        },
        { rootMargin: '40% 0px' },
      );
      io.observe(o);
    });
    return () => {
      cancel();
      io?.disconnect();
      window.removeEventListener('scroll', onScroll);
      wide.removeEventListener('change', onWide);
      cancelAnimationFrame(frame);
    };
  }, [tracks]);

  return (
    <div ref={outer} className={cls.track} data-active="0" style={{ '--steps': steps } as CSSProperties}>
      <div className={cls.frame}>{children}</div>
    </div>
  );
}
