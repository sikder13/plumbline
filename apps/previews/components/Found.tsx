import type { PageData } from '@/lib/data';
import { CARE, ENGINE_DESIGNS, PACKAGES, PAYMENT, REMOVAL, REPLY_BUTTONS, REPLY_LINE, TOOLS, TOOLS_LINK, WHO } from '@/lib/offer';

/** The second tab: what was measured on the current site, what we offer, and how to reply. */
export function Found({ data }: { data: PageData }) {
  const mail = `mailto:${data.reply.email}?subject=${encodeURIComponent(data.reply.subject)}`;
  return (
    <main className="found">
      <section aria-labelledby="found-h">
        <p className="found-kicker">{data.domain}</p>
        <h1 id="found-h">What we found</h1>
        {/* A page whose findings all came from the second check has no cards, and goes straight on to it. */}
        {data.findings.length > 0 && (
          <>
            <p className="found-lead">Each item below was measured on your current site, seen twice at least an hour apart, and checked again on the date shown.</p>
            <ol className="cards">
              {data.findings.map((f) => (
                <li key={f.check} className="card">
                  <h2>{f.title}</h2>
                  <p>{f.sentence}</p>
                  {f.shots.map((s, i) => (
                    <figure key={i}>
                      {s.image && <img src={s.image.src} width={s.image.width} height={s.image.height} alt={`Screenshot of your current site: ${f.title}`} loading="lazy" decoding="async" />}
                      {s.seen && <figcaption>{s.seen}</figcaption>}
                    </figure>
                  ))}
                  <p className="card-when">
                    Measured {f.measuredNz}, New Zealand time{f.pageUrl ? <>, on <span className="url">{f.pageUrl.replace(/^https?:\/\//, '')}</span></> : null}
                  </p>
                  <p className="card-fix">
                    <strong>In the new site:</strong> {f.fix}
                  </p>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      {data.secondCheck && (
        <section aria-labelledby="second-h">
          <h2 id="second-h" className="found-h2">Second check, Crawlmouse</h2>
          <p className="found-lead">Crawlmouse is our second audit tool. It read your site separately.</p>
          <dl className="facts">
            {data.secondCheck.score && (
              <div>
                <dt>Site score</dt>
                <dd>{data.secondCheck.score}</dd>
              </div>
            )}
            {data.secondCheck.aiReadiness && (
              <div>
                <dt>AI readiness</dt>
                <dd>{data.secondCheck.aiReadiness}</dd>
              </div>
            )}
            {data.secondCheck.crawlerAccess && (
              <div>
                <dt>AI crawler access</dt>
                <dd>{data.secondCheck.crawlerAccess}</dd>
              </div>
            )}
            {data.secondCheck.brokenLinks && (
              <div>
                <dt>Broken links</dt>
                <dd>{data.secondCheck.brokenLinks}</dd>
              </div>
            )}
          </dl>
          {data.secondCheck.findings.length > 0 && (
            <ul className="plain">
              {data.secondCheck.findings.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {data.strengths.length > 0 && (
        <section aria-labelledby="well-h">
          <h2 id="well-h" className="found-h2">What you already do well</h2>
          <ul className="plain">
            {data.strengths.map((s) => (
              <li key={s.text}>
                {s.text} <span className="source">{s.source}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="packages-h">
        <h2 id="packages-h" className="found-h2">Packages</h2>
        <p className="found-lead">Prices in New Zealand dollars.</p>
        <div className="packages">
          {PACKAGES.map((p) => (
            <article key={p.name} className="package">
              <header>
                <h3>{p.name}</h3>
                <p className="price">{p.price}</p>
              </header>
              <div>
                <p>{p.text}</p>
                {p.note && <p className="package-note">{p.note}</p>}
              </div>
            </article>
          ))}
          <article className="package care">
            <header>
              <h3>Care</h3>
            </header>
            <div>
              <p>{CARE}</p>
            </div>
          </article>
        </div>
      </section>

      <section aria-labelledby="pay-h">
        <h2 id="pay-h" className="found-h2">How payment works</h2>
        <ol className="steps">
          {PAYMENT.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="who-h">
        <h2 id="who-h" className="found-h2">Who we are</h2>
        <p>{WHO}</p>
        <p>
          {TOOLS}{' '}
          <a href={TOOLS_LINK.href} rel="noopener">
            {TOOLS_LINK.label}
          </a>
        </p>
      </section>

      {ENGINE_DESIGNS.has(data.design) ? (
        // An engine page asks for one thing first: a reply to the email the link came in. The call is the second way.
        <section aria-labelledby="reply-h" className="reply reply-first">
          <h2 id="reply-h" className="found-h2">Reply</h2>
          <p className="reply-line">
            <a href={mail} data-visit="cta_click">
              {REPLY_LINE.label}
            </a>
          </p>
          <p className="reply-sub">{REPLY_LINE.sub}</p>
          <p className="reply-second">
            <a href={data.reply.call} rel="noopener" data-visit="cta_click">
              {REPLY_BUTTONS.call}
            </a>
          </p>
          <p className="small">{REMOVAL}</p>
        </section>
      ) : (
        <section aria-labelledby="reply-h" className="reply">
          <h2 id="reply-h" className="found-h2">Reply</h2>
          <div className="reply-buttons">
            <a className="button" href={mail} data-visit="cta_click">
              {REPLY_BUTTONS.email}
            </a>
            <a className="button quiet" href={data.reply.call} rel="noopener" data-visit="cta_click">
              {REPLY_BUTTONS.call}
            </a>
          </div>
          <p className="small">{REMOVAL}</p>
        </section>
      )}
    </main>
  );
}
