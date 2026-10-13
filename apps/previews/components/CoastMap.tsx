'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { scrollPageTo } from './MotionLayer';

interface Spot {
  id: string;
  x: number;
  y: number;
  side: string;
  name: string;
  tag: string;
  text: string;
}

interface Props {
  viewBox: string;
  paths: string[];
  spots: Spot[];
  credit: string;
  /** The section's heading, held in view with the map. */
  head?: ReactNode;
  className?: string;
}

/**
 * The coast, held in view while the visitor scrolls through its spots. Each step of the scroll
 * lights the next dot and opens what the business says about it. A tap on a dot or on the list
 * goes straight to that spot.
 */
export function CoastMap({ viewBox, paths, spots, credit, head, className }: Props) {
  const outer = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [seen, setSeen] = useState(false);
  const [x0, y0, w, h] = viewBox.split(' ').map(Number) as [number, number, number, number];

  useEffect(() => {
    const o = outer.current;
    if (!o) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    // The section is several screens tall, so it is counted as seen once it reaches into the middle of the screen.
    const io = new IntersectionObserver(([e]) => e!.isIntersecting && setSeen(true), { rootMargin: '-35% 0px -35% 0px' });
    io.observe(o);
    void import('motion').then(({ scroll }) => {
      if (cancelled) return;
      stop = scroll((progress: number) => setActive(Math.min(spots.length - 1, Math.floor(progress * spots.length))), { target: o, offset: ['start start', 'end end'] });
    });
    return () => {
      cancelled = true;
      stop?.();
      io.disconnect();
    };
  }, [spots.length]);

  const go = (i: number) => {
    const o = outer.current;
    if (!o) return setActive(i);
    const top = o.getBoundingClientRect().top + window.scrollY;
    const travel = o.offsetHeight - window.innerHeight;
    scrollPageTo(top + ((i + 0.5) / spots.length) * travel);
  };

  return (
    <div ref={outer} className={className} data-seen={seen ? '' : undefined} style={{ ['--steps' as string]: spots.length }}>
      <div data-frame>
        {head}
        <div data-map style={{ aspectRatio: `${w} / ${h}` }}>
          <svg viewBox={viewBox} aria-hidden="true" focusable="false">
            {paths.map((d) => (
              <path key={d} d={d} pathLength={1} />
            ))}
          </svg>
          {spots.map((s, i) => (
            <button key={s.id} type="button" data-side={s.side} data-state={i === active ? 'on' : i < active ? 'done' : 'off'} aria-pressed={i === active} onClick={() => go(i)} style={{ left: `${((s.x - x0) / w) * 100}%`, top: `${((s.y - y0) / h) * 100}%` }}>
              <i aria-hidden="true" />
              <span>{s.name}</span>
            </button>
          ))}
          <p data-credit>{credit}</p>
        </div>
        <ol data-legend>
          {spots.map((s, i) => (
            <li key={s.id} data-state={i === active ? 'on' : i < active ? 'done' : 'off'}>
              <button type="button" aria-expanded={i === active} onClick={() => go(i)}>
                <span data-name>{s.name}</span>
                <span data-tag>{s.tag}</span>
              </button>
              <div data-text>
                <p>{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
