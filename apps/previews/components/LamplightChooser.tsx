'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export interface LamplightTrip {
  name: string;
  water: string;
  minAge: number;
  hours: number;
  meta: string[];
  price: string;
  href: string;
  action: string;
  off?: boolean;
}

interface Sentence {
  start: string;
  water: { id: string; label: string }[];
  mid: string;
  ages: { value: number; label: string }[];
  ageEnd: string;
  hours: { value: number; label: string }[];
  end: string;
  hint: string;
  change: string;
  groups: { water: string; age: string; hours: string };
}

interface Choice {
  water: string;
  age: number;
  hours: number;
}

type Names = 'root' | 'sentence' | 'hint' | 'pick' | 'list' | 'trip' | 'name' | 'meta' | 'price' | 'way' | 'wayLabel' | 'wayName' | 'wayPrice' | 'go' | 'none' | 'soon';

/** One word of the sentence that the visitor can change: each tap moves it on to the next choice. */
function Slot({ label, change, options, value, onPick, className }: { label: string; change: string; options: { key: string | number; label: string }[]; value: string | number; onPick: (v: string | number) => void; className?: string }) {
  const at = Math.max(0, options.findIndex((o) => o.key === value));
  const now = options[at]!;
  const next = options[(at + 1) % options.length]!;
  return (
    <button type="button" className={className} aria-label={`${label}: ${now.label}. ${change}`} onClick={() => onPick(next.key)}>
      <span key={String(now.key)}>{now.label}</span>
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/**
 * A sentence the visitor finishes (wet or dry, the youngest in the group, the time they have) that
 * lights the trips it fits and leaves the rest in the dark, then holds the one way in with its price
 * and its booking link. The choices are only the business's own rules: the minimum ages and the
 * durations on its pages. It shows itself once when it comes into view, then waits for the visitor.
 */
export function LamplightChooser({
  sentence,
  defaults,
  demo,
  trips,
  way,
  none,
  soon,
  call,
  cls,
}: {
  sentence: Sentence;
  defaults: Choice;
  demo: Partial<Choice>[];
  trips: LamplightTrip[];
  way: string;
  none: string;
  soon: string;
  call: { tel: string; display: string };
  cls: Record<Names, string | undefined>;
}) {
  const [choice, setChoice] = useState<Choice>(defaults);
  const [picked, setPicked] = useState<number | null>(null);
  const touched = useRef(false);
  const root = useRef<HTMLDivElement>(null);

  const fits = useMemo(() => trips.map((t) => (choice.water === 'any' || t.water === choice.water) && t.minAge <= choice.age && t.hours <= choice.hours), [trips, choice]);
  const best = picked !== null && fits[picked] ? picked : fits.indexOf(true);
  const trip = best >= 0 ? trips[best] : undefined;

  useEffect(() => {
    const el = root.current;
    if (!el || !demo.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let cancelled = false;
    let stop: (() => void) | undefined;
    const timers: number[] = [];
    void import('motion').then(({ inView }) => {
      if (cancelled) return;
      stop = inView(
        el,
        () => {
          stop?.();
          demo.forEach((step, i) => {
            timers.push(window.setTimeout(() => !touched.current && setChoice((c) => ({ ...c, ...step })), 900 + i * 1500));
          });
        },
        { amount: 0.3 },
      );
    });
    return () => {
      cancelled = true;
      stop?.();
      for (const t of timers) window.clearTimeout(t);
    };
  }, [demo]);

  const set = (next: Partial<Choice>) => {
    touched.current = true;
    setPicked(null);
    setChoice((c) => ({ ...c, ...next }));
  };

  return (
    <div ref={root} className={cls.root}>
      <p className={cls.sentence}>
        {sentence.start}{' '}
        <Slot label={sentence.groups.water} change={sentence.change} className={cls.pick} options={sentence.water.map((o) => ({ key: o.id, label: o.label }))} value={choice.water} onPick={(v) => set({ water: String(v) })} />, {sentence.mid}{' '}
        <Slot label={sentence.groups.age} change={sentence.change} className={cls.pick} options={sentence.ages.map((o) => ({ key: o.value, label: o.label }))} value={choice.age} onPick={(v) => set({ age: Number(v) })} /> {sentence.ageEnd}{' '}
        <Slot label={sentence.groups.hours} change={sentence.change} className={cls.pick} options={sentence.hours.map((o) => ({ key: o.value, label: o.label }))} value={choice.hours} onPick={(v) => set({ hours: Number(v) })} />
        {sentence.end}
      </p>
      <p className={cls.hint}>{sentence.hint}</p>

      <ul className={cls.list}>
        {trips.map((t, i) => (
          <li key={t.name}>
            <button
              type="button"
              className={cls.trip}
              data-fit={fits[i] ? '' : undefined}
              data-off={t.off ? '' : undefined}
              aria-pressed={i === best}
              onClick={() => {
                touched.current = true;
                setPicked(i);
              }}
            >
              <span className={cls.name}>{t.name}</span>
              <span className={cls.meta}>{t.meta.join(' · ')}</span>
              <span className={cls.price}>{t.price}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className={cls.way} aria-live="polite">
        <p className={cls.wayLabel}>{way}</p>
        {trip ? (
          <>
            <p className={cls.wayName} key={trip.name}>
              {trip.name}
            </p>
            <p className={cls.wayPrice}>{trip.price}</p>
            <a className={cls.go} href={trip.href} rel={trip.href.startsWith('http') ? 'noopener' : undefined} data-press>
              {trip.action}
            </a>
          </>
        ) : (
          <p className={cls.none}>{none}</p>
        )}
        <p className={cls.soon}>
          {soon}{' '}
          <a href={call.tel} data-press>
            {call.display}
          </a>
        </p>
      </div>
    </div>
  );
}
