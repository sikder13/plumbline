'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export interface PlanPursuit {
  word: string;
  season: { months: number[]; text: string; peak?: { months: number[]; text: string } };
  access: { options: string[] };
  party?: string[];
  note: string;
  prices: { access?: number[]; party?: number[]; quote: string; short: string }[];
}

export interface PlanLabels {
  greeting: string;
  start: string;
  in: string;
  change: string;
  hint: string;
  fromPages: string;
  inSeason: string;
  outSeason: string;
  peak: string;
  or: string;
  sendNote: string;
  ps: string;
  subject: string;
  now: string;
  slotPursuit: string;
  slotMonth: string;
  slotAccess: string;
  slotParty: string;
  carry: string;
}

export interface PlanContent {
  labels: PlanLabels;
  months: string[];
  pursuits: PlanPursuit[];
}

export interface PlanContact {
  phoneLabel: string;
  tel: string;
  phone: string;
  emailLabel: string;
  hours: string;
}

type Cls = Record<'root' | 'note' | 'hint' | 'sentence' | 'token' | 'word' | 'now' | 'end' | 'heard' | 'from' | 'status' | 'quote' | 'sign' | 'go' | 'send' | 'sendNote' | 'ps', string | undefined>;

/** Runs `fn` once the browser has nothing more pressing to do, or after two seconds at the latest. */
function whenIdle(fn: () => void): () => void {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(fn, { timeout: 2000 });
    return () => w.cancelIdleCallback?.(id);
  }
  const t = window.setTimeout(fn, 300);
  return () => window.clearTimeout(t);
}

/** The month it is now where the business is. */
function monthHere(): number {
  return Number(new Intl.DateTimeFormat('en-NZ', { timeZone: 'Pacific/Auckland', month: 'numeric' }).format(new Date())) - 1;
}

function Cycle() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path d="M13 6.5A5.2 5.2 0 0 0 3.6 4.4M3 9.5a5.2 5.2 0 0 0 9.4 2.1M3.4 1.8v2.9h2.9M12.6 14.2v-2.9H9.7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A line that writes itself in, word by word, each time what it says changes. */
function Written({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className} key={text}>
      {text.split(' ').map((w, i) => (
        <span key={i} style={{ '--w': i } as CSSProperties}>
          {w}{' '}
        </span>
      ))}
    </span>
  );
}

/**
 * A note to the guide that the visitor writes by changing its underlined words: the adventure, the
 * month (it opens on the month it is now in Glenorchy), the way in and how many. As it changes, the
 * rest of the note writes itself from the guide's own pages: whether that month is in season, the
 * one price that applies, and a thing worth knowing, each in their words and in quotation marks. The
 * note ends by sending itself: an email to his published address with the note written in, or his
 * own enquiry form. Nothing here takes a booking itself. When it is first seen, untouched, a few of
 * its words change by themselves, so a visitor sees that they can.
 */
