'use client';

import { useState, type ReactNode } from 'react';

/** A row of tabs with one panel shown at a time. Every panel is in the page, so nothing is fetched on a tap. */
export function Regions({ tabs, panels, label, className }: { tabs: { id: string; label: string }[]; panels: ReactNode[]; label: string; className?: string }) {
  const [active, setActive] = useState(0);
  return (
    <div className={className}>
      <div role="tablist" aria-label={label} data-tabs>
        {tabs.map((t, i) => (
          <button key={t.id} type="button" role="tab" id={`region-tab-${t.id}`} aria-selected={i === active} aria-controls={`region-${t.id}`} tabIndex={i === active ? 0 : -1} onClick={() => setActive(i)}>
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div key={t.id} role="tabpanel" id={`region-${t.id}`} aria-labelledby={`region-tab-${t.id}`} hidden={i !== active}>
          {panels[i]}
        </div>
      ))}
    </div>
  );
}
