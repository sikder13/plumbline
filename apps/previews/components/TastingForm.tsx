'use client';

import { useState, type FormEvent } from 'react';

interface Labels {
  heading: string;
  date: string;
  guests: string;
  platter: string;
  yes: string;
  no: string;
  submit: string;
  note: string;
  done: string;
}

/** A short request form for a business with no booking system. It sends nothing, and says so. */
export function TastingForm({ labels, className }: { labels: Labels; className?: string }) {
  const [sent, setSent] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSent(true);
  };
  return (
    <form className={className} onSubmit={submit} id="tasting" aria-labelledby="tasting-h">
      <h3 id="tasting-h">{labels.heading}</h3>
      <label>
        <span>{labels.date}</span>
        <input type="date" name="date" required />
      </label>
      <label>
        <span>{labels.guests}</span>
        <select name="guests" defaultValue="2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>{labels.platter}</legend>
        <label>
          <input type="radio" name="platter" value="yes" defaultChecked /> <span>{labels.yes}</span>
        </label>
        <label>
          <input type="radio" name="platter" value="no" /> <span>{labels.no}</span>
        </label>
      </fieldset>
      <button type="submit" data-press>
        {labels.submit}
      </button>
      <p role="status">{sent ? labels.done : labels.note}</p>
    </form>
  );
}
