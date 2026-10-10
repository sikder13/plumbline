import { nzTime } from '@plumbline/core';
import { MASTER_COLUMNS, masterRow, ownerDisplay, secondDisplay, type BusinessView, type FindingView } from './data.ts';

export function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

const link = (url: string | null | undefined, text?: string) => (url ? `<a href="${esc(url)}" rel="noreferrer noopener" target="_blank">${esc(text ?? url)}</a>` : '');

const CSS = `
:root { --ink: #1c2530; --muted: #5d6b7a; --line: #d9dfe6; --bg: #f6f7f9; --card: #ffffff; --accent: #0b5a7a; --flag: #E4572E; --ok: #1f7a4d; --warn: #9a6400; }
* { box-sizing: border-box; }
body { margin: 0; font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--ink); background: var(--bg); }
header.top { background: var(--card); border-bottom: 1px solid var(--line); padding: 20px 28px; }
h1 { font-size: 22px; margin: 0 0 4px; }
h2 { font-size: 17px; margin: 28px 0 10px; }
h3 { font-size: 15px; margin: 0 0 6px; }
main { padding: 20px 28px 60px; max-width: 1400px; }
.muted { color: var(--muted); }
.small { font-size: 13px; }
a { color: var(--accent); }
.note { background: #fff7e6; border: 1px solid #f0d9a8; padding: 10px 14px; border-radius: 6px; margin: 12px 0; }
.controls { display: flex; flex-wrap: wrap; gap: 10px; margin: 14px 0; align-items: center; }
.controls input, .controls select { font: inherit; padding: 6px 9px; border: 1px solid var(--line); border-radius: 5px; background: var(--card); }
.controls input[type=search] { min-width: 260px; }
.tablewrap { overflow-x: auto; background: var(--card); border: 1px solid var(--line); border-radius: 8px; }
table { border-collapse: collapse; width: 100%; font-size: 13.5px; }
th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { background: #eef1f4; position: sticky; top: 0; cursor: pointer; white-space: nowrap; user-select: none; }
th[aria-sort=ascending]::after { content: " \\25B2"; font-size: 10px; }
th[aria-sort=descending]::after { content: " \\25BC"; font-size: 10px; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
tr:hover td { background: #fafbfc; }
.tag { display: inline-block; padding: 1px 7px; border-radius: 10px; font-size: 12px; border: 1px solid var(--line); background: #f1f3f5; white-space: nowrap; }
.tag.approved { background: #e3f4ea; border-color: #b7dfc6; color: var(--ok); }
.tag.candidate { background: #fff3da; border-color: #ecd7a4; color: var(--warn); }
.tag.basis { background: #e8f1f6; border-color: #c4d9e4; color: var(--accent); }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 16px 18px; margin: 12px 0; }
.card.finding { border-left: 4px solid var(--flag); }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
.kv { display: grid; grid-template-columns: 150px 1fr; gap: 3px 12px; font-size: 14px; }
.kv dt { color: var(--muted); }
.kv dd { margin: 0; overflow-wrap: anywhere; }
.evidence { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 10px; }
.evidence figure { margin: 0; max-width: 460px; }
.evidence img { max-width: 100%; max-height: 520px; border: 1px solid var(--line); border-radius: 4px; display: block; }
.evidence figcaption { font-size: 12px; color: var(--muted); margin-top: 4px; overflow-wrap: anywhere; }
blockquote { margin: 6px 0; padding: 6px 12px; border-left: 3px solid var(--line); color: #33404d; }
pre.excerpt { white-space: pre-wrap; overflow-wrap: anywhere; background: #f3f5f7; padding: 8px 10px; border-radius: 5px; font: 12.5px/1.45 ui-monospace, Menlo, Consolas, monospace; margin: 6px 0; max-height: 220px; overflow: auto; }
.swatches { display: flex; flex-wrap: wrap; gap: 10px; }
.swatch { width: 110px; font-size: 12px; }
.swatch i { display: block; height: 46px; border-radius: 5px; border: 1px solid var(--line); }
.brandimg { max-width: 260px; max-height: 140px; border: 1px solid var(--line); border-radius: 4px; background: #e9ecef; padding: 6px; }
ul.plain { margin: 6px 0; padding-left: 18px; }
`;

