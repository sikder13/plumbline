'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface PourDoorOption {
  key: string;
  label: string;
  short: string;
  image: string;
  lines: string[];
}

function Icon({ kind, className }: { kind: string; className?: string }) {
  if (kind === 'fire')
    return (
      <svg className={className} viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
        <path d="M12 3c1 3.2 4.6 5 4.6 9.4A4.6 4.6 0 0 1 12 17a4.6 4.6 0 0 1-4.6-4.6c0-2 1-3.3 2-4.4.2 1.6.9 2.6 2 3 0-2.8-.4-5.2.6-8z" fill="currentColor" />
        <path d="M5 20.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg className={className} viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="4.2" fill="currentColor" />
      <path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Where to sit: a switch between the deck and the fire. The photograph, the light of the section and
 * the words change with it, and the choice is passed on to the postcard further down the page.
 */
export function PourDoor({
  heading,
  lead,
  label,
  options,
  pics,
  mark,
  cls,
}: {
  heading: string;
  lead: string;
  label: string;
  options: PourDoorOption[];
  pics: Record<string, ReactNode>;
  mark: ReactNode;
  cls: Record<'wrap' | 'head' | 'sw' | 'thumb' | 'pics' | 'pic' | 'ember' | 'text' | 'icon', string | undefined>;
}) {
  const [seat, setSeat] = useState(options[0]!.key);
  const wrap = useRef<HTMLDivElement>(null);
  const touched = useRef(false);

  // Until the visitor chooses, the day turns as they read on: the deck first, then the fire.
  useEffect(() => {
    const el = wrap.current;
    if (!el || options.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    let last = '';
    void import('motion').then(({ scroll }) => {
      if (cancelled) return;
      stop = scroll(
        (p: number) => {
          if (touched.current) return;
          const key = p > 0.47 ? options[1]!.key : options[0]!.key;
          if (key === last) return;
          last = key;
          setSeat(key);
        },
        { target: el, offset: ['start end', 'end start'] },
      );
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [options]);

  useEffect(() => {
    const on = (e: Event) => {
      const key = (e as CustomEvent<string>).detail;
      if (!options.some((o) => o.key === key)) return;
      touched.current = true;
      setSeat(key);
    };
    window.addEventListener('pour:seat-from-card', on);
    return () => window.removeEventListener('pour:seat-from-card', on);
  }, [options]);

  const choose = (key: string) => {
    touched.current = true;
    setSeat(key);
    window.dispatchEvent(new CustomEvent('pour:seat', { detail: key }));
  };
  const index = Math.max(0, options.findIndex((o) => o.key === seat));
  const current = options[index]!;

  return (
    <div ref={wrap} className={cls.wrap} data-seat={seat}>
      <header className={cls.head}>
        <h2 id="door-h">
          {mark}
          {heading}
        </h2>
        <p>{lead}</p>
      </header>
      <div className={cls.sw} role="group" aria-label={label} style={{ ['--at' as string]: index }}>
        <span className={cls.thumb} aria-hidden="true" />
        {options.map((o) => (
          <button key={o.key} type="button" aria-pressed={seat === o.key} onClick={() => choose(o.key)} data-press>
            <Icon kind={o.key} className={cls.icon} />
            {o.short}
          </button>
        ))}
      </div>
      <div className={cls.pics}>
        {options.map((o) => (
          <div key={o.key} className={cls.pic} data-on={seat === o.key ? '' : undefined} aria-hidden={seat === o.key ? undefined : true}>
            {pics[o.key]}
          </div>
        ))}
        <span className={cls.ember} aria-hidden="true" />
      </div>
      <div className={cls.text} aria-live="polite">
        <h3 key={current.key}>{current.label}</h3>
        {current.lines.map((l) => (
          <p key={`${current.key}-${l}`}>{l}</p>
        ))}
      </div>
    </div>
  );
}
