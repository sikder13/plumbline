import type { CSSProperties } from 'react';
import { CoastMap } from '@/components/CoastMap';
import { DemoFoot } from '@/components/DemoFoot';
import { HeroVideo } from '@/components/HeroVideo';
import { Pic } from '@/components/Pic';
import { SideScroll } from '@/components/SideScroll';
import { StickyBar } from '@/components/StickyBar';
import { pic, type PageData } from '@/lib/data';
import type { Design } from './types';
import s from './coastal.module.css';

interface Content {
  wordmark: string[];
  nav: { label: string; href: string }[];
  book: { label: string; href: string };
  call: { label: string; tel: string; display: string };
  email: string;
  hero: { place: string; lines: string[]; line: string };
  intro: { text: string; ratingLabel: string; ratingUnit: string; ratingSource: string };
  coast: { heading: string; lead: string } & Pick<Parameters<typeof CoastMap>[0], 'viewBox' | 'land' | 'islands' | 'spots' | 'credit'>;
  trips: { heading: string; lead: string; cue: string; items: { image: string; name: string; duration: string; text: string; prices: { who: string; price: string }[]; note?: string }[] };
  us: { heading: string; statement: string; caption: string; people: { name: string; text: string }[] };
  book_section: { heading: string; steps: { title: string; text: string }[]; provided: string };
}

function Wordmark({ lines }: { lines: string[] }) {
  return (
    <span className={s.wordmark}>
      {lines.map((l) => (
        <span key={l}>{l}</span>
      ))}
    </span>
  );
}

/**
 * Bold, salty, local. Their own film runs under a headline that rises line by line; the coast is
 * held in view while its spots light up one after another; the trips travel sideways with prices
 * set as large as headlines.
 */
function Demo({ data }: { data: PageData }) {
  const c = data.demo as Content;
  const book = { href: c.book.href, rel: 'noopener' };
  return (
    <div className={s.root}>
      <nav className={s.nav} aria-label="Sections">
        <a className={s.navName} href="#top">
          {data.name}
        </a>
        <span className={s.navLinks}>
          {c.nav.map((n) => (
            <a key={n.href} href={n.href}>
              {n.label}
            </a>
          ))}
        </span>
        <a className={s.navBook} data-press data-magnetic {...book}>
          {c.book.label}
        </a>
      </nav>

      <section className={s.hero} id="top" data-hero>
        <div className={s.heroMedia}>
          <Pic pic={pic(data, 'hero')} phone={data.images.heroPhone} sizes="100vw" first />
          {data.video && <HeroVideo src={data.video} className={s.film} />}
        </div>
        <a className={s.heroMark} href="#top" aria-label={data.name}>
          <Wordmark lines={c.wordmark} />
        </a>
        <div className={s.heroText}>
          <p className={s.place}>{c.hero.place}</p>
          <h1 aria-label={c.hero.lines.join(' ')}>
            {c.hero.lines.map((l, i) => (
              <span key={l} className={s.line} aria-hidden="true">
                <span style={{ '--i': i } as CSSProperties}>{l}</span>
              </span>
            ))}
          </h1>
          <p className={s.sub}>{c.hero.line}</p>
          <a className={s.red} data-press data-magnetic {...book}>
            {c.book.label}
          </a>
        </div>
      </section>

      <main>
        <section className={s.intro} aria-label="What you will see">
          <p className={s.statement} data-reveal>
            {c.intro.text}
          </p>
          {data.rating && (
            <p className={s.rating} data-reveal>
              <b data-count>{data.rating.value}</b>
              <span>
                {c.intro.ratingLabel} <span data-count>{String(data.rating.count)}</span> {c.intro.ratingUnit} <small>{c.intro.ratingSource}</small>
              </span>
            </p>
          )}
        </section>

        <section id="coast" aria-labelledby="coast-h" className={s.coast}>
          <CoastMap
            className={s.story}
            viewBox={c.coast.viewBox}
            land={c.coast.land}
            islands={c.coast.islands}
            spots={c.coast.spots}
            credit={c.coast.credit}
            head={
              <header className={s.storyHead}>
                <h2 id="coast-h">{c.coast.heading}</h2>
                <p>{c.coast.lead}</p>
              </header>
            }
          />
        </section>

        <section className={s.trips} id="trips" aria-labelledby="trips-h">
          <SideScroll
            className={s.side}
            label={c.trips.heading}
            cue={c.trips.cue}
            head={
              <header className={s.tripsHead}>
                <h2 id="trips-h">{c.trips.heading}</h2>
                <p>{c.trips.lead}</p>
                <a className={s.red} data-press data-magnetic {...book}>
                  {c.book.label}
                </a>
              </header>
            }
          >
            {c.trips.items.map((t) => (
              <article key={t.name} className={s.panel}>
                <div className={s.panelPhoto} data-wipe>
                  <Pic pic={pic(data, t.image)} sizes="(min-width: 900px) 46vw, 84vw" />
                </div>
                <div className={s.panelBody}>
                  <p className={s.duration}>{t.duration}</p>
                  <h3>{t.name}</h3>
                  <p className={s.panelText}>{t.text}</p>
                  {t.prices.length > 0 ? (
                    <dl className={s.prices}>
                      {t.prices.map((p) => (
                        <div key={p.who}>
                          <dd data-count>{p.price}</dd>
                          <dt>{p.who}</dt>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className={s.poa}>{t.note}</p>
                  )}
                </div>
              </article>
            ))}
          </SideScroll>
        </section>

        <section className={s.us} id="us" aria-labelledby="us-h">
          <figure className={s.usPhoto} data-wipe data-parallax-frame>
            <Pic pic={pic(data, 'team')} sizes="(min-width: 900px) 46vw, 100vw" parallax />
            <figcaption>{c.us.caption}</figcaption>
          </figure>
          <div className={s.usText}>
            <h2 id="us-h">{c.us.heading}</h2>
            <p className={s.usStatement} data-reveal>
              {c.us.statement}
            </p>
            {c.us.people.map((p) => (
              <div key={p.name} className={s.person} data-reveal>
                <h3>{p.name}</h3>
                <p>{p.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={s.book} id="book" aria-labelledby="book-h">
          <div className={s.bookPhoto} data-parallax-frame>
            <Pic pic={pic(data, 'snorkel')} sizes="100vw" parallax />
          </div>
          <div className={s.bookCard} data-reveal>
            <h2 id="book-h">{c.book_section.heading}</h2>
            <ol>
              {c.book_section.steps.map((st) => (
                <li key={st.title}>
                  <h3>{st.title}</h3>
                  <p>{st.text}</p>
                </li>
              ))}
            </ol>
            <p className={s.provided}>{c.book_section.provided}</p>
            <div className={s.bookRow}>
              <a className={s.red} data-press data-magnetic {...book}>
                {c.book.label}
              </a>
              <span className={s.reach}>
                <a href={c.call.tel}>{c.call.display}</a>
                <a href={`mailto:${c.email}`}>{c.email}</a>
              </span>
            </div>
          </div>
        </section>
      </main>

      <footer className={s.foot}>
        <Wordmark lines={c.wordmark} />
        <DemoFoot domain={data.domain} />
      </footer>

      <StickyBar main={{ label: c.book.label, href: c.book.href, external: true }} call={{ label: c.call.label, tel: c.call.tel }} />
    </div>
  );
}

export const coastal: Design = { Demo, fonts: ['dm-serif-display-latin-400-normal', 'karla-latin-wght-normal'], heroSizes: '100vw' };
