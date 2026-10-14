'use client';

import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export interface PourCardOption {
  label: string;
  say: string;
  key?: string;
}

export interface PourCardGroup {
  label: string;
  many?: boolean;
  options: PourCardOption[];
}

export interface PourCardContent {
  heading: string;
  lead: string;
  hint: string;
  done: string;
  to: string[];
  postmark: string;
  stampLabel: string;
  /** In the order they are offered: each is one choice, or several where `many` is set. */
  groups: Record<string, PourCardGroup>;
  greeting: string;
  /** With a {name} for each group's choice. */
  message: string;
  ask: string;
  thanks: string;
  subject: string;
  and: string;
  send: string;
  sending: string;
  or: string;
  /** The card's picture: one for when a platter is on the card, one otherwise. */
  pictures: Record<'platter' | 'default', { image: string; caption: string }>;
}

/** "a", "a and b", "a, b and c". */
function list(items: string[], and: string): string {
  if (items.length < 2) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`;
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? '');
}

const START: Record<string, number[]> = { how: [0], when: [0], what: [0], seat: [0], who: [1] };

type Cls = Record<
  'wrap' | 'hint' | 'post' | 'picture' | 'pic' | 'caption' | 'message' | 'slot' | 'options' | 'chips' | 'side' | 'stamp' | 'stampWord' | 'postmark' | 'to' | 'send' | 'go' | 'or' | 'doneBtn',
  string | undefined
>;

/**
 * A postcard to the owners that writes itself. Every blank in the message is a button: tapped, its
 * choices open inside the card and the words change in place. A platter on the card turns its picture
 * to the platter; the month is struck into the postmark. Once in view it shows itself once. The button
 * opens the visitor's own email with the card's words in it, to the address the business publishes.
 * Nothing is sent from the page.
 */
export function PourCard({
  content,
  email,
  call,
  pictures,
  stamp,
  cls,
}: {
  content: PourCardContent;
  email: string;
  call: { tel: string; display: string };
  pictures: Record<'platter' | 'default', ReactNode>;
  stamp: ReactNode;
  cls: Cls;
}) {
  const names = Object.keys(content.groups);
  const [picks, setPicks] = useState<Record<string, number[]>>(() => Object.fromEntries(names.map((n) => [n, START[n] ?? [0]])));
  const [open, setOpen] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  // 'idle' before the scripts run (the card simply shows), 'armed' until it is seen, then 'in' as it writes itself, then 'live'.
  const [phase, setPhase] = useState<'idle' | 'armed' | 'in' | 'live'>('idle');
  const post = useRef<HTMLDivElement>(null);
  const touched = useRef(false);

  // The month starts at the visitor's own month in New Zealand, where it falls inside the season.
  useEffect(() => {
    const when = content.groups.when;
    if (!when) return;
    const month = new Intl.DateTimeFormat('en-NZ', { timeZone: 'Pacific/Auckland', month: 'long' }).format(new Date());
    const at = when.options.findIndex((o) => o.say === month);
    if (at >= 0) setPicks((p) => ({ ...p, when: [at] }));
  }, [content.groups.when]);

  // Choosing the deck or the fire higher up the page carries down to the card.
  useEffect(() => {
    const seat = content.groups.seat;
    if (!seat) return;
    const on = (e: Event) => {
      const at = seat.options.findIndex((o) => o.key === (e as CustomEvent<string>).detail);
      if (at >= 0) setPicks((p) => ({ ...p, seat: [at] }));
    };
    window.addEventListener('pour:seat', on);
    return () => window.removeEventListener('pour:seat', on);
  }, [content.groups.seat]);

  // Seen for the first time, the card writes itself, then shows once how a blank changes: a platter is added.
  useEffect(() => {
    const el = post.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setPhase('armed');
    const timers: number[] = [];
    const later = (ms: number, f: () => void) => timers.push(window.setTimeout(f, ms));
    const what = content.groups.what;
    const platter = what ? what.options.findIndex((o) => o.key === 'platter') : -1;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        setPhase('in');
        later(2000, () => setPhase('live'));
        if (platter < 0) return;
        later(1700, () => !touched.current && setOpen('what'));
        later(2300, () => !touched.current && setPicks((p) => ({ ...p, what: [...new Set([...(p.what ?? []), platter])].sort((a, b) => a - b) })));
        later(3400, () => !touched.current && setOpen(null));
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      for (const t of timers) window.clearTimeout(t);
    };
  }, [content.groups.what]);

  const say = (name: string) => {
    const g = content.groups[name]!;
    return list((picks[name] ?? []).map((i) => g.options[i]!.say), content.and);
  };
  const values = Object.fromEntries(names.map((n) => [n, say(n)]));
  const month = content.groups.when?.options[picks.when?.[0] ?? 0];
  const platterOn = (picks.what ?? []).some((i) => content.groups.what?.options[i]?.key === 'platter');
  const picture = platterOn ? 'platter' : 'default';

  const href = useMemo(() => {
    const body = [content.greeting, fill(content.message, values), content.ask, content.thanks].join('\n\n');
    return `mailto:${email}?subject=${encodeURIComponent(fill(content.subject, values))}&body=${encodeURIComponent(body)}`;
    // The values are rebuilt from the picks each render.
  }, [picks, content, email]);

  const choose = (name: string, i: number) => {
    touched.current = true;
    const g = content.groups[name]!;
    setPicks((p) => {
      const now = p[name] ?? [];
      if (!g.many) return { ...p, [name]: [i] };
      if (now.includes(i)) return now.length > 1 ? { ...p, [name]: now.filter((x) => x !== i) } : p;
      return { ...p, [name]: [...now, i].sort((a, b) => a - b) };
    });
    if (!g.many) setOpen(null);
    if (name === 'seat') {
      const key = g.options[i]?.key;
      if (key) window.dispatchEvent(new CustomEvent('pour:seat-from-card', { detail: key }));
    }
  };

  const parts = content.message.split(/(\{\w+\})/).filter(Boolean);
  const group = open ? content.groups[open] : undefined;
  let n = 0;

  return (
    <div className={cls.wrap}>
      <p className={cls.hint}>{content.hint}</p>
      <div ref={post} className={cls.post} data-sent={sent ? '' : undefined} data-phase={phase} data-picture={picture}>
        <figure className={cls.picture}>
          {(['default', 'platter'] as const).map((k) => (
            <div key={k} className={cls.pic} data-on={picture === k ? '' : undefined} aria-hidden={picture === k ? undefined : true}>
              {pictures[k]}
            </div>
          ))}
          <figcaption className={cls.caption} key={picture}>
            {content.pictures[picture].caption}
          </figcaption>
        </figure>
        <div className={cls.message}>
          <p>{content.greeting}</p>
          <p aria-live="polite">
            {parts.map((part, i) => {
              const m = /^\{(\w+)\}$/.exec(part);
              if (!m) return <Fragment key={i}>{part}</Fragment>;
              const name = m[1]!;
              const v = values[name] ?? '';
              n += 1;
              return (
                <button
                  key={`${name}:${v}`}
                  type="button"
                  className={cls.slot}
                  style={{ '--n': n } as CSSProperties}
                  aria-expanded={open === name}
                  aria-controls="pour-card-options"
                  aria-label={`${content.groups[name]?.label ?? name}: ${v}`}
                  onClick={() => {
                    touched.current = true;
                    setOpen(open === name ? null : name);
                  }}
                >
                  {v}
                </button>
              );
            })}
          </p>
          {group && open && (
            <div id="pour-card-options" className={cls.options} role="group" aria-label={group.label}>
              <p>{group.label}</p>
              <div className={cls.chips}>
                {group.options.map((o, i) => (
                  <button key={o.label} type="button" aria-pressed={(picks[open] ?? []).includes(i)} onClick={() => choose(open, i)} data-press>
                    {o.label}
                  </button>
                ))}
                {group.many && (
                  <button
                    type="button"
                    className={cls.doneBtn}
                    onClick={() => {
                      touched.current = true;
                      setOpen(null);
                    }}
                  >
                    {content.done}
                  </button>
                )}
              </div>
            </div>
          )}
          <p>{content.ask}</p>
          <p>{content.thanks}</p>
        </div>
        <div className={cls.side}>
          <div className={cls.stamp}>
            {stamp}
            <span className={cls.stampWord}>{content.stampLabel}</span>
          </div>
          <svg key={month?.label} className={cls.postmark} viewBox="0 0 220 120" aria-hidden="true" focusable="false">
            <defs>
              <path id="pour-pm-arc" d="M22 60a38 38 0 1 1 76 0" />
            </defs>
            <circle cx="60" cy="60" r="50" />
            <circle cx="60" cy="60" r="36" />
            <text>
              <textPath href="#pour-pm-arc" startOffset="50%" textAnchor="middle">
                {content.postmark.toUpperCase()}
              </textPath>
            </text>
            <text x="60" y="76" textAnchor="middle" data-month>
              {month?.label.toUpperCase()}
            </text>
            <path d="M118 38q12-8 24 0t24 0 24 0 24 0M118 60q12-8 24 0t24 0 24 0 24 0M118 82q12-8 24 0t24 0 24 0 24 0" />
          </svg>
          <address className={cls.to}>
            {content.to.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </address>
        </div>
      </div>

      <div className={cls.send}>
        <a
          className={cls.go}
          href={href}
          data-press
          data-magnetic
          onClick={() => {
            setSent(true);
            window.setTimeout(() => setSent(false), 2200);
          }}
        >
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
            <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M3 5.5l7 5.2 7-5.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
          {sent ? content.sending : content.send}
        </a>
        <p className={cls.or}>
          {content.or} <a href={call.tel}>{call.display}</a>
        </p>
      </div>
    </div>
  );
}
