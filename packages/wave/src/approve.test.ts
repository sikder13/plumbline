import { describe, expect, it } from 'vitest';
import { decideFindings, isWeak, needsThirdSpeedRun, ownerOrder, rejectionFor, sameSpeed, tierOf, type ApprovalContext, type ApprovalFinding } from './approve.ts';

const NOW = new Date('2026-10-13T08:00:00Z');
let next = 0;
const finding = (checkId: string, patch: Partial<ApprovalFinding> = {}): ApprovalFinding => ({
  id: ++next,
  checkId,
  source: checkId.startsWith('CM_') ? 'crawlmouse' : 'plumbline',
  status: 'reproduced',
  tier: 'measured',
  severity: 4,
  score: 4,
  title: `${checkId} measured`,
  detail: {},
  lastVerifiedAt: '2026-10-13T03:00:00Z',
  evidence: [{ kind: 'page', path: '/data/evidence/alpha/1-1.webp', excerpt: 'seen' }],
  ...patch,
});
const context = (patch: Partial<ApprovalContext> = {}): ApprovalContext => ({ slug: 'alpha', now: NOW, bookingRoutes: [], contactRoutes: [], agencyNames: [], ageGate: false, speedRuns: [{ performance: 30, lcpMs: 8000 }, { performance: 32, lcpMs: 7600 }], flagged: new Map(), ...patch });
const rule = (f: ApprovalFinding, ctx: ApprovalContext = context()) => rejectionFor(f, ctx)?.rule ?? null;

