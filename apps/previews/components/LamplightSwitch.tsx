'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface LamplightMode {
  id: string;
  word: string;
  name: string;
  text: string;
  facts: string[];
  fromLabel: string;
  price: string;
  book: string;
  href: string;
  picture: ReactNode;
}

type Names = 'root' | 'water' | 'surface' | 'ask' | 'option' | 'joiner' | 'panels' | 'panel' | 'media' | 'body' | 'name' | 'text' | 'facts' | 'deal' | 'from' | 'amount' | 'go';

/**
 * Two ways through the same cave, chosen by the question itself: its two words are the buttons. The
 * first way floods the section with river water, whose surface is the page's line of lamp light; the
 * other drains it. The trip, its photograph, its facts, its price and its booking link change in place
 * under the question, which stays in view while they are read. When the section first comes into view
 * it shows both once, then waits for the visitor. With
 * reduced motion asked for, nothing plays and the choice simply changes.
 */
export function LamplightSwitch({ modes, joiner, mark, label, head, foot, cls }: { modes: LamplightMode[]; joiner: string; mark: string; label: string; head: ReactNode; foot: ReactNode; cls: Record<Names, string | undefined> }) {
  const [on, setOn] = useState(0);
  const touched = useRef(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el || modes.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let cancelled = false;
    let stop: (() => void) | undefined;
    const timers: number[] = [];
    void import('motion').then(({ inView }) => {
      if (cancelled) return;
      stop = inView(
        el,
        () => {
          stop?.();
          if (touched.current) return;
          timers.push(window.setTimeout(() => !touched.current && setOn(1), 700));
          timers.push(window.setTimeout(() => !touched.current && setOn(0), 2700));
        },
        { amount: 0.2 },
      );
    });
    return () => {
      cancelled = true;
      stop?.();
      for (const t of timers) window.clearTimeout(t);
    };
  }, [modes.length]);

  const choose = (i: number) => {
    touched.current = true;
    setOn(i);
  };

  return (
    <div ref={root} className={cls.root} data-mode={modes[on]?.id}>
      <span className={cls.water} aria-hidden="true">
        <i className={cls.surface} />
      </span>
      {head}
      <p className={cls.ask} role="group" aria-label={label}>
        {modes.map((m, i) => (
          <span key={m.id}>
            {i > 0 && <span className={cls.joiner}> {joiner} </span>}
            <button type="button" className={cls.option} aria-pressed={i === on} onClick={() => choose(i)}>
              {m.word}
              {i === modes.length - 1 ? mark : ''}
            </button>
          </span>
        ))}
      </p>
      <div className={cls.panels}>
        {modes.map((m, i) => (
          <div key={m.id} className={cls.panel} data-on={i === on ? '' : undefined} aria-hidden={i === on ? undefined : true} inert={i !== on}>
            <div className={cls.media}>{m.picture}</div>
            <div className={cls.body}>
              <h3 className={cls.name}>{m.name}</h3>
              <p className={cls.text}>{m.text}</p>
              <ul className={cls.facts}>
                {m.facts.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <div className={cls.deal}>
                <p className={cls.from}>
                  <span>{m.fromLabel}</span> <b className={cls.amount}>{m.price}</b>
                </p>
                <a className={cls.go} href={m.href} rel="noopener" data-press>
                  {m.book}
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
      {foot}
    </div>
  );
}
