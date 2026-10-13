import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { nzTime, type Db } from '@plumbline/core';
import { CHECKS } from '@plumbline/checks/ids';
import { factsFor, type Fact } from './facts.ts';
import { waveMembers, type WaveMember } from './list.ts';
import { CRAWLMOUSE_TITLES, rankFindings, type OwnerGroup } from './rank.ts';

/** Everything held about one business of a wave that a person needs before writing to its owner. */
export interface PackBusiness {
  position: number;
  slug: string;
  name: string;
  website: string | null;
  town: string | null;
  region: string | null;
  activities: string[];
  trading: { status: string; flags: { kind: string; quote: string; url: string | null }[]; checkedOn: string | null; note: string | null };
  people: { status: string; addressAs: string | null; note: string | null; owners: { name: string; firstNameUsed: string | null; role: string; confirmed: boolean; sources: { url: string; quote: string; checkedOn: string }[] }[]; linkedin: string | null; linkedinNotes: string | null };
  email: { address: string; published: boolean; sourceUrl: string | null; checkedOn: string; note: string | null } | null;
  google: { rating: number; reviews: number; measuredOn: string | null } | null;
  booking: { system: string | null; link: string | null; sourceUrl: string | null; note: string | null } | null;
  prices: { item: string; text: string; sourceUrl: string | null; conflict: boolean }[];
  priceConflicts: { item: string; values: { text: string; sourceUrl: string | null }[] }[];
  findings: { id: number; source: 'Plumbline' | 'Crawlmouse'; check: string; sentence: string; measured: string; group: OwnerGroup; evidence: string[]; verifiedOn: string | null }[];
  strengths: { ai: { question: string; answers: number; namedIn: number; strength: boolean; askedOn: string }[]; other: { kind: string; text: string; sourceUrl: string | null }[] };
  assets: {
    photos: { url: string; width: number; height: number; kind: string; file: string | null; pageUrl: string | null; hero: number | null }[];
    videos: { url: string; kind: string; how: string; title: string | null; seconds: number | null; quality: string | null; note: string | null; pageUrl: string | null }[];
    logo: { file: string | null; from: string | null } | null;
    colours: { role: string; hex: string }[];
    fonts: { headings: string | null; body: string | null } | null;
    voice: { quote: string; url: string | null }[];
  };
  agency: { name: string | null; signs: { agency: string; kind: string; quote: string | null; url: string | null }[]; note: string | null };
  unknowns: string[];
}

export interface PackExtras {
  linkedin?: string | null;
  linkedinNotes?: string | null;
  /** The day the stored Google ratings were measured. */
  googleMeasuredOn?: string | null;
}

const day = (iso: string | null | undefined) => (iso ? nzTime(iso).slice(0, 10) : 'date not recorded');
const one = <T>(facts: Fact[], topic: string, label?: string) => facts.find((f) => f.topic === topic && (label === undefined || f.label === label))?.value as T | undefined;

