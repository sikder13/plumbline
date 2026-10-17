import type { CSSProperties, ReactNode } from 'react';
import type { EngineDemo } from '@plumbline/preview/engine';
import { DemoFoot } from '@/components/DemoFoot';
import { Pinned } from '@/components/Pinned';
import type { PageData } from '@/lib/data';
import { Go, Lines, Photo, ways, type Cls } from './kit';
import { SPLIT_SIZES } from './sizes';

/**
 * Sections every engine can carry. The markup is shared and each engine's stylesheet gives it its
 * own form. A section whose data is missing is not drawn, and nothing stands in for it.
 */

/**
 * The opening screen. A photo hero runs their photo full bleed; a split hero frames it on desktop and
 * runs it the full width of a phone; a typographic hero sets the headline big on a ground made from
 * their palette, with their best remaining photo as an inset below the action. The action always
 * comes before the facts, so a phone's first screen holds it. No drawing, icon or ornament.
 */
export function Hero({ c, data, cls }: { c: EngineDemo; data: PageData; cls: Cls }) {
  const w = ways(c);
  const kind = c.heroKind;
  const media = kind !== 'type' ? data.images.hero : undefined;
  const inset = kind === 'type' && c.hero.inset ? data.images[c.hero.inset] : undefined;
  return (
    <section className={cls.hero} data-kind={kind} id="top" data-hero>
      {media && (
        <div className={cls.heroMedia} style={{ '--px': `${media.width}px` } as CSSProperties}>
          <Photo data={data} id="hero" sizes={kind === 'photo' ? '100vw' : SPLIT_SIZES} first />
        </div>
      )}
      <header className={cls.heroTop}>
        <a className={cls.mark} href="#top">
          {c.wordmark ?? c.name}
        </a>
        <span className={cls.place}>
          {c.place.town}
          {c.place.region ? `, ${c.place.region}` : ''}
        </span>
      </header>
      <div className={cls.heroBody}>
        <div className={cls.heroWords}>
          <Lines lines={c.hero.lines} cls={cls} className={cls.heroTitle} />
          {c.hero.sub && <p className={cls.heroSub}>{c.hero.sub.text}</p>}
        </div>
        <div className={cls.heroActions}>
          <Go action={w.main} cls={cls} />
          {w.main.kind !== 'phone' && w.phone ? (
            <a className={cls.quietLink} href={w.phone.href}>
              Call {w.phone.label}
            </a>
          ) : (
            w.email &&
            w.main.kind !== 'email' && (
              <a className={cls.quietLink} href={w.email.href}>
                {w.email.label}
              </a>
            )
          )}
        </div>
        {c.hero.facts.length > 0 && (
          <dl className={cls.heroFacts} style={{ '--n': c.hero.facts.length } as CSSProperties}>
            {c.hero.facts.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      {inset && c.hero.inset && (
        <figure className={cls.heroInset} style={{ '--px': `${inset.width}px` } as CSSProperties} data-wipe>
          <Photo data={data} id={c.hero.inset} sizes="(min-width: 1100px) 40vw, 100vw" />
        </figure>
      )}
    </section>
  );
}

/**
 * Their account in three or four steps, each a photo and their words. On screens 600 px and wider
 * the steps take turns in one held frame, half a screen of scroll each and two screens at most; on
 * a phone they simply follow one another, each revealed as it arrives. The progress line under the
 * frame names each step: it counts the steps read, nothing else.
 */
export function Story({ c, data, cls, id }: { c: EngineDemo; data: PageData; cls: Cls; id: string }) {
  if (!c.story) return null;
  const steps = c.story.steps;
  return (
    <section className={cls.story} id={id} aria-labelledby="story-h">
      <Pinned steps={steps.length} className={cls.storyPin}>
        <h2 id="story-h" className={cls.storyTitle}>
          {c.story.heading}
        </h2>
        <ol className={cls.steps}>
          {steps.map((st, i) => (
            <li key={st.title} className={cls.step} data-step={i} data-state={i === 0 ? 'on' : 'off'} data-photo={st.photo && data.images[st.photo] ? '' : undefined}>
              {st.photo && data.images[st.photo] && (
                <div className={cls.stepPhoto} style={{ '--px': `${data.images[st.photo]!.width}px` } as CSSProperties}>
                  <Photo data={data} id={st.photo} sizes="(min-width: 1100px) 50vw, 100vw" />
                </div>
              )}
              <div className={cls.stepWords} data-reveal>
                {st.mark && <p className={cls.stepMark}>{st.mark}</p>}
                <h3 className={cls.stepTitle}>{st.title}</h3>
                <p className={cls.stepText}>{st.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <ol className={cls.progress} aria-hidden="true">
          {steps.map((st, i) => (
            <li key={st.title} data-step={i} data-state={i === 0 ? 'on' : 'off'}>
              {st.mark ?? st.title}
            </li>
          ))}
        </ol>
      </Pinned>
    </section>
  );
}

/** Their own words, as a short heading and a lede at reading size. */
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
            <p className={cls.personRole}>{p.role}</p>
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
