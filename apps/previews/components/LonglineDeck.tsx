'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

export interface DeckMode {
  key: string;
  label: string;
  price: string;
  unit: string;
  /** How many floats a trip of this kind lights: the number it sails at, or the most it takes. */
  spots: number;
  line: string;
  say: string;
  rule: string;
  action: { label: string; href: string };
  mail?: { label: string; subject: string; body: string };
}

interface Labels {
  slots: string;
  sails: string;
  upTo: string;
  note: string;
}

interface Cls {
  wrap?: string;
  tabs?: string;
  slotsLabel?: string;
  rows?: string;
  row?: string;
  time?: string;
  rope?: string;
  end?: string;
  say?: string;
  word?: string;
  acts?: string;
  go?: string;
  ghost?: string;
  sr?: string;
  note?: string;
}

const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * The booking device: the trips on the booking calendar drawn as lines of floats. The chosen trip's
 * floats light one by one up to the number a shared trip sails at, or every float for a private
 * charter, and the boat at the end of the line casts off. A sentence writes itself with the real
 * price, and the action goes to the booking calendar or, for the whole boat, to a call or an email
 * with the trip filled in. When it first comes into view it plays itself once, then waits.
 */
export function LonglineDeck({ cls, modes, slots, labels, email }: { cls: Cls; modes: DeckMode[]; slots: string[]; labels: Labels; email: string }) {
  const [m, setM] = useState(0);
  const [slot, setSlot] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const rows = useRef<HTMLDivElement>(null);
  const touched = useRef(false);

  const mode = modes[m]!;
  const most = Math.max(...modes.map((x) => x.spots));

  useEffect(() => {
    const el = wrap.current;
    const watch = rows.current;
    if (!el || !watch || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let gone = false;
    const stop = () => void (touched.current = true);
    el.addEventListener('pointerdown', stop);
    el.addEventListener('keydown', stop);
    const play = async () => {
      const live = () => !gone && !touched.current;
      await pause(250);
      if (!live()) return;
      setSlot(1);
      await pause(1700);
      if (!live()) return;
      setM(1);
      await pause(1500);
      if (!live()) return;
      setSlot(2);
      await pause(1500);
      if (!live()) return;
      setM(0);
      setSlot(0);
    };
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        void play();
      },
      { threshold: 0.55 },
    );
    io.observe(watch);
    return () => {
      gone = true;
      io.disconnect();
      el.removeEventListener('pointerdown', stop);
      el.removeEventListener('keydown', stop);
    };
  }, []);

  // The sentence, as words, so each change writes itself in again.
  const parts: { t: string; b?: boolean }[] = [{ t: `${mode.label},`, b: true }, { t: `${slots[slot]}.` }, { t: mode.price, b: true }, { t: mode.say }, { t: mode.rule }];
  const words = parts.flatMap((p) => p.t.split(' ').filter(Boolean).map((w) => ({ w, b: p.b })));
  const sentence = parts.map((p) => p.t).join(' ');

  const mail = mode.mail;
  const mailHref = mail ? `mailto:${email}?subject=${encodeURIComponent(mail.subject)}&body=${encodeURIComponent(mail.body.replace('{slot}', slots[slot]!))}` : '';

  return (
    <div ref={wrap} className={cls.wrap} data-mode={mode.key}>
      <div className={cls.tabs} role="group" aria-label={modes.map((x) => x.label).join(' or ')}>
        {modes.map((x, i) => (
          <button key={x.key} type="button" aria-pressed={i === m} onClick={() => setM(i)}>
            <span>{x.label}</span>
            <b>
              {x.price} <small>{x.unit}</small>
            </b>
          </button>
        ))}
      </div>

      <p className={cls.slotsLabel} id="longline-slots">
        {labels.slots}
      </p>
      <div ref={rows} className={cls.rows} role="group" aria-labelledby="longline-slots">
        {slots.map((t, i) => {
          const on = i === slot;
          return (
            <button key={t} type="button" className={cls.row} aria-pressed={on} onClick={() => setSlot(i)}>
              <span className={cls.time}>{t}</span>
              <span className={cls.rope} aria-hidden="true">
                {Array.from({ length: most }, (_, k) => (
                  <i key={k} data-lit={on && k < mode.spots ? '' : undefined} data-extra={k >= mode.spots ? '' : undefined} style={{ '--k': k } as CSSProperties} />
                ))}
              </span>
              <span className={cls.end} aria-hidden="true">
                <em>{m === 0 ? labels.sails : labels.upTo}</em>
              </span>
            </button>
          );
        })}
      </div>

      <p className={cls.say} aria-live="polite">
        <span className={cls.sr}>{sentence}</span>
        <span key={sentence} aria-hidden="true">
          {words.map((x, i) => (
            <span key={i} className={cls.word} style={{ '--w': i } as CSSProperties} data-b={x.b ? '' : undefined}>
              {x.w}{' '}
            </span>
          ))}
        </span>
      </p>
      <p data-line="">{mode.line}</p>

      <div className={cls.acts}>
        <a className={cls.go} href={mode.action.href} rel={mode.action.href.startsWith('http') ? 'noopener' : undefined} data-press>
          {mode.action.label}
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
            <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
        {mail && (
          <a className={cls.ghost} href={mailHref}>
            {mail.label}
          </a>
        )}
      </div>
      <p className={cls.note}>{labels.note}</p>
    </div>
  );
}
