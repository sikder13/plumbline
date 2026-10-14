'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

export interface DayTrip {
  id: string;
  name: string;
  when?: string;
  legs: { kind: string; note?: string }[];
  text: string;
  price?: string;
  priceNote?: string;
  href: string;
}

interface Choice {
  id: string;
  label: string;
}

interface End extends Choice {
  trip: string;
}

interface Props {
  start: string;
  between: string;
  modes: Choice[];
  lengths: Record<string, Choice[]>;
  ends: Record<string, End[]>;
  trips: DayTrip[];
  legs: Record<string, string>;
  hint: string;
  noPrice: string;
  bookLabel: string;
  /** The slots (0, 1 or 2) turned one after another when the sentence first comes into view. */
  demo: number[];
  cls: {
    wrap: string;
    sentence: string;
    slot: string;
    fixed: string;
    word: string;
    hint: string;
    answer: string;
    tripName: string;
    when: string;
    legs: string;
    tripText: string;
    buy: string;
    price: string;
    noPrice: string;
    book: string;
    srOnly: string;
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

function Turn() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M15.5 8A6 6 0 1 0 16 12M16 3.5V8h-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * A sentence the visitor finishes by turning its words: who paddles, for how long, and how the day
 * ends. Each turn rolls the word over in place, and the sentence resolves to the one trip it
 * describes: its day drawn across a waterline, its price as the business writes it, and one button
 * to that trip's own booking page. When it first comes into view it turns a few words by itself,
 * then waits for the visitor. Nothing here takes a booking.
 */
export function BackyardDay({ start, between, modes, lengths, ends, trips, legs, hint, noPrice, bookLabel, demo, cls }: Props) {
  const [pick, setPick] = useState({ m: 0, l: 0, e: 0 });
  const [pressed, setPressed] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  const mode = modes[pick.m]!;
  const options = lengths[mode.id]!;
  const length = options[pick.l % options.length]!;
  const endList = ends[`${mode.id}-${length.id}`]!;
  const end = endList[pick.e % endList.length]!;
  const trip = trips.find((t) => t.id === end.trip)!;

  const turn = (slot: number) =>
    setPick((p) => {
      if (slot === 0) return { m: (p.m + 1) % modes.length, l: 0, e: 0 };
      if (slot === 1) return { ...p, l: (p.l + 1) % lengths[modes[p.m]!.id]!.length, e: 0 };
      const list = ends[`${modes[p.m]!.id}-${lengths[modes[p.m]!.id]![p.l]!.id}`]!;
      return { ...p, e: (p.e + 1) % list.length };
    });

  // Plays itself once, after the page has loaded and only when the sentence is on screen.
  useEffect(() => {
    const el = wrap.current;
    if (!el || touched || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timers: number[] = [];
    let io: IntersectionObserver | undefined;
    const cancel = whenIdle(() => {
      io = new IntersectionObserver(
        ([e]) => {
          if (!e!.isIntersecting) return;
          io!.disconnect();
          demo.forEach((slot, i) => {
            timers.push(window.setTimeout(() => setPressed(slot), 900 + i * 1500));
            timers.push(
              window.setTimeout(() => {
                turn(slot);
                setPressed(null);
              }, 1250 + i * 1500),
            );
          });
        },
        { threshold: 0.45 },
      );
      io.observe(el);
    });
    return () => {
      cancel();
      io?.disconnect();
      for (const t of timers) window.clearTimeout(t);
    };
    // The demonstration is planned once; a visitor's own turn ends it.
  }, [touched]);

  const press = (slot: number) => {
    setTouched(true);
    setPressed(null);
    turn(slot);
  };

  const slot = (i: number, label: string, count: number) =>
    count > 1 ? (
      <button type="button" className={cls.slot} data-pressed={pressed === i ? '' : undefined} onClick={() => press(i)} aria-label={`${label}. ${hint}`}>
        <span className={cls.word} key={label}>
          {label}
        </span>
        <Turn />
      </button>
    ) : (
      <span className={`${cls.slot} ${cls.fixed}`}>
        <span className={cls.word} key={label}>
          {label}
        </span>
      </span>
    );

  return (
    <div className={cls.wrap} ref={wrap}>
      <p className={cls.sentence}>
        {start} {slot(0, mode.label, modes.length)} {between} {slot(1, length.label, options.length)} {slot(2, end.label, endList.length)}
      </p>
      <p className={cls.hint}>{hint}</p>
      <div className={cls.answer} key={trip.id} aria-live={touched ? 'polite' : 'off'}>
        <h3 className={cls.tripName}>{trip.name}</h3>
        {trip.when && <p className={cls.when}>{trip.when}</p>}
        <ol className={cls.legs} style={{ '--n': trip.legs.length } as CSSProperties}>
          {trip.legs.map((leg, j) => (
            <li key={`${leg.kind}-${j}`} data-leg={leg.kind} style={{ '--j': j } as CSSProperties}>
              <b>{legs[leg.kind]}</b>
              {leg.note && <span>{leg.note}</span>}
            </li>
          ))}
        </ol>
        <p className={cls.tripText}>{trip.text}</p>
        <div className={cls.buy}>
          {trip.price ? (
            <p className={cls.price}>
              {trip.price}
              {trip.priceNote && <small> {trip.priceNote}</small>}
            </p>
          ) : (
            <p className={cls.noPrice}>{noPrice}</p>
          )}
          <a className={cls.book} href={trip.href} rel="noopener" data-press>
            <svg viewBox="0 0 24 12" width="24" height="12" aria-hidden="true" focusable="false">
              <path d="M1 7c2.5-4 5-4 7.5 0s5 4 7.5 0 5-4 7 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {bookLabel}
            <span className={cls.srOnly}> {trip.name}</span>
          </a>
        </div>
      </div>
    </div>
  );
}
