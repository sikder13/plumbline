'use client';

import { useEffect } from 'react';
import { VISIT_ENDPOINT } from '@/lib/offer';

export type VisitKind = 'view' | 'tab_findings' | 'cta_click';

/** How long the page must have been on screen before anything is reported. */
const VISIBLE_MS = 3000;

interface State {
  token: string | null;
  ready: boolean;
  sent: Set<VisitKind>;
  waiting: Set<VisitKind>;
}

const state: State = { token: null, ready: false, sent: new Set(), waiting: new Set() };

function send(kind: VisitKind): void {
  if (!state.token || state.sent.has(kind)) return;
  state.sent.add(kind);
  // Nothing is read back. A failed report is simply lost.
  void fetch(VISIT_ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: state.token, kind }), keepalive: true, credentials: 'omit' }).catch(() => undefined);
}

/**
 * Reports one thing a visitor did, once per page load. Nothing leaves the browser until the page
 * has been on screen for three seconds, which a link scanner opening the address never reaches.
 */
export function report(kind: VisitKind): void {
  if (state.ready) send(kind);
  else state.waiting.add(kind);
}

/** Counts the time the page is actually visible, then reports the view and anything that waited for it. */
export function Visits({ token }: { token: string }) {
  useEffect(() => {
    state.token = token;
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    // A visitor who has asked not to be tracked is not counted.
    if (nav.globalPrivacyControl || nav.doNotTrack === '1') return;

    let visibleMs = 0;
    let since: number | null = document.visibilityState === 'visible' ? performance.now() : null;
    let timer: number | undefined;

    const done = () => {
      state.ready = true;
      send('view');
      for (const kind of state.waiting) send(kind);
      state.waiting.clear();
      document.removeEventListener('visibilitychange', onChange);
    };
    const arm = () => {
      timer = window.setTimeout(done, Math.max(0, VISIBLE_MS - visibleMs));
    };
    const onChange = () => {
      window.clearTimeout(timer);
      if (document.visibilityState === 'visible') {
        since = performance.now();
        arm();
      } else if (since !== null) {
        visibleMs += performance.now() - since;
        since = null;
      }
    };
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>('[data-visit]');
      if (el?.dataset.visit === 'cta_click') report('cta_click');
    };

    document.addEventListener('visibilitychange', onChange);
    document.addEventListener('click', onClick);
    if (since !== null) arm();
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onChange);
      document.removeEventListener('click', onClick);
    };
  }, [token]);
  return null;
}
