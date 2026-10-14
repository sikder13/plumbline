'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

interface See {
  text: string;
  tags: string[];
}

export interface GateTour {
  id: string;
  name: string;
  line: string;
  /** The picture shown when nothing in particular is asked for. */
  image: string;
  /** A picture for a choice this tour answers better than its usual one. */
  images: Record<string, string>;
  /** Everything the tour includes, in the business's words, each tagged with the choices it answers. */
  sees: See[];
  /** Three short facts; the first gives way to a matching line of `sees`. */
  facts: string[];
  prices: { label: string; value: string }[];
  note?: string;
  /** Carries the business's own seasonal pause, so a live note shows on the days it covers. */
  seasonal?: boolean;
}

interface Labels {
  choose: string;
  rail: string;
  clear: string;
  paused: string;
  book: string;
  count: string;
  join: string;
  more: string;
}

type Cls = Record<
  | 'chooser'
  | 'chips'
  | 'chip'
  | 'status'
  | 'clear'
  | 'stage'
  | 'rail'
  | 'row'
  | 'rowName'
  | 'rowPrice'
  | 'state'
  | 'feature'
  | 'media'
  | 'shot'
  | 'paused'
  | 'body'
  | 'name'
  | 'line'
  | 'facts'
  | 'buy'
  | 'price'
  | 'go'
  | 'more'
  | 'sees'
  | 'prices'
  | 'note'
  | 'sr',
  string
>;

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M3 10h13M11.5 5.5 16 10l-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Choose your gate: the visitor taps what they came for and each tour's gate stays open or swings
 * shut. One tour at a time fills the large frame: the one chosen in the list, or the first whose
 * gate is open. The frame shows the very thing asked for where the tour has a picture of it, and
 * its first fact becomes the matching line of the tour's own list. The first time it comes into
 * view it plays a short demonstration, then waits for the visitor.
 */
