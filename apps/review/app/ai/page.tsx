import { confirmMention } from '@/app/actions';
import { aiAnswers, aiQuestions, currentBatch, nzTime } from '@/lib/data';

export default async function AiPage({ searchParams }: { searchParams: Promise<{ batch?: string; q?: string }> }) {
  const { batch: requested, q } = await searchParams;
  const batch = currentBatch(requested);
  if (!batch) return <p>No batch yet.</p>;
  const questions = aiQuestions(batch);
  if (!questions.length) return <p className="muted">No AI answers have been collected for {batch}. Run <code>plumb ai --batch {batch}</code>.</p>;
  const key = questions.find((x) => x.question_key === q)?.question_key ?? questions[0]!.question_key;
  const answers = aiAnswers(key);
  return (
    <>
      <h1>AI answers in {batch}</h1>
      <form className="row" method="get">
        <input type="hidden" name="batch" value={batch} />
        <select name="q" defaultValue={key} style={{ maxWidth: 760 }}>
          {questions.map((x) => (
            <option key={x.question_key} value={x.question_key}>
              {x.kind}: {x.question} ({x.businesses} {x.businesses === 1 ? 'business' : 'businesses'}, {x.answers} answers)
            </option>
          ))}
        </select>
        <button>Show</button>
      </form>
      <p className="small muted">
        Names found in an answer are candidates until confirmed. Mark each as a real competitor or not. Unmarked names still count; names marked &ldquo;not a business&rdquo; are dropped.
      </p>
      {answers.map((a) => (
        <div className="answer" key={a.id}>
          <div className="small muted">
            {a.provider} ({a.model}) · run {a.run_index + 1} · {a.asked_at} UTC · {nzTime(a.asked_at)}
          </div>
          <pre>{a.answer}</pre>
          <div className="small">
            {(JSON.parse(a.citations) as { url: string }[]).map((c, i) => (
              <span key={i}>
                <a href={c.url} target="_blank" rel="noreferrer noopener">
                  {c.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)}
                </a>{' '}
                ·{' '}
              </span>
            ))}
          </div>
          <div className="mentions small" style={{ marginTop: 8 }}>
            {a.mentions.map((m) => (
              <form action={confirmMention} key={m.id}>
                <input type="hidden" name="id" value={m.id} />
                <span className={`tag ${m.confirmed === 1 ? 'yes' : m.confirmed === 0 ? 'no' : m.business_id ? 'approved' : 'candidate'}`}>
                  {m.name}
                  {m.business_id ? ' (known business)' : ''}
                </span>
                <button name="confirmed" value="yes" title="A real business named in this answer">
                  yes
                </button>
                <button name="confirmed" value="no" title="Not a business">
                  no
                </button>
              </form>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
