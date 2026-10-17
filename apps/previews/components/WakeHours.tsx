'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BoatTop, wake } from './WakeArt';

interface Option {
  hours: number;
  label: string;
  price: string;
}

export interface HoursMode {
  id: string;
  label: string;
  subject: string;
  start: number;
  recommend: number[];
  options: Option[];
  unit: string;
  what: string;
  notes: string[];
}

export interface HoursCls {
  root: string;
  modes: string;
  mode: string;
  strip: string;
  run: string;
  boat: string;
  ticks: string;
  tick: string;
  rec: string;
  sum: string;
  price: string;
  amount: string;
  unit: string;
  notes: string;
  actions: string;
  btn: string;
  ghost: string;
}

/** Where along the strip the boat sits after a number of hours: one hour is the first mark, five the last. */
const at = (hours: number) => 0.2 + (hours - 1) * 0.18;

/** A straight run of wake whose head is at the right edge of a 1400 by 200 box. */
const RUN = wake(
  [
    [
      [-40, 100],
      [440, 100],
      [920, 100],
      [1400, 100],
    ],
  ],
  { step: 10, spread: 0.075, max: 64, beam: 7, arcEvery: 4, bow: 0 },
);

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Time on the water as a strip of lake: the visitor picks the hours and the boat runs further up the
 * strip, its wake growing behind it, while the price for the boat changes beside the button that
 * writes to the skipper. It plays itself once when it first comes into view.
 */
export function WakeHours({
  modes,
  labels,
  email,
  call,
  body,
  cls,
}: {
  modes: HoursMode[];
  labels: { mode: string; hours: string; recommended: string; send: string; call: string };
  email: string;
  call: { tel: string; display: string };
  body: { interests: string; hours: string; sign: string; greeting: string };
  cls: HoursCls;
}) {
  const [modeId, setModeId] = useState(modes[0]!.id);
  const mode = modes.find((m) => m.id === modeId) ?? modes[0]!;
  const [hours, setHours] = useState(mode.start);
  const touched = useRef(false);
  const root = useRef<HTMLDivElement>(null);

  const option = mode.options.find((o) => o.hours === hours) ?? mode.options[0]!;

  const tell = (m: HoursMode, h: number) => window.dispatchEvent(new CustomEvent('wake:trip', { detail: { mode: m.id, hours: h } }));

  const pick = (h: number) => {
    touched.current = true;
    setHours(h);
    tell(mode, h);
  };
  const switchTo = (m: HoursMode) => {
    touched.current = true;
    setModeId(m.id);
    setHours(m.start);
    tell(m, m.start);
  };

  // Once in view, the strip runs through its hours and settles on the one it started on.
  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timers: number[] = [];
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        const first = modes[0]!;
        const run = [...first.options.map((o) => o.hours), first.start];
        run.forEach((h, i) => {
          timers.push(
            window.setTimeout(() => {
              if (!touched.current) setHours(h);
            }, 250 + i * 720),
          );
        });
      },
      { threshold: 0.45 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [modes]);

  const subject = `${mode.subject}, ${option.label}`;
  const text = `${body.greeting}\n\n${body.interests}: ${mode.label}\n${body.hours}: ${option.hours}\n\n${body.sign}`;
  const href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  const rec = mode.recommend.length ? [Math.min(...mode.recommend), Math.max(...mode.recommend)] : null;

  return (
    <div ref={root} className={cls.root} style={{ '--f': at(hours) } as CSSProperties}>
      <div className={cls.modes} role="group" aria-label={labels.mode}>
        {modes.map((m) => (
          <button key={m.id} type="button" className={cls.mode} aria-pressed={m.id === mode.id} onClick={() => switchTo(m)}>
            {m.label}
          </button>
        ))}
      </div>

      <div className={cls.strip} aria-hidden="true">
        <svg className={cls.run} viewBox="0 0 1400 200" preserveAspectRatio="xMaxYMid slice" focusable="false">
          {RUN.arcs.map((a, i) => (
            <path key={i} d={a.d} style={{ '--b': a.back } as CSSProperties} data-crest />
          ))}
          <path d={RUN.centre} data-wash />
          <path d={RUN.left} data-edge />
          <path d={RUN.right} data-edge />
        </svg>
        <svg className={cls.boat} viewBox="-90 -40 180 80" focusable="false">
          <BoatTop />
        </svg>
      </div>

      <div className={cls.ticks} role="group" aria-label={labels.hours}>
        {rec && (
          <p className={cls.rec} style={{ left: `${at(rec[0]!) * 100}%`, width: `${(at(rec[1]!) - at(rec[0]!)) * 100}%` }}>
            <span>{labels.recommended}</span>
          </p>
        )}
        {mode.options.map((o) => (
          <button key={o.hours} type="button" className={cls.tick} style={{ left: `${at(o.hours) * 100}%` }} aria-pressed={o.hours === hours} onClick={() => pick(o.hours)}>
            <b>{o.hours}</b>
            <span>{o.label.replace(String(o.hours), '').trim()}</span>
          </button>
        ))}
      </div>

      <div className={cls.sum}>
        <p className={cls.price} aria-live="polite">
          <span className={cls.amount} key={`${mode.id}${option.price}`}>
            {option.price}
          </span>
          <span className={cls.unit}>
            {option.label} {mode.what}, {mode.unit}
          </span>
        </p>
        <ul className={cls.notes}>
          {mode.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <div className={cls.actions}>
          <a className={cls.btn} href={href} data-press>
            <span>{labels.send}</span>
            <i aria-hidden="true">
              <Arrow />
            </i>
          </a>
          <a className={cls.ghost} href={call.tel} data-press>
            {labels.call} {call.display}
          </a>
        </div>
      </div>
    </div>
  );
}
