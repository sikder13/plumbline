import type { PageData } from '@/lib/data';
import { OPEN_SIGN, REMOVAL } from '@/lib/offer';

/** The second tab of an Open Sign page: our price, and one way to answer. The same on every page. */
export function OpenSignOffer({ data }: { data: PageData }) {
  const mail = `mailto:${data.reply.email}?subject=${encodeURIComponent(data.reply.subject)}`;
  return (
    <main className="found">
      <section aria-labelledby="offer-h">
        <h1 id="offer-h">{OPEN_SIGN.title}</h1>
        <p className="found-lead">{OPEN_SIGN.lead}</p>
        <div className="packages">
          {[OPEN_SIGN.website, OPEN_SIGN.care].map((p) => (
            <article key={p.name} className="package">
              <header>
                <h2 className="package-name">{p.name}</h2>
                <p className="price">{p.price}</p>
              </header>
              <div>
                <p>{p.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="pay-h">
        <h2 id="pay-h" className="found-h2">
          How payment works
        </h2>
        <ol className="steps">
          {OPEN_SIGN.payment.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
        <p className="found-after">{OPEN_SIGN.separately}</p>
      </section>

      <section aria-labelledby="reply-h" className="reply reply-first">
        <h2 id="reply-h" className="found-h2">
          Reply
        </h2>
        <p className="reply-line">
          <a href={mail} data-visit="cta_click">
            {OPEN_SIGN.reply}
          </a>
        </p>
        <p className="reply-sub">{OPEN_SIGN.replySub}</p>
        <p className="small">{REMOVAL}</p>
      </section>

      <footer className="offer-foot">
        <p>{OPEN_SIGN.footer}</p>
      </footer>
    </main>
  );
}
