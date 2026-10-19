import { Pic } from '@/components/Pic';
import { ShelfCase } from '@/components/ShelfCase';
import { Cover } from '@/components/os/Cover';
import { Now } from '@/components/os/Now';
import { clock, type Day } from '@/components/os/hours';
import { pic, type PageData } from '@/lib/data';
import { SENDER, SENDER_SITE } from '@/lib/offer';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Content {
  name: string;
  nameSticker: string[];
  street: string;
  address: string[];
  phone: { tel: string; display: string };
  maps: string;
  hours: Day[];
  shelves: string[][];
  credit: string;
}

/**
 * La Reyna Bakery, Commercial Drive. A tray of their conchas with the name on a round pink box sticker;
 * then their glass case, two shelves sliding past each other, the hours on the shelf rail; and the
 * address beside the case to close.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('shelf', ['Abril Fatface', 'Work Sans']);
  const c = data.demo as Content;
  const d = c.hours[0]!;
  const everyDay = c.hours.every((x) => x.open === d.open && x.close === d.close);
  const line = everyDay ? `Open every day, ${clock(d.open!)} to ${clock(d.close!)}` : 'Open most days';

  return (
    <div className={s.root}>
      <style href="shelf" precedence="design">
        {css}
      </style>

      <section className={s.hero} data-hero aria-labelledby="hero-h">
        <div className={s.photo}>
          <Pic pic={pic(data, 'hero')} sizes="100vw" first />
        </div>
        <h1 id="hero-h" className={s.sticker} aria-label={c.name}>
          <span aria-hidden="true">{c.nameSticker[0]}</span>
          <span aria-hidden="true">{c.nameSticker[1]}</span>
        </h1>
        <div className={s.say}>
          <p className={s.street}>{c.street}</p>
          <p className={s.now}>
            <Now week={c.hours} fallback={line} />
          </p>
          <div className={s.acts} data-covers>
            <a className={s.call} href={c.phone.tel} data-press data-magnetic>
              Call {c.phone.display}
            </a>
            <a className={s.go} href={c.maps} rel="noopener" target="_blank" data-press>
              Directions
            </a>
          </div>
        </div>
      </section>

      <main>
        <section className={s.caseSec} aria-labelledby="case-h">
          <h2 id="case-h" className={s.caseHead}>
            In the case
          </h2>
          <ShelfCase className={s.case!}>
            {c.shelves.map((row, r) => (
              <div key={row.join()} className={s.shelf} data-row={r}>
                <ul className={s.trays} tabIndex={0} aria-label={r === 0 ? 'Top shelf, swipe for more' : 'Lower shelf, swipe for more'}>
                  {row.map((k) => (
                    <li key={k}>
                      <Pic pic={pic(data, k)} sizes="(min-width: 900px) 30vw, 72vw" low />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </ShelfCase>
          <p className={s.rail}>
            <b>{line}</b>
            <Now week={c.hours} fallback={line} />
          </p>
        </section>

      </main>

      <footer className={s.end} data-covers>
        <figure className={s.endPhoto}>
          <Pic pic={pic(data, 'case')} sizes="(min-width: 900px) 40vw, 100vw" low />
        </figure>
        <div className={s.endText}>
          <p className={s.endName}>{c.name}</p>
          <address className={s.endAddr}>
            {c.address.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </address>
          <div className={s.endActs}>
            <a className={s.call} href={c.phone.tel} data-press>
              Call {c.phone.display}
            </a>
            <a className={s.goDark} href={c.maps} rel="noopener" target="_blank" data-press>
              Directions
            </a>
          </div>
          <div className={s.small}>
            <p>{c.credit}</p>
            <p>
              Demo made from their Google profile. Not an official site. Demo by{' '}
              <a href={SENDER_SITE} target="_blank" rel="noopener">
                {SENDER}
              </a>
              .
            </p>
          </div>
        </div>
      </footer>

      <a className={s.bar} href={c.phone.tel} data-press>
        Call the bakery
      </a>
      <Cover />
    </div>
  );
}

export const shelf: Design = { Demo, fonts: ['abril-fatface-latin-400-normal', 'work-sans-latin-wght-normal'], heroSizes: '100vw' };
