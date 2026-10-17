import type { CSSProperties } from 'react';
import { DemoFoot } from '@/components/DemoFoot';
import { EarshotCarry } from '@/components/EarshotCarry';
import { EarshotPlan, type PlanContent } from '@/components/EarshotPlan';
import { EarshotSeasons, type SeasonItem, type SeasonLabels } from '@/components/EarshotSeasons';
import { Pic } from '@/components/Pic';
import { Pinned } from '@/components/Pinned';
import { SectionLinks } from '@/components/SectionLinks';
import { StickyBar } from '@/components/StickyBar';
import { pic, type PageData } from '@/lib/data';
import { designStyles } from '@/lib/styles';
import type { Design } from './types';

interface Link {
  label: string;
  href: string;
}

interface Content {
  wordmark: string;
  nav: Link[];
  book: Link;
  call: { label: string; tel: string; display: string };
  email: string;
  hero: { kicker: string; lines: [string, string]; sub: string; who: string; where: string; cutout: { desk: string; phone: string } };
  voice: { kicker: string; heading: string; by: string; steps: { word: string; quote: string; image: string }[] };
  adventures: { kicker: string; heading: string; lead: string; open: number; rating: { label: string; unit: string; source: string }; labels: SeasonLabels; letters: string[]; items: (SeasonItem & { image: string })[] };
  plan: PlanContent & { kicker: string; heading: string; lead: string; tag: { phone: string; email: string; hours: string } };
  foot: { line: string; top: string };
}

/**
 * A soft edged silhouette for the guide, from the outline points in the content file: an SVG drawn in a
 * 100 by 100 box and stretched over the photograph, blurred a touch so the edge sits into the picture.
 */
function silhouette(points: string, blur: number): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><filter id='f' x='-5%' y='-5%' width='110%' height='110%'><feGaussianBlur stdDeviation='${blur}'/></filter><polygon filter='url(#f)' fill='#000' points='${points}'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/**
 * The voice, drawn as one line: a trace that swells where each stage of the day is spoken and is
 * quiet between them, made once here so the page and the server agree on it.
 */
const VOICE = (() => {
  const pts: string[] = [];
  for (let k = 0; k <= 200; k++) {
    const x = k * 5;
    const near = [1 / 6, 1 / 2, 5 / 6].reduce((a, c) => Math.max(a, Math.exp(-(((x / 1000 - c) * 9) ** 2))), 0);
    const y = 50 + Math.sin(x / 9) * (6 + 34 * near) * Math.cos(x / 31);
    pts.push(`${k === 0 ? 'M' : 'L'}${x} ${y.toFixed(1)}`);
  }
  return pts.join(' ');
})();

