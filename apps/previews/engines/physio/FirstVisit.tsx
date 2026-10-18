'use client';

import { useState, type CSSProperties } from 'react';
import { useShowOnce } from '../useShowOnce';

/**
 * "Your first visit": the clinic's own steps, one at a time, with a bar that fills as the visitor
 * moves through them. On first view it steps through once, then rests on the first.
 */
export function FirstVisit({ steps, cls }: { steps: { title: string; text: string }[]; cls: Record<string, string> }) {
  const [at, setAt] = useState(0);
  const { ref, shown, stop } = useShowOnce<HTMLDivElement>(steps.length, { every: 600, rest: 0 });
  const i = shown ?? at;
  const go = (n: number) => {
    stop();
    setAt(Math.max(0, Math.min(steps.length - 1, n)));
  };
  return (
    <div ref={ref} className={cls.visit} style={{ '--at': (i + 1) / steps.length } as CSSProperties}>
      <div className={cls.visitBar} aria-hidden="true">
        <i />
      </div>
      <ol className={cls.visitSteps}>
        {steps.map((s, n) => (
          <li key={s.title} data-on={n === i ? '' : undefined} data-done={n < i ? '' : undefined} aria-current={n === i ? 'step' : undefined}>
            <button type="button" className={cls.visitStep} onClick={() => go(n)}>
              {s.title}
            </button>
          </li>
        ))}
      </ol>
      <div className={cls.visitPanel} aria-live="polite">
        <p className={cls.visitTitle}>{steps[i]!.title}</p>
        <p className={cls.visitText} key={i}>
          {steps[i]!.text}
        </p>
        <div className={cls.visitNav}>
          <button type="button" onClick={() => go(i - 1)} disabled={i === 0}>
            Back
          </button>
          <button type="button" onClick={() => go(i + 1)} disabled={i === steps.length - 1}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
