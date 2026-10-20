'use client';

import { useState } from 'react';

interface Props {
  jobs: string[];
  visits: string[];
  asks: string[];
  sms: string;
  tel: string;
  email: string;
  phoneDisplay: string;
  s: Record<'compose' | 'pick' | 'pickLabel' | 'chips' | 'chip' | 'preview' | 'bubbleOut' | 'acts' | 'send' | 'alt', string>;
}

/**
 * Their way in, put together: the two choices their about page asks for (mowing or gardening,
 * one-off or regular), and the four things to send, written as the text a visitor sends from their
 * own phone. Nothing is sent from here; the phone's messages app opens with the words ready.
 */
export function ThreadCompose({ jobs, visits, asks, sms, tel, email, phoneDisplay, s }: Props) {
  const [job, setJob] = useState(jobs[0]!);
  const [visit, setVisit] = useState(visits[0]!);
  const body = `Hi, could I get a quote please? ${job}, ${visit.toLowerCase()}. Name: . Address of property: . Email: .`;
  const lines = [`Hi, could I get a quote please?`, `${job}, ${visit.toLowerCase()}.`, ...asks.slice(0, 3).map((a) => `${a[0]!.toUpperCase()}${a.slice(1)}: …`)];
  return (
    <div className={s.compose}>
      <fieldset className={s.pick}>
        <legend className={s.pickLabel}>What you want done</legend>
        <div className={s.chips}>
          {jobs.map((j) => (
            <button key={j} type="button" className={s.chip} aria-pressed={job === j} onClick={() => setJob(j)} data-press>
              {j}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className={s.pick}>
        <legend className={s.pickLabel}>How often</legend>
        <div className={s.chips}>
          {visits.map((v) => (
            <button key={v} type="button" className={s.chip} aria-pressed={visit === v} onClick={() => setVisit(v)} data-press>
              {v}
            </button>
          ))}
        </div>
      </fieldset>
      <div className={s.preview} aria-live="polite">
        <p className={s.bubbleOut}>
          {lines.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </p>
      </div>
      <div className={s.acts}>
        <a className={s.send} href={`${sms}?&body=${encodeURIComponent(body)}`} data-press>
          Text it to {phoneDisplay}
        </a>
        <a className={s.alt} href={tel} data-press>
          Call instead
        </a>
        <a className={s.alt} href={`mailto:${email}?subject=${encodeURIComponent(`Quote: ${job}, ${visit.toLowerCase()}`)}&body=${encodeURIComponent(body)}`} data-press>
          Email it
        </a>
      </div>
    </div>
  );
}
