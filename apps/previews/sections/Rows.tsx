import type { RowsSection } from '@plumbline/preview/types';
import { Pic } from '@/components/Pic';
import { SideScroll } from '@/components/SideScroll';
import { pic } from '@/lib/data';
import { coverSizes, Price, two, type Ctx } from './kit';
import s from './sections.module.css';

/** Each variant's card photograph: its width and shape on a phone, and its width on a desktop. */
const SLOT: Record<RowsSection['variant'], { vw: number; shape: number; desktop: string }> = { tall: { vw: 76, shape: 0.7, desktop: '560px' }, wide: { vw: 84, shape: 1.5, desktop: '520px' }, plain: { vw: 1, shape: 1, desktop: '1px' }, round: { vw: 58, shape: 1, desktop: '420px' } };

/**
 * A row that is swiped, with the phone's own momentum and snap, and dragged with a mouse.
 * `tall` is tall photographs with the words on them; `wide` is landscape photographs with the words
 * beneath; `plain` is numbered cards of words alone; `round` is a row of circles, for bottles and faces.
 */
export function Rows({ section: r, data, recipe }: Ctx & { section: RowsSection }) {
  const id = r.id ?? 'rows';
  return (
    <section className={`${s.band} ${s.rows}`} id={id} aria-labelledby={`${id}-h`} data-variant={r.variant} data-ground={r.variant === 'plain' ? 'soft' : undefined}>
      {/* The row arrives as one piece. A card that only peeks in at the edge is never left as an empty frame. */}
      <div data-reveal>
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
                <div className={s.rowPhoto}>
                  <Pic pic={pic(data, item.image)} sizes={coverSizes(pic(data, item.image), SLOT[r.variant], SLOT[r.variant].desktop)} />
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
      </div>
    </section>
  );
}
