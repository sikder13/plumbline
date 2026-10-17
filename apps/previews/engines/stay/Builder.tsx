'use client';

import { useState } from 'react';
import { useShowOnce } from '../useShowOnce';

const WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface Props {
  units: { name: string; price?: string }[];
  maxNights: number;
  maxGuests?: number;
  book: { href: string; label: string } | null;
  email: string | null;
  phone: { href: string; label: string } | null;
  cls: Record<string, string>;
}

/**
 * "Your stay": a sentence the visitor finishes, which unit, how many nights, when, and which then
 * goes where they take bookings: their booking link, or an email to their own address with the
 * stay written in. Counts are words, and no price is worked out: only theirs is shown. On first view
 * the nights count up once.
 */
export function Builder({ units, maxNights, maxGuests, book, email, phone, cls }: Props) {
  const [unit, setUnit] = useState(0);
  const [nights, setNights] = useState(2);
  const [guests, setGuests] = useState(2);
  const [month, setMonth] = useState<number | null>(null);
  const { ref, shown, stop } = useShowOnce<HTMLDivElement>(4, { every: 520, rest: 1 });
  const n = shown !== null ? shown + 1 : nights;
  const u = units[unit]!;
  const sentence = `${units.length > 1 ? `${u.name}, ` : ''}${WORDS[n - 1]} night${n > 1 ? 's' : ''}${maxGuests ? ` for ${WORDS[guests - 1]} guest${guests > 1 ? 's' : ''}` : ''}${month !== null ? `, arriving in ${MONTHS[month]}` : ''}`;
  const mail = email ? `mailto:${email}?subject=${encodeURIComponent('Booking enquiry')}&body=${encodeURIComponent(`Hello,\n\nWe would like to stay: ${sentence}.\n\n`)}` : null;
  const step = (set: (f: (v: number) => number) => void, max: number, by: number) => () => {
    stop();
    set((v) => Math.min(max, Math.max(1, v + by)));
  };
  return (
    <div ref={ref} className={cls.builder}>
      <div className={cls.build}>
        {units.length > 1 && (
          <div className={cls.buildRow} role="radiogroup" aria-label="Where to stay">
            {units.map((x, i) => (
              <button key={x.name} type="button" role="radio" aria-checked={i === unit} className={cls.buildChip} onClick={() => {
                  stop();
                  setUnit(i);
                }}>
                {x.name}
              </button>
            ))}
          </div>
        )}
        <div className={cls.buildRow}>
          <span className={cls.buildLabel} id="nights-l">
            Nights
          </span>
          <div className={cls.stepper} role="group" aria-labelledby="nights-l">
            <button type="button" onClick={step(setNights, maxNights, -1)} disabled={n <= 1}>
              Fewer
            </button>
            <output aria-live="polite">{WORDS[n - 1]}</output>
            <button type="button" onClick={step(setNights, maxNights, 1)} disabled={n >= maxNights}>
              More
            </button>
          </div>
        </div>
        {maxGuests && (
          <div className={cls.buildRow}>
            <span className={cls.buildLabel} id="guests-l">
              Guests
            </span>
            <div className={cls.stepper} role="group" aria-labelledby="guests-l">
              <button type="button" onClick={step(setGuests, maxGuests, -1)} disabled={guests <= 1}>
                Fewer
              </button>
              <output aria-live="polite">{WORDS[guests - 1]}</output>
              <button type="button" onClick={step(setGuests, maxGuests, 1)} disabled={guests >= maxGuests}>
                More
              </button>
            </div>
          </div>
        )}
        <div className={cls.buildRow}>
          <label className={cls.buildLabel} htmlFor="arrive">
            Arriving in
          </label>
          <select id="arrive" className={cls.buildSelect} value={month ?? ''} onChange={(e) => {
              stop();
              setMonth(e.target.value === '' ? null : Number(e.target.value));
            }}>
            <option value="">Any month</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className={cls.stayCard}>
        <p className={cls.stayLead}>Your stay</p>
        <p className={cls.staySentence}>{sentence}.</p>
        {u.price && <p className={cls.stayPrice}>{u.price}</p>}
        <div className={cls.stayWays}>
          {book ? (
            <a className={cls.staySend} href={book.href} rel="noopener" data-press>
              {book.label}
            </a>
          ) : (
            mail && (
              <a className={cls.staySend} href={mail} data-press>
                Send this as an email
              </a>
            )
          )}
          {phone && (
            <a className={cls.stayCall} href={phone.href}>
              Or call {phone.label}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
