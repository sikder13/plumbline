import type { CSSProperties, ReactNode } from 'react';
import type { EngineDemo } from '@plumbline/preview/engine';
import { DemoFoot } from '@/components/DemoFoot';
import type { PageData } from '@/lib/data';
import { Photo, type Cls } from './kit';

/**
 * Sections every engine can carry. The markup is shared and each engine's stylesheet gives it its
 * own form. A section whose data is missing is not drawn, and nothing stands in for it.
 */

/** Their own words, set large, with the facts that go with them. */
export function Intro({ c, cls, label }: { c: EngineDemo; cls: Cls; label?: string }) {
  if (!c.intro) return null;
  return (
    <section className={cls.intro} id="about" aria-labelledby="intro-h">
      <h2 id="intro-h" className={cls.kicker}>
        {c.intro.heading ?? label ?? c.name}
      </h2>
      <p className={cls.introText} data-reveal>
        {c.intro.quote.text}
      </p>
    </section>
  );
}

/** A slow band of their own words. It holds still with reduced motion asked for. */
export function Band({ c, cls }: { c: EngineDemo; cls: Cls }) {
  if (!c.band) return null;
  const run = (hidden: boolean) => (
    <ul className={cls.bandRun} aria-hidden={hidden || undefined}>
      {c.band!.items.map((w) => (
        <li key={w}>{w}</li>
      ))}
    </ul>
  );
  return (
    <div className={cls.band}>
      <div className={cls.bandFade}>
        <div className={cls.bandTrack} style={{ '--n': c.band.items.length } as CSSProperties}>
          {run(false)}
          {run(true)}
        </div>
      </div>
    </div>
  );
}

/** What they offer, in their words, with a price only where they state one. */
export function Offers({ c, data, cls, id = 'offers' }: { c: EngineDemo; data: PageData; cls: Cls; id?: string }) {
  if (!c.offers) return null;
  return (
    <section className={cls.offers} id={id} aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className={cls.sectionTitle} data-reveal>
        {c.offers.heading}
      </h2>
      <ul className={cls.offerList}>
        {c.offers.items.map((it) => (
          <li key={it.name} className={cls.offer} data-reveal>
            {it.photo && data.images[it.photo] && (
              <div className={cls.offerPhoto} style={{ '--px': `${data.images[it.photo]!.width}px` } as CSSProperties} data-wipe>
                <Photo data={data} id={it.photo} sizes="(min-width: 1100px) 30vw, 100vw" />
              </div>
            )}
            <h3 className={cls.offerName}>{it.name}</h3>
            {it.meta && <p className={cls.offerMeta}>{it.meta}</p>}
            {it.text && <p className={cls.offerText}>{it.text}</p>}
            {it.price && <p className={cls.offerPrice}>{it.price}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Their photos after the signature, laid out in a set rhythm: one large, then pairs. Each is shown once. */
export function Gallery({ c, data, cls, heading }: { c: EngineDemo; data: PageData; cls: Cls; heading?: string }) {
  const ids = c.gallery.filter((id) => data.images[id]);
  if (ids.length < 2) return null;
  return (
    <section className={cls.gallery} id="photos" aria-label={heading ?? 'Photos'}>
      {ids.map((id, i) => (
        <figure key={id} className={cls.shot} data-shot={i % 3} style={{ '--px': `${data.images[id]!.width}px` } as CSSProperties} data-wipe>
          <Photo data={data} id={id} sizes={i % 3 === 0 ? '(min-width: 1100px) 64vw, 100vw' : '(min-width: 1100px) 32vw, 50vw'} />
        </figure>
      ))}
    </section>
  );
}

/** The people who run it, as they introduce themselves. */
export function People({ c, data, cls }: { c: EngineDemo; data: PageData; cls: Cls }) {
  if (!c.people) return null;
  return (
    <section className={cls.people} id="people" aria-labelledby="people-h">
      <h2 id="people-h" className={cls.sectionTitle} data-reveal>
        {c.people.heading}
      </h2>
      <ul className={cls.peopleList}>
        {c.people.items.map((p) => (
          <li key={p.name} className={cls.person} data-reveal>
            {p.photo && data.images[p.photo] && (
              <div className={cls.personPhoto}>
                <Photo data={data} id={p.photo} sizes="(min-width: 1100px) 20vw, 40vw" />
              </div>
            )}
            <h3 className={cls.personName}>{p.name}</h3>
            {p.role && <p className={cls.personRole}>{p.role}</p>}
            {p.text && <p className={cls.personText}>{p.text}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Practical things they ask of visitors, in their words. */
export function Practical({ c, cls }: { c: EngineDemo; cls: Cls }) {
  if (!c.practical) return null;
  return (
    <section className={cls.practical} id="practical" aria-labelledby="practical-h">
      <h2 id="practical-h" className={cls.sectionTitle} data-reveal>
        {c.practical.heading}
      </h2>
      <dl className={cls.practicalList}>
        {c.practical.items.map((it) => (
          <div key={it.label} data-reveal>
            <dt>{it.label}</dt>
            <dd>{it.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** The close of every engine page: their mark, and where the demo's words came from. */
export function Foot({ c, cls, children }: { c: EngineDemo; cls: Cls; children?: ReactNode }) {
  return (
    <footer className={cls.foot}>
      {children}
      <DemoFoot domain={c.domain} />
    </footer>
  );
}
