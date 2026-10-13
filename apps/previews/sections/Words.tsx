import type { WordsSection } from '@plumbline/preview/types';
import { Pic } from '@/components/Pic';
import { pic } from '@/lib/data';
import type { Ctx } from './kit';
import s from './sections.module.css';

/**
 * Their own words.
 * `quote` sets one sentence large on the dark ground; `letter` puts a photograph beside a few short
 * paragraphs signed with their names; `columns` runs a heading against two columns of text.
 */
export function Words({ section: w, data }: Ctx & { section: WordsSection }) {
  const id = w.id ?? 'about';
  return (
    <section className={`${s.band} ${s.words}`} id={id} data-variant={w.variant} data-ground={w.variant === 'quote' ? 'deep' : undefined} aria-labelledby={w.heading ? `${id}-h` : undefined} aria-label={w.heading ? undefined : 'About'}>
      {w.image && w.variant !== 'columns' && (
        <div className={s.wordsPhoto} data-wipe>
          <Pic pic={pic(data, w.image)} sizes={w.variant === 'quote' ? '160px' : '(min-width: 900px) 40vw, 88vw'} />
        </div>
      )}
      <div className={s.wordsText} data-reveal>
        {w.heading && <h2 id={`${id}-h`}>{w.heading}</h2>}
        {w.quote && <blockquote className={s.display}>{w.quote}</blockquote>}
        <div className={s.wordsBody}>
          {w.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        {w.names && <p className={s.wordsNames}>{w.names}</p>}
      </div>
    </section>
  );
}
