'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { WISH_EVENT } from './SunpathMap';

export interface HousePack {
  name: string;
  nights: number;
  days: number;
  daysLine: string;
  /** One per size of group, in the order of the group sizes. */
  prices: string[];
  included: string[];
}

export interface HouseLabels {
  house: { floors: string[]; road: string; harbour: string; dunes: string; tap: string; nights: string; minimum: string; window: string };
  jetski: { label: string; note: string; price: string; unit: string };
  send: string;
  sendNote: string;
  perCouple: string;
  included: string;
  more: string;
  wishLabel: string;
  email: { greeting: string; we: string; love: string; package: string; jetski: string; wishes: string; dates: string; names: string; subject: string };
}

type Cls = Record<
  'box' | 'scene' | 'svg' | 'win' | 'moons' | 'moon' | 'tap' | 'side' | 'days' | 'daysLine' | 'meta' | 'row' | 'figure' | 'send' | 'toggle' | 'extra' | 'note' | 'wish' | 'plus' | 'minimum',
  string | undefined
>;

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Group sizes as the business writes them start with the number of couples. */
const count = (label: string, i: number, least: number) => Number.parseInt(label, 10) || i + least;

/* The drawing: a house of two floors on the shore, two bedrooms a floor, with the road, the beach, the water and the dunes across it. */
const W = 800;
const H = 600;
const ROOMS = [
  { x: 112, y: 342 },
  { x: 282, y: 342 },
  { x: 112, y: 216 },
  { x: 282, y: 216 },
];
const RW = 120;
const RH = 72;

/**
 * The house itself is the booking. Each lit window is a couple (tap a window to light the rooms up to
 * it; the business's minimum stays lit), the moons in the sky choose the package by its nights, and the
 * price per couple for that group stands beside the button. Sending opens an email to the business with
 * the plan written out, with any adventures the visitor added on the map; nothing is booked from the
 * page. As the house first comes into view it lights its windows and tries the longer stay by itself,
 * so the visitor sees what it does; any tap stops that.
 */
