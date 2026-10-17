'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { whenNear } from './MeanderIdle';

/** Wide screens drive the tall side road; phones drive the short one across the top. */
const WIDE = '(min-width: 900px)';

/**
 * A frame that holds still while the visitor scrolls through its steps. Each `[data-step]` inside is
 * told whether it is current, passed or to come; the frame carries the progress as `--p`; and the
 * minibus on the road marked `data-track` for this screen size is driven along it to the same point.
 * When a step comes in, any route drawing inside it starts. Nothing runs until the section is near
 * and the browser is idle. With reduced motion asked for, every step simply shows.
 */
export function MeanderPin({ steps, children, className }: { steps: number; children: ReactNode; className?: string }) {
  const outer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const o = outer.current;
    if (!o) return;
    let stop: (() => void) | undefined;
    let cancelled = false;

    const setup = () => {
      if (cancelled) return;
      const marks = [...o.querySelectorAll<HTMLElement>('[data-step]')];
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        o.setAttribute('data-still', '');
        for (const m of marks) m.dataset.state = 'on';
        return;
      }
      let last = -1;
      // Photographs waiting behind the first step are asked for now that the section is close.
      for (const img of o.querySelectorAll<HTMLImageElement>('img[loading="lazy"]')) img.loading = 'eager';
      const wide = window.matchMedia(WIDE);
      const tracks = [...o.querySelectorAll<SVGPathElement>('path[data-track]')].flatMap((path) => {
        const svg = path.ownerSVGElement;
        const van = svg?.querySelector<SVGGElement>('[data-van]');
        try {
          const length = path.getTotalLength();
          return svg && van && length > 0 ? [{ path, van, length, tall: svg.viewBox.baseVal.height > svg.viewBox.baseVal.width }] : [];
        } catch {
          return [];
        }
      });
      const drive = (progress: number) => {
        for (const t of tracks) {
          if (t.tall !== wide.matches) continue;
          const at = Math.min(t.length - 0.5, Math.max(0.5, progress * t.length));
          const a = t.path.getPointAtLength(at - 0.5);
          const b = t.path.getPointAtLength(at + 0.5);
          const p = t.path.getPointAtLength(at);
          const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
          t.van.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${angle.toFixed(1)})`);
        }
      };
      const apply = (progress: number) => {
        o.style.setProperty('--p', progress.toFixed(4));
        drive(progress);
        const i = Math.min(steps - 1, Math.max(0, Math.floor(progress * steps)));
        if (i === last) return;
        last = i;
        o.setAttribute('data-active', String(i));
        for (const m of marks) {
          const n = Number(m.dataset.step);
          m.dataset.state = n === i ? 'on' : n < i ? 'done' : 'off';
        }
        for (const a of o.querySelectorAll<SVGAnimationElement>(`[data-step="${i}"] animateMotion`)) {
          try {
            a.beginElement();
          } catch {
            /* a browser without SMIL leaves the minibus parked */
          }
        }
      };
      void import('motion').then(({ scroll }) => {
        if (cancelled) return;
        stop = scroll(apply, { target: o, offset: ['start start', 'end end'] });
      });
    };

    const cancelNear = whenNear(o, setup);
    return () => {
      cancelled = true;
      cancelNear();
      stop?.();
    };
  }, [steps]);

  return (
    <div ref={outer} className={className} data-active="0" style={{ '--steps': steps, '--p': 0 } as CSSProperties}>
      <div data-frame>{children}</div>
    </div>
  );
}
