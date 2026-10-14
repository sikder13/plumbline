'use client';

import { useEffect, useRef, type CSSProperties } from 'react';

/**
 * A river run told by a drawing held on screen: the river seen from above, its banks drawn as contour
 * lines, and a boat that keeps its place on the screen while the river slides under it as the visitor
 * scrolls. Each step changes the drawing itself: the lines close in on the river, then open out, and at
 * the end the boat turns a full circle. Before the script arrives, and with reduced motion asked for,
 * the first state shows and every step is listed.
 */

interface Step {
  title: string;
  text: string;
}

interface Props {
  id: string;
  heading: string;
  steps: Step[];
  marks: { wharf: string; track: string; places: string[] };
  spin: { value: string; label: string };
  cls: Partial<Record<'run' | 'frame' | 'scene' | 'copy' | 'head' | 'steps' | 'turn' | 'turnValue' | 'turnLabel' | 'line' | 'lines' | 'bed' | 'body' | 'shine' | 'isle' | 'rapid' | 'label' | 'track' | 'wharf' | 'boat' | 'spinner' | 'ring' | 'wake' | 'hull', string>>;
}

/** The drawing is 800 units tall; its width follows the screen. The boat holds this height on screen. */
const VIEW_H = 800;
const CX = 300;
const BOAT_Y = 470;
/** How far down the river the drawing travels over the whole section. */
const TRAVEL = 1500;
const TOP = -160;
const BOTTOM = BOAT_Y + TRAVEL + (VIEW_H - BOAT_Y) + 160;
const PER_SIDE = 24;
const HALF = 33;

function riverX(y: number): number {
  return CX + 88 * Math.sin(y / 240 + 0.6) + 30 * Math.sin(y / 96 + 1.7);
}

function slope(y: number): number {
  return (88 / 240) * Math.cos(y / 240 + 0.6) + (30 / 96) * Math.cos(y / 96 + 1.7);
}

function line(from: number, to: number, step = 12, shift = 0): string {
  const pts: string[] = [];
  for (let y = from; y <= to; y += step) pts.push(`${(riverX(y) + shift).toFixed(1)} ${y}`);
  return `M${pts.join('L')}`;
}

/** A point beside the river at a height, `side` units from the centre line, measured square to the flow. */
function beside(y: number, side: number): [number, number] {
  const d = slope(y);
  const n = Math.hypot(1, d);
  return [riverX(y) + side / n, y - (side * d) / n];
}

const RIVER = line(TOP, BOTTOM);
const BED = line(1560, 2200, 12);
const SHINE = line(TOP, BOTTOM, 12, -9);

/** White water: small chevrons across the flow, pointing downstream. */
const RAPIDS = (() => {
  const out: string[] = [];
  for (let y = 1090; y <= 1330; y += 24) {
    for (const off of [-14, 6]) {
      const yy = y + off * 0.6;
      const d = slope(yy);
      const n = Math.hypot(1, d);
      const [tx, ty] = [d / n, 1 / n];
      const [nx, ny] = [1 / n, -d / n];
      const [cx, cy] = beside(yy, off);
      const w = 9;
      out.push(`M${(cx - nx * w).toFixed(1)} ${(cy - ny * w).toFixed(1)}L${(cx + tx * 6).toFixed(1)} ${(cy + ty * 6).toFixed(1)}L${(cx + nx * w).toFixed(1)} ${(cy + ny * w).toFixed(1)}`);
    }
  }
  return out.join('');
})();

/** Gravel islands in the braided reach, laid along the flow. */
const ISLES: { x: number; y: number; rx: number; ry: number; a: number }[] = [
  [1650, -12, 7, 40],
  [1730, 13, 6, 34],
  [1820, -6, 9, 50],
  [1905, 14, 7, 36],
  [1990, -13, 8, 46],
  [2080, 9, 7, 38],
].map(([y, side, rx, ry]) => {
  const [x, yy] = beside(y!, side!);
  return { x, y: yy, rx: rx!, ry: ry!, a: (-Math.atan(slope(y!)) * 180) / Math.PI };
});

const PLACE_Y = [820, 1210, 1800];

function boatAt(offset: number): string {
  const y = BOAT_Y + offset;
  const a = (-Math.atan(slope(y)) * 180) / Math.PI;
  return `translate(${riverX(y).toFixed(2)} ${BOAT_Y}) rotate(${a.toFixed(2)})`;
}

