'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export interface Choice {
  key: string;
  label: string;
  title: string;
  line: string;
  prices: { price: string; who: string }[];
  also?: string;
  /** The photograph for the land side when this choice is on. The first choice is drawn, not photographed. */
  image?: string;
  action: { label: string; href: string; external?: boolean };
}

interface Props {
  group: string;
  choices: Choice[];
  pictures: Record<string, ReactNode>;
  cls: Partial<Record<'root' | 'pick' | 'stage' | 'land' | 'shot' | 'drawn' | 'word' | 'seam' | 'info' | 'prices' | 'also' | 'go' | 'lines' | 'body' | 'boat', string>>;
}

/** Where the seam sits for each choice: the drawn side wide, the photographed side wide, half and half. */
const SPLITS = [0.7, 0.3, 0.5];

/** A short stretch of river drawn from above, in the same hand as the run: banks as contour lines. */
const RIVER = 'M150 -40C120 60 70 110 92 200S150 330 118 440';
const BANKS = Array.from({ length: 9 }, (_, k) => k);

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Two ways to spend the day, held side by side on one stage split by a slanted seam. Choosing one
 * slides the seam its way and shows its fares and its action; the third choice sits on the seam. When
 * it first comes into view it shows each choice once by itself, then waits for the visitor.
 */
export function SpinChoose({ group, choices, pictures, cls }: Props) {
  const [on, setOn] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const touched = useRef(false);

  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timers: number[] = [];
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        const order = [1, 2, 0];
        order.forEach((i, n) => {
          timers.push(
            window.setTimeout(() => {
              if (!touched.current) setOn(i);
            }, 700 + n * 1100),
          );
        });
      },
      { threshold: 0.55 },
    );
    io.observe(el.querySelector('[data-stage]') ?? el);
    const stopDemo = () => {
      touched.current = true;
    };
    el.addEventListener('pointerdown', stopDemo);
    el.addEventListener('keydown', stopDemo);
    return () => {
      io.disconnect();
      for (const t of timers) window.clearTimeout(t);
      el.removeEventListener('pointerdown', stopDemo);
      el.removeEventListener('keydown', stopDemo);
    };
  }, []);

  const cur = choices[on] ?? choices[0]!;
  const shots = choices.filter((c) => c.image).map((c) => c.image!);
  const shown = cur.image ?? shots[0];
  const split = SPLITS[on] ?? 0.5;

  return (
    <div ref={root} className={cls.root} style={{ '--split': split } as CSSProperties} data-on={cur.key}>
      <div className={cls.pick} role="group" aria-label={group}>
        {choices.map((c, i) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={i === on}
            onClick={() => {
              touched.current = true;
              setOn(i);
            }}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className={cls.stage} data-stage aria-hidden="true">
        <div className={cls.land}>
          {shots.map((k) => (
            <div key={k} className={cls.shot} data-shown={k === shown ? '' : undefined}>
              {pictures[k]}
            </div>
          ))}
        </div>
        <div className={cls.drawn}>
          <svg viewBox="0 0 400 400" preserveAspectRatio="xMinYMid slice" focusable="false">
            <g className={cls.lines}>
              {BANKS.map((k) => (
                <g key={k}>
                  <path d={RIVER} style={{ '--side': -1, '--k': k } as CSSProperties} />
                  <path d={RIVER} style={{ '--side': 1, '--k': k } as CSSProperties} />
                </g>
              ))}
            </g>
            <path className={cls.body} d={RIVER} />
            <g className={cls.boat} transform="translate(96 214) rotate(12)">
              <path d="M-10 -18L-30 -86M10 -18L30 -86" />
              <path d="M-11 -19H11L13 3L0 23L-13 3Z" />
            </g>
          </svg>
          <span className={cls.word} data-side="near">
            {choices[0]?.label}
          </span>
        </div>
        <span className={cls.word} data-side="far">
          {choices[1]?.label}
        </span>
        <span className={cls.seam} />
      </div>
      <div key={cur.key} className={cls.info}>
        <h3>{cur.title}</h3>
        <p>{cur.line}</p>
        <p className={cls.prices}>
          {cur.prices.map((p) => (
            <span key={p.price}>
              <b>{p.price}</b> {p.who}
            </span>
          ))}
        </p>
        {cur.also && <p className={cls.also}>{cur.also}</p>}
        <a className={cls.go} href={cur.action.href} rel={cur.action.external ? 'noopener' : undefined} data-press>
          {cur.action.label}
          <Arrow />
        </a>
      </div>
    </div>
  );
}
