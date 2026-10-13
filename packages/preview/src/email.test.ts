import { describe, expect, it } from 'vitest';
import { draftAfterRecheck, fillDraft, fixedBlocks, parseDraft, scanEmail, withStatus } from './email.ts';

const DRAFT = `Status: ready
Batch: A
Findings used:
1. #735 | The phone link is broken
2. #739 | Mobile speed score 30 out of 100, main content after 6.0 s
---
To: info@alpha.co.nz
Subject: Your phone link does not dial

Hi Jack,

I tested your website on a phone this week.

1. The phone number at the top of your site does not dial when tapped.
2. The page scored 30 out of 100 for speed on a phone, and the main content took 6.0 seconds to show.

Google shows you at 4.8 from 594 reviews, so the trips are clearly loved.

https://nahltech.com/demo/alpha-abc123

Udaay
`;

describe('an email draft', () => {
  it('is read back with its status, the findings it uses and its parts', () => {
    const d = parseDraft(DRAFT);
    expect(d.status).toBe('ready');
    expect(d.batch).toBe('A');
    expect(d.findings).toEqual([{ line: 1, id: 735, sentence: 'The phone link is broken' }, { line: 2, id: 739, sentence: 'Mobile speed score 30 out of 100, main content after 6.0 s' }]);
    expect(d.to).toBe('info@alpha.co.nz');
    expect(d.subject).toBe('Your phone link does not dial');
    expect(d.body.startsWith('Hi Jack,')).toBe(true);
  });

  it('keeps its text when its status is changed', () => {
    const changed = withStatus(DRAFT, 'needs edit: line 2, finding #739 no longer reproduces');
    expect(changed.split('\n')[0]).toBe('Status: needs edit: line 2, finding #739 no longer reproduces');
    expect(changed.split('\n').slice(1).join('\n')).toBe(DRAFT.split('\n').slice(1).join('\n'));
  });
});

describe('a draft after its findings are checked again', () => {
  const now = new Date('2026-10-14T02:00:00Z');
  const holds = (id: number, sentence: string) => [id, { status: 'approved', sentence, verifiedAt: '2026-10-14T01:00:00Z' }] as const;
  const d = parseDraft(DRAFT);

  it('is ready when every finding still holds as it was written', () => {
    const r = draftAfterRecheck(d, new Map([holds(735, 'The phone link is broken'), holds(739, 'Mobile speed score 30 out of 100, main content after 6.0 s')]), now);
    expect(r).toEqual({ status: 'ready', notes: [] });
  });

  it('needs an edit, with the line named, when a finding no longer reproduces, has changed its figures or was not checked in time', () => {
    const gone = draftAfterRecheck(d, new Map([[735, { status: 'resolved', sentence: 'The phone link is broken', verifiedAt: '2026-10-14T01:00:00Z' }], holds(739, 'Mobile speed score 30 out of 100, main content after 6.0 s')]), now);
    expect(gone).toEqual({ status: 'needs edit', notes: ['line 1: finding #735 no longer reproduces'] });
    const moved = draftAfterRecheck(d, new Map([holds(735, 'The phone link is broken'), holds(739, 'Mobile speed score 34 out of 100, main content after 5.8 s')]), now);
    expect(moved).toEqual({ status: 'needs edit', notes: ['line 2: finding #739 now reads "Mobile speed score 34 out of 100, main content after 5.8 s"'] });
    const stale = draftAfterRecheck(d, new Map([holds(735, 'The phone link is broken'), [739, { status: 'approved', sentence: 'Mobile speed score 30 out of 100, main content after 6.0 s', verifiedAt: '2026-10-12T01:00:00Z' }]]), now);
    expect(stale).toEqual({ status: 'needs edit', notes: ['line 2: finding #739 was last checked more than 24 hours ago'] });
    expect(draftAfterRecheck(d, new Map([holds(735, 'The phone link is broken')]), now).notes).toEqual(['line 2: finding #739 is not on file']);
  });

  it('stays on hold when it was held as weak, whatever the recheck finds', () => {
    const weak = parseDraft(withStatus(DRAFT, 'HOLD (weak: fewer than two approved findings)'));
    expect(draftAfterRecheck(weak, new Map([holds(735, 'The phone link is broken'), holds(739, 'Mobile speed score 30 out of 100, main content after 6.0 s')]), now).status).toBe('HOLD');
  });
});

