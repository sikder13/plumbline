'use client';

import { useEffect, useRef, useState } from 'react';

/** A small button that opens the page's sections as a list, and closes when one is chosen. */
export function MenuButton({ label, close, links, className }: { label: string; close: string; links: { label: string; href: string }[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('keydown', key);
    document.addEventListener('pointerdown', away);
    return () => {
      document.removeEventListener('keydown', key);
      document.removeEventListener('pointerdown', away);
    };
  }, [open]);

  return (
    <div ref={root} className={className} data-open={open ? '' : undefined}>
      <button type="button" aria-expanded={open} aria-controls="page-menu" data-press onClick={() => setOpen(!open)}>
        {open ? close : label}
      </button>
      <nav id="page-menu" aria-label="Sections" hidden={!open}>
        {links.map((l) => (
          <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
            {l.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
