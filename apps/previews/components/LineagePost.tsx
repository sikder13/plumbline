'use client';

import { useEffect, useId, useState } from 'react';

interface Tour {
  /** The tour as the business's own booking form names it. */
  form: string;
  /** Its price as their pages state it, or what they say instead. */
  price: string;
}

interface Labels {
  tour: string;
  date: string;
  adults: string;
  children: string;
  name: string;
  needs: string;
  post: string;
  note: string;
  form: string;
  subject: string;
}

/**
 * A postcard the visitor fills in: a tour, a date, how many adults and children, a name and any needs.
 * Posting it opens an email to the business's published address with those details written out; nothing
 * is sent or booked from the page. Their own booking form is offered beside it. A link elsewhere on the
 * page marked `data-pick-tour` chooses its tour here before the page moves down to the card.
 */
export function LineagePost({ tours, labels, email, formHref, className }: { tours: Tour[]; labels: Labels; email: string; formHref: string; className?: string }) {
  const id = useId();
  const [tour, setTour] = useState(0);
  const [date, setDate] = useState('');
  const [adults, setAdults] = useState('');
  const [children, setChildren] = useState('');
  const [name, setName] = useState('');
  const [needs, setNeeds] = useState('');

  useEffect(() => {
    const pick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest<HTMLElement>('[data-pick-tour]');
      if (!link) return;
      const i = tours.findIndex((t) => t.form === link.dataset.pickTour);
      if (i >= 0) setTour(i);
    };
    document.addEventListener('click', pick);
    return () => document.removeEventListener('click', pick);
  }, [tours]);

  const chosen = tours[tour]!;
  const lines = [
    `${labels.tour} ${chosen.form}`,
    `${labels.date}: ${date}`,
    `${labels.adults}: ${adults}`,
    `${labels.children}: ${children}`,
    `${labels.name}: ${name}`,
    '',
    needs,
  ];
  const href = `mailto:${email}?subject=${encodeURIComponent(`${labels.subject}: ${chosen.form}`)}&body=${encodeURIComponent(lines.join('\n'))}`;

  return (
    <div className={className} data-post>
      <fieldset data-post-tours>
        <legend>{labels.tour}</legend>
        {tours.map((t, i) => (
          <label key={t.form} data-on={i === tour ? '' : undefined}>
            <input type="radio" name={`${id}-tour`} checked={i === tour} onChange={() => setTour(i)} />
            <span>{t.form}</span>
          </label>
        ))}
      </fieldset>
      <p data-post-price aria-live="polite">{chosen.price}</p>
      <div data-post-fields>
        <label data-wide>
          <span>{labels.date}</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          <span>{labels.adults}</span>
          <input type="number" inputMode="numeric" min={1} value={adults} onChange={(e) => setAdults(e.target.value)} />
        </label>
        <label>
          <span>{labels.children}</span>
          <input type="number" inputMode="numeric" min={0} value={children} onChange={(e) => setChildren(e.target.value)} />
        </label>
        <label data-wide>
          <span>{labels.name}</span>
          <input type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label data-wide>
          <span>{labels.needs}</span>
          <textarea rows={3} value={needs} onChange={(e) => setNeeds(e.target.value)} />
        </label>
      </div>
      <div data-post-go>
        <a href={href} data-press data-magnetic>
          <svg viewBox="0 0 22 16" width="22" height="16" aria-hidden="true" focusable="false">
            <path d="M1.5 1.5h19v13h-19zM1.5 1.5l9.5 7.5 9.5-7.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
          {labels.post}
        </a>
        <p>{labels.note}</p>
        <a href={formHref} rel="noopener" data-post-form>
          {labels.form}
        </a>
      </div>
    </div>
  );
}
