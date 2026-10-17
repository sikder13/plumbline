'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

export interface MapPlace {
  id: string;
  name: string;
  /** Compass bearing from the centre, in degrees. */
  at: number;
  ring: string;
  side: string;
  detail: string;
  area: string;
}

interface Labels {
  askAbout: string;
  askNone: string;
  and: string;
  subject: string;
  hello: string;
  ask: string;
  fields: string[];
}

interface Props {
  places: MapPlace[];
  rings: { id: string; label: string }[];
  centre: string;
  points: string[];
  labels: Labels;
  email: string;
  start: string[];
  demo: string[];
  cls: Record<string, string | undefined>;
}

const C = 200;
const STEP = 56;

function at(deg: number, r: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [C + r * Math.sin(a), C - r * Math.cos(a)];
}

/** "A", "A and B", "A, B and C". */
function list(names: string[], and: string): string {
  if (names.length < 2) return names.join('');
  return `${names.slice(0, -1).join(', ')} ${and} ${names[names.length - 1]}`;
}

/**
 * A chart of the day trips around one town: each place at its compass bearing from the centre and on the
 * ring of its length (the rings stand in proportion to the hours: half day, full day, the longest day).
 * Tapping a place marks it and swings the needle to it. The marks are the request: the one button writes
 * itself from them and opens an email to the business with the fields its own booking form asks for. When
 * the chart first comes into view it sweeps once round and marks a couple of places, then waits.
 */
export function BearingMap({ places, rings, centre, points, labels, email, start, demo, cls }: Props) {
  const [marked, setMarked] = useState<string[]>(start);
  const [focus, setFocus] = useState<string>(start[start.length - 1] ?? places[0]!.id);
  const [aim, setAim] = useState<number>(places.find((p) => p.id === (start[start.length - 1] ?? places[0]!.id))?.at ?? 0);
  const [sweep, setSweep] = useState(0);
  const [pulse, setPulse] = useState<{ id: string; n: number } | null>(null);
  const touched = useRef(false);
  const chart = useRef<HTMLDivElement>(null);
  const aimRef = useRef(aim);
  aimRef.current = aim;

  const radius = useMemo(() => Object.fromEntries(rings.map((r, i) => [r.id, STEP * (i + 1)])), [rings]);

  const turnTo = (deg: number) => {
    let d = deg;
    const now = aimRef.current;
    while (d - now > 180) d -= 360;
    while (d - now < -180) d += 360;
    setAim(d);
  };

  const mark = (id: string, on?: boolean) => {
    setMarked((m) => {
      const has = m.includes(id);
      const want = on ?? !has;
      if (want === has) return m;
      return want ? [...m, id] : m.filter((x) => x !== id);
    });
    setFocus(id);
    const p = places.find((x) => x.id === id);
    if (p) {
      turnTo(p.at);
      setPulse((q) => ({ id, n: (q?.n ?? 0) + 1 }));
    }
  };

  useEffect(() => {
    const el = chart.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timers: number[] = [];
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        if (touched.current) return;
        // Once round, every place answering as the needle passes it, then a few marks.
        setSweep(1);
        setAim(aimRef.current + 360);
        timers.push(window.setTimeout(() => setSweep(2), 1450));
        let t = 1550;
        for (const id of demo) {
          timers.push(
            window.setTimeout(() => {
              if (!touched.current) mark(id, true);
            }, t),
          );
          t += 1000;
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      for (const t of timers) window.clearTimeout(t);
    };
    // The demonstration is set up once, when the chart first shows.
  }, []);

  const names = marked.map((id) => places.find((p) => p.id === id)?.name).filter((n): n is string => !!n);
  const body = [labels.hello, '', labels.ask, ...names.map((n) => `• ${n}`), '', ...labels.fields.map((f) => `${f} `), ''].join('\n');
  const href = `mailto:${email}?subject=${encodeURIComponent(names.length ? `${labels.subject}: ${names.join(', ')}` : labels.subject)}&body=${encodeURIComponent(body)}`;
  const shown = places.find((p) => p.id === focus);
  const user = (fn: () => void) => () => {
    touched.current = true;
    fn();
  };

  return (
    <div className={cls.map}>
      <div className={cls.chart} ref={chart} data-sweep={sweep || undefined}>
        <svg className={cls.chartSvg} viewBox="0 0 400 400" aria-hidden="true" focusable="false">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((d) => {
            const [x1, y1] = at(d, 14);
            const [x2, y2] = at(d, STEP * rings.length + 14);
            return <path key={d} className={cls.spoke} d={`M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`} />;
          })}
          {rings.map((r, i) => (
            <g key={r.id}>
              <circle className={cls.ringLine} cx={C} cy={C} r={STEP * (i + 1)} />
              <text className={cls.ringLabel} x={(C - STEP * (i + 1) * 0.707 - 4).toFixed(1)} y={(C + STEP * (i + 1) * 0.707 + 4).toFixed(1)} textAnchor="end">
                {r.label}
              </text>
            </g>
          ))}
          {points.slice(0, 4).map((p, i) => {
            const [x, y] = at(i * 90, STEP * rings.length + 26);
            return (
              <text key={p} className={cls.point} x={x.toFixed(1)} y={y.toFixed(1)} textAnchor="middle" dominantBaseline="central">
                {p}
              </text>
            );
          })}
          <g className={cls.needle} style={{ '--aim': `${aim}deg` } as CSSProperties}>
            <path d={`M${C} ${C}V${C - STEP * rings.length - 4}`} />
            <path className={cls.needleTip} d={`M${C - 5} ${C - STEP * rings.length + 8}L${C} ${C - STEP * rings.length - 6}L${C + 5} ${C - STEP * rings.length + 8}Z`} />
          </g>
          {places.map((p) => {
            const [x, y] = at(p.at, radius[p.ring] ?? STEP);
            const on = marked.includes(p.id);
            return (
              <g key={p.id} className={cls.dot} data-on={on || undefined} style={{ '--d': `${((((p.at % 360) + 360) % 360) / 360) * 1.4}s` } as CSSProperties}>
                <circle className={cls.ping} cx={x.toFixed(1)} cy={y.toFixed(1)} r="9" />
                {pulse?.id === p.id && <circle key={pulse.n} className={cls.pulse} cx={x.toFixed(1)} cy={y.toFixed(1)} r="9" />}
                <circle className={cls.dotCore} cx={x.toFixed(1)} cy={y.toFixed(1)} r="7" />
              </g>
            );
          })}
          <circle className={cls.centreDot} cx={C} cy={C} r="5" />
        </svg>
        <span className={cls.centre} aria-hidden="true">
          {centre}
        </span>
        {places.map((p) => {
          const [x, y] = at(p.at, radius[p.ring] ?? STEP);
          const on = marked.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              className={cls.place}
              data-side={p.side}
              aria-pressed={on}
              style={{ left: `${(x / 4).toFixed(2)}%`, top: `${(y / 4).toFixed(2)}%` }}
              onClick={user(() => mark(p.id))}
            >
              <span>{p.name}</span>
            </button>
          );
        })}
      </div>
      <div className={cls.panel} aria-live="polite">
        {shown && (
          <p className={cls.focus} key={shown.id}>
            <i>{shown.area}</i>
            <b>{shown.name}</b>
            <span>{shown.detail}</span>
          </p>
        )}
        <a className={cls.send} href={href} data-press>
          <span>{names.length ? `${labels.askAbout} ${list(names, labels.and)}` : labels.askNone}</span>
          <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
            <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
          </svg>
        </a>
      </div>
    </div>
  );
}
