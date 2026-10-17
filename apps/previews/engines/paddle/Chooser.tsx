'use client';

import { useState } from 'react';
import { useShowOnce } from '../useShowOnce';

interface Trip {
  name: string;
  text?: string;
  duration?: string;
  level?: string;
  price?: string;
}

interface Props {
  trips: Trip[];
  /** Where a choice is taken: their booking link, or their email with the choice written in. */
  book: { href: string; label: string } | null;
  email: string | null;
  phone: { href: string; label: string } | null;
  cls: Record<string, string>;
}

/**
 * "Pick your paddle": their own trips as choices. The chosen one fills a short note, and the note
 * goes where they take bookings: their booking link, or an email to their own address with the
 * trip already named. On first view the choices are tried in turn, then the first is chosen.
 */
export function Chooser({ trips, book, email, phone, cls }: Props) {
  const [chosen, setChosen] = useState(0);
  const { ref, shown, stop } = useShowOnce<HTMLDivElement>(trips.length, { every: 460, rest: 0 });
  const i = shown ?? chosen;
  const t = trips[i]!;
  const mail = email ? `mailto:${email}?subject=${encodeURIComponent(`${t.name}: enquiry`)}&body=${encodeURIComponent(`Hello,\n\nI would like to ask about ${t.name}.\n\n`)}` : null;
  return (
    <div ref={ref} className={cls.chooser}>
      <div className={cls.choices} role="radiogroup" aria-label="Choose a trip">
        {trips.map((x, n) => (
          <button
            key={x.name}
            type="button"
            role="radio"
            aria-checked={n === i}
            tabIndex={n === i ? 0 : -1}
            className={cls.choice}
            onClick={() => {
              stop();
              setChosen(n);
            }}
            onKeyDown={(e) => {
              const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
              if (!step) return;
              e.preventDefault();
              stop();
              const next = (i + step + trips.length) % trips.length;
              setChosen(next);
              (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
            }}
          >
            {x.name}
          </button>
        ))}
      </div>
      <div className={cls.note} aria-live="polite">
        <p className={cls.noteLead}>I would like to ask about</p>
        <p className={cls.noteTrip} key={t.name}>
          {t.name}
        </p>
        {(t.duration || t.level || t.price) && (
          <dl className={cls.noteFacts}>
            {t.duration && (
              <div>
                <dt>Length</dt>
                <dd>{t.duration}</dd>
              </div>
            )}
            {t.level && (
              <div>
                <dt>Level</dt>
                <dd>{t.level}</dd>
              </div>
            )}
            {t.price && (
              <div>
                <dt>Price</dt>
                <dd>{t.price}</dd>
              </div>
            )}
          </dl>
        )}
        {t.text && <p className={cls.noteText}>{t.text}</p>}
        <div className={cls.noteWays}>
          {book ? (
            <a className={cls.noteSend} href={book.href} rel="noopener" data-press>
              {book.label}
            </a>
          ) : (
            mail && (
              <a className={cls.noteSend} href={mail} data-press>
                Send this as an email
              </a>
            )
          )}
          {phone && (
            <a className={cls.noteCall} href={phone.href}>
              Or call {phone.label}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
