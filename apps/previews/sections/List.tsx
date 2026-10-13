import type { ListSection } from '@plumbline/preview/types';
import { Price, two, type Ctx } from './kit';
import s from './sections.module.css';

/**
 * A plain list.
 * `ruled` is rows ruled off with the price at the right; `questions` opens each answer under its
 * question; `steps` numbers them down the page.
 */
export function List({ section: l }: Ctx & { section: ListSection }) {
  const id = l.id ?? 'list';
  return (
    <section className={`${s.band} ${s.list}`} id={id} data-variant={l.variant} aria-labelledby={`${id}-h`}>
      <header className={s.head}>
        <h2 id={`${id}-h`}>{l.heading}</h2>
        {l.lead && <p className={s.lead}>{l.lead}</p>}
      </header>
      {l.variant === 'questions' ? (
        <div className={s.listBody}>
          {l.items.map((item, i) => (
            <details key={item.name} open={i === 0}>
              <summary>{item.name}</summary>
              <p>{item.text}</p>
            </details>
          ))}
        </div>
      ) : (
        <ol className={s.listBody}>
          {l.items.map((item, i) => (
            <li key={item.name} data-reveal>
              {l.variant === 'steps' && (
                <span className={`${s.listNo} ${s.display}`} aria-hidden="true">
                  {two(i + 1)}
                </span>
              )}
              <div className={s.listMain}>
                <h3>{item.href ? <a href={item.href} rel="noopener">{item.name}</a> : item.name}</h3>
                {item.meta && <p className={s.rowMeta}>{item.meta}</p>}
                {item.text && <p>{item.text}</p>}
              </div>
              {item.price && <Price value={item.price} className={`${s.listPrice} ${s.display}`} />}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
