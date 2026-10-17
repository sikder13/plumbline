import type { VisitSection } from '@plumbline/preview/types';
import { Pic } from '@/components/Pic';
import { pic } from '@/lib/data';
import { ActionLink, coverSizes, type Ctx } from './kit';
import s from './sections.module.css';

/**
 * Where they are and how to reach them.
 * `card` lays a card of details over a photograph; `split` sets the address against the hours;
 * `plain` centres everything on the dark ground.
 */
export function Visit({ section: v, data, recipe }: Ctx & { section: VisitSection }) {
  const id = v.id ?? 'visit';
  return (
    <section className={`${s.band} ${s.visit}`} id={id} data-variant={v.variant} data-ground={v.variant === 'plain' ? 'deep' : v.variant === 'split' ? 'soft' : undefined} aria-labelledby={`${id}-h`}>
      {v.image && v.variant === 'card' && (
        <div className={s.visitPhoto} data-wipe>
          <Pic pic={pic(data, v.image)} sizes={coverSizes(pic(data, v.image), { vw: 100, shape: 1.18 }, '100vw')} />
        </div>
      )}
      <div className={s.visitCard} data-reveal>
        <h2 id={`${id}-h`}>{v.heading}</h2>
        <address>
          {v.address.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </address>
        {v.hours && (
          <dl className={s.visitHours}>
            {v.hours.map((h) => (
              <div key={h.label}>
                <dt>{h.label}</dt>
                <dd>{h.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {v.notes?.map((n) => (
          <p key={n} className={s.visitNote}>
            {n}
          </p>
        ))}
        <p className={s.visitReach}>
          <a href={recipe.call.tel}>{recipe.call.display}</a>
          <a href={`mailto:${recipe.email}`}>{recipe.email}</a>
        </p>
        <ActionLink recipe={recipe} tone={v.variant === 'plain' ? 'accent' : 'ink'} />
      </div>
    </section>
  );
}
