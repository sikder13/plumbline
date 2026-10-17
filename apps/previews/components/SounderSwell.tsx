'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  /** The id of the section whose `data-sea` this switch sets, to the index of the chosen state. */
  target: string;
  label: string;
  options: string[];
  cls: { [K in 'wrap' | 'ask' | 'track' | 'opt' | 'knob' | 'boat']?: string };
}

/**
 * A two way switch for the state of the sea, whose handle carries a small boat. The section it names
 * takes the chosen state as `data-sea`, and its styles do the rest. The first time the section comes
 * into view the switch shows itself once, over to the second state and back, unless the visitor has
 * touched it or asked for reduced motion.
 */
export function SounderSwell({ target, label, options, cls }: Props) {
  const [sea, setSea] = useState(0);
  const touched = useRef(false);
  const count = options.length;

  useEffect(() => {
    document.getElementById(target)?.setAttribute('data-sea', String(sea));
    // Others on the page, such as the booking console, follow the sea the visitor sets.
    (window as unknown as { __sounderSea?: number }).__sounderSea = sea;
    window.dispatchEvent(new CustomEvent('sounder-sea', { detail: sea }));
  }, [sea, target]);

  useEffect(() => {
    const section = document.getElementById(target);
    if (!section || count < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timers: number[] = [];
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        timers.push(window.setTimeout(() => !touched.current && setSea(1), 450));
        timers.push(window.setTimeout(() => !touched.current && setSea(0), 2800));
      },
      { threshold: 0.4 },
    );
    io.observe(section);
    return () => {
      io.disconnect();
      for (const t of timers) window.clearTimeout(t);
    };
  }, [target, count]);

  return (
    <div className={cls.wrap}>
      <p className={cls.ask} id={`${target}-ask`}>
        {label}
      </p>
      <div className={cls.track} role="group" aria-labelledby={`${target}-ask`} data-at={sea}>
        {options.map((o, i) => (
          <button
            key={o}
            type="button"
            className={cls.opt}
            aria-pressed={i === sea}
            onClick={() => {
              touched.current = true;
              setSea(i);
            }}
          >
            {o}
          </button>
        ))}
        <span className={cls.knob} aria-hidden="true">
          <svg className={cls.boat} viewBox="0 0 96 40" focusable="false">
            <path d="M46 21V10h22l7 11z" />
            <path d="M3 21h82q6 0 10-5l-6 15H8z" />
          </svg>
        </span>
      </div>
    </div>
  );
}
