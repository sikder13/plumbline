'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BearingDial, type DialClasses } from './BearingDial';

export interface GuestQuote {
  text: string;
  by: string;
  from: string;
  /** The bearing from the business's town to where the guests came from, in degrees. */
  at: number;
  bearing: string;
}

/**
 * Guests' own words, one large quote at a time, with a compass whose needle swings to where those guests
 * came from. While the section is in view the next guest follows every few seconds; the visitor can step
 * on with one button, which also stops the turning. Every quote is laid out in the same place, so the
 * section keeps the height of the longest.
 */
export function BearingGuests({ quotes, next, points, cls, dial }: { quotes: GuestQuote[]; next: string; points: string[]; cls: Record<string, string | undefined>; dial: DialClasses }) {
  const [now, setNow] = useState(0);
  const [turn, setTurn] = useState(quotes[0]?.at ?? 0);
  const [running, setRunning] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const held = useRef(false);
  const turnRef = useRef(turn);

  const go = (i: number) => {
    let d = quotes[i]?.at ?? 0;
    while (d - turnRef.current > 180) d -= 360;
    while (d - turnRef.current < -180) d += 360;
    turnRef.current = d;
    setTurn(d);
    setNow(i);
  };

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const io = new IntersectionObserver(([e]) => setRunning(!!e?.isIntersecting && !held.current), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => go((now + 1) % quotes.length), 3400);
    return () => window.clearTimeout(t);
    // Each guest's turn is timed from the moment it shows.
  }, [running, now]);

  const q = quotes[now];
  return (
    <div className={cls.guests} ref={ref} data-running={running || undefined}>
      <div className={cls.guestDial} style={{ '--aim': `${turn}deg` } as CSSProperties}>
        <BearingDial points={points} cls={dial} />
        <p className={cls.guestBearing} aria-hidden="true" key={`b${now}`}>
          {q?.bearing}
        </p>
      </div>
      <div className={cls.says}>
        {quotes.map((g, i) => (
          <figure key={g.by} className={cls.say} data-state={i === now ? 'on' : 'off'} aria-hidden={i !== now}>
            <blockquote>
              <p>{g.text}</p>
            </blockquote>
            <figcaption>
              <b>{g.by}</b>
              <span>{g.from}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <button
        type="button"
        className={cls.nextGuest}
        onClick={() => {
          held.current = true;
          setRunning(false);
          go((now + 1) % quotes.length);
        }}
      >
        <span>{next}</span>
        <i aria-hidden="true" key={`n${now}`} />
      </button>
    </div>
  );
}
