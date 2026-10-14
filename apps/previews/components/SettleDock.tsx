'use client';

import { useEffect, useState } from 'react';

/**
 * Once the first screen has gone by, the name docks in the top corner and the name of the section
 * being read joins it; on large screens the one action docks opposite. A section counts as being
 * read while it covers the middle of the screen.
 */
export function SettleDock({ name, items, shop, className, cls }: { name: string; items: { label: string; href: string }[]; shop: { label: string; href: string }; className?: string; cls: { mark?: string; where?: string; shop?: string } }) {
  const [where, setWhere] = useState('');

  useEffect(() => {
    const sections = items.map((n) => document.getElementById(n.href.slice(1))).filter((el): el is HTMLElement => !!el);
    const seen = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) seen.add(e.target.id);
          else seen.delete(e.target.id);
        }
        const last = sections.filter((s) => seen.has(s.id)).pop();
        setWhere(last ? (items.find((n) => n.href === `#${last.id}`)?.label ?? '') : '');
      },
      { rootMargin: '-48% 0px -52% 0px' },
    );
    for (const s of sections) io.observe(s);
    return () => io.disconnect();
  }, [items]);

  return (
    <div className={className}>
      <a className={cls.mark} href="#top">
        <b>{name}</b>
        <span key={where} className={cls.where} aria-hidden="true">
          {where}
        </span>
      </a>
      <a className={cls.shop} href={shop.href} rel="noopener" data-press>
        {shop.label}
      </a>
    </div>
  );
}
