'use client';

import { useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';

export interface GalaxyRoute {
  id: string;
  label: string;
  sub: string;
  /** The way the visitor sets off: north, south, east or west. */
  heading: string;
  turns: { dir: string; text: string }[];
}

type Names = 'way' | 'ask' | 'ways' | 'wayOption' | 'routes' | 'turns' | 'sketch' | 'sketchNote';

const START: Record<string, [number, number]> = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };

/**
 * The turns drawn as a line, the way a map would, from nothing but the words: ahead goes on, right and
 * left turn a quarter, and a turn that does not say which way is left as a dotted step.
 */
function Sketch({ route, note, cls }: { route: GalaxyRoute; note: string; cls: Record<Names, string | undefined> }) {
  let [dx, dy] = START[route.heading] ?? [0, 1];
  let x = 0;
  let y = 0;
  const pts: { x: number; y: number; dir: string; dotted: boolean }[] = [{ x, y, dir: 'start', dotted: false }];
  for (const t of route.turns) {
    if (t.dir === 'right') [dx, dy] = [-dy, dx];
    if (t.dir === 'left') [dx, dy] = [dy, -dx];
    // A turn that does not say which way is marked where it happens, and the line goes no further.
    if (t.dir === 'end' || t.dir === 'turn') {
      if (t.dir === 'turn') pts[pts.length - 1]!.dotted = true;
      continue;
    }
    const len = t.dir === 'ahead' ? 64 : 76;
    x += dx * len;
    y += dy * len;
    pts.push({ x, y, dir: t.dir, dotted: false });
  }
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const pad = 24;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const w = Math.max(...xs) - Math.min(...xs) + pad * 2;
  const h = Math.max(...ys) - Math.min(...ys) + pad * 2;
  return (
    <figure className={cls.sketch} aria-hidden="true">
      <svg viewBox={`${minX} ${minY} ${w} ${h}`} width={w} height={h} focusable="false">
        {pts.slice(1).map((p, i) => {
          const a = pts[i]!;
          return <path key={i} d={`M${a.x} ${a.y}L${p.x} ${p.y}`} pathLength={1} style={{ '--k': i } as CSSProperties} />;
        })}
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 7 : 4.5} data-end={i === pts.length - 1 ? '' : undefined} data-open={p.dotted ? '' : undefined} style={{ '--k': i } as CSSProperties} />
        ))}
      </svg>
      <figcaption className={cls.sketchNote}>{note}</figcaption>
    </figure>
  );
}

/**
 * The way there in the business's own turns, for whichever direction the visitor is coming from. Each
 * route hangs down a thread with a bead at every turn and the address glowing at its end.
 */
export function GalaxyWays({ routes, ask, note, icons, cls }: { routes: GalaxyRoute[]; ask: string; note: string; icons: Record<string, ReactNode>; cls: Record<Names, string | undefined> }) {
  const [sel, setSel] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const key = (e: KeyboardEvent<HTMLButtonElement>) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (sel + step + routes.length) % routes.length;
    setSel(next);
    tabs.current[next]?.focus();
  };
  return (
    <div className={cls.way}>
      <p className={cls.ask} id="galaxy-ways-ask">
        {ask}
      </p>
      <div className={cls.ways} role="tablist" aria-labelledby="galaxy-ways-ask">
        {routes.map((r, i) => (
          <button
            key={r.id}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`galaxy-way-${r.id}`}
            aria-selected={i === sel}
            aria-controls={`galaxy-route-${r.id}`}
            tabIndex={i === sel ? 0 : -1}
            className={cls.wayOption}
            onClick={() => setSel(i)}
            onKeyDown={key}
          >
            <span>{r.label}</span>
            <small>{r.sub}</small>
          </button>
        ))}
      </div>
      <div className={cls.routes}>
        {routes.map((r, i) => (
          <div key={r.id} id={`galaxy-route-${r.id}`} role="tabpanel" aria-labelledby={`galaxy-way-${r.id}`} hidden={i !== sel}>
            <Sketch route={r} note={note} cls={cls} />
            <ol className={cls.turns}>
              {r.turns.map((t, k) => (
                <li key={t.text} data-dir={t.dir} style={{ '--k': k } as CSSProperties}>
                  {icons[t.dir] ?? icons.ahead}
                  <span>{t.text}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}
