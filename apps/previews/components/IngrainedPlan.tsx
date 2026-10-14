'use client';

import { useEffect, useRef, useState } from 'react';

export interface PlanOption {
  activity: string;
  water: string;
  name: string;
  text: string;
  prices: { guests: number; text: string }[];
}

interface CodSay {
  say: string;
  rule: string;
}

export interface PlanContent {
  kicker: string;
  heading: string;
  activityLabel: string;
  guestsLabel: string;
  fewer: string;
  more: string;
  min: number;
  max: number;
  activities: { id: string; label: string }[];
  waters: { id: string; label: string; cod: string; tone: string }[];
  options: PlanOption[];
  pricesLabel: string;
  minNote: string;
  include: string;
  cod: { label: string; rules: Record<string, { from?: [number, number]; to?: [number, number]; open: CodSay; closed?: CodSay }> };
  send: string;
  mail: { subject: string; body: string };
}

export interface PlanClasses {
  root: string;
  inner: string;
  kicker: string;
  heading: string;
  waters: string;
  water: string;
  waterName: string;
  waterOpen: string;
  surface: string;
  controls: string;
  switch: string;
  counter: string;
  panelPrice: string;
  result: string;
  option: string;
  optText: string;
  prices: string;
  cod: string;
  codSay: string;
  codRule: string;
  include: string;
  send: string;
}

/** Month and day as one number, so a date can be compared with a season's first and last day. */
const md = (m: number, d: number) => m * 100 + d;

function Fish() {
  return (
    <svg viewBox="0 0 40 20" width="34" height="17" aria-hidden="true" focusable="false">
      <path d="M2 10c6-7 16-9 24-4l7-5v18l-7-5c-8 5-18 3-24-4z" fill="currentColor" />
      <circle cx="9" cy="8.6" r="1.5" fill="var(--fish-eye, #0a1c1d)" />
    </svg>
  );
}

function Letter() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path d="M3.5 6.5h17v11h-17zM3.5 7l8.5 6.5L20.5 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Choose your water: three tall panels of water. The one chosen widens and the section takes its
 * colour; inside it, today's answer to whether a blue cod may be kept there, and the trip's whole
 * boat price. A switch for fishing or fishing and diving and a guest counter settle on one of the
 * business's own trips. The square block at the end opens an email to the business with the trip
 * written in. On first view it plays a few choices by itself, then waits for the visitor.
 */
