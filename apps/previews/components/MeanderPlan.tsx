'use client';

import { useEffect, useState } from 'react';

export interface PlanTour {
  short: string;
  name: string;
  meta: string;
  price: string;
  href: string;
  /** The tour's own route, drawn small on its tile. */
  route?: { road: string; spurs?: string[]; stops?: { x: number; y: number; kind: string }[] };
}

interface Labels {
  pickTour: string;
  pickLoves: string;
  summaryWith: string;
  summaryAnd: string;
  summaryPlain: string;
  book: string;
  emailChoices: string;
  emailPrivate: string;
  privateNote: string;
  subject: string;
  greeting: string;
  tourLine: string;
  lovesLine: string;
  signoff: string;
}

interface Cls {
  plan: string;
  group: string;
  legend: string;
  tours: string;
  tour: string;
  tourName: string;
  tourMeta: string;
  tourPrice: string;
  tourMap: string;
  chips: string;
  chip: string;
  summary: string;
  actions: string;
  go: string;
  ghost: string;
  note: string;
}

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M3 10h13M11.5 5.5 16 10l-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Joins words the way a person would: "a, b and c". */
function list(words: string[], and: string): string {
  if (words.length < 2) return words.join('');
  return `${words.slice(0, -1).join(', ')} ${and} ${words[words.length - 1]}`;
}

/**
 * The plan: the visitor picks a tour and what their group loves, and the page answers with the one
 * thing to do next. A tour booked online goes to the business's own booking page with its price on the
 * button; a tour arranged by a conversation opens an email to their published address with the choices
 * written in. Nothing here takes a booking itself.
 */
export function MeanderPlan({ tours, loves, labels, email, cls }: { tours: PlanTour[]; loves: { key: string; label: string }[]; labels: Labels; email: string; cls: Cls }) {
  const [pick, setPick] = useState(0);
  const [on, setOn] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const hear = (e: Event) => {
      const { keys, from } = (e as CustomEvent<{ keys: string[]; from: string }>).detail;
      if (from !== 'plan') setOn(new Set(keys));
    };
    window.addEventListener('meander:loves', hear);
    return () => window.removeEventListener('meander:loves', hear);
  }, []);

  const toggle = (key: string) => {
    const next = new Set(on);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setOn(next);
    window.dispatchEvent(new CustomEvent('meander:loves', { detail: { keys: [...next], from: 'plan' } }));
  };

  const tour = tours[pick] ?? tours[0]!;
  const enquiry = tour.href.startsWith('mailto:');
  const chosen = loves.filter((l) => on.has(l.key)).map((l) => l.label.toLowerCase());
  const body = [labels.greeting, '', `${labels.tourLine} ${tour.name}.`, ...(chosen.length ? [`${labels.lovesLine} ${list(chosen, labels.summaryAnd)}.`] : []), '', labels.signoff].join('\n');
  const subject = enquiry ? decodeURIComponent(/subject=([^&]*)/.exec(tour.href)?.[1] ?? labels.subject) : labels.subject;
  const mail = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div className={cls.plan}>
      <fieldset className={cls.group}>
        <legend className={cls.legend}>{labels.pickTour}</legend>
        <div className={cls.tours} role="radiogroup" aria-label={labels.pickTour}>
          {tours.map((t, i) => (
            <button key={t.name} type="button" role="radio" aria-checked={i === pick} tabIndex={i === pick ? 0 : -1} className={cls.tour} onClick={() => setPick(i)} onKeyDown={(e) => {
              const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
              if (!step) return;
              e.preventDefault();
              const next = (pick + step + tours.length) % tours.length;
              setPick(next);
              (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
            }}>
              {t.route && (
                <svg className={cls.tourMap} viewBox="0 0 560 380" aria-hidden="true" focusable="false">
                  {t.route.spurs?.map((d) => (
                    <path key={d} d={d} data-spur />
                  ))}
                  <path d={t.route.road} />
                  {t.route.stops?.map((st, k) => (
                    <circle key={k} cx={st.x} cy={st.y} r={st.kind === 'start' ? 14 : 10} data-kind={st.kind} />
                  ))}
                </svg>
              )}
              <span className={cls.tourName}>{t.short}</span>
              <span className={cls.tourMeta}>{t.meta}</span>
              <span className={cls.tourPrice}>{t.price}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className={cls.group}>
        <legend className={cls.legend}>{labels.pickLoves}</legend>
        <div className={cls.chips}>
          {loves.map((l) => (
            <button key={l.key} type="button" className={cls.chip} aria-pressed={on.has(l.key)} onClick={() => toggle(l.key)}>
              {l.label}
            </button>
          ))}
        </div>
      </fieldset>
      <p className={cls.summary} aria-live="polite">
        {tour.short}
        {chosen.length ? `, ${labels.summaryWith} ${list(chosen, labels.summaryAnd)}.` : `, ${labels.summaryPlain}.`}
      </p>
      <div className={cls.actions}>
        {enquiry ? (
          <a className={cls.go} href={mail} data-press>
            {labels.emailPrivate}
            <Arrow />
          </a>
        ) : (
          <a className={cls.go} href={tour.href} rel="noopener" data-press>
            {labels.book} {tour.short} · {tour.price}
            <Arrow />
          </a>
        )}
        {!enquiry && (
          <a className={cls.ghost} href={mail}>
            {labels.emailChoices}
          </a>
        )}
      </div>
      {enquiry && <p className={cls.note}>{labels.privateNote}</p>}
    </div>
  );
}