describe('the copy scan for an email', () => {
  const known = new Set(['30', '100', '6.0', '4.8', '594']);
  const scan = (text: string) => scanEmail(parseDraft(text), known).map((i) => i.kind);

  it('passes a clean draft apart from its length', () => {
    expect(scanEmail(parseDraft(DRAFT), known).map((i) => i.kind)).toEqual(['length']);
  });

  it('finds dashes and hyphens inside sentences, exclamation marks, hype, questions in the subject and numbers with no source', () => {
    expect(scan(DRAFT.replace('does not dial when tapped', 'does not dial - at all'))).toContain('dash');
    expect(scan(DRAFT.replace('clearly loved', 'well-loved'))).toContain('hyphen');
    expect(scan(DRAFT.replace('clearly loved.', 'clearly loved!'))).toContain('exclamation');
    expect(scan(DRAFT.replace('clearly loved', 'world-class'))).toContain('banned');
    expect(scan(DRAFT.replace('Subject: Your phone link does not dial', 'Subject: Is your phone link broken?'))).toContain('subject');
    expect(scan(DRAFT.replace('Subject: Your phone link does not dial', 'Subject: The phone number at the top of your website does not dial at all'))).toContain('subject');
    expect(scan(DRAFT.replace('594 reviews', '600 reviews'))).toContain('number');
    expect(scan(DRAFT.replace('https://nahltech.com/demo/alpha-abc123', 'See https://nahltech.com/demo/alpha-abc123/ today'))).toContain('link');
  });

  it('does not count the address, the link or the list numbers as copy', () => {
    const issues = scanEmail(parseDraft(DRAFT), known);
    expect(issues.filter((i) => i.kind === 'number')).toEqual([]);
    expect(issues.filter((i) => i.kind === 'hyphen')).toEqual([]);
  });
});

describe('the wording every email shares', () => {
  const sheet = `# The wording every email shares

## INTRO
My name is Udaay.

## DEMO LINES
I built a demo of what your homepage could be:

{link}

## CLOSING
Reply to this email and I will send the details.

Udaay
`;
  const draft = DRAFT.replace('I tested your website on a phone this week.', '[[INTRO]]\n\nI tested your website on a phone this week.').replace('https://nahltech.com/demo/alpha-abc123\n\nUdaay\n', '[[DEMO LINES: https://nahltech.com/demo/alpha-abc123]]\n\n[[CLOSING]]\n');

  it('is read from a sheet of named blocks, and a block left empty or as it was handed over is not counted', () => {
    expect(fixedBlocks(sheet)).toEqual({ INTRO: 'My name is Udaay.', 'DEMO LINES': 'I built a demo of what your homepage could be:\n\n{link}', CLOSING: 'Reply to this email and I will send the details.\n\nUdaay' });
    expect(fixedBlocks('## INTRO\n(paste the intro line here)\n\n## CLOSING\n\n')).toEqual({});
  });

  it('is put into a draft where the draft marks its place, with the link on a line of its own', () => {
    const filled = fillDraft(draft, fixedBlocks(sheet));
    expect(filled).toContain('Hi Jack,\n\nMy name is Udaay.\n\nI tested your website on a phone this week.');
    expect(filled).toContain('I built a demo of what your homepage could be:\n\nhttps://nahltech.com/demo/alpha-abc123\n\nReply to this email and I will send the details.\n\nUdaay\n');
    expect(filled).not.toContain('[[');
    // A block that is not there yet leaves its mark in place.
    expect(fillDraft(draft, { INTRO: 'My name is Udaay.' })).toContain('[[CLOSING]]');
  });

  it('counts as missing in the scan until it is filled in, and the length is not judged before then', () => {
    const kinds = scanEmail(parseDraft(draft), new Set(['30', '100', '6.0', '4.8', '594'])).map((i) => i.kind);
    expect(kinds).toContain('fixed');
    expect(kinds).not.toContain('length');
    expect(kinds).not.toContain('link');
  });
});

