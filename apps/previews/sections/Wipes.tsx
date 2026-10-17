import type { WipesSection } from '@plumbline/preview/types';
import { Pic } from '@/components/Pic';
import { pic } from '@/lib/data';
import { coverSizes, type Ctx } from './kit';
import s from './sections.module.css';

/**
 * Photographs that wipe in from their lower edge as they arrive.
 * `pair` is an uneven two, one large and one small set against it; `band` is one photograph edge to
 * edge with a few words on it; `trio` is three tall frames stepped down the page.
 */
export function Wipes({ section: w, data }: Ctx & { section: WipesSection }) {
  const slot = w.variant === 'band' ? { vw: 100, shape: 0.56, desktop: '100vw' } : w.variant === 'pair' ? { vw: 88, shape: 0.87, desktop: '60vw' } : { vw: 30, shape: 0.58, desktop: '36vw' };
  const sizes = (key: string) => coverSizes(pic(data, key), slot, slot.desktop);
  const words = (w.heading || w.text) && (
    <div className={s.wipeWords} data-reveal>
      {w.heading && <h2>{w.heading}</h2>}
      {w.text && <p>{w.text}</p>}
    </div>
  );
  if (w.variant === 'band') {
    return (
      <section className={s.wipeBand} data-parallax-frame>
        <div className={s.wipeBandPhoto}>
          <Pic pic={pic(data, w.images[0]!)} sizes={sizes(w.images[0]!)} parallax />
        </div>
        {words}
      </section>
    );
  }
  return (
    <section className={`${s.band} ${s.wipes}`} data-variant={w.variant}>
      {words}
      <div className={s.wipeSet}>
        {w.images.map((key) => (
          <div key={key} className={s.wipeFrame} data-wipe>
            <Pic pic={pic(data, key)} sizes={sizes(key)} />
          </div>
        ))}
      </div>
    </section>
  );
}
