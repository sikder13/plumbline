'use client';

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { areaPath, linePath, spread } from './SkylineShape';

export interface Way {
  key: string;
  tab: string;
  tag: string;
  effort: string;
  name: string;
  line: string;
  chips: string[];
  prices: { value: string; label: string }[];
  figure: string;
  shape: number[];
  marks: { i: number; name: string }[];
}

type Cls = Record<'ways' | 'tabs' | 'tab' | 'spark' | 'tabName' | 'tabTag' | 'panel' | 'chart' | 'chartSvg' | 'area' | 'line' | 'base' | 'marks' | 'figure' | 'body' | 'copy' | 'name' | 'line2' | 'chips' | 'deal' | 'prices' | 'go' | 'rates' | 'ask', string | undefined>;

/** The profile of each way, closed under its line, for the chart and the little one on its tab. */
const shapeOf = (w: Way) => spread(w.shape);

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Three ways to the same place, told by how hard the walking is. Choosing one redraws a single
 * profile (its line and the ground under it move to the new shape) and sets out that trip's own
 * hours, group size, season and prices beside the booking button. When it first comes into view it
 * shows each way once on its own, then waits for the visitor.
 */
export function SkylineWays({ ways, book, rates, ask, label, cls }: { ways: Way[]; book: { label: string; href: string }; rates: string; ask: { label: string; href: string }; label: string; cls: Cls }) {
  const [on, setOn] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const touched = useRef(false);

  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timers: number[] = [];
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        const order = ways.map((_, i) => i).slice(1).concat(0);
        order.forEach((i, n) =>
          timers.push(
            window.setTimeout(() => {
              if (touched.current) return;
              setOn(i);
              window.dispatchEvent(new CustomEvent('skyline:way', { detail: i }));
            }, 420 + n * 760),
          ),
        );
      },
      { threshold: 0.45 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [ways]);

  const pick = (i: number) => {
    touched.current = true;
    setOn(i);
    window.dispatchEvent(new CustomEvent('skyline:way', { detail: i }));
  };

  const keys = (e: KeyboardEvent, i: number) => {
    const n = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!n) return;
    e.preventDefault();
    const next = (i + n + ways.length) % ways.length;
    pick(next);
    root.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };

  const w = ways[on]!;
  const pts = shapeOf(w);
  const area = areaPath(pts, 100);
  const line = linePath(pts);

  return (
    <div ref={root} className={cls.ways} data-way={w.key}>
      <div className={cls.tabs} role="tablist" aria-label={label}>
        {ways.map((x, i) => (
          <button key={x.key} type="button" role="tab" id={`way-${x.key}`} aria-selected={i === on} aria-controls="way-panel" tabIndex={i === on ? 0 : -1} className={cls.tab} onClick={() => pick(i)} onKeyDown={(e) => keys(e, i)} data-press>
            <svg className={cls.spark} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
              <path d={areaPath(shapeOf(x), 100)} />
              <path d={linePath(shapeOf(x))} />
            </svg>
            <span className={cls.tabName}>{x.tab}</span>
            <span className={cls.tabTag}>{x.effort}</span>
          </button>
        ))}
      </div>

      <div className={cls.panel} role="tabpanel" id="way-panel" aria-labelledby={`way-${w.key}`}>
        <div className={cls.chart} aria-hidden="true">
          <svg className={cls.chartSvg} viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
            <path className={cls.area} d={area} style={{ d: `path("${area}")` } as CSSProperties} />
            <path className={cls.base} d="M0 100H100" />
            <path className={cls.line} d={line} style={{ d: `path("${line}")` } as CSSProperties} />
          </svg>
          <ul className={cls.marks}>
            {ways.flatMap((x) =>
              x.marks.map((m, j) => (
                <li
                  key={`${x.key}-${m.name}`}
                  data-on={x.key === w.key ? '' : undefined}
                  data-edge={m.i <= 1 ? 'start' : m.i >= x.shape.length - 3 ? 'end' : undefined}
                  style={{ '--x': `${(m.i / (x.shape.length - 1)) * 100}%`, '--y': `${x.shape[m.i]}%`, '--row': x.marks.length > 2 ? j % 2 : 0 } as CSSProperties}
                >
                  {m.name}
                </li>
              )),
            )}
          </ul>
          <p className={cls.figure} key={w.key}>
            {w.figure}
          </p>
        </div>

        <div className={cls.body}>
          <div className={cls.copy} key={w.key}>
            <p className={cls.tabTag}>{w.tag}</p>
            <h3 className={cls.name}>{w.name}</h3>
            <p className={cls.line2}>{w.line}</p>
            <ul className={cls.chips}>
              {w.chips.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
          <div className={cls.deal}>
            <p className={cls.prices} key={w.key}>
              {w.prices.map((p) => (
                <span key={p.label}>
                  <b>{p.value}</b> {p.label}
                </span>
              ))}
            </p>
            <a className={cls.go} href={book.href} rel="noopener" data-press data-magnetic>
              {book.label}
              <Arrow />
            </a>
          </div>
          <p className={cls.rates}>
            {rates}{' '}
            <a className={cls.ask} href={ask.href}>
              {ask.label}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
