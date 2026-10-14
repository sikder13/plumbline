'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';

interface Mark {
  label: string;
  caption: string;
}

/**
 * A line of generations, given to the page as separate pieces so the design can lay them out on its own grid:
 * filled marks for those before, a portrait for the one standing here, hollow marks for those still to come,
 * a button for each of the three, and the words for the one chosen, in the business's own words. The piece
 * that is chosen carries `data-lit`. Before the script arrives the portrait is chosen. Styled by the design
 * through the data attributes below.
 */
export function LineageStrand({ before, after, marks, portrait }: { before: number; after: number; marks: [Mark, Mark, Mark]; portrait: ReactNode }) {
  const [on, setOn] = useState(1);
  const lit = (i: number) => (on === i ? '' : undefined);
  const key = (i: number) => (
    <button type="button" data-key={i} aria-pressed={on === i} onClick={() => setOn(i)} data-press>
      {marks[i]!.label}
    </button>
  );
  return (
    <>
      <div data-before data-lit={lit(0)} aria-hidden="true">
        {Array.from({ length: before - 1 }, (_, i) => (
          <i key={i} data-past style={{ '--i': i } as CSSProperties} />
        ))}
      </div>
      <span data-self data-lit={lit(1)}>
        <span data-ring aria-hidden="true" />
        <span data-face>{portrait}</span>
      </span>
      <div data-after data-lit={lit(2)} aria-hidden="true">
        {Array.from({ length: after }, (_, k) => (
          <i key={k} data-next style={{ '--k': k } as CSSProperties} />
        ))}
      </div>
      {key(0)}
      {key(1)}
      {key(2)}
      <p data-caption aria-live="polite">
        <span key={on}>{marks[on]!.caption}</span>
      </p>
    </>
  );
}
