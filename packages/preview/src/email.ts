import { BANNED_WORDS } from '@plumbline/impact';
import { numbersIn } from './copy.ts';

/**
 * An email draft is a text file. Above a line of three dashes it says where it stands and which
 * findings its numbered lines use, each in the sentence it was written from. Below that line is the
 * email itself: To, Subject, a blank line, then the body.
 */
export interface Draft {
  /** The first word or words of the status: ready, HOLD or needs edit. */
  status: string;
  statusLine: string;
  batch: string | null;
  findings: { line: number; id: number; sentence: string }[];
  to: string;
  subject: string;
  body: string;
}

export function parseDraft(text: string): Draft {
  const [head = '', ...rest] = text.split(/^---\s*$/m);
  const mail = rest.join('---').replace(/^\s*\n/, '');
  const field = (name: string, from: string) => new RegExp(`^${name}:[ \\t]*(.*)$`, 'm').exec(from)?.[1]?.trim() ?? '';
  const statusLine = field('Status', head);
  const findings = [...head.matchAll(/^(\d+)\.\s+#(\d+)\s+\|\s+(.*)$/gm)].map((m) => ({ line: Number(m[1]), id: Number(m[2]), sentence: m[3]!.trim() }));
  const body = mail.replace(/^To:.*\n/m, '').replace(/^Subject:.*\n/m, '').replace(/^\s*\n/, '');
  return { status: /^needs edit/i.test(statusLine) ? 'needs edit' : /^hold/i.test(statusLine) ? 'HOLD' : statusLine.split(/[,:(]/)[0]!.trim(), statusLine, batch: field('Batch', head) || null, findings, to: field('To', mail), subject: field('Subject', mail), body };
}

export function withStatus(text: string, status: string): string {
  return /^Status:.*$/m.test(text) ? text.replace(/^Status:.*$/m, `Status: ${status}`) : `Status: ${status}\n${text}`;
}

export interface FindingNow {
  status: string;
  /** The finding as it would be put to the owner today. */
  sentence: string;
  verifiedAt: string | null;
}

const DAY = 24 * 3_600_000;

/**
 * Where a draft stands once its findings have been checked again. Any numbered line whose finding
 * no longer reproduces, reads differently now, or was not checked in the last 24 hours is named. A
 * draft held as weak stays held.
 */
export function draftAfterRecheck(draft: Draft, now: Map<number, FindingNow>, at: Date): { status: 'ready' | 'needs edit' | 'HOLD'; notes: string[] } {
  const notes: string[] = [];
  for (const f of draft.findings) {
    const current = now.get(f.id);
    if (!current) notes.push(`line ${f.line}: finding #${f.id} is not on file`);
    else if (current.status !== 'approved') notes.push(`line ${f.line}: finding #${f.id} no longer reproduces`);
    else if (!current.verifiedAt || at.getTime() - new Date(current.verifiedAt).getTime() > DAY) notes.push(`line ${f.line}: finding #${f.id} was last checked more than 24 hours ago`);
    else if (current.sentence !== f.sentence) notes.push(`line ${f.line}: finding #${f.id} now reads "${current.sentence}"`);
  }
  if (draft.status === 'HOLD') return { status: 'HOLD', notes };
  return { status: notes.length ? 'needs edit' : 'ready', notes };
}

/**
 * Some of every email is the same: the line that introduces us, the lines around the demo link,
 * and the offer, call to action, signature and footer. A draft marks where each goes, as
 * [[INTRO]], [[DEMO LINES: <link>]] and [[CLOSING]], and the wording is kept once, in a sheet of
 * blocks headed "## INTRO", "## DEMO LINES" (with {link} where the link goes) and "## CLOSING".
 */
export const FIXED_BLOCKS = ['INTRO', 'DEMO LINES', 'CLOSING'] as const;
const MARK = /\[\[(INTRO|DEMO LINES|CLOSING)(?::\s*([^\]]+))?\]\]/g;

export function fixedBlocks(sheet: string): Record<string, string> {
  const out: Record<string, string> = {};
  const parts = sheet.split(/^##\s+/m).slice(1);
  for (const part of parts) {
    const [name = '', ...rest] = part.split('\n');
    const body = rest.join('\n').trim();
    // A block still holding the note it was handed over with has not been filled in.
    if (body && !/^\(.*\)$/s.test(body) && (FIXED_BLOCKS as readonly string[]).includes(name.trim())) out[name.trim()] = body;
  }
  return out;
}

export function fillDraft(text: string, blocks: Record<string, string>): string {
  return text.replace(MARK, (whole, name: string, link: string | undefined) => {
    const block = blocks[name];
    if (block === undefined) return whole;
    return link ? block.replace('{link}', link.trim()) : block;
  });
}

export interface EmailIssue {
  kind: 'length' | 'dash' | 'hyphen' | 'exclamation' | 'banned' | 'subject' | 'number' | 'link' | 'fixed';
  text: string;
}

const HYPE = ['amazing', 'incredible', 'stunning', 'game-changing', 'game changer', 'revolutionary', 'skyrocket', 'supercharge', 'guaranteed', 'best-in-class', 'next level', 'seamless', 'effortless'];
export const EMAIL_WORDS = { min: 120, max: 170 };

/**
 * The writing rules for an email, checked. The body runs 120 to 170 words. No dash, and no hyphen
 * inside a sentence. No exclamation mark and no hype. The subject is under 60 characters and asks
 * nothing. The demo link stands on a line of its own without a trailing slash. And every number in
 * the body is one we hold a source for.
 */
export function scanEmail(draft: Draft, known: Set<string>): EmailIssue[] {
  const out: EmailIssue[] = [];
  const waiting = [...draft.body.matchAll(MARK)].map((m) => m[1]!);
  if (waiting.length) out.push({ kind: 'fixed', text: `the shared wording is not filled in yet: ${[...new Set(waiting)].join(', ')}` });
  // A mark stands for wording that is not judged here, and the link inside one is laid out by the fill.
  const lines = draft.body.replace(MARK, '').split('\n');
  const links = waiting.includes('DEMO LINES') ? ['https://held.example/in-the-mark'] : lines.filter((l) => /https?:\/\//.test(l));
  for (const l of links) if (!/^https:\/\/\S+[^/\s]$/.test(l.trim())) out.push({ kind: 'link', text: l.trim() });
  if (!links.length) out.push({ kind: 'link', text: 'no demo link' });
  // What is read as copy: the body without the link lines and without the numbers that only order the list.
  const copy = lines.filter((l) => !/https?:\/\//.test(l)).map((l) => l.replace(/^\s*\d+\.\s+/, '')).join('\n');
  const words = copy.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
  if (!waiting.length && (words < EMAIL_WORDS.min || words > EMAIL_WORDS.max)) out.push({ kind: 'length', text: `${words} words; ${EMAIL_WORDS.min} to ${EMAIL_WORDS.max} are wanted` });
  const everything = `${draft.subject}\n${copy}`;
  for (const m of everything.matchAll(/[‐‒–—―−]|(?<=\s)-(?=\s)/g)) out.push({ kind: 'dash', text: everything.slice(Math.max(0, m.index - 30), m.index + 30).replace(/\s+/g, ' ') });
  for (const m of everything.matchAll(/\b[\p{L}\d]+-[\p{L}\d]+\b/gu)) out.push({ kind: 'hyphen', text: m[0] });
  if (everything.includes('!')) out.push({ kind: 'exclamation', text: '!' });
  for (const banned of [...BANNED_WORDS, ...HYPE]) if (new RegExp(`\\b${banned.replace(/[- ]/g, '[- ]?')}`, 'i').test(everything)) out.push({ kind: 'banned', text: banned });
  if (draft.subject.length >= 60) out.push({ kind: 'subject', text: `${draft.subject.length} characters; under 60 are wanted` });
  if (draft.subject.includes('?')) out.push({ kind: 'subject', text: 'a question mark' });
  if (!draft.subject) out.push({ kind: 'subject', text: 'no subject' });
  for (const n of numbersIn(copy)) if (!known.has(n.token)) out.push({ kind: 'number', text: n.token });
  return out;
}
