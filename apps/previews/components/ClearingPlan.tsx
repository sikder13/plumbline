'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { stillWanted, whenIdle } from './ClearingIdle';

interface Day {
  id: string;
  name: string;
  meta: string;
  price: string;
  note?: string;
  /** The places on the map the day goes to, by id. */
  places: string[];
}

/** A point already placed in the map's own units by the page, which knows the projection. */
interface Spot {
  id: string;
  name: string;
  x: number;
  y: number;
}

interface Place extends Spot {
  kind: string;
  size: number;
}

interface Props {
  email: string;
  days: Day[];
  towns: Spot[];
  places: Place[];
  map: { w: number; h: number; sea: string; coast: string; lakes: string[] };
  /** A plan the map marks by itself the first time it comes well into view. */
  demo: { mark?: string; town?: string }[];
  words: { listLabel: string; pickup: string; send: string; empty: string; subject: string; bodyDays: string; bodyTown: string; bodyEnd: string };
  cls: Record<'root' | 'map' | 'mapArt' | 'town' | 'list' | 'listLabel' | 'day' | 'dayMark' | 'dayName' | 'dayMeta' | 'dayPrice' | 'send' | 'sendRow' | 'sendNote', string>;
  /** Said under the send button, such as how the business answers. */
  after?: ReactNode;
}

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A forest drawn as a stand of trunks with two tree fern crowns, standing on its place. */
function Forest({ size }: { size: number }) {
  const trunks: [number, number, number][] = [[-24, 3, 30], [-16, 4, 40], [-7, 3, 34], [1, 5, 44], [10, 3, 36], [18, 4, 40], [26, 3, 28]];
  const frond = 'M0 0C9-5 21-6 33 2C22-2 10-1 0 2Z';
  return (
    <g transform={`scale(${size})`}>
      {trunks.map(([x, w, h]) => (
        <rect key={x} x={x} y={-h} width={w} height={h} rx="1" />
      ))}
      {[-12, 14].map((cx) => (
        <g key={cx} transform={`translate(${cx} -26)`} data-crown="">
          {[-60, -30, -6, 18].map((a) => (
            <path key={`r${a}`} d={frond} transform={`rotate(${a})`} />
          ))}
          {[-60, -30, -6, 18].map((a) => (
            <path key={`l${a}`} d={frond} transform={`scale(-1 1) rotate(${a})`} />
          ))}
        </g>
      ))}
    </g>
  );
}

/** A volcano drawn as two peaks with snow on their tops. */
function Volcano({ size }: { size: number }) {
  return (
    <g transform={`scale(${size})`}>
      <path d="M-46 0L-14-40L-6-33L2-46L14-30L46 0Z" />
      <path data-snow="" d="M-14-40L-20-32L-13-30L-8-34L-6-33L2-46L-4-36L3-34L9-37L14-30L10-33L5-31L2-46Z" />
    </g>
  );
}

/**
 * A day planned on a drawn map: the days stand in one list with their prices in one column, and a tap
 * marks a day; the places it goes to light up on the map, with a line from the town chosen for pick up.
 * The marked days are what one button emails to the business, as a plain list. Nothing is booked here.
 * Any link elsewhere on the page marked `data-pick` with a day's id marks that day on its way here.
 */
