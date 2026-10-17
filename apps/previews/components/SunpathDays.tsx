'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/**
 * Days and nights told by one sky. The frame holds still while the visitor scrolls through the steps. A
 * day step gives the stretch of the sun's path it covers (0 is sunrise, 1 is sunset, beyond them is
 * night); a night step (`null`) has the moon cross instead. The frame carries the sun's place (`--sx`
 * across, `--sy` up), the moon's (`--mx`, `--my`), and how much of dawn, dusk and night the sky shows
 * (`--dawn`, `--dusk`, `--night`), and is marked `data-night-top` once the top of the sky is dark and
 * `data-night` once all of it is. The step being told is marked on `[data-step]` (`on`, `done` or `off`),
 * a beat marked `data-at` (a point in its step, `data-of` naming the step) is marked `data-on` once that
 * point is reached, and a tally mark `[data-k]` is marked `data-lit` once its step has come. Before the
 * script arrives the first step shows; with reduced motion asked for the styles lay the steps out one after
 * another and this does nothing.
 */
export function SunpathDays({ path, children, className }: { path: ([number, number] | null)[]; children: ReactNode; className?: string }) {
  const outer = useRef<HTMLDivElement>(null);
  const key = JSON.stringify(path);

  useEffect(() => {
    const o = outer.current;
    if (!o || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const steps = JSON.parse(key) as ([number, number] | null)[];
    const n = steps.length;
    const marks = [...o.querySelectorAll<HTMLElement>('[data-step]')];
    const beats = [...o.querySelectorAll<HTMLElement>('[data-at]')].map((el) => ({ el, at: Number(el.dataset.at), of: Number(el.dataset.of), on: el.hasAttribute('data-on') }));
    const tally = [...o.querySelectorAll<HTMLElement>('[data-k]')].map((el) => ({ el, k: Number(el.dataset.k), lit: el.hasAttribute('data-lit') }));
    // The steps further down wait behind the first one; once the page has painted they are all asked for.
    for (const img of o.querySelectorAll<HTMLImageElement>('img[loading="lazy"]')) img.loading = 'eager';
    let current = -1;
    let night = o.hasAttribute('data-night');
    let top = o.hasAttribute('data-night-top');
    let stop: (() => void) | undefined;
    let cancelled = false;
    const set = (name: string, v: number) => o.style.setProperty(name, v.toFixed(4));

    const apply = (p: number) => {
      const x = clamp(p * n, 0, n - 0.0001);
      const i = Math.floor(x);
      const t = x - i;
      const span = steps[i];
      let local = t;
      if (span) {
        const sun = span[0] + (span[1] - span[0]) * t;
        local = sun;
        const up = sun < 0 ? sun * 2.4 : sun > 1 ? (1 - sun) * 2.4 : Math.sin(Math.PI * sun);
        const dark = clamp(clamp((sun - 0.97) / 0.09) + clamp((0.03 - sun) / 0.09));
        set('--sx', clamp(sun, -0.08, 1.08));
        set('--sy', up);
        set('--dawn', 1 - clamp((sun - 0.04) / 0.2));
        set('--dusk', clamp((sun - 0.62) / 0.3));
        set('--night', dark);
        set('--mx', sun > 0.5 ? 0 : 1);
        set('--my', -0.6);
      } else {
        // The moon rises at the left as the night begins and sets at the right before the next day.
        set('--sy', -1);
        set('--dawn', 0);
        set('--dusk', 0);
        set('--night', 1);
        set('--mx', t);
        set('--my', Math.sin(Math.PI * clamp(t * 1.1 - 0.05)));
      }
      if (i !== current) {
        current = i;
        o.dataset.active = String(i);
        for (const m of marks) {
          const k = Number(m.dataset.step);
          m.dataset.state = k === i ? 'on' : k < i ? 'done' : 'off';
        }
        for (const tm of tally) {
          const lit = tm.k <= i;
          if (lit !== tm.lit) {
            tm.lit = lit;
            tm.el.toggleAttribute('data-lit', lit);
          }
        }
      }
      const dark = span ? clamp(clamp((local - 0.97) / 0.09) + clamp((0.03 - local) / 0.09)) : 1;
      // The top of the sky darkens first, so the heading turns light before the words lower down.
      const isNight = dark > 0.6;
      if (isNight !== night) {
        night = isNight;
        o.toggleAttribute('data-night', isNight);
      }
      const isTop = dark > 0.22;
      if (isTop !== top) {
        top = isTop;
        o.toggleAttribute('data-night-top', isTop);
      }
      for (const b of beats) {
        const on = b.of < i || (b.of === i && local >= b.at);
        if (on !== b.on) {
          b.on = on;
          b.el.toggleAttribute('data-on', on);
        }
      }
    };

    void import('motion').then(({ scroll }) => {
      if (cancelled) return;
      stop = scroll(apply, { target: o, offset: ['start start', 'end end'] });
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [key]);

  // Before the script arrives, the sun stands a little into the first day. Written as fixed strings, so the server and the browser agree.
  const first = path[0] ?? [0.5, 1];
  const sx = first[0] + 0.12;
  const start = {
    '--steps': String(path.length),
    '--sx': sx.toFixed(3),
    '--sy': Math.sin(Math.PI * sx).toFixed(3),
    '--mx': '0',
    '--my': '-0.6',
    '--dawn': '0',
    '--dusk': '0.2',
    '--night': '0',
  };
  return (
    <div ref={outer} className={className} data-active="0" style={start as CSSProperties}>
      <div data-frame>{children}</div>
    </div>
  );
}
