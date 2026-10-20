'use client';

import { useState, type ReactNode } from 'react';

/** Their treatments as an index: one open at a time, each with their own words and their own booking link. */
export function TreatIndex({ items, book, s }: { items: { name: string; text: string; pic?: ReactNode }[]; book: string; s: Record<'index' | 'row' | 'rowBtn' | 'rowNo' | 'rowName' | 'rowBody' | 'rowText' | 'rowPic' | 'rowBook', string> }) {
  const [open, setOpen] = useState(0);
  return (
    <ol className={s.index}>
      {items.map((t, i) => (
        <li key={t.name} className={s.row} data-open={open === i ? '' : undefined}>
          <button type="button" className={s.rowBtn} aria-expanded={open === i} aria-controls={`treat-${i}`} onClick={() => setOpen(open === i ? -1 : i)}>
            <span className={s.rowNo}>{String(i + 1).padStart(2, '0')}</span>
            <span className={s.rowName}>{t.name}</span>
          </button>
          <div id={`treat-${i}`} className={s.rowBody} hidden={open !== i}>
            {t.pic && <div className={s.rowPic}>{t.pic}</div>}
            <p className={s.rowText}>{t.text}</p>
            <a className={s.rowBook} href={book} data-press>
              Book {t.name}
            </a>
          </div>
        </li>
      ))}
    </ol>
  );
}
