'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BearingDial, type DialClasses } from './BearingDial';

export interface ContactWay {
  point: string;
  label: string;
  value: string;
  href?: string;
}

/** The ways sit in the four quarters, so the needle points into each: north east, south east, south west, north west. */
const TURN: Record<number, number> = { 0: 45, 1: 135, 2: 225, 3: 315 };

/**
 * A compass whose four points are the four ways to reach the business. The needle turns to whichever way
 * the visitor points at or tabs to, and when the compass first comes into view it goes round all four once
 * and comes back to the first, the main action.
 */
export function BearingContact({ ways, points, cls, dial }: { ways: ContactWay[]; points: string[]; cls: Record<string, string | undefined>; dial: DialClasses }) {
  const [now, setNow] = useState(0);
  const [turn, setTurn] = useState(45);
  const ref = useRef<HTMLDivElement>(null);
  const touched = useRef(false);
  const turnRef = useRef(45);

  const point = (i: number) => {
    let d = TURN[i] ?? 0;
    while (d - turnRef.current > 180) d -= 360;
    while (d - turnRef.current < -180) d += 360;
    turnRef.current = d;
    setTurn(d);
    setNow(i);
  };

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timers: number[] = [];
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        [1, 2, 3, 0].forEach((i, k) => {
          timers.push(
            window.setTimeout(() => {
              if (!touched.current) point(i);
            }, 500 + k * 700),
          );
        });
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      for (const t of timers) window.clearTimeout(t);
    };
    // Set up once, when the compass first shows.
  }, []);

  const hold = (i: number) => () => {
    touched.current = true;
    point(i);
  };

  return (
    <div className={cls.compass} ref={ref}>
      <div className={cls.dialBox} style={{ '--aim': `${turn}deg` } as CSSProperties}>
        <BearingDial points={points} cls={dial} />
      </div>
      <ul className={cls.ways}>
        {ways.map((w, i) => (
          <li key={w.point} className={cls.way} data-point={w.point} data-on={i === now || undefined}>
            {w.href ? (
              <a href={w.href} rel={w.href.startsWith('http') ? 'noopener' : undefined} onPointerEnter={hold(i)} onFocus={hold(i)} data-press>
                <i aria-hidden="true">{w.point}</i>
                <b>{w.label}</b>
                <span>{w.value}</span>
              </a>
            ) : (
              <p onPointerEnter={hold(i)}>
                <i aria-hidden="true">{w.point}</i>
                <b>{w.label}</b>
                <span>{w.value}</span>
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
