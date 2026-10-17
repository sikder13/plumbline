'use client';

import { useEffect, useRef, type CSSProperties } from 'react';

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
 * A quotation that fills from grey to ink, word by word, as it is read down the screen. Each word
 * carries its place; the paragraph carries how far the reading has got (`--f`, 0 to 1) and the
 * styles work out each word's colour. Nothing is set up until the page has loaded and the quotation is
 * near; before that, and with reduced motion asked for, every word is already ink.
 */
export function BackyardFill({ text, className, word }: { text: string; className?: string; word: string }) {
  const el = useRef<HTMLSpanElement>(null);
  const words = text.split(' ');

  useEffect(() => {
    const node = el.current;
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let stop: (() => void) | undefined;
    let io: IntersectionObserver | undefined;
    let cancelled = false;
    const cancel = whenIdle(() => {
      io = new IntersectionObserver(
        ([e]) => {
          if (!e!.isIntersecting) return;
          io!.disconnect();
          void import('motion').then(({ scroll }) => {
            if (cancelled) return;
            stop = scroll((p: number) => node.style.setProperty('--f', p.toFixed(3)), { target: node, offset: ['start 0.88', 'end 0.5'] });
          });
        },
        { rootMargin: '300px 0px' },
      );
      io.observe(node);
    });
    return () => {
      cancelled = true;
      cancel();
      io?.disconnect();
      stop?.();
    };
  }, []);

  return (
    <span ref={el} className={className} style={{ '--f': 1, '--n': words.length } as CSSProperties}>
      {words.map((w, i) => (
        <span key={i} className={word} style={{ '--i': i } as CSSProperties}>
          {w}{' '}
        </span>
      ))}
    </span>
  );
}
