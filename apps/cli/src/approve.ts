import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { paths, type Db } from '@plumbline/core';
import { allPages, loadSite } from '@plumbline/collect';
import type { PageCapture } from '@plumbline/render';
import {
  bookingRoutesOn,
  contactRoutesOn,
  decideFindings,
  factsFor,
  findingsToDecide,
  isSuppressed,
  isWeak,
  needsThirdSpeedRun,
  opensBehindAgeGate,
  ownPages,
  readSuppression,
  savedHtml,
  savedPages,
  speedRuns,
  statedSentence,
  storeDecisions,
  type ApprovalContext,
  type Decision,
  type Verdicts,
  type WaveMember,
} from '@plumbline/wave';
import { toCsv } from './csv.ts';

/** What the rules may test a business's findings against: its own pages, its stored facts and its speed runs. */
export function contextFor(d: Db, b: WaveMember, batch: string, flagged: Map<number, string>, now: Date): ApprovalContext {
  const runs = d.prepare("SELECT id FROM runs WHERE business_id = ? AND batch = ? AND status = 'done' ORDER BY id").all(b.id, batch) as { id: number }[];
  const site = runs.length ? loadSite(runs[runs.length - 1]!.id) : null;
  const pages = ownPages([...savedPages(b.slug), ...(site ? allPages(site) : [])], b.website);
  const homes = site ? [site.homepage.mobile, site.homepage.desktop].filter((p): p is PageCapture => !!p && p.ok) : [];
  const facts = factsFor(d, b.id);
  const booking = facts.find((f) => f.topic === 'booking')?.value as { system: string | null; link: string | null } | undefined;
  const agencies = facts.filter((f) => f.topic === 'agency').flatMap((f) => (f.label === 'summary' ? [String((f.value as { name: string | null }).name ?? '')] : [f.label]));
  return {
    slug: b.slug,
    now,
    bookingRoutes: [...(booking?.system ? [`${booking.system}${booking.link ? ` at ${booking.link}` : ''} (read from their own pages)`] : []), ...bookingRoutesOn(pages, savedHtml)],
    contactRoutes: contactRoutesOn(homes, savedHtml),
    agencyNames: [...new Set(agencies.flatMap((n) => n.split(/ and |,|\(/).map((x) => x.trim())).filter((n) => n.length >= 4))],
    ageGate: opensBehindAgeGate(homes),
    speedRuns: speedRuns(d, b.id, batch).slice(-3),
    flagged,
  };
}

/** The suppression list, read afresh each time it is needed. No file means nobody is suppressed. */
export function suppressionList(file: string = join(paths.data, 'suppression.csv')): { list: Set<string>; file: string; found: boolean } {
  const found = existsSync(file);
  return { list: found ? readSuppression(readFileSync(file, 'utf8')) : new Set(), file, found };
}

/**
 * Why a business must not be built for or written to, or null when nothing stands in the way: it
 * is on the suppression list by its slug or by any address we hold for it, it was excluded, or its
 * own site refuses unsolicited messages.
 */
export function businessSuppressed(d: Db, b: { id: number; slug: string }, list: Set<string>): string | null {
  const emails = (d.prepare('SELECT email FROM contacts WHERE business_id = ? AND email IS NOT NULL').all(b.id) as { email: string }[]).map((e) => e.email);
  const published = factsFor(d, b.id, 'email')[0]?.label;
  if (isSuppressed(list, b.slug, published ? [...emails, published] : emails)) return 'on the suppression list';
  const status = (d.prepare('SELECT status FROM businesses WHERE id = ?').get(b.id) as { status: string } | undefined)?.status;
  if (status === 'excluded') return 'excluded';
  const consent = d.prepare('SELECT quote FROM consent_checks WHERE business_id = ? AND no_unsolicited_statement_found = 1').get(b.id) as { quote: string | null } | undefined;
  if (consent) return `their site refuses unsolicited messages: "${consent.quote ?? ''}"`;
  return null;
}

/** A reviewer's verdict as it is kept: with the sentence it was given on, and whether a flag is about the wording alone. */
export type StoredVerdicts = Record<string, { verdict: 'ok' | 'flag'; reason: string; sentence?: string; scope?: 'finding' | 'sentence'; note?: string }>;

/**
 * Whether a kept verdict still speaks for a finding. A pass holds only for the sentence that was
 * passed. A flag against the finding itself holds however it is reworded, and a flag against the
 * wording alone lapses once the wording has changed.
 */
export function verdictStands(v: StoredVerdicts[string], sentence: string): boolean {
  if (v.sentence === undefined || v.sentence === sentence) return true;
  return v.verdict === 'flag' && v.scope !== 'sentence';
}

export interface ApproveResult {
  decisions: (Decision & { reviewer: string })[];
  weak: string[];
  needSpeedRun: string[];
  suppressed: string[];
  toReview: number;
  stored: { approved: number; rejected: number; waiting: number } | null;
  csv: string;
  packet: string;
}

/**
 * Decides every finding of every business in a wave by rule, writes the decisions out, and lists
 * the approved ones the independent check has not seen yet. With `apply` the decisions are stored.
 */
export function approveWave(d: Db, wave: string, members: WaveMember[], batch: string, opts: { apply?: boolean; now?: Date } = {}): ApproveResult {
  const now = opts.now ?? new Date();
  const dir = join(paths.data, 'wave');
  mkdirSync(dir, { recursive: true });
  const verdictFile = join(dir, `${wave}-review-verdicts.json`);
  const verdicts: StoredVerdicts = existsSync(verdictFile) ? (JSON.parse(readFileSync(verdictFile, 'utf8')) as StoredVerdicts) : {};
  const { list } = suppressionList();
  const out: ApproveResult = { decisions: [], weak: [], needSpeedRun: [], suppressed: [], toReview: 0, stored: opts.apply ? { approved: 0, rejected: 0, waiting: 0 } : null, csv: join(dir, `${wave}-approvals.csv`), packet: join(dir, `${wave}-review-packet.json`) };
  const packet: unknown[] = [];

  for (const b of members) {
    if (businessSuppressed(d, b, list) !== null) {
      out.suppressed.push(b.slug);
      continue;
    }
    const { findings, byPerson } = findingsToDecide(d, b.id, batch);
    const ctx = contextFor(d, b, batch, new Map(), now);
    // A verdict speaks of a finding in the words it was shown in. Said differently, the finding is looked at again.
    const standing: Verdicts = {};
    for (const f of findings) {
      const v = verdicts[String(f.id)];
      if (v && verdictStands(v, statedSentence(f, ctx.speedRuns))) standing[String(f.id)] = v;
    }
    ctx.flagged = new Map(Object.entries(standing).filter(([, v]) => v.verdict === 'flag').map(([id, v]) => [Number(id), v.reason]));
    if (findings.some((f) => f.checkId === 'C20_slow_mobile') && needsThirdSpeedRun(ctx.speedRuns)) out.needSpeedRun.push(b.slug);
    const made = decideFindings(findings, ctx, { always: (f) => f.checkId === 'C37_not_named_by_ai' });
    for (const p of byPerson) out.decisions.push({ findingId: p.findingId, slug: b.slug, checkId: p.checkId, title: p.title, sentence: p.title, decision: 'reject', rule: 'UD decision', tier: 'other', reason: p.note, reviewer: '' });
    for (const m of made) {
      const v = standing[String(m.findingId)];
      out.decisions.push({ ...m, reviewer: v ? `${v.verdict}${v.reason ? `: ${v.reason}` : ''}` : m.decision === 'approve' ? 'not yet checked' : '' });
      if (m.decision !== 'approve' || v) continue;
      const f = findings.find((x) => x.id === m.findingId)!;
      packet.push({ findingId: f.id, slug: b.slug, business: b.name, website: b.website, check: f.checkId, source: f.source, sentence: m.sentence, tier: m.tier, measured: f.detail, evidence: f.evidence, knownWaysToBook: ctx.bookingRoutes, knownWaysToGetInTouch: ctx.contactRoutes, homepageOpensBehindAgeGate: ctx.ageGate, speedRuns: ctx.speedRuns });
    }
    if (isWeak(made)) out.weak.push(b.slug);
    if (out.stored) {
      const s = storeDecisions(d, made, standing);
      out.stored = { approved: out.stored.approved + s.approved, rejected: out.stored.rejected + s.rejected, waiting: out.stored.waiting + s.waiting };
    }
  }

  out.toReview = packet.length;
  const columns = ['finding_id', 'slug', 'decision', 'rule', 'tier', 'check', 'finding', 'reason', 'independent_check'];
  writeFileSync(out.csv, toCsv(out.decisions.map((x) => ({ finding_id: x.findingId, slug: x.slug, decision: x.decision, rule: x.rule, tier: x.tier, check: x.checkId, finding: x.sentence, reason: x.reason, independent_check: x.reviewer })), columns));
  writeFileSync(out.packet, JSON.stringify(packet, null, 2));
  return out;
}