export function ClearingPlan({ email, days, towns, places, map, demo, words, cls, after }: Props) {
  const [marked, setMarked] = useState<string[]>([]);
  const [town, setTown] = useState(towns[0]!.id);
  const root = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  const stopDemo = () => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  };

  const toggle = (id: string) => setMarked((now) => (now.includes(id) ? now.filter((d) => d !== id) : [...now, id]));

  // A "plan this day" link elsewhere on the page marks its day here.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const id = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-pick]')?.dataset.pick;
      if (!id || !days.some((d) => d.id === id)) return;
      stopDemo();
      setMarked((now) => (now.includes(id) ? now : [...now, id]));
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [days]);

  // Marked by itself once, so a visitor who only scrolls still sees a plan come together. Set up only
  // once the browser is first idle, and played only when the map is well in view.
  useEffect(() => {
    const el = root.current;
    if (!el || stillWanted()) return;
    let io: IntersectionObserver | undefined;
    const cancel = whenIdle(() => {
      io = new IntersectionObserver(
        ([e]) => {
          if (!e?.isIntersecting) return;
          io?.disconnect();
          demo.forEach((step, i) => {
            timers.current.push(
              window.setTimeout(
                () => {
                  if (step.mark) setMarked((now) => (now.includes(step.mark!) ? now : [...now, step.mark!]));
                  if (step.town) setTown(step.town);
                },
                500 + i * 1000,
              ),
            );
          });
        },
        { threshold: 0.35 },
      );
      io.observe(el);
    });
    return () => {
      cancel();
      io?.disconnect();
      stopDemo();
    };
  }, [demo]);

  const from = towns.find((t) => t.id === town) ?? towns[0]!;
  const lit = new Set(days.filter((d) => marked.includes(d.id)).flatMap((d) => d.places));
  const chosen = days.filter((d) => marked.includes(d.id));
  const body = [words.bodyDays, ...chosen.map((d) => `- ${d.name} (${d.price})`), '', `${words.bodyTown} ${from.name}`, '', words.bodyEnd].join('\n');
  const href = `mailto:${email}?subject=${encodeURIComponent(`${words.subject} ${chosen.map((d) => d.name).join(', ') || from.name}`)}&body=${encodeURIComponent(body)}`;

  return (
    <div ref={root} className={cls.root}>
      <div className={cls.map}>
        <svg className={cls.mapArt} viewBox={`0 0 ${map.w} ${map.h}`} aria-hidden="true" focusable="false">
          <path data-sea="" d={map.sea} />
          <path data-coast="" d={map.coast} />
          {map.lakes.map((d) => (
            <path key={d} data-lake="" d={d} />
          ))}
          {places.map((p) =>
            lit.has(p.id) ? (
              <line key={`route-${p.id}-${from.id}`} data-route="" x1={from.x} y1={from.y} x2={p.x} y2={p.y - 4} />
            ) : null,
          )}
          {places.map((p) => (
            <g key={p.id} data-place={p.kind} data-on={lit.has(p.id) ? '' : undefined} transform={`translate(${p.x} ${p.y})`}>
              <ellipse data-halo="" cx="0" cy="-2" rx={44 * p.size} ry={14 * p.size} />
              {p.kind === 'volcano' ? <Volcano size={p.size} /> : <Forest size={p.size} />}
              <text y={14 * p.size + 12} textAnchor="middle">
                {p.name}
              </text>
            </g>
          ))}
          {towns.map((t) => (
            <circle key={t.id} data-town="" data-on={t.id === from.id ? '' : undefined} cx={t.x} cy={t.y} r={t.id === from.id ? 7 : 5} />
          ))}
        </svg>
        <div role="group" aria-label={words.pickup}>
          {towns.map((t) => (
            <button key={t.id} type="button" className={cls.town} aria-pressed={t.id === from.id} onClick={() => {
                stopDemo();
                setTown(t.id);
              }} style={{ left: `${(t.x / map.w) * 100}%`, top: `${(t.y / map.h) * 100}%` } as CSSProperties}>
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <div className={cls.list}>
        <p className={cls.listLabel}>
          <span>{words.listLabel}</span>
          <span>{words.pickup}: {from.name}</span>
        </p>
        <ul>
          {days.map((d) => {
            const on = marked.includes(d.id);
            return (
              <li key={d.id}>
                <button type="button" className={cls.day} aria-pressed={on} onClick={() => {
                    stopDemo();
                    toggle(d.id);
                  }}>
                  <i className={cls.dayMark} aria-hidden="true" />
                  <span className={cls.dayName}>
                    <b>{d.name}</b>
                    <span className={cls.dayMeta}>{d.meta}</span>
                  </span>
                  <span className={cls.dayPrice}>
                    <b>{d.price}</b>
                    {d.note && <small>{d.note}</small>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className={cls.sendRow}>
          <a className={cls.send} href={href} data-press>
            {words.send}
            <Arrow />
          </a>
          <p className={cls.sendNote} aria-live="polite">
            {chosen.length ? chosen.map((d) => d.name).join(' + ') : words.empty}
          </p>
        </div>
        {after}
      </div>
    </div>
  );
}
