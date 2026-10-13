import type { NumbersSection } from '@plumbline/preview/types';
import type { Ctx } from './kit';
import s from './sections.module.css';

/**
 * A few figures that count up once as they come into view.
 * `row` sets them large and side by side; `band` runs them along one dark band; `list` rules them
 * off one under another with the figure at the right.
 */
export function Numbers({ section: n }: Ctx & { section: NumbersSection }) {
  return (
    <section className={`${s.band} ${s.numbers}`} data-variant={n.variant} data-ground={n.variant === 'band' ? 'deep' : n.variant === 'row' ? 'soft' : undefined} aria-label={n.heading ?? 'In numbers'}>
      {n.heading && <h2 className={s.numbersHead}>{n.heading}</h2>}
      <dl>
        {n.items.map((item) => (
          <div key={item.label} data-reveal>
            <dt>
              {item.label}
              {item.source && <small>{item.source}</small>}
            </dt>
            <dd className={s.display} data-count>
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
