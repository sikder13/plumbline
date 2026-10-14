import type { CSSProperties, ReactNode } from 'react';
import { DemoFoot } from '@/components/DemoFoot';
import { Pic } from '@/components/Pic';
import { PourCard, type PourCardContent } from '@/components/PourCard';
import { PourDoor, type PourDoorOption } from '@/components/PourDoor';
import { PourFlight, type PourFlightWine } from '@/components/PourFlight';
import { PourRead } from '@/components/PourRead';
import { PourSeason } from '@/components/PourSeason';
import { PourSwirl } from '@/components/PourSwirl';
import { SectionLinks } from '@/components/SectionLinks';
import { StickyBar } from '@/components/StickyBar';
import { pic, type PageData } from '@/lib/data';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Content {
  wordmark: string;
  wordmarkSub: string;
  nav: { label: string; href: string }[];
  book: { label: string; href: string };
  call: { label: string; tel: string; display: string };
  email: string;
  season: { text: string; short: string; open: number[]; on: string; off: string };
  hero: { kicker: string; lines: string[]; sub: string; callLabel: string };
  welcome: { heading: string; words: string; line: string; sign: string };
  flight: { heading: string; lead: string; hint: string; wines: PourFlightWine[] };
  door: { heading: string; lead: string; switchLabel: string; options: PourDoorOption[] };
  card: PourCardContent;
  visit: {
    heading: string;
    from: string;
    to: string;
    before: string;
    here: string;
    after: string;
    near: string;
    road: string;
    address: string[];
    label: { top: string; place: string; region: string; certified: string; ratingUnit: string; ratingSource: string };
    shop: { label: string; href: string };
    club: { label: string; href: string };
  };
  end: { heading: string; sign: string };
}

/**
 * One wine glass, drawn in a box 200 wide and 360 tall: a tulip bowl, a stem and a foot. The bowl's
 * own outline, in fractions of the bowl, is used again as a clip, so a view or a wine can sit inside
 * it and a level can rise in it.
 */
const BOWL = 'M30.08 6C19.04 50 8 90 11.68 126C17.2 176 54 206 100 206C146 206 182.8 176 188.32 126C192 90 180.96 50 169.92 6Z';
const BOWL_BOX = 'M0.12 0C0.06 0.22 0 0.42 0.02 0.6C0.05 0.85 0.25 1 0.5 1C0.75 1 0.95 0.85 0.98 0.6C1 0.42 0.94 0.22 0.88 0Z';
const STEM = 'M100 206V334';
const FOOT = 'M44 340a56 6.5 0 1 0 112 0a56 6.5 0 1 0-112 0';
const SHEEN = 'M30 38C22 66 19 98 23 128';
const SHEEN_RIGHT = 'M176 60C181 84 182 104 180 122';
/** A falling stream of wine, narrowing as it falls, from above the glass to the wine's surface. */
const STREAM = 'M126 -170C125 -60 106 40 101.6 136L97.6 136C102 40 117 -60 114 -170Z';
const STREAM_LIGHT = 'M122 -170C121 -64 104 30 100.4 130';
const CLIP: CSSProperties = { clipPath: 'url(#pour-bowl)' };

/** The shapes every glass on the page is drawn from, once. */
function GlassDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
      <defs>
        <clipPath id="pour-bowl" clipPathUnits="objectBoundingBox">
          <path d={BOWL_BOX} />
        </clipPath>
        <symbol id="pour-glass" viewBox="0 0 200 360">
          <path d={BOWL} />
          <path d={STEM} />
          <path d={FOOT} />
        </symbol>
        <linearGradient id="pour-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9d8df" />
          <stop offset="0.45" stopColor="#e7ece6" />
        </linearGradient>
        <linearGradient id="pour-stream" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5e0d20" />
          <stop offset="0.45" stopColor="#a8263f" />
          <stop offset="1" stopColor="#6e1026" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/**
 * The view their cellar door looks over, drawn flat inside the bowl: the mountains beyond, a limestone
 * terrace and the vineyard's rows running down to the wine. Decoration only.
 */
