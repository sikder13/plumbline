'use client';

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { Picture } from '@/lib/data';

/**
 * Their cuts as a stack of cards. A drag, a swipe or the button throws the top card aside and shows the
 * next; after the last, the deck gathers again. It flicks one card once on arrival, then waits.
 */
export function CardDeck({ cards, s }: { cards: Picture[]; s: Record<string, string> }) {
  const [top, setTop] = useState(0);
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const touched = useRef(false);
  const n = cards.length;

  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let t = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      t = window.setTimeout(() => !touched.current && setTop(1), 700);
    }, { threshold: 0.6 });
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(t);
    };
  }, []);

  const next = () => {
    touched.current = true;
    setDrag(0);
    setTop((v) => (v + 1) % n);
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    start.current = e.clientX;
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (start.current !== null) setDrag(e.clientX - start.current);
  };
  const up = () => {
    if (start.current === null) return;
    start.current = null;
    if (Math.abs(drag) > 70) next();
    else setDrag(0);
  };

  return (
    <div className={s.deck} ref={root}>
      <div className={s.stack} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} aria-live="polite">
        {cards.map((c, i) => {
          const k = (i - top + n) % n;
          const isTop = k === 0;
          return (
            <figure key={c.fallback} className={s.card} data-k={k} aria-hidden={isTop ? undefined : true} style={{ '--k': k, '--drag': isTop ? `${drag}px` : '0px', zIndex: n - k } as CSSProperties}>
              <picture>
                {c.sources.map((x) => (
                  <source key={x.type} type={x.type} srcSet={x.srcset} sizes="(min-width: 900px) 30vw, 70vw" />
                ))}
                <img src={c.fallback} width={c.width} height={c.height} alt={c.alt} loading="lazy" decoding="async" draggable={false} style={{ backgroundColor: c.colour, objectPosition: c.position ?? undefined }} />
              </picture>
            </figure>
          );
        })}
      </div>
      <div className={s.deckRow}>
        <span className={s.deckCount}>
          {top + 1} of {n}
        </span>
        <button type="button" className={s.deckNext} onClick={next} data-press>
          Next cut
        </button>
      </div>
    </div>
  );
}
