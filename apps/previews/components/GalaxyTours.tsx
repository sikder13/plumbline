'use client';

import { useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';

export interface GalaxyTour {
  id: string;
  name: string;
  /** The name as it fits on its thread. */
  short: string;
  tag: string;
  /** How long the tour runs, for the length of its thread only. It is not shown. */
  minutes: number;
  /** The caves it visits, in order: "water" for a cave with the boat ride, "chamber" for one walked. */
  caves: string[];
  text: string;
  duration: string;
  group: string;
  prices: { who: string; price: string }[];
  action: { label: string; href: string };
  note?: string;
}

type Names = 'chooser' | 'tabs' | 'tab' | 'tabThread' | 'tabName' | 'tabFull' | 'tabTag' | 'tabPrice' | 'ticket' | 'section' | 'tName' | 'tText' | 'tFacts' | 'buy' | 'prices' | 'go' | 'tNote';

/** A small cross section of the tour: the ground, the caves it could reach, and its thread dipping into the ones it visits. */
function Section({ caves, all }: { caves: string[]; all: string[] }) {
  const n = all.length;
  const xs = n === 1 ? [300] : all.map((_, i) => 150 + (i * 300) / (n - 1));
  let d = 'M14 58';
  let x = 14;
  caves.forEach((_, i) => {
    const cx = xs[i]!;
    d += `C${(x + cx) / 2} 58 ${cx - 60} 150 ${cx} 150`;
    const next = i + 1 < caves.length ? xs[i + 1]! : 586;
    const mid = i + 1 < caves.length ? (cx + next) / 2 : 586;
    d += `C${cx + 60} 150 ${mid - 30} 58 ${mid} 58`;
    x = mid;
  });
  if (x < 586) d += 'H586';
  return (
    <svg viewBox="0 0 600 210" aria-hidden="true" focusable="false">
      <rect x="0" y="0" width="600" height="68" data-sky />
      <path d="M0 68H600V210H0Z" data-rock />
      <path d="M0 68H600" data-ground />
      {all.map((kind, i) => {
        const cx = xs[i]!;
        const on = i < caves.length;
        return (
          <g key={i} data-cave={kind} data-on={on ? '' : undefined}>
            <path d={`M${cx - 92} 150C${cx - 92} 112 ${cx - 40} 108 ${cx} 112C${cx + 44} 104 ${cx + 94} 116 ${cx + 92} 150C${cx + 90} 178 ${cx + 40} 184 ${cx} 180C${cx - 44} 186 ${cx - 94} 176 ${cx - 92} 150Z`} data-void />
            {kind === 'water' ? (
              <g data-dots>
                {[-62, -44, -30, -14, 0, 12, 26, 40, 56, 70, -52, -20, 8, 34, 62].map((dx, k) => (
                  <circle key={k} cx={cx + dx} cy={120 + ((k * 7) % 13)} r={k % 3 === 0 ? 2.4 : 1.6} />
                ))}
                <path d={`M${cx - 80} 162H${cx + 80}`} data-water />
              </g>
            ) : (
              <g data-forms>
                {[-60, -38, -18, 6, 30, 52, 70].map((dx, k) => (
                  <path key={k} d={`M${cx + dx - 4} 114L${cx + dx} ${128 + ((k * 9) % 16)}L${cx + dx + 4} 114Z`} />
                ))}
              </g>
            )}
          </g>
        );
      })}
      <path d={d} pathLength={1} data-thread />
      {caves.map((_, i) => (
        <circle key={i} cx={xs[i]} cy="150" r="7" data-bead />
      ))}
    </svg>
  );
}

/**
 * The tours side by side as threads of different lengths, each as long as the tour runs, with its price
 * on it. Choosing one shows its ticket: what it visits, how long it takes, every price, and the way to
 * book it beside them.
 */
export function GalaxyTours({ tours, labels, cls }: { tours: GalaxyTour[]; labels: { choose: string; duration: string }; cls: Record<Names, string | undefined> }) {
  const [sel, setSel] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const longest = Math.max(...tours.map((t) => t.minutes));
  const all = tours.reduce<string[]>((a, t) => (t.caves.length > a.length ? t.caves : a), []);

  const key = (e: KeyboardEvent<HTMLButtonElement>) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (sel + step + tours.length) % tours.length;
    setSel(next);
    tabs.current[next]?.focus();
  };

  return (
    <div className={cls.chooser}>
      <div className={cls.tabs} role="tablist" aria-label={labels.choose}>
        {tours.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`galaxy-tab-${t.id}`}
            aria-selected={i === sel}
            aria-controls={`galaxy-tour-${t.id}`}
            tabIndex={i === sel ? 0 : -1}
            className={cls.tab}
            style={{ '--len': (t.minutes / longest).toFixed(3), '--i': i } as CSSProperties}
            onClick={() => setSel(i)}
            onKeyDown={key}
          >
            <span className={cls.tabThread} aria-hidden="true" />
            <span className={cls.tabName} aria-hidden="true">
              {t.short}
            </span>
            <span className={cls.tabFull}>{t.name}</span>
            <span className={cls.tabTag}>{t.tag}</span>
            <span className={cls.tabPrice}>{t.prices[0]?.price}</span>
          </button>
        ))}
      </div>
      {tours.map((t, i) => (
        <div key={t.id} role="tabpanel" id={`galaxy-tour-${t.id}`} aria-labelledby={`galaxy-tab-${t.id}`} hidden={i !== sel} className={cls.ticket}>
          <div className={cls.section}>
            <Section caves={t.caves} all={all} />
          </div>
          <h3 className={cls.tName}>{t.name}</h3>
          <p className={cls.tText}>{t.text}</p>
          <p className={cls.tFacts}>
            <span>
              {labels.duration}: {t.duration}
            </span>
            <span>{t.group}</span>
          </p>
          <div className={cls.buy}>
            <ul className={cls.prices}>
              {t.prices.map((p) => (
                <li key={p.who}>
                  <b>{p.price}</b>
                  <span>{p.who}</span>
                </li>
              ))}
            </ul>
            <a className={cls.go} href={t.action.href} rel={t.action.href.startsWith('http') ? 'noopener' : undefined} data-press>
              {t.action.label}
            </a>
          </div>
          {t.note && <p className={cls.tNote}>{t.note}</p>}
        </div>
      ))}
    </div>
  );
}
