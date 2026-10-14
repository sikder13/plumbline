'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Kayak } from './LandingKayak';

export interface LandingTour {
  id: string;
  name: string;
  short: string;
  facts: string;
  line: string;
  book: string;
  tag?: string;
  extra?: string;
  price?: { label: string; value: string }[];
  /** The months (0 for January) a set of departure times applies to, as the business publishes them. */
  departures: { months: number[]; times: string[]; season: string; special?: string }[];
}

interface Labels {
  tourLabel: string;
  monthLabel: string;
  in: string;
  leaves: string;
  and: string;
  early: string;
  late: string;
  note: string;
}

type Cls = Record<
  'plan' | 'scene' | 'photo' | 'sun' | 'line' | 'mark' | 'ends' | 'controls' | 'tours' | 'slider' | 'initials' | 'sentence' | 'special' | 'tourLine' | 'deal' | 'go' | 'tag',
  string | undefined
>;

/** The month it is in New Zealand, January as 0, without the cost of a time zone lookup: New Zealand is twelve hours ahead of UTC, thirteen in summer. */
function monthInNz(): number {
  const now = new Date();
  const m = now.getUTCMonth();
  return new Date(now.getTime() + (m >= 3 && m <= 8 ? 12 : 13) * 3600000).getUTCMonth();
}

/** Runs once the browser has a moment to spare. */
function whenIdle(run: () => void): () => void {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(run, { timeout: 2500 });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(run, 300);
  return () => window.clearTimeout(id);
}

/** A time as the business writes it ("8.45am", "1.00pm") as hours past midnight. */
function hours(t: string): number {
  const m = /^(\d{1,2})(?:[.:](\d{2}))?\s*([ap])m$/i.exec(t.trim());
  if (!m) return 12;
  let h = Number(m[1]) % 12;
  if (m[3]!.toLowerCase() === 'p') h += 12;
  return h + Number(m[2] ?? 0) / 60;
}

/** The day line runs from a little before the earliest departure to a little after the latest. */
const FROM = 5;
const TO = 18;

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * When will you paddle: choose a tour and slide a kayak along the months, and the day's departures
 * from the beach move to the times the business publishes for that month, the photograph turns to
 * early light when the sunrise departures run, and a sentence writes itself with the times. The
 * booking button sits with the tour's price, where the business gives one. Nothing here takes a
 * booking: the button goes to the business's own booking system.
 */