/** Gathers one business's pack from its stored facts and its approved findings, ranked for the owner. */
export function packBusiness(db: Db, b: WaveMember, batch: string, extras: PackExtras = {}): PackBusiness {
  const facts = factsFor(db, b.id);
  const of = (topic: string) => facts.filter((f) => f.topic === topic);
  const tradingFact = facts.find((f) => f.topic === 'trading' && f.label === 'status');
  const trading = tradingFact?.value as { status: string; note: string | null } | undefined;
  const people = one<{ status: string; addressAs: string | null; note: string | null }>(facts, 'people');
  const owners = new Map<string, PackBusiness['people']['owners'][number]>();
  for (const f of of('owner')) {
    const v = f.value as { firstNameUsed: string | null; role: string; confirmed: boolean };
    const o = owners.get(f.label) ?? { name: f.label, firstNameUsed: v.firstNameUsed, role: v.role, confirmed: v.confirmed, sources: [] };
    if (f.sourceUrl) o.sources.push({ url: f.sourceUrl, quote: f.quote ?? '', checkedOn: f.checkedOn });
    owners.set(f.label, o);
  }
  const emailFact = of('email')[0];
  const email = emailFact?.value as { address: string; published: boolean; note: string | null } | undefined;
  const bookingFact = of('booking')[0];
  const booking = bookingFact?.value as { system: string | null; link: string | null; note: string | null } | undefined;
  const conflicts = new Map<string, { text: string; sourceUrl: string | null }[]>();
  for (const f of of('price_conflict')) conflicts.set(f.label, [...(conflicts.get(f.label) ?? []), { text: String(f.value), sourceUrl: f.sourceUrl }]);

  const rows = db.prepare("SELECT id, check_id, source, status, severity, score, title, detail, last_verified_at FROM findings WHERE business_id = ? AND batch = ? AND status = 'approved'").all(b.id, batch) as { id: number; check_id: string; source: string; status: string; severity: number; score: number; title: string; detail: string; last_verified_at: string | null }[];
  const evidence = db.prepare('SELECT path FROM evidence WHERE finding_id = ? AND path IS NOT NULL ORDER BY id');
  const findings = rankFindings(rows)
    .filter((r) => r.repeatOf === null)
    .map((r) => {
      const f = r.finding;
      const crawlmouse = f.source === 'crawlmouse';
      const title = CHECKS.find((c) => c.id === f.check_id)?.title ?? CRAWLMOUSE_TITLES[f.check_id] ?? f.check_id;
      return {
        id: f.id,
        source: crawlmouse ? ('Crawlmouse' as const) : ('Plumbline' as const),
        check: f.check_id,
        // Plumbline's sentence is the name of its check. Crawlmouse's is the sentence it wrote.
        sentence: crawlmouse ? f.title : title,
        measured: crawlmouse ? ((JSON.parse(f.detail || '{}') as { measured?: string }).measured ?? '') : f.title,
        group: r.group,
        evidence: (evidence.all(f.id) as { path: string }[]).map((e) => e.path),
        verifiedOn: f.last_verified_at,
      };
    });

  const photos = of('photo').map((f) => {
    const v = f.value as { width: number; height: number; kind: string; file: string | null };
    return { url: f.label, width: v.width, height: v.height, kind: v.kind, file: v.file, pageUrl: f.sourceUrl, hero: f.flag?.startsWith('hero ') ? Number(f.flag.slice(5)) : null };
  });
  const fonts = one<{ headings: string | null; body: string | null }>(facts, 'font');
  const agency = one<{ name: string | null; note: string | null }>(facts, 'agency', 'summary');
  return {
    position: b.position,
    slug: b.slug,
    name: b.name,
    website: b.website,
    town: b.town,
    region: b.region,
    activities: of('activity').map((f) => String(f.value)),
    trading: { status: trading?.status ?? 'not checked', flags: of('trading').filter((f) => f.label !== 'status').map((f) => ({ kind: f.label, quote: f.quote ?? '', url: f.sourceUrl })), checkedOn: tradingFact?.checkedOn ?? null, note: trading?.note ?? null },
    people: { status: people?.status ?? 'not checked', addressAs: people?.addressAs ?? null, note: people?.note ?? null, owners: [...owners.values()], linkedin: extras.linkedin || null, linkedinNotes: extras.linkedinNotes || null },
    email: email && emailFact ? { address: email.address, published: email.published, sourceUrl: emailFact.sourceUrl, checkedOn: emailFact.checkedOn, note: email.note } : null,
    google: b.google_rating && b.google_review_count ? { rating: b.google_rating, reviews: b.google_review_count, measuredOn: extras.googleMeasuredOn ?? null } : null,
    booking: booking && bookingFact ? { system: booking.system, link: booking.link, sourceUrl: bookingFact.sourceUrl, note: booking.note } : null,
    prices: of('price').map((f) => ({ item: f.label, text: (f.value as { text: string }).text, sourceUrl: f.sourceUrl, conflict: f.flag === 'conflict' })),
    priceConflicts: [...conflicts.entries()].map(([item, values]) => ({ item, values })),
    findings,
    strengths: {
      ai: of('ai').map((f) => ({ question: f.label, ...(f.value as { answers: number; namedIn: number }), strength: f.flag === 'strength', askedOn: f.checkedOn })),
      other: of('strength').map((f) => ({ kind: f.label, text: String(f.value), sourceUrl: f.sourceUrl })),
    },
    assets: {
      photos,
      videos: of('video').map((f) => ({ url: f.label, ...(f.value as { kind: string; how: string; title: string | null; seconds: number | null; quality: string | null; note: string | null }), pageUrl: f.sourceUrl })),
      logo: one<{ file: string | null; from: string | null }>(facts, 'logo') ?? null,
      colours: of('colour').map((f) => ({ role: f.label, hex: (f.value as { hex: string }).hex })),
      fonts: fonts ? { headings: fonts.headings, body: fonts.body } : null,
      voice: of('voice').map((f) => ({ quote: String(f.value), url: f.sourceUrl })),
    },
    agency: { name: agency?.name ?? null, signs: of('agency').filter((f) => f.label !== 'summary').map((f) => ({ agency: f.label, kind: String(f.value), quote: f.quote, url: f.sourceUrl })), note: agency?.note ?? null },
    unknowns: of('unknown').map((f) => String(f.value)),
  };
}

