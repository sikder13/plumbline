'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export interface JourneyTour {
  name: string;
  tag?: string;
  /** The tour as the business's own booking form names it. */
  form: string;
  length?: string;
  when?: string;
  /** Where its length sits on the scale of hours, in steps of the scale; none for a tour with no set length. */
  span?: { from: number; to: number; more?: boolean };
  stops: string[];
  price: string;
  priceLabel?: string;
  /** The price as one line, for the card. */
  priceLine?: string;
  /** Words for a tour with no route, such as one designed to order. */
  line?: string;
  /** Prices per person from the business's own pages, for a live estimate. */
  rates?: { adult: number; child: number; suggested?: boolean };
}

interface Labels {
  choose: string;
  card: string;
  along: string;
  date: string;
  dateEmpty: string;
  prevMonth: string;
  nextMonth: string;
  adults: string;
  children: string;
  fewer: string;
  more: string;
  none: string;
  estimate: string;
  estimateSuggested: string;
  estimateNote: string;
  name: string;
  needs: string;
  post: string;
  note: string;
  posted: string;
  form: string;
  subject: string;
  tour: string;
}

function Span({ span }: { span?: JourneyTour['span'] }) {
  return (
    <span data-span data-open={span ? undefined : ''} data-more={span?.more ? '' : undefined} style={{ '--from': span?.from ?? 0, '--to': span?.to ?? 0 } as CSSProperties} aria-hidden="true">
      <i data-span-bar />
      <i data-span-range />
      <i data-span-more />
    </span>
  );
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** A month to choose a day from, Monday first. Shown only when asked for, so the page itself carries no dates. */
function Calendar({ value, onPick, labels }: { value: Date | null; onPick: (d: Date) => void; labels: Labels }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [month, setMonth] = useState(() => new Date((value ?? today).getFullYear(), (value ?? today).getMonth(), 1));
  const lead = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const title = new Intl.DateTimeFormat('en-NZ', { month: 'long', year: 'numeric' }).format(month);
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat('en-NZ', { weekday: 'narrow' }).format(new Date(2024, 0, 1 + i)));
  const long = new Intl.DateTimeFormat('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const isFirst = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();
  return (
    <div data-cal>
      <div data-cal-head>
        <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} disabled={isFirst} aria-label={labels.prevMonth}>
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
            <path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <p aria-live="polite">{title}</p>
        <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label={labels.nextMonth}>
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
            <path d="M7.5 4.5 13 10l-5.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div data-cal-grid role="group" aria-label={title}>
        {weekdays.map((w, i) => (
          <span key={`w${i}`} data-cal-wd aria-hidden="true">
            {w}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`l${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const d = new Date(month.getFullYear(), month.getMonth(), i + 1);
          const past = d < today;
          const on = value !== null && dayKey(value) === dayKey(d);
          return (
            <button key={i} type="button" disabled={past} aria-pressed={on} aria-label={long.format(d)} onClick={() => onPick(d)}>
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Stepper({ label, value, min, onChange, labels, zero }: { label: string; value: number; min: number; onChange: (n: number) => void; labels: Labels; zero: string }) {
  return (
    <div data-stepper role="group" aria-label={label}>
      <span data-stepper-label>{label}</span>
      <div data-stepper-row>
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`${labels.fewer}: ${label}`} data-press>
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
            <path d="M4.5 10h11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <output aria-live="polite">{value === 0 ? zero : value}</output>
        <button type="button" onClick={() => onChange(value + 1)} aria-label={`${labels.more}: ${label}`} data-press>
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
            <path d="M4.5 10h11M10 4.5v11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/**
 * The journeys and the card that books one, as one piece. Each journey is a line on a scale of hours; choosing
 * one writes it onto the postcard beside it, with its length, its stops and its price, as they are on the
 * business's own pages. The visitor picks a day, sets the party with steppers and sees an estimate made from those
 * prices once they have set it. Posting the card stamps it and opens an email to the business's published address
 * with the details written out; nothing is sent or booked from the page. Their own booking form is offered beside
 * it. Styled by the design through the data attributes below.
 */
export function LineageJourneys({ tours, scale, labels, email, formHref, address, className }: { tours: JourneyTour[]; scale: string[]; labels: Labels; email: string; formHref: string; address: ReactNode; className?: string }) {
  const id = useId();
  const card = useRef<HTMLElement>(null);
  const [sel, setSel] = useState(0);
  const [date, setDate] = useState<Date | null>(null);
  const [calOpen, setCalOpen] = useState(false);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [touched, setTouched] = useState(false);
  const [name, setName] = useState('');
  const [needs, setNeeds] = useState('');
  const [posted, setPosted] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  // While the journeys are on screen the page marks it, so floating book buttons elsewhere can step aside for the
  // card's own. The watch is set up once the browser is idle.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let io: IntersectionObserver | undefined;
    const begin = () => {
      io = new IntersectionObserver(([e]) => document.documentElement.toggleAttribute('data-lineage-booking', !!e?.isIntersecting), { rootMargin: '-15% 0px -15% 0px' });
      io.observe(el);
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (h: number) => void };
    const handle = w.requestIdleCallback ? w.requestIdleCallback(begin, { timeout: 3000 }) : window.setTimeout(begin, 1500);
    return () => {
      if (w.cancelIdleCallback) w.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
      io?.disconnect();
      document.documentElement.removeAttribute('data-lineage-booking');
    };
  }, []);

  const pick = (i: number) => {
    setSel(i);
    setPosted(0);
    // On a phone the card is below the list, so it is brought up to show the journey written onto it.
    if (window.matchMedia('(max-width: 899px)').matches) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      requestAnimationFrame(() => card.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }));
    }
  };

  const t = tours[sel]!;
  const dateText = date ? new Intl.DateTimeFormat('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date) : '';
  const total = t.rates ? adults * t.rates.adult + children * t.rates.child : null;
  const body = [`${labels.tour} ${t.form}`, `${labels.date}: ${dateText}`, `${labels.adults}: ${adults}`, `${labels.children}: ${children}`, `${labels.name}: ${name}`, '', needs];
  const href = `mailto:${email}?subject=${encodeURIComponent(`${labels.subject}: ${t.form}`)}&body=${encodeURIComponent(body.join('\n'))}`;
  const party = (set: (n: number) => void) => (n: number) => {
    set(n);
    setTouched(true);
  };

  return (
    <div ref={box} className={className} data-journeys>
      <div data-routes role="radiogroup" aria-label={labels.choose}>
        <div data-scale aria-hidden="true">
          <ol>
            {scale.map((tick) => (
              <li key={tick}>{tick}</li>
            ))}
          </ol>
        </div>
        {tours.map((tour, i) => (
          <label key={tour.form} data-route data-on={i === sel ? '' : undefined}>
            <input type="radio" name={`${id}-tour`} checked={i === sel} onChange={() => pick(i)} />
            <span data-route-name>
              <b>{tour.name}</b>
              {tour.tag && <small>{tour.tag}</small>}
            </span>
            <span data-route-line>
              <Span span={tour.span} />
              {tour.length ? (
                <span data-route-length>
                  <b>{tour.length}</b> {tour.when}
                </span>
              ) : (
                <span data-route-length>{tour.line}</span>
              )}
            </span>
            <span data-route-price>
              <b>{tour.price}</b>
              {tour.priceLabel && <small>{tour.priceLabel}</small>}
            </span>
          </label>
        ))}
      </div>

      <article ref={card} id="post" data-card data-posted={posted ? '' : undefined} aria-labelledby={`${id}-card`}>
        <div data-card-write>
          <p data-card-kicker id={`${id}-card`}>
            {labels.card}
          </p>
          <div key={sel} data-card-tour>
            <h3>{t.name}</h3>
            <Span span={t.span} />
            <p data-card-length>{t.length ? [t.length, t.when].filter(Boolean).join(' · ') : t.line}</p>
            {t.stops.length > 0 && (
              <>
                <p data-card-along>{labels.along}</p>
                <ol data-card-stops>
                  {t.stops.map((stop, i) => (
                    <li key={stop} style={{ '--n': i } as CSSProperties}>
                      {stop}
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>

          <div data-card-fields>
            <div data-date data-open={calOpen ? '' : undefined}>
              <span data-field-label>{labels.date}</span>
              <button type="button" aria-expanded={calOpen} onClick={() => setCalOpen((o) => !o)} data-date-button>
                <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
                  <path d="M3.5 5.5h13v11h-13zM3.5 8.5h13M7 3.5v3M13 3.5v3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
                </svg>
                <span>{date ? dateText : labels.dateEmpty}</span>
              </button>
              {calOpen && (
                <Calendar
                  value={date}
                  labels={labels}
                  onPick={(d) => {
                    setDate(d);
                    setCalOpen(false);
                  }}
                />
              )}
            </div>
            <Stepper label={labels.adults} value={adults} min={1} onChange={party(setAdults)} labels={labels} zero={labels.none} />
            <Stepper label={labels.children} value={children} min={0} onChange={party(setChildren)} labels={labels} zero={labels.none} />
            <div data-estimate aria-live="polite">
              {t.rates && touched && total !== null ? (
                <>
                  <span>{t.rates.suggested ? labels.estimateSuggested : labels.estimate}</span>
                  <b key={total}>${total}</b>
                  <small>{labels.estimateNote}</small>
                </>
              ) : (
                <b data-plain>{t.priceLine ?? t.price}</b>
              )}
            </div>
            <label data-wide>
              <span data-field-label>{labels.name}</span>
              <input type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label data-wide>
              <span data-field-label>{labels.needs}</span>
              <textarea rows={2} value={needs} onChange={(e) => setNeeds(e.target.value)} />
            </label>
          </div>

          <div data-card-go>
            <a href={href} onClick={() => setPosted((n) => n + 1)} data-press>
              <svg viewBox="0 0 22 16" width="22" height="16" aria-hidden="true" focusable="false">
                <path d="M1.5 1.5h19v13h-19zM1.5 1.5l9.5 7.5 9.5-7.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
              {labels.post}
            </a>
            <p aria-live="polite">{posted ? labels.posted : labels.note}</p>
            <a href={formHref} rel="noopener" data-card-form>
              {labels.form}
            </a>
          </div>
        </div>
        <div key={`a-${posted}`} data-card-address>
          {address}
        </div>
      </article>
    </div>
  );
}
