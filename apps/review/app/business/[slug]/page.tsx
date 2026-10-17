import { notFound } from 'next/navigation';
import { reviewFinding } from '@/app/actions';
import { business, cautions, currentBatch, currentWave, facts, findingsFor, neighbours, nzTime, rankedFindings, waveLabel, type Finding } from '@/lib/data';
import { ReviewKeys } from './keys';

const BASIS: Record<string, string> = {
  BENCHMARK: 'Benchmark: a published figure',
  OBSERVED: "Observed: the business's own measured data",
  OUR_VIEW: 'Our view: plain reasoning, not a statistic',
};

interface Place {
  place: number;
  group: string;
  kept: boolean;
  /** The finding this one repeats, when it was left out of the order for that reason. */
  repeatOf: string | null;
}

interface CrawlmouseDetail {
  measured?: string | null;
  caution?: string | null;
  examples?: { url: string; status: number | null; linkedFrom?: { pageUrl: string; text: string; where: string }[] }[];
  crawlmouse?: { auditedAt?: string | null; pagesRead?: number | null; coveragePct?: number | null; confidence?: string | null };
}

/** A page linked from the menu is linked from every page. A few are enough to show where. */
const LINKERS_SHOWN = 3;

function Crawlmouse({ f }: { f: Finding }) {
  const d = JSON.parse(f.detail || '{}') as CrawlmouseDetail;
  const c = d.crawlmouse ?? {};
  return (
    <>
      <blockquote>
        <strong>Crawlmouse says.</strong> {f.title}
      </blockquote>
      <blockquote>
        <strong>We measured.</strong> {d.measured}
      </blockquote>
      {d.caution ? <p className="tag candidate">Caution from Crawlmouse: {d.caution}</p> : null}
      <div className="small">
        <ul className="plain">
          {(d.examples ?? []).map((e, i) => (
            <li key={i}>
              <a href={e.url} target="_blank" rel="noreferrer noopener">
                {e.url}
              </a>{' '}
              answers {e.status ?? 'nothing'}
              {(e.linkedFrom ?? []).slice(0, LINKERS_SHOWN).map((l, j) => (
                <span key={j}>
                  {j ? '; ' : '. Linked from '}
                  <a href={l.pageUrl} target="_blank" rel="noreferrer noopener">
                    {l.pageUrl}
                  </a>{' '}
                  ({l.where === 'page' ? 'link' : `${l.where} link`} {l.text ? <>&ldquo;{l.text}&rdquo;</> : 'with no words on it'})
                </span>
              ))}
              {(e.linkedFrom ?? []).length > LINKERS_SHOWN ? ` and ${(e.linkedFrom ?? []).length - LINKERS_SHOWN} more` : ''}
            </li>
          ))}
        </ul>
        <span className="muted">
          Crawlmouse audit {c.auditedAt ?? 'date not given'}
          {c.pagesRead ? `, ${c.pagesRead} pages read` : ''}
          {c.coveragePct ? `, ${c.coveragePct}% of the site` : ''}
          {c.confidence ? `, confidence ${c.confidence}` : ''}. A count in its sentence is Crawlmouse&rsquo;s own; we opened the pages listed here.
        </span>
      </div>
    </>
  );
}

