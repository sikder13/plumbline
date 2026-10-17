'use client';

import { useEffect, useState } from 'react';

/**
 * Links to the sections of a page that know which section the visitor is in: the link to it is
 * marked `aria-current`, for a design to show as it likes. A section counts as current while it
 * covers the middle of the screen.
 */
export function SectionLinks({ items, className }: { items: { label: string; href: string }[]; className?: string }) {
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    const sections = items.map((n) => document.getElementById(n.href.slice(1))).filter((el): el is HTMLElement => !!el);
    const inView = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) inView.add(e.target.id);
          else inView.delete(e.target.id);
        }
        // Where two sections meet at the middle of the screen, the later one is the one being entered.
        const last = sections.filter((s) => inView.has(s.id)).pop();
        setCurrent(last ? `#${last.id}` : null);
      },
      { rootMargin: '-50% 0px -50% 0px' },
    );
    for (const s of sections) io.observe(s);
    return () => io.disconnect();
  }, [items]);

  return (
    <span className={className}>
      {items.map((n) => (
        <a key={n.href} href={n.href} aria-current={current === n.href ? 'location' : undefined}>
          {n.label}
        </a>
      ))}
    </span>
  );
}
