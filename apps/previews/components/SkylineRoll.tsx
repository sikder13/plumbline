'use client';

import { useEffect, useRef } from 'react';

export interface Guide {
  name: string;
  role: string;
  line: string;
}

type Cls = Record<'roll' | 'who' | 'role' | 'said', string | undefined>;

/** A roll call of guides. The name crossing the middle of the screen is lit, so the list answers the scroll. */
export function SkylineRoll({ guides, cls }: { guides: Guide[]; cls: Cls }) {
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const ol = list.current;
    if (!ol) return;
    const items = [...ol.querySelectorAll<HTMLElement>('li')];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) for (const li of items) li.toggleAttribute('data-on', li === e.target);
      },
      { rootMargin: '-46% 0px -46% 0px' },
    );
    for (const li of items) io.observe(li);
    return () => io.disconnect();
  }, []);

  return (
    <ol ref={list} className={cls.roll}>
      {guides.map((g, i) => (
        <li key={g.name} data-on={i === 0 ? '' : undefined}>
          <p className={cls.who}>{g.name}</p>
          {g.role && <p className={cls.role}>{g.role}</p>}
          <p className={cls.said}>{g.line}</p>
        </li>
      ))}
    </ol>
  );
}
