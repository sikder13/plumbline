'use client';

import { useEffect } from 'react';

/** The ease used for everything that enters: quick away, long settle. */
const EASE = [0.22, 1, 0.36, 1] as const;
const SPRING = { type: 'spring', stiffness: 520, damping: 32 } as const;

/**
 * Motion that answers the visitor: content rising and photos wiping in as they arrive, numbers
 * counting up once, buttons that give under a press, and on large screens a smoother scroll with
 * photos travelling a little slower than the page. The libraries are fetched here, after the page
 * has painted. Without this component, or with reduced motion asked for, everything simply shows.
 */
export function MotionLayer() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const wide = window.matchMedia('(min-width: 900px)').matches;
    const undo: (() => void)[] = [];
    let stopped = false;

    void import('motion').then(({ animate, inView, scroll }) => {
      if (stopped) return;
      // Everything is measured first and changed afterwards. Measuring one element, restyling it and
      // measuring the next makes the browser lay the page out again each time.
      const all = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)];
      const edge = window.innerHeight * 0.9;
      const waiting = (els: HTMLElement[]) => els.filter((el) => el.getBoundingClientRect().top > edge);
      const reveals = waiting(all('[data-reveal]'));
      const wipes = waiting(all('[data-wipe]'));
      const counts = waiting(all('[data-count]'));

      for (const el of reveals) {
        el.style.opacity = '0';
        el.style.transform = 'translateY(16px)';
        undo.push(inView(el, () => void animate(el, { opacity: 1, y: [16, 0] }, { duration: 0.6, ease: EASE }), { amount: 0.2 }));
      }

      for (const el of wipes) {
        // The frame is watched and the picture inside it is wiped: a fully clipped element never counts as in view.
        const inner = el.querySelector<HTMLElement>('picture');
        const img = el.querySelector('img');
        if (!inner) continue;
        inner.style.clipPath = 'inset(0 0 100% 0)';
        undo.push(
          inView(
            el,
            () => {
              void animate(inner, { clipPath: ['inset(0 0 100% 0)', 'inset(0 0 0% 0)'] }, { duration: 0.8, ease: EASE });
              if (img) void animate(img, { scale: [1.14, 1] }, { duration: 1, ease: EASE });
            },
            { amount: 0.15 },
          ),
        );
      }

      for (const el of counts) {
        const m = /^(\D*)(\d+(?:\.\d+)?)(.*)$/.exec(el.textContent ?? '');
        if (!m) continue;
        const [, before, number, after] = m as unknown as [string, string, string, string];
        const places = number.split('.')[1]?.length ?? 0;
        el.style.fontVariantNumeric = 'tabular-nums';
        undo.push(inView(el, () => void animate(0, Number(number), { duration: 0.7, ease: EASE, onUpdate: (v) => void (el.textContent = `${before}${v.toFixed(places)}${after}`) }), { amount: 0.6 }));
      }

      for (const el of document.querySelectorAll<HTMLElement>('[data-press]')) {
        const down = () => void animate(el, { scale: 0.97 }, SPRING);
        const up = () => void animate(el, { scale: 1 }, SPRING);
        el.addEventListener('pointerdown', down);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointerleave', up);
        el.addEventListener('pointercancel', up);
        if (fine && el.hasAttribute('data-magnetic')) {
          const pull = (e: PointerEvent) => {
            const box = el.getBoundingClientRect();
            const x = Math.max(-8, Math.min(8, (e.clientX - (box.left + box.width / 2)) * 0.18));
            const y = Math.max(-6, Math.min(6, (e.clientY - (box.top + box.height / 2)) * 0.18));
            void animate(el, { x, y }, SPRING);
          };
          const rest = () => void animate(el, { x: 0, y: 0 }, { type: 'spring', stiffness: 260, damping: 18 });
          el.addEventListener('pointermove', pull);
          el.addEventListener('pointerleave', rest);
        }
      }

      if (wide) {
        for (const el of document.querySelectorAll<HTMLElement>('[data-parallax]')) {
          const frame = el.closest<HTMLElement>('[data-parallax-frame]') ?? el.parentElement!;
          undo.push(scroll(animate(el, { y: ['-5%', '5%'] }, { ease: 'linear' }), { target: frame, offset: ['start end', 'end start'] }));
        }
      }
    });

    // Smooth scrolling on large screens with a mouse or trackpad. Phones keep their own.
    if (wide && fine) {
      void import('lenis').then(({ default: Lenis }) => {
        if (stopped) return;
        const lenis = new Lenis({ lerp: 0.11, anchors: true });
        (window as Window & { __lenis?: unknown }).__lenis = lenis;
        let frame = requestAnimationFrame(function tick(time) {
          lenis.raf(time);
          frame = requestAnimationFrame(tick);
        });
        undo.push(() => {
          cancelAnimationFrame(frame);
          lenis.destroy();
        });
      });
    }

    return () => {
      stopped = true;
      for (const stop of undo) stop();
    };
  }, []);
  return null;
}

/** Scrolls the page to a position, through the smooth scroller where one is running. */
export function scrollPageTo(y: number): void {
  const lenis = (window as Window & { __lenis?: { scrollTo: (y: number) => void } }).__lenis;
  if (lenis) lenis.scrollTo(y);
  else window.scrollTo({ top: y, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
