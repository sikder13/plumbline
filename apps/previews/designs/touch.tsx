import type { CSSProperties } from 'react';
import { Cover } from '@/components/os/Cover';
import type { PageData } from '@/lib/data';
import { SENDER, SENDER_SITE, demoNote } from '@/lib/offer';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Content {
  town: string;
  phone: { tel: string; display: string };
  email: string;
  book: string;
  voucher: string;
  hello: string;
  welcome: string;
  letter: string;
  tailor: string;
  needs: { name: string; line: string }[];
  styles: string[];
  about: string;
}

/**
 * RSM Massage NZ, Dunedin. One practitioner, so the page is her letter: "Hi I'm Bex", in a hand, on a
 * calm dark ground, her own words about tailoring each session, the three needs she names, and her
 * real Timely booking page at every turn.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('touch', ['Caveat', 'Red Hat Display']);
  const c = data.demo as Content;
  return (
    <div className={s.root}>
      <style href="touch" precedence="design">
        {css}
      </style>

      <header className={s.top}>
        <p className={s.brand}>RSM Massage NZ</p>
        <a className={s.topCall} href={c.phone.tel} data-press>
          Call {c.phone.display}
        </a>
      </header>

      <section className={s.hero} data-hero aria-labelledby="hero-h">
        <p className={s.place}>Massage therapy, {c.town}</p>
        <h1 id="hero-h" className={s.hello}>
          <span className={s.write}>{c.hello}</span>
        </h1>
        <p className={s.welcome}>{c.welcome}</p>
        <p className={s.letter}>{c.letter}</p>
        <div className={s.acts} data-covers>
          <a className={s.primary} href={c.book} data-press>
            Book a session
          </a>
          <a className={s.secondary} href={c.voucher} data-press>
            Buy a gift voucher
          </a>
        </div>
      </section>

      <main>
        <section className={s.tailor} aria-labelledby="tailor-h">
          <h2 id="tailor-h" className={s.kicker}>
            Every session, tailored
          </h2>
          <p className={s.tailorText} data-reveal>
            {c.tailor}
          </p>
          <div className={s.scale} aria-hidden="true">
            <span>gentle strokes</span>
            <i />
            <span>deeper tissue work</span>
          </div>
        </section>

        <section className={s.needs} aria-labelledby="needs-h">
          <h2 id="needs-h" className={s.h2}>
            What brings you in?
          </h2>
          <ol className={s.needList}>
            {c.needs.map((n, i) => (
              <li key={n.name} data-reveal style={{ '--i': i } as CSSProperties}>
                <span className={s.needName}>{n.name}</span>
                <span className={s.needLine}>{n.line}</span>
                <a className={s.needBook} href={c.book} data-press>
                  Book
                </a>
              </li>
            ))}
          </ol>
          <p className={s.styles}>{c.styles.join(' · ')}</p>
        </section>

        <section className={s.book} id="book" data-covers aria-labelledby="book-h">
          <h2 id="book-h" className={s.bookHead}>
            Book your first session.
          </h2>
          <p className={s.bookText}>{c.about}</p>
          <div className={s.bookWays}>
            <a className={s.primary} href={c.book} data-press>
              Book on Timely
            </a>
            <a className={s.secondary} href={c.phone.tel} data-press>
              Call {c.phone.display}
            </a>
          </div>
        </section>
      </main>

      <footer className={s.foot} data-covers>
        <p className={s.sign}>Bex</p>
        <p className={s.footLinks}>
          <a href={c.phone.tel}>{c.phone.display}</a>
          <a href={`mailto:${c.email}`}>{c.email}</a>
        </p>
        <p className={s.small}>
          Based in {c.town}. {demoNote(data.domain)} Demo by{' '}
          <a href={SENDER_SITE} target="_blank" rel="noopener">
            {SENDER}
          </a>
          .
        </p>
      </footer>

      <nav className={s.bar} aria-label="Book or call">
        <a href={c.book} className={s.barBook} data-press>
          Book a session
        </a>
        <a href={c.phone.tel} className={s.barCall} data-press>
          Call
        </a>
      </nav>
      <Cover />
    </div>
  );
}

export const touch: Design = { Demo, fonts: ['caveat-latin-wght-normal', 'red-hat-display-latin-wght-normal'], heroSizes: '100vw' };
