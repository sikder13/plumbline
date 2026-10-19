'use client';

import { useEffect, useRef, type CSSProperties } from 'react';

/**
 * A felt letterboard. The letters are put up one by one when the board first comes into view, as a
 * barber would set them, under 2.4 seconds in all; then the board stays as it is. With reduced motion,
 * or before the page wakes, every letter is already up.
 */
export function LetterBoard({ lines, s, label }: { lines: string[]; s: Record<string, string>; label: string }) {
  const board = useRef<HTMLDivElement>(null);
  const total = lines.join('').replace(/ /g, '').length;
  useEffect(() => {
    const el = board.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.setAttribute('data-waiting', '');
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        el.removeAttribute('data-waiting');
        el.setAttribute('data-setting', '');
        io.disconnect();
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  let n = 0;
  return (
    <div className={s.board} ref={board} role="img" aria-label={label} style={{ '--step': `${Math.min(60, 2000 / Math.max(1, total))}ms` } as CSSProperties}>
      {lines.map((line) => (
        <p key={line} className={s.boardLine} aria-hidden="true">
          {[...line].map((ch, i) => (ch === ' ' ? <span key={i} className={s.gap} /> : <span key={i} className={s.tile} style={{ '--n': n++ } as CSSProperties}>{ch}</span>))}
        </p>
      ))}
    </div>
  );
}
