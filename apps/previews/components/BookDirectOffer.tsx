import type { PageData } from '@/lib/data';
import { BOOK_DIRECT, REMOVAL } from '@/lib/offer';

export interface BookDirectFinding {
  title: string;
  /** One plain sentence: the link's words, the page it is on, and what a visitor sees. */
  sentence: string;
  /** When it was seen again, NZ time. */
  seen: string;
  /** The image key of its proof, in the content file. */
  proof?: string;
  proofAlt?: string;
  /** False for a finding from the sweep that was not fetched again: it reads "Seen" rather than "Seen again". */
  again?: boolean;
}

interface Content {
  findings: BookDirectFinding[];
  /** What is fixed first, free: "the broken booking link" unless the finding is another kind. */
  fixFirst?: string;
  /** When the demo's Book goes to a section of the page rather than an engine: what the live rebuild does instead. */
  engineNote?: string;
}

/** The second tab of a Book Direct page: the findings with their proof, then our price, then one way to answer. */
export function BookDirectOffer({ data }: { data: PageData }) {
  const c = data.demo as Content;
  const mail = `mailto:${data.reply.email}?subject=${encodeURIComponent(data.reply.subject)}`;
  return (
    <main className="found">
      <section aria-labelledby="found-h">
        <p className="found-kicker">{data.domain}</p>
        <h1 id="found-h">{BOOK_DIRECT.findingsTitle}</h1>
        <p className="found-lead">{BOOK_DIRECT.findingsLead}</p>
        <ol className="cards">
          {c.findings.map((f) => {
            const img = f.proof ? data.images[f.proof] : undefined;
            return (
              <li key={f.title} className="card">
                <h2>{f.title}</h2>
                <p>{f.sentence}</p>
                {img && (
                  <figure>
                    <img src={img.fallback} width={img.width} height={img.height} alt={f.proofAlt ?? img.alt} loading="lazy" decoding="async" />
                  </figure>
                )}
                <p className="card-when">
                  {f.again === false ? 'Seen' : 'Seen again'} {f.seen}, New Zealand time.
                </p>
              </li>
            );
          })}
        </ol>
        {c.engineNote && <p className="found-note">{c.engineNote}</p>}
      </section>

      <section aria-labelledby="price-h">
        <h2 id="price-h" className="found-h2">
          {BOOK_DIRECT.priceTitle}
        </h2>
        <ol className="steps">
          {BOOK_DIRECT.price(c.fixFirst ?? 'the broken booking link').map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="reply-h" className="reply reply-first">
        <h2 id="reply-h" className="found-h2">
          Reply
        </h2>
        <p className="reply-line">
          <a href={mail} data-visit="cta_click">
            {BOOK_DIRECT.reply}
          </a>
        </p>
        <p className="reply-sub">{BOOK_DIRECT.replySub}</p>
        <p className="small">{REMOVAL}</p>
      </section>

      <footer className="offer-foot">
        <p>{BOOK_DIRECT.footer}</p>
      </footer>
    </main>
  );
}
