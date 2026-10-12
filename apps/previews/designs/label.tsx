import { Pic } from '@/components/Pic';
import { StickyBar } from '@/components/StickyBar';
import { TastingForm } from '@/components/TastingForm';
import { pic, type PageData } from '@/lib/data';
import { demoNote } from '@/lib/offer';
import type { Design } from './types';
import s from './label.module.css';

interface Content {
  red: string;
  place: string;
  nav: { label: string; href: string }[];
  book: { label: string; href: string };
  call: { label: string; tel: string; display: string };
  email: string;
  hero: { title: string; line: string; intro: string };
  wines: { heading: string; lead: string; foot: string; items: { name: string; kind: string; note: string; by: string; price: string | null }[] };
  cellar: { heading: string; paragraphs: string[]; hours: { days: string; time: string }[]; hoursNote: string; form: Parameters<typeof TastingForm>[0]['labels'] };
  stay: { heading: string; lead: string; rooms: { image: string; name: string; text: string; price: string; per: string }[]; book: { label: string; href: string } };
  people: { heading: string; quote: string; paragraphs: string[]; caption: string };
  contact: { heading: string; address: string[]; phones: { who: string; display: string; tel: string }[]; between: string };
}

/** An editorial wine label: a centred masthead, thin rules, and a framed photograph that pans slowly. */
function Demo({ data }: { data: PageData }) {
  const c = data.demo as Content;
  return (
    <div className={`${s.root} has-sticky`} style={{ ['--red' as string]: c.red }}>
      <header className={s.mast} id="top">
        <p className={s.place}>{c.place}</p>
        <a className={s.name} href="#top">
          {data.name}
        </a>
        <nav className={s.nav} aria-label="Sections">
          {c.nav.map((n) => (
            <a key={n.href} href={n.href}>
              {n.label}
            </a>
          ))}
        </nav>
      </header>

      <section className={s.hero}>
        <h1>{c.hero.title}</h1>
        <p className={s.intro}>{c.hero.intro}</p>
        <div className={s.actions}>
          <a className={s.primary} href={c.book.href}>
            {c.book.label}
          </a>
          <a className={s.text} href={c.call.tel}>
            {c.call.display}
          </a>
        </div>
        <figure className={s.frame}>
          <div className={s.pan}>
            <Pic pic={pic(data, 'hero')} sizes="(min-width: 1100px) 1040px, 100vw" first />
          </div>
          <figcaption>{c.hero.line}</figcaption>
        </figure>
      </section>

      <main>
        <section className={s.section} id="wines" aria-labelledby="wines-h">
          <header className={s.head}>
            <h2 id="wines-h">{c.wines.heading}</h2>
            <p>{c.wines.lead}</p>
          </header>
          <ol className={s.labels}>
            {c.wines.items.map((w) => (
              <li key={w.name} className={s.wine} data-reveal>
                <span className={s.no}>{data.name}</span>
                <h3>{w.name}</h3>
                <p className={s.kind}>{w.kind}</p>
                <p className={s.note}>{w.note}</p>
                <p className={s.by}>{w.by}</p>
                {w.price && <p className={s.price}>{w.price}</p>}
              </li>
            ))}
          </ol>
          <p className={s.foot}>{c.wines.foot}</p>
        </section>

        <section className={`${s.section} ${s.cellar}`} id="cellar-door" aria-labelledby="cellar-h">
          <div className={s.cellarText}>
            <h2 id="cellar-h">{c.cellar.heading}</h2>
            {c.cellar.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <dl className={s.hours}>
              {c.cellar.hours.map((h) => (
                <div key={h.days}>
                  <dt>{h.days}</dt>
                  <dd>{h.time}</dd>
                </div>
              ))}
            </dl>
            <p className={s.small}>{c.cellar.hoursNote}</p>
          </div>
          <div className={s.cellarSide}>
            <div className={s.glasses} data-reveal>
              <Pic pic={pic(data, 'glasses')} sizes="(min-width: 900px) 300px, 60vw" />
            </div>
            <TastingForm labels={c.cellar.form} className={s.form} />
          </div>
        </section>

        <div className={s.band}>
          <Pic pic={pic(data, 'ridge')} sizes="100vw" />
        </div>

        <section className={s.section} id="stay" aria-labelledby="stay-h">
          <header className={s.head}>
            <h2 id="stay-h">{c.stay.heading}</h2>
            <p>{c.stay.lead}</p>
          </header>
          <div className={s.rooms}>
            {c.stay.rooms.map((r) => (
              <article key={r.name} className={s.room} data-reveal>
                <Pic pic={pic(data, r.image)} sizes="(min-width: 900px) 500px, 100vw" />
                <h3>{r.name}</h3>
                <p>{r.text}</p>
                <p className={s.rate}>
                  <b>{r.price}</b> {r.per}
                </p>
              </article>
            ))}
          </div>
          <p className={s.center}>
            <a className={s.primary} href={c.stay.book.href} rel="noopener">
              {c.stay.book.label}
            </a>
          </p>
        </section>

        <section className={`${s.section} ${s.people}`} id="people" aria-labelledby="people-h">
          <figure className={s.portrait} data-reveal>
            <Pic pic={pic(data, 'owners')} sizes="(min-width: 900px) 420px, 100vw" />
            <figcaption>{c.people.caption}</figcaption>
          </figure>
          <div>
            <h2 id="people-h">{c.people.heading}</h2>
            <blockquote>{c.people.quote}</blockquote>
            {c.people.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </section>

        <section className={`${s.section} ${s.contact}`} id="contact" aria-labelledby="contact-h">
          <h2 id="contact-h">{c.contact.heading}</h2>
          <div className={s.contactGrid}>
            <address>
              {c.contact.address.map((l) => (
                <span key={l}>{l}</span>
              ))}
              <span className={s.small}>{c.contact.between}</span>
            </address>
            <ul className={s.phones}>
              {c.contact.phones.map((p) => (
                <li key={p.tel}>
                  <span>{p.who}</span>
                  <a href={p.tel}>{p.display}</a>
                </li>
              ))}
              <li>
                <span>Email</span>
                <a href={`mailto:${c.email}`}>{c.email}</a>
              </li>
            </ul>
            <div className={s.vines}>
              <Pic pic={pic(data, 'vines')} sizes="(min-width: 900px) 320px, 100vw" />
            </div>
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <p className={s.name}>{data.name}</p>
        <p className="demo-foot-note">{demoNote(data.domain)}</p>
      </footer>

      <StickyBar main={{ label: c.book.label, href: c.book.href }} call={{ label: c.call.label, tel: c.call.tel }} />
    </div>
  );
}

export const label: Design = { Demo, fonts: ['newsreader-latin-wght-normal', 'open-sans-latin-wght-normal'], heroSizes: '(min-width: 1100px) 1040px, 100vw' };
