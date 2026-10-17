'use client';

import { useEffect, useState } from 'react';

export interface Month {
  short: string;
  name: string;
  /** Drop in hours at the weekend this month. */
  weekends: boolean;
  /** Drop in hours on weekdays too. */
  weekdays: boolean;
  /** Something the business says happens on the farm this month. */
  farm?: string;
}

export interface Hours {
  zone: string;
  now: string;
  pick: string;
  rows: { weekends: string; weekdays: string };
  weekends: string;
  weekdays: string;
  request: { title: string; text: string };
  ring: string;
  winter: string;
  months: Month[];
}

export interface SignWords {
  label: string;
  front: string;
  today: string;
  weekends: string;
  request: string;
  ring: string;
}

/** The month and day of the week where the business is. */
function today(zone: string): { month: number; weekend: boolean } {
  const parts = new Intl.DateTimeFormat('en-NZ', { timeZone: zone, month: 'numeric', weekday: 'short' }).formatToParts(new Date());
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? '1') - 1;
  const day = parts.find((p) => p.type === 'weekday')?.value ?? '';
  return { month, weekend: /^(sat|sun)/i.test(day) };
}

/** The hours a month keeps, in the business's own words. */
function hoursOf(m: Month, h: Hours): string[] {
  const lines: string[] = [];
  if (m.weekends) lines.push(h.weekends);
  if (m.weekdays) lines.push(h.weekdays);
  return lines;
}

/** The hours the opening hours line gives, as a short time, such as "12 Noon to 4.30pm". */
function timeOf(line: string): string {
  const at = line.search(/\d/);
  return at < 0 ? line : line.slice(at);
}

/**
 * A sign hanging at the cellar door. It swings in with the page showing the place, then turns round
 * to say what today is by the hours the business keeps: a drop in day, a weekend only month, or open
 * on request. It never says more than their own hours do. Without the scripts it stays on its front.
 */
export function PaddockSign({ words, hours, className }: { words: SignWords; hours: Hours; className?: string }) {
  const [state, setState] = useState<{ title: string; note: string } | null>(null);

  useEffect(() => {
    const { month, weekend } = today(hours.zone);
    const m = hours.months[month];
    if (!m) return;
    let next: { title: string; note: string };
    if (m.weekdays || (m.weekends && weekend)) next = { title: words.today, note: timeOf(m.weekdays && !weekend ? hours.weekdays : hours.weekends) };
    else if (m.weekends) next = { title: words.weekends, note: timeOf(hours.weekends) };
    else next = { title: words.request, note: words.ring };
    // The sign turns once it has finished swinging in with the page, however quickly the scripts arrive.
    const wait = Math.max(0, 1700 - performance.now());
    const timer = window.setTimeout(() => setState(next), wait);
    return () => window.clearTimeout(timer);
  }, [hours, words]);

  return (
    <div className={className} data-sign data-turned={state ? '' : undefined}>
      <span data-sign-string aria-hidden="true" />
      <p data-sign-board>
        <span data-sign-face="front" aria-hidden={state ? true : undefined}>
          <small>{words.label}</small>
          <b>{words.front}</b>
        </span>
        <span data-sign-face="back">
          <small>{words.label}</small>
          <b>{state?.title ?? ''}</b>
          <span>{state?.note ?? ''}</span>
        </span>
      </p>
    </div>
  );
}

/**
 * The farm year: twelve months, each marked with the drop in hours it keeps or as open on request,
 * with this month marked where the business is. Choosing a month says its hours and anything the
 * business says happens on the farm then.
 */
export function PaddockYear({ hours, className }: { hours: Hours; className?: string }) {
  const [now, setNow] = useState<number | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);

  useEffect(() => {
    const { month } = today(hours.zone);
    setNow(month);
    setChosen((c) => (c === null ? month : c));
  }, [hours.zone]);

  const m = chosen === null ? null : hours.months[chosen];
  const lines = m ? hoursOf(m, hours) : [];

  return (
    <div className={className} data-year>
      <ol data-months aria-label={hours.pick}>
        {hours.months.map((mo, i) => (
          <li key={mo.short}>
            <button type="button" aria-pressed={chosen === i} data-open={mo.weekends ? (mo.weekdays ? 'all' : 'weekends') : 'request'} onClick={() => setChosen(i)}>
              {now === i && <i data-now aria-hidden="true" />}
              <b aria-hidden="true">{mo.short}</b>
              <span data-bar="weekends" aria-hidden="true" />
              <span data-bar="weekdays" aria-hidden="true" />
              <span data-sr>{mo.name}</span>
            </button>
          </li>
        ))}
      </ol>
      <ul data-key aria-hidden="true">
        <li data-swatch="weekends">{hours.rows.weekends}</li>
        <li data-swatch="weekdays">{hours.rows.weekdays}</li>
        <li data-swatch="request">{hours.request.title}</li>
      </ul>
      <div data-reading>
        {m ? (
          <>
            <p data-reading-month>
              {m.name}
              {now === chosen && <small>{hours.now}</small>}
            </p>
            {lines.length ? (
              lines.map((l) => (
                <p key={l} data-reading-line>
                  {l}
                </p>
              ))
            ) : (
              <>
                <p data-reading-line>{hours.request.title}</p>
                <p data-reading-text>{hours.request.text}</p>
              </>
            )}
            {m.farm && <p data-reading-farm>{m.farm}</p>}
          </>
        ) : (
          <>
            <p data-reading-line>{hours.weekends}</p>
            <p data-reading-line>{hours.weekdays}</p>
            <p data-reading-text>{hours.request.title}</p>
          </>
        )}
        <p data-reading-ring>{hours.ring}</p>
      </div>
    </div>
  );
}
