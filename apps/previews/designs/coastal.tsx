import { CoastMap } from '@/components/CoastMap';
import { Pic } from '@/components/Pic';
import { StickyBar } from '@/components/StickyBar';
import { pic, type PageData } from '@/lib/data';
import { demoNote } from '@/lib/offer';
import type { Design } from './types';
import s from './coastal.module.css';

interface Content {
  wordmark: string[];
  nav: { label: string; href: string }[];
  book: { label: string; href: string };
  call: { label: string; tel: string; display: string };
  email: string;
  hero: { place: string; title: string; line: string };
  coast: { heading: string; lead: string } & Omit<Parameters<typeof CoastMap>[0], 'className'>;
  trips: { heading: string; button: string; items: { image: string; name: string; duration: string | null; prices: { who: string; price: string | null }[]; text: string }[] };
  us: { heading: string; lead: string; people: { name: string; text: string }[] };
  board: { heading: string; items: { title: string; text: string }[] };
  end: { heading: string; text: string; button: string };
}

function Wordmark({ lines, className }: { lines: string[]; className?: string }) {
  return (
    <span className={`${s.wordmark} ${className ?? ''}`}>
      {lines.map((l) => (
        <span key={l}>{l}</span>
      ))}
    </span>
  );
}

/** Bold and coastal: a tall photo with a very large serif headline, then the coast itself as a map to tap. */
function Demo({ data }: { data: PageData }) {
  const c = data.demo as Content;
  return (
    <div className={`${s.root} has-sticky`}>
      <section className={s.hero} id="top">
        <div className={s.heroPhoto}>
          <Pic pic={pic(data, 'hero')} sizes="100vw" first />
        </div>
        <header className={s.top}>
          <a href="#top" aria-label={data.name} className={s.homeLink}>
            <Wordmark lines={c.wordmark} />
          </a>
          <nav className={s.nav} aria-label="Sections">
            {c.nav.map((n) => (
              <a key={n.href} href={n.href}>
                {n.label}
              </a>
            ))}
          </nav>
          <a className={s.topBook} href={c.book.href} rel="noopener">
            {c.book.label}
          </a>
        </header>
        <div className={s.heroText}>
          <p className={s.place}>{c.hero.place}</p>
          <h1>{c.hero.title}</h1>
          <p className={s.line}>{c.hero.line}</p>
        </div>
      </section>

      <main>
        <section className={s.coast} id="coast" aria-labelledby="coast-h">
          <div className={s.wrap}>
            <h2 id="coast-h">{c.coast.heading}</h2>
            <p className={s.lead}>{c.coast.lead}</p>
            <CoastMap className={s.map} viewBox={c.coast.viewBox} land={c.coast.land} islands={c.coast.islands} spots={c.coast.spots} />
          </div>
        </section>

        <section className={s.trips} id="trips" aria-labelledby="trips-h">
          <div className={s.wrap}>
            <h2 id="trips-h">{c.trips.heading}</h2>
            {c.trips.items.map((t, i) => (
              <article key={t.name} className={`${s.trip} ${i % 2 ? s.flip : ''}`} data-reveal>
                <div className={s.tripPhoto}>
                  <Pic pic={pic(data, t.image)} sizes="(min-width: 900px) 56vw, 100vw" />
                </div>
                <div className={s.tripBody}>
                  {t.duration && <p className={s.duration}>{t.duration}</p>}
                  <h3>{t.name}</h3>
                  <p>{t.text}</p>
                  <ul className={s.prices}>
                    {t.prices.map((p) => (
                      <li key={p.who}>
                        <span>{p.who}</span>
                        {p.price && <b>{p.price}</b>}
                      </li>
                    ))}
                  </ul>
                  <a className={s.red} href={c.book.href} rel="noopener" aria-label={`${c.trips.button}: ${t.name}`}>
                    {c.trips.button}
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={s.us} id="us" aria-labelledby="us-h">
          <div className={`${s.wrap} ${s.usGrid}`}>
            <div className={s.usPhoto} data-reveal>
              <Pic pic={pic(data, 'team')} sizes="(min-width: 900px) 440px, 100vw" />
            </div>
            <div>
              <h2 id="us-h">{c.us.heading}</h2>
              <p className={s.lead}>{c.us.lead}</p>
              {c.us.people.map((p) => (
                <div key={p.name} className={s.person}>
                  <h3>{p.name}</h3>
                  <p>{p.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={s.board} id="board" aria-labelledby="board-h">
          <div className={s.boardPhoto}>
            <Pic pic={pic(data, 'snorkel')} sizes="100vw" />
          </div>
          <div className={s.wrap}>
            <h2 id="board-h">{c.board.heading}</h2>
            <dl className={s.list}>
              {c.board.items.map((b) => (
                <div key={b.title} data-reveal>
                  <dt>{b.title}</dt>
                  <dd>{b.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className={s.end} aria-labelledby="end-h">
          <div className={`${s.wrap} ${s.endGrid}`}>
            <div>
              <h2 id="end-h">{c.end.heading}</h2>
              <p>{c.end.text}</p>
              <div className={s.endRow}>
                <a className={s.red} href={c.book.href} rel="noopener">
                  {c.end.button}
                </a>
                <a className={s.plain} href={c.call.tel}>
                  {c.call.label} {c.call.display}
                </a>
              </div>
              <a className={s.mail} href={`mailto:${c.email}`}>
                {c.email}
              </a>
            </div>
            <div className={s.sign}>
              <Pic pic={pic(data, 'sign')} sizes="(min-width: 900px) 320px, 70vw" />
            </div>
          </div>
        </section>
      </main>

      <footer className={s.foot}>
        <Wordmark lines={c.wordmark} />
        <p className="demo-foot-note">{demoNote(data.domain)}</p>
      </footer>

      <StickyBar main={{ label: c.book.label, href: c.book.href, external: true }} call={{ label: c.call.label, tel: c.call.tel }} />
    </div>
  );
}

export const coastal: Design = { Demo, fonts: ['dm-serif-display-latin-400-normal', 'karla-latin-wght-normal'], heroSizes: '100vw' };
