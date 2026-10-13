'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { report } from './Visits';

type Tab = 'demo' | 'found';

const TABS: { id: Tab; label: string }[] = [
  { id: 'demo', label: 'Demo' },
  { id: 'found', label: 'Findings' },
];

interface Props {
  business: string;
  /** The words of the link in the strip that opens the second tab. */
  foundLink: string;
  sender: { name: string; href: string };
  demo: ReactNode;
  found: ReactNode;
}

/**
 * The frame around a demo, kept as small as it can be: a thin strip at the top that slides away as
 * the visitor reads down and returns when they scroll up, and a small pill at the bottom left for
 * moving between the two tabs once the opening photo has gone by. Both tabs are in the page.
 */
export function Shell({ business, foundLink, sender, demo, found }: Props) {
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

  useEffect(() => {
    const root = document.documentElement;
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) < 6) return;
      root.toggleAttribute('data-strip-away', y > last && y > 80);
      last = y;
    };
    // The floating controls wait until the photo that opens the page has scrolled away.
    const hero = document.querySelector('[data-hero]');
    const past = hero ? new IntersectionObserver(([e]) => root.toggleAttribute('data-past-hero', !e!.isIntersecting && e!.boundingClientRect.top < 0), { threshold: 0 }) : null;
    if (hero && past) past.observe(hero);
    else root.setAttribute('data-past-hero', '');
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      past?.disconnect();
    };
  }, []);

  const show = (next: Tab) => {
    window.history.replaceState(null, '', next === 'found' ? '#found' : window.location.pathname);
    if (next === 'found') report('tab_findings');
    const swap = () => {
      setTab(next);
      window.scrollTo(0, 0);
    };
    // Where the browser can, the two tabs cross over in one movement. Elsewhere they simply change.
    const doc = document as Document & { startViewTransition?: (run: () => void) => unknown };
    if (doc.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) doc.startViewTransition(() => flushSync(swap));
    else swap();
  };

  return (
    <div data-tab={tab}>
      <header className="strip">
        <p>
          <span className="strip-name">
            Demo for {business}
            <span className="strip-by">
              {' '}
              by{' '}
              <a href={sender.href} target="_blank" rel="noopener">
                {sender.name}
              </a>
            </span>
          </span>
          <span aria-hidden="true"> · </span>
          <a
            href="#found"
            className="strip-found"
            onClick={(e) => {
              e.preventDefault();
              show(tab === 'found' ? 'demo' : 'found');
            }}
          >
            {tab === 'found' ? 'Back to the demo' : foundLink}
          </a>
        </p>
      </header>
      <div id="demo" role="tabpanel" aria-labelledby="tab-demo" hidden={tab !== 'demo'}>
        {demo}
      </div>
      <div id="found" role="tabpanel" aria-labelledby="tab-found" hidden={tab !== 'found'}>
        {found}
      </div>
      <div className="tab-pill" role="tablist" aria-label="Sections of this page">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={t.id} data-live={live ? '' : undefined} tabIndex={tab === t.id ? 0 : -1} onClick={() => show(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
