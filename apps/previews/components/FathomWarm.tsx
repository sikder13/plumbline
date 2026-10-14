'use client';

import { useEffect } from 'react';

/**
 * Once the page has loaded and gone quiet, asks for the photographs further down that would otherwise
 * wait until they are almost on screen, so a visitor who scrolls quickly never meets an empty frame.
 * It starts only after the load and an idle moment, so the opening screen and its photograph go first.
 */
export function FathomWarm({ scope }: { scope?: string }) {
  useEffect(() => {
    if (!scope) return;
    type Idle = Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    const w = window as Idle;
    let timer = 0;
    let idle = 0;
    const warm = () => {
      const root = document.querySelector(`.${scope}`);
      if (!root) return;
      for (const img of root.querySelectorAll<HTMLImageElement>('img[loading="lazy"]')) img.loading = 'eager';
    };
    const start = () => {
      timer = window.setTimeout(() => {
        if (w.requestIdleCallback) idle = w.requestIdleCallback(warm, { timeout: 1500 });
        else warm();
      }, 1200);
    };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
    return () => {
      window.removeEventListener('load', start);
      window.clearTimeout(timer);
      if (idle && w.cancelIdleCallback) w.cancelIdleCallback(idle);
    };
  }, [scope]);
  return null;
}