describe('a draft whose bookkeeping cannot be read', () => {
  const now = new Date('2026-10-14T02:00:00Z');
  const holds = (id: number, sentence: string) => [id, { status: 'approved', sentence, verifiedAt: '2026-10-14T01:00:00Z' }] as const;
  const all = new Map([holds(735, 'The phone link is broken'), holds(739, 'Mobile speed score 30 out of 100, main content after 6.0 s')]);

  it('is not called ready when a line under "Findings used" does not read as a finding', () => {
    const slip = parseDraft(DRAFT.replace('1. #735 |', '1. 735 |'));
    expect(slip.unread).toEqual(['1. 735 | The phone link is broken']);
    expect(draftAfterRecheck(slip, all, now)).toEqual({ status: 'needs edit', notes: ['"1. 735 | The phone link is broken" under "Findings used" could not be read'] });
    expect(scanEmail(slip, new Set(['30', '100', '6.0', '4.8', '594'])).map((i) => i.kind)).toContain('findings');
  });

  it('is not called ready when it lists no finding at all', () => {
    const none = parseDraft(DRAFT.replace(/^\d\. #.*\n/gm, ''));
    expect(none.findings).toEqual([]);
    expect(draftAfterRecheck(none, all, now)).toEqual({ status: 'needs edit', notes: ['no finding is listed under "Findings used"'] });
  });

  it('is told when the email numbers more lines than it lists findings', () => {
    const extra = parseDraft(DRAFT.replace('2. #739 | Mobile speed score 30 out of 100, main content after 6.0 s\n', ''));
    expect(scanEmail(extra, new Set(['30', '100', '6.0', '4.8', '594'])).filter((i) => i.kind === 'findings').map((i) => i.text)).toEqual(['the email numbers 2 lines and lists 1 finding']);
  });
});

describe('a status the recheck did not write', () => {
  const now = new Date('2026-10-14T02:00:00Z');
  const holds = (id: number, sentence: string) => [id, { status: 'approved', sentence, verifiedAt: '2026-10-14T01:00:00Z' }] as const;
  const all = new Map([holds(735, 'The phone link is broken'), holds(739, 'Mobile speed score 30 out of 100, main content after 6.0 s')]);

  it('is kept: a draft marked sent is not made ready again', () => {
    expect(draftAfterRecheck(parseDraft(withStatus(DRAFT, 'sent 14 October')), all, now)).toEqual({ status: 'kept', notes: [] });
  });

  it('is kept when a person asked for an edit, and replaced when the recheck asked for it', () => {
    expect(draftAfterRecheck(parseDraft(withStatus(DRAFT, 'needs edit: soften the second line')), all, now).status).toBe('kept');
    expect(draftAfterRecheck(parseDraft(withStatus(DRAFT, 'needs edit (recheck): line 2: finding #739 no longer reproduces')), all, now).status).toBe('ready');
  });
});

describe('the link and the subject of an email', () => {
  const known = new Set(['30', '100', '6.0', '4.8', '594']);
  const mine = 'https://nahltech.com/demo/alpha-abc123';

  it("must carry this business's own page, and no other address", () => {
    expect(scanEmail(parseDraft(DRAFT), known, { demoLink: mine }).filter((i) => i.kind === 'link')).toEqual([]);
    const other = parseDraft(DRAFT.replace(mine, 'https://nahltech.com/demo/bravo-zzz999'));
    expect(scanEmail(other, known, { demoLink: mine }).filter((i) => i.kind === 'link').map((i) => i.text)).toEqual(["https://nahltech.com/demo/bravo-zzz999 is not this business's page", `the page ${mine} is not in the email`]);
    const marked = parseDraft(DRAFT.replace(`${mine}\n\nUdaay\n`, '[[DEMO LINES: https://nahltech.com/demo/bravo-zzz999]]\n\n[[CLOSING]]\n'));
    expect(scanEmail(marked, known, { demoLink: mine }).filter((i) => i.kind === 'link').map((i) => i.text)).toEqual([`the mark holds https://nahltech.com/demo/bravo-zzz999, and this business's page is ${mine}`]);
  });

  it('may carry an address the shared wording holds', () => {
    const footed = parseDraft(DRAFT.replace('Udaay\n', 'Udaay\nhttps://nahltech.com\n'));
    expect(scanEmail(footed, known, { demoLink: mine, shared: 'Udaay\nhttps://nahltech.com' }).filter((i) => i.kind === 'link')).toEqual([]);
    expect(scanEmail(footed, known, { demoLink: mine, shared: '' }).filter((i) => i.kind === 'link').map((i) => i.text)).toEqual(["https://nahltech.com is not this business's page"]);
  });

  it('has a source for every number in the subject too', () => {
    const subject = parseDraft(DRAFT.replace('Subject: Your phone link does not dial', 'Subject: Your site took 9 seconds to load'));
    expect(scanEmail(subject, known).filter((i) => i.kind === 'number').map((i) => i.text)).toEqual(['9']);
  });
});
