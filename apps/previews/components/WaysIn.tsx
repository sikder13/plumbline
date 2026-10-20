'use client';

import { useState } from 'react';

interface Way {
  id: string;
  label: string;
  items: { name: string; price: string; text: string }[];
}

/** Their rates, chosen by how often the visitor will come. Every card is one of their own prices. */
export function WaysIn({ ways, book, s }: { ways: Way[]; book: string; s: Record<'tabs' | 'tab' | 'cards' | 'card' | 'cardName' | 'cardPrice' | 'cardText' | 'cardBook', string> }) {
  const [on, setOn] = useState(ways[0]!.id);
  const way = ways.find((w) => w.id === on)!;
  return (
    <>
      <div className={s.tabs} role="tablist" aria-label="How often will you come?">
        {ways.map((w) => (
          <button key={w.id} type="button" role="tab" id={`way-${w.id}`} aria-selected={on === w.id} aria-controls="way-panel" className={s.tab} onClick={() => setOn(w.id)} data-press>
            {w.label}
          </button>
        ))}
      </div>
      <div id="way-panel" role="tabpanel" aria-labelledby={`way-${on}`} className={s.cards}>
        {way.items.map((i) => (
          <article key={i.name} className={s.card}>
            <h3 className={s.cardName}>{i.name}</h3>
            <p className={s.cardPrice}>{i.price}</p>
            <p className={s.cardText}>{i.text}</p>
            <a className={s.cardBook} href={book} data-press>
              Book a class
            </a>
          </article>
        ))}
      </div>
    </>
  );
}
