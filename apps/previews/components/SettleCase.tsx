'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

export interface SettleWine {
  name: string;
  short: string;
  vintage: string;
  price: string;
  /** The colour of the wine, for its bottle top. */
  tint: string;
  /** Text that reads on that colour. */
  ink: string;
}

export interface SettleCaseText {
  bottle: string;
  addLabel: string;
  slot: string;
  takeOut: string;
  carton: string;
  shelf: string;
  /** One sentence for each count from an empty carton to a full one, so the number of slots is the number of sentences less one. */
  status: string[];
  order: { label: string; href: string };
}

interface Pick {
  id: number;
  wine: number;
}

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

/**
 * A shelf of bottle tops and a carton seen from above. Tapping a bottle top sends it across into the
 * next empty slot; tapping it in the carton takes it out again. The sentence under the carton counts
 * down to the business's own free shipping rule. Nothing is ordered here: the one action is the
 * business's own order page. When the carton first comes into view a few bottles go in by themselves,
 * then it waits for the visitor.
 */
export function SettleCase({ wines, text, age, demo, cls }: { wines: SettleWine[]; text: SettleCaseText; age: string; demo: number[]; cls: Record<'root' | 'shelf' | 'shelfLabel' | 'top' | 'cap' | 'topName' | 'topPrice' | 'pips' | 'side' | 'carton' | 'slot' | 'disc' | 'slotName' | 'status' | 'order' | 'note', string | undefined> }) {
  const slots = text.status.length - 1;
  const [picks, setPicks] = useState<Pick[]>([]);
  const next = useRef(0);
  const touched = useRef(false);
  const carton = useRef<HTMLDivElement>(null);
  const caps = useRef<(HTMLElement | null)[]>([]);
  /** Where the newest bottle set off from, so it can be flown from there into its slot. */
  const flight = useRef<{ id: number; from: DOMRect } | null>(null);

  const put = (wine: number) => {
    const id = next.current++;
    const cap = caps.current[wine];
    if (cap) flight.current = { id, from: cap.getBoundingClientRect() };
    setPicks((p) => (p.length >= slots ? p : [...p, { id, wine }]));
  };

  // The new bottle top is drawn in its slot, then sent back to where it was tapped and flown home.
  useLayoutEffect(() => {
    const f = flight.current;
    flight.current = null;
    if (!f || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const disc = carton.current?.querySelector<HTMLElement>(`[data-id="${f.id}"] i`);
    if (!disc) return;
    const to = disc.getBoundingClientRect();
    if (!to.width) return;
    const dx = f.from.left + f.from.width / 2 - (to.left + to.width / 2);
    const dy = f.from.top + f.from.height / 2 - (to.top + to.height / 2);
    const scale = f.from.width / to.width;
    disc.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, offset: 0 },
        { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 40}px) scale(${(scale + 1) / 2 + 0.12})`, offset: 0.45 },
        { transform: 'none', offset: 1 },
      ],
      { duration: 720, easing: EASE },
    );
  }, [picks]);

  useEffect(() => {
    const el = carton.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timers: number[] = [];
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        demo.forEach((wine, i) => {
          timers.push(
            window.setTimeout(() => {
              if (!touched.current) put(wine);
            }, 250 + i * 520),
          );
        });
      },
      { threshold: 0.85 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      for (const t of timers) window.clearTimeout(t);
    };
    // The demonstration is set up once, when the carton first comes into view.
  }, []);

  const add = (wine: number) => {
    touched.current = true;
    put(wine);
  };
  const remove = (id: number) => {
    touched.current = true;
    setPicks((p) => p.filter((x) => x.id !== id));
  };

  const counts = new Map<number, number>();
  for (const p of picks) counts.set(p.wine, (counts.get(p.wine) ?? 0) + 1);
  const full = picks.length >= slots;

  return (
    <div className={cls.root} data-bottles={picks.length} data-full={full ? '' : undefined}>
      <div className={cls.shelf}>
        <p className={cls.shelfLabel}>{text.shelf}</p>
        <ul>
          {wines.map((w, i) => (
            <li key={w.name}>
              <button type="button" className={cls.top} onClick={() => add(i)} disabled={full} aria-label={`${text.addLabel} ${w.name} ${w.vintage}, ${w.price} ${text.bottle}`} style={{ '--tint': w.tint, '--on-tint': w.ink } as CSSProperties} data-picked={counts.get(i) ? '' : undefined}>
                <i
                  className={cls.cap}
                  aria-hidden="true"
                  ref={(el) => {
                    caps.current[i] = el;
                  }}
                />
                <span className={cls.topName}>{w.short}</span>
                <span className={cls.topPrice}>
                  <span>{w.vintage}</span> <b>{w.price}</b>
                </span>
                <span className={cls.pips} aria-hidden="true">
                  {Array.from({ length: counts.get(i) ?? 0 }, (_, n) => (
                    <b key={n} />
                  ))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className={cls.side}>
        <div ref={carton} className={cls.carton} role="group" aria-label={text.carton} style={{ '--slots': slots } as CSSProperties}>
          {Array.from({ length: slots }, (_, n) => {
            const p = picks[n];
            if (!p) return <span key={`empty-${n}`} className={cls.slot} aria-hidden="true" title={text.slot} />;
            const w = wines[p.wine]!;
            return (
              <button key={p.id} type="button" className={cls.slot} data-filled="" data-id={p.id} onClick={() => remove(p.id)} aria-label={`${text.takeOut} ${w.name} ${w.vintage}`} style={{ '--tint': w.tint, '--on-tint': w.ink } as CSSProperties}>
                <i className={cls.disc} aria-hidden="true" />
                <span className={cls.slotName} aria-hidden="true">
                  {w.short}
                </span>
              </button>
            );
          })}
        </div>
        <p className={cls.status} aria-live="polite">
          {text.status[Math.min(picks.length, slots)]}
        </p>
        <a className={cls.order} href={text.order.href} rel="noopener" data-press data-magnetic>
          {text.order.label}
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
            <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
        <p className={cls.note}>{age}</p>
      </div>
    </div>
  );
}
