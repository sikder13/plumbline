'use client';

import { useEffect, useRef, type CSSProperties } from 'react';

interface Step {
  time?: string;
  text: string;
}

/**
 * Their day on the water as a line down the page, each moment at the time they give for it. The
 * line fills as the visitor reads down it; the moment being read is marked.
 */
export function DayLine({ steps, cls }: { steps: Step[]; cls: Record<string, string> }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = ref.current;
    if (!list) return;
    const items = [...list.querySelectorAll<HTMLElement>('li')];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) (e.target as HTMLElement).dataset.on = '';
        const done = items.filter((i) => i.dataset.on !== undefined).length;
        list.style.setProperty('--done', String(done / items.length));
      },
      { rootMargin: '0px 0px -45% 0px' },
    );
    for (const i of items) io.observe(i);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={cls.dayLine} style={{ '--done': 0 } as CSSProperties}>
      <span className={cls.dayFill} aria-hidden="true" />
      <ol>
        {steps.map((s, i) => (
          <li key={`${i}-${s.text.slice(0, 20)}`} className={cls.dayStep}>
            {s.time && <p className={cls.dayTime}>{s.time}</p>}
            <p className={cls.dayText}>{s.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