function page(title: string, body: string): string {
  return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="robots" content="noindex">\n<title>${esc(title)}</title>\n<style>${CSS}</style>\n</head>\n<body>\n${body}\n</body>\n</html>\n`;
}

const TABLE_SCRIPT = `
(function () {
  var table = document.getElementById('master');
  var body = table.tBodies[0];
  var rows = Array.prototype.slice.call(body.rows);
  var search = document.getElementById('q');
  var region = document.getElementById('region');
  var activity = document.getElementById('activity');
  var status = document.getElementById('status');
  var count = document.getElementById('count');
  function apply() {
    var q = search.value.toLowerCase();
    var shown = 0;
    rows.forEach(function (r) {
      var ok = (!q || r.textContent.toLowerCase().indexOf(q) !== -1) && (!region.value || r.dataset.region === region.value) && (!activity.value || r.dataset.activity === activity.value) && (!status.value || r.dataset.status === status.value);
      r.hidden = !ok;
      if (ok) shown += 1;
    });
    count.textContent = shown + ' of ' + rows.length + ' businesses';
  }
  [search, region, activity, status].forEach(function (el) { el.addEventListener('input', apply); });
  Array.prototype.forEach.call(table.tHead.rows[0].cells, function (th, i) {
    th.addEventListener('click', function () {
      var dir = th.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending';
      Array.prototype.forEach.call(table.tHead.rows[0].cells, function (c) { c.removeAttribute('aria-sort'); });
      th.setAttribute('aria-sort', dir);
      var numeric = th.classList.contains('num');
      rows.sort(function (a, b) {
        var x = a.cells[i].dataset.sort || a.cells[i].textContent.trim();
        var y = b.cells[i].dataset.sort || b.cells[i].textContent.trim();
        var cmp = numeric ? (parseFloat(x) || 0) - (parseFloat(y) || 0) : x.localeCompare(y);
        return dir === 'ascending' ? cmp : -cmp;
      });
      rows.forEach(function (r) { body.appendChild(r); });
    });
  });
  apply();
})();
`;

function statusTag(f: FindingView): string {
  return f.status === 'approved' ? '<span class="tag approved">approved</span>' : '<span class="tag candidate">candidate, not yet approved</span>';
}

export function indexHtml(batch: string, views: BusinessView[], anyApproved: boolean): string {
  const options = (values: (string | null)[]) => [...new Set(values.filter((v): v is string => !!v))].sort().map((v) => `<option>${esc(v)}</option>`).join('');
  const head = ['Business', 'Town', 'Region', 'Activity', 'Owner', 'Second', 'Email', 'Phone', 'Booking', 'Google', 'Findings', 'Top three', 'AI named', 'Brand', 'Score'];
  const numeric = new Set(['Google', 'Findings', 'Score']);
  const rows = views
    .map((v) => {
      const b = v.business;
      const r = masterRow(v);
      const top = v.top.map((f) => `<div>${esc(f.checkId.split('_')[0])} ${esc(f.checkTitle)} ${f.status === 'approved' ? '<span class="tag approved">approved</span>' : '<span class="tag candidate">candidate</span>'}</div>`).join('');
      return `<tr data-region="${esc(b.region)}" data-activity="${esc(b.activity)}" data-status="${v.topAreApproved ? 'approved' : v.runB ? 'reproduced' : 'run A only'}">
<td><a href="businesses/${esc(b.slug)}.html">${esc(b.name)}</a><div class="small">${link(b.website, (b.website ?? '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</div></td>
<td>${esc(b.town)}</td><td>${esc(b.region)}</td><td>${esc(b.activity)}</td>
<td>${esc(ownerDisplay(v))}${v.owner ? `<div class="small muted">${v.owner.name_confirmed ? 'confirmed' : 'not confirmed'}</div>` : ''}</td>
<td>${esc(secondDisplay(v))}${v.second?.title ? `<div class="small muted">${esc(v.second.title)}</div>` : ''}</td>
<td>${esc(v.email ?? (v.formOnly ? 'form only' : ''))}</td><td>${esc(v.phone)}</td>
<td>${esc(v.bookingSystems.join(', ') || 'none found')}${v.bookingPlatforms.length ? `<div class="small muted">${esc(v.bookingPlatforms.join(', '))}</div>` : ''}</td>
<td class="num" data-sort="${b.google_rating ?? 0}">${b.google_rating ?? ''}${b.google_review_count !== null ? ` <span class="muted">(${b.google_review_count})</span>` : ''}</td>
<td class="num">${v.reproducedCount}</td>
<td>${top}</td>
<td data-sort="${v.ai ? v.ai.namedIn : -1}">${esc(r.ai_named)}</td>
<td>${v.brand ? 'yes' : 'no'}</td>
<td class="num">${v.outreachScore.toFixed(2)}</td>
</tr>`;
    })
    .join('\n');
  return page(
    `Plumbline report: ${batch}`,
    `<header class="top"><h1>Plumbline report: ${esc(batch)}</h1><div class="muted">${views.length} audited businesses. Written ${esc(nzTime())}. Internal: no client sees this.</div></header>
<main>
${anyApproved ? '' : '<div class="note"><strong>No finding has been approved yet.</strong> The top three shown for each business are the highest scoring reproduced candidates. They become the approved top three once UD approves them in the review app.</div>'}
<div class="controls">
<input type="search" id="q" placeholder="Filter by any text" aria-label="Filter">
<select id="region" aria-label="Region"><option value="">All regions</option>${options(views.map((v) => v.business.region))}</select>
<select id="activity" aria-label="Activity"><option value="">All activities</option>${options(views.map((v) => v.business.activity))}</select>
<select id="status" aria-label="Status"><option value="">Any status</option><option>approved</option><option>reproduced</option><option>run A only</option></select>
<span id="count" class="muted small"></span>
<span class="small"><a href="master.csv">master.csv</a> · <a href="excluded.csv">excluded.csv</a> · <a href="SUMMARY.md">SUMMARY.md</a></span>
</div>
<div class="tablewrap"><table id="master"><thead><tr>${head.map((h) => `<th${numeric.has(h) ? ' class="num"' : ''}${h === 'Score' ? ' aria-sort="descending"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>
${rows}
</tbody></table></div>
<p class="small muted">Columns in master.csv: ${MASTER_COLUMNS.join(', ')}.</p>
</main>
<script>${TABLE_SCRIPT}</script>`,
  );
}

function sourcesHtml(f: FindingView): string {
  const e = f.impact;
  const label = { BENCHMARK: 'Benchmark: a published figure', OBSERVED: "Observed: the business's own measured data", OUR_VIEW: 'Our view: plain reasoning, not a statistic' }[e.basis];
  const sources = e.sources
    .map((s) => `<li>${esc(s.publisher)}, ${esc(s.year)}: <q>${esc(s.quote)}</q> ${link(s.url, 'source')} <span class="tag ${s.verified_by_ud ? 'approved' : 'candidate'}">${s.verified_by_ud ? 'verified by UD' : 'not yet verified by UD'}</span></li>`)
    .join('');
  return `<div class="small"><span class="tag basis">${esc(label)}</span>${sources ? `<ul class="plain">${sources}</ul>` : ''}</div>`;
}

function findingCard(f: FindingView, evidenceHref: (path: string) => string | null): string {
  const figures = f.evidence
    .map((e) => {
      const href = e.path ? evidenceHref(e.path) : null;
      const caption = `${esc(e.url ?? '')}${e.viewport ? ` · ${esc(e.viewport)}` : ''} · ${esc(e.captured_at_utc)} UTC · ${esc(e.captured_at_nz)}`;
      return href ? `<figure><a href="${esc(href)}"><img loading="lazy" src="${esc(href)}" alt="Evidence for ${esc(f.checkTitle)}"></a><figcaption>${caption}</figcaption></figure>` : '';
    })
    .join('');
  const excerpts = f.evidence.map((e) => `<pre class="excerpt">${esc(e.excerpt)}</pre>${e.path ? '' : `<div class="small muted">${esc(e.url ?? '')} · ${esc(e.captured_at_utc)} UTC · ${esc(e.captured_at_nz)}</div>`}`).join('');
  return `<div class="card finding" id="f${f.id}">
<h3>${esc(f.checkId.split('_')[0])} ${esc(f.checkTitle)} ${statusTag(f)}</h3>
<div class="small muted">${esc(f.title)} · ${esc(f.tier)} · severity ${f.severity} · score ${f.score.toFixed(2)}${f.lastVerifiedAt ? ` · last verified ${esc(nzTime(f.lastVerifiedAt))}` : ' · seen in one run only'}${f.pageUrl ? ` · ${link(f.pageUrl)}` : ''}</div>
<blockquote><strong>Impact.</strong> ${esc(f.impact.impact)}</blockquote>
<blockquote><strong>Fix.</strong> ${esc(f.impact.fix)}</blockquote>
${sourcesHtml(f)}
<div class="evidence">${figures}</div>
${excerpts}
</div>`;
}

function contactBlock(v: BusinessView): string {
  const item = (label: string, value: string, source?: string | null, quote?: string | null) =>
    value ? `<dt>${label}</dt><dd>${value}${source ? ` <span class="small muted">source: ${link(source)}</span>` : ''}${quote ? `<div class="small muted">${esc(quote)}</div>` : ''}</dd>` : '';
  const people = v.contacts
    .filter((c) => c.name)
    .map((c) => item(c.role === 'owner' ? 'Owner' : 'Second', `${esc(c.name_confirmed ? c.name : (c.name ?? '').split(/\s+/)[0])} <span class="tag ${c.name_confirmed ? 'approved' : 'candidate'}">${c.name_confirmed ? 'confirmed' : 'not confirmed, first name only'}</span>${c.title ? ` <span class="muted">${esc(c.title)}</span>` : ''}`, c.source_url, c.source_quote))
    .join('');
  const emails = v.contacts.filter((c) => c.email).map((c) => item('Email', esc(c.email), c.email_source_url, c.source_quote)).join('');
  const form = v.contacts.find((c) => c.contact_form_url)?.contact_form_url;
  return `<dl class="kv">${people}${emails}${item('Phone', esc(v.phone ?? ''))}${item('Contact form', link(form))}${item('LinkedIn', esc(v.contacts.find((c) => c.linkedin_url)?.linkedin_url ?? ''))}</dl>${!people ? '<p class="small muted">No owner or second in command was named on the pages read.</p>' : ''}`;
}

function brandBlock(v: BusinessView, fileHref: (path: string) => string | null): string {
  if (!v.brand) return '<p class="muted">No brand pack was captured.</p>';
  const colours = JSON.parse(v.brand.colors) as { hex: string; role: string; share: number }[];
  const fonts = JSON.parse(v.brand.fonts) as { desktop: { body: string | null; headings: string | null; buttons: string | null; webFonts: string[]; sources: string[] } | null; mobile: unknown };
  const images = JSON.parse(v.brand.hero_images) as { url: string; alt: string; width: number; height: number; hero?: boolean }[];
  const voice = JSON.parse(v.brand.voice_samples) as { quote: string; url: string }[];
  const logo = v.brand.logo_path ? fileHref(v.brand.logo_path) : null;
  const hero = v.brand.hero_path ? fileHref(v.brand.hero_path) : null;
  const f = fonts.desktop;
  return `<div class="grid">
<div><h3>Logo</h3>${logo ? `<img class="brandimg" src="${esc(logo)}" alt="Logo">` : '<span class="muted">none found</span>'}<div class="small muted">${esc(v.brand.logo_source_url ?? '')}</div></div>
<div><h3>Hero image</h3>${hero ? `<img class="brandimg" src="${esc(hero)}" alt="Hero image">` : '<span class="muted">none found</span>'}<div class="small muted">${esc(images.find((i) => i.hero)?.url ?? '')}</div></div>
</div>
<h3 style="margin-top:14px">Colours</h3><div class="swatches">${colours.map((c) => `<div class="swatch"><i style="background:${esc(c.hex)}"></i>${esc(c.hex)}<br><span class="muted">${esc(c.role)}, ${(c.share * 100).toFixed(0)}%</span></div>`).join('')}</div>
<h3 style="margin-top:14px">Fonts</h3>${f ? `<dl class="kv"><dt>Body</dt><dd>${esc(f.body)}</dd><dt>Headings</dt><dd>${esc(f.headings)}</dd><dt>Buttons</dt><dd>${esc(f.buttons)}</dd><dt>Web fonts</dt><dd>${esc(f.webFonts.join(', ') || 'none')}</dd><dt>Font source</dt><dd>${esc(f.sources.join(', ') || 'system fonts')}</dd></dl>` : '<span class="muted">not captured</span>'}
<h3 style="margin-top:14px">Voice</h3>${voice.length ? `<ul class="plain">${voice.map((q) => `<li><q>${esc(q.quote)}</q> <span class="small muted">${link(q.url)}</span></li>`).join('')}</ul>` : '<span class="muted">no short quotes found</span>'}
<h3 style="margin-top:14px">Other large images</h3>${images.filter((i) => !i.hero).length ? `<ul class="plain small">${images.filter((i) => !i.hero).map((i) => `<li>${link(i.url)} ${i.width} x ${i.height}${i.alt ? `, alt: ${esc(i.alt)}` : ', no alt text'}</li>`).join('')}</ul>` : '<span class="muted">none</span>'}`;
}

export function businessHtml(batch: string, v: BusinessView, fileHref: (path: string) => string | null): string {
  const b = v.business;
  const shown = new Set(v.top.map((f) => f.id));
  const rest = v.findings.filter((f) => !shown.has(f.id));
  const ai = v.ai;
  return page(
    `${b.name}: Plumbline`,
    `<header class="top"><div class="small"><a href="../index.html">&larr; ${esc(batch)}</a></div><h1>${esc(b.name)}</h1>
<div class="muted">${esc([b.town, b.region].filter(Boolean).join(', '))} · ${esc(b.activity)} · ${link(b.website)} · outreach score ${v.outreachScore.toFixed(2)}</div></header>
<main>
${v.notes.length ? `<div class="note small">${v.notes.map(esc).join('<br>')}</div>` : ''}
<div class="grid">
<div class="card"><h2 style="margin-top:0">Contacts</h2>${contactBlock(v)}</div>
<div class="card"><h2 style="margin-top:0">Profile</h2><dl class="kv">
<dt>Booking system</dt><dd>${esc(v.bookingSystems.join(', ') || 'none found on the site')}</dd>
<dt>Booking platforms</dt><dd>${esc(v.bookingPlatforms.join(', ') || 'none found')}</dd>
<dt>Site platform</dt><dd>${esc(v.platform ?? 'not identified')}</dd>
<dt>Google</dt><dd>${b.google_rating !== null ? `${b.google_rating} from ${b.google_review_count} reviews` : 'not recorded'}</dd>
<dt>Run A</dt><dd>${v.runA ? esc(nzTime(v.runA)) : 'not run'}</dd>
<dt>Run B</dt><dd>${v.runB ? esc(nzTime(v.runB)) : 'not run'}</dd>
<dt>Reproduced findings</dt><dd>${v.reproducedCount}</dd>
</dl></div>
</div>
<h2>Top findings ${v.top.length ? (v.topAreApproved ? '' : '<span class="tag candidate">candidates, not yet approved</span>') : ''}</h2>
${v.top.length ? v.top.map((f) => findingCard(f, fileHref)).join('\n') : '<p class="muted">No finding has been reproduced for this business.</p>'}
<h2>Other findings</h2>
${rest.length ? `<div class="card"><ul class="plain">${rest.map((f) => `<li>${esc(f.checkId.split('_')[0])} ${esc(f.checkTitle)}: ${esc(f.title)} <span class="tag ${f.status === 'approved' ? 'approved' : 'candidate'}">${esc(f.status === 'candidate' ? 'seen in one run only' : f.status)}</span> <span class="muted small">score ${f.score.toFixed(2)}</span></li>`).join('')}</ul></div>` : '<p class="muted">None.</p>'}
<h2>AI answers</h2>
<div class="card">${
      ai
        ? `<p>Named in <strong>${ai.namedIn} of ${ai.questions}</strong> answers to the question about its place where it did best.</p>
${ai.others.length ? `<p class="small">Others named: ${ai.others.map((o) => `${esc(o.name)} (${o.answers})`).join(', ')}. Names taken from answer text are candidates until UD confirms them.</p>` : ''}
${ai.sample ? `<p class="small muted">Example: ${esc(ai.sample.provider)}, ${esc(ai.sample.askedAt)} UTC (${esc(nzTime(ai.sample.askedAt))})</p><p class="small"><strong>${esc(ai.sample.question)}</strong></p><pre class="excerpt">${esc(ai.sample.answer)}</pre><div class="small muted">${ai.sample.citations.map((c) => link(c)).join(' · ')}</div>` : ''}`
        : '<span class="muted">No AI answers have been collected for this business.</span>'
    }</div>
<h2>Brand pack</h2>
<div class="card">${brandBlock(v, fileHref)}</div>
</main>`,
  );
}
