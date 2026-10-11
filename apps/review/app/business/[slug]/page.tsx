import { notFound } from 'next/navigation';
import { reviewFinding } from '@/app/actions';
import { business, currentBatch, findingsFor, neighbours, nzTime, type Finding } from '@/lib/data';
import { ReviewKeys } from './keys';

const BASIS: Record<string, string> = {
  BENCHMARK: 'Benchmark: a published figure',
  OBSERVED: "Observed: the business's own measured data",
  OUR_VIEW: 'Our view: plain reasoning, not a statistic',
};

function Card({ f }: { f: Finding }) {
  const open = f.status === 'reproduced';
  return (
    <section className={`card ${open ? '' : 'done'}`} data-finding={f.id} data-open={open ? 'yes' : 'no'}>
      <h2 style={{ marginTop: 0 }}>
        {f.check_id.split('_')[0]} {f.checkTitle} <span className={`tag ${f.status}`}>{f.status === 'candidate' ? 'seen in one run only' : f.status}</span>
        {f.top3 ? <span className="tag approved">top three</span> : null}
      </h2>
      <div className="small muted">
        {f.title} · {f.tier} · severity {f.severity} · score {f.score.toFixed(2)}
        {f.last_verified_at ? ` · last verified ${nzTime(f.last_verified_at)}` : ''}
        {f.page_url ? (
          <>
            {' · '}
            <a href={f.page_url} target="_blank" rel="noreferrer noopener">
              {f.page_url}
            </a>
          </>
        ) : null}
      </div>
      {f.entry ? (
        <>
          <blockquote>
            <strong>Impact.</strong> {f.entry.impact}
          </blockquote>
          <blockquote>
            <strong>Fix.</strong> {f.entry.fix}
          </blockquote>
          <div className="small">
            <span className="tag">{BASIS[f.entry.basis]}</span>
            {f.entry.sources.length > 0 && (
              <ul className="plain">
                {f.entry.sources.map((s, i) => (
                  <li key={i}>
                    {s.publisher}, {s.year}: <q>{s.quote}</q>{' '}
                    <a href={s.url} target="_blank" rel="noreferrer noopener">
                      source
                    </a>{' '}
                    <span className={`tag ${s.verified_by_ud ? 'yes' : 'candidate'}`}>{s.verified_by_ud ? 'verified' : 'not yet verified'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <p className="tag rejected">No library entry for this check</p>
      )}
      <div className="evidence">
        {f.evidence
          .filter((e) => e.path)
          .map((e) => (
            <figure key={e.id}>
              <a href={`/file/${e.id}`} target="_blank">
                <img src={`/file/${e.id}`} alt={`Evidence for ${f.checkTitle}`} loading="lazy" />
              </a>
              <figcaption>
                {e.url} {e.viewport ? `· ${e.viewport}` : ''} · {e.captured_at_utc} UTC · {e.captured_at_nz}
              </figcaption>
            </figure>
          ))}
      </div>
      {f.evidence.map((e) => (
        <pre key={e.id}>{e.excerpt}</pre>
      ))}
      {f.note ? <p className="small">Note: {f.note}</p> : null}
      {f.status === 'candidate' ? (
        <p className="small muted">This finding has been seen in one run only. It can be approved once run B reproduces it.</p>
      ) : (
        <form className="decide" action={reviewFinding}>
          <input type="hidden" name="id" value={f.id} />
          <textarea name="note" placeholder="Note (optional)" defaultValue={f.note ?? ''} />
          <button className="approve" name="decision" value="approve" disabled={!f.reproduced}>
            Approve
          </button>
          <button className="reject" name="decision" value="reject">
            Reject
          </button>
        </form>
      )}
    </section>
  );
}

export default async function BusinessPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ batch?: string }> }) {
  const { slug } = await params;
  const { batch: requested } = await searchParams;
  const b = business(slug);
  const batch = currentBatch(requested);
  if (!b || !batch) notFound();
  const findings = findingsFor(b.id, batch);
  const { prev, next } = neighbours(batch, slug);
  const q = `?batch=${encodeURIComponent(batch)}`;
  return (
    <>
      <div className="row small">
        <a href={`/${q}`}>&larr; {batch}</a>
        {prev && <a href={`/business/${prev}${q}`}>Previous business</a>}
        {next && (
          <a href={`/business/${next}${q}`} id="next-business">
            Next business
          </a>
        )}
        <span className="muted">
          <kbd>a</kbd> approve · <kbd>r</kbd> reject · <kbd>n</kbd> next
        </span>
      </div>
      <h1>{b.name}</h1>
      <div className="muted small">
        {[b.town, b.region].filter(Boolean).join(', ')} · {b.activity} ·{' '}
        {b.website && (
          <a href={b.website} target="_blank" rel="noreferrer noopener">
            {b.website}
          </a>
        )}
      </div>
      {findings.length === 0 && <p className="muted">No findings for this business in this batch.</p>}
      {findings.map((f) => (
        <Card key={f.id} f={f} />
      ))}
      <ReviewKeys />
    </>
  );
}
