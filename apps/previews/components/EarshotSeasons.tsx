'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export interface SeasonItem {
  name: string;
  title: string;
  season: string;
  months: number[];
  peak?: number[];
  price: { figure: string; text: string };
  trust?: string[];
  link: { label: string; href: string };
}

export interface SeasonLabels {
  month: string;
  now: string;
  in: string;
  out: string;
  peak: string;
  plan: string;
  year: string;
}

type Cls = Record<
  'root' | 'picker' | 'month' | 'now' | 'rail' | 'range' | 'letters' | 'rows' | 'row' | 'thumb' | 'head' | 'name' | 'status' | 'title' | 'trust' | 'bar' | 'deal' | 'price' | 'go' | 'more',
  string | undefined
>;

/** Runs `fn` once the browser has nothing more pressing to do, or after two seconds at the latest. */
function whenIdle(fn: () => void): () => void {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(fn, { timeout: 2000 });
    return () => w.cancelIdleCallback?.(id);
  }
  const t = window.setTimeout(fn, 300);
  return () => window.clearTimeout(t);
}

function monthHere(): number {
  return Number(new Intl.DateTimeFormat('en-NZ', { timeZone: 'Pacific/Auckland', month: 'numeric' }).format(new Date())) - 1;
}

/**
 * The guide's year. A large month slider to drag, and under it a row for each adventure with its own
 * photograph, whether it is on that month and a bar of the twelve months, built from the months his
 * pages give (The Roar March to June, fly fishing October to May, hiking year round). It opens on a
 * month where the three differ, and the first time it is seen it runs once through the year so the
 * differences show. "Plan it with Ethan" writes that adventure and month into the note further down.
 */
export function EarshotSeasons({ items, months, letters, labels, open, photos, cls }: { items: SeasonItem[]; months: string[]; letters: string[]; labels: SeasonLabels; open: number; photos: ReactNode[]; cls: Cls }) {
  const [m, setM] = useState(open);
  const [here, setHere] = useState(-1);
  const root = useRef<HTMLDivElement>(null);
  const touched = useRef(false);
  const timers = useRef<number[]>([]);

  // Nothing runs at load. Once the browser is idle it waits to be seen, then runs once through the year.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let io: IntersectionObserver | undefined;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cancel = whenIdle(() => {
      io = new IntersectionObserver(
        ([e]) => {
          if (!e?.isIntersecting) return;
          io?.disconnect();
          setHere(monthHere());
          if (still || touched.current) return;
          timers.current = Array.from({ length: 12 }, (_, k) => window.setTimeout(() => !touched.current && setM((open + k + 1) % 12), 220 + k * 125));
        },
        { threshold: 0.35 },
      );
      io.observe(el);
    });
    return () => {
      cancel();
      io?.disconnect();
      for (const t of timers.current) window.clearTimeout(t);
    };
  }, [open]);

  const pick = (month: number) => {
    touched.current = true;
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
    setM(month);
  };
  const state = (it: SeasonItem, month: number) => (it.peak?.includes(month + 1) ? 'peak' : it.months.includes(month + 1) ? 'in' : 'out');

  return (
    <div ref={root} className={cls.root} style={{ '--m': m } as CSSProperties}>
      <div className={cls.picker}>
        <p className={cls.month} aria-hidden="true">
          <span key={m}>{months[m]}</span>
          {m === here ? <i className={cls.now} title={labels.now} /> : null}
        </p>
        <div className={cls.rail}>
          <input
            className={cls.range}
            type="range"
            min={0}
            max={11}
            step={1}
            value={m}
            onChange={(e) => pick(Number(e.target.value))}
            aria-label={labels.month}
            aria-valuetext={months[m]}
          />
          <p className={cls.letters} aria-hidden="true">
            {letters.map((l, i) => (
              <span key={i} data-on={i === m ? '' : undefined} data-now={i === here ? '' : undefined}>
                {l}
              </span>
            ))}
          </p>
        </div>
      </div>
      <ul className={cls.rows} aria-label={labels.year} aria-live="polite">
        {items.map((it, i) => {
          const s = state(it, m);
          return (
            <li key={it.name} className={cls.row} data-status={s}>
              <div className={cls.thumb}>{photos[i]}</div>
              <div className={cls.head}>
                <h3 className={cls.name}>{it.name}</h3>
                <p className={cls.status} data-status={s}>
                  <span key={`${s}${m}`}>{s === 'peak' ? labels.peak : s === 'in' ? labels.in : labels.out}</span>
                </p>
                <p className={cls.title}>
                  {it.title}. {it.season}.
                </p>
              </div>
              {it.trust && it.trust.length > 0 ? (
                <ul className={cls.trust}>
                  {it.trust.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              ) : null}
              <span className={cls.bar} aria-hidden="true">
                {letters.map((_, j) => (
                  <i key={j} data-state={state(it, j)} data-at={j === m ? '' : undefined} />
                ))}
              </span>
              <div className={cls.deal}>
                <p className={cls.price}>
                  <b>{it.price.figure}</b> <span>{it.price.text}</span>
                </p>
                <a className={cls.go} href="#plan" data-press onClick={() => window.dispatchEvent(new CustomEvent('earshot:plan', { detail: { pursuit: i, month: m } }))}>
                  {labels.plan}
                </a>
                <a className={cls.more} href={it.link.href} rel="noopener">
                  {it.link.label}
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
