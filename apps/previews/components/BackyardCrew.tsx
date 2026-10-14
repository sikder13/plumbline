'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface CrewCard {
  nick: string;
  name: string;
  text: string;
  /** The person's own photograph, large, for the stack. */
  picture: ReactNode;
  /** The same photograph, small, for the row of faces. */
  thumb: ReactNode;
}

interface Props {
  people: CrewCard[];
  start: number;
  cue: string;
  next: string;
  label: string;
  cls: {
    stage: string;
    deck: string;
    card: string;
    photo: string;
    tag: string;
    caption: string;
    who: string;
    said: string;
    cue: string;
    faces: string;
    face: string;
    nextBtn: string;
  };
}

/** Runs `run` once the browser has nothing better to do, so nothing here competes with the page loading. */
function whenIdle(run: () => void): () => void {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(run, { timeout: 4000 });
    return () => w.cancelIdleCallback?.(id);
  }
  const t = window.setTimeout(run, 1500);
  return () => window.clearTimeout(t);
}

/**
 * A crew told by their faces. A large stack of their own photographs, each with the person's
 * nickname written on it, and beneath it a row of the same faces: pressing one deals that person's
 * card to the top, the card before it slid aside. The photographs are fetched only as the stack
 * comes near; while it is on screen and nobody has touched it, it deals the next card by itself every
 * few seconds. Nothing runs until the page has finished loading. A swipe across the stack deals the
 * next or the one before. With reduced motion asked for, nothing deals by itself.
 */
export function BackyardCrew({ people, start, cue, next, label, cls }: Props) {
  const n = people.length;
  const [deal, setDeal] = useState<{ cur: number; prev: number | null }>({ cur: start % n, prev: null });
  const [touched, setTouched] = useState(false);
  const [near, setNear] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const x0 = useRef<number | null>(null);

  const go = (i: number) =>
    setDeal((d) => {
      const target = ((i % n) + n) % n;
      return target === d.cur ? d : { cur: target, prev: d.cur };
    });

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let io: IntersectionObserver | undefined;
    const cancel = whenIdle(() => {
      io = new IntersectionObserver(
        ([e]) => {
          if (!e!.isIntersecting) return;
          setNear(true);
          io!.disconnect();
        },
        { rootMargin: '360px 0px' },
      );
      io.observe(el);
    });
    return () => {
      cancel();
      io?.disconnect();
    };
  }, []);

  useEffect(() => {
    const el = stage.current;
    if (!el || !near || touched || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let timer: number | undefined;
    let first: number | undefined;
    const step = () => setDeal((d) => ({ cur: (d.cur + 1) % n, prev: d.cur }));
    const io = new IntersectionObserver(
      ([e]) => {
        window.clearInterval(timer);
        window.clearTimeout(first);
        if (!e!.isIntersecting) return;
        first = window.setTimeout(step, 800);
        timer = window.setInterval(step, 2200);
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearInterval(timer);
      window.clearTimeout(first);
    };
  }, [near, touched, n]);

  const pick = (i: number) => {
    setTouched(true);
    go(i);
  };

  const { cur, prev } = deal;
  const p = people[cur]!;
  return (
    <div className={cls.stage} ref={stage}>
      <div
        className={cls.deck}
        onPointerDown={(e) => void (x0.current = e.clientX)}
        onPointerUp={(e) => {
          const from = x0.current;
          x0.current = null;
          if (from === null) return;
          const dx = e.clientX - from;
          if (Math.abs(dx) > 36) pick(cur + (dx < 0 ? 1 : -1));
        }}
      >
        {people.map((person, i) => {
          const pos = (i - cur + n) % n;
          const thrown = i === prev && i !== cur;
          return (
            <figure key={person.nick} className={cls.card} data-pos={thrown ? 'out' : pos < 3 ? String(pos) : 'back'} aria-hidden={i === cur ? undefined : true}>
              <div className={cls.photo}>{near && person.picture}</div>
              <figcaption className={cls.tag}>{person.nick}</figcaption>
            </figure>
          );
        })}
      </div>
      <div className={cls.caption} aria-live={touched ? 'polite' : 'off'}>
        <p className={cls.who}>{p.name}</p>
        <p className={cls.said}>{p.text}</p>
      </div>
      <p className={cls.cue}>{cue}</p>
      <ul className={cls.faces} aria-label={label}>
        {people.map((person, i) => (
          <li key={person.nick}>
            <button type="button" className={cls.face} aria-pressed={i === cur} aria-label={`${person.nick}, ${person.name}`} onClick={() => pick(i)}>
              {near && person.thumb}
            </button>
          </li>
        ))}
        <li>
          <button type="button" className={cls.nextBtn} onClick={() => pick(cur + 1)} aria-label={next} data-press>
            <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
              <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </li>
      </ul>
    </div>
  );
}