export function SpinRun({ id, heading, steps, marks, spin, cls }: Props) {
  const outer = useRef<HTMLElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const world = useRef<SVGGElement>(null);
  const boat = useRef<SVGGElement>(null);

  useEffect(() => {
    const o = outer.current;
    const s = svg.current;
    if (!o || !s) return;
    const frame = s.parentElement!;
    const fit = () => {
      const r = frame.getBoundingClientRect();
      if (!r.height) return;
      // Wide screens see a closer view, so the river and the boat keep their weight.
      const h = r.width >= 900 ? VIEW_H * 0.8 : VIEW_H;
      const top = (VIEW_H - h) / 2;
      const w = (h * r.width) / r.height;
      s.setAttribute('viewBox', `${(CX - w / 2).toFixed(1)} ${top} ${w.toFixed(1)} ${h}`);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(frame);
    // Photographs further down are asked for once the page has settled, so none arrives blank.
    const wake = window.setTimeout(() => {
      for (const img of document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]')) img.loading = 'eager';
    }, 2600);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      return () => {
        window.clearTimeout(wake);
        ro.disconnect();
      };

    let stop: (() => void) | undefined;
    let cancelled = false;
    let last = -1;
    let spun = false;
    const n = steps.length;
    const marksEls = [...o.querySelectorAll<HTMLElement>('[data-step]')];
    const apply = (p: number) => {
      const offset = p * TRAVEL;
      if (world.current) world.current.style.transform = `translateY(${(-offset).toFixed(1)}px)`;
      boat.current?.setAttribute('transform', boatAt(offset));
      const i = Math.min(n - 1, Math.max(0, Math.floor(p * n)));
      if (i !== last) {
        last = i;
        o.setAttribute('data-active', String(i));
        for (const m of marksEls) {
          const k = Number(m.dataset.step);
          m.dataset.state = k === i ? 'on' : k < i ? 'done' : 'off';
        }
      }
      if (!spun && p > 0.74) {
        spun = true;
        o.setAttribute('data-spun', '');
      } else if (spun && p < 0.6) {
        spun = false;
        o.removeAttribute('data-spun');
      }
    };
    void import('motion').then(({ scroll }) => {
      if (cancelled) return;
      stop = scroll(apply, { target: o, offset: ['start start', 'end end'] });
    });
    return () => {
      cancelled = true;
      window.clearTimeout(wake);
      stop?.();
      ro.disconnect();
    };
  }, [steps.length]);

  const [wx, wy] = beside(BOAT_Y, -HALF - 4);
  const trackStart: [number, number] = [wx - 150, 150];
  const lines = [];
  for (const side of [-1, 1]) for (let k = 0; k < PER_SIDE; k++) lines.push({ side, k });

  return (
    <section ref={outer} id={id} className={cls.run} aria-labelledby={`${id}-h`} data-active="0" style={{ '--steps': steps.length } as CSSProperties}>
      <div className={cls.frame}>
        <div className={cls.scene} aria-hidden="true">
          <svg ref={svg} viewBox={`107 0 386 ${VIEW_H}`} preserveAspectRatio="xMidYMid slice" focusable="false">
            <defs>
              <path id={`${id}-line`} d={RIVER} className={cls.line} />
            </defs>
            <g ref={world}>
              <g className={cls.lines}>
                {lines.map(({ side, k }) => (
                  <use key={`${side}${k}`} href={`#${id}-line`} style={{ '--side': side, '--k': k } as CSSProperties} />
                ))}
              </g>
              <path className={cls.bed} d={BED} />
              <path className={cls.body} d={RIVER} />
              <path className={cls.shine} d={SHINE} />
              {ISLES.map((s, i) => (
                <ellipse key={i} className={cls.isle} cx={s.x.toFixed(1)} cy={s.y.toFixed(1)} rx={s.rx} ry={s.ry} transform={`rotate(${s.a.toFixed(1)} ${s.x.toFixed(1)} ${s.y.toFixed(1)})`} />
              ))}
              <path className={cls.rapid} d={RAPIDS} />
              <path className={cls.track} d={`M${trackStart[0].toFixed(1)} ${trackStart[1]}C${(wx - 40).toFixed(1)} 210 ${(wx - 140).toFixed(1)} ${(wy - 90).toFixed(1)} ${(wx - 34).toFixed(1)} ${wy.toFixed(1)}`} />
              <rect className={cls.wharf} x={(wx - 36).toFixed(1)} y={(wy - 7).toFixed(1)} width="38" height="14" rx="2" />
              <text className={cls.label} x={(wx - 112).toFixed(1)} y={(wy - 96).toFixed(1)} textAnchor="end">
                {marks.track}
              </text>
              <text className={cls.label} x={(wx - 44).toFixed(1)} y={(wy + 30).toFixed(1)} textAnchor="end">
                {marks.wharf}
              </text>
              {marks.places.map((m, i) => {
                const y = PLACE_Y[i] ?? 820 + i * 400;
                const left = riverX(y) > CX;
                const x = riverX(y) + (left ? -58 : 58);
                return (
                  <text key={m} className={cls.label} x={x.toFixed(1)} y={y} textAnchor={left ? 'end' : 'start'}>
                    {m}
                  </text>
                );
              })}
            </g>
            <g ref={boat} className={cls.boat} transform={boatAt(0)}>
              <g className={cls.spinner}>
                {/* An unpainted circle centres the turning group's box on the boat. */}
                <circle r="124" fill="none" />
                <circle className={cls.ring} r="52" />
                <path className={cls.wake} d="M-10 -18L-36 -104M10 -18L36 -104M0 -20V-120" />
                <path className={cls.hull} d="M-12 -21H12L14 3L0 25L-14 3Z" />
                <rect x="-8" y="-13" width="16" height="4" rx="1" fill="#f5faf8" />
              </g>
            </g>
          </svg>
        </div>
        <div className={cls.copy}>
          <h2 id={`${id}-h`} className={cls.head}>
            {heading}
          </h2>
          <ol className={cls.steps}>
            {steps.map((st, i) => (
              <li key={st.title} data-step={i} data-state={i === 0 ? 'on' : 'off'}>
                <h3>{st.title}</h3>
                <p>{st.text}</p>
              </li>
            ))}
          </ol>
        </div>
        <p className={cls.turn}>
          <b className={cls.turnValue}>{spin.value}</b>
          <span className={cls.turnLabel}>{spin.label}</span>
        </p>
      </div>
    </section>
  );
}