export function LandingSeasons({
  tours,
  months,
  initials,
  labels,
  bookHref,
  day,
  sunrise,
  startMonth,
  cls,
}: {
  tours: LandingTour[];
  months: string[];
  initials: string[];
  labels: Labels;
  bookHref: string;
  day: ReactNode;
  sunrise: ReactNode;
  /** The month the page was made in, shown until the visitor's own month is known. */
  startMonth: number;
  cls: Cls;
}) {
  const id = useId();
  const [tourIndex, setTour] = useState(0);
  const [month, setMonth] = useState(startMonth);

  const scene = useRef<HTMLDivElement>(null);
  const touched = useRef(false);
  const shown = useRef(startMonth);
  shown.current = month;

  // The month the visitor is in, in New Zealand, once the browser has a moment.
  useEffect(() => whenIdle(() => setMonth(monthInNz())), []);

  // The first time the photograph comes into view, the kayak paddles along the months to the next
  // ones with sunrise departures, rests there, and paddles back: once, and never after a touch.
  useEffect(() => {
    const el = scene.current;
    const special = tours[0]?.departures.find((d) => d.special);
    if (!el || !special || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timers: number[] = [];
    let io: IntersectionObserver | undefined;
    const cancel = whenIdle(() => {
      io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io?.disconnect();
        const from = shown.current;
        if (touched.current || special.months.includes(from)) return;
        const out: number[] = [];
        for (let m = (from + 1) % 12; out.length < 11; m = (m + 1) % 12) {
          out.push(m);
          if (special.months.includes(m)) break;
        }
        if (out.length > 5) return;
        const back = [...out].reverse().slice(1).concat(from);
        [...out, ...back].forEach((m, i) => {
          timers.push(window.setTimeout(() => !touched.current && setMonth(m), 500 + i * 300 + (i >= out.length ? 1300 : 0)));
        });
      },
      { threshold: 0.6 },
      );
      io.observe(el);
    });
    return () => {
      cancel();
      io?.disconnect();
      for (const t of timers) window.clearTimeout(t);
    };
  }, [tours]);

  const touch = () => {
    touched.current = true;
  };

  const tour = tours[tourIndex]!;
  const sets = tour.departures.filter((d) => d.months.includes(month));
  const regular = sets.filter((d) => !d.special);
  const special = sets.find((d) => d.special);
  const times = sets.flatMap((d) => d.times).sort((a, b) => hours(a) - hours(b));
  const said = times.length > 1 ? `${times.slice(0, -1).join(', ')} ${labels.and} ${times[times.length - 1]}` : (times[0] ?? '');

  // Each slot keeps its place in the line as the months change, so a departure slides from one time to the next.
  const slots: { key: string; time: string | null; special: boolean }[] = [];
  const most = Math.max(...tours.flatMap((t) => t.departures.filter((d) => !d.special).map((d) => d.times.length)));
  const mostSpecial = Math.max(0, ...tours.flatMap((t) => t.departures.filter((d) => d.special).map((d) => d.times.length)));
  const regularTimes = regular.flatMap((d) => d.times);
  for (let i = 0; i < most; i++) slots.push({ key: `r${i}`, time: regularTimes[i] ?? null, special: false });
  for (let i = 0; i < mostSpecial; i++) slots.push({ key: `s${i}`, time: special?.times[i] ?? null, special: true });

  return (
    <div className={cls.plan} data-tour={tour.id} data-special={special ? '' : undefined}>
      <div className={cls.scene} ref={scene}>
        <div className={cls.photo}>{day}</div>
        <div className={cls.sun} aria-hidden="true">
          {sunrise}
        </div>
        <div className={cls.line} aria-hidden="true">
          {slots.map((s) => (
            <span
              key={s.key}
              className={cls.mark}
              data-hidden={s.time ? undefined : ''}
              data-special={s.special ? '' : undefined}
              style={{ '--x': s.time ? ((hours(s.time) - FROM) / (TO - FROM)).toFixed(4) : s.special ? (s.key === 's0' ? '0' : '1') : '0.5' } as CSSProperties}
            >
              <span>
                <b>{s.time ?? ''}</b>
                <Kayak />
              </span>
            </span>
          ))}
          <span className={cls.ends}>
            <span>{labels.early}</span>
            <span>{labels.late}</span>
          </span>
        </div>
      </div>

      <div className={cls.controls} onPointerDown={touch} onKeyDown={touch}>
        <div className={cls.tours} role="radiogroup" aria-label={labels.tourLabel}>
          {tours.map((t, i) => (
            <button key={t.id} type="button" role="radio" aria-checked={i === tourIndex} onClick={() => setTour(i)} data-press>
              <b>{t.short}</b>
              <span>{t.facts}</span>
            </button>
          ))}
        </div>

        <div className={cls.slider}>
          <label htmlFor={`${id}-month`}>{labels.monthLabel}</label>
          <input
            id={`${id}-month`}
            type="range"
            min={0}
            max={11}
            step={1}
            value={month}
            aria-valuetext={months[month]}
            onChange={(e) => setMonth(Number(e.target.value))}
            suppressHydrationWarning
          />
          <ol className={cls.initials} aria-hidden="true">
            {initials.map((m, i) => (
              <li key={`${m}-${i}`} data-on={i === month ? '' : undefined} style={{ '--i': i } as CSSProperties}>
                {m}
              </li>
            ))}
          </ol>
        </div>

        <p className={cls.sentence} aria-live="polite">
          {labels.in} <b>{months[month]}</b>, {tour.name.replace(/^The /, 'the ')} {labels.leaves} <b>{said}</b>.
        </p>
        <p className={cls.special} data-on={special ? '' : undefined}>
          {special ? `${special.special}, ${special.season}.` : `${regular[0]?.season ?? ''}.`}
        </p>
        <p className={cls.tourLine}>{tour.line}</p>

        <div className={cls.deal}>
          {tour.price ? (
            <dl>
              {tour.price.map((p) => (
                <div key={p.label}>
                  <dt>{p.label}</dt>
                  <dd>{p.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p>{tour.facts}</p>
          )}
          <a className={cls.go} href={bookHref} rel="noopener" data-press data-magnetic>
            {tour.book}
            <Arrow />
          </a>
        </div>
        <p className={cls.tag}>
          {tour.tag && <b>{tour.tag}.</b>} {tour.extra && <span>{tour.extra}.</span>} <span>{labels.note}</span>
        </p>
      </div>
    </div>
  );
}
