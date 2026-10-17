'use client';

import { useState, type ReactNode } from 'react';
import { useShowOnce } from '../useShowOnce';

type Area = 'head' | 'neck' | 'shoulder' | 'back' | 'hip' | 'knee' | 'ankle' | 'hand' | 'whole';

/** Our names for the parts of the body. The conditions under each are theirs. */
const AREA: Record<Area, string> = {
  head: 'Head',
  neck: 'Neck',
  shoulder: 'Shoulders',
  back: 'Back',
  hip: 'Hips',
  knee: 'Knees',
  ankle: 'Ankles and feet',
  hand: 'Hands and wrists',
  whole: 'Whole body',
};

/**
 * "What we treat": the conditions they name, found by part of the body. Choosing a part shows what
 * they treat there, in their own words; only parts they name are offered. On first view the parts
 * are tried in turn.
 */
export function Treats({ areas, cls, children }: { areas: { area: Area; name: string }[]; cls: Record<string, string>; children?: ReactNode }) {
  const parts = [...new Set(areas.map((a) => a.area))];
  const [at, setAt] = useState(0);
  const { ref, shown, stop } = useShowOnce<HTMLDivElement>(parts.length, { every: 460, rest: 0 });
  const i = shown ?? at;
  const part = parts[i]!;
  return (
    <div ref={ref} className={cls.treats}>
      <div className={cls.treatList} role="radiogroup" aria-label="Part of the body">
        {parts.map((p, n) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={n === i}
            tabIndex={n === i ? 0 : -1}
            onClick={() => {
              stop();
              setAt(n);
            }}
            onKeyDown={(e) => {
              const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
              if (!d) return;
              e.preventDefault();
              stop();
              const next = (i + d + parts.length) % parts.length;
              setAt(next);
              (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
            }}
          >
            {AREA[p]}
          </button>
        ))}
      </div>
      <div className={cls.treatCard} aria-live="polite">
        <p className={cls.treatArea}>{AREA[part]}</p>
        <ul className={cls.treatNames}>
          {areas
            .filter((a) => a.area === part)
            .map((a) => (
              <li key={a.name} className={cls.treatName}>
                {a.name}
              </li>
            ))}
        </ul>
        {children}
      </div>
    </div>
  );
}
