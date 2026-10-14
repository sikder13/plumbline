'use client';

import { useEffect, useState } from 'react';

/**
 * The always visible action, carrying what the visitor has put in the note: "Plan fly fishing ·
 * $1,300". It is the desk's bar button, and on a phone it writes the same words into the floating
 * booking pill. Until the note says anything, it reads as the page's one action. The link is always
 * the business's own enquiry form.
 */
export function EarshotCarry({ label, href, className }: { label: string; href: string; className?: string }) {
  const [text, setText] = useState(label);

  useEffect(() => {
    const take = (e: Event) => {
      const next = (e as CustomEvent<{ label: string }>).detail?.label;
      if (!next) return;
      setText(next);
      const pill = document.querySelector<HTMLAnchorElement>('.float-bar .float-main');
      if (pill && pill.textContent !== next) pill.textContent = next;
    };
    window.addEventListener('earshot:choice', take);
    return () => window.removeEventListener('earshot:choice', take);
  }, []);

  return (
    <a className={className} href={href} rel="noopener" data-press data-magnetic>
      {text}
    </a>
  );
}
