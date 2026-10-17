'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

const GLYPHS = 'ABCDEFGHKMNOPRSTUVWXZ#/+=';

/** Letters that flicker through other letters for a moment, then settle on the word, left to right. */
function settle(el: HTMLElement) {
  const word = el.dataset.word ?? el.textContent ?? '';
  el.dataset.word = word;
  const start = performance.now();
  const length = 420;
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / length);
    const fixed = Math.floor(t * word.length);
    let out = word.slice(0, fixed);
    for (let k = fixed; k < word.length; k++) out += word[k] === ' ' ? ' ' : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    el.textContent = out;
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = word;
  };
  requestAnimationFrame(tick);
}

/**
 * A held frame that hauls a line up as the visitor scrolls, never still for long: each step slows as
 * it reaches the surface, then the line hauls the next one up. The frame carries the overall progress
 * as `--p` and the hauled distance as `--rig` (0 for the first step, 1 for the second ...). Anything
 * marked `data-step` is told whether its step is current, passed or still to come, and is given `--d`,
 * how far it still is from the surface (1 a whole step below, 0 at it, negative once past), so the
 * styles can scrub its own changes. Words marked `data-settle` in a step flicker into place as it
 * arrives. Before the script, or with reduced motion asked for, the first step shows and the styles
 * lay the steps out one after another.
 */
export function HaulReel({ steps, className, children }: { steps: number; className?: string; children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const o = outer.current;
    if (!o || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (const img of o.querySelectorAll<HTMLImageElement>('img[loading="lazy"]')) img.loading = 'eager';
    const marks = [...o.querySelectorAll<HTMLElement>('[data-step]')];
    const hold = 0.16;
    let last = -1;
    let stop: (() => void) | undefined;
    let cancelled = false;
    const apply = (p: number) => {
      const s = Math.min(steps - 0.0001, Math.max(0, p * steps));
      const i = Math.floor(s);
      const t = (s - i - hold) / (1 - hold);
      // The last one keeps rising a little, so the end of the story still moves.
      const k = t <= 0 ? 0 : i < steps - 1 ? t * t * (3 - 2 * t) : t * 0.22;
      const rig = i + k;
      o.style.setProperty('--p', p.toFixed(4));
      o.style.setProperty('--rig', rig.toFixed(4));
      for (const m of marks) m.style.setProperty('--d', (Number(m.dataset.step) - rig).toFixed(3));
      const now = i < steps - 1 && k > 0.5 ? i + 1 : i;
      if (now === last) return;
      last = now;
      o.dataset.active = String(now);
      for (const m of marks) {
        const n = Number(m.dataset.step);
        const was = m.dataset.state;
        m.dataset.state = n === now ? 'on' : n < now ? 'done' : 'off';
        if (n === now && was !== 'on') for (const w of m.querySelectorAll<HTMLElement>('[data-settle]')) settle(w);
      }
    };
    void import('motion').then(({ scroll }) => {
      if (cancelled) return;
      o.dataset.live = '';
      stop = scroll(apply, { target: o, offset: ['start start', 'end end'] });
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [steps]);

  return (
    <div ref={outer} className={className} data-active="0" style={{ '--steps': steps, '--p': 0, '--rig': 0 } as CSSProperties}>
      <div data-frame>{children}</div>
    </div>
  );
}
