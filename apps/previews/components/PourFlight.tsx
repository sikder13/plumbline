'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export interface PourFlightWine {
  name: string;
  /** The colour of the wine in the glass. */
  liquid: string;
  /** A dark ground taken from the bottle's cap. */
  tint: string;
  /** The bottle in the photograph: left, top, width and height, as fractions of it. */
  box: number[];
}

type Cls = Record<'story' | 'head' | 'shop' | 'lead' | 'panel' | 'photo' | 'camera' | 'spot' | 'bar' | 'cup' | 'cupName' | 'plank' | 'hint' | 'glass' | 'glassBowl' | 'glassWine', string | undefined>;

/**
 * The line-up: their photograph of the bottles on the bar, and in front of it a paddle with one
 * glass standing below each of the five bottles. As the section passes, the glasses are poured one
 * by one in the order their homepage lists the wines; the newest lights its bottle and gives the
 * section its cap's colour. A glass is also a button that lights its bottle. Nothing holds still.
 */
export function PourFlight({
  wines,
  heading,
  lead,
  hint,
  shop,
  mark,
  photo,
  cls,
}: {
  wines: PourFlightWine[];
  heading: string;
  lead: string;
  hint: string;
  shop: { label: string; href: string };
  mark: ReactNode;
  photo: ReactNode;
  cls: Cls;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const touched = useRef(false);
  const [poured, setPoured] = useState(wines.length);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const o = outer.current;
    if (!o || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    let last = -1;
    void import('motion').then(({ scroll }) => {
      if (cancelled) return;
      stop = scroll(
        (p: number) => {
          if (touched.current) return;
          const n = Math.min(wines.length, Math.max(0, Math.round(p * wines.length)));
          if (n === last) return;
          last = n;
          setPoured(n);
          setActive(Math.max(0, n - 1));
        },
        { target: o, offset: ['start 0.7', 'end 0.95'] },
      );
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [wines.length]);

  const choose = (i: number) => {
    touched.current = true;
    setPoured(wines.length);
    setActive(i);
  };

  const w = wines[active]!;
  const [x, y, bw, bh] = w.box as [number, number, number, number];

  return (
    <div ref={outer} className={cls.story} style={{ '--tint': w.tint, '--liquid': w.liquid } as CSSProperties}>
      <header className={cls.head}>
        <h2 id="wines-h">
          {mark}
          {heading}
        </h2>
        <a className={cls.shop} href={shop.href} rel="noopener">
          {shop.label}
        </a>
      </header>
      <p className={cls.lead}>{lead}</p>
      <div className={cls.panel}>
        <div className={cls.photo}>
          <div className={cls.camera}>
            {photo}
            <span
              className={cls.spot}
              aria-hidden="true"
              style={{ left: `${(x * 100).toFixed(2)}%`, top: `${(y * 100).toFixed(2)}%`, width: `${(bw * 100).toFixed(2)}%`, height: `${(bh * 100).toFixed(2)}%` }}
            />
          </div>
        </div>
        <div className={cls.bar} role="group" aria-label={hint}>
          <span className={cls.plank} aria-hidden="true" />
          {wines.map((wine, i) => {
            const [bx, , bww] = wine.box as [number, number, number, number];
            return (
              <button
                key={wine.name}
                type="button"
                className={cls.cup}
                aria-pressed={i === active}
                data-poured={i < poured ? '' : undefined}
                onClick={() => choose(i)}
                style={{ '--liquid': wine.liquid, left: `${((bx + bww / 2) * 100).toFixed(2)}%` } as CSSProperties}
              >
                <span className={cls.glass} aria-hidden="true">
                  <span className={cls.glassBowl} style={{ clipPath: 'url(#pour-bowl)' }}>
                    <i className={cls.glassWine} />
                  </span>
                  <svg viewBox="0 0 200 360" focusable="false">
                    <use href="#pour-glass" />
                  </svg>
                </span>
                <span className={cls.cupName}>{wine.name}</span>
              </button>
            );
          })}
        </div>
      </div>
      <p className={cls.hint}>{hint}</p>
    </div>
  );
}
