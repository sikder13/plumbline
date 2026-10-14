'use client';

import { useState } from 'react';

interface Text {
  kicker: string;
  name: string;
  text: string;
  price: string;
  per: string;
  note: string;
  choose: string;
  options: string[];
  send: string;
  subject: string;
  greeting: string;
  /** The request, with {activity} where the chosen option goes. */
  ask: string;
  fields: string[];
  sign: string;
}

/**
 * The second way in, for a trip booked by email only: choose the activity and the email to the
 * business is written with it, ready to send from the visitor's own mail. Nothing is sent from here.
 */
export function HushTrip({ email, text, cls }: { email: string; text: Text; cls: Record<'box' | 'kicker' | 'name' | 'text' | 'price' | 'choose' | 'chip' | 'send' | 'note', string | undefined> }) {
  const [pick, setPick] = useState(0);
  const activity = text.options[pick] ?? '';
  const body = [text.greeting, '', text.ask.replace('{activity}', activity.toLowerCase()), '', ...text.fields.map((f) => `${f} `), '', text.sign].join('\n');
  const href = `mailto:${email}?subject=${encodeURIComponent(text.subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div className={cls.box}>
      <p className={cls.kicker}>{text.kicker}</p>
      <h3 className={cls.name}>{text.name}</h3>
      <p className={cls.text}>{text.text}</p>
      <p className={cls.price}>
        <b>{text.price}</b> {text.per}
      </p>
      <div className={cls.choose} role="group" aria-label={text.choose}>
        {text.options.map((o, i) => (
          <button key={o} type="button" className={cls.chip} aria-pressed={i === pick} onClick={() => setPick(i)}>
            {o}
          </button>
        ))}
      </div>
      <a className={cls.send} data-press href={href}>
        {text.send}
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
          <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </a>
      <p className={cls.note}>{text.note}</p>
    </div>
  );
}