function View({ className }: { className?: string }) {
  const rows = Array.from({ length: 15 }, (_, i) => i - 7);
  return (
    <svg className={className} viewBox="0 0 92 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <rect width="92" height="100" fill="url(#pour-sky)" />
      <path d="M0 30L7 24L12 27L20 13L27 22L33 18L42 28L51 15L58 22L66 10L75 21L82 17L92 24V46H0Z" fill="#9daebb" />
      <path d="M20 13L17.4 16.4L19.6 15.8L21 17.4L22.8 15.4ZM51 15L48.6 18.2L50.8 17.6L52.4 19L53.6 17.4ZM66 10L63.2 13.8L65.6 13.2L67 14.8L68.8 12.8Z" fill="#f6f7f4" />
      <path d="M0 40C10 35 18 37 26 34C34 31 42 36 52 34C62 32 72 36 80 33C85 31.5 89 32.5 92 32V54H0Z" fill="#ddd5c0" />
      <path d="M14 37.4V44M30 33.6V41M47 35.2V42.6M66 34V41.4M84 32.6V39" stroke="#c7bca2" strokeWidth="0.9" />
      <path d="M0 46C24 42 52 45 92 41V100H0Z" fill="#8ea766" />
      <g stroke="#5f7a3e" strokeWidth="1.5" strokeLinecap="round">
        {rows.map((k) => (
          <path key={k} d={`M${46 + k * 1.3} 45.4L${46 + k * 15} 100`} />
        ))}
      </g>
    </svg>
  );
}

type S = Record<string, string>;

/** A small glass filled to a level, from 0 (empty) to 1 (full). Decoration that marks how far in the page is. */
function Glass({ s, level, liquid, className }: { s: S; level: number; liquid?: string; className?: string }) {
  return (
    <span className={`${s.glass} ${className ?? ''}`} style={{ '--lv': level, ...(liquid ? { '--liquid': liquid } : {}) } as CSSProperties} aria-hidden="true">
      <span className={s.glassBowl} style={CLIP}>
        <i className={s.glassWine} />
      </span>
      <svg viewBox="0 0 200 360" focusable="false">
        <use href="#pour-glass" />
      </svg>
    </span>
  );
}

function Mail() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 5.5l7 5.2 7-5.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

/** Text with {marked} parts: the marked parts are set apart, {img:key} sets a small photograph in the line, and the rest is split into words for the reading fill. */
function ReadWords({ text, s, data }: { text: string; s: S; data: PageData }) {
  const parts = text.split(/(\{[^}]+\})/).filter(Boolean);
  let i = 0;
  const out: ReactNode[] = [];
  for (const part of parts) {
    const image = /^\{img:(\w+)\}$/.exec(part);
    if (image) {
      out.push(
        <span key={`p${i}`} className={s.inlinePic} style={{ '--i': i } as CSSProperties}>
          <Pic pic={pic(data, image[1]!)} sizes="(min-width: 900px) 220px, 120px" />
        </span>,
      );
      i += 1;
      continue;
    }
    const marked = /^\{(.+)\}$/.exec(part);
    if (marked) {
      out.push(
        <b key={`m${i}`} className={s.figure} style={{ '--i': i } as CSSProperties}>
          {marked[1]}
        </b>,
      );
      i += 1;
      continue;
    }
    for (const w of part.split(/(\s+)/)) {
      if (!w) continue;
      if (/^\s+$/.test(w)) {
        out.push(w);
        continue;
      }
      out.push(
        <span key={`w${i}`} className={s.word} style={{ '--i': i } as CSSProperties}>
          {w}
        </span>,
      );
      i += 1;
    }
  }
  return <>{out}</>;
}

/**
 * The Waitaki Valley poured into a glass. One drawn wine glass carries the page: their view sits in
 * it as the wine pours in; the line-up pours a paddle of their five wines while a light moves bottle
 * to bottle; and the close is a full glass. Booking is a postcard whose blanks are tapped.
 */