export function IngrainedPlan({ c, email, cls }: { c: PlanContent; email: string; cls: PlanClasses }) {
  const ref = useRef<HTMLDivElement>(null);
  const [guests, setGuests] = useState(c.min);
  const [activity, setActivity] = useState(c.activities[0]!.id);
  const [water, setWater] = useState(c.waters[0]!.id);
  const [today, setToday] = useState<number | null>(null);
  const touched = useRef(false);

  const has = (a: string, w: string) => c.options.some((o) => o.activity === a && o.water === w);
  const option = c.options.find((o) => o.activity === activity && o.water === water) ?? c.options[0]!;
  const waterInfo = c.waters.find((w) => w.id === water) ?? c.waters[0]!;

  const touch = (fn: () => void) => () => {
    touched.current = true;
    fn();
  };
  const chooseWater = (w: string) => {
    setWater(w);
    if (!has(activity, w)) setActivity(c.activities.find((a) => has(a.id, w))!.id);
  };
  const chooseActivity = (a: string) => {
    setActivity(a);
    if (!has(a, water)) setWater(c.waters.find((w) => has(a, w.id))!.id);
  };

  useEffect(() => {
    const now = new Date();
    setToday(md(now.getMonth() + 1, now.getDate()));
  }, []);

  // A short demonstration the first time the panels are seen: the waters, then diving, then a full boat.
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timers: number[] = [];
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        const steps = [...c.waters.slice(1).map((w) => () => setWater(w.id)), () => setActivity(c.activities[c.activities.length - 1]!.id), () => setGuests(c.max)];
        steps.forEach((step, i) =>
          timers.push(
            window.setTimeout(() => {
              if (!touched.current) step();
            }, 700 + i * 900),
          ),
        );
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [c]);

  const codFor = (codKey: string): { say: CodSay | null; keep: boolean; open: CodSay | null } => {
    const rule = c.cod.rules[codKey];
    if (!rule) return { say: null, keep: false, open: null };
    if (!rule.from || !rule.to || !rule.closed) return { say: rule.open, keep: true, open: rule.open };
    if (today === null) return { say: null, keep: false, open: rule.open };
    const open = today >= md(...rule.from) && today <= md(...rule.to);
    return { say: open ? rule.open : rule.closed, keep: open, open: rule.open };
  };
  const cod = codFor(waterInfo.cod);

  const party = `${guests} ${c.guestsLabel}`;
  const fill = (t: string) => t.replace('{option}', option.name).replace('{guests}', party).replace('{water}', waterInfo.label);
  const href = `mailto:${email}?subject=${encodeURIComponent(fill(c.mail.subject))}&body=${encodeURIComponent(fill(c.mail.body))}`;
  const from = option.prices[0]!;

  return (
    <div ref={ref} className={cls.root} data-tone={waterInfo.tone}>
      <div className={cls.inner}>
        <p className={cls.kicker}>{c.kicker}</p>
        <h2 id="plan-h" className={cls.heading}>
          {c.heading}
        </h2>

        <div className={cls.waters}>
          {c.waters.map((w) => {
            const on = w.id === water;
            const here = codFor(w.cod);
            return (
              <button key={w.id} type="button" className={cls.water} data-tone={w.tone} aria-pressed={on} onClick={touch(() => chooseWater(w.id))}>
                <span className={cls.surface} aria-hidden="true" />
                <span className={cls.waterName}>{w.label}</span>
                {on && (
                  <span className={cls.waterOpen}>
                    <span className={cls.cod} data-keep={here.keep ? '' : undefined}>
                      <Fish />
                      <span>{c.cod.label}</span>
                      <b className={cls.codSay}>{here.say?.say ?? ''}</b>
                    </span>
                    <span className={cls.panelPrice}>
                      <b>{from.text}</b>{' '}
                      <small>
                        {from.guests} {c.guestsLabel}, {c.pricesLabel}
                      </small>
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className={cls.controls}>
          <div className={cls.switch} role="group" aria-label={c.activityLabel}>
            {c.activities.map((a) => (
              <button key={a.id} type="button" aria-pressed={a.id === activity} onClick={touch(() => chooseActivity(a.id))}>
                {a.label}
              </button>
            ))}
          </div>
          <div className={cls.counter}>
            <button type="button" aria-label={c.fewer} disabled={guests <= c.min} onClick={touch(() => setGuests((g) => Math.max(c.min, g - 1)))}>
              <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
                <path d="M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <p aria-live="polite">
              <b key={guests}>{guests}</b>{' '}
              <span>{c.guestsLabel}</span>
            </p>
            <button type="button" aria-label={c.more} disabled={guests >= c.max} onClick={touch(() => setGuests((g) => Math.min(c.max, g + 1)))}>
              <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
                <path d="M4 10h12M10 4v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className={cls.result} aria-live="polite">
          <p key={option.name} className={cls.option}>
            {option.name}
          </p>
          <p className={cls.optText}>{option.text}</p>
          <ul className={cls.prices}>
            {option.prices.map((p) => (
              <li key={p.guests} data-on={p.guests === guests ? '' : undefined}>
                <b>{p.text}</b>{' '}
                <span>
                  {p.guests} {c.guestsLabel}, {c.pricesLabel}
                  {p.guests === c.min && <small>{c.minNote}</small>}
                </span>
              </li>
            ))}
          </ul>
          <p className={cls.codRule}>{(cod.say ?? cod.open)?.rule}</p>
          <p className={cls.include}>{c.include}</p>
        </div>

        <a className={cls.send} href={href} data-press>
          <Letter />
          <span>{c.send}</span>
        </a>
      </div>
    </div>
  );
}