describe('Filter 1: reasons to reject a finding', () => {
  it('rejects one that did not reproduce today, or has no screenshot or measured value', () => {
    expect(rule(finding('C10_broken_contact_links'))).toBeNull();
    expect(rule(finding('C10_broken_contact_links', { status: 'candidate' }))).toBe('F1.1 did not reproduce');
    expect(rule(finding('C10_broken_contact_links', { status: 'resolved' }))).toBe('F1.1 did not reproduce');
    expect(rule(finding('C10_broken_contact_links', { lastVerifiedAt: '2026-10-11T05:00:00Z' }))).toBe('F1.1 did not reproduce');
    expect(rule(finding('C10_broken_contact_links', { lastVerifiedAt: null }))).toBe('F1.1 did not reproduce');
    expect(rule(finding('C10_broken_contact_links', { evidence: [{ kind: 'page', path: null, excerpt: 'seen' }] }))).toBe('F1.1 no screenshot or measured value');
    expect(rule(finding('C10_broken_contact_links', { title: ' ' }))).toBe('F1.1 no screenshot or measured value');
    // A finding built on AI answers has the answers behind it, not a screenshot.
    expect(rule(finding('C37_not_named_by_ai', { evidence: [{ kind: 'ai', path: null, excerpt: 'Question: Q' }] }))).toBeNull();
    expect(rule(finding('C37_not_named_by_ai', { evidence: [{ kind: 'ai', path: null, excerpt: ' ' }] }))).toBe('F1.1 no screenshot or measured value');
  });

  it('rejects "no booking" when any way to book exists, and "no contact" when the homepage has one', () => {
    const eveve = context({ bookingRoutes: ['Eveve reservations on https://alpha.co.nz/reservations.html'] });
    expect(rejectionFor(finding('T01_no_online_booking'), eveve)).toEqual({ rule: 'F1.2 a way to book exists', reason: 'the site has Eveve reservations on https://alpha.co.nz/reservations.html' });
    expect(rule(finding('T03_platform_dependency'), eveve)).toBe('F1.2 a way to book exists');
    expect(rule(finding('T01_no_online_booking'))).toBeNull();
    // Other findings about the same site are not touched by it.
    expect(rule(finding('C13_no_action_above_fold'), eveve)).toBeNull();
    expect(rule(finding('C15_contact_details_missing'), context({ contactRoutes: ['an email link in the footer'] }))).toBe('F1.2 a way to get in touch exists');
    expect(rule(finding('C15_contact_details_missing'))).toBeNull();
  });

  it('rejects a finding that names or blames whoever built the site', () => {
    const agency = context({ agencyNames: ['Tidal Studio'] });
    expect(rule(finding('C01_placeholder_text', { evidence: [{ kind: 'page', path: '/x.webp', excerpt: 'Website by Tidal Studio. Lorem ipsum' }] }), agency)).toBe('F1.3 names or blames an agency');
    expect(rule(finding('C01_placeholder_text', { title: 'Template text left by the web designer' }))).toBe('F1.3 names or blames an agency');
    // An agency looking after the site is no reason to drop findings that do not speak of it.
    expect(rule(finding('C20_slow_mobile'), agency)).toBeNull();
  });

  it('rejects what rests on an inference: a judgment, a first screen that was an age gate, a count we could not bear out', () => {
    expect(rule(finding('C60_conflicting_facts', { tier: 'judgment' }))).toBe('F1.4 inference, not measurement');
    const gate = context({ ageGate: true });
    for (const check of ['C13_no_action_above_fold', 'C14_no_price_visible', 'C36_thin_homepage', 'C50_accessibility_failures']) expect(rule(finding(check), gate), check).toBe('F1.4 inference, not measurement');
    expect(rule(finding('C20_slow_mobile'), gate)).toBeNull();
    expect(rule(finding('CM_no_meta_description', { detail: { measured: 'No meta description on the example page. The 13 other pages we read all have one.' } }))).toBe('F1.4 inference, not measurement');
    expect(rule(finding('CM_no_meta_description', { detail: { measured: 'No meta description on the example page, nor on 9 of the 11 other pages we read.' } }))).toBeNull();
  });

  it('rejects a count that our own reading of the pages did not bear out, and a finding its source says to check first', () => {
    const count = (measured: string) => rule(finding('CM_no_meta_description', { title: '72 of 102 pages have no meta description.', detail: { measured } }));
    expect(count('No meta description on the example page, nor on 1 of the 14 other pages we read.')).toBe('F1.4 inference, not measurement');
    expect(count('No meta description on the example page, nor on 9 of the 14 other pages we read.')).toBeNull();
    // A sentence with no count in it has nothing to bear out.
    expect(rule(finding('CM_no_meta_description', { title: 'Half the pages have no meta description.', detail: { measured: 'No meta description on the 2 example pages, nor on 1 of the 4 other pages we read.' } }))).toBeNull();
    expect(rule(finding('CM_orphan_page', { title: 'Several trip pages are not linked from anywhere else on the site.', detail: { caution: 'Some may be intentionally retired. Check before using.' } }))).toBe('F1.4 inference, not measurement');
  });

  it('rejects an unlinked page with next to nothing on it', () => {
    const orphan = (words: number) => rule(finding('CM_orphan_page', { title: 'Your Book Online page exists but is not linked from anywhere on the site.', detail: { examples: [{ url: 'https://alpha.co.nz/book-online', words }] } }));
    expect(orphan(32)).toBe('F1.6 unlinked page visitors do not need');
    expect(orphan(400)).toBeNull();
  });

  it('rejects a broken link nobody is sent to, and an unlinked page visitors do not need', () => {
    expect(rule(finding('CM_missing_page', { detail: { examples: [{ url: 'https://alpha.co.nz/x', linkedFrom: [] }] } }))).toBe('F1.5 no page links to the missing page');
    expect(rule(finding('CM_missing_page', { detail: { examples: [{ url: 'https://alpha.co.nz/x', linkedFrom: [{ pageUrl: 'https://alpha.co.nz/' }] }] } }))).toBeNull();
    expect(rule(finding('CM_orphan_page', { title: 'Many conservation pages are not linked from anywhere else on the site.' }))).toBe('F1.6 unlinked page visitors do not need');
    expect(rule(finding('CM_orphan_page', { title: 'Your Book Online page exists but is not linked from anywhere on the site.' }))).toBeNull();
    expect(rule(finding('CM_orphan_page', { title: 'Several trip pages are not linked from anywhere else on the site.' }))).toBeNull();
  });

  it('rejects a speed finding whose runs disagree by more than 30%, unless a third run settles it', () => {
    const steady = [{ performance: 30, lcpMs: 8000 }, { performance: 32, lcpMs: 7600 }];
    const split = [{ performance: 30, lcpMs: 8000 }, { performance: 55, lcpMs: 4200 }];
    expect(needsThirdSpeedRun(steady)).toBe(false);
    expect(needsThirdSpeedRun(split)).toBe(true);
    expect(rule(finding('C20_slow_mobile'), context({ speedRuns: steady }))).toBeNull();
    expect(rule(finding('C20_slow_mobile'), context({ speedRuns: split }))).toBe('F1.7 unstable speed');
    // A third run that agrees with one of the two gives a median that stands.
    const settled = [...split, { performance: 33, lcpMs: 7900 }];
    expect(rule(finding('C20_slow_mobile'), context({ speedRuns: settled }))).toBeNull();
    const wild = [{ performance: 20, lcpMs: 12000 }, { performance: 45, lcpMs: 6000 }, { performance: 90, lcpMs: 1500 }];
    expect(rule(finding('C20_slow_mobile'), context({ speedRuns: wild }))).toBe('F1.7 unstable speed');
    expect(rule(finding('C20_slow_mobile'), context({ speedRuns: [steady[0]!] }))).toBe('F1.7 unstable speed');
  });

  it('rejects whatever an independent reviewer flagged, with the reason given', () => {
    const f = finding('C11_dead_navigation');
    expect(rejectionFor(f, context({ flagged: new Map([[f.id, 'the menu items open a dropdown']]) }))).toEqual({ rule: 'F4 independent check', reason: 'the menu items open a dropdown' });
  });
});

