'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Item {
  name: string;
  text: string;
  picture: ReactNode;
}

/**
 * Photographs shown one at a time along a line of stops. On a phone they are swiped edge to edge,
 * and the stop the visitor has reached is marked on the line beneath. On a wide screen the stops
 * are a list beside the photograph, and choosing one brings its photograph up. How the two are
 * laid out is each design's own: the photographs either sit in a row that scrolls, or are stacked.
 */
export function StopGallery({ items, label, className }: { items: Item[]; label: string; className?: string }) {
  const track = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const t = track.current;
    if (!t) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (t.scrollWidth > t.clientWidth + 1) setActive(Math.max(0, Math.min(items.length - 1, Math.round(t.scrollLeft / t.clientWidth))));
      });
    };
    t.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      t.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [items.length]);

  const go = (i: number) => {
    const t = track.current;
    // In a row, the row is moved and its own scroll marks the stop. Stacked, the stop is simply chosen.
    if (t && t.scrollWidth > t.clientWidth + 1) t.scrollTo({ left: i * t.clientWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    else setActive(i);
  };

  return (
    <div className={className} data-gallery>
      <ol ref={track} data-gallery-track aria-label={label} tabIndex={0}>
        {items.map((it, i) => (
          <li key={it.name} data-on={i === active ? '' : undefined}>
            {it.picture}
            <div data-gallery-words>
              <h3>{it.name}</h3>
              <p>{it.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <div data-gallery-stops role="group" aria-label={label}>
        {items.map((it, i) => (
          <button key={it.name} type="button" aria-pressed={i === active} onClick={() => go(i)}>
            <i aria-hidden="true" />
            <span data-no aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <b>{it.name}</b>
            <span data-text>{it.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
