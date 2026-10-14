'use client';

import { useEffect } from 'react';

/**
 * Once the page has loaded and gone quiet, asks for the photographs further down that would otherwise
 * wait until they are almost on screen, so a visitor who scrolls quickly never meets an empty frame.
 * It runs only after the first screen is done, so it costs the opening nothing.
 */
export function AfootWarm({ scope }: { scope: string }) {
  useEffect(() => {
    let timer = 0;
    let idle = 0;
    const warm = () => {
      const root = document.querySelector(`.${scope}`);
      if (!root) return;
      for (const img of root.querySelectorAll<HTMLImageElement>('img[loading="lazy"]')) img.loading = 'eager';
    };
    const start = () => {
      timer = window.setTimeout(() => {
        const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
        if (w.requestIdleCallback) idle = w.requestIdleCallback(warm, { timeout: 2000 });
        else warm();
      }, 2500);
    };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
    return () => {
      window.removeEventListener('load', start);
      window.clearTimeout(timer);
      const w = window as Window & { cancelIdleCallback?: (id: number) => void };
      if (idle && w.cancelIdleCallback) w.cancelIdleCallback(idle);
    };
  }, [scope]);
  return null;
}
