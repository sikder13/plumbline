'use client';

import { useEffect, useRef } from 'react';

/**
 * A short silent loop of the business's own footage over the photo that opens the page. The photo
 * is what paints first; the film is fetched afterwards and fades in over it. It is skipped for a
 * visitor who has asked for reduced motion or to save data.
 */
export function HeroVideo({ src, className }: { src: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    const saving = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (!video || saving || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const show = () => video.setAttribute('data-playing', '');
    video.addEventListener('playing', show, { once: true });
    video.src = src;
    void video.play().catch(() => undefined);
    return () => video.removeEventListener('playing', show);
  }, [src]);
  return <video ref={ref} className={className} muted loop playsInline preload="none" aria-hidden="true" tabIndex={-1} />;
}
