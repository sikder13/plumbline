'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { report } from './Visits';

type Tab = 'demo' | 'found';

const TABS: { id: Tab; label: string }[] = [
  { id: 'demo', label: 'The demo' },
  { id: 'found', label: 'What we found and pricing' },
];

/** The slim bar at the top and the two tabs under it. Both tabs are in the page; one is shown. */
export function Shell({ line, demo, found }: { line: string; demo: ReactNode; found: ReactNode }) {
  const [tab, setTab] = useState<Tab>('demo');
  // Until this component is awake, a small script in the page answers the tabs. This tells it to stand down.
  const [live, setLive] = useState(false);

  useEffect(() => {
    const read = () => {
      const next = window.location.hash === '#found' ? 'found' : 'demo';
      if (next === 'found') report('tab_findings');
      setTab(next);
    };
    read();
    setLive(true);
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

  const show = (next: Tab) => {
    window.history.replaceState(null, '', next === 'found' ? '#found' : window.location.pathname);
    if (next === 'found') report('tab_findings');
    setTab(next);
    window.scrollTo(0, 0);
  };

  return (
    <>
      <header className="bar">
        <p className="bar-line">{line}</p>
        <div className="bar-tabs" role="tablist" aria-label="Sections of this page">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={t.id} data-live={live ? '' : undefined} tabIndex={tab === t.id ? 0 : -1} onClick={() => show(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </header>
      <div id="demo" role="tabpanel" aria-labelledby="tab-demo" hidden={tab !== 'demo'}>
        {demo}
      </div>
      <div id="found" role="tabpanel" aria-labelledby="tab-found" hidden={tab !== 'found'}>
        {found}
      </div>
    </>
  );
}
