import type { CSSProperties } from 'react';
import { DemoFoot } from '@/components/DemoFoot';
import { MenuButton } from '@/components/MenuButton';
import { Pic } from '@/components/Pic';
import { Pinned } from '@/components/Pinned';
import { SideScroll } from '@/components/SideScroll';
import { StickyBar } from '@/components/StickyBar';
import { TastingForm } from '@/components/TastingForm';
import { pic, type PageData } from '@/lib/data';
import type { Design } from './types';
import s from './label.module.css';

interface Content {
  red: string;
  place: string;
  menu: { label: string; close: string; links: { label: string; href: string }[] };
  book: { label: string; href: string };
  call: { label: string; tel: string; display: string };
  email: string;
  hero: { words: string[]; intro: string };
  wines: { heading: string; lead: string; grounds: string[]; dark: boolean[]; items: { name: string; kind: string; note: string; by: string; price: string | null }[] };
  views: { heading: string; cue: string; images: string[] };
  cellar: { heading: string; text: string; fee: { amount: string; label: string }; hours: { days: string; time: string }[]; note: string; form: Parameters<typeof TastingForm>[0]['labels'] };
  stay: { heading: string; lead: string; rooms: { image: string; name: string; text: string; price: string; per: string }[]; book: { label: string; href: string } };
  people: { heading: string; quote: string; line: string; caption: string };
  contact: { heading: string; address: string[]; phones: { who: string; display: string; tel: string }[] };
}

/**
 * An editorial wine label. Slow and weighty, like turning a bottle in the hand: the headline is
 * revealed a word at a time, and one label is held in the middle of the screen while the four wines
 * turn through it and the ground behind shifts through the colours of the wines themselves.
 */
