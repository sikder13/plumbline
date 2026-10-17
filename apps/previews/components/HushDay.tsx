'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

interface Trip {
  when: string;
  /** Start and end on a 24 hour clock. A trip without one runs the day long. */
  span?: [number, number];
  name: string;
  tag: string;
  text: string;
  facts: string[];
  price: string;
  per: string;
  picture: ReactNode;
}

type Cls = Record<
  'box' | 'axis' | 'sky' | 'tick' | 'sun' | 'span' | 'whole' | 'ends' | 'panels' | 'panel' | 'shot' | 'body' | 'name' | 'tag' | 'text' | 'facts' | 'buy' | 'price' | 'go',
  string | undefined
>;

type Vars = CSSProperties & Record<`--${string}`, string | number>;

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * The harbour day, sunrise to dusk, at its true scale: each trip is the span of the day it is on the
 * water, and tapping a span opens its price and booking right there. A trip that fills the day lies
 * under the whole axis. When it first comes into view it opens each span in turn, then waits.
 */
export function HushDay({ trips, labels, book, cls }: { trips: Trip[]; labels: { dawn: string; dusk: string; book: string }; book: string; cls: Cls }) {
  const [cur, setCur] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const touched = useRef(false);
  const timed = trips.filter((t) => t.span);
  const from = Math.min(...timed.map((t) => t.span![0])) - 0.75;
  const to = Math.max(...timed.map((t) => t.span![1])) + 0.75;
  const at = (h: number) => ((h - from) / (to - from)) * 100;
  const hours = Array.from({ length: Math.floor(to) - Math.ceil(from) + 1 }, (_, i) => Math.ceil(from) + i);
  const active = trips[cur];
  const sun = active?.span ? at((active.span[0] + active.span[1]) / 2) : 50;

  useEffect(() => {
    const el = box.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timers: number[] = [];
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        for (let k = 1; k <= trips.length; k++) timers.push(window.setTimeout(() => void (touched.current || setCur(k % trips.length)), k * 1250));
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      for (const t of timers) window.clearTimeout(t);
    };
  }, [trips.length]);

  const pick = (i: number) => {
    touched.current = true;
    setCur(i);
  };

  return (
    <div ref={box} className={cls.box}>
      <div className={cls.axis} style={{ '--sun': `${sun}%` } as Vars}>
        <span className={cls.sky} aria-hidden="true" />
        {hours.map((h) => (
          <span key={h} className={cls.tick} style={{ '--x': `${at(h)}%` } as Vars} aria-hidden="true" />
        ))}
        <span className={cls.sun} aria-hidden="true" />
        {trips.map((t, i) =>
          t.span ? (
            <button
              key={t.name}
              type="button"
              className={cls.span}
              style={{ '--l': `${at(t.span[0])}%`, '--r': `${100 - at(t.span[1])}%` } as Vars}
              aria-pressed={i === cur}
              aria-controls={`day-${i}`}
              onClick={() => pick(i)}
            >
              <span>{t.when}</span>
              <span>{t.name}</span>
            </button>
          ) : (
            <button key={t.name} type="button" className={cls.whole} aria-pressed={i === cur} aria-controls={`day-${i}`} onClick={() => pick(i)}>
              <span>{t.when}</span>
              <span>{t.name}</span>
            </button>
          ),
        )}
        <p className={cls.ends} aria-hidden="true">
          <span>{labels.dawn}</span>
          <span>{labels.dusk}</span>
        </p>
      </div>
      <div className={cls.panels} aria-live="polite">
        {trips.map((t, i) => (
          <section key={t.name} id={`day-${i}`} className={cls.panel} data-on={i === cur ? '' : undefined} aria-hidden={i === cur ? undefined : true} aria-label={t.name}>
            <div className={cls.shot}>{t.picture}</div>
            <div className={cls.body}>
              <h3 className={cls.name}>
                {t.name} <span className={cls.tag}>{t.tag}</span>
              </h3>
              <p className={cls.text}>{t.text}</p>
              <ul className={cls.facts}>
                {t.facts.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <div className={cls.buy}>
                <p className={cls.price}>
                  <b>{t.price}</b>
                  <span>{t.per}</span>
                </p>
                <a className={cls.go} data-press href={book} rel="noopener" tabIndex={i === cur ? undefined : -1} aria-label={`${labels.book} ${t.name}, ${t.price}`}>
                  {labels.book}
                  <Arrow />
                </a>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
