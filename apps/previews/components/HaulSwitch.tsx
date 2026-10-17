'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A switch between a few ways of reading one section. The section named by `target` is told which is
 * chosen through `data-on`, and its styles show the parts marked with the same `data-choice`. As the
 * section first comes into view the switch flips through its options once and returns to the first,
 * so a visitor who only scrolls sees that it does something; any tap stops that.
 */
export function HaulSwitch({ target, label, options, cls }: { target: string; label: string; options: string[]; cls: { root: string; knob: string } }) {
  const [on, setOn] = useState(0);
  const touched = useRef(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = document.getElementById(target);
    if (el) el.dataset.on = String(on);
  }, [target, on]);

  // The photographs waiting behind the first are fetched as the section nears, so a switch never shows an empty frame.
  useEffect(() => {
    const el = document.getElementById(target);
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        for (const img of el.querySelectorAll<HTMLImageElement>('img[loading="lazy"]')) img.loading = 'eager';
      },
      { rootMargin: '900px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [target]);

  useEffect(() => {
    const el = root.current;
    if (!el || options.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timers: number[] = [];
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        const order = [...options.keys()].slice(1).concat(0);
        order.forEach((v, k) => timers.push(window.setTimeout(() => !touched.current && setOn(v), 1300 + k * 2400)));
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      for (const t of timers) window.clearTimeout(t);
    };
  }, [options]);

  return (
    <div ref={root} className={cls.root} role="group" aria-label={label} data-on={on}>
      <span className={cls.knob} aria-hidden="true" />
      {options.map((o, i) => (
        <button
          key={o}
          type="button"
          aria-pressed={on === i}
          onClick={() => {
            touched.current = true;
            setOn(i);
          }}
          data-press
        >
          {o}
        </button>
      ))}
    </div>
  );
}