function Demo({ data }: { data: PageData }) {
  const c = data.demo as Content;
  // Each wine brings its own ground colour, and whether type on that ground should be light or dark.
  const grounds = Object.fromEntries(c.wines.grounds.flatMap((g, i) => [[`--g${i}`, g], [`--on${i}`, c.wines.dark[i] ? '#f4f1ea' : '#1b1a18']]));
  return (
    <div className={s.root} style={{ ['--red' as string]: c.red }}>
      <MenuButton className={s.menu} label={c.menu.label} close={c.menu.close} links={c.menu.links} />

      <section className={s.hero} id="top" data-hero>
        <div className={s.heroPhoto} data-parallax-frame>
          <Pic pic={pic(data, 'hero')} phone={data.images.heroPhone} sizes="100vw" first parallax />
        </div>
        <a className={s.name} href="#top">
          {data.name}
        </a>
        <div className={s.heroText}>
          <p className={s.place}>{c.place}</p>
          <h1 aria-label={c.hero.words.join(' ')}>
            {c.hero.words.map((w, i) => (
              <span key={w} className={s.word} aria-hidden="true">
                <span style={{ '--i': i } as CSSProperties}>{w}</span>
              </span>
            ))}
          </h1>
          <div className={s.heroRow}>
            <a className={s.primary} data-press data-magnetic href={c.book.href}>
              {c.book.label}
            </a>
            <p>{c.hero.intro}</p>
          </div>
        </div>
      </section>

      <main>
        <section id="wines" aria-labelledby="wines-h">
          <Pinned steps={c.wines.items.length} className={s.wines} style={grounds as CSSProperties}>
            <header className={s.winesHead}>
              <h2 id="wines-h">{c.wines.heading}</h2>
              <p>{c.wines.lead}</p>
            </header>
            <div className={s.bottleLabel}>
              <p className={s.maker}>{data.name}</p>
              <div className={s.turn}>
                {c.wines.items.map((w, i) => (
                  <article key={w.name} data-step={i} data-state={i === 0 ? 'on' : 'off'}>
                    <h3>
                      <span>{w.name}</span>
                    </h3>
                    <p className={s.kind}>{w.kind}</p>
                    <p className={s.note}>{w.note}</p>
                    <p className={s.by}>{w.by}</p>
                    {w.price && (
                      <p className={s.price} data-count>
                        {w.price}
                      </p>
                    )}
                  </article>
                ))}
              </div>
              <ol className={s.ticks} aria-hidden="true">
                {c.wines.items.map((w, i) => (
                  <li key={w.name} data-step={i} data-state={i === 0 ? 'on' : 'off'} />
                ))}
              </ol>
            </div>
          </Pinned>
        </section>

        <section className={s.views} aria-labelledby="views-h">
          <SideScroll
            className={s.side}
            label={c.views.heading}
            cue={c.views.cue}
            head={
              <h2 id="views-h" className={s.viewsHead} data-reveal>
                {c.views.heading}
              </h2>
            }
          >
            {c.views.images.map((key) => (
              <figure key={key} className={s.view} data-wipe>
                <Pic pic={pic(data, key)} sizes="(min-width: 900px) 360px, 70vw" />
              </figure>
            ))}
          </SideScroll>
        </section>

        <section className={s.cellar} id="cellar-door" aria-labelledby="cellar-h">
          <div className={s.cellarText}>
            <h2 id="cellar-h">{c.cellar.heading}</h2>
            <p className={s.lead}>{c.cellar.text}</p>
            <p className={s.fee} data-reveal>
              <b data-count>{c.cellar.fee.amount}</b>
              <span>{c.cellar.fee.label}</span>
            </p>
            <table className={s.hours}>
              <tbody>
                {c.cellar.hours.map((h) => (
                  <tr key={h.days}>
                    <th scope="row">{h.days}</th>
                    <td>{h.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={s.small}>{c.cellar.note}</p>
          </div>
          <TastingForm labels={c.cellar.form} className={s.form} />
        </section>

        <section className={s.stay} id="stay" aria-labelledby="stay-h">
          <header className={s.stayHead}>
            <h2 id="stay-h">{c.stay.heading}</h2>
            <p className={s.lead}>{c.stay.lead}</p>
          </header>
          <div className={s.rooms}>
            {c.stay.rooms.map((r) => (
              <article key={r.name} className={s.room} data-reveal>
                <div className={s.roomPhoto} data-wipe>
                  <Pic pic={pic(data, r.image)} sizes="(min-width: 900px) 220px, 34vw" />
                </div>
                <div>
                  <h3>{r.name}</h3>
                  <p>{r.text}</p>
                  <p className={s.rate}>
                    <b data-count>{r.price}</b> {r.per}
                  </p>
                </div>
              </article>
            ))}
          </div>
          <a className={s.outline} data-press href={c.stay.book.href} rel="noopener">
            {c.stay.book.label}
          </a>
        </section>

        <section className={s.people} id="people" aria-labelledby="people-h">
          <figure className={s.portrait} data-wipe>
            <Pic pic={pic(data, 'owners')} sizes="(min-width: 900px) 400px, 100vw" />
            <figcaption>{c.people.caption}</figcaption>
          </figure>
          <div className={s.peopleText}>
            <h2 id="people-h">{c.people.heading}</h2>
            <blockquote data-reveal>{c.people.quote}</blockquote>
            <p>{c.people.line}</p>
          </div>
        </section>

        <section className={s.contact} id="contact" aria-labelledby="contact-h">
          <h2 id="contact-h">{c.contact.heading}</h2>
          <address>
            {c.contact.address.map((l) => (
              <span key={l}>{l}</span>
            ))}
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
        </section>
      </main>

      <footer className={s.footer}>
        <p className={s.footName}>{data.name}</p>
        <DemoFoot domain={data.domain} />
      </footer>

      <StickyBar main={c.book} call={{ label: c.call.label, tel: c.call.tel }} />
    </div>
  );
}

export const label: Design = { Demo, fonts: ['newsreader-latin-wght-normal', 'open-sans-latin-wght-normal'], heroSizes: '100vw' };
