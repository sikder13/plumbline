'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export interface MapPin {
  id: string;
  name: string;
  place: string;
  /** Where the pin stands on the drawing, out of 1000 across and down. */
  x: number;
  y: number;
  text: string;
  picture?: ReactNode;
}

type Cls = Record<'box' | 'map' | 'pin' | 'tag' | 'panel' | 'card' | 'photo' | 'place' | 'name' | 'text' | 'add' | 'hint', string | undefined>;

/** Where the visitor's chosen adventures are kept, for the booking part of the page to read. */
export const WISH_EVENT = 'sunpath-wish';
type WishWindow = Window & { __sunpathWish?: string[] };

/**
 * A drawn map with a pin for each thing to do. Tapping a pin opens its card beside the map: a photograph
 * where there is one, the place, and the business's own words. A card can be added to the stay; the names
 * added are announced on the window for the booking part of the page. As the map first comes into view it
 * opens a few pins by itself, so the visitor sees what it does; any tap stops that.
 */
export function SunpathMap({ pins, drawing, demo, labels, cls }: { pins: MapPin[]; drawing: ReactNode; demo: string[]; labels: { add: string; added: string; hint: string }; cls: Cls }) {
  const [active, setActive] = useState(() => Math.max(0, pins.findIndex((p) => p.id === demo[0])));
  const [wish, setWish] = useState<string[]>([]);
  const touched = useRef(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timers: number[] = [];
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        demo.slice(1).forEach((id, k) => {
          const i = pins.findIndex((p) => p.id === id);
          if (i < 0) return;
          timers.push(
            window.setTimeout(() => {
              if (!touched.current) setActive(i);
            }, 900 + k * 1400),
          );
        });
      },
      { threshold: 0.45 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      for (const t of timers) clearTimeout(t);
    };
  }, [demo, pins]);

  const pick = (i: number) => {
    touched.current = true;
    setActive(i);
  };

  const toggle = (name: string) => {
    touched.current = true;
    setWish((was) => {
      const next = was.includes(name) ? was.filter((w) => w !== name) : [...was, name];
      (window as WishWindow).__sunpathWish = next;
      window.dispatchEvent(new CustomEvent(WISH_EVENT, { detail: next }));
      return next;
    });
  };

  const on = pins[active]!;
  return (
    <div ref={box} className={cls.box}>
      <div className={cls.map}>
        {drawing}
        {pins.map((p, i) => (
          <button
            key={p.id}
            type="button"
            className={cls.pin}
            data-on={i === active ? '' : undefined}
            data-wished={wish.includes(p.name) ? '' : undefined}
            aria-pressed={i === active}
            aria-label={`${p.name}, ${p.place}`}
            onClick={() => pick(i)}
            style={{ '--x': `${p.x / 10}%`, '--y': `${p.y / 10}%` } as CSSProperties}
          >
            <i aria-hidden="true" />
          </button>
        ))}
        <p className={cls.tag} aria-hidden="true" style={{ '--x': `${on.x / 10}%`, '--y': `${on.y / 10}%` } as CSSProperties} key={on.id}>
          {on.name}
        </p>
      </div>
      <p className={cls.hint}>{labels.hint}</p>
      <div className={cls.panel} aria-live="polite">
        {pins.map((p, i) => (
          <article key={p.id} className={cls.card} data-on={i === active ? '' : undefined} data-photo={p.picture ? '' : undefined} aria-hidden={i === active ? undefined : true}>
            <div className={cls.photo} data-empty={p.picture ? undefined : ''}>
              {p.picture ?? <span aria-hidden="true">{p.place}</span>}
            </div>
            <p className={cls.place}>{p.place}</p>
            <h3 className={cls.name}>{p.name}</h3>
            <p className={cls.text}>{p.text}</p>
            <button type="button" className={cls.add} aria-pressed={wish.includes(p.name)} tabIndex={i === active ? 0 : -1} onClick={() => toggle(p.name)}>
              <span aria-hidden="true">{wish.includes(p.name) ? '✓' : '+'}</span>
              {wish.includes(p.name) ? labels.added : labels.add}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
