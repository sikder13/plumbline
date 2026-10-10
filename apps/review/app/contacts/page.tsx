import { saveContact } from '@/app/actions';
import { contactRows, currentBatch } from '@/lib/data';

export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ batch?: string }> }) {
  const { batch: requested } = await searchParams;
  const batch = currentBatch(requested);
  const rows = contactRows(batch);
  return (
    <>
      <h1>Contacts{batch ? ` in ${batch}` : ''}</h1>
      <p className="muted small">Names are shown as published. A surname is used outside this app only after you mark the name confirmed. LinkedIn is not looked up automatically; paste an address if you have one.</p>
      <table>
        <thead>
          <tr>
            <th>Business</th>
            <th>Role</th>
            <th>Name or contact</th>
            <th>Source</th>
            <th>LinkedIn and confirmation</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td>
                <a href={`/business/${c.slug}`}>{c.business}</a>
              </td>
              <td>
                {c.role}
                {c.title ? <div className="small muted">{c.title}</div> : null}
              </td>
              <td>
                {c.name ? <strong>{c.name}</strong> : null}
                {c.email ? <div>{c.email}</div> : null}
                {c.phone ? <div className="small">{c.phone}</div> : null}
                {c.contact_form_url ? (
                  <div className="small">
                    <a href={c.contact_form_url} target="_blank" rel="noreferrer noopener">
                      contact form
                    </a>
                  </div>
                ) : null}
              </td>
              <td className="small">
                {c.source_quote ? <q>{c.source_quote}</q> : null}
                <div>
                  {(c.email_source_url ?? c.source_url) && (
                    <a href={(c.email_source_url ?? c.source_url)!} target="_blank" rel="noreferrer noopener">
                      {(c.email_source_url ?? c.source_url)!.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)}
                    </a>
                  )}
                </div>
              </td>
              <td>
                {c.name ? (
                  <form action={saveContact} className="row small">
                    <input type="hidden" name="id" value={c.id} />
                    <input type="url" name="linkedin" placeholder="https://www.linkedin.com/in/..." defaultValue={c.linkedin_url ?? ''} style={{ width: 250 }} />
                    <label>
                      <input type="checkbox" name="confirmed" defaultChecked={!!c.name_confirmed} /> name confirmed
                    </label>
                    <button>Save</button>
                  </form>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
