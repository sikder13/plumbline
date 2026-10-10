import { config, nzTime, type Business, type Db } from '@plumbline/core';
import { aiSummary } from '@plumbline/ai';
import { CHECKS, CHECK_IDS, type AiSummary } from '@plumbline/checks';
import { loadSite, sitePlatform, type SiteData } from '@plumbline/collect';
import { usableName } from '@plumbline/contacts';
import { loadLibrary, type ImpactEntry } from '@plumbline/impact';

export interface ContactRow {
  role: string;
  name: string | null;
  name_confirmed: number;
  title: string | null;
  email: string | null;
  email_source_url: string | null;
  phone: string | null;
  contact_form_url: string | null;
  linkedin_url: string | null;
  source_url: string | null;
  source_quote: string | null;
}

export interface EvidenceRow {
  kind: string;
  url: string | null;
  viewport: string | null;
  excerpt: string | null;
  path: string | null;
  captured_at_utc: string;
  captured_at_nz: string;
}

export interface FindingView {
  id: number;
  checkId: string;
  checkTitle: string;
  title: string;
  tier: string;
  severity: number;
  status: string;
  reproduced: boolean;
  score: number;
  pageUrl: string | null;
  viewport: string | null;
  top3: boolean;
  lastVerifiedAt: string | null;
  detail: Record<string, unknown>;
  evidence: EvidenceRow[];
  impact: ImpactEntry;
}

export interface BusinessView {
  business: Business;
  owner: ContactRow | null;
  second: ContactRow | null;
  general: ContactRow | null;
  contacts: ContactRow[];
  email: string | null;
  emailSource: string | null;
  phone: string | null;
  formOnly: boolean;
  bookingSystems: string[];
  bookingPlatforms: string[];
  platform: string | null;
  findings: FindingView[];
  reproducedCount: number;
  /** The three to show: approved ones when there are any, otherwise the best candidates. */
  top: FindingView[];
  topAreApproved: boolean;
  ai: AiSummary | null;
  brand: { logo_path: string | null; logo_source_url: string | null; colors: string; fonts: string; hero_images: string; hero_path: string | null; voice_samples: string; captured_at: string } | null;
  outreachScore: number;
  runA: string | null;
  runB: string | null;
  site: SiteData | null;
  notes: string[];
}

export function outreachScore(top: { score: number }[], ownerConfirmed: boolean, secondNamed: boolean, rating: number | null, reviews: number | null, formOnly: boolean): number {
  const o = config.outreach;
  let s = top.slice(0, 3).reduce((sum, f) => sum + f.score, 0);
  if (ownerConfirmed) s += o.ownerConfirmed;
  if (secondNamed) s += o.secondNamed;
  if (rating !== null && reviews !== null && rating >= o.strongGoogleMinRating && reviews >= o.strongGoogleMinReviews) s += o.strongGoogle;
  if (formOnly) s += o.formOnlyPenalty;
  return Math.round(s * 100) / 100;
}

