import { basename } from 'node:path';
import { nzTime } from '@plumbline/core';
import { ownerDisplay, secondDisplay, type BusinessView, type ContactRow } from './data.ts';

const cell = (v: unknown) => String(v ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

function person(c: ContactRow | null, shown: string): string {
  if (!c || !shown) return 'not named on the pages read';
  return `${shown} (${c.name_confirmed ? 'confirmed' : 'not confirmed, first name only'}${c.title ? `, ${c.title}` : ''}). Source: ${c.source_url ?? 'none recorded'}`;
}

/** Everything the report holds about the highest scoring businesses, as plain markdown with no images. */
export function topMarkdown(batch: string, views: BusinessView[], count = 25): string {
  const top = views.slice(0, count);
  const lines: string[] = [`# ${batch}: the ${top.length} highest outreach scores`, '', `Written ${nzTime()}. Internal document. In score order.`, ''];
  lines.push('No finding has been approved unless it says so. The top three are the three highest scoring reproduced findings, one per check.', '');
  lines.push('| # | Business | Town | Score | Reproduced findings |', '|---|---|---|---|---|');
  top.forEach((v, i) => lines.push(`| ${i + 1} | ${cell(v.business.name)} | ${cell(v.business.town)} | ${v.outreachScore.toFixed(2)} | ${v.reproducedCount} |`));

  top.forEach((v, i) => {
    const b = v.business;
    const topIds = new Set(v.top.map((f) => f.id));
    lines.push('', `## ${i + 1}. ${b.name}`, '');
    lines.push(`- **Outreach score:** ${v.outreachScore.toFixed(2)}`);
    lines.push(`- **Town:** ${b.town ?? 'not recorded'}`);
    lines.push(`- **Region:** ${b.region ?? 'not recorded'}`);
    lines.push(`- **Activity:** ${b.activity ?? 'not recorded'}`);
    lines.push(`- **Website:** ${b.website ?? 'none'}`);
    lines.push(`- **Owner:** ${person(v.owner, ownerDisplay(v))}`);
    lines.push(`- **Second in command:** ${person(v.second, secondDisplay(v))}`);
    lines.push(`- **Email:** ${v.email ? `${v.email}. Source page: ${v.emailSource ?? 'none recorded'}` : v.formOnly ? `none published; contact form at ${v.contacts.find((c) => c.contact_form_url)?.contact_form_url}` : 'none published'}`);
    lines.push(`- **Phone:** ${v.phone ?? 'none recorded'}`);
    lines.push(`- **Booking system:** ${v.bookingSystems.join(', ') || 'none found on the site'}`);
    lines.push(`- **Booking platforms:** ${v.bookingPlatforms.join(', ') || 'none found'}`);
    lines.push(`- **Google:** ${b.google_rating !== null ? `${b.google_rating} from ${b.google_review_count} reviews` : 'not recorded'}`);
    if (v.ai) {
      const others = v.ai.others.filter((o) => o.answers >= 2).slice(0, 8);
      lines.push(`- **AI answers:** named in ${v.ai.namedIn} of ${v.ai.questions}. ${v.ai.namedIn ? 'Also named' : 'Named instead'} (names from answer text are unconfirmed): ${others.map((o) => `${o.name} (${o.answers})`).join(', ') || 'nobody named twice or more'}`);
    } else lines.push('- **AI answers:** none collected');
    if (v.brand) {
      const colours = JSON.parse(v.brand.colors) as { hex: string; role: string; share: number }[];
      const fonts = (JSON.parse(v.brand.fonts) as { desktop: { body: string | null; headings: string | null; buttons: string | null; sources: string[] } | null }).desktop;
      lines.push(`- **Brand pack, logo:** ${v.brand.logo_path ? `found (${basename(v.brand.logo_path)}), from ${v.brand.logo_source_url}` : 'not found'}`);
      lines.push(`- **Brand pack, colours:** ${colours.map((c) => `${c.hex} ${c.role} ${(c.share * 100).toFixed(0)}%`).join('; ') || 'none captured'}`);
      lines.push(`- **Brand pack, fonts:** ${fonts ? `body ${fonts.body ?? 'unknown'}; headings ${fonts.headings ?? 'unknown'}; buttons ${fonts.buttons ?? 'unknown'}; source ${fonts.sources.join(', ') || 'system fonts'}` : 'not captured'}`);
    } else lines.push('- **Brand pack:** not captured');
    if (v.notes.length) lines.push(`- **Notes:** ${v.notes.join(' | ')}`);

    const proven = v.findings.filter((f) => f.status === 'reproduced' || f.status === 'approved');
    lines.push('', `**Reproduced findings (${proven.length})**`, '');
    if (!proven.length) lines.push('None.');
    else {
      lines.push('| Top 3 | Check | Title | Tier | Status | What was found | Evidence files |', '|---|---|---|---|---|---|---|');
      for (const f of proven) {
        const files = f.evidence.map((e) => (e.path ? basename(e.path) : null)).filter(Boolean);
        lines.push(`| ${topIds.has(f.id) ? 'yes' : ''} | ${f.checkId} | ${cell(f.checkTitle)} | ${f.tier} | ${f.status === 'approved' ? 'approved' : 'candidate'} | ${cell(f.title)} | ${files.join(', ') || (f.evidence[0]?.kind === 'ai' ? 'AI answer text, no image' : 'no image')} |`);
      }
      lines.push('', `Evidence images are in \`files/${b.slug}/\`. Full detail: \`businesses/${b.slug}.html\`.`);
    }
  });
  return lines.join('\n') + '\n';
}