describe('Filter 2: tiers', () => {
  it('puts lost bookings first, then speed, security and trust, search and AI, then the rest', () => {
    const ctx = context();
    expect(tierOf(finding('C10_broken_contact_links'), ctx).tier).toBe('lost bookings or contact');
    expect(tierOf(finding('CM_missing_page'), ctx).tier).toBe('lost bookings or contact');
    expect(tierOf(finding('C41_outdated_platform'), ctx).tier).toBe('security and trust');
    expect(tierOf(finding('C37_not_named_by_ai'), ctx).tier).toBe('search and AI');
    expect(tierOf(finding('C50_accessibility_failures'), ctx).tier).toBe('other');
    expect(tierOf(finding('C03_stale_dated_notice'), ctx).tier).toBe('security and trust');
  });

  it('counts a missing price as lost bookings only when no page of the site shows one', () => {
    expect(tierOf(finding('C14_no_price_visible', { detail: { scope: 'site', pricesFoundOn: [] } }), context()).tier).toBe('lost bookings or contact');
    expect(tierOf(finding('C14_no_price_visible', { detail: { scope: 'homepage', pricesFoundOn: [{ url: 'https://alpha.co.nz/prices' }] } }), context()).tier).toBe('other');
  });

  it('counts speed as a speed problem only when main content takes over 4 s or the score is under 50', () => {
    expect(tierOf(finding('C20_slow_mobile'), context({ speedRuns: [{ performance: 45, lcpMs: 3000 }, { performance: 47, lcpMs: 3100 }] })).tier).toBe('speed');
    expect(tierOf(finding('C20_slow_mobile'), context({ speedRuns: [{ performance: 62, lcpMs: 4600 }, { performance: 64, lcpMs: 4400 }] })).tier).toBe('speed');
    expect(tierOf(finding('C20_slow_mobile'), context({ speedRuns: [{ performance: 62, lcpMs: 3600 }, { performance: 64, lcpMs: 3400 }] })).tier).toBe('other');
  });
});

