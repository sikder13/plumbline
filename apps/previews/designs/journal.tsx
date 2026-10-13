import type { CSSProperties } from 'react';
import { DemoFoot } from '@/components/DemoFoot';
import { Pic } from '@/components/Pic';
import { Pinned } from '@/components/Pinned';
import { RegionTours } from '@/components/RegionTours';
import { StickyBar } from '@/components/StickyBar';
import { pic, type PageData } from '@/lib/data';
import type { Design } from './types';
import s from './journal.module.css';

interface Content {
  nav: { label: string; href: string }[];
  enquire: { label: string; href: string };
  call: { label: string; tel: string; display: string };
  email: string;
  hero: { kicker: string; lines: string[]; linesPhone: string[]; badge: string; cta: { label: string; href: string } };
  tours: { heading: string; lead: string; from: string; book: string; regions: (Parameters<typeof RegionTours>[0]['regions'][number] & { image: string })[] };
  guide: { heading: string; name: string; role: string; quote: string; lines: string[] };
  trust: { items: { title: string; text: string }[]; ratingText: string; ratingSource: string; from: string };
  day: { heading: string; steps: { image: string; title: string; text: string }[] };
  end: { line: string; sub: string; email: string };
}

/**
 * A private guide, a premium day. Measured and editorial: things arrive the way a page is turned,
 * moving only up and down. The tours are a ruled list beside the region's photograph, and a
 * private day is told in three moments while one photograph gives way to the next.
 */
function Demo({ data }: { data: PageData }) {
  const c = data.demo as Content;
  return (
    <div className={s.root}>
      <nav className={s.nav} aria-label="Sections">
        {c.nav.map((n) => (
          <a key={n.href} href={n.href}>
            {n.label}
          </a>
        ))}
        <a className={s.navAsk} data-press data-magnetic href={c.enquire.href}>
          {c.enquire.label}
        </a>
      </nav>

      <section className={s.cover} id="top" data-hero>
        <div className={s.coverPhoto} data-parallax-frame>
          <Pic pic={pic(data, 'hero')} phone={data.images.heroPhone} sizes="100vw" first parallax />
        </div>
        <a className={s.brand} href="#top">
          {data.name}
        </a>
        <div className={s.coverText}>
          <p className={s.kicker}>{c.hero.kicker}</p>
          <h1 aria-label={c.hero.lines.join(' ')}>
            {/* The same words, broken one way for a wide screen and another for a narrow one. */}
            {([['wide', c.hero.lines], ['narrow', c.hero.linesPhone]] as const).map(([width, lines]) => (
              <span key={width} className={width === 'wide' ? s.wide : s.narrow} aria-hidden="true">
                {lines.map((l, i) => (
                  <span key={l} className={s.line}>
                    <span style={{ '--i': i } as CSSProperties}>{l}</span>
                  </span>
                ))}
              </span>
            ))}
          </h1>
          <div className={s.coverRow}>
            <a className={s.cta} data-press data-magnetic href={c.hero.cta.href}>
              {c.hero.cta.label}
            </a>
            <p className={s.badge}>{c.hero.badge}</p>
          </div>
        </div>
      </section>

      <main>
        <section className={s.tours} id="tours" aria-labelledby="tours-h">
          <header className={s.head} data-reveal>
            <h2 id="tours-h">{c.tours.heading}</h2>
            <p>{c.tours.lead}</p>
          </header>
          <RegionTours className={s.regions} regions={c.tours.regions} label={c.tours.heading} from={c.tours.from} book={c.tours.book} photos={c.tours.regions.map((r) => <Pic key={r.id} pic={pic(data, r.image)} sizes="(min-width: 900px) 46vw, 100vw" alt="" />)} />
        </section>

        <section className={s.guide} id="guide" aria-labelledby="guide-h">
          <figure className={s.guidePhoto} data-wipe data-parallax-frame>
            <Pic pic={pic(data, 'tom')} sizes="(min-width: 900px) 52vw, 100vw" parallax />
          </figure>
          <div className={s.guideText}>
            <h2 id="guide-h">{c.guide.heading}</h2>
            <blockquote data-reveal>{c.guide.quote}</blockquote>
            <p className={s.guideName}>
              {c.guide.name} <span>{c.guide.role}</span>
            </p>
            {c.guide.lines.map((l) => (
              <p key={l} data-reveal>
                {l}
              </p>
            ))}
          </div>
        </section>

        <section className={s.trust} aria-label="Accreditation and reviews">
          {c.trust.items.map((t) => (
            <div key={t.title} data-reveal>
              <h3>{t.title}</h3>
              <p>{t.text}</p>
            </div>
          ))}
          {data.rating && (
            <div data-reveal>
              <h3 className={s.rating}>
                <b data-count>{data.rating.value}</b>
                <span>
                  {c.trust.from} <span data-count>{String(data.rating.count)}</span> {c.trust.ratingText}
                </span>
              </h3>
              <p>{c.trust.ratingSource}</p>
            </div>
          )}
        </section>

        <section id="day" aria-labelledby="day-h">
          <Pinned steps={c.day.steps.length} className={s.day}>
            <div className={s.dayPhotos}>
              {c.day.steps.map((st, i) => (
                <div key={st.image} className={s.dayPhoto} data-step={i} data-state={i === 0 ? 'on' : 'off'}>
                  <Pic pic={pic(data, st.image)} sizes="(min-width: 900px) 54vw, 100vw" />
                </div>
              ))}
            </div>
            <div className={s.dayText}>
              <h2 id="day-h">{c.day.heading}</h2>
              <ol className={s.moments}>
                {c.day.steps.map((st, i) => (
                  <li key={st.title} data-step={i} data-state={i === 0 ? 'on' : 'off'}>
                    <h3>{st.title}</h3>
                    <div>
                      <p>{st.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </Pinned>
        </section>

        <section className={s.end} id="enquire" aria-label="Enquire">
          <p className={s.endLine} data-reveal>
            {c.end.line}
          </p>
          <p>{c.end.sub}</p>
          <a className={s.endMail} href={`mailto:${c.end.email}`}>
            {c.end.email}
          </a>
        </section>
      </main>

      <footer className={s.foot}>
        <p className={s.footBrand}>{data.name}</p>
        <DemoFoot domain={data.domain} />
      </footer>

      <StickyBar main={c.enquire} call={{ label: c.call.label, tel: c.call.tel }} />
    </div>
  );
}

export const journal: Design = { Demo, fonts: ['playfair-display-latin-wght-normal', 'montserrat-latin-wght-normal'], heroSizes: '100vw' };
