import type { RowsSection } from '@plumbline/preview/types';
import { Pic } from '@/components/Pic';
import { SideScroll } from '@/components/SideScroll';
import { pic } from '@/lib/data';
import { Price, two, type Ctx } from './kit';
import s from './sections.module.css';

const SIZES: Record<RowsSection['variant'], string> = { tall: '(min-width: 900px) 380px, 76vw', wide: '(min-width: 900px) 520px, 84vw', plain: '1px', round: '(min-width: 900px) 280px, 56vw' };

/**
 * A row that is swiped, with the phone's own momentum and snap, and dragged with a mouse.
 * `tall` is tall photographs with the words on them; `wide` is landscape photographs with the words
 * beneath; `plain` is numbered cards of words alone; `round` is a row of circles, for bottles and faces.
 */
export function Rows({ section: r, data, recipe }: Ctx & { section: RowsSection }) {
  const id = r.id ?? 'rows';
  return (
    <section className={`${s.band} ${s.rows}`} id={id} aria-labelledby={`${id}-h`} data-variant={r.variant} data-ground={r.variant === 'plain' ? 'soft' : undefined}>
      <SideScroll
        className={s.side}
        label={r.heading}
        cue={r.cue}
        head={
          <header className={s.head}>
            <h2 id={`${id}-h`}>{r.heading}</h2>
            {r.lead && <p className={s.lead}>{r.lead}</p>}
          </header>
        }
      >
        {r.items.map((item, i) => {
          const link = item.href ?? recipe.action.href;
          return (
            <article key={item.name} className={s.rowCard}>
              {item.image && r.variant !== 'plain' && (
                <div className={s.rowPhoto} data-wipe>
                  <Pic pic={pic(data, item.image)} sizes={SIZES[r.variant]} />
                </div>
              )}
              <div className={s.rowText}>
                {r.variant === 'plain' && (
                  <span className={s.rowNo} aria-hidden="true">
                    {two(i + 1)}
                  </span>
                )}
                <h3>{item.name}</h3>
                {item.meta && <p className={s.rowMeta}>{item.meta}</p>}
                {item.text && <p className={s.rowBlurb}>{item.text}</p>}
                <p className={s.rowEnd}>
                  {item.price && <Price value={item.price} className={s.rowPrice} />}
                  {r.button && (
                    <a href={link} rel="noopener" data-press aria-label={`${r.button}: ${item.name}`}>
                      {r.button}
                    </a>
                  )}
                </p>
              </div>
            </article>
          );
        })}
      </SideScroll>
    </section>
  );
}
