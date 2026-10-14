'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export interface TrailheadWalk {
  name: string;
  time: string;
  priceLabel: string;
  price: string;
}

type Point = { x: number; y: number };
type Geometry = { w: number; h: number; all: string; routes: string[]; lengths: number[]; allLength: number };

/**
 * The opening's signpost, planted in the scene: a post with one fingerboard for each walk, pointing
 * this way and that. A lace runs from the end of the headline (`[data-trail-start]`) to the top of the
 * post (`[data-trail-end]`), dashed, with an orange route drawn over it as the page opens and a marker
 * that walks it. Choosing a board draws the route to that board's tip (`[data-mark]`) instead and wipes
 * the photograph over to that walk. Until someone chooses, each walk is shown once in turn while the
 * opening is in view. The first photograph is the page's opening image; the others are asked for only
 * once the page has loaded.
 */
export function AfootTrailhead({ walks, pictures, label, cls }: { walks: TrailheadWalk[]; pictures: ReactNode[]; label: string; cls: { photos?: string; photo?: string; trail?: string; walker?: string; sign?: string; board?: string } }) {
  // -1: no walk chosen, the opening photograph and the route past every board.
  const [cur, setCur] = useState(-1);
  const [was, setWas] = useState(-1);
  const [ready, setReady] = useState(false);
  const [geo, setGeo] = useState<Geometry | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const touched = useRef(false);
  const curRef = useRef(-1);

  useEffect(() => {
    const el = svg.current;
    const hero = el?.closest<HTMLElement>('[data-hero]');
    if (!el || !hero) return;
    const scratch = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    el.appendChild(scratch);
    const length = (d: string) => {
      scratch.setAttribute('d', d);
      return scratch.getTotalLength();
    };
    const measure = () => {
      const hb = hero.getBoundingClientRect();
      const start = hero.querySelector('[data-trail-start]');
      const end = hero.querySelector('[data-trail-end]');
      const marks = [...hero.querySelectorAll('[data-mark]')];
      if (!start || !end || !marks.length || !hb.width) return;
      const at = (r: DOMRect, fx: number, fy: number): Point => ({ x: r.left - hb.left + r.width * fx, y: r.top - hb.top + r.height * fy });
      const s = at(start.getBoundingClientRect(), 1, 0.5);
      s.x += 6;
      const m = marks.map((mk) => at(mk.getBoundingClientRect(), 0.5, 0.5));
      const e = at(end.getBoundingClientRect(), 0.5, 0.5);
      const f = (n: number) => n.toFixed(1);
      // Out of the full stop, along and then down into the point, as a lace falls.
      const to = (p: Point) => {
        const dy = Math.max(40, p.y - s.y);
        const reach = Math.max(60, Math.abs(p.x - s.x));
        return `M${f(s.x)} ${f(s.y)} C${f(Math.min(hb.width - 14, s.x + reach * 0.6))} ${f(s.y + dy * 0.05)} ${f(p.x + (p.x > s.x ? 30 : -30))} ${f(p.y - dy * 0.75)} ${f(p.x)} ${f(p.y)}`;
      };
      const all = to(e);
      const routes = m.map(to);
      setGeo({ w: hb.width, h: hb.height, all, routes, lengths: routes.map(length), allLength: length(all) });
    };
    const ro = new ResizeObserver(() => measure());
    ro.observe(hero);
    void document.fonts?.ready.then(measure);
    measure();
    // The headline rises into place as the page opens, so the track is measured again once it has settled.
    const later = [800, 1700].map((ms) => window.setTimeout(measure, ms));
    return () => {
      ro.disconnect();
      for (const t of later) window.clearTimeout(t);
      scratch.remove();
    };
  }, []);

  // After the page has loaded, the other photographs are asked for, and each walk is shown once in turn.
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let timer = 0;
    let wait = 0;
    let shown = 0;
    let visible = true;
    const hero = svg.current?.closest('[data-hero]');
    const io = hero ? new IntersectionObserver(([e]) => void (visible = !!e?.isIntersecting), { threshold: 0.5 }) : null;
    if (hero && io) io.observe(hero);
    const start = () => {
      wait = window.setTimeout(() => {
        setReady(true);
        if (reduce) return;
        timer = window.setInterval(() => {
          if (touched.current || !visible) return;
          if (shown >= walks.length) return window.clearInterval(timer);
          const next = shown;
          shown += 1;
          choose(next);
        }, 3200);
      }, 1400);
    };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
    return () => {
      window.removeEventListener('load', start);
      window.clearTimeout(wait);
      window.clearInterval(timer);
      io?.disconnect();
    };
  }, [walks.length]);

  const choose = (i: number) => {
    const c = curRef.current;
    if (c === i) return;
    curRef.current = i;
    setWas(c);
    setCur(i);
  };
  const pick = (i: number) => {
    touched.current = true;
    setReady(true);
    choose(i);
  };

  const d = geo ? (cur < 0 ? geo.all : geo.routes[cur]!) : '';
  const len = geo ? (cur < 0 ? geo.allLength : geo.lengths[cur]!) : 0;
  const layer = (i: number) => i + 1;
  return (
    <>
      <div className={cls.photos} data-live={cur >= 0 ? '' : undefined}>
        {pictures.map((p, i) => (
          <div key={i} className={cls.photo} data-on={layer(cur) === i ? '' : undefined} data-was={layer(was) === i && layer(cur) !== i ? '' : undefined} aria-hidden={layer(cur) === i ? undefined : true}>
            {(i === 0 || ready) && p}
          </div>
        ))}
      </div>
      <svg ref={svg} className={cls.trail} viewBox={geo ? `0 0 ${geo.w.toFixed(0)} ${geo.h.toFixed(0)}` : undefined} data-drawn={geo ? '' : undefined} aria-hidden="true" focusable="false">
        {geo && (
          <>
            <path data-shade d={geo.all} />
            <path data-base d={geo.all} />
            <path key={`r${cur}`} data-route d={d} style={{ '--len': len.toFixed(1) } as CSSProperties} />
          </>
        )}
      </svg>
      {geo && <i key={`w${cur}`} className={cls.walker} aria-hidden="true" style={{ offsetPath: `path('${d}')` } as CSSProperties} />}
      <div className={cls.sign} role="group" aria-label={label}>
        <span data-post aria-hidden="true">
          <i data-trail-end />
        </span>
        <ul>
          {walks.map((w, i) => (
            <li key={w.name}>
              <button type="button" className={cls.board} aria-pressed={i === cur} onClick={() => pick(i)}>
                <span data-name>{w.name}</span>
                <span data-time>{w.time}</span>
                <span data-price>
                  <small>{w.priceLabel}</small> {w.price}
                </span>
                <i data-mark aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
