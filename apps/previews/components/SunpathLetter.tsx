'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export interface LetterPick {
  name: string;
  text?: string;
  jetski?: boolean;
}

export interface LetterRow {
  day: string;
  fixed?: string;
  /** The list the day's choice is made from. */
  pick?: string;
  jetski?: boolean;
}

export interface LetterPack {
  name: string;
  days: number;
  nights: string;
  /** One per size of group, in the order of the group sizes. */
  prices: string[];
  included: string[];
  plan: LetterRow[];
}

export interface LetterLabels {
  legend: string;
  greeting: string;
  we: string;
  love: string;
  package: string;
  couples: string[];
  couplesLabel: string;
  packageLabel: string;
  jetski: string;
  jetskiNote: string;
  jetskiPrice: string;
  jetskiUnit: string;
  perCouple: string;
  included: string;
  send: string;
  sendNote: string;
  call: string;
  more: string;
  dates: string;
  names: string;
  subject: string;
}

type Cls = Record<
  'scene' | 'letter' | 'suns' | 'nights' | 'sheet' | 'legend' | 'greet' | 'line' | 'choice' | 'toggle' | 'note' | 'price' | 'meta' | 'figure' | 'extra' | 'send' | 'sendNote' | 'call' | 'plus',
  string | undefined
>;

