'use client';

import { useEffect, useRef } from 'react';
import { Kayak } from './LandingKayak';
import { SectionLinks } from './SectionLinks';

/**
 * On a wide screen, a paddle line down the right edge of the page: the sections are its stops, and a
 * kayak travels down it from the first beach to the last as the visitor reads. The one action sits
 * at its foot. The kayak's place is decoration; the links say where the visitor is.
 */
export function LandingGauge({
  items,
  start,
  book,
  cls,
}: {
  items: { label: string; href: string }[];
  start: string;
  book: { label: string; href: string };
  cls: Record<'gauge' | 'track' | 'boat' | 'start' | 'links' | 'book', string | undefined>;
}) {
  const ref = useRef<HTMLElement>(null);

  // On a wide screen only, once the browser is idle: one passive scroll listener writes the reading position, once a frame.
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !window.matchMedia('(min-width: 1180px)').matches) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const room = document.documentElement.scrollHeight - window.innerHeight;
        el.style.setProperty('--g', (room > 0 ? Math.min(1, Math.max(0, window.scrollY / room)) : 0).toFixed(4));
      });
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    const start = () => {
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    };
    const id = w.requestIdleCallback ? w.requestIdleCallback(start, { timeout: 2500 }) : window.setTimeout(start, 300);
    return () => {
      if (w.cancelIdleCallback) w.cancelIdleCallback(id);
      else window.clearTimeout(id);
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <nav ref={ref} className={cls.gauge} aria-label="Sections">
      <span className={cls.track} aria-hidden="true">
        <span className={cls.boat}>
          <Kayak wake />
        </span>
      </span>
      <span className={cls.start} aria-hidden="true">
        {start}
      </span>
      <SectionLinks className={cls.links} items={items} />
      <a className={cls.book} href={book.href} rel="noopener" data-press data-magnetic>
        {book.label}
      </a>
    </nav>
  );
}
