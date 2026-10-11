'use client';

import { useEffect } from 'react';

/** Keyboard review: a approves and r rejects the highlighted finding, n moves to the next one. */
export function ReviewKeys() {
  useEffect(() => {
    const cards = () => Array.from(document.querySelectorAll<HTMLElement>('[data-finding]'));
    const current = () => document.querySelector<HTMLElement>('[data-finding].current');
    const select = (card: HTMLElement | undefined) => {
      if (!card) return;
      current()?.classList.remove('current');
      card.classList.add('current');
      card.scrollIntoView({ block: 'start', behavior: 'smooth' });
    };
    if (!current()) select(cards().find((c) => c.dataset.open === 'yes') ?? cards()[0]);

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || (target && /^(TEXTAREA|INPUT|SELECT)$/.test(target.tagName))) return;
      const key = e.key.toLowerCase();
      if (key === 'n') {
        const list = cards();
        const i = list.indexOf(current() as HTMLElement);
        if (i >= 0 && i < list.length - 1) select(list[i + 1]);
        else document.getElementById('next-business')?.click();
        e.preventDefault();
      } else if (key === 'a' || key === 'r') {
        const button = current()?.querySelector<HTMLButtonElement>(key === 'a' ? 'button.approve' : 'button.reject');
        if (button && !button.disabled) {
          sessionStorage.setItem('plumbline-next-after', current()!.dataset.finding ?? '');
          button.click();
        }
        e.preventDefault();
      }
    };
    document.addEventListener('keydown', onKey);

    // After a decision the page reloads its data. Move on to the next finding still waiting.
    const after = sessionStorage.getItem('plumbline-next-after');
    if (after) {
      sessionStorage.removeItem('plumbline-next-after');
      const list = cards();
      const i = list.findIndex((c) => c.dataset.finding === after);
      select(list.slice(i + 1).find((c) => c.dataset.open === 'yes') ?? list.find((c) => c.dataset.open === 'yes') ?? list[i]);
    }
    return () => document.removeEventListener('keydown', onKey);
  });
  return null;
}
