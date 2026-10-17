'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { scrollPageTo } from './MotionLayer';
import { Pinned } from './Pinned';

export interface DayTour {
  id: string;
  name: string;
  hours: string;
  level: string;
  line: string;
  from: string;
  prices: string[];
  href: string;
  dep: string;
  ret: string;
  /** Hours from midnight, for drawing only: 8.75 is a quarter to nine. */
  start: number;
  end: number;
  also?: string;
  picture: ReactNode;
}

type Cls = Record<
  'pin' | 'head' | 'label' | 'rule' | 'panels' | 'panel' | 'readout' | 'tourName' | 'tourMeta' | 'tourPrices' | 'book' | 'photos' | 'photo' | 'timeline' | 'bars' | 'barRow' | 'barName' | 'barTrack' | 'bar' | 'rail' | 'railMove' | 'railLabel' | 'axis',
  string
>;

interface Props {
  heading: string;
  tours: DayTour[];
  /** The hours the day is drawn between. */
  start: number;
  end: number;
  axis: [string, string];
  words: { leaves: string; back: string; backShort: string; book: string };
  cls: Cls;
}

/**
 * The day ashore as one timeline held still while the visitor scrolls: each tour a solid bar from its
 * departure to its return, a bold line at the time it is back, and the chosen tour's times set large
 * with its photograph. Scrolling steps through the tours; tapping a bar scrolls to it.
 */
export function ApertureDay({ heading, tours, start, end, axis, words, cls }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const span = end - start;
  const n = tours.length;

  useEffect(() => {
    const outer = wrap.current?.firstElementChild as HTMLElement | null;
    if (!outer) return;
    const read = () => setActive(Number(outer.getAttribute('data-active') ?? 0));
    const watch = new MutationObserver(read);
    watch.observe(outer, { attributes: true, attributeFilter: ['data-active'] });
    return () => watch.disconnect();
  }, []);

  const go = (i: number) => {
    const outer = wrap.current?.firstElementChild as HTMLElement | null;
    if (!outer) return;
    const range = outer.offsetHeight - window.innerHeight;
    if (range <= 0) return setActive(i);
    const top = outer.getBoundingClientRect().top + window.scrollY;
    scrollPageTo(top + ((i + 0.5) / n) * range);
  };

  const at = (h: number) => (((h - start) / span) * 100).toFixed(3);
  const state = (i: number) => (i === 0 ? 'on' : 'off');
  const current = tours[active] ?? tours[0]!;

  return (
    <div ref={wrap}>
      <Pinned steps={n} className={cls.pin}>
        <header className={cls.head}>
          <h2 id="day-h" className={cls.label}>
            {heading}
          </h2>
          <span className={cls.rule} aria-hidden="true" />
        </header>

        <div className={cls.panels}>
          {tours.map((t, i) => (
            <div key={t.id} className={cls.panel} data-step={i} data-state={state(i)}>
              <p className={cls.readout}>
                <span>
                  {words.leaves} {t.dep},
                </span>{' '}
                <span>
                  {words.back} {t.ret}.
                </span>
              </p>
              <h3 className={cls.tourName}>{t.name}</h3>
              <p className={cls.tourMeta}>
                {t.hours} · {t.level}
                {t.also ? ` · ${t.also}` : ''}
              </p>
              <p className={cls.tourPrices}>
                {t.prices.map((p) => (
                  <span key={p}>{p}</span>
                ))}
              </p>
              <a className={cls.book} href={t.href} rel="noopener" data-press aria-label={`${words.book}: ${t.name}, ${t.from}`}>
                <span>{words.book}</span>
                <b>{t.from}</b>
              </a>
            </div>
          ))}
        </div>

        <div className={cls.photos}>
          {tours.map((t, i) => (
            <div key={t.id} className={cls.photo} data-step={i} data-state={state(i)}>
              {t.picture}
            </div>
          ))}
        </div>

        <div className={cls.timeline}>
          <ol className={cls.bars}>
            {tours.map((t, i) => (
              <li key={t.id} className={cls.barRow}>
                <span className={cls.barName} aria-hidden="true">
                  {t.name}
                </span>
                <span className={cls.barTrack}>
                  <button
                    type="button"
                    className={cls.bar}
                    data-step={i}
                    data-state={state(i)}
                    aria-pressed={active === i}
                    aria-label={`${t.name}, ${t.hours}, ${words.leaves} ${t.dep}, ${words.back} ${t.ret}`}
                    onClick={() => go(i)}
                    style={{ '--x': at(t.start), '--w': (((t.end - t.start) / span) * 100).toFixed(3) } as CSSProperties}
                  >
                    <span>{t.hours}</span>
                    <b>{t.from}</b>
                  </button>
                </span>
              </li>
            ))}
          </ol>
          <span className={cls.rail} aria-hidden="true">
            <span className={cls.railMove} style={{ '--x': at(current.end) } as CSSProperties}>
              <b className={cls.railLabel}>
                {words.backShort} {current.ret}
              </b>
            </span>
          </span>
          <p className={cls.axis} aria-hidden="true">
            <span>{axis[0]}</span>
            <span>{axis[1]}</span>
          </p>
        </div>
      </Pinned>
    </div>
  );
}
