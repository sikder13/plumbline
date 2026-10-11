import { toggleSource } from '@/app/actions';
import { library } from '@/lib/data';

export default function LibraryPage() {
  const entries = [...library().values()].filter((e) => e.basis === 'BENCHMARK');
  const sources = entries.flatMap((e) => e.sources);
  const verified = sources.filter((s) => s.verified_by_ud).length;
  return (
    <>
      <h1>Impact library sources</h1>
      <p className="muted">
        {verified} of {sources.length} benchmark sources verified. Open each link, check the quote word for word, then mark it verified. The change is written to <code>impact/library.yaml</code> and is committed only when you run{' '}
        <code>plumb library-commit</code>.
      </p>
      {entries.map((e) => (
        <section className="card" key={e.check}>
          <h2 style={{ marginTop: 0 }}>{e.check.replace(/_/g, ' ')}</h2>
          <blockquote>{e.impact}</blockquote>
          <ul className="plain">
            {e.sources.map((s, i) => (
              <li key={i} style={{ marginBottom: 10 }}>
                <div>
                  {s.publisher}, {s.year}:{' '}
                  <a href={s.url} target="_blank" rel="noreferrer noopener">
                    {s.url}
                  </a>
                </div>
                <blockquote>
                  <q>{s.quote}</q>
                </blockquote>
                <form action={toggleSource} className="row">
                  <input type="hidden" name="check" value={e.check} />
                  <input type="hidden" name="index" value={i} />
                  <input type="hidden" name="verified" value={s.verified_by_ud ? 'false' : 'true'} />
                  <span className={`tag ${s.verified_by_ud ? 'yes' : 'candidate'}`}>{s.verified_by_ud ? 'Verified' : 'Not verified'}</span>
                  <button>{s.verified_by_ud ? 'Mark as not verified' : 'Mark as verified'}</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
