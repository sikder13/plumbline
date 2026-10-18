'use client';

import { useState, type CSSProperties } from 'react';
import { useShowOnce } from '../useShowOnce';

interface Item {
  label: string;
  text: string;
}

/**
 * Their own rules for the water, as a strip of marks along a river line: each mark a rule, opened
 * one at a time. On first view the marks open in turn, then the first stays open.
 */
export function Conditions({ items, cls }: { items: Item[]; cls: Record<string, string> }) {
  const [open, setOpen] = useState(0);
  const { ref, shown, stop } = useShowOnce<HTMLDivElement>(items.length, { every: 480, rest: 0 });
  const i = shown ?? open;
  return (
    <div ref={ref} className={cls.conditions} style={{ '--n': items.length, '--at': i } as CSSProperties}>
      <div className={cls.gauge} role="tablist" aria-label="Conditions">
        {items.map((x, n) => (
          <button
            key={x.label}
            type="button"
            role="tab"
            id={`cond-${n}`}
            aria-selected={n === i}
            aria-controls="cond-panel"
            tabIndex={n === i ? 0 : -1}
            className={cls.gaugeMark}
            onClick={() => {
              stop();
              setOpen(n);
            }}
            onKeyDown={(e) => {
              const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
              if (!step) return;
              e.preventDefault();
              stop();
              const next = (i + step + items.length) % items.length;
              setOpen(next);
              (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
            }}
          >
            <span>{x.label}</span>
          </button>
        ))}
      </div>
      <div id="cond-panel" role="tabpanel" aria-labelledby={`cond-${i}`} className={cls.condPanel}>
        <p className={cls.condLabel}>{items[i]!.label}</p>
        <p className={cls.condText} key={i}>
          {items[i]!.text}
        </p>
      </div>
    </div>
  );
}
