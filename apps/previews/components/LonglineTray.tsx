'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

interface Item {
  name: string;
  note?: string;
  /** Comes on board with a hired rod. */
  hire?: boolean;
}

interface Cls {
  wrap?: string;
  toggle?: string;
  grid?: string;
  cell?: string;
  note?: string;
}

/**
 * The tackle tray: what to bring, one compartment each. Switching on rod hire turns the compartments a
 * hired rod covers to the boat's side; the rest stay yours to bring. When the tray first comes into
 * view it switches itself on once, then waits.
 */
export function LonglineTray({ cls, items, labels }: { cls: Cls; items: Item[]; labels: { toggle: string; price: string; own: string; board: string; note: string } }) {
  const [on, setOn] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const touched = useRef(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let timer = 0;
    const stop = () => void (touched.current = true);
    el.addEventListener('pointerdown', stop);
    el.addEventListener('keydown', stop);
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        timer = window.setTimeout(() => {
          if (!touched.current) setOn(true);
        }, 300);
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
      el.removeEventListener('pointerdown', stop);
      el.removeEventListener('keydown', stop);
    };
  }, []);

  let hired = 0;
  return (
    <div ref={wrap} className={cls.wrap} data-on={on ? '' : undefined}>
      <button type="button" role="switch" aria-checked={on} className={cls.toggle} onClick={() => setOn((v) => !v)}>
        <span>
          {labels.toggle} <b>{labels.price}</b>
        </span>
        <i aria-hidden="true" />
      </button>
      <ul className={cls.grid}>
        {items.map((it) => {
          const board = on && !!it.hire;
          const order = it.hire ? hired++ : 0;
          return (
            <li key={it.name} className={cls.cell} data-board={board ? '' : undefined} style={{ '--o': order } as CSSProperties}>
              <b>{it.name}</b>
              {it.note && <span>{it.note}</span>}
              <em key={board ? 'board' : 'own'}>{board ? labels.board : labels.own}</em>
            </li>
          );
        })}
      </ul>
      <p className={cls.note}>{labels.note}</p>
    </div>
  );
}