export function businessView(db: Db, b: Business, batch: string, library: Map<string, ImpactEntry> = loadLibrary(CHECK_IDS)): BusinessView {
  const contacts = db.prepare("SELECT * FROM contacts WHERE business_id = ? ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'second' THEN 1 ELSE 2 END, name_confirmed DESC, (source_quote LIKE 'input research:%') DESC, id").all(b.id) as ContactRow[];
  const owner = contacts.find((c) => c.role === 'owner' && c.name) ?? null;
  const second = contacts.find((c) => c.role === 'second' && c.name && c.name !== owner?.name) ?? null;
  const withEmail = contacts.find((c) => c.email) ?? null;
  const general = withEmail ?? contacts.find((c) => c.role === 'general') ?? null;
  const email = withEmail?.email ?? null;
  const form = contacts.find((c) => c.contact_form_url)?.contact_form_url ?? null;

  const rows = db.prepare("SELECT * FROM findings WHERE business_id = ? AND batch = ? AND status != 'rejected' ORDER BY score DESC, severity DESC, id").all(b.id, batch) as (Record<string, unknown> & { id: number; check_id: string; status: string; score: number })[];
  const findings: FindingView[] = rows
    .filter((r) => library.has(r.check_id))
    .map((r) => ({
      id: r.id,
      checkId: r.check_id,
      checkTitle: CHECKS.find((c) => c.id === r.check_id)?.title ?? r.check_id,
      title: String(r.title),
      tier: String(r.tier),
      severity: Number(r.severity),
      status: r.status,
      reproduced: !!r.reproduced,
      score: r.score,
      pageUrl: (r.page_url as string) ?? null,
      viewport: (r.viewport as string) ?? null,
      top3: !!r.top3,
      lastVerifiedAt: (r.last_verified_at as string) ?? null,
      detail: JSON.parse(String(r.detail)) as Record<string, unknown>,
      evidence: db.prepare('SELECT kind, url, viewport, excerpt, path, captured_at_utc, captured_at_nz FROM evidence WHERE finding_id = ? ORDER BY id').all(r.id) as EvidenceRow[],
      impact: library.get(r.check_id)!,
    }));

  const approved = findings.filter((f) => f.status === 'approved');
  const proven = findings.filter((f) => f.status === 'reproduced' || f.status === 'approved');
  const top = (approved.length ? approved : proven).slice(0, 3);
  const run = (kind: string) => db.prepare("SELECT id, finished_at FROM runs WHERE business_id = ? AND batch = ? AND kind = ? AND status IN ('done', 'blocked') ORDER BY id DESC LIMIT 1").get(b.id, batch, kind) as { id: number; finished_at: string } | undefined;
  const a = run('A');
  const bRun = run('B');
  const site = (bRun && loadSite(bRun.id)) || (a && loadSite(a.id)) || null;
  const systems = [...new Set((site?.booking ?? []).filter((x) => x.kind === 'system').map((x) => x.system))];
  const platforms = new Set((site?.booking ?? []).filter((x) => x.kind === 'platform' && x.system !== 'Tripadvisor').map((x) => x.system));
  for (const l of (a && loadSite(a.id)?.listings) || []) if (l.kind === 'booking_platform' && l.status !== 'error') platforms.add(l.platform);
  const ai = aiSummary(db, b, batch);
  const formOnly = !email && !!form;
  const notes: string[] = [];
  if (site?.blocked) notes.push(site.blocked === 'robots_blocks_homepage' ? 'robots.txt blocks the homepage; not audited' : 'homepage could not be loaded');
  if (!bRun && a) notes.push('run B not done yet; findings are unconfirmed candidates');
  if (owner && !owner.name_confirmed) notes.push('owner name not confirmed; first name only');
  if (formOnly) notes.push('no published email; contact form only');
  if (b.notes) notes.push(b.notes);

  return {
    business: b,
    owner,
    second,
    general,
    contacts,
    email,
    emailSource: withEmail?.email_source_url ?? null,
    phone: contacts.find((c) => c.phone)?.phone ?? b.phone ?? null,
    formOnly,
    bookingSystems: systems,
    bookingPlatforms: [...platforms],
    platform: site ? (sitePlatform(site.technologies)?.name ?? null) : null,
    findings,
    reproducedCount: proven.length,
    top,
    topAreApproved: approved.length > 0,
    ai,
    brand: (db.prepare('SELECT * FROM brand_packs WHERE business_id = ?').get(b.id) as BusinessView['brand']) ?? null,
    outreachScore: outreachScore(top, !!owner?.name_confirmed, !!second, b.google_rating, b.google_review_count, formOnly),
    runA: a?.finished_at ?? null,
    runB: bRun?.finished_at ?? null,
    site,
    notes,
  };
}

export function ownerDisplay(v: BusinessView): string {
  return v.owner ? usableName(v.owner.name, v.owner.name_confirmed) : '';
}

export function secondDisplay(v: BusinessView): string {
  return v.second ? usableName(v.second.name, v.second.name_confirmed) : '';
}

export function masterRow(v: BusinessView): Record<string, unknown> {
  const b = v.business;
  const row: Record<string, unknown> = {
    slug: b.slug,
    name: b.name,
    town: b.town ?? '',
    region: b.region ?? '',
    activity: b.activity ?? '',
    website: b.website ?? '',
    owner_name: ownerDisplay(v),
    owner_confirmed: v.owner ? (v.owner.name_confirmed ? 'yes' : 'no') : '',
    owner_source: v.owner?.source_url ?? '',
    second_name: secondDisplay(v),
    second_role: v.second?.title ?? '',
    second_source: v.second?.source_url ?? '',
    email: v.email ?? '',
    email_source_url: v.emailSource ?? '',
    phone: v.phone ?? '',
    booking_system: v.bookingSystems.join('; '),
    booking_platforms: v.bookingPlatforms.join('; '),
    google_rating: b.google_rating ?? '',
    google_review_count: b.google_review_count ?? '',
    reproduced_findings: v.reproducedCount,
  };
  for (let i = 0; i < 3; i++) {
    const f = v.top[i];
    row[`top${i + 1}_check`] = f?.checkId ?? '';
    row[`top${i + 1}_title`] = f?.checkTitle ?? '';
    row[`top${i + 1}_status`] = f ? (f.status === 'approved' ? 'approved' : 'candidate') : '';
  }
  row.ai_named = v.ai ? `${v.ai.namedIn} of ${v.ai.questions}` : '';
  row.brand_pack = v.brand ? 'yes' : 'no';
  row.outreach_score = v.outreachScore;
  row.notes = v.notes.join(' | ');
  return row;
}

export const MASTER_COLUMNS = [
  'slug', 'name', 'town', 'region', 'activity', 'website',
  'owner_name', 'owner_confirmed', 'owner_source', 'second_name', 'second_role', 'second_source', 'email', 'email_source_url', 'phone',
  'booking_system', 'booking_platforms', 'google_rating', 'google_review_count',
  'reproduced_findings', 'top1_check', 'top1_title', 'top1_status', 'top2_check', 'top2_title', 'top2_status', 'top3_check', 'top3_title', 'top3_status',
  'ai_named', 'brand_pack', 'outreach_score', 'notes',
];

export function stamp(): string {
  return nzTime();
}
