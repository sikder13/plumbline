'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

/**
 * Marks its element `data-on` the first time it comes into view, so a design can play one entrance from
 * its own stylesheet. Plumbing only. Before the page wakes, or with reduced motion, the element is
 * marked at once and shows its final state.
 */
export function OnView({ children, className, threshold = 0.35, style, as: Tag = 'div' }: { children: ReactNode; className?: string; threshold?: number; style?: CSSProperties; as?: 'div' | 'ul' | 'ol' }) {
  const el = useRef<HTMLElement>(null);
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return void node.setAttribute('data-on', '');
    node.setAttribute('data-wait', '');
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      node.removeAttribute('data-wait');
      node.setAttribute('data-on', '');
      io.disconnect();
    }, { threshold });
    io.observe(node);
    return () => io.disconnect();
  }, [threshold]);
  return (
    <Tag ref={el as never} className={className} style={style}>
      {children}
    </Tag>
  );
}
