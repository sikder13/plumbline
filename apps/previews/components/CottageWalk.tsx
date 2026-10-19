'use client';

import { useEffect, useRef, useState } from 'react';
import { Pic } from './Pic';
import type { Picture } from '@/lib/data';

/**
 * Walking in: three of their photos, each opening out of a small window into the next as the reader
 * scrolls. On a desktop the frame holds while the steps change, two screens at most; on a phone the
 * photos simply follow one another. With reduced motion every step is shown as it is.
 */
export function CottageWalk({ steps, s }: { steps: { key: string; label: string; pic: Picture }[]; s: Record<string, string> }) {
  const root = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const marks = [...el.querySelectorAll<HTMLElement>('[data-mark]')];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setAt(Number((e.target as HTMLElement).dataset.mark));
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    for (const m of marks) io.observe(m);
    return () => io.disconnect();
  }, []);
  return (
    <div className={s.walk} ref={root} style={{ ['--steps' as string]: steps.length }}>
      <div className={s.walkPin}>
        <div className={s.walkFrame}>
          {steps.map((st, i) => (
            <figure key={st.key} className={s.walkStep} data-state={i < at ? 'past' : i === at ? 'on' : 'next'}>
              <Pic pic={st.pic} sizes="(min-width: 900px) 56vw, 100vw" low />
              <figcaption>
                <b>{String(i + 1).padStart(2, '0')}</b> {st.label}
              </figcaption>
            </figure>
          ))}
        </div>
        <ol className={s.walkDots} aria-hidden="true">
          {steps.map((st, i) => (
            <li key={st.key} data-on={i === at ? '' : undefined}>
              {st.label}
            </li>
          ))}
        </ol>
      </div>
      {steps.map((st, i) => (
        <i key={st.key} className={s.walkMark} data-mark={i} aria-hidden="true" />
      ))}
    </div>
  );
}