export function SunpathHouse({ packs, couples: groups, least, labels, email, cls }: { packs: HousePack[]; couples: string[]; least: number; labels: HouseLabels; email: string; cls: Cls }) {
  const [size, setSize] = useState(0);
  const [pack, setPack] = useState(0);
  const [jetski, setJetski] = useState(false);
  const [wish, setWish] = useState<string[]>([]);
  const [nudge, setNudge] = useState(0);
  const touched = useRef(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const read = (e: Event) => setWish([...((e as CustomEvent<string[]>).detail ?? [])]);
    setWish([...((window as Window & { __sunpathWish?: string[] }).__sunpathWish ?? [])]);
    window.addEventListener(WISH_EVENT, read);
    return () => window.removeEventListener(WISH_EVENT, read);
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timers: number[] = [];
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        const plan: (() => void)[] = [];
        for (let i = 1; i < groups.length; i++) plan.push(() => setSize(i));
        if (packs.length > 1) plan.push(() => setPack(1), () => setPack(0));
        plan.forEach((fn, k) =>
          timers.push(
            window.setTimeout(() => {
              if (!touched.current) fn();
            }, 700 + k * 900),
          ),
        );
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      for (const t of timers) clearTimeout(t);
    };
  }, [groups.length, packs.length]);

  const current = packs[pack]!;
  const lit = count(groups[size] ?? '', size, least);
  const price = current.prices[size] ?? current.prices[0];
  const rooms = groups.length + least - 1;

  const tapWindow = (room: number) => {
    touched.current = true;
    // A lit window that is the last one lit is turned off; any other lights the rooms up to it.
    const want = room === lit ? room - 1 : room;
    if (want < least) {
      setNudge((v) => v + 1);
      setSize(0);
      return;
    }
    setSize(Math.min(groups.length - 1, want - least));
  };

  const body = [
    labels.email.greeting,
    '',
    `${labels.email.we} ${groups[size]} ${labels.email.love} ${current.name} ${labels.email.package}`,
    ...(jetski ? [labels.email.jetski] : []),
    ...(wish.length ? [`${labels.email.wishes} ${wish.join(', ')}.`] : []),
    '',
    labels.email.dates,
    labels.email.names,
    '',
  ].join('\n');
  const subject = `${labels.email.subject}, ${current.name}, ${groups[size]}`;
  const href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div ref={box} className={cls.box} data-pack={pack} data-lit={lit}>
      <div className={cls.scene}>
        <svg className={cls.svg} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
          <rect data-part="sky" width={W} height={H} />
          <circle data-part="sun" cx="640" cy="440" r="64" />
          <path data-part="dune" d="M420 440c40-28 92-60 156-64 66-4 110 22 150 32 30 8 52 8 74 6v26H420z" />
          <rect data-part="water" x="440" y="438" width={W - 440} height={H - 438} />
          <path data-part="glint" d="M600 470h84M612 490h60M624 510h36" />
          <path data-part="beach" d="M392 452h52l70 148H392z" />
          <rect data-part="land" y="452" width="420" height={H - 452} />
          <rect data-part="road" x="300" y="446" width="120" height="10" />
          <path data-part="lines" d="M310 451h16M342 451h16M374 451h16" />
          <path data-part="roof" d="M70 200L262 104l192 96z" />
          <rect data-part="floor" x="82" y="200" width="360" height="126" />
          <rect data-part="floor" x="82" y="326" width="360" height="126" data-low="" />
          <path data-part="deck" d="M442 326h66M450 326v-38M466 326v-38M482 326v-38M500 326v-38M442 288h66M450 326v126M500 326v126" />
          {ROOMS.slice(0, rooms).map((r, i) => (
            <g key={i} data-room={i + 1} data-on={i + 1 <= lit ? '' : undefined} style={{ '--d': `${i * 90}ms` } as CSSProperties}>
              <rect data-part="pane" x={r.x} y={r.y} width={RW} height={RH} rx="4" />
              <g data-part="couple">
                <circle cx={r.x + 46} cy={r.y + 40} r="11" />
                <path d={`M${r.x + 28} ${r.y + RH}c0-18 8-26 18-26s18 8 18 26z`} />
                <circle cx={r.x + 76} cy={r.y + 42} r="10" />
                <path d={`M${r.x + 60} ${r.y + RH}c0-16 7-24 16-24s16 8 16 24z`} />
              </g>
              <path data-part="sill" d={`M${r.x - 6} ${r.y + RH + 6}h${RW + 12}`} />
            </g>
          ))}
          <text data-part="label" x="262" y="318">
            {labels.house.floors[1]}
          </text>
          <text data-part="label" x="262" y="444">
            {labels.house.floors[0]}
          </text>
          <text data-part="label" data-light="" x="360" y="480">
            {labels.house.road}
          </text>
          <text data-part="label" x="700" y="560">
            {labels.house.harbour}
          </text>
          <text data-part="label" x="740" y="404">
            {labels.house.dunes}
          </text>
        </svg>
        {ROOMS.slice(0, rooms).map((r, i) => (
          <button
            key={i}
            type="button"
            className={cls.win}
            aria-pressed={i + 1 <= lit}
            aria-label={`${labels.house.window} ${i + 1}, ${groups[Math.max(0, i + 1 - least)] ?? ''}`}
            onClick={() => tapWindow(i + 1)}
            style={{ '--x': `${(r.x / W) * 100}%`, '--y': `${(r.y / H) * 100}%`, '--w': `${(RW / W) * 100}%`, '--h': `${(RH / H) * 100}%` } as CSSProperties}
          />
        ))}
        <div className={cls.moons} role="group" aria-label={labels.house.nights}>
          {packs.map((p, i) => (
            <button
              key={p.name}
              type="button"
              className={cls.moon}
              aria-pressed={i === pack}
              onClick={() => {
                touched.current = true;
                setPack(i);
              }}
            >
              <span aria-hidden="true">
                {Array.from({ length: p.nights }, (_, k) => (
                  <i key={k} style={{ '--k': k } as CSSProperties} />
                ))}
              </span>
              {p.name}
            </button>
          ))}
        </div>
        <p className={cls.tap}>{labels.house.tap}</p>
      </div>

      <div className={cls.side}>
        <div className={cls.days} aria-hidden="true">
          <ol key={current.name}>
            {Array.from({ length: current.days }, (_, i) => (
              <li key={i} style={{ '--i': i } as CSSProperties} />
            ))}
          </ol>
        </div>
        <p className={cls.daysLine}>{current.daysLine}</p>
        <p className={cls.meta} aria-live="polite">
          {current.name} <i aria-hidden="true" /> {groups[size]}
        </p>
        <p className={cls.minimum} key={nudge} data-nudge={nudge ? '' : undefined}>
          {labels.house.minimum}
        </p>
        <div className={cls.row}>
          <p className={cls.figure} aria-live="polite">
            <b key={price}>{price}</b> <span>{labels.perCouple}</span>
          </p>
          <a className={cls.send} href={href} data-press data-magnetic>
            {labels.send}
            <Arrow />
          </a>
        </div>
        <label className={cls.toggle}>
          <input type="checkbox" checked={jetski} onChange={(e) => {
              touched.current = true;
              setJetski(e.target.checked);
            }} />
          <span>{labels.jetski.label}</span>
        </label>
        <p className={cls.extra}>
          {labels.jetski.note} {labels.jetski.price} {labels.jetski.unit}.
        </p>
        {wish.length > 0 && (
          <p className={cls.wish}>
            <b>{labels.wishLabel}</b> {wish.join(', ')}
          </p>
        )}
        <p className={cls.note}>{labels.sendNote}</p>
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
    </div>
  );
}
