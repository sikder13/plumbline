import type { CSSProperties } from 'react';
import { DemoFoot } from '@/components/DemoFoot';
import { Pic } from '@/components/Pic';
import { Pinned } from '@/components/Pinned';
import { SideScroll } from '@/components/SideScroll';
import { StickyBar } from '@/components/StickyBar';
import { pic, type PageData } from '@/lib/data';
import type { Design } from './types';
import s from './waterline.module.css';

interface Content {
  sand: string;
  nav: { label: string; href: string }[];
  book: { label: string; href: string };
  call: { label: string; tel: string; display: string };
  email: string;
  hero: { place: string; lines: string[]; sub: string; chips: { label: string; price: string; href: string }[] };
  route: { heading: string; stops: { image: string; label: string; text: string }[] };
  why: { heading: string; lines: string[] };
  trips: { heading: string; lead: string; button: string; open: string; per: string; cue: string; items: { id: string; image: string; name: string; duration: string; price: string | null; text: string; href: string }[] };
  family: { heading: string; quote: string; paragraphs: string[]; names: string };
  faq: { heading: string; items: { q: string; a: string }[] };
  find: { heading: string; address: string[]; notes: string[]; pin: { x: number; y: number; label: string }; credit: string };
}

/**
 * Calm water, open space. Everything moves slowly and mostly sideways, like drifting: the headline
 * rises over the water, a morning's paddle opens photograph by photograph as a ripple widens, and
 * the trips float past as tall cards.
 */
