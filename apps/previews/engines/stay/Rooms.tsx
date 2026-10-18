'use client';

import { useState, type ReactNode } from 'react';
import { useShowOnce } from '../useShowOnce';

interface Unit {
  name: string;
  text?: string;
  sleeps?: string;
  price?: string;
  /** The view from the unit, drawn by the page. */
  view?: ReactNode;
}

/**
 * Their units, one at a time: a tab for each, and for the one chosen the view from it, what it
 * sleeps and what they say of it, with their own way to book. On first view the tabs are tried in turn.
 */
export function Rooms({ units, book, cls }: { units: Unit[]; book: { href: string; label: string; external: boolean }; cls: Record<string, string> }) {
  const [at, setAt] = useState(0);
  const { ref, shown, stop } = useShowOnce<HTMLDivElement>(units.length, { every: 480, rest: 0 });
  const i = shown ?? at;
  const u = units[i]!;
  return (
    <div ref={ref} className={cls.rooms}>
      <div className={cls.roomTabs} role="tablist" aria-label="Rooms">
        {units.map((x, n) => (
          <button
            key={x.name}
            type="button"
            role="tab"
            id={`room-${n}`}
            aria-selected={n === i}
            aria-controls="room-panel"
            tabIndex={n === i ? 0 : -1}
            className={cls.roomTab}
            onClick={() => {
              stop();
              setAt(n);
            }}
            onKeyDown={(e) => {
              const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
              if (!d) return;
              e.preventDefault();
              stop();
              const next = (i + d + units.length) % units.length;
              setAt(next);
              (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
            }}
          >
            {x.name}
          </button>
        ))}
      </div>
      <div id="room-panel" role="tabpanel" aria-labelledby={`room-${i}`} className={cls.roomPanel}>
        {units.map((x, n) => (x.view ? <div key={x.name} className={cls.roomView} data-on={n === i ? '' : undefined} aria-hidden={n !== i}>{x.view}</div> : null))}
        <div className={cls.roomWords}>
          <h3 className={cls.roomName}>{u.name}</h3>
          {(u.sleeps || u.price) && (
            <p className={cls.roomMeta}>
              {u.sleeps}
              {u.sleeps && u.price ? ' · ' : ''}
              {u.price}
            </p>
          )}
          {u.text && <p className={cls.roomText}>{u.text}</p>}
          <a className={cls.roomBook} href={book.href} rel={book.external ? 'noopener' : undefined} data-press>
            {book.label}
          </a>
        </div>
      </div>
    </div>
  );
}
