'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { areaPath, linePath, slice, yAt, type Pt } from './SkylineShape';

export interface RoadStop {
  x: number;
  name: string;
  figure: string;
  line: string;
}

export interface RoadChapter {
  name: string;
  from: number;
  to: number;
  sky: [string, string];
  stops: RoadStop[];
  photo?: ReactNode;
}

type Cls = Record<
  | 'road'
  | 'frame'
  | 'mini'
  | 'miniSvg'
  | 'miniEnds'
  | 'miniMark'
  | 'chapter'
  | 'chapterTitle'
  | 'band'
  | 'bandPhoto'
  | 'bandSvg'
  | 'contour'
  | 'under'
  | 'ridge'
  | 'dot'
  | 'label'
  | 'marker'
  | 'read'
  | 'readFigure'
  | 'readName'
  | 'readLine',
  string | undefined
>;

/**
 * A road held on screen, told in chapters. Each chapter is a band of its own photograph (or of
 * its sky, where there is none) with the road's profile riding across it; a marker travels the
 * line and the stop it has reached is written out large beneath. Chapters and stops change with a
 * clean cut. With reduced motion every chapter and every stop simply lies in order down the page.
 */
export function SkylineRoad({ points, chapters, from, to, cls }: { points: Pt[]; chapters: RoadChapter[]; from: string; to: string; cls: Cls }) {
  const outer = useRef<HTMLDivElement>(null);
  const steps = chapters.length;
  const first = points[0]?.[0] ?? 0;
  const last = points[points.length - 1]?.[0] ?? 100;
  const span = last - first;

  useEffect(() => {
    const o = outer.current;
    if (!o || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    let lastStep = -1;
    let lastNow = '';
    const marks = [...o.querySelectorAll<HTMLElement>('[data-step]')];
    const stops = [...o.querySelectorAll<HTMLElement>('[data-x]')];
    for (const img of o.querySelectorAll<HTMLImageElement>('img[loading="lazy"]')) img.loading = 'eager';
    // Once the page has loaded, the rest of its photographs are fetched too, so a quick scroll never meets an empty frame.
    let later = 0;
    const fetchRest = () => {
      later = window.setTimeout(() => {
        for (const img of document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]')) img.loading = 'eager';
      }, 1200);
    };
    if (document.readyState === 'complete') fetchRest();
    else window.addEventListener('load', fetchRest, { once: true });

    const apply = (p: number) => {
      const k = Math.min(steps - 1, Math.max(0, Math.floor(p * steps)));
      const f = Math.min(1, Math.max(0, p * steps - k));
      const ch = chapters[k]!;
      const x = ch.from + (0.04 + f * 0.92) * (ch.to - ch.from);
      o.style.setProperty('--mx', `${(((x - ch.from) / (ch.to - ch.from)) * 100).toFixed(3)}%`);
      o.style.setProperty('--my', `${yAt(points, x).toFixed(3)}%`);
      o.style.setProperty('--gx', `${(((x - first) / span) * 100).toFixed(3)}%`);
      if (k !== lastStep) {
        lastStep = k;
        o.dataset.active = String(k);
        for (const m of marks) {
          const n = Number(m.dataset.step);
          m.dataset.state = n === k ? 'on' : n < k ? 'done' : 'off';
        }
      }
      // The stop being read is the last one the marker has reached in this chapter, or its first before then.
      const reached = ch.stops.filter((sp) => sp.x <= x);
      const now = `${k}:${(reached[reached.length - 1] ?? ch.stops[0])?.x}`;
      if (now !== lastNow) {
        lastNow = now;
        for (const el of stops) {
          const [ck, sx] = [el.closest<HTMLElement>('[data-step]')?.dataset.step, el.dataset.x];
          el.toggleAttribute('data-now', `${ck}:${sx}` === now);
          el.toggleAttribute('data-lit', Number(ck) === k && Number(sx) <= x);
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
      window.clearTimeout(later);
      window.removeEventListener('load', fetchRest);
    };
  }, [points, chapters, steps, first, span]);

  const state = (i: number) => (i === 0 ? 'on' : 'off');
  const pctIn = (ch: RoadChapter, x: number) => `${(((x - ch.from) / (ch.to - ch.from)) * 100).toFixed(3)}%`;
  const c0 = chapters[0];
  const startX = c0 ? c0.from + 0.04 * (c0.to - c0.from) : first;

  return (
    <div
      ref={outer}
      className={cls.road}
      data-active="0"
      style={{ '--n': steps, '--mx': '4%', '--my': `${yAt(points, startX).toFixed(3)}%`, '--gx': `${(((startX - first) / span) * 100).toFixed(3)}%` } as CSSProperties}
    >
      <div className={cls.frame}>
        <div className={cls.mini} aria-hidden="true">
          <svg className={cls.miniSvg} viewBox={`${first} 0 ${span} 100`} preserveAspectRatio="none" focusable="false">
            <path d={linePath(points)} />
            {chapters.map((ch, i) => (
              <path key={ch.name} data-step={i} data-state={state(i)} d={linePath(slice(points, ch.from, ch.to))} />
            ))}
          </svg>
          <i className={cls.miniMark} />
          <p className={cls.miniEnds}>
            <span>{from}</span>
            <span>{to}</span>
          </p>
        </div>

        {chapters.map((ch, i) => {
          const part = slice(points, ch.from, ch.to);
          return (
            <section key={ch.name} className={cls.chapter} data-step={i} data-state={state(i)} aria-label={ch.name} style={{ '--sky-a': ch.sky[0], '--sky-b': ch.sky[1] } as CSSProperties}>
              <h3 className={cls.chapterTitle}>{ch.name}</h3>
              <div className={cls.band} aria-hidden="true">
                {ch.photo && <div className={cls.bandPhoto}>{ch.photo}</div>}
                <svg className={cls.bandSvg} viewBox={`${ch.from} 0 ${ch.to - ch.from} 100`} preserveAspectRatio="none" focusable="false">
                  {[10, 20, 30].map((lift) => (
                    <path key={lift} className={cls.contour} d={linePath(part, lift)} />
                  ))}
                  <path className={cls.under} d={areaPath(part, 100)} />
                  <path className={cls.ridge} d={linePath(part)} />
                </svg>
                {ch.stops.map((sp) => (
                  <span key={sp.name} className={cls.dot} data-x={sp.x} style={{ left: pctIn(ch, sp.x), top: `${yAt(points, sp.x).toFixed(3)}%` }}>
                    <span className={cls.label}>{sp.name}</span>
                  </span>
                ))}
                <i className={cls.marker} />
              </div>
              <ol className={cls.read}>
                {ch.stops.map((sp, j) => (
                  <li key={sp.name} data-x={sp.x} data-now={i === 0 && j === 0 ? '' : undefined}>
                    <p className={cls.readFigure}>{sp.figure}</p>
                    <p className={cls.readName}>{sp.name}</p>
                    <p className={cls.readLine}>{sp.line}</p>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </div>
    </div>
  );
}
