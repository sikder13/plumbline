import { BANNED_WORDS } from '@plumbline/impact';
import { sameSpeed, speedIn } from '@plumbline/wave';
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
  /** Lines under "Findings used" that do not read as a finding. */
  unread: string[];
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
  const unread = (head.split(/^Findings used:.*$/m)[1] ?? '').split('\n').map((l) => l.trim()).filter((l) => l && !/^\d+\.\s+#\d+\s+\|\s+/.test(l));
  const body = mail.replace(/^To:.*\n/m, '').replace(/^Subject:.*\n/m, '').replace(/^\s*\n/, '');
  return { status: /^needs edit/i.test(statusLine) ? 'needs edit' : /^hold/i.test(statusLine) ? 'HOLD' : statusLine.split(/[,:(]/)[0]!.trim(), statusLine, batch: field('Batch', head) || null, findings, unread, to: field('To', mail), subject: field('Subject', mail), body };
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

/** How the recheck writes the status of a draft it wants edited, so that it can tell its own mark from a person's. */
export const RECHECK_EDIT = 'needs edit (recheck)';

/**
 * Where a draft stands once its findings have been checked again. Any numbered line whose finding
 * no longer reproduces, reads differently now, or was not checked in the last 24 hours is named,
 * and so is a list of findings that cannot be read. A speed line whose figures a new run has only
 * nudged still holds, and the new figures are set beside the status. A draft held as weak stays
 * held, and a status a person wrote (sent, or an edit they asked for) is kept as it is.
 */
export function draftAfterRecheck(draft: Draft, now: Map<number, FindingNow>, at: Date): { status: 'ready' | 'needs edit' | 'HOLD' | 'kept'; notes: string[]; asides: string[] } {
  const asides: string[] = [];
  const notes: string[] = draft.unread.map((l) => `"${l}" under "Findings used" could not be read`);
  if (!draft.findings.length && !draft.unread.length) notes.push('no finding is listed under "Findings used"');
  for (const f of draft.findings) {
    const current = now.get(f.id);
    if (!current) notes.push(`line ${f.line}: finding #${f.id} is not on file`);
    else if (current.status !== 'approved') notes.push(`line ${f.line}: finding #${f.id} no longer reproduces`);
    else if (!current.verifiedAt || at.getTime() - new Date(current.verifiedAt).getTime() > DAY) notes.push(`line ${f.line}: finding #${f.id} was last checked more than 24 hours ago`);
    else if (current.sentence !== f.sentence) {
      const speed = sameSpeed(f.sentence, current.sentence) ? speedIn(current.sentence) : null;
      if (speed) asides.push(`line ${f.line}: finding #${f.id} now measures ${speed.performance} out of 100 and ${(speed.lcpMs / 1000).toFixed(1)} s, which agrees with the draft`);
      else notes.push(`line ${f.line}: finding #${f.id} now reads "${current.sentence}"`);
    }
  }
  if (draft.status === 'HOLD') return { status: 'HOLD', notes, asides };
  const ours = draft.status === 'ready' || draft.statusLine.toLowerCase().startsWith(RECHECK_EDIT);
  if (!ours) return { status: 'kept', notes, asides };
  return { status: notes.length ? 'needs edit' : 'ready', notes, asides };
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
  kind: 'length' | 'dash' | 'hyphen' | 'exclamation' | 'banned' | 'subject' | 'number' | 'link' | 'fixed' | 'findings';
  text: string;
}

const HYPE = ['amazing', 'incredible', 'stunning', 'game-changing', 'game changer', 'revolutionary', 'skyrocket', 'supercharge', 'guaranteed', 'best-in-class', 'next level', 'seamless', 'effortless'];
export const EMAIL_WORDS = { min: 120, max: 170 };

/**
 * The writing rules for an email, checked. The body runs 120 to 170 words. No dash, and no hyphen
 * inside a sentence. No exclamation mark and no hype. The subject is under 60 characters and asks
 * nothing. The demo link stands on a line of its own without a trailing slash, and when the
 * business's own page is given, that is the link it must be: any other address has to be one the
 * shared wording holds. Every number in the subject and the body is one we hold a source for. And
 * the email numbers as many lines as the draft lists findings.
 */
export function scanEmail(draft: Draft, known: Set<string>, opts: { demoLink?: string; shared?: string } = {}): EmailIssue[] {
  const out: EmailIssue[] = [];
  const marks = [...draft.body.matchAll(MARK)];
  const waiting = marks.map((m) => m[1]!);
  if (waiting.length) out.push({ kind: 'fixed', text: `the shared wording is not filled in yet: ${[...new Set(waiting)].join(', ')}` });
  // A mark stands for wording that is not judged here, and the link inside one is laid out by the fill.
  const lines = draft.body.replace(MARK, '').split('\n');
  const marked = marks.find((m) => m[1] === 'DEMO LINES');
  const links = (marked ? [marked[2] ?? ''] : lines.filter((l) => /https?:\/\//.test(l))).map((l) => l.trim());
  for (const l of links) if (!/^https:\/\/\S+[^/\s]$/.test(l)) out.push({ kind: 'link', text: l || 'the mark holds no link' });
  if (!links.length) out.push({ kind: 'link', text: 'no demo link' });
  if (opts.demoLink && marked) {
    if (links[0] !== opts.demoLink) out.push({ kind: 'link', text: `the mark holds ${links[0]}, and this business's page is ${opts.demoLink}` });
  } else if (opts.demoLink) {
    const ours = new Set((opts.shared ?? '').split('\n').map((l) => l.trim()));
    for (const l of links) if (l !== opts.demoLink && !ours.has(l)) out.push({ kind: 'link', text: `${l} is not this business's page` });
    if (!links.includes(opts.demoLink)) out.push({ kind: 'link', text: `the page ${opts.demoLink} is not in the email` });
  }
  for (const l of draft.unread) out.push({ kind: 'findings', text: `"${l}" under "Findings used" could not be read` });
  const numbered = lines.filter((l) => /^\s*\d+\.\s+/.test(l)).length;
  const count = (n: number, what: string) => `${n} ${what}${n === 1 ? '' : 's'}`;
  if (numbered !== draft.findings.length) out.push({ kind: 'findings', text: `the email numbers ${count(numbered, 'line')} and lists ${count(draft.findings.length, 'finding')}` });
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
  for (const n of numbersIn(`${draft.subject}\n${copy}`)) if (!known.has(n.token)) out.push({ kind: 'number', text: n.token });
  return out;
}
