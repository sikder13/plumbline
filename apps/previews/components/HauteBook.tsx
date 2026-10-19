'use client';

import { useEffect, useRef, useState } from 'react';
import { Pic } from './Pic';
import type { Picture } from '@/lib/data';

interface Item {
  key: string;
  label: string;
  where: string;
  pic: Picture;
}

/**
 * Their own pieces, one at a time. On a desktop an index picks the page and the stage shows it; on a
 * phone the pages are swiped and a counter follows. It turns its first three pages once when it first
 * comes into view, then waits for the visitor.
 */
export function HauteBook({ items, s }: { items: Item[]; s: Record<string, string> }) {
  const [at, setAt] = useState(0);
  // The stage's pages are stacked and hidden, which a browser's own lazy loading never reaches, so they load once the book is near.
  const [near, setNear] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLOListElement>(null);
  const touched = useRef(false);

  // The self demonstration: three turns, 0.6 s apart, once, on a desktop and only with motion allowed.
  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !window.matchMedia('(min-width: 900px)').matches) return;
    const timers: number[] = [];
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        [1, 2, 0].forEach((n, i) => timers.push(window.setTimeout(() => !touched.current && setAt(n), 600 * (i + 1))));
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) {
        setNear(true);
        io.disconnect();
      }
    }, { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // On a phone the counter follows the page in view.
  useEffect(() => {
    const list = row.current;
    if (!list) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setAt(Number((e.target as HTMLElement).dataset.n));
      },
      { root: list, threshold: 0.6 },
    );
    for (const li of list.children) io.observe(li);
    return () => io.disconnect();
  }, []);

  const pick = (n: number) => {
    touched.current = true;
    setAt((n + items.length) % items.length);
  };
  const num = (n: number) => String(n + 1).padStart(2, '0');

  return (
    <div className={s.book} ref={root}>
      <div className={s.stage} aria-live="polite">
        {items.map((it, i) => (
          <figure key={it.key} className={s.page} data-on={i === at ? '' : undefined} aria-hidden={i === at ? undefined : true}>
            {near && (
              <picture>
                {it.pic.sources.map((src) => (
                  <source key={src.type} type={src.type} srcSet={src.srcset} sizes="40vw" />
                ))}
                <img src={it.pic.fallback} width={it.pic.width} height={it.pic.height} alt={it.pic.alt} decoding="async" style={{ backgroundColor: it.pic.colour }} />
              </picture>
            )}
          </figure>
        ))}
        <p className={s.stageCap}>
          <b>{num(at)}</b>
          <span>
            {items[at]!.label}. {items[at]!.where}.
          </span>
        </p>
        <div className={s.turns}>
          <button type="button" className={s.turn} onClick={() => pick(at - 1)} aria-label="Previous piece" data-press>
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path d="M12.5 4 6.5 10l6 6" />
            </svg>
          </button>
          <span className={s.count}>
            {num(at)} / {num(items.length - 1)}
          </span>
          <button type="button" className={s.turn} onClick={() => pick(at + 1)} aria-label="Next piece" data-press>
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path d="M7.5 4 13.5 10l-6 6" />
            </svg>
          </button>
        </div>
      </div>

      <ol className={s.index}>
        {items.map((it, i) => (
          <li key={it.key}>
            <button type="button" aria-pressed={i === at} onClick={() => pick(i)}>
              <b>{num(i)}</b>
              <span>{it.label}</span>
              <i>{it.where}</i>
            </button>
          </li>
        ))}
      </ol>

      <ol className={s.swipe} ref={row} aria-label="Swipe through the pieces">
        {items.map((it, i) => (
          <li key={it.key} data-n={i}>
            <figure>
              <Pic pic={it.pic} sizes="78vw" low />
              <figcaption>
                <b>{num(i)}</b> {it.label}. {it.where}.
              </figcaption>
            </figure>
          </li>
        ))}
      </ol>
      <p className={s.swipeCount} aria-hidden="true">
        {num(at)} / {num(items.length - 1)}
      </p>
    </div>
  );
}
