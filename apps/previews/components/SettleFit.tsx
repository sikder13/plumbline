'use client';

import { useEffect, useRef, type CSSProperties } from 'react';

/** The largest a fitted line may be set, in pixels, so a short line on a wide screen stays a line. */
const MOST = 132;

/**
 * Lines of type each set to fill the width of the list, like a poster: every line is measured once
 * the fonts are in, and again when the width changes, and given its own size as `--fs`. Until then
 * the lines wrap as ordinary text. When the list comes into view it is marked `data-in`, so the
 * lines can slide in from alternate sides.
 */
export function SettleFit({ lines, className, cls }: { lines: string[]; className?: string; cls: { line?: string } }) {
  const ref = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const list = ref.current;
    if (!list) return;
    const spans = [...list.querySelectorAll<HTMLElement>('li > span')];
    let width = 0;
    let stopped = false;

    const fit = () => {
      const now = list.clientWidth;
      if (stopped || !now || now === width) return;
      width = now;
      // Every line is measured at one size first, then all are sized together, so the page is laid out once.
      list.setAttribute('data-measure', '');
      const at = spans.map((s) => s.getBoundingClientRect().width);
      list.removeAttribute('data-measure');
      spans.forEach((s, i) => {
        const size = at[i] ? Math.min(MOST, Math.floor((now / at[i]!) * 100 * 0.97 * 10) / 10) : 0;
        if (size) s.parentElement!.style.setProperty('--fs', `${size}px`);
      });
      list.setAttribute('data-fitted', '');
    };

    const resize = new ResizeObserver(fit);
    void document.fonts.ready.then(() => {
      if (stopped) return;
      fit();
      resize.observe(list);
    });

    let seen: IntersectionObserver | undefined;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (list.getBoundingClientRect().top > window.innerHeight * 0.9) {
        list.setAttribute('data-in', 'wait');
        seen = new IntersectionObserver(
          ([e]) => {
            if (!e?.isIntersecting) return;
            list.setAttribute('data-in', 'yes');
            seen?.disconnect();
          },
          { rootMargin: '0px 0px -12% 0px' },
        );
        seen.observe(list);
      }
    }

    return () => {
      stopped = true;
      resize.disconnect();
      seen?.disconnect();
    };
  }, [lines]);

  return (
    <ul ref={ref} className={className}>
      {lines.map((l, i) => (
        <li key={l} className={cls.line} style={{ '--i': i } as CSSProperties}>
          <span>{l}</span>
        </li>
      ))}
    </ul>
  );
}
