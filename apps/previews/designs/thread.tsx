import { Cover } from '@/components/os/Cover';
import { ThreadCompose } from '@/components/ThreadCompose';
import type { PageData } from '@/lib/data';
import { SENDER, SENDER_SITE, demoNote } from '@/lib/offer';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Content {
  town: string;
  phone: { tel: string; sms: string; display: string };
  email: string;
  address: string[];
  headline: string[];
  lede: string;
  thread: { from: string; text: string }[];
  asks: string[];
  jobs: string[];
  visits: string[];
  promises: { text: string }[];
  promiseSource: string;
  expect: string;
  reply: string;
}

/**
 * Super Lawn Mowing and Gardening, Dunedin. Their own way in is a text: "just txt us" with four
 * things. The page opens on that line, set large, beside their own sentences laid out as the thread a
 * customer would get back; then the text itself, put together by two taps and sent from the visitor's
 * own phone; then their three promises, and the way to reach them.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('thread', ['Space Grotesk', 'Lora']);
  const c = data.demo as Content;
  return (
    <div className={s.root}>
      <style href="thread" precedence="design">
        {css}
      </style>

      <header className={s.top}>
        <p className={s.brand}>
          Super Lawn<span> Mowing and Gardening</span>
        </p>
        <a className={s.topCall} href={c.phone.tel} data-press>
          Call {c.phone.display}
        </a>
      </header>

      <section className={s.hero} data-hero aria-labelledby="hero-h">
        <div className={s.say}>
          <p className={s.place}>{c.town} lawns and gardens</p>
          <h1 id="hero-h" className={s.head}>
            {c.headline.map((l) => (
              <span key={l} className={s.line}>
                <span>{l}</span>
              </span>
            ))}
          </h1>
          <p className={s.lede}>{c.lede}</p>
          <div className={s.heroActs} data-covers>
            <a className={s.primary} href="#book" data-press>
              Book a job
            </a>
            <a className={s.secondary} href={c.phone.sms} data-press>
              Text {c.phone.display}
            </a>
          </div>
        </div>
        <ol className={s.thread} aria-label="From their about page">
          {c.thread.map((m, i) => (
            <li key={m.text} className={s.bubble} style={{ animationDelay: `${0.5 + i * 0.35}s` }}>
              {m.text}
            </li>
          ))}
          <li className={s.typing} aria-hidden="true">
            <span />
            <span />
            <span />
          </li>
        </ol>
      </section>

      <main>
        <section className={s.book} id="book" data-covers aria-labelledby="book-h">
          <div className={s.bookHead}>
            <p className={s.kicker}>Book a job</p>
            <h2 id="book-h" className={s.h2}>
              Just txt us with
            </h2>
            <ol className={s.asks}>
              {c.asks.map((a, i) => (
                <li key={a}>
                  <span className={s.askNo}>{i + 1}</span>
                  {a}
                </li>
              ))}
            </ol>
            <p className={s.note}>{c.reply}</p>
          </div>
          <ThreadCompose
            jobs={c.jobs}
            visits={c.visits}
            asks={c.asks}
            sms={c.phone.sms}
            tel={c.phone.tel}
            email={c.email}
            phoneDisplay={c.phone.display}
            s={{ compose: s.compose!, pick: s.pick!, pickLabel: s.pickLabel!, chips: s.chips!, chip: s.chip!, preview: s.preview!, bubbleOut: s.bubbleOut!, acts: s.acts!, send: s.send!, alt: s.alt! }}
          />
        </section>

        <section className={s.promises} aria-labelledby="promise-h">
          <h2 id="promise-h" className={s.kicker}>
            In their words
          </h2>
          <ul className={s.promiseList}>
            {c.promises.map((p) => (
              <li key={p.text} data-reveal>
                {p.text}
              </li>
            ))}
          </ul>
          <blockquote className={s.expect} data-reveal>
            <p>{c.expect}</p>
          </blockquote>
        </section>
      </main>

      <footer className={s.foot} data-covers>
        <div className={s.footGrid}>
          <div>
            <p className={s.footLabel}>Find us</p>
            <address className={s.footText}>
              {c.address.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </address>
          </div>
          <div>
            <p className={s.footLabel}>Mobile or txt</p>
            <a className={s.footLink} href={c.phone.tel}>
              {c.phone.display}
            </a>
          </div>
          <div>
            <p className={s.footLabel}>Email</p>
            <a className={s.footLink} href={`mailto:${c.email}`}>
              {c.email}
            </a>
          </div>
        </div>
        <p className={s.small}>
          {demoNote(data.domain)} Demo by{' '}
          <a href={SENDER_SITE} target="_blank" rel="noopener">
            {SENDER}
          </a>
          .
        </p>
      </footer>

      <nav className={s.bar} aria-label="Text or call">
        <a href={c.phone.sms} className={s.barText} data-press>
          Text
        </a>
        <a href={c.phone.tel} className={s.barCall} data-press>
          Call
        </a>
      </nav>
      <Cover />
    </div>
  );
}

export const thread: Design = { Demo, fonts: ['space-grotesk-latin-wght-normal', 'lora-latin-wght-normal'], heroSizes: '100vw' };
