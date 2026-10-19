import { PanoramaRoom } from '@/components/PanoramaRoom';
import { Pic } from '@/components/Pic';
import { Cover } from '@/components/os/Cover';
import { Now } from '@/components/os/Now';
import { span, type Day } from '@/components/os/hours';
import { pic, type PageData } from '@/lib/data';
import { SENDER, SENDER_SITE } from '@/lib/offer';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Content {
  name: string;
  sign: string;
  street: string;
  address: string[];
  phone: { tel: string; display: string };
  maps: string;
  hours: Day[];
  carved: string[];
  carvedSource: string;
  credit: string;
}

/**
 * Craig's Hair Care, South Franklin Road. The name over a long band of their front; the room itself to
 * look along from end to end; the week as four open days and three closed; and the brick to close.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('panorama', ['Zilla Slab', 'Hanken Grotesk']);
  const c = data.demo as Content;
  const open = c.hours.filter((d) => d.open).length;

  return (
    <div className={s.root}>
      <style href="panorama" precedence="design">
        {css}
      </style>

      <section className={s.hero} data-hero aria-labelledby="hero-h">
        <div className={s.top}>
          <p className={s.sign}>{c.sign}</p>
          <p className={s.street}>{c.street}</p>
        </div>
        <h1 id="hero-h" className={s.title}>
          {c.name}
        </h1>
        <p className={s.carvedLine}>
          {c.carved[0]} <span>{c.carved[1]}</span>
        </p>
        <div className={s.band}>
          <Pic pic={pic(data, 'hero')} sizes="100vw" first />
        </div>
        <div className={s.row}>
          <p className={s.now}>
            <Now week={c.hours} fallback={`Open ${open} days a week`} />
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
        <section className={s.room} aria-labelledby="room-h">
          <h2 id="room-h" className={s.roomHead}>
            Look around
          </h2>
          <PanoramaRoom pic={pic(data, 'room')} label="Look along the room" s={{ pano: s.pano!, panoFrame: s.panoFrame!, panoControl: s.panoControl! }} />
        </section>

        <section className={s.week} id="week" aria-labelledby="week-h">
          <h2 id="week-h" className={s.weekHead}>
            {open} days a week
          </h2>
          <p className={s.weekNow}>
            <Now week={c.hours} fallback={`Open ${open} days a week`} scope="#week" />
          </p>
          <p className={s.sentence}>
            Open{' '}
            {c.hours
              .map((d, i) => ({ d, i }))
              .filter((x) => x.d.open)
              .map((x, k, all) => (
                <span key={x.d.day} className={s.openDay} data-day={x.i}>
                  <b>{x.d.day}</b> {span(x.d)}
                  {k < all.length - 2 ? ', ' : k === all.length - 2 ? ' and ' : '.'}
                </span>
              ))}{' '}
            <span className={s.closedNote}>
              Closed{' '}
              {c.hours
                .map((d, i) => ({ d, i }))
                .filter((x) => !x.d.open)
                .map((x, k, all) => (
                  <span key={x.d.day} className={s.closedDay} data-day={x.i}>
                    {x.d.day}
                    {k < all.length - 2 ? ', ' : k === all.length - 2 ? ' and ' : '.'}
                  </span>
                ))}
            </span>
          </p>
        </section>

        <section className={s.frontSec} aria-label="The front">
          <figure className={s.front} data-reveal>
            <Pic pic={pic(data, 'front')} sizes="100vw" low />
          </figure>
        </section>
      </main>

      <footer className={s.end} data-covers aria-label="Find the shop">
        <div className={s.plaque}>
          <p className={s.plaqueName}>{c.name} Inc.</p>
          <p className={s.plaqueLine}>{c.carved[0]}</p>
          <a className={s.plaqueTel} href={c.phone.tel} aria-label={`Call ${c.phone.display}`} data-press>
            {c.phone.display}
          </a>
          <p className={s.plaqueEst}>{c.carved[1]}</p>
        </div>
        <p className={s.plaqueSource}>{c.carvedSource}, set in type.</p>
        <address className={s.addr}>
          {c.address.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </address>
        <div className={s.endActs}>
          <a className={s.callLight} href={c.phone.tel} data-press>
            Call {c.phone.display}
          </a>
          <a className={s.goLight} href={c.maps} rel="noopener" target="_blank" data-press>
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
      </footer>

      <a className={s.bar} href={c.phone.tel} data-press>
        Call {c.name}
      </a>
      <Cover />
    </div>
  );
}

export const panorama: Design = { Demo, fonts: ['zilla-slab-latin-700-normal', 'hanken-grotesk-latin-wght-normal'], heroSizes: '100vw' };