describe('Filter 3: what is approved', () => {
  const picks = (list: ApprovalFinding[], ctx = context(), always?: (f: ApprovalFinding) => boolean) =>
    decideFindings(list, ctx, { always }).filter((d) => d.decision === 'approve').map((d) => d.checkId);

  it('approves the top three in tier order and rejects the rest', () => {
    const list = [finding('C37_not_named_by_ai'), finding('C41_outdated_platform'), finding('C31_no_structured_data'), finding('C13_no_action_above_fold'), finding('C50_accessibility_failures')];
    const decisions = decideFindings(list, context());
    expect(decisions.filter((d) => d.decision === 'approve').map((d) => [d.checkId, d.rule])).toEqual([
      ['C13_no_action_above_fold', 'F3 top three'],
      ['C41_outdated_platform', 'F3 top three'],
      ['C37_not_named_by_ai', 'F3 top three'],
    ]);
    expect(decisions.filter((d) => d.decision === 'reject').map((d) => [d.checkId, d.rule])).toEqual([
      ['C31_no_structured_data', 'F3 not in the top three'],
      ['C50_accessibility_failures', 'F3 not in the top three'],
    ]);
    expect(decisions).toHaveLength(list.length);
  });

  it('approves a fourth and a fifth only when they cost bookings or speed', () => {
    const four = [finding('C10_broken_contact_links'), finding('C12_broken_internal_links'), finding('C13_no_action_above_fold'), finding('C20_slow_mobile'), finding('C41_outdated_platform')];
    expect(picks(four)).toEqual(['C10_broken_contact_links', 'C12_broken_internal_links', 'C13_no_action_above_fold', 'C20_slow_mobile']);
    const five = [...four.slice(0, 4), finding('C15_contact_details_missing'), finding('C23_not_mobile_friendly')];
    expect(picks(five)).toHaveLength(5);
    expect(picks([finding('C10_broken_contact_links'), finding('C41_outdated_platform'), finding('C37_not_named_by_ai'), finding('C31_no_structured_data')])).toHaveLength(3);
  });

  it('keeps one finding for each cause: the same check twice, a booking gap said two ways, one broken address reported by both tools', () => {
    const twice = decideFindings([finding('C10_broken_contact_links', { score: 5 }), finding('C10_broken_contact_links', { score: 4 })], context());
    expect(twice.map((d) => [d.decision, d.rule])).toEqual([['reject', 'F1.8 same cause as another finding'], ['approve', 'F3 top three']]);
    expect(picks([finding('T01_no_online_booking'), finding('T03_platform_dependency')])).toEqual(['T01_no_online_booking']);
    const ours = finding('C12_broken_internal_links', { detail: { links: [{ url: 'https://www.alpha.co.nz/contact/', status: 404 }] } });
    const theirs = finding('CM_missing_page', { detail: { examples: [{ url: 'https://alpha.co.nz/contact', linkedFrom: [{ pageUrl: 'https://alpha.co.nz/faq' }] }] } });
    const elsewhere = finding('C12_broken_internal_links', { detail: { links: [{ url: 'https://alpha.co.nz/tours-old', status: 404 }] } });
    expect(picks([ours, theirs])).toEqual(['CM_missing_page']);
    expect(picks([elsewhere, theirs])).toEqual(['CM_missing_page', 'C12_broken_internal_links']);
    expect(picks([finding('C31_no_structured_data'), finding('CM_no_structured_data')])).toEqual(['C31_no_structured_data']);
  });

  it('always approves a named finding when it survives the first filter, and never when it does not', () => {
    const top = [finding('C10_broken_contact_links'), finding('C13_no_action_above_fold'), finding('C41_outdated_platform')];
    const ai = finding('C37_not_named_by_ai', { evidence: [{ kind: 'ai', path: null, excerpt: 'Question: Q' }] });
    const always = (f: ApprovalFinding) => f.checkId === 'C37_not_named_by_ai';
    expect(picks([...top, ai], context(), always)).toEqual(['C10_broken_contact_links', 'C13_no_action_above_fold', 'C41_outdated_platform', 'C37_not_named_by_ai']);
    expect(picks([...top, { ...ai, status: 'resolved' }], context(), always)).toHaveLength(3);
  });

  it('moves the next finding up when a reviewer flags one', () => {
    const list = [finding('C10_broken_contact_links'), finding('C11_dead_navigation'), finding('C13_no_action_above_fold'), finding('C41_outdated_platform')];
    expect(picks(list)).toEqual(['C10_broken_contact_links', 'C11_dead_navigation', 'C13_no_action_above_fold']);
    expect(picks(list, context({ flagged: new Map([[list[1]!.id, 'the items open a dropdown']]) }))).toEqual(['C10_broken_contact_links', 'C13_no_action_above_fold', 'C41_outdated_platform']);
  });

  it('gives each decision the sentence that is put to the owner', () => {
    const runs = [{ performance: 46, lcpMs: 6568 }, { performance: 40, lcpMs: 6098 }, { performance: 31, lcpMs: 8572 }];
    const [d] = decideFindings([finding('C20_slow_mobile', { title: 'Mobile speed score 31 out of 100, main content after 8.6 s' })], context({ speedRuns: runs }));
    expect(d!.sentence).toBe('Mobile speed score 40 out of 100, main content after 6.6 s');
    expect(d!.title).toBe('Mobile speed score 31 out of 100, main content after 8.6 s');
  });

  it('puts approved findings in the order they are put to the owner', () => {
    const list = [finding('C37_not_named_by_ai'), finding('C20_slow_mobile'), finding('C41_outdated_platform'), finding('C10_broken_contact_links')];
    expect(ownerOrder(list, context().speedRuns).map((f) => f.checkId)).toEqual(['C10_broken_contact_links', 'C20_slow_mobile', 'C41_outdated_platform', 'C37_not_named_by_ai']);
  });

  it('marks a business weak when fewer than two findings are approved', () => {
    expect(isWeak(decideFindings([finding('C10_broken_contact_links')], context()))).toBe(true);
    expect(isWeak(decideFindings([finding('C10_broken_contact_links'), finding('C41_outdated_platform')], context()))).toBe(false);
  });
});