function Card({ f, place, caution }: { f: Finding; place?: Place; caution?: string }) {
  const open = f.status === 'reproduced';
  const fromCrawlmouse = f.source === 'crawlmouse';
  return (
    <section className={`card ${open ? '' : 'done'}`} data-finding={f.id} data-open={open ? 'yes' : 'no'}>
      <h2 style={{ marginTop: 0 }}>
        {fromCrawlmouse ? 'Crawlmouse' : f.check_id.split('_')[0]} {f.checkTitle} <span className={`tag ${f.status}`}>{f.status === 'candidate' ? 'seen in one run only' : f.status}</span>{' '}
        {fromCrawlmouse ? <span className="tag">source: Crawlmouse</span> : null} {f.top3 ? <span className="tag approved">top three</span> : null}{' '}
        {place?.kept ? <span className="tag yes">put forward, place {place.place}</span> : null}
        {place && !place.kept && !place.repeatOf ? <span className="tag">place {place.place}, not put forward</span> : null}
        {place?.repeatOf ? <span className="tag no">repeats {place.repeatOf}</span> : null}
      </h2>
      <div className="small muted">
        {fromCrawlmouse ? '' : `${f.title} · `}
        {f.tier} · severity {f.severity} · score {f.score.toFixed(2)}
        {place ? ` · ${place.group}` : ''}
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
      {caution ? <p className="tag rejected" style={{ whiteSpace: 'normal' }}>{caution}</p> : null}
      {fromCrawlmouse ? (
        <Crawlmouse f={f} />
      ) : f.entry ? (
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

function FactsTable({ businessId }: { businessId: number }) {
  const all = facts(businessId);
  // Every photo measured is stored. Only the ones chosen for the top of a page are listed here.
  const list = all.filter((x) => x.topic !== 'photo' || x.flag);
  const photos = all.length - list.length;
  if (!list.length) return null;
  const show = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));
  return (
    <details style={{ margin: '10px 0' }}>
      <summary className="small">
        Facts stored for this business ({list.length}), each with its source and the day it was checked{photos ? `. ${photos} more photos were measured and not chosen.` : ''}
      </summary>
      <table style={{ marginTop: 8 }}>
        <thead>
          <tr>
            <th>Fact</th>
            <th>Value</th>
            <th>Source</th>
            <th>Checked</th>
          </tr>
        </thead>
        <tbody>
          {list.map((x) => (
            <tr key={x.id}>
              <td className="small">
                {x.topic}
                {x.label ? `: ${x.label}` : ''} {x.flag ? <span className="tag candidate">{x.flag}</span> : null}
              </td>
              <td className="small" style={{ overflowWrap: 'anywhere' }}>
                {show(x.value)}
                {x.quote ? <div className="muted">&ldquo;{x.quote}&rdquo;</div> : null}
              </td>
              <td className="small" style={{ overflowWrap: 'anywhere' }}>
                {x.sourceUrl ? (
                  <a href={x.sourceUrl} target="_blank" rel="noreferrer noopener">
                    {x.sourceUrl}
                  </a>
                ) : null}
              </td>
              <td className="small">{nzTime(x.checkedOn)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

export default async function BusinessPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ batch?: string; wave?: string }> }) {
  const { slug } = await params;
  const { batch: requested, wave: requestedWave } = await searchParams;
  const b = business(slug);
  const batch = currentBatch(requested);
  if (!b || !batch) notFound();
  const wave = currentWave(requestedWave);
  const findings = findingsFor(b.id, batch);
  // In a wave the findings come in the order they would matter to the owner, the ones put forward first.
  const ranked = wave ? rankedFindings(b.id, batch) : [];
  const name = (id: number) => {
    const x = findings.find((f) => f.id === id);
    return x ? `${x.check_id.split('_')[0]} ${x.checkTitle}` : `finding ${id}`;
  };
  const places = new Map(ranked.map((r) => [r.finding.id, { place: r.place, group: r.group, kept: r.kept, repeatOf: r.repeatOf === null ? null : name(r.repeatOf) }]));
  const ordered = wave ? [...ranked.map((r) => r.finding), ...findings.filter((f) => !places.has(f.id))] : findings;
  const warnings = wave ? cautions(b.id, findings) : new Map<number, string>();
  const { prev, next } = neighbours(batch, slug, wave);
  const q = `?batch=${encodeURIComponent(batch)}${wave ? `&wave=${encodeURIComponent(wave)}` : ''}`;
  return (
    <>
      <div className="row small">
        <a href={`/${q}`}>&larr; {wave ? waveLabel(wave) : batch}</a>
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
      {wave ? <FactsTable businessId={b.id} /> : null}
      {wave && ranked.length > 0 ? (
        <p className="small muted">
          {ranked.filter((r) => r.kept).length} of {ranked.filter((r) => r.repeatOf === null).length} findings are put forward for this business, ranked for the owner. The rest follow, then findings seen once, rejected or no longer true.
        </p>
      ) : null}
      {findings.length === 0 && <p className="muted">No findings for this business in this batch.</p>}
      {ordered.map((f) => (
        <Card key={f.id} f={f} place={places.get(f.id)} caution={warnings.get(f.id)} />
      ))}
      <ReviewKeys />
    </>
  );
}
