import { CHECKS } from '@plumbline/checks/ids';
import { CRAWLMOUSE_TITLES } from '@plumbline/wave/rank';
import { batches, businessRows, currentBatch, currentWave, nzTime, waveLabel, waves } from '@/lib/data';

const titleOf = (checkId: string) => CHECKS.find((c) => c.id === checkId)?.title ?? CRAWLMOUSE_TITLES[checkId] ?? checkId.replace(/_/g, ' ');

export default async function Businesses({ searchParams }: { searchParams: Promise<{ batch?: string; wave?: string }> }) {
  const { batch: requested, wave: requestedWave } = await searchParams;
  const batch = currentBatch(requested);
  if (!batch) return <p>No batch has been audited yet. Run <code>plumb audit --batch &lt;name&gt;</code> first.</p>;
  const wave = currentWave(requestedWave);
  const rows = businessRows(batch, wave);
  const totals = rows.reduce((t, r) => ({ reproduced: t.reproduced + r.reproduced, approved: t.approved + r.approved }), { reproduced: 0, approved: 0 });
  const q = `?batch=${encodeURIComponent(batch)}${wave ? `&wave=${encodeURIComponent(wave)}` : ''}`;
  return (
    <>
      <h1>{wave ? `${waveLabel(wave)}: businesses in list order` : `Businesses in ${batch}`}</h1>
      <div className="row small">
        {batches().map((b) => (
          <a key={b} href={`/?batch=${encodeURIComponent(b)}`} style={{ fontWeight: b === batch && !wave ? 700 : 400 }}>
            {b}
          </a>
        ))}
        {waves().map((w) => (
          <a key={w} href={`/?batch=${encodeURIComponent(batch)}&wave=${encodeURIComponent(w)}`} style={{ fontWeight: w === wave ? 700 : 400 }}>
            {waveLabel(w)} only
          </a>
        ))}
        <span className="muted">
          {rows.length} businesses, {totals.reproduced} findings waiting for a decision, {totals.approved} approved
        </span>
      </div>
      {wave ? <p className="small muted">Findings are ranked for the owner: lost bookings and broken contact first, then speed, security, search and AI. The right column shows the three to five put forward for each business.</p> : null}
      <table style={{ marginTop: 12 }}>
        <thead>
          <tr>
            {wave ? <th>#</th> : null}
            <th>Business</th>
            <th>Place</th>
            <th>Status</th>
            <th>Findings</th>
            <th>{wave ? 'Put forward, in order' : 'Top three'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {wave ? <td>{r.position}</td> : null}
              <td>
                <a href={`/business/${r.slug}${q}`}>{r.name}</a>
              </td>
              <td>{[r.town, r.region].filter(Boolean).join(', ')}</td>
              <td className="small">
                {r.runB ? `confirmed ${nzTime(r.runB)}` : r.runA ? 'run A only, waiting for run B' : 'not audited'}
              </td>
              <td className="small">
                {r.reproduced > 0 && <span className="tag reproduced">{r.reproduced} to review</span>} {r.approved > 0 && <span className="tag approved">{r.approved} approved</span>}{' '}
                {r.rejected > 0 && <span className="tag rejected">{r.rejected} rejected</span>} {r.candidate > 0 && <span className="tag">{r.candidate} seen once</span>}{' '}
                {r.crawlmouse > 0 && <span className="tag">{r.crawlmouse} from Crawlmouse</span>}
              </td>
              <td className="small">
                {r.top.map((t, i) => (
                  <div key={i}>
                    {wave ? `${i + 1}. ${titleOf(t.check_id)}` : t.check_id.replace(/_/g, ' ')} <span className={`tag ${t.status}`}>{t.status === 'approved' ? 'approved' : wave ? 'to review' : 'candidate'}</span>
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