function Demo({ data }: { data: PageData }) {
  const c = data.demo as Content;
  const book = { href: c.book.href, rel: 'noopener' };
  return (
    <div className={s.root} style={{ ['--sand' as string]: c.sand }}>
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
        <div className={s.heroPhoto} data-parallax-frame>
          <Pic pic={pic(data, 'hero')} phone={data.images.heroPhone} sizes="100vw" first parallax />
        </div>
        <header className={s.top}>
          <a className={s.brand} href="#top">
            {data.name}
          </a>
          <a className={s.topCall} href={c.call.tel}>
            {c.call.display}
          </a>
        </header>
        <div className={s.heroHead}>
          <p className={s.place}>{c.hero.place}</p>
          <h1 aria-label={c.hero.lines.join(' ')}>
            {c.hero.lines.map((l, i) => (
              <span key={l} className={s.line} aria-hidden="true">
                <span style={{ '--i': i } as CSSProperties}>{l}</span>
              </span>
            ))}
          </h1>
          <p className={s.sub}>{c.hero.sub}</p>
        </div>
        <div className={s.glass}>
          <ul>
            {c.hero.chips.map((chip) => (
              <li key={chip.label}>
                <a href={chip.href}>
                  <span>{chip.label}</span>
                  <b>{chip.price}</b>
                </a>
              </li>
            ))}
          </ul>
          <a className={s.book} data-press {...book}>
            {c.book.label}
          </a>
        </div>
      </section>

      <main>
        <section aria-labelledby="route-h" className={s.routeWrap}>
          <Pinned steps={c.route.stops.length} className={s.route}>
            {c.route.stops.map((stop, i) => (
              <div key={stop.image} className={s.routePhoto} data-step={i} data-state={i === 0 ? 'on' : 'off'}>
                <Pic pic={pic(data, stop.image)} sizes="100vw" />
              </div>
            ))}
            <h2 id="route-h" className={s.routeHead}>
              {c.route.heading}
            </h2>
            <div className={s.routeFoot}>
              <div className={s.captions}>
                {c.route.stops.map((stop, i) => (
                  <p key={stop.label} data-step={i} data-state={i === 0 ? 'on' : 'off'}>
                    {stop.text}
                  </p>
                ))}
              </div>
              <ol className={s.horizon}>
                {c.route.stops.map((stop, i) => (
                  <li key={stop.label} data-step={i} data-state={i === 0 ? 'on' : 'off'}>
                    {stop.label}
                  </li>
                ))}
                <li className={s.marker} aria-hidden="true" />
              </ol>
            </div>
          </Pinned>
        </section>

        <section className={s.trips} id="trips" aria-labelledby="trips-h">
          <SideScroll
            className={s.side}
            label={c.trips.heading}
            cue={c.trips.cue}
            head={
              <header className={s.head}>
                <h2 id="trips-h">{c.trips.heading}</h2>
                <p>{c.trips.lead}</p>
              </header>
            }
          >
            {c.trips.items.map((t) => (
              <article key={t.id} id={t.id} className={s.card}>
                <details>
                  <summary>
                    <span className={s.cardPhoto} data-wipe>
                      <Pic pic={pic(data, t.image)} sizes="(min-width: 900px) 340px, 76vw" />
                    </span>
                    <span className={s.face}>
                      <span className={s.name}>{t.name}</span>
                      <span className={s.when}>{t.duration}</span>
                      {t.price && (
                        <span className={s.price}>
                          <b data-count>{t.price}</b> {c.trips.per}
                        </span>
                      )}
                      <span className={s.open}>{c.trips.open}</span>
                    </span>
                  </summary>
                  <div className={s.sheet}>
                    <p>{t.text}</p>
                    <a href={t.href} rel="noopener" data-press aria-label={`${c.trips.button}: ${t.name}`}>
                      {c.trips.button}
                    </a>
                  </div>
                </details>
              </article>
            ))}
          </SideScroll>
        </section>

        <section className={s.why} aria-labelledby="why-h" data-parallax-frame>
          <div className={s.whyPhoto}>
            <Pic pic={pic(data, 'why')} sizes="100vw" parallax />
          </div>
          <div className={s.whyText}>
            <h2 id="why-h">{c.why.heading}</h2>
            <ul>
              {c.why.lines.map((l) => (
                <li key={l} data-reveal>
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={s.family} id="family" aria-labelledby="family-h">
          <div className={s.familyPhoto} data-wipe>
            <Pic pic={pic(data, 'family')} sizes="100vw" />
          </div>
          <div className={s.familyCard} data-reveal>
            <h2 id="family-h">{c.family.heading}</h2>
            <blockquote>{c.family.quote}</blockquote>
            {c.family.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <p className={s.names}>{c.family.names}</p>
          </div>
        </section>

        <section className={s.faq} id="questions" aria-labelledby="faq-h">
          <h2 id="faq-h">{c.faq.heading}</h2>
          {c.faq.items.map((f, i) => (
            <details key={f.q} open={i === 0}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </section>

        <section className={s.find} id="find" aria-labelledby="find-h">
          <figure className={s.map}>
            <div className={s.mapFrame}>
              <Pic pic={pic(data, 'map')} sizes="100vw" />
              <span className={s.pin}>
                <i aria-hidden="true" />
                <b>{c.find.pin.label}</b>
              </span>
            </div>
            <figcaption>{c.find.credit}</figcaption>
          </figure>
          <div className={s.findText} data-reveal>
            <h2 id="find-h">{c.find.heading}</h2>
            <address>
              {c.find.address.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </address>
            <p>{c.find.notes.join(' ')}</p>
            <p className={s.reach}>
              <a href={c.call.tel}>{c.call.display}</a>
              <a href={`mailto:${c.email}`}>{c.email}</a>
            </p>
          </div>
        </section>
      </main>

      <footer className={s.foot}>
        <p className={s.brand}>{data.name}</p>
        <DemoFoot domain={data.domain} />
      </footer>

      <StickyBar main={{ label: c.book.label, href: c.book.href, external: true }} call={{ label: c.call.label, tel: c.call.tel }} />
    </div>
  );
}

export const waterline: Design = { Demo, fonts: ['figtree-latin-wght-normal'], heroSizes: '100vw' };
