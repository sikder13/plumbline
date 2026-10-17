'use client';

import { useEffect, useRef, useState } from 'react';

export interface BoardRow {
  time: string;
  place: string;
  /** Where exactly, in a line of its own under the row. */
  where: string;
}

interface Props {
  rows: BoardRow[];
  /** The headings over the two columns. */
  columns: [string, string];
  /** A clock in the business's own time zone, with the words that go before it. */
  clock?: { label: string; zone: string };
  className?: string;
}

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** One line of the board as a row of tiles, a character to each, padded to a fixed length. */
function tiles(text: string, length: number): string[] {
  return [...text.toUpperCase().padEnd(length, ' ')].slice(0, length);
}

/**
 * A departures board. Each row is set as tiles, and the first time the board comes into view the
 * tiles turn through a few letters before they settle on the real one, row after row. What a row
 * says is in the page as plain words throughout; the tiles are decoration over it. With reduced
 * motion asked for, nothing turns.
 */
export function FlapBoard({ rows, columns, clock, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState<string | null>(null);
  const timeLength = Math.max(...rows.map((r) => r.time.length));
  const placeLength = Math.max(...rows.map((r) => r.place.length));

  useEffect(() => {
    const board = ref.current;
    if (!board || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cells = [...board.querySelectorAll<HTMLElement>('[data-tile]')];
    const timers: number[] = [];
    let turned = false;
    const turn = () => {
      if (turned) return;
      turned = true;
      for (const cell of cells) {
        const final = cell.dataset.tile ?? ' ';
        if (final === ' ') continue;
        const row = Number(cell.dataset.row);
        const column = Number(cell.dataset.column);
        // Each tile starts a little after the one before it and turns a few times, so the row settles from left to right.
        const turns = 3 + ((row * 7 + column * 3) % 4);
        const start = row * 220 + column * 28;
        for (let k = 0; k <= turns; k++) {
          timers.push(
            window.setTimeout(() => {
              cell.textContent = k === turns ? final : GLYPHS[(row * 11 + column * 5 + k * 7) % GLYPHS.length]!;
              cell.removeAttribute('data-turning');
              // Reading a measurement makes the browser take the attribute off before it goes back on, so the turn plays again.
              void cell.offsetWidth;
              cell.setAttribute('data-turning', '');
            }, start + k * 70),
          );
        }
      }
    };
    const io = new IntersectionObserver(([e]) => e!.isIntersecting && turn(), { threshold: 0.4 });
    io.observe(board);
    return () => {
      io.disconnect();
      for (const t of timers) window.clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    if (!clock) return;
    const format = new Intl.DateTimeFormat('en-NZ', { timeZone: clock.zone, hour: 'numeric', minute: '2-digit', hour12: true });
    const tick = () => setNow(format.format(new Date()).replace(/\s?([ap])\.?m\.?/i, ' $1m'));
    tick();
    const timer = window.setInterval(tick, 15_000);
    return () => window.clearInterval(timer);
  }, [clock]);

  return (
    <div ref={ref} className={className} data-board>
      {/* The clock is for show: a screen reader and the copy check read the rows, not the time of day. */}
      {clock && (
        <p data-board-clock aria-hidden="true">
          <span>{clock.label}</span>
          <b>{now ?? ''}</b>
        </p>
      )}
      <div data-board-head>
        <span>{columns[0]}</span>
        <span>{columns[1]}</span>
      </div>
      <ol>
        {rows.map((row, r) => (
          <li key={row.time}>
            <p data-board-row>
              <span data-sr>
                {row.time}, {row.place}
              </span>
              <span data-board-tiles aria-hidden="true">
                {tiles(row.time, timeLength).map((ch, i) => (
                  <i key={`t${i}`} data-tile={ch} data-row={r} data-column={i} data-blank={ch === ' ' ? '' : undefined}>
                    {ch}
                  </i>
                ))}
                <i data-gap />
                {tiles(row.place, placeLength).map((ch, i) => (
                  <i key={`p${i}`} data-tile={ch} data-row={r} data-column={timeLength + 1 + i} data-blank={ch === ' ' ? '' : undefined}>
                    {ch}
                  </i>
                ))}
              </span>
            </p>
            <p data-board-where>{row.where}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