export function LatchGates({
  chips,
  tours,
  pictures,
  gate,
  labels,
  pause,
  demo,
  book,
  cls,
}: {
  chips: { id: string; label: string }[];
  tours: GateTour[];
  pictures: Record<string, ReactNode>;
  gate: ReactNode;
  labels: Labels;
  /** The first and last day of the pause, as month and day. */
  pause: { from: [number, number]; to: [number, number] };
  /** The choices the demonstration steps through. */
  demo: string[][];
  book: { href: string };
  cls: Cls;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [focus, setFocus] = useState(tours[0]!.id);
  const [paused, setPaused] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const touched = useRef(false);

  useEffect(() => {
    // Today in New Zealand, where the pause is kept.
    const parts = new Intl.DateTimeFormat('en-NZ', { timeZone: 'Pacific/Auckland', month: 'numeric', day: 'numeric' }).formatToParts(new Date());
    const month = Number(parts.find((p) => p.type === 'month')?.value);
    const day = Number(parts.find((p) => p.type === 'day')?.value);
    const today = month * 100 + day;
    setPaused(today >= pause.from[0] * 100 + pause.from[1] && today <= pause.to[0] * 100 + pause.to[1]);
  }, [pause]);

  const hit = (s: See, on: string[]) => s.tags.some((tag) => on.includes(tag));
  const matches = (t: GateTour, on: string[]) => on.length === 0 || t.sees.some((s) => hit(s, on));

  useEffect(() => {
    const el = root.current;
    if (!el || !demo.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timers: number[] = [];
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        demo.forEach((step, i) =>
          timers.push(
            window.setTimeout(() => {
              if (touched.current) return;
              setPicked(step);
              const first = tours.find((t) => step.length > 0 && matches(t, step));
              if (first) setFocus(first.id);
            }, 300 + i * 1250),
          ),
        );
      },
      { rootMargin: '0px 0px -35% 0px' },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      for (const t of timers) window.clearTimeout(t);
    };
    // The demonstration runs once, from what the page was given.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  const choose = (next: string[]) => {
    touched.current = true;
    setPicked(next);
    const current = tours.find((t) => t.id === focus)!;
    if (!matches(current, next)) {
      const first = tours.find((t) => matches(t, next));
      if (first) setFocus(first.id);
    }
  };
  const toggle = (id: string) => choose(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);
  const open = tours.filter((t) => matches(t, picked)).length;
  const shown = tours.find((t) => t.id === focus)!;
  const asked = [...picked].reverse().find((k) => shown.images[k] && shown.sees.some((s) => s.tags.includes(k)));
  const picture = asked ? shown.images[asked]! : shown.image;
  const keys = [...new Set(tours.flatMap((t) => [t.image, ...Object.values(t.images)]))];
  const matched = shown.sees.find((s) => hit(s, picked));
  const facts = matched ? [matched.text, ...shown.facts.slice(1)] : shown.facts;
  const adult = (t: GateTour) => t.prices[0]!;

  return (
    <div className={cls.chooser} ref={root}>
      <div className={cls.chips} role="group" aria-label={labels.choose}>
        {chips.map((c) => (
          <button key={c.id} type="button" className={cls.chip} aria-pressed={picked.includes(c.id)} onClick={() => toggle(c.id)}>
            <i aria-hidden="true" />
            {c.label}
          </button>
        ))}
      </div>
      <p className={cls.status} aria-live="polite">
        <b>{open}</b> {labels.join} {tours.length} {labels.count}
        <button type="button" className={cls.clear} onClick={() => choose([])} hidden={!picked.length}>
          {labels.clear}
        </button>
      </p>
      <div className={cls.stage}>
        <ul className={cls.rail} aria-label={labels.rail}>
          {tours.map((t, i) => (
            <li key={t.id}>
              <button
                type="button"
                className={cls.row}
                data-match={matches(t, picked) ? 'yes' : 'no'}
                aria-pressed={t.id === focus}
                onClick={() => {
                  touched.current = true;
                  setFocus(t.id);
                }}
                style={{ '--i': i } as CSSProperties}
              >
                <span className={cls.state} aria-hidden="true">
                  {gate}
                </span>
                <span className={cls.rowName}>{t.name}</span>
                <span className={cls.rowPrice}>
                  {adult(t).label} <b>{adult(t).value}</b>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <article className={cls.feature} aria-labelledby="gate-name">
          <div className={cls.media}>
            {keys.map((k) => (
              <div key={k} className={cls.shot} data-show={k === picture ? '' : undefined} aria-hidden={k === picture ? undefined : true}>
                {pictures[k]}
              </div>
            ))}
            {shown.seasonal && paused && <p className={cls.paused}>{labels.paused}</p>}
          </div>
          <div className={cls.body} key={shown.id}>
            <h3 id="gate-name" className={cls.name}>
              {shown.name}
            </h3>
            <p className={cls.line}>{shown.line}</p>
            <ul className={cls.facts}>
              {facts.map((f, n) => (
                <li key={f} data-hit={n === 0 && matched ? '' : undefined}>
                  {f}
                </li>
              ))}
            </ul>
            <div className={cls.buy}>
              <p className={cls.price}>
                {adult(shown).label} <b>{adult(shown).value}</b>
              </p>
              <a className={cls.go} href={book.href} rel="noopener" data-press>
                {labels.book}
                <span className={cls.sr}> {shown.name}</span>
                <Arrow />
              </a>
            </div>
            <details className={cls.more}>
              <summary>{labels.more}</summary>
              <ul className={cls.sees}>
                {shown.sees.map((s) => (
                  <li key={s.text} data-hit={hit(s, picked) ? '' : undefined}>
                    {s.text}
                  </li>
                ))}
              </ul>
              <p className={cls.prices}>
                {shown.prices.map((p) => (
                  <span key={p.label}>
                    {p.label} <b>{p.value}</b>
                  </span>
                ))}
              </p>
              {shown.note && <p className={cls.note}>{shown.note}</p>}
            </details>
          </div>
        </article>
      </div>
    </div>
  );
}
