'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * A row that is swiped on a phone, with the phone's own momentum and snap. On a large screen the
 * row holds still in view and travels sideways as the visitor scrolls down, then lets go.
 */
export function SideScroll({ children, className, head, label }: { children: ReactNode; className?: string; head?: ReactNode; label: string }) {
  const outer = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const o = outer.current;
    const t = track.current;
    if (!o || !t || !window.matchMedia('(min-width: 900px)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    const measure = () => {
      const travel = Math.max(0, t.scrollWidth - window.innerWidth);
      o.style.height = `calc(100vh + ${travel}px)`;
      return travel;
    };
    o.setAttribute('data-pinned', '');
    measure();
    void import('motion').then(({ scroll }) => {
      if (cancelled) return;
      stop = scroll((progress: number) => void (t.style.transform = `translate3d(${-progress * measure()}px, 0, 0)`), { target: o, offset: ['start start', 'end end'] });
    });
    window.addEventListener('resize', measure);
    return () => {
      cancelled = true;
      stop?.();
      window.removeEventListener('resize', measure);
      o.removeAttribute('data-pinned');
      o.style.height = '';
      t.style.transform = '';
    };
  }, []);

  return (
    <div ref={outer} className={className} data-side>
      <div data-side-frame>
        {head}
        <div ref={track} data-side-track role="group" aria-label={label} tabIndex={0}>
          {children}
        </div>
      </div>
    </div>
  );
}
