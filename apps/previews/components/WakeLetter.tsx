'use client';

import { useEffect, useState } from 'react';
import type { HoursMode } from './WakeHours';

export interface LetterWords {
  to: string;
  subjectLabel: string;
  greeting: string;
  like: string;
  of: string;
  for: string;
  adults: [string, string];
  and: string;
  children: [string, string];
  noChildren: string;
  carvings: string;
  voucher: string;
  dateLabel: string;
  hoursWord: [string, string];
  numbers: string[];
  more: string;
  fewer: string;
  max: string;
  send: string;
  note: string;
  body: { interests: string; hours: string; adults: string; children: string; date: string; carvings: string; voucher: string; yes: string; sign: string };
}

export interface LetterCls {
  root: string;
  head: string;
  sheet: string;
  sentence: string;
  token: string;
  count: string;
  step: string;
  flag: string;
  date: string;
  rate: string;
  send: string;
  note: string;
}

const MAX = 8;

function Sign({ plus }: { plus?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">
      <path d={plus ? 'M4 10h12M10 4v12' : 'M4 10h12'} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * A letter to the skipper that the visitor writes by tapping its words: the hours, the kind of trip,
 * how many adults and children, the Rock Carvings and a gift voucher. The rate for the boat sits
 * under it, and the button opens the visitor's own email with the same fields the skipper's enquiry
 * form asks for. It takes up whatever was last chosen on the hours strip.
 */
export function WakeLetter({ modes, words, email, cls }: { modes: HoursMode[]; words: LetterWords; email: string; cls: LetterCls }) {
  const [modeId, setModeId] = useState(modes[0]!.id);
  const mode = modes.find((m) => m.id === modeId) ?? modes[0]!;
  const [hours, setHours] = useState(mode.start);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [carvings, setCarvings] = useState(false);
  const [voucher, setVoucher] = useState(false);
  const [date, setDate] = useState('');
  // The date field is drawn once the page is live: a field in the first HTML can be touched by the browser before the page takes it over.
  const [live, setLive] = useState(false);
  useEffect(() => setLive(true), []);

  useEffect(() => {
    const take = (e: Event) => {
      const d = (e as CustomEvent<{ mode: string; hours: number }>).detail;
      if (!modes.some((m) => m.id === d.mode)) return;
      setModeId(d.mode);
      setHours(d.hours);
    };
    window.addEventListener('wake:trip', take);
    return () => window.removeEventListener('wake:trip', take);
  }, [modes]);

  const option = mode.options.find((o) => o.hours === hours) ?? mode.options[0]!;
  const n = (k: number) => words.numbers[k] ?? String(k);
  const plural = (k: number, w: [string, string]) => (k === 1 ? w[0] : w[1]);
  const hoursText = `${n(option.hours)} ${plural(option.hours, words.hoursWord)}`;

  const nextHours = () => {
    const i = mode.options.findIndex((o) => o.hours === option.hours);
    setHours(mode.options[(i + 1) % mode.options.length]!.hours);
  };
  const nextMode = () => {
    const i = modes.findIndex((m) => m.id === mode.id);
    const m = modes[(i + 1) % modes.length]!;
    setModeId(m.id);
    setHours(m.start);
  };

  const subject = `${mode.subject}, ${hoursText}`;
  const b = words.body;
  const lines = [
    words.greeting,
    '',
    `${b.interests}: ${mode.label}`,
    `${b.hours}: ${option.hours}`,
    `${b.adults}: ${adults}`,
    `${b.children}: ${children}`,
    `${b.date}: ${date}`,
    ...(carvings ? [`${b.carvings}: ${b.yes}`] : []),
    ...(voucher ? [`${b.voucher}: ${b.yes}`] : []),
    '',
    b.sign,
  ];
  const href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
  const full = adults + children >= MAX;

  return (
    <div className={cls.root}>
      <p className={cls.head}>
        <span>{words.to}</span>
        <b>{email}</b>
      </p>
      <p className={cls.head}>
        <span>{words.subjectLabel}</span>
        <b>{subject}</b>
      </p>
      <div className={cls.sheet}>
        <p>{words.greeting}</p>
        <p className={cls.sentence}>
          {words.like}{' '}
          <button type="button" className={cls.token} onClick={nextHours} aria-label={`${b.hours}: ${hoursText}`}>
            {hoursText}
          </button>{' '}
          {words.of}{' '}
          <button type="button" className={cls.token} onClick={nextMode} aria-label={`${b.interests}: ${mode.what}`}>
            {mode.what}
          </button>{' '}
          {words.for}{' '}
          <span className={cls.count}>
            <button type="button" className={cls.step} onClick={() => setAdults((a) => Math.max(1, a - 1))} disabled={adults <= 1} aria-label={`${words.fewer} ${words.adults[1]}`}>
              <Sign />
            </button>
            <b>
              {n(adults)} {plural(adults, words.adults)}
            </b>
            <button type="button" className={cls.step} onClick={() => setAdults((a) => (a + children < MAX ? a + 1 : a))} disabled={full} aria-label={`${words.more} ${words.adults[1]}`}>
              <Sign plus />
            </button>
          </span>{' '}
          {words.and}{' '}
          <span className={cls.count}>
            <button type="button" className={cls.step} onClick={() => setChildren((c) => Math.max(0, c - 1))} disabled={children <= 0} aria-label={`${words.fewer} ${words.children[1]}`}>
              <Sign />
            </button>
            <b>{children === 0 ? words.noChildren : `${n(children)} ${plural(children, words.children)}`}</b>
            <button type="button" className={cls.step} onClick={() => setChildren((c) => (adults + c < MAX ? c + 1 : c))} disabled={full} aria-label={`${words.more} ${words.children[1]}`}>
              <Sign plus />
            </button>
          </span>
          {', '}
          <button type="button" className={cls.flag} aria-pressed={carvings} onClick={() => setCarvings((v) => !v)}>
            {words.carvings}
          </button>{' '}
          <button type="button" className={cls.flag} aria-pressed={voucher} onClick={() => setVoucher((v) => !v)}>
            {words.voucher}
          </button>
        </p>
        <label className={cls.date}>
          <span>{words.dateLabel}</span>
          {live ? <input type="date" value={date} onChange={(e) => setDate(e.target.value)} /> : <i aria-hidden="true" />}
        </label>
      </div>
      <p className={cls.rate}>
        <span>
          {option.label} {mode.what}
        </span>
        <b>{option.price}</b>
        <span>{mode.unit}</span>
      </p>
      <a className={cls.send} href={href} data-press>
        <span>{words.send}</span>
        <i aria-hidden="true">
          <Arrow />
        </i>
      </a>
      <p className={cls.note}>{full ? words.max : words.note}</p>
    </div>
  );
}
