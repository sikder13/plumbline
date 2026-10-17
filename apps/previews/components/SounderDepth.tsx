'use client';

import { useEffect, useRef } from 'react';

interface Props {
  label: string;
  /** The sections, top to bottom, each a deeper mark on the rail. */
  marks: { label: string; href: string }[];
  cls: { [K in 'rail' | 'ticks' | 'strip' | 'now' | 'marks' | 'mark']?: string };
}

/**
 * A depth rail on the edge of the screen, read like a sounder's scale. Its ticks run past as the page
 * scrolls (`--depth`, 0 to 1), each section sits at its own deeper mark (`--at`), and the mark the
 * visitor has reached is the current link. A drawn scale only: it carries no depths.
 */
export function SounderDepth({ label, marks, cls }: Props) {
  const nav = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = nav.current;
    if (!el) return;
    const items = [...el.querySelectorAll<HTMLElement>('[data-mark]')];
    let tops: number[] = [];
    let current = -1;
    let stopped = false;
    let stop: (() => void) | undefined;

    const measure = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      tops = marks.map((m) => {
        const t = document.getElementById(m.href.slice(1));
        return t ? t.getBoundingClientRect().top + window.scrollY : 0;
      });
      items.forEach((it, i) => it.style.setProperty('--at', Math.min(1, Math.max(0, tops[i]! / max)).toFixed(4)));
    };
    const mark = () => {
      const y = window.scrollY + window.innerHeight * 0.45;
      let c = 0;
      for (let i = 0; i < tops.length; i++) if (y >= tops[i]!) c = i;
      if (c === current) return;
      items[current]?.querySelector('a')?.removeAttribute('aria-current');
      items[c]?.querySelector('a')?.setAttribute('aria-current', 'location');
      current = c;
    };
    const apply = (p: number) => {
      el.style.setProperty('--depth', p.toFixed(4));
      mark();
    };

    measure();
    mark();
    const late = window.setTimeout(() => {
      measure();
      mark();
    }, 1600);
    window.addEventListener('resize', measure);
    void import('motion').then(({ scroll }) => {
      if (stopped) return;
      stop = scroll(apply);
    });
    return () => {
      stopped = true;
      stop?.();
      window.clearTimeout(late);
      window.removeEventListener('resize', measure);
    };
  }, [marks]);

  return (
    <nav ref={nav} className={cls.rail} aria-label={label}>
      <span className={cls.ticks} aria-hidden="true">
        <span className={cls.strip} />
      </span>
      <span className={cls.now} aria-hidden="true" />
      <ol className={cls.marks}>
        {marks.map((m) => (
          <li key={m.href} className={cls.mark} data-mark>
            <a href={m.href}>
              <i aria-hidden="true" />
              <span>{m.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