/** The most lines one business may take in the pack. */
export const PACK_MAX_LINES = 70;
const short = (s: string, n = 240) => (s.length > n ? `${s.slice(0, n - 3).trim()}...` : s);
const length = (seconds: number | null) => (seconds === null ? 'length not read' : seconds >= 60 ? `${Math.floor(seconds / 60)} min ${seconds % 60} s` : `${seconds} s`);

/** One business's section of the pack: what to say, to whom, and what stands behind it. */
export function packLines(p: PackBusiness): string[] {
  const out: string[] = [`## ${p.position}. ${p.name}`];
  out.push(`- **Business:** ${p.name}, ${p.town ?? 'town not set'} (${p.region ?? 'region not set'}). Activity: ${p.activities.join(' and ') || 'none shown on the homepage'}. Website: ${p.website ?? 'none'}. Trading status: ${p.trading.status}${p.trading.note ? ` (${short(p.trading.note, 160)})` : ''}.`);
  for (const f of p.trading.flags.slice(0, 3)) out.push(`  - Flag, ${f.kind}: "${short(f.quote, 200)}" (${f.url}, checked ${day(p.trading.checkedOn)})`);
  out.push(`- **People:** ${p.people.addressAs ? `address as ${p.people.addressAs}` : 'no name to address'}. Status: ${p.people.status}.${p.people.note ? ` ${short(p.people.note, 220)}` : ''}`);
  for (const o of p.people.owners.slice(0, 3)) out.push(`  - ${o.name}${o.firstNameUsed && o.firstNameUsed !== o.name ? ` (uses "${o.firstNameUsed}")` : ''}, ${o.role}: ${o.confirmed ? 'confirmed' : 'not confirmed'}. Sources: ${o.sources.map((s) => s.url).join(' ; ')}`);
  out.push(`  - LinkedIn: ${p.people.linkedin ?? 'not filled in'}${p.people.linkedinNotes ? ` (${short(p.people.linkedinNotes, 120)})` : ''}`);
  out.push(p.email ? `- **Email:** ${p.email.address}. ${p.email.published ? `Shown on ${p.email.sourceUrl}, checked ${day(p.email.checkedOn)}.` : 'NOT published any more: do not email it.'}${p.email.note ? ` ${short(p.email.note, 160)}` : ''}` : '- **Email:** not checked.');
  out.push(p.google ? `- **Google:** ${p.google.rating.toFixed(1)} from ${p.google.reviews} reviews, measured ${day(p.google.measuredOn)}.` : '- **Google:** no rating stored.');
  out.push(p.booking ? `- **Booking:** ${p.booking.system ?? 'no online booking'}${p.booking.link ? `, ${p.booking.link}` : ''}${p.booking.sourceUrl ? ` (read on ${p.booking.sourceUrl})` : ''}.${p.booking.note ? ` ${short(p.booking.note, 160)}` : ''}` : '- **Booking:** not checked.');
  for (const x of p.prices.slice(0, 6)) out.push(`  - Price, ${x.item}: ${x.text}${x.conflict ? ' (conflicts, see below)' : ''} (${x.sourceUrl})`);
  for (const c of p.priceConflicts.slice(0, 2)) out.push(`  - PRICE CONFLICT, ${c.item}: ${c.values.map((v) => `${v.text} on ${v.sourceUrl}`).join(' but ')}. We do not pick one.`);
  out.push(`- **Approved findings, ranked:**${p.findings.length ? '' : ' none approved.'}`);
  for (const [i, f] of p.findings.slice(0, 5).entries()) out.push(`  ${i + 1}. [#${f.id}, ${f.source}] ${f.sentence.replace(/\.$/, '')}. Measured: ${short(f.measured, 260)} Evidence: ${f.evidence[0] ?? 'the stored answers (no screenshot)'}. Verified ${day(f.verifiedOn)}.`);
  out.push('- **Strengths:**');
  for (const a of p.strengths.ai.slice(0, 2)) out.push(`  - AI check${a.strength ? ' (a strength)' : ''}: named in ${a.namedIn} of ${a.answers} answers to "${a.question}" (asked ${day(a.askedOn)})`);
  if (!p.strengths.ai.length) out.push('  - AI check: no question could be asked (the homepage shows no activity to ask about).');
  for (const s of p.strengths.other.slice(0, 4)) out.push(`  - ${s.kind}: ${short(s.text, 140)} (${s.sourceUrl})`);
  out.push('- **Assets:**');
  const heroes = p.assets.photos.filter((x) => x.hero !== null).sort((a, b) => a.hero! - b.hero!);
  for (const h of heroes) out.push(`  - Hero photo ${h.hero}: ${h.width}x${h.height} px, ${h.url}${h.file ? ` (kept at ${h.file})` : ''}`);
  if (!heroes.length) out.push(`  - Hero photo: none at least 1800 px wide that is crisp and not a logo, map or screenshot (${p.assets.photos.length} pictures measured).`);
  for (const v of p.assets.videos.slice(0, 3)) out.push(`  - Video (${v.kind}, ${v.how}): ${v.url}, ${length(v.seconds)}, ${v.quality ?? 'quality not read'}${v.title ? `, "${short(v.title, 60)}"` : ''}`);
  if (!p.assets.videos.length) out.push('  - Video: none of their own found.');
  out.push(`  - Logo: ${p.assets.logo?.file ?? p.assets.logo?.from ?? 'not found'}. Colours: ${p.assets.colours.slice(0, 5).map((c) => `${c.hex} ${c.role}`).join(', ') || 'not read'}. Fonts: ${p.assets.fonts ? `${p.assets.fonts.headings ?? '?'} (headings), ${p.assets.fonts.body ?? '?'} (body)` : 'not read'}.`);
  for (const v of p.assets.voice.slice(0, 5)) out.push(`  - Voice: "${short(v.quote, 200)}" (${v.url})`);
  out.push('- **Risks and unknowns:**');
  const risks = [
    ...(p.agency.name ? [`Agency: ${p.agency.name} appears to look after the site${p.agency.signs[0]?.quote ? ` ("${short(p.agency.signs[0].quote, 100)}")` : ''}. Never criticise it.`] : []),
    ...(p.people.status !== 'confirmed' ? [`Owner ${p.people.status === 'owner unknown' ? 'unknown' : 'not confirmed by a second source'}.`] : []),
    ...(p.email && !p.email.published ? ['The email address is no longer published. We do not email it.'] : []),
    ...(p.priceConflicts.length ? [`${p.priceConflicts.length} price conflict(s) between their own pages.`] : []),
    ...p.unknowns,
  ];
  for (const r of risks.slice(0, 8)) out.push(`  - ${short(r, 260)}`);
  if (!risks.length) out.push('  - None found.');
  return out.slice(0, PACK_MAX_LINES);
}

/** Writes the pack for a wave: one section for each business in list order, and the same data as a file for each. */
export function writePack(db: Db, wave: string, batch: string, reportDir: string, extras: (slug: string) => PackExtras = () => ({})): { file: string; businesses: PackBusiness[] } {
  const businesses = waveMembers(db, wave).map((b) => packBusiness(db, b, batch, extras(b.slug)));
  const dir = join(reportDir, wave);
  mkdirSync(dir, { recursive: true });
  for (const p of businesses) writeFileSync(join(dir, `${p.slug}.json`), JSON.stringify(p, null, 2));
  const title = wave.replace(/[-_]+/g, ' ').toUpperCase();
  const file = join(reportDir, `${wave.toUpperCase()}-PACK.md`);
  writeFileSync(file, [`# ${title} PACK`, '', `Written ${nzTime(new Date())}. One section for each business, in list order. Every fact carries the page it was read on. Findings are those approved in the review app, ranked for the owner.`, '', ...businesses.flatMap((p) => [...packLines(p), ''])].join('\n'));
  return { file, businesses };
}
