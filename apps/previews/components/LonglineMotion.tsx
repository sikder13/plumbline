'use client';

import { useEffect } from 'react';

/**
 * The page's own scroll motions, fetched after it has painted. The opening section carries how far it
 * has scrolled away as `--hp` (the boat drives off), the farm carries its passage through the screen as
 * `--lp` (the fish swim between the lines), and the footer carries `--fp` (the boat comes home). Each
 * is a CSS variable, so the work stays on the compositor. With reduced motion asked for, none of it runs
 * and every part simply shows at rest.
 */
export function LonglineMotion() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const undo: (() => void)[] = [];
    let stopped = false;
    void import('motion').then(({ scroll }) => {
      if (stopped) return;
      const watch = (selector: string, prop: string, offset: [string, string]) => {
        const el = document.querySelector<HTMLElement>(selector);
        if (!el) return;
        undo.push(scroll((p: number) => el.style.setProperty(prop, p.toFixed(4)), { target: el, offset: offset as never }));
      };
      watch('[data-hero]', '--hp', ['start start', 'end start']);
      watch('[data-farm]', '--lp', ['start end', 'end start']);
      watch('[data-home]', '--fp', ['start end', 'end end']);
    });
    return () => {
      stopped = true;
      for (const u of undo) u();
    };
  }, []);
  return null;
}
