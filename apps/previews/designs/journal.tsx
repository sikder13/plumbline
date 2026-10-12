import { Pic } from '@/components/Pic';
import { Regions } from '@/components/Regions';
import { StickyBar } from '@/components/StickyBar';
import { pic, type PageData } from '@/lib/data';
import { demoNote } from '@/lib/offer';
import type { Design } from './types';
import s from './journal.module.css';

interface Tour {
  name: string;
  duration: string;
  group: string;
  price: string;
  href: string;
}

interface Content {
  nav: { label: string; href: string }[];
  enquire: { label: string; href: string };
  call: { label: string; tel: string; display: string };
  email: string;
  hero: { kicker: string; title: string; badge: string; cta: { label: string; href: string } };
  tours: { heading: string; lead: string; button: string; from: string; note: string; regions: { id: string; label: string; image: string; blurb: string; tours: Tour[] }[] };
  guide: { heading: string; name: string; role: string; quote: string; paragraphs: string[]; name_note: string };
  marks: { heading: string; items: { title: string; text: string }[] };
  day: { heading: string; steps: { title: string; text: string }[] };
  end: { heading: string; text: string; email: string; call: string };
}

/** A travel magazine: a cover photo with a serif headline, then features set over landscape photography. */
function Demo({ data }: { data: PageData }) {
  const c = data.demo as Content;
  return (
    <div className={`${s.root} has-sticky`}>
      <section className={s.cover} id="top">
        <div className={s.coverPhoto}>
          <Pic pic={pic(data, 'hero')} sizes="100vw" first />
        </div>
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
        </header>
        <div className={s.coverText}>
          <p className={s.kicker}>{c.hero.kicker}</p>
          <h1>{c.hero.title}</h1>
          <div className={s.coverRow}>
            <a className={s.cta} href={c.hero.cta.href}>
              {c.hero.cta.label}
            </a>
            <p className={s.badge}>{c.hero.badge}</p>
          </div>
        </div>
      </section>

      <main>
        <section className={s.tours} id="tours" aria-labelledby="tours-h">
          <div className={s.wrap}>
            <h2 id="tours-h">{c.tours.heading}</h2>
            <p className={s.lead}>{c.tours.lead}</p>
          </div>
          <Regions
            className={s.regions}
            label={c.tours.heading}
            tabs={c.tours.regions.map((r) => ({ id: r.id, label: r.label }))}
            panels={c.tours.regions.map((r) => (
              <div key={r.id} className={s.region}>
                <div className={s.regionPhoto}>
                  <Pic pic={pic(data, r.image)} sizes="100vw" />
                </div>
                <div className={s.regionInner}>
                  <p className={s.blurb}>{r.blurb}</p>
                  <ul className={s.cards}>
                    {r.tours.map((t) => (
                      <li key={t.name} className={s.card}>
                        <h3>{t.name}</h3>
                        <dl>
                          <div>
                            <dt>Duration</dt>
                            <dd>{t.duration}</dd>
                          </div>
                          <div>
                            <dt>Group</dt>
                            <dd>{t.group}</dd>
                          </div>
                        </dl>
                        <p className={s.price}>
                          <span>{c.tours.from}</span> <b>{t.price}</b>
                        </p>
                        <a href={t.href} rel="noopener" aria-label={`${c.tours.button}: ${t.name}`}>
                          {c.tours.button}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          />
          <p className={`${s.wrap} ${s.note}`}>{c.tours.note}</p>
        </section>

        <section className={s.guide} id="guide" aria-labelledby="guide-h">
          <div className={s.guidePhoto} data-reveal>
            <Pic pic={pic(data, 'tom')} sizes="(min-width: 900px) 44vw, 100vw" />
          </div>
          <div className={s.guideText} data-reveal>
            <h2 id="guide-h">{c.guide.heading}</h2>
            <p className={s.guideName}>
              {c.guide.name} <span>{c.guide.role}</span>
            </p>
            <blockquote>{c.guide.quote}</blockquote>
            {c.guide.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <p className={s.aside}>{c.guide.name_note}</p>
          </div>
        </section>

        <section className={s.marks} aria-labelledby="marks-h">
          <div className={s.wrap}>
            <h2 id="marks-h">{c.marks.heading}</h2>
            <div className={s.markRow}>
              {c.marks.items.map((m) => (
                <div key={m.title} className={s.mark} data-reveal>
                  <h3>{m.title}</h3>
                  <p>{m.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={s.day} id="day" aria-labelledby="day-h">
          <div className={s.wrap}>
            <h2 id="day-h">{c.day.heading}</h2>
            <div className={s.dayGrid}>
              <ol className={s.steps}>
                {c.day.steps.map((st) => (
                  <li key={st.title} data-reveal>
                    <h3>{st.title}</h3>
                    <p>{st.text}</p>
                  </li>
                ))}
              </ol>
              <div className={s.dayPhotos}>
                <Pic pic={pic(data, 'vehicle')} sizes="(min-width: 900px) 40vw, 100vw" />
                <Pic pic={pic(data, 'lunch')} sizes="(min-width: 900px) 40vw, 100vw" />
              </div>
            </div>
          </div>
        </section>

        <section className={s.end} id="enquire" aria-labelledby="end-h">
          <h2 id="end-h">{c.end.heading}</h2>
          <p>{c.end.text}</p>
          <div className={s.endRow}>
            <a className={s.cta} href={`mailto:${c.email}`}>
              {c.end.email}
            </a>
            <a className={s.ghost} href={c.call.tel}>
              {c.end.call} {c.call.display}
            </a>
          </div>
          <p className={s.endMail}>
            <a href={`mailto:${c.email}`}>{c.email}</a>
          </p>
        </section>
      </main>

      <footer className={s.foot}>
        <p className={s.brand}>{data.name}</p>
        <p className="demo-foot-note">{demoNote(data.domain)}</p>
      </footer>

      <StickyBar main={c.enquire} call={{ label: c.call.label, tel: c.call.tel }} />
    </div>
  );
}

export const journal: Design = { Demo, fonts: ['playfair-display-latin-wght-normal', 'montserrat-latin-wght-normal'], heroSizes: '100vw' };
