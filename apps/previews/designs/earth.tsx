import { Pic } from '@/components/Pic';
import { StickyBar } from '@/components/StickyBar';
import { pic, type PageData } from '@/lib/data';
import { demoNote } from '@/lib/offer';
import type { Design } from './types';
import s from './earth.module.css';

interface Content {
  brand: string;
  nav: { label: string; href: string }[];
  book: { label: string; href: string };
  call: { label: string; tel: string; display: string };
  email: string;
  hero: { place: string; title: string; text: string; primary: { label: string; href: string }; secondary: { label: string; href: string }; note: string };
  rides: { heading: string; lead: string; bookLabel: string; callLabel: string; limits: string[]; items: { name: string; duration: string; price: string; text: string; href: string | null }[] };
  lucy: { heading: string; quote: string; paragraphs: string[]; horsesHeading: string; horses: { image: string; name: string }[] };
  wear: { heading: string; items: { title: string; text: string }[] };
  here: { heading: string; address: string[]; notes: string[]; directions: { label: string; href: string } };
}

/** Warm and earthy: a linen panel beside the photo, tall condensed capitals, and the rides as a ladder from short to long. */
function Demo({ data }: { data: PageData }) {
  const c = data.demo as Content;
  return (
    <div className={`${s.root} has-sticky`}>
      <header className={s.top}>
        <a className={s.brand} href="#top">
          {c.brand}
        </a>
        <nav className={s.nav} aria-label="Sections">
          {c.nav.map((n) => (
            <a key={n.href} href={n.href}>
              {n.label}
            </a>
          ))}
        </nav>
        <a className={s.topCall} href={c.call.tel}>
          {c.call.display}
        </a>
      </header>

      <section className={s.hero} id="top">
        <div className={s.heroText}>
          <p className={s.place}>{c.hero.place}</p>
          <h1>{c.hero.title}</h1>
          <p className={s.heroLead}>{c.hero.text}</p>
          <div className={s.heroRow}>
            <a className={s.primary} href={c.hero.primary.href} rel="noopener">
              {c.hero.primary.label}
            </a>
            <a className={s.second} href={c.hero.secondary.href}>
              {c.hero.secondary.label}
            </a>
          </div>
        </div>
        <div className={s.heroPhoto}>
          <Pic pic={pic(data, 'hero')} sizes="(min-width: 900px) 58vw, 100vw" first />
          <p className={s.hand}>{c.hero.note}</p>
        </div>
      </section>

      <main>
        <section className={s.rides} id="rides" aria-labelledby="rides-h">
          <div className={s.wrap}>
            <h2 id="rides-h">{c.rides.heading}</h2>
            <p className={s.lead}>{c.rides.lead}</p>
            <ol className={s.ladder}>
              {c.rides.items.map((r) => (
                <li key={r.name} data-reveal>
                  <p className={s.time}>{r.duration}</p>
                  <div className={s.rideBody}>
                    <h3>{r.name}</h3>
                    <p>{r.text}</p>
                  </div>
                  <p className={s.price}>{r.price}</p>
                  {r.href ? (
                    <a className={s.rideBook} href={r.href} rel="noopener" aria-label={`${c.rides.bookLabel}: ${r.name}`}>
                      {c.rides.bookLabel}
                    </a>
                  ) : (
                    <a className={`${s.rideBook} ${s.rideCall}`} href={c.call.tel} aria-label={`${c.rides.callLabel}: ${r.name}`}>
                      {c.rides.callLabel}
                    </a>
                  )}
                </li>
              ))}
            </ol>
            <ul className={s.limits}>
              {c.rides.limits.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className={s.lucy} id="lucy" aria-labelledby="lucy-h">
          <div className={`${s.wrap} ${s.lucyGrid}`}>
            <div>
              <h2 id="lucy-h">{c.lucy.heading}</h2>
              <blockquote>{c.lucy.quote}</blockquote>
            </div>
            <div className={s.lucyText}>
              {c.lucy.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </div>
          <div className={s.wrap}>
            <h3 className={s.horsesH}>{c.lucy.horsesHeading}</h3>
            <ul className={s.horses}>
              {c.lucy.horses.map((h) => (
                <li key={h.name} data-reveal>
                  <Pic pic={pic(data, h.image)} sizes="(min-width: 900px) 240px, 44vw" />
                  <span>{h.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={s.wear} id="wear" aria-labelledby="wear-h">
          <div className={s.wrap}>
            <h2 id="wear-h">{c.wear.heading}</h2>
            <dl className={s.wearList}>
              {c.wear.items.map((w) => (
                <div key={w.title}>
                  <dt>{w.title}</dt>
                  <dd>{w.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className={s.here} id="here" aria-labelledby="here-h">
          <div className={`${s.wrap} ${s.hereGrid}`}>
            <div>
              <h2 id="here-h">{c.here.heading}</h2>
              <address>
                {c.here.address.map((l) => (
                  <span key={l}>{l}</span>
                ))}
              </address>
              <a className={s.primary} href={c.here.directions.href} rel="noopener">
                {c.here.directions.label}
              </a>
            </div>
            <div>
              <ul className={s.notes}>
                {c.here.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
              <p className={s.contactRow}>
                <a href={c.call.tel}>
                  {c.call.label} {c.call.display}
                </a>
                <a href={`mailto:${c.email}`}>{c.email}</a>
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className={s.foot}>
        <p className={s.brand}>{c.brand}</p>
        <p className="demo-foot-note">{demoNote(data.domain)}</p>
      </footer>

      <StickyBar main={c.book} call={{ label: c.call.label, tel: c.call.tel }} />
    </div>
  );
}

export const earth: Design = { Demo, fonts: ['bebas-neue-latin-400-normal', 'nunito-sans-latin-wght-normal'], heroSizes: '(min-width: 900px) 58vw, 100vw' };
