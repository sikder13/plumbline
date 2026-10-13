import type { CSSProperties } from 'react';
import type { HeroSection } from '@plumbline/preview/types';
import { HeroVideo } from '@/components/HeroVideo';
import { Pic } from '@/components/Pic';
import { pic } from '@/lib/data';
import { ActionLink, Lines, type Ctx } from './kit';
import s from './sections.module.css';

/** How wide the opening photograph is drawn in each variant, so the browser fetches the right file first. */
export function heroSizes(hero: HeroSection | undefined): string {
  if (hero?.variant === 'split') return '(min-width: 900px) 50vw, 100vw';
  if (hero?.variant === 'type') return hero.panel === 'strip' ? '100vw' : '(min-width: 900px) 36vw, 70vw';
  if (hero?.variant === 'frame') return '(min-width: 900px) 58vw, 94vw';
  return '100vw';
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
  const tone = onPhoto || ground === 'deep' ? 'light' : 'accent';
  const media = (
    <div className={s.heroMedia} data-parallax-frame data-ambience={ambience}>
      <Pic pic={pic(data, 'hero')} phone={data.images.heroPhone} sizes={heroSizes(h)} first parallax={onPhoto} />
      {ambience === 'film' && data.video && <HeroVideo src={data.video} className={s.heroFilm} />}
    </div>
  );
  return (
    <section className={s.hero} id="top" data-hero data-variant={h.variant} data-align={h.align ?? 'low'} data-panel={h.panel ?? 'strip'} data-ground={onPhoto ? 'photo' : ground} style={{ '--hs': h.scale ?? 1 } as CSSProperties}>
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
        <ActionLink recipe={recipe} tone={tone === 'light' ? 'light' : 'ink'} className={s.heroTopAct} />
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
