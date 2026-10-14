'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  /** The id of the section whose plan shows the guests: it is given `--n` and `data-band`. */
  target: string;
  min: number;
  comfort: number;
  max: number;
  /** The count in words, from one up. */
  words: string[];
  /** The one per person price, as a figure and as the business writes it. */
  price: { amount: number; symbol: string; value: string; unit: string };
  book: { label: string; href: string };
  text: { empty: string; group: string; add: string; remove: string; fits: string; roomy: string; full: string; short: string; fewer: string; under: string; times: string };
  mail: { label: string; address: string; subject: string; subjectNone: string; body: string };
  cls: { root: string; controls: string; step: string; count: string; total: string; act: string; go: string; say: string; fewer: string; mail: string };
  /** What the group is booking, shown above the count. */
  children?: ReactNode;
}

function band(n: number, p: Pick<Props, 'min' | 'comfort' | 'max'>) {
  if (n <= 0) return 'none';
  if (n < p.min) return 'under';
  if (n <= p.comfort) return 'fits';
  return n >= p.max ? 'full' : 'roomy';
}

function Sign({ plus }: { plus?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path d={plus ? 'M4 12h16M12 4v16' : 'M4 12h16'} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" />
    </svg>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
    </svg>
  );
}

/**
 * The size of a group, from the business's minimum up to what its boat takes. The plan of the boat
 * fills a place for each guest, the total shows as the business's own per person price times the
 * group, and the button beside it goes to their booking system. As it first comes into view the
 * guests board one by one, then one more joins, so a visitor who only scrolls sees what it does; any
 * tap stops that. The total is worked out in the browser, never written into the page.
 */
export function HaulCrew(props: Props) {
  const { target, min, max, words, price, book, text, mail, cls, children } = props;
  const [n, setN] = useState(min);
  const [ready, setReady] = useState(false);
  const touched = useRef(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = document.getElementById(target);
    if (!el) return;
    el.style.setProperty('--n', String(n));
    el.dataset.band = band(n, props);
  });

  useEffect(() => {
    setReady(true);
    const el = document.getElementById(target);
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.6) return;
    setN(0);
    const timers: number[] = [];
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        const steps = [...Array.from({ length: min }, (_, k) => k + 1), min + 1];
        steps.forEach((v, k) => timers.push(window.setTimeout(() => !touched.current && setN(v), 240 * (k + 1) + (v > min ? 900 : 0))));
      },
      { threshold: 0.35 },
    );
    io.observe(root.current ?? el);
    return () => {
      io.disconnect();
      for (const t of timers) window.clearTimeout(t);
    };
  }, [target, min]);

  const change = (by: number) => {
    touched.current = true;
    setN((v) => Math.max(min, Math.min(max, v + by)));
  };

  const b = band(n, props);
  const word = n > 0 ? words[n - 1] ?? String(n) : '';
  const say = b === 'full' ? `${text.roomy} ${text.full}` : b === 'roomy' ? text.roomy : text.fits;
  const subject = n > 0 ? mail.subject.split('{n}').join(word) : mail.subjectNone;
  const body = mail.body.split('{n}').join(word || '…');
  const href = `mailto:${mail.address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const counted = ready && n >= min;

  return (
    <div ref={root} className={cls.root} data-band={b}>
      {children}
      <div className={cls.controls}>
        <button type="button" className={cls.step} aria-label={text.remove} disabled={n <= min} onClick={() => change(-1)} data-press>
          <Sign />
        </button>
        <output className={cls.count} aria-live="polite">
          {n > 0 ? (
            <>
              {text.group} <b>{word}</b>
            </>
          ) : (
            text.empty
          )}
        </output>
        <button type="button" className={cls.step} aria-label={text.add} disabled={n >= max} onClick={() => change(1)} data-press>
          <Sign plus />
        </button>
      </div>
      <p className={cls.total} data-on={counted ? '' : undefined}>
        {counted ? (
          <>
            <b key={n}>
              {price.symbol}
              {(n * price.amount).toLocaleString('en-NZ')}
            </b>
            <span>
              {n} {text.times} {price.value} {price.unit}
            </span>
          </>
        ) : (
          <span>{text.short}</span>
        )}
      </p>
      <div className={cls.act}>
        <a className={cls.go} href={book.href} rel="noopener" data-press data-magnetic>
          {book.label}
          <Arrow />
        </a>
      </div>
      <p className={cls.say}>{say}</p>
      <p className={cls.fewer}>
        <b>{text.fewer}</b> {text.under}{' '}
        <a className={cls.mail} href={href}>
          {mail.label}
        </a>
      </p>
    </div>
  );
}
