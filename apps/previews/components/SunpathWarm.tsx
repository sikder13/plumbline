'use client';

import { useEffect } from 'react';

/**
 * Once the page has loaded and the browser has a quiet moment, asks for the photographs further down
 * that would otherwise wait until they are nearly on screen, so a visitor who scrolls quickly never meets
 * an empty frame. It does nothing until the opening screen is done, so it costs the first paint nothing.
 */
export function SunpathWarm() {
  useEffect(() => {
    let idle = 0;
    let timer = 0;
    const warm = () => {
      for (const img of document.querySelectorAll<HTMLImageElement>('#demo img[loading="lazy"], main img[loading="lazy"]')) img.loading = 'eager';
    };
    const later = () => {
      timer = window.setTimeout(() => {
        if ('requestIdleCallback' in window) idle = window.requestIdleCallback(warm, { timeout: 2500 });
        else warm();
      }, 1200);
    };
    if (document.readyState === 'complete') later();
    else window.addEventListener('load', later, { once: true });
    return () => {
      window.removeEventListener('load', later);
      clearTimeout(timer);
      if (idle && 'cancelIdleCallback' in window) window.cancelIdleCallback(idle);
    };
  }, []);
  return null;
}