function Demo({ data }: { data: PageData }) {
  const c = data.demo as Content;
  const { css, s } = designStyles('pour', ['Zilla Slab', 'Libre Franklin', 'Caveat']);
  const sections = 5;
  const mark = (n: number) => <Glass s={s} level={n / sections} className={s.mark} />;
  const rating = data.rating;
  const seasonProps = { text: c.season.text, label: c.season.text, open: c.season.open, on: c.season.on, off: c.season.off, cls: { dot: s.seasonDot, state: s.seasonState } };

  return (
    <div className={s.root}>
      <style href="pour" precedence="design">
        {css}
      </style>
      <GlassDefs />

      <header className={s.top}>
        <a className={s.brand} href="#top" aria-label={data.name}>
          <b>{c.wordmark}</b>
          <span>{c.wordmarkSub}</span>
        </a>
        <SectionLinks className={s.topLinks} items={c.nav} />
        <PourSeason {...seasonProps} className={s.season} text={c.season.short} />
        <a className={s.topBook} href={c.book.href} data-press data-magnetic>
          {c.book.label}
        </a>
      </header>

      <PourRead whole className={s.rail}>
        <Glass s={s} level={1} className={s.railGlass} />
        <nav className={s.railLinks} aria-label="Sections">
          {c.nav.map((n) => (
            <a key={n.href} href={n.href}>
              {n.label}
            </a>
          ))}
        </nav>
      </PourRead>

      <section className={s.hero} id="top" data-hero>
        <p className={s.kicker}>{c.hero.kicker}</p>
        <div className={s.stage}>
          <h1 className={s.title} aria-label={c.hero.lines.join(' ')}>
            {c.hero.lines.map((l, i) => (
              <span key={l} className={s.line} data-line={i} aria-hidden="true">
                <span style={{ '--i': i } as CSSProperties}>
                  {l.split(' ').map((w, j) => (
                    <span key={w} className={s.lineWord} data-word={j}>
                      {j > 0 ? ' ' : ''}
                      {w}
                    </span>
                  ))}
                </span>
              </span>
            ))}
          </h1>
          <PourSwirl className={s.heroGlass}>
            <span className={s.heroBowl} style={CLIP}>
              <View className={s.view} />
              <span className={s.heroWine} aria-hidden="true">
                <i />
                <b />
                <b />
              </span>
            </span>
            <svg className={s.stream} viewBox="0 -170 200 306" preserveAspectRatio="xMidYMin meet" aria-hidden="true" focusable="false">
              <path d={STREAM} fill="url(#pour-stream)" />
              <path d={STREAM_LIGHT} fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
            <svg className={s.heroLine} viewBox="0 0 200 360" aria-hidden="true" focusable="false">
              <path d={BOWL} pathLength={1} />
              <path d={SHEEN} pathLength={1} data-sheen />
              <path d={SHEEN_RIGHT} pathLength={1} data-sheen="right" />
              <path d={STEM} pathLength={1} />
              <path d={FOOT} pathLength={1} />
            </svg>
            <span className={s.heroShadow} aria-hidden="true" />
          </PourSwirl>
        </div>
        <PourSeason {...seasonProps} className={s.heroSeason} />
        <div className={s.heroFoot}>
          <p className={s.sub}>{c.hero.sub}</p>
          <div className={s.actions}>
            <a className={s.go} href={c.book.href} data-press data-magnetic>
              <Mail />
              {c.book.label}
            </a>
            <a className={s.ring} href={c.call.tel} data-press aria-label={`${c.hero.callLabel} ${c.call.display}`}>
              <b>{c.hero.callLabel}</b>
              <span className={s.ringNum}>{c.call.display}</span>
            </a>
          </div>
        </div>
      </section>

      <main>
        <section className={s.welcome} aria-labelledby="welcome-h">
          <h2 id="welcome-h" className={s.kickerHead}>
            {mark(1)}
            {c.welcome.heading}
          </h2>
          <PourRead className={s.read}>
            <p className={s.readText}>
              <ReadWords text={c.welcome.words} s={s} data={data} />
            </p>
          </PourRead>
          <p className={s.welcomeLine} data-reveal>
            {c.welcome.line}
          </p>
          <p className={s.sign} data-reveal>
            {c.welcome.sign}
          </p>
        </section>

        <section className={s.flight} id="wines" aria-labelledby="wines-h">
          <PourFlight
            wines={c.flight.wines}
            heading={c.flight.heading}
            lead={c.flight.lead}
            hint={c.flight.hint}
            shop={c.visit.shop}
            mark={mark(2)}
            photo={<Pic pic={pic(data, 'lineup')} sizes="(min-width: 900px) 800px, 100vw" />}
            cls={{
              story: s.story,
              head: s.storyHead,
              shop: s.shop,
              lead: s.flightLead,
              panel: s.panel,
              photo: s.photo,
              camera: s.camera,
              spot: s.spot,
              bar: s.bar,
              cup: s.cup,
              cupName: s.cupName,
              plank: s.plank,
              hint: s.flightHint,
              glass: s.glass,
              glassBowl: s.glassBowl,
              glassWine: s.glassWine,
            }}
          />
        </section>

        <section className={s.door} id="door" aria-labelledby="door-h">
          <PourDoor
            heading={c.door.heading}
            lead={c.door.lead}
            label={c.door.switchLabel}
            options={c.door.options}
            mark={mark(3)}
            pics={Object.fromEntries(c.door.options.map((o) => [o.key, <Pic key={o.key} pic={pic(data, o.image)} sizes="(min-width: 900px) 58vw, 100vw" />]))}
            cls={{ wrap: s.doorWrap, head: s.doorHead, sw: s.switch, thumb: s.thumb, pics: s.doorPics, pic: s.doorPic, ember: s.ember, text: s.doorText, icon: s.doorIcon }}
          />
        </section>

        <section className={s.card} id="book" aria-labelledby="card-h">
          <header className={s.cardHead}>
            <h2 id="card-h" data-reveal>
              {mark(4)}
              {c.card.heading}
            </h2>
            <p data-reveal>{c.card.lead}</p>
          </header>
          <PourCard
            content={c.card}
            email={c.email}
            call={{ tel: c.call.tel, display: c.call.display }}
            pictures={{
              default: <Pic pic={pic(data, c.card.pictures.default.image)} sizes="(min-width: 900px) 360px, 92vw" />,
              platter: <Pic pic={pic(data, c.card.pictures.platter.image)} sizes="(min-width: 900px) 360px, 92vw" />,
            }}
            stamp={<Glass s={s} level={0.55} className={s.stampGlass} />}
            cls={{
              wrap: s.cardWrap,
              hint: s.cardHint,
              post: s.post,
              picture: s.picture,
              pic: s.cardPic,
              caption: s.caption,
              message: s.message,
              slot: s.slot,
              options: s.options,
              chips: s.chips,
              side: s.side,
              stamp: s.stamp,
              stampWord: s.stampWord,
              postmark: s.postmark,
              to: s.to,
              send: s.send,
              go: s.go,
              or: s.or,
              doneBtn: s.doneBtn,
            }}
          />
        </section>

        <section className={s.visit} id="visit" aria-labelledby="visit-h">
          <h2 id="visit-h" className={s.kickerHead} data-reveal>
            {mark(5)}
            {c.visit.heading}
          </h2>
          <PourRead className={s.trail}>
            <p className={s.trailEnd} data-end="from">
              {c.visit.from}
            </p>
            <ol className={s.trailStops}>
              <li>{c.visit.before}</li>
              <li className={s.here}>
                <Glass s={s} level={0.62} className={s.hereGlass} />
                <b>{c.visit.here}</b>
                <span>{c.visit.near}</span>
              </li>
              <li>{c.visit.after}</li>
            </ol>
            <p className={s.trailEnd} data-end="to">
              {c.visit.to}
            </p>
          </PourRead>
          <div className={s.closing}>
            <div className={s.closeTop}>
              <div>
                <h3 className={s.closeLine} data-reveal>
                  {c.end.heading}
                </h3>
                <p className={s.closeSign} data-reveal>
                  {c.end.sign}
                </p>
              </div>
              <PourRead className={s.closeGlassWrap}>
                <Glass s={s} level={1} className={s.closeGlass} />
              </PourRead>
            </div>
            <div className={s.closeActions}>
              <a className={s.go} href={c.book.href} data-press data-magnetic>
                <Mail />
                {c.book.label}
              </a>
              <a className={s.ring} href={c.call.tel} data-press>
                {c.call.display}
              </a>
            </div>
            <div className={s.closeLabel}>
              <div>
                <p className={s.labelTop}>{c.visit.label.top}</p>
                <p className={s.labelPlace}>
                  <span>{c.visit.label.place}</span>
                  <Glass s={s} level={0.6} className={s.labelGlass} />
                  <span>{c.visit.label.region}</span>
                </p>
                <p className={s.labelNear}>{c.visit.road}</p>
                <p className={s.address}>
                  {c.visit.address.map((a) => (
                    <span key={a}>{a}</span>
                  ))}
                </p>
                <p className={s.seasonLine}>{c.season.text}</p>
              </div>
              <div>
                <p className={s.labelCert}>{c.visit.label.certified}</p>
                {rating && (
                  <p className={s.labelRating}>
                    <b>{rating.value}</b> {c.visit.label.ratingUnit.replace('{count}', String(rating.count))} <small>{c.visit.label.ratingSource}</small>
                  </p>
                )}
                <p className={s.links}>
                  <a href={`mailto:${c.email}`}>{c.email}</a>
                  <a href={c.visit.shop.href} rel="noopener">
                    {c.visit.shop.label}
                  </a>
                  <a href={c.visit.club.href} rel="noopener">
                    {c.visit.club.label}
                  </a>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className={s.foot}>
        <DemoFoot domain={data.domain} />
      </footer>

      <StickyBar main={{ label: c.book.label, href: c.book.href }} call={{ label: c.call.label, tel: c.call.tel }} />
    </div>
  );
}

export const pour: Design = { Demo, fonts: ['zilla-slab-latin-700-normal', 'libre-franklin-latin-wght-normal'], heroSizes: '120px' };
