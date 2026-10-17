'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

type Names = 'lens' | 'lensInner' | 'lamp' | 'hint' | 'hintTouch' | 'hintPointer' | 'controls';

/**
 * Your head torch in the dark cave. Once the lights are out, the pointer (or a tap on a phone) shines
 * a circle of light that shows the real rock under it, and a button switches your lamp back on for
 * the whole frame. The section it sits in is told with `data-lamp`. Nothing here is needed to read
 * the section: with reduced motion asked for, both pictures simply show.
 */
export function GalaxyTorch({ picture, labels, hint, cls }: { picture: ReactNode; labels: { on: string; off: string }; hint: { touch: string; pointer: string }; cls: Record<Names, string | undefined> }) {
  const lens = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const [lamp, setLamp] = useState(false);

  useEffect(() => {
    const section = lens.current?.closest('section');
    if (!section) return;
    if (lamp) section.setAttribute('data-lamp', 'on');
    else section.removeAttribute('data-lamp');
  }, [lamp]);

  useEffect(() => {
    const l = lens.current;
    const i = inner.current;
    const media = l?.parentElement;
    if (!l || !i || !media) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let timer = 0;
    const size = () => {
      i.style.width = `${media.clientWidth}px`;
      i.style.height = `${media.clientHeight}px`;
    };
    const dark = () => {
      const story = media.closest('[data-active]');
      return story?.getAttribute('data-active') !== '0' && !media.closest('section')?.hasAttribute('data-lamp');
    };
    const show = (x: number, y: number) => {
      if (!dark()) return hide();
      const r = l.offsetWidth / 2;
      l.style.transform = `translate3d(${(x - r).toFixed(1)}px, ${(y - r).toFixed(1)}px, 0)`;
      i.style.transform = `translate3d(${(r - x).toFixed(1)}px, ${(r - y).toFixed(1)}px, 0)`;
      l.setAttribute('data-show', '');
    };
    const hide = () => l.removeAttribute('data-show');
    const at = (e: PointerEvent) => {
      const box = media.getBoundingClientRect();
      return [e.clientX - box.left, e.clientY - box.top] as const;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const [x, y] = at(e);
      show(x, y);
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      if ((e.target as HTMLElement).closest('button, a')) return;
      const [x, y] = at(e);
      show(x, y);
      window.clearTimeout(timer);
      timer = window.setTimeout(hide, 1800);
    };
    size();
    window.addEventListener('resize', size);
    media.addEventListener('pointermove', move);
    media.addEventListener('pointerleave', hide);
    media.addEventListener('pointerdown', down);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', size);
      media.removeEventListener('pointermove', move);
      media.removeEventListener('pointerleave', hide);
      media.removeEventListener('pointerdown', down);
    };
  }, []);

  return (
    <>
      <span ref={lens} className={cls.lens} aria-hidden="true">
        <span ref={inner} className={cls.lensInner}>
          {picture}
        </span>
      </span>
      <span className={cls.controls}>
        <button type="button" className={cls.lamp} aria-pressed={lamp} onClick={() => setLamp((v) => !v)} data-press>
          <i aria-hidden="true" />
          {lamp ? labels.off : labels.on}
        </button>
        <span className={cls.hint}>
          <span className={cls.hintTouch}>{hint.touch}</span>
          <span className={cls.hintPointer}>{hint.pointer}</span>
        </span>
      </span>
    </>
  );
}