export function EarshotPlan({ content, email, book, start, contact, cls }: { content: PlanContent; email: string; book: { label: string; href: string }; start: number; contact: PlanContact; cls: Cls }) {
  const { labels, months, pursuits } = content;
  const [p, setP] = useState(0);
  const [m, setM] = useState(start);
  const [a, setA] = useState(0);
  const [n, setN] = useState(0);
  const [here, setHere] = useState(start);
  const root = useRef<HTMLDivElement>(null);
  const touched = useRef(false);
  const timers = useRef<number[]>([]);

  const pursuit = pursuits[p]!;
  const party = pursuit.party;

  const turnPursuit = useCallback(() => {
    setP((v) => (v + 1) % pursuits.length);
    setA(0);
    setN(0);
  }, [pursuits.length]);
  const turnAccess = useCallback(() => setA((v) => (v + 1) % pursuits[p]!.access.options.length), [p, pursuits]);
  const turnParty = useCallback(() => setN((v) => (v + 1) % (pursuits[p]!.party?.length ?? 1)), [p, pursuits]);
  const turnMonth = useCallback(() => setM((v) => (v + 1) % 12), []);

  const byHand = (turn: () => void) => () => {
    touched.current = true;
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
    turn();
  };

  // "Plan it with Ethan" beside an adventure higher up writes that adventure and month into the note.
  useEffect(() => {
    const take = (e: Event) => {
      const d = (e as CustomEvent<{ pursuit: number; month?: number }>).detail;
      touched.current = true;
      for (const t of timers.current) window.clearTimeout(t);
      timers.current = [];
      setP(d.pursuit);
      setA(0);
      setN(0);
      if (typeof d.month === 'number') setM(d.month);
    };
    window.addEventListener('earshot:plan', take);
    return () => window.removeEventListener('earshot:plan', take);
  }, []);

  // Nothing runs while the page loads. Once the browser is idle the note waits to be seen; when it is,
  // it takes the month it is now in Glenorchy and, unless the visitor got there first, changes a few
  // of its words by itself.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let io: IntersectionObserver | undefined;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cancel = whenIdle(() => {
      io = new IntersectionObserver(
        ([e]) => {
          if (!e?.isIntersecting) return;
          io?.disconnect();
          const now = monthHere();
          setHere(now);
          if (!touched.current) setM(now);
          if (still || touched.current) return;
          const steps: [number, () => void][] = [
            [600, () => {
              setP(1);
              setA(0);
              setN(0);
            }],
            [1700, () => setN(1)],
            [2800, () => setA(2)],
            [3900, () => {
              setP(2);
              setA(0);
              setN(1);
            }],
          ];
          timers.current = steps.map(([t, run]) => window.setTimeout(() => !touched.current && run(), t));
        },
        { threshold: 0.4 },
      );
      io.observe(el);
    });
    return () => {
      cancel();
      io?.disconnect();
      for (const t of timers.current) window.clearTimeout(t);
    };
  }, []);

  const monthNumber = m + 1;
  const inSeason = pursuit.season.months.includes(monthNumber);
  const peak = pursuit.season.peak?.months.includes(monthNumber) ?? false;
  const status = peak ? labels.peak : inSeason ? labels.inSeason : labels.outSeason;
  const seasonText = pursuit.season.peak ? `${pursuit.season.text} ${pursuit.season.peak.text}` : pursuit.season.text;
  const price = pursuit.prices.find((x) => (!x.access || x.access.includes(a)) && (!x.party || x.party.includes(n))) ?? pursuit.prices[0]!;
  const access = pursuit.access.options[a]!;
  const who = party?.[n];
  const sentence = `${labels.greeting} ${labels.start} ${pursuit.word} ${labels.in} ${months[m]}, ${access}${who ? `, ${who}` : ''}.`;
  const mailto = `mailto:${email}?subject=${encodeURIComponent(labels.subject)}&body=${encodeURIComponent(sentence)}`;
  const [local, domain] = email.split('@');
  const carry = labels.carry.replace('{pursuit}', pursuit.word).replace('{price}', price.short);

  // Whatever the note says, the always visible action says too: the trip and the one price that applies.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('earshot:choice', { detail: { label: carry } }));
  }, [carry]);

  const token = (slot: string, value: string, turn: () => void, extra?: ReactNode) => (
    <button type="button" className={cls.token} onClick={byHand(turn)} aria-label={`${slot}: ${value}. ${labels.change}`} data-press>
      {extra}
      <span className={cls.word} key={value} aria-hidden="true">
        {value}
      </span>
      <Cycle />
    </button>
  );

  return (
    <div className={cls.root}>
      <div ref={root} className={cls.note}>
        <p className={cls.hint}>{labels.hint}</p>
        <p className={cls.sentence}>
          {labels.greeting} {labels.start} {token(labels.slotPursuit, pursuit.word, turnPursuit)} {labels.in}{' '}
          {token(labels.slotMonth, months[m]!, turnMonth, m === here ? <i className={cls.now} title={labels.now} /> : null)}
          {', '}
          {who ? (
            <>
              {token(labels.slotAccess, access, turnAccess)}
              {', '}
              <span className={cls.end}>{token(labels.slotParty, who, turnParty)}.</span>
            </>
          ) : (
            <span className={cls.end}>{token(labels.slotAccess, access, turnAccess)}.</span>
          )}
        </p>
        <div className={cls.heard} aria-live="polite">
          <p className={cls.from}>{labels.fromPages}</p>
          <p className={cls.quote}>
            <b className={cls.status} data-status={peak ? 'peak' : inSeason ? 'in' : 'out'} key={status}>
              {status}
            </b>{' '}
            <Written text={`“${seasonText}”`} />
          </p>
          <p className={cls.quote}>
            <Written text={`“${price.quote}”`} />
          </p>
          <p className={cls.quote}>
            <Written text={`“${pursuit.note}”`} />
          </p>
        </div>
        <p className={cls.sign}>
          <a className={cls.go} href={book.href} rel="noopener" data-press>
            {carry}
          </a>{' '}
          <a className={cls.send} href={mailto}>
            {labels.or}
          </a>
        </p>
        <p className={cls.sendNote}>{labels.sendNote}</p>
        <p className={cls.ps}>
          <b>{labels.ps}</b>{' '}
          <span>
            {contact.phoneLabel} <a href={contact.tel}>{contact.phone}</a>
          </span>{' '}
          <span>
            {contact.emailLabel}{' '}
            <a href={`mailto:${email}`}>
              {local}@
              <wbr />
              {domain}
            </a>
          </span>{' '}
          <span>{contact.hours}</span>
        </p>
      </div>
    </div>
  );
}
