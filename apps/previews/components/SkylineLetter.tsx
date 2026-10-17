'use client';

import { useEffect, useState } from 'react';

type Cls = Record<'letter' | 'sentence' | 'pick' | 'send' | 'srOnly', string | undefined>;

interface Words {
  hello: string;
  want: string;
  in: string;
  end: string;
  tripLabel: string;
  monthLabel: string;
  send: string;
  subject: string;
}

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * A short letter that writes itself from what the visitor looked at: the way they chose and the month
 * they read. Both words can be changed in place, and the button opens it as an email to the
 * business's published address. Nothing is sent from the page.
 */
export function SkylineLetter({ trips, months, email, words, cls }: { trips: string[]; months: string[]; email: string; words: Words; cls: Cls }) {
  const [trip, setTrip] = useState(0);
  const [month, setMonth] = useState(0);

  useEffect(() => {
    setMonth(new Date().getMonth());
    const onWay = (e: Event) => setTrip(Number((e as CustomEvent).detail) || 0);
    const onMonth = (e: Event) => setMonth(Number((e as CustomEvent).detail) || 0);
    window.addEventListener('skyline:way', onWay);
    window.addEventListener('skyline:month', onMonth);
    return () => {
      window.removeEventListener('skyline:way', onWay);
      window.removeEventListener('skyline:month', onMonth);
    };
  }, []);

  const t = trips[trip] ?? trips[0]!;
  const m = months[month] ?? months[0]!;
  const want = words.want.charAt(0).toUpperCase() + words.want.slice(1);
  const body = `${words.hello}\n\n${want} ${t} ${words.in} ${m}. ${words.end}\n\n`;
  const href = `mailto:${email}?subject=${encodeURIComponent(`${words.subject}: ${t}, ${m}`)}&body=${encodeURIComponent(body)}`;

  return (
    <div className={cls.letter}>
      <p className={cls.sentence}>
        <span>{words.hello}</span>{' '}
        <span>{words.want}</span>{' '}
        <label>
          <span className={cls.srOnly}>{words.tripLabel}</span>
          <select className={cls.pick} value={trip} onChange={(e) => setTrip(Number(e.target.value))}>
            {trips.map((x, i) => (
              <option key={x} value={i}>
                {x}
              </option>
            ))}
          </select>
        </label>{' '}
        <span>{words.in}</span>{' '}
        <label>
          <span className={cls.srOnly}>{words.monthLabel}</span>
          <select className={cls.pick} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {months.map((x, i) => (
              <option key={x} value={i}>
                {x}
              </option>
            ))}
          </select>
        </label>
        .
      </p>
      <a className={cls.send} href={href} data-press>
        {words.send}
        <Arrow />
      </a>
    </div>
  );
}
