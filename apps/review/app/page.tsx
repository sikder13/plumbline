import { batches, businessRows, currentBatch, nzTime } from '@/lib/data';

export default async function Businesses({ searchParams }: { searchParams: Promise<{ batch?: string }> }) {
  const { batch: requested } = await searchParams;
  const batch = currentBatch(requested);
  if (!batch) return <p>No batch has been audited yet. Run <code>plumb audit --batch &lt;name&gt;</code> first.</p>;
  const rows = businessRows(batch);
  const totals = rows.reduce((t, r) => ({ reproduced: t.reproduced + r.reproduced, approved: t.approved + r.approved }), { reproduced: 0, approved: 0 });
  return (
    <>
      <h1>Businesses in {batch}</h1>
      <div className="row small">
        {batches().map((b) => (
          <a key={b} href={`/?batch=${encodeURIComponent(b)}`} style={{ fontWeight: b === batch ? 700 : 400 }}>
            {b}
          </a>
        ))}
        <span className="muted">
          {rows.length} businesses, {totals.reproduced} findings waiting for a decision, {totals.approved} approved
        </span>
      </div>
      <table style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>Business</th>
            <th>Place</th>
            <th>Status</th>
            <th>Findings</th>
            <th>Top three</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <a href={`/business/${r.slug}?batch=${encodeURIComponent(batch)}`}>{r.name}</a>
              </td>
              <td>{[r.town, r.region].filter(Boolean).join(', ')}</td>
              <td className="small">
                {r.runB ? `confirmed ${nzTime(r.runB)}` : r.runA ? 'run A only, waiting for run B' : 'not audited'}
              </td>
              <td className="small">
                {r.reproduced > 0 && <span className="tag reproduced">{r.reproduced} to review</span>} {r.approved > 0 && <span className="tag approved">{r.approved} approved</span>}{' '}
                {r.rejected > 0 && <span className="tag rejected">{r.rejected} rejected</span>} {r.candidate > 0 && <span className="tag">{r.candidate} seen once</span>}
              </td>
              <td className="small">
                {r.top.map((t, i) => (
                  <div key={i}>
                    {t.check_id.replace(/_/g, ' ')} <span className={`tag ${t.status}`}>{t.status === 'approved' ? 'approved' : 'candidate'}</span>
                  </div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
