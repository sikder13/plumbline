'use client';

import { useEffect, useState } from 'react';

interface Props {
  brand: string;
  items: { label: string; id: string }[];
  book: { label: string; href: string };
  cls: { dock: string; mark: string; now: string; book: string; gauge: string; fill: string };
}

/** Runs `run` once the browser has nothing better to do, so nothing here competes with the page loading. */
function whenIdle(run: () => void): () => void {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(run, { timeout: 4000 });
    return () => w.cancelIdleCallback?.(id);
  }
  const t = window.setTimeout(run, 1500);
  return () => window.clearTimeout(t);
}

/**
 * On large screens: the wordmark docks in the top corner once the opening has scrolled away, and the
 * name of the section in view slides in beside it. A tide staff on the right edge fills as the visitor
 * reads down the page; its water is moved by the styles alone, from the page's scroll. Phones keep the
 * floating booking pill instead.
 */
export function BackyardDock({ brand, items, book, cls }: Props) {
  const [now, setNow] = useState<string | null>(null);

  useEffect(() => {
    let io: IntersectionObserver | undefined;
    const cancel = whenIdle(() => {
      const sections = items.map((n) => document.getElementById(n.id)).filter((el): el is HTMLElement => !!el);
      const seen = new Set<string>();
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) seen.add(e.target.id);
            else seen.delete(e.target.id);
          }
          const last = sections.filter((s) => seen.has(s.id)).pop();
          setNow(last ? last.id : null);
        },
        { rootMargin: '-45% 0px -45% 0px' },
      );
      for (const s of sections) io.observe(s);
    });
    return () => {
      cancel();
      io?.disconnect();
    };
  }, [items]);

  const current = items.find((n) => n.id === now);
  return (
    <>
      <nav className={cls.dock} aria-label="Sections">
        <a className={cls.mark} href="#top">
          {brand}
        </a>
        <span className={cls.now} data-on={current ? '' : undefined}>
          <span key={current?.id ?? 'none'}>{current?.label ?? ''}</span>
        </span>
        <a className={cls.book} href={book.href} rel="noopener" data-press>
          {book.label}
        </a>
      </nav>
      <div className={cls.gauge} aria-hidden="true">
        <i className={cls.fill} />
      </div>
    </>
  );
}