/** A small six sided mark, the shape of the badge they wear. */
function Hex({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 26" aria-hidden="true" focusable="false">
      <path d="M12 1.5 22 7.2v11.6L12 24.5 2 18.8V7.2Z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M7 15.5 10.6 10l2.6 3.4 1.6-2 2.2 4.1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/**
 * One guide, start to finish, on two grounds only: lake mist and bush green, with their blaze orange
 * kept for what can be done. "Voice" rises first, then the guide slides in from his own photograph
 * to cover its last letter, then the rest of the sentence is drawn in. His voice is then one line
 * through the day, in his own words at each stage; his year is a slider that shows what is on each
 * month, with his credentials beside the adventures they belong to; and the visitor writes a note
 * to him whose trip and price the page's main action then carries.
 */
function Demo({ data }: { data: PageData }) {
  const { css, s } = designStyles('earshot', ['Bricolage Grotesque', 'Petrona']);
  const c = data.demo as Content;
  const hero = pic(data, 'hero');
  const heroPhone = data.images.heroPhone;
  const book = { href: c.book.href, rel: 'noopener' };
  const geometry = {
    '--r': (hero.width / hero.height).toFixed(4),
    '--rp': heroPhone ? (heroPhone.width / heroPhone.height).toFixed(4) : (hero.width / hero.height).toFixed(4),
    '--cut-d': silhouette(c.hero.cutout.desk, 0.08),
    '--cut-p': silhouette(c.hero.cutout.phone, 0.18),
  } as CSSProperties;
  const steps = c.voice.steps;

  return (
    <div className={s.root} style={geometry}>
      <style href="earshot" precedence="design">
        {css}
      </style>

      <nav className={s.dock} aria-label="Sections">
        <a className={s.dockMark} href="#top">
          <Hex className={s.hexIcon} />
          {c.wordmark}
        </a>
        <SectionLinks className={s.dockLinks} items={c.nav} />
        <EarshotCarry className={s.dockBook} label={c.book.label} href={c.book.href} />
      </nav>

      <section className={s.hero} id="top" data-hero aria-labelledby="hero-h">
        <div className={s.box}>
          <Pic pic={hero} phone={heroPhone} sizes="(max-width: 759px) 100vw, 110vw" first />
        </div>
        <span className={s.mist} aria-hidden="true" />
        <div className={s.top}>
          <a className={s.mark} href="#top" aria-label={data.name}>
            <Hex className={s.hexIcon} />
            <span>{c.wordmark}</span>
          </a>
          <p className={s.topKicker}>{c.hero.kicker}</p>
        </div>
        <h1 id="hero-h" className={s.headline}>
          {c.hero.lines.map((l, i) => (
            <span key={l} className={s.line} data-line={i}>
              <span style={{ '--i': i } as CSSProperties}>
                {l}
                {i === 0 ? ' ' : ''}
              </span>
            </span>
          ))}
        </h1>
        <div className={`${s.box} ${s.cut}`} aria-hidden="true">
          <Pic pic={hero} phone={heroPhone} sizes="(max-width: 759px) 100vw, 110vw" first alt="" />
        </div>
        <div className={s.lede}>
          <p className={s.sub}>{c.hero.sub}</p>
          <p className={s.who}>
            <b>{c.hero.who}</b>
            <span>{c.hero.where}</span>
          </p>
          <a className={s.go} data-press data-magnetic {...book}>
            {c.book.label}
          </a>
        </div>
      </section>

      <main>
        <section className={s.voice} id="voice" aria-labelledby="voice-h">
          <Pinned steps={steps.length} className={s.story}>
            <header className={s.storyHead}>
              <p className={s.kicker}>{c.voice.kicker}</p>
              <h2 id="voice-h">{c.voice.heading}</h2>
            </header>
            <div className={s.thread} aria-hidden="true">
              <svg viewBox="0 0 1000 100" preserveAspectRatio="none" focusable="false">
                <path className={s.threadBase} d={VOICE} />
                <path className={s.threadLive} d={VOICE} pathLength={1} />
              </svg>
              <ol className={s.nodes}>
                {steps.map((st, i) => (
                  <li key={st.word} data-step={i} data-state={i === 0 ? 'on' : 'off'} style={{ '--x': (i + 0.5) / steps.length } as CSSProperties}>
                    <i />
                    <span>{st.word}</span>
                  </li>
                ))}
              </ol>
            </div>
            <ol className={s.stages}>
              {steps.map((st, i) => (
                <li key={st.word} className={s.stage} data-step={i} data-state={i === 0 ? 'on' : 'off'} style={{ '--i': i } as CSSProperties}>
                  <h3 className={s.srOnly}>{st.word}</h3>
                  <blockquote className={s.said}>
                    <p>{st.quote}</p>
                    <footer>{c.voice.by}</footer>
                  </blockquote>
                  <div className={s.stagePic}>
                    <Pic pic={pic(data, st.image)} sizes="(min-width: 760px) 46vw, 100vw" />
                  </div>
                </li>
              ))}
            </ol>
          </Pinned>
        </section>

        <section className={s.adv} id="adventures" aria-labelledby="adv-h">
          <header className={s.advHead}>
            <p className={s.kicker} data-reveal>
              {c.adventures.kicker}
            </p>
            <h2 id="adv-h" data-reveal>
              {c.adventures.heading}
            </h2>
            <p className={s.advLead} data-reveal>
              {c.adventures.lead}
            </p>
            {data.rating && (
              <p className={s.rated} data-reveal>
                <b>{data.rating.value}</b>
                <span>
                  {c.adventures.rating.label} {data.rating.count} {c.adventures.rating.unit}
                </span>
                <small>{c.adventures.rating.source}</small>
              </p>
            )}
          </header>
          <EarshotSeasons
            items={c.adventures.items}
            months={c.plan.months}
            letters={c.adventures.letters}
            labels={c.adventures.labels}
            open={c.adventures.open}
            photos={c.adventures.items.map((it) => (
              <Pic key={it.image} pic={pic(data, it.image)} sizes="(min-width: 760px) 180px, 96px" />
            ))}
            cls={{
              root: s.seasons,
              picker: s.picker,
              month: s.month,
              now: s.now,
              rail: s.rail,
              range: s.range,
              letters: s.letters,
              rows: s.rows,
              row: s.row,
              thumb: s.thumb,
              head: s.rowHead,
              name: s.rowName,
              status: s.status,
              title: s.rowTitle,
              trust: s.trust,
              bar: s.bar,
              deal: s.deal,
              price: s.price,
              go: s.go,
              more: s.more,
            }}
          />
        </section>

        <section className={s.plan} id="plan" aria-labelledby="plan-h">
          <header className={s.planHead}>
            <p className={s.kicker}>{c.plan.kicker}</p>
            <h2 id="plan-h">{c.plan.heading}</h2>
            <p className={s.planLead}>{c.plan.lead}</p>
          </header>
          <EarshotPlan
            content={c.plan}
            email={c.email}
            book={c.book}
            start={c.adventures.open}
            contact={{ phoneLabel: c.plan.tag.phone, tel: c.call.tel, phone: c.call.display, emailLabel: c.plan.tag.email, hours: c.plan.tag.hours }}
            cls={{
              root: s.planner,
              note: s.note,
              hint: s.hint,
              sentence: s.sentence,
              token: s.token,
              word: s.tokenWord,
              now: s.now,
              end: s.end,
              heard: s.heard,
              from: s.from,
              status: s.heardStatus,
              quote: s.quote,
              sign: s.sign,
              go: s.go,
              send: s.send,
              sendNote: s.sendNote,
              ps: s.ps,
            }}
          />
        </section>
      </main>

      <footer className={s.foot}>
        <p className={s.footLine}>
          <Hex className={s.hexIcon} />
          <b>{c.wordmark}</b>
          <span>{c.foot.line}</span>
        </p>
        <a className={s.footTop} href="#top">
          {c.foot.top}
        </a>
        <DemoFoot domain={data.domain} />
      </footer>

      <StickyBar main={{ label: c.book.label, href: c.book.href, external: true }} call={{ label: c.call.label, tel: c.call.tel }} />
    </div>
  );
}

export const earshot: Design = { Demo, fonts: ['bricolage-grotesque-latin-wght-normal', 'petrona-latin-wght-italic'], heroSizes: '(max-width: 759px) 100vw, 110vw' };