describe('a flag from the independent check', () => {
  it('rejects the finding even when no reason came with it', () => {
    const f = finding('C10_broken_contact_links');
    expect(rejectionFor(f, context({ flagged: new Map([[f.id, '']]) }))).toEqual({ rule: 'F4 independent check', reason: 'flagged, with no reason given' });
  });
});

describe('two findings about broken addresses', () => {
  const picks = (list: ApprovalFinding[]) => decideFindings(list, context()).filter((d) => d.decision === 'approve').map((d) => d.checkId);

  it('are one cause only when the broken address is the same, not when both links sit on the same page', () => {
    const missing = finding('CM_missing_page', { detail: { examples: [{ url: 'https://alpha.co.nz/booking', linkedFrom: [{ pageUrl: 'https://alpha.co.nz/' }] }] } });
    const elsewhere = finding('C12_broken_internal_links', { detail: { links: [{ url: 'https://alpha.co.nz/old-tours', status: 404, foundOn: 'https://alpha.co.nz/' }] } });
    expect(picks([missing, elsewhere])).toEqual(['CM_missing_page', 'C12_broken_internal_links']);
    const same = finding('C12_broken_internal_links', { detail: { links: [{ url: 'https://www.alpha.co.nz/booking/', status: 404, foundOn: 'https://alpha.co.nz/' }] } });
    expect(picks([missing, same])).toEqual(['CM_missing_page']);
  });
});

describe('two speed sentences', () => {
  const speed = (score: number, seconds: string) => `Mobile speed score ${score} out of 100, main content after ${seconds} s`;

  it('say the same thing when their figures agree as two runs would, on the same side of the bar', () => {
    expect(sameSpeed(speed(30, '6.0'), speed(34, '5.8'))).toBe(true);
    expect(sameSpeed(speed(30, '6.0'), speed(30, '6.0'))).toBe(true);
  });

  it('do not when a figure has moved by more than runs may disagree, or the page is no longer slow', () => {
    expect(sameSpeed(speed(30, '6.0'), speed(55, '6.0'))).toBe(false);
    expect(sameSpeed(speed(30, '6.0'), speed(30, '9.5'))).toBe(false);
    // 48 and 3.9 s is past the bar; 52 and 3.8 s is not.
    expect(sameSpeed(speed(48, '3.9'), speed(52, '3.8'))).toBe(false);
  });

  it('are never the same as a sentence about something else', () => {
    expect(sameSpeed(speed(30, '6.0'), 'The phone link is broken')).toBe(false);
    expect(sameSpeed('The phone link is broken', 'The phone link is broken')).toBe(false);
  });
});
