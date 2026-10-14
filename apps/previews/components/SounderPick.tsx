'use client';

import { useEffect, useRef, useState } from 'react';

export interface PickTrip {
  key: string;
  name: string;
  tag?: string;
  text: string;
  facts: string[];
  price: string;
  unit: string;
  href: string;
}

interface Props {
  trips: PickTrip[];
  groups: { label: string; keys: string[] }[];
  /** The trip each state of the sea switch points to, in the switch's order. */
  seaKeys: string[];
  seaLabels: string[];
  seaLabel: string;
  how: string;
  bookLabel: string;
  cls: { [K in 'console' | 'list' | 'group' | 'row' | 'rowName' | 'rowPrice' | 'read' | 'sea' | 'tag' | 'name' | 'text' | 'facts' | 'deal' | 'price' | 'go' | 'how']?: string };
}

/**
 * The booking console: every trip on one sounder screen, the chosen one read out beside the list with
 * its price and a button to that trip's own page on the business's booking system, where a date is
 * picked. It follows the sea switch further up the page until the visitor chooses here, and the first
 * time it comes into view it runs down two other trips and back, so a glance shows it can be used.
 */
export function SounderPick({ trips, groups, seaKeys, seaLabels, seaLabel, how, bookLabel, cls }: Props) {
  const [sel, setSel] = useState(seaKeys[0] ?? trips[0]!.key);
  const [sea, setSea] = useState<number | null>(null);
  const touched = useRef(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const follow = (e: Event) => {
      const i = (e as CustomEvent<number>).detail;
      setSea(i);
      if (!touched.current && seaKeys[i]) setSel(seaKeys[i]!);
    };
    window.addEventListener('sounder-sea', follow);
    return () => window.removeEventListener('sounder-sea', follow);
  }, [seaKeys]);

  useEffect(() => {
    const el = box.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timers: number[] = [];
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        const order = groups.flatMap((g) => g.keys);
        const tour = [order[2], order[3]].filter((k): k is string => !!k);
        tour.forEach((k, i) => timers.push(window.setTimeout(() => !touched.current && setSel(k), 500 + i * 850)));
        timers.push(
          window.setTimeout(() => {
            if (touched.current) return;
            const i = (window as unknown as { __sounderSea?: number }).__sounderSea ?? 0;
            setSel(seaKeys[i] ?? seaKeys[0]!);
          }, 500 + tour.length * 850 + 300),
        );
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      for (const t of timers) window.clearTimeout(t);
    };
  }, [groups, seaKeys]);

  const trip = trips.find((t) => t.key === sel) ?? trips[0]!;
  const fromSea = sea !== null && seaKeys[sea] === sel;
  return (
    <div className={cls.console} ref={box}>
      <div className={cls.list}>
        {groups.map((g) => (
          <div key={g.label} role="group" aria-label={g.label}>
            <p className={cls.group} aria-hidden="true">
              {g.label}
            </p>
            {g.keys.map((k) => {
              const t = trips.find((x) => x.key === k);
              if (!t) return null;
              return (
                <button
                  key={k}
                  type="button"
                  className={cls.row}
                  aria-pressed={k === sel}
                  onClick={() => {
                    touched.current = true;
                    setSel(k);
                  }}
                >
                  <span className={cls.rowName}>{t.name}</span>
                  <span className={cls.rowPrice}>{t.price}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className={cls.read} data-trip={trip.key}>
        <p className={cls.sea} data-on={fromSea ? '' : undefined} aria-hidden={!fromSea}>
          {seaLabel} <b>{sea !== null ? seaLabels[sea] : seaLabels[0]}</b>
        </p>
        {trip.tag && <p className={cls.tag}>{trip.tag}</p>}
        <h3 className={cls.name}>{trip.name}</h3>
        <p className={cls.text}>{trip.text}</p>
        <ul className={cls.facts}>
          {trip.facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <div className={cls.deal}>
          <p className={cls.price}>
            <b>{trip.price}</b> <span>{trip.unit}</span>
          </p>
          <a className={cls.go} href={trip.href} rel="noopener" data-press aria-label={`${bookLabel}: ${trip.name}`}>
            {bookLabel}
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
              <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
        <p className={cls.how}>{how}</p>
      </div>
    </div>
  );
}
