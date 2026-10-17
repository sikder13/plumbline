'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  label: string;
  items: string[];
  /** Said once every box is ticked, beside the way to book. */
  ready: string;
  book: { label: string; href: string };
  cls: { root: string; label: string; tick: string; done: string; go: string };
}

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
    </svg>
  );
}

/**
 * A list to tick off. Once everything is ticked the list says so and offers the booking. As it first
 * comes into view it ticks itself through once, so a visitor who only scrolls sees what it does; the
 * visitor can then untick and tick as they like.
 */
export function HaulKit({ label, items, ready, book, cls }: Props) {
  const [on, setOn] = useState<boolean[]>(() => items.map(() => false));
  const touched = useRef(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timers: number[] = [];
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        items.forEach((_, k) =>
          timers.push(
            window.setTimeout(() => {
              if (!touched.current) setOn((v) => v.map((x, j) => (j === k ? true : x)));
            }, 300 + k * 230),
          ),
        );
      },
      { threshold: 0.45 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      for (const t of timers) window.clearTimeout(t);
    };
  }, [items]);

  const all = on.every(Boolean);
  return (
    <div ref={root} className={cls.root} role="group" aria-labelledby="kit-bring" data-ready={all ? '' : undefined}>
      <p className={cls.label} id="kit-bring">
        {label}
      </p>
      {items.map((it, i) => (
        <button
          key={it}
          type="button"
          role="checkbox"
          aria-checked={on[i]}
          className={cls.tick}
          onClick={() => {
            touched.current = true;
            setOn((v) => v.map((x, j) => (j === i ? !x : x)));
          }}
        >
          <span>{it}</span>
        </button>
      ))}
      <div className={cls.done} aria-live="polite">
        {all && (
          <>
            <b>{ready}</b>
            <a className={cls.go} href={book.href} rel="noopener" data-press>
              {book.label}
              <Arrow />
            </a>
          </>
        )}
      </div>
    </div>
  );
}
