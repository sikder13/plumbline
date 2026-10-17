'use client';

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { whenNear } from './FathomNear';

export interface DialMonth {
  short: string;
  name: string;
  /** "on" for a month the business swims, anything else for a month it does not. */
  state: string;
  chip: string;
  note: string;
}

interface Props {
  months: DialMonth[];
  labels: { choose: string; now: string; hint: string; on: string; off: string };
  /** The business's time zone, for the month it is there now. */
  zone: string;
  className?: string;
}

const C = 200;
const R = 150;

function point(deg: number, r: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
}

function arc(from: number, to: number, r: number): string {
  const [x0, y0] = point(from, r);
  const [x1, y1] = point(to, r);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/**
 * The year on a dial, as the business tells it. Each month sits round a ring, the months they swim
 * lit and the rest dimmed; a tap on a month, an arrow key or a turn of the hand moves to it, and the
 * month's own line in their words shows beside the dial. A mark shows the month it is now where the
 * business is. Nothing is said that the business has not said itself.
 */
export function FathomDial({ months, labels, zone, className }: Props) {
  const n = months.length;
  const step = 360 / n;
  // Before the visitor's clock is known, the dial rests on the month the season opens.
  const opening = Math.max(
    0,
    months.findIndex((m, i) => m.state === 'on' && months[(i - 1 + n) % n]!.state !== 'on'),
  );
  const [sel, setSel] = useState(opening);
  const [angle, setAngle] = useState(opening * step);
  const [now, setNow] = useState<number | null>(null);
  const [shown, setShown] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const dragging = useRef(false);
  const current = useRef(opening);

  // The hand always takes the short way round, so December to January is one step, not eleven back.
  const choose = (i: number) => {
    const next = ((i % n) + n) % n;
    let delta = (next - current.current + n) % n;
    if (delta > n / 2) delta -= n;
    current.current = next;
    setSel(next);
    setAngle((a) => a + delta * step);
  };

  // Nothing is worked out while the page loads: the month it is now, and the sweep of the hand, wait
  // until the dial is near the screen and the browser is idle.
  useEffect(() => {
    // The ring is watched, not the whole dial: on wide screens the dial's own box gives way to its parts.
    const el = root.current?.querySelector<HTMLElement>('[data-dial-ring]');
    if (!el) return;
    return whenNear(
      el,
      () => {
        let month: number;
        try {
          month = Number(new Intl.DateTimeFormat('en-NZ', { timeZone: zone, month: 'numeric' }).format(new Date())) - 1;
        } catch {
          month = new Date().getMonth();
        }
        const here = month >= 0 && month < n ? month : null;
        setNow(here);
        if (here !== null) {
          current.current = here;
          setSel(here);
          setAngle(here * step);
        }
        // The ring draws itself and the hand sweeps round to the month once the dial comes into view.
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || el.getBoundingClientRect().top < window.innerHeight) return;
        setShown(false);
        const io = new IntersectionObserver(
          ([e]) => {
            if (!e?.isIntersecting) return;
            setShown(true);
            io.disconnect();
          },
          { threshold: 0.35 },
        );
        io.observe(el);
        return () => io.disconnect();
      },
      '60%',
    );
  }, [n, step, zone]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const move = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!move) return;
    e.preventDefault();
    const next = (sel + move + n) % n;
    choose(next);
    buttons.current[next]?.focus();
  };

  const turn = (e: PointerEvent<HTMLElement>) => {
    if (!dragging.current || !root.current) return;
    const face = root.current.querySelector<HTMLElement>('[data-dial-ring]');
    if (!face) return;
    const box = face.getBoundingClientRect();
    const deg = (Math.atan2(e.clientX - (box.left + box.width / 2), -(e.clientY - (box.top + box.height / 2))) * 180) / Math.PI;
    const i = Math.round(((deg + 360) % 360) / step) % n;
    if (i !== current.current) choose(i);
  };

  const m = months[sel]!;
  const hand = shown ? angle : angle - 300;

  return (
    <div ref={root} className={className} data-dial data-dial-state={m.state} data-in={shown ? '' : undefined} style={{ '--n': n } as CSSProperties}>
      <div data-dial-ring>
        <svg viewBox="0 0 400 400" aria-hidden="true" focusable="false">
          <circle data-dial-bezel cx={C} cy={C} r={R + 30} />
          {Array.from({ length: n * 4 }, (_, i) => {
            const [x0, y0] = point(i * (step / 4), R - 22);
            const [x1, y1] = point(i * (step / 4), i % 4 === 0 ? R - 34 : R - 28);
            return <line key={i} data-dial-tick x1={x0.toFixed(2)} y1={y0.toFixed(2)} x2={x1.toFixed(2)} y2={y1.toFixed(2)} />;
          })}
          {months.map((mo, i) => (
            <path
              key={mo.short}
              d={arc(i * step - step / 2 + 2.2, i * step + step / 2 - 2.2, R)}
              pathLength={1}
              data-dial-arc={mo.state === 'on' ? 'on' : 'off'}
              data-sel={i === sel ? '' : undefined}
              style={{ '--i': i } as CSSProperties}
            />
          ))}
          {now !== null && (
            <g data-dial-now style={{ '--a': `${now * step}deg` } as CSSProperties}>
              <circle cx={C} cy={C - R} r="7" />
            </g>
          )}
        </svg>
        <div data-dial-hand style={{ transform: `rotate(${hand}deg)` }}>
          <span data-dial-stick />
          <span
            data-dial-knob
            aria-hidden="true"
            onPointerDown={(e) => {
              dragging.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={turn}
            onPointerUp={() => void (dragging.current = false)}
            onPointerCancel={() => void (dragging.current = false)}
          />
        </div>
        <div data-dial-face aria-live="polite">
          <p key={m.name} data-dial-month>
            {m.name}
          </p>
          <p data-dial-chip data-state={m.state}>
            {m.chip}
          </p>
          {now === sel && (
            <p data-dial-here>
              <i aria-hidden="true" />
              {labels.now}
            </p>
          )}
        </div>
        <div data-dial-months role="group" aria-label={labels.choose} onKeyDown={onKey}>
          {months.map((mo, i) => (
            <button
              key={mo.short}
              ref={(b) => void (buttons.current[i] = b)}
              type="button"
              aria-pressed={i === sel}
              aria-label={`${mo.name}, ${mo.chip}`}
              data-state={mo.state === 'on' ? 'on' : 'off'}
              tabIndex={i === sel ? 0 : -1}
              onClick={() => choose(i)}
              style={{ '--a': `${i * step}deg` } as CSSProperties}
            >
              {mo.short}
            </button>
          ))}
        </div>
      </div>
      <div data-dial-side>
        <p key={m.note} data-dial-note>
          {m.note}
        </p>
        <p data-dial-legend aria-hidden="true">
          <span data-state="on">{labels.on}</span>
          <span data-state="off">{labels.off}</span>
        </p>
        <p data-dial-hint>{labels.hint}</p>
      </div>
    </div>
  );
}
