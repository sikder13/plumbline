'use client';

import { useEffect, useRef, useState } from 'react';
import { indianaNow, stateAt, type Day } from './os/hours';

/**
 * The day's stamp on a work order: OPEN NOW or CLOSED, from the published hours and the Indiana clock.
 * It comes down once when the ticket first shows, then stays. Before the page wakes it says nothing.
 */
export function TicketStamp({ week, s }: { week: Day[]; s: Record<string, string> }) {
  const el = useRef<HTMLSpanElement>(null);
  const [state, setState] = useState<{ open: boolean; line: string } | null>(null);
  useEffect(() => {
    const tick = () => setState(stateAt(week, indianaNow()));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [week]);
  useEffect(() => {
    const node = el.current;
    if (!node || !state) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return void node.setAttribute('data-down', '');
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      node.setAttribute('data-down', '');
      io.disconnect();
    }, { threshold: 0.6 });
    io.observe(node);
    return () => io.disconnect();
  }, [state]);
  return (
    <span className={s.stampWrap}>
      <span className={s.stamp} ref={el} data-open={state ? (state.open ? 'yes' : 'no') : undefined} aria-hidden={state ? undefined : true}>
        {state ? (state.open ? 'Open now' : 'Closed') : ''}
      </span>
      <span className={s.stampLine}>{state?.line ?? ''}</span>
    </span>
  );
}
