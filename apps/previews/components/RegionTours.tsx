'use client';

import { useState, type ReactNode } from 'react';

interface Tour {
  name: string;
  duration: string;
  price: string;
  href: string;
}

interface Region {
  id: string;
  label: string;
  blurb: string;
  group: string;
  tours: Tour[];
}

interface Props {
  regions: Region[];
  /** One photograph per region, in the same order. */
  photos: ReactNode[];
  label: string;
  from: string;
  book: string;
  className?: string;
}

/**
 * Tours as compact rows under a control that picks the region. The region's photograph stays in
 * view beside the rows on a large screen and above them on a phone, and changes with the region.
 */
export function RegionTours({ regions, photos, label, from, book, className }: Props) {
  const [active, setActive] = useState(0);
  return (
    <div className={className}>
      <div data-photos aria-hidden="true">
        {photos.map((p, i) => (
          <div key={regions[i]!.id} data-state={i === active ? 'on' : 'off'}>
            {p}
          </div>
        ))}
      </div>
      <div data-list>
        <div data-control role="tablist" aria-label={label}>
          {regions.map((r, i) => (
            <button key={r.id} type="button" role="tab" id={`region-tab-${r.id}`} aria-selected={i === active} aria-controls={`region-${r.id}`} tabIndex={i === active ? 0 : -1} data-press onClick={() => setActive(i)}>
              {r.label}
            </button>
          ))}
        </div>
        {regions.map((r, i) => (
          <div key={r.id} role="tabpanel" id={`region-${r.id}`} aria-labelledby={`region-tab-${r.id}`} hidden={i !== active} data-panel>
            <p data-blurb>
              {r.blurb} <span>{r.group}.</span>
            </p>
            <ul>
              {r.tours.map((t) => (
                <li key={t.name}>
                  <a href={t.href} rel="noopener" aria-label={`${book}: ${t.name}`}>
                    <span data-name>{t.name}</span>
                    <span data-meta>{t.duration}</span>
                    <span data-price>
                      <small>{from}</small> {t.price}
                    </span>
                    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
                      <path d="M5 12h13M12.5 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
