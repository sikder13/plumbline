import type { CSSProperties } from 'react';
import type { HeroSection } from '@plumbline/preview/types';
import { HeroVideo } from '@/components/HeroVideo';
import { Pic } from '@/components/Pic';
import { pic } from '@/lib/data';
import type { Picture } from '@/lib/data';
import { ActionLink, coverSizes, Lines, type Ctx } from './kit';
import s from './sections.module.css';

/**
 * How wide the opening photograph is drawn in each variant, so the browser fetches the right file
 * first. The same words go on the preload and on the picture, or the preload would fetch a file
 * the picture never uses.
 */
export function heroSizes(hero: HeroSection | undefined, p: Picture): string {
  if (hero?.variant === 'split') return coverSizes(p, { vw: 94, shape: 0.95 }, '70vw');
  if (hero?.variant === 'frame') return coverSizes(p, { vw: 94, shape: 0.9 }, '70vw');
  if (hero?.variant === 'type') {
    if (hero.panel === 'strip') return coverSizes(p, { vw: 100, shape: 1.5 }, '100vw');
    const slot = hero.panel === 'tall' ? { vw: 58, shape: 0.81 } : hero.panel === 'round' ? { vw: 62, shape: 1 } : { vw: 66, shape: 0.85 };
    return coverSizes(p, slot, '520px');
  }
  // A photograph hero with no crop of its own for phones covers the whole tall screen there.
  return coverSizes(p, { vw: 100, shape: 0.48 }, '100vw');
}

/**
 * The first screen. Four ways to open a page:
 * `photo`, their photograph edge to edge under a scrim, the headline low, high or centred on it;
 * `split`, words on one side and the photograph on the other;
 * `type`, the headline as the picture, with a cropped panel of their photograph beside it, for a
 * business whose photographs are too small to fill a screen;
 * `frame`, the photograph held in a rounded frame with the headline beneath.
 */
export function Hero({ section: h, data, recipe }: Ctx & { section: HeroSection }) {
  const ground = h.ground ?? (h.variant === 'type' ? 'deep' : h.variant === 'split' ? 'paper' : 'soft');
  const ambience = h.ambience ?? 'still';
  const onPhoto = h.variant === 'photo';
  // On their photograph the action is white, which reads on anything. On a ground of the page's own it carries the accent.
  const tone = onPhoto ? 'light' : 'accent';
  const media = (
    <div className={s.heroMedia} data-parallax-frame data-ambience={ambience} data-treat={h.treat}>
      <Pic pic={pic(data, 'hero')} phone={data.images.heroPhone} sizes={heroSizes(h, pic(data, 'hero'))} first parallax={onPhoto} />
      {ambience === 'film' && data.video && <HeroVideo src={data.video} className={s.heroFilm} />}
    </div>
  );
  return (
    <section className={s.hero} id="top" data-hero data-variant={h.variant} data-align={h.align ?? 'low'} data-panel={h.panel ?? 'strip'} data-ground={onPhoto ? 'photo' : ground} style={{ '--hs': h.scale ?? 1, '--hsw': h.scaleWide ?? h.scale ?? 1 } as CSSProperties}>
      {h.variant !== 'type' && media}
      <header className={s.heroTop}>
        <a className={s.brand} href="#top">
          {data.name}
        </a>
        <nav className={s.heroNav} aria-label="Sections">
          {recipe.nav.map((n) => (
            <a key={n.href} href={n.href}>
              {n.label}
            </a>
          ))}
        </nav>
        <a className={s.heroCall} href={recipe.call.tel}>
          {recipe.call.display}
        </a>
        <ActionLink recipe={recipe} tone={onPhoto ? 'light' : ground === 'deep' ? 'accent' : 'ink'} className={s.heroTopAct} />
      </header>
      <div className={s.heroBody}>
        <p className={s.place}>{h.place}</p>
        <Lines lines={h.lines} className={s.heroLines} />
        {h.variant === 'type' && media}
        <div className={s.heroFoot}>
          {h.sub && <p className={s.sub}>{h.sub}</p>}
          <div className={s.heroAct}>
            <ActionLink recipe={recipe} tone={tone} />
            {h.note && <span className={s.note}>{h.note}</span>}
          </div>
        </div>
      </div>
    </section>
  );
}
