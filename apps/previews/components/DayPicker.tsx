'use client';

import { useState } from 'react';

interface Props {
  /** The places a visitor can choose between, by name. */
  venues: string[];
  /** How many may be chosen. */
  max: number;
  labels: {
    /** Said over the list of places, for a screen reader. */
    choose: string;
    title: string;
    /** The fixed lines that open and close the day: a time or a label, and what happens then. */
    start: { when: string; what: string };
    end: { when: string; what: string };
    /** A row not yet filled. */
    empty: string;
    /** Shown once every place is taken. */
    full: string;
    /** Joins the count to the limit: "2 of 4". */
    of: string;
    note: string;
    clear: string;
  };
  price?: { label: string; value: string };
  book: { label: string; href: string };
  className?: string;
}

/**
 * A day put together by the visitor: a tap on a place adds it to the card, in the order chosen,
 * and a second tap takes it off again. The card states nothing the business has not said. It
 * opens and closes with the business's own times and holds the chosen names between them.
 */
export function DayPicker({ venues, max, labels, price, book, className }: Props) {
  const [picks, setPicks] = useState<string[]>([]);
  const full = picks.length >= max;

  const toggle = (name: string) => setPicks((now) => (now.includes(name) ? now.filter((n) => n !== name) : now.length >= max ? now : [...now, name]));

  return (
    <div className={className} data-day data-full={full ? '' : undefined}>
      <ul data-day-venues aria-label={labels.choose}>
        {venues.map((name) => {
          const at = picks.indexOf(name);
          return (
            <li key={name}>
              <button type="button" aria-pressed={at >= 0} aria-disabled={full && at < 0 ? true : undefined} onClick={() => toggle(name)}>
                <i aria-hidden="true">{at >= 0 ? at + 1 : ''}</i>
                <span>{name}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div data-day-card role="group" aria-label={labels.title}>
        <header>
          <h3>{labels.title}</h3>
          {/* The count is for the eye. A screen reader is told the names as they are chosen. */}
          <p data-day-count aria-hidden="true">
            <b>{picks.length}</b> {labels.of} {max}
          </p>
          <p data-sr aria-live="polite">
            {picks.join(', ')}
          </p>
        </header>
        <ol>
          <li data-fixed>
            <i aria-hidden="true" />
            <b>{labels.start.when}</b>
            <span>{labels.start.what}</span>
          </li>
          {Array.from({ length: max }, (_, i) => (
            <li key={picks[i] ?? `empty-${i}`} data-stop data-filled={picks[i] ? '' : undefined}>
              <i aria-hidden="true">{i + 1}</i>
              {picks[i] ? <span>{picks[i]}</span> : <span data-empty>{labels.empty}</span>}
            </li>
          ))}
          <li data-fixed>
            <i aria-hidden="true" />
            <b>{labels.end.when}</b>
            <span>{labels.end.what}</span>
          </li>
        </ol>
        <p data-day-note>{full ? labels.full : labels.note}</p>
        <footer>
          {price && (
            <p data-day-price>
              <span>{price.label}</span>
              <b>{price.value}</b>
            </p>
          )}
          <a data-press href={book.href} rel="noopener">
            {book.label}
          </a>
        </footer>
        {picks.length > 0 && (
          <button type="button" data-day-clear onClick={() => setPicks([])}>
            {labels.clear}
          </button>
        )}
      </div>
    </div>
  );
}
