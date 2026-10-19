'use client';

import { useEffect, useState } from 'react';
import { indianaNow, stateAt, type Day } from './os/hours';

/** A neon OPEN sign, lit only while the published hours say they are open, by the Indiana clock. */
export function NeonOpen({ week, s }: { week: Day[]; s: Record<string, string> }) {
  const [state, setState] = useState<{ open: boolean; line: string } | null>(null);
  useEffect(() => {
    const tick = () => setState(stateAt(week, indianaNow()));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [week]);
  return (
    <div className={s.neonWrap}>
      <p className={s.neon} data-lit={state?.open ? '' : undefined} aria-hidden="true">
        Open
      </p>
      <p className={s.neonLine}>{state ? state.line : 'Open every day'}</p>
    </div>
  );
}