function Choice({ value, options, label, onChange, cls, after = '' }: { value: number; options: string[]; label: string; onChange: (i: number) => void; cls?: string; after?: string }) {
  return (
    <span className={cls}>
      <span aria-hidden="true">
        {options[value]}
        {after}
      </span>
      <select aria-label={label} value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {options.map((o, i) => (
          <option key={o} value={i}>
            {o}
          </option>
        ))}
      </select>
      <svg viewBox="0 0 12 8" width="12" height="8" aria-hidden="true" focusable="false">
        <path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Group sizes as the business writes them start with the number of couples: that many windows are lit. */
const rooms = (label: string, i: number) => Number.parseInt(label, 10) || i + 1;

/**
 * A letter to the hosts that writes itself in place. The visitor sets the group, the package and each
 * day's adventure from the business's own lists inside the sentences; the house beside it lights a window
 * for each couple (`data-lit` on the scene), a row of suns shows the days of the stay, and the price per
 * couple for that group stands by the button. Sending opens an email to the business with the letter
 * written out; nothing is booked from the page. As the house comes into view its windows light one by one,
 * so the visitor sees what it does; any choice stops that.
 */
export function SunpathLetter({
  packs,
  lists,
  labels,
  email,
  call,
  scene,
  cls,
}: {
  packs: LetterPack[];
  lists: Record<string, LetterPick[]>;
  labels: LetterLabels;
  email: string;
  call: { tel: string; display: string };
  scene: ReactNode;
  cls: Cls;
}) {
  const [couples, setCouples] = useState(0);
  const [pack, setPack] = useState(0);
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [jetski, setJetski] = useState(false);
  const [noteKey, setNoteKey] = useState<string | null>(null);
  const touched = useRef(false);
  const sceneBox = useRef<HTMLDivElement>(null);

  // The windows light one by one the first time the house comes into view.
  useEffect(() => {
    const el = sceneBox.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timers: number[] = [];
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        for (let i = 1; i < labels.couples.length; i++) {
          timers.push(
            window.setTimeout(() => {
              if (!touched.current) setCouples(i);
            }, 700 + (i - 1) * 750),
          );
        }
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      for (const t of timers) clearTimeout(t);
    };
  }, [labels.couples.length]);

  const current = packs[pack]!;
  const pickIndex = (r: number, list: LetterPick[]) => {
    const k = `${pack}:${r}`;
    if (k in picks) return picks[k]!;
    // Each day of a longer stay starts on a different adventure, so the letter reads as a plan.
    const before = current.plan.slice(0, r).filter((row) => row.pick === current.plan[r]!.pick).length;
    return [0, 3, 4, 1, 2][before % 5]! % list.length;
  };
  const chosen = current.plan.map((row, r) => {
    const list = row.pick ? (lists[row.pick] ?? []) : [];
    const i = row.pick ? pickIndex(r, list) : -1;
    return { row, list, i, item: i >= 0 ? list[i] : undefined };
  });
  const canJetski = chosen.some((c) => c.row.jetski || c.item?.jetski);
  const firstPick = chosen.findIndex((c) => c.item);
  const noteRow = noteKey && noteKey.startsWith(`${pack}:`) ? Number(noteKey.split(':')[1]) : firstPick;
  const note = chosen[noteRow]?.item;
  const price = current.prices[couples] ?? current.prices[0];
  const lit = rooms(labels.couples[couples] ?? '', couples);

  const choose = (fn: () => void) => {
    touched.current = true;
    fn();
  };

  const sentences = [
    `${labels.we} ${labels.couples[couples]} ${labels.love} ${current.name} ${labels.package}`,
    ...chosen.map((c) => `${c.row.day} ${c.row.fixed ?? `${c.item?.name ?? ''}.`}`),
    ...(canJetski && jetski ? [labels.jetski] : []),
  ];
  const body = [labels.greeting, '', ...sentences, '', labels.dates, labels.names, ''].join('\n');
  const subject = `${labels.subject}, ${current.name}, ${labels.couples[couples]}`;
  const href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <>
      <div ref={sceneBox} className={cls.scene} data-lit={lit} data-pack={pack}>
        {scene}
      </div>
      <div className={cls.letter}>
        <div className={cls.suns} aria-hidden="true">
          <ol key={current.name}>
            {Array.from({ length: current.days }, (_, i) => (
              <li key={i} style={{ '--i': i } as CSSProperties} />
            ))}
          </ol>
          <p className={cls.nights}>{current.nights}</p>
        </div>
        <fieldset className={cls.sheet}>
          <legend className={cls.legend}>{labels.legend}</legend>
          <p className={cls.greet}>{labels.greeting}</p>
          <p className={cls.line}>
            {labels.we} <Choice cls={cls.choice} value={couples} options={labels.couples} label={labels.couplesLabel} onChange={(i) => choose(() => setCouples(i))} /> {labels.love}{' '}
            <Choice cls={cls.choice} value={pack} options={packs.map((p) => p.name)} label={labels.packageLabel} onChange={(i) => choose(() => setPack(i))} /> {labels.package}
          </p>
          {chosen.map((c, r) =>
            c.row.fixed ? (
              <p key={`${current.name}-${r}`} className={cls.line} data-fixed="">
                {c.row.day} {c.row.fixed}
              </p>
            ) : (
              <p key={`${current.name}-${r}`} className={cls.line}>
                {c.row.day}{' '}
                <Choice
                  cls={cls.choice}
                  value={c.i}
                  options={c.list.map((p) => p.name)}
                  label={c.row.day.replace(/,$/, '')}
                  after="."
                  onChange={(i) =>
                    choose(() => {
                      setPicks((was) => ({ ...was, [`${pack}:${r}`]: i }));
                      setNoteKey(`${pack}:${r}`);
                    })
                  }
                />
              </p>
            ),
          )}
          {canJetski && (
            <label className={cls.toggle}>
              <input type="checkbox" checked={jetski} onChange={(e) => choose(() => setJetski(e.target.checked))} />
              <span>{labels.jetski}</span>
            </label>
          )}
        </fieldset>
        {note?.text && (
          <p className={cls.note} aria-live="polite" key={`${pack}-${noteRow}-${note.name}`}>
            <b>{note.name}.</b> {note.text}
          </p>
        )}
        <div className={cls.price} aria-live="polite">
          <p className={cls.meta}>
            {current.name} <i aria-hidden="true" /> {labels.couples[couples]}
          </p>
          <p className={cls.figure}>
            <b key={price}>{price}</b> <span>{labels.perCouple}</span>
          </p>
          {canJetski && (
            <p className={cls.extra}>
              {labels.jetskiNote} {labels.jetskiPrice} {labels.jetskiUnit}.
            </p>
          )}
        </div>
        <a className={cls.send} href={href} data-press data-magnetic>
          {labels.send}
          <Arrow />
        </a>
        <p className={cls.sendNote}>{labels.sendNote}</p>
        <p className={cls.call}>
          {labels.call} <a href={call.tel}>{call.display}</a>
        </p>
        <div className={cls.plus}>
          <p>{labels.included}</p>
          <ul key={current.name}>
            {current.included.map((x, i) => (
              <li key={x} style={{ '--i': i } as CSSProperties}>
                {x}
              </li>
            ))}
          </ul>
          <p>{labels.more}</p>
        </div>
      </div>
    </>
  );
}
