import { Pic } from '@/components/Pic';
import { StickyBar } from '@/components/StickyBar';
import { pic, type PageData } from '@/lib/data';
import { demoNote } from '@/lib/offer';
import type { Design } from './types';
import s from './waterline.module.css';

interface Content {
  sand: string;
  nav: { label: string; href: string }[];
  book: { label: string; href: string };
  call: { label: string; tel: string; display: string };
  email: string;
  hero: { place: string; title: string; sub: string; chips: { label: string; price: string | null; href: string }[] };
  why: { heading: string; question: string; paragraphs: string[]; points: string[] };
  trips: { heading: string; lead: string; button: string; items: { id: string; image: string; name: string; duration: string; price: string | null; per: string | null; text: string; href: string }[] };
  family: { heading: string; kicker: string; quote: string; paragraphs: string[]; names: string };
  faq: { heading: string; items: { q: string; a: string }[] };
  find: { heading: string; address: string[]; notes: string[]; pin: { x: number; y: number; label: string }; credit: string };
}

/** Calm, at water level: a full photo with a frosted card of trips, then long quiet bands. */
function Demo({ data }: { data: PageData }) {
  const c = data.demo as Content;
  return (
    <div className={`${s.root} has-sticky`} style={{ ['--sand' as string]: c.sand }}>
      <header className={s.top}>
        <a className={s.brand} href="#top">
          {data.name}
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
        <div className={s.heroPhoto}>
          <Pic pic={pic(data, 'hero')} sizes="100vw" first />
        </div>
        <div className={s.heroInner}>
          <p className={s.place}>{c.hero.place}</p>
          <h1>{c.hero.title}</h1>
          <p className={s.sub}>{c.hero.sub}</p>
          <div className={s.glass}>
            <ul className={s.chips}>
              {c.hero.chips.map((chip) => (
                <li key={chip.label}>
                  <a href={chip.href}>
                    <span>{chip.label}</span>
                    {chip.price && <b>{chip.price}</b>}
                  </a>
                </li>
              ))}
            </ul>
            <a className={s.book} href={c.book.href} rel="noopener">
              {c.book.label}
            </a>
          </div>
        </div>
      </section>

      <main>
        <section className={s.why} aria-labelledby="why-h">
          <div className={s.whyText} data-reveal>
            <h2 id="why-h">{c.why.heading}</h2>
            <p className={s.question}>{c.why.question}</p>
            {c.why.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <ul className={s.points}>
              {c.why.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          <div className={s.whyPhoto} data-reveal>
            <Pic pic={pic(data, 'why')} sizes="(min-width: 900px) 52vw, 100vw" />
          </div>
        </section>

        <section className={s.trips} id="trips" aria-labelledby="trips-h">
          <div className={s.wrap}>
            <h2 id="trips-h">{c.trips.heading}</h2>
            <p className={s.lead}>{c.trips.lead}</p>
            <ol className={s.tripList}>
              {c.trips.items.map((t) => (
                <li key={t.id} id={t.id} className={s.trip} data-reveal>
                  <div className={s.tripPhoto}>
                    <Pic pic={pic(data, t.image)} sizes="(min-width: 900px) 260px, 100vw" />
                  </div>
                  <div className={s.tripBody}>
                    <h3>{t.name}</h3>
                    <p className={s.duration}>{t.duration}</p>
                    <p>{t.text}</p>
                  </div>
                  <div className={s.tripEnd}>
                    {t.price && (
                      <p className={s.price}>
                        <b>{t.price}</b> {t.per}
                      </p>
                    )}
                    <a className={s.tripBook} href={t.href} rel="noopener" aria-label={`${c.trips.button}: ${t.name}`}>
                      {c.trips.button}
                    </a>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={s.family} id="family" aria-labelledby="family-h">
          <div className={s.familyPhoto}>
            <Pic pic={pic(data, 'family')} sizes="100vw" />
          </div>
          <div className={s.familyCard} data-reveal>
            <p className={s.kicker}>{c.family.kicker}</p>
            <h2 id="family-h">{c.family.heading}</h2>
            <p className={s.quote}>{c.family.quote}</p>
            {c.family.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <p className={s.names}>{c.family.names}</p>
          </div>
        </section>

        <section className={s.faq} id="questions" aria-labelledby="faq-h">
          <div className={s.narrow}>
            <h2 id="faq-h">{c.faq.heading}</h2>
            {c.faq.items.map((f, i) => (
              <details key={f.q} open={i === 0}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={s.find} id="find" aria-labelledby="find-h">
          <div className={s.findText} data-reveal>
            <h2 id="find-h">{c.find.heading}</h2>
            <address>
              {c.find.address.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </address>
            <ul>
              {c.find.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
            <div className={s.findActions}>
              <a className={s.callBig} href={c.call.tel}>
                {c.call.label} {c.call.display}
              </a>
              <a className={s.mail} href={`mailto:${c.email}`}>
                {c.email}
              </a>
            </div>
          </div>
          <figure className={s.map}>
            <div className={s.mapFrame}>
              <Pic pic={pic(data, 'map')} sizes="(min-width: 900px) 55vw, 100vw" />
              <span className={s.pin} style={{ left: `${c.find.pin.x}%`, top: `${c.find.pin.y}%` }}>
                <i aria-hidden="true" />
                <b>{c.find.pin.label}</b>
              </span>
            </div>
            <figcaption>{c.find.credit}</figcaption>
          </figure>
        </section>
      </main>

      <footer className={s.foot}>
        <p className={s.footBrand}>{data.name}</p>
        <p className="demo-foot-note">{demoNote(data.domain)}</p>
      </footer>

      <StickyBar main={{ label: c.book.label, href: c.book.href, external: true }} call={{ label: c.call.label, tel: c.call.tel }} />
    </div>
  );
}

export const waterline: Design = { Demo, fonts: ['figtree-latin-wght-normal'], heroSizes: '100vw' };
