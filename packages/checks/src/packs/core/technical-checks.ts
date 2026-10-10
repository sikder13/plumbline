import type { CandidateFinding } from '@plumbline/core';
import type { AxeViolation } from '@plumbline/collect';
import { common, elementEvidence, home, okHomes, plural, siteFinding } from '../../helpers.ts';
import type { Check } from '../../types.ts';

export const C20_slow_mobile: Check = {
  id: 'C20_slow_mobile',
  pack: 'core',
  tier: 'measured',
  evidenceSpec: 'page',
  appliesTo: ({ site }) => !site.blocked && !!site.lighthouse.mobile,
  evaluate({ site }) {
    const lh = site.lighthouse.mobile!;
    const good = lh.runs.filter((r) => r.performance !== null);
    // The median of three is only a median when at least two runs produced a number.
    if (good.length < 2) return [];
    const { performance, lcpMs } = lh.median;
    const slowScore = performance !== null && performance < 50;
    const slowLcp = lcpMs !== null && lcpMs > 4000;
    if (!slowScore && !slowLcp) return [];
    const lcp = lcpMs === null ? 'unknown' : `${(lcpMs / 1000).toFixed(1)} s`;
    return [
      siteFinding(
        this.id,
        site,
        `Mobile speed score ${performance ?? 'unknown'} out of 100, main content after ${lcp}`,
        { performance, lcpMs, cls: lh.median.cls, tbtMs: lh.median.tbtMs, runs: lh.runs, largestImages: lh.largestImages, lighthouse: lh.version, thresholds: { performanceBelow: 50, lcpAboveMs: 4000 }, measuredAt: lh.at },
        `Lighthouse ${lh.version}, mobile, median of ${good.length} runs: performance ${performance}, largest contentful paint ${lcp}, total blocking time ${Math.round(lh.median.tbtMs ?? 0)} ms. Runs: ${lh.runs.map((r) => `${r.performance ?? 'failed'}`).join(', ')}.`,
        'homepage',
      ),
    ];
  },
};

export const C23_not_mobile_friendly: Check = {
  id: 'C23_not_mobile_friendly',
  pack: 'core',
  tier: 'measured',
  evidenceSpec: 'element',
  appliesTo: ({ site }) => !site.blocked && !!site.homepage.mobile?.ok,
  evaluate({ site }) {
    const page = site.homepage.mobile!;
    const reasons: string[] = [];
    if (!page.meta.viewport) reasons.push('no viewport setting, so phones show the desktop layout shrunk down');
    if (page.layout.horizontalScroll) reasons.push(`the page is ${page.layout.scrollWidth} px wide on a ${page.layout.deviceWidth} px screen`);
    const body = page.blocks.filter((b) => !b.inNav && !b.inFooter && b.text.length >= 20);
    const total = body.reduce((s, b) => s + b.text.length, 0);
    const small = body.filter((b) => b.fontSize < 12).reduce((s, b) => s + b.text.length, 0);
    if (total > 200 && small / total >= 0.5) reasons.push(`${Math.round((small / total) * 100)}% of the body text is smaller than 12 px`);
    if (!reasons.length) return [];
    const wide = page.layout.wide[0];
    const finding: CandidateFinding = {
      checkId: this.id,
      fingerprint: 'homepage',
      title: 'The homepage does not fit a phone screen',
      pageUrl: page.finalUrl,
      viewport: 'mobile',
      where: 'homepage_mobile',
      detail: { reasons, viewportMeta: page.meta.viewport, scrollWidth: page.layout.scrollWidth, deviceWidth: page.layout.deviceWidth, widest: page.layout.wide.map((w) => w.selector) },
      evidence: [
        wide && page.layout.horizontalScroll
          ? elementEvidence(page, wide.selector, wide.box, `At ${page.layout.deviceWidth} px wide: ${reasons.join('; ')}. Widest element ends at ${wide.right} px.`)
          : { kind: 'page', url: page.finalUrl, viewport: 'mobile', excerpt: `At ${page.layout.deviceWidth} px wide: ${reasons.join('; ')}.` },
      ],
    };
    return [finding];
  },
};

export const C31_no_structured_data: Check = {
  id: 'C31_no_structured_data',
  pack: 'core',
  tier: 'measured',
  evidenceSpec: 'page',
  appliesTo: ({ site }) => !site.blocked && !!site.structuredData,
  evaluate({ site }) {
    const sd = site.structuredData!;
    if (sd.hasLocalBusinessFamily) return [];
    // If the extractor itself failed, there is no measurement to report.
    if (sd.errors.some((e) => e.type === 'extractor')) return [];
    return [
      siteFinding(
        this.id,
        site,
        'The homepage has no structured data describing the business',
        { typesFound: sd.types },
        sd.types.length ? `Structured data types on the homepage: ${sd.types.join(', ')}. None describes a business or a place.` : 'The homepage carries no structured data at all.',
        'homepage',
      ),
    ];
  },
};

export const C33_robots_blocks_search_or_ai: Check = {
  id: 'C33_robots_blocks_search_or_ai',
  pack: 'core',
  tier: 'measured',
  evidenceSpec: 'page',
  appliesTo: ({ site }) => site.robots.outcome === 'rules',
  evaluate({ site }) {
    const blocked = site.robots.botBlocks.filter((b) => b.blocked.length);
    if (!blocked.length) return [];
    const lines = site.robots.body.split(/\r?\n/).filter((l) => /^\s*(user-agent|disallow|allow)\s*:/i.test(l)).slice(0, 40).join('\n');
    return [
      {
        checkId: this.id,
        fingerprint: 'robots',
        title: `robots.txt turns away ${blocked.map((b) => b.bot).join(', ')}`,
        pageUrl: new URL('/robots.txt', site.homepageUrl).toString(),
        viewport: null,
        where: 'homepage_mobile',
        detail: { bots: blocked.map((b) => ({ bot: b.bot, namedInFile: b.ownGroup, pages: b.blocked.slice(0, 10) })) },
        evidence: [
          {
            kind: 'page',
            url: new URL('/robots.txt', site.homepageUrl).toString(),
            excerpt: `${blocked.map((b) => `${b.bot}: ${b.blocked.length} key page(s) disallowed, for example ${b.blocked[0]}`).join('. ')}.\n\nrobots.txt rules:\n${lines}`,
          },
        ],
      },
    ];
  },
};

export const C40_insecure_connection: Check = {
  id: 'C40_insecure_connection',
  pack: 'core',
  tier: 'measured',
  evidenceSpec: 'page',
  appliesTo: ({ site }) => !site.blocked && okHomes(site).length > 0,
  evaluate({ site }) {
    const h = home(site)!;
    const mixed = [...new Set(okHomes(site).flatMap((p) => p.mixedContent))];
    const reasons: string[] = [];
    if (site.https.homepageScheme !== 'https') reasons.push('the homepage loads over http, not https');
    if (site.https.certError) reasons.push('the security certificate is not valid');
    if (mixed.length) reasons.push(`${plural(mixed.length, 'file')} on the secure page ${mixed.length === 1 ? 'is' : 'are'} requested over http`);
    if (!reasons.length) return [];
    return [siteFinding(this.id, site, `The connection is not fully secure: ${reasons[0]}`, { reasons, finalUrl: h.finalUrl, certError: site.https.certError, mixedContent: mixed.slice(0, 10) }, `${reasons.join('; ')}. ${mixed.length ? `Examples: ${mixed.slice(0, 3).join(', ')}` : `Final address: ${h.finalUrl}`}`, 'homepage')];
  },
  merge(a, b) {
    const reasons = common(a.reasons as string[], b.reasons as string[], (r) => r.replace(/\d+/g, 'n'));
    return reasons.length ? { ...b, reasons } : null;
  },
};

export const C41_outdated_platform: Check = {
  id: 'C41_outdated_platform',
  pack: 'core',
  tier: 'measured',
  evidenceSpec: 'page',
  appliesTo: ({ site }) => !site.blocked,
  evaluate({ site }) {
    return site.eol.slice(0, 2).map((e) =>
      siteFinding(
        this.id,
        site,
        `${e.product} ${e.version} is past its end of life (${e.eolDate})`,
        { product: e.product, version: e.version, eolDate: e.eolDate, sourceUrl: e.sourceUrl, detectedFrom: e.detectedFrom },
        `${e.product} ${e.version}, read from the ${e.detectedFrom}. Support for this series ended on ${e.eolDate} (${e.sourceUrl}).`,
        `${e.product}|${e.version}`,
      ),
    );
  },
};

interface AxeRule {
  id: string;
  help: string;
  impact: string;
  nodes: number;
}

export const C50_accessibility_failures: Check = {
  id: 'C50_accessibility_failures',
  pack: 'core',
  tier: 'measured',
  evidenceSpec: 'element',
  appliesTo: ({ site }) => !site.blocked && !!(site.axe.mobile || site.axe.desktop),
  evaluate({ site }) {
    const page = site.homepage.mobile?.ok && site.axe.mobile ? site.homepage.mobile : site.homepage.desktop;
    const violations: AxeViolation[] = (page === site.homepage.mobile ? site.axe.mobile : site.axe.desktop) ?? [];
    if (!page || !violations.length) return [];
    const rules: AxeRule[] = violations.map((v) => ({ id: v.id, help: v.help, impact: v.impact, nodes: v.nodeCount }));
    const boxed = violations.flatMap((v) => v.nodes.filter((n) => n.box && n.box.w > 1 && n.box.h > 1).slice(0, 1).map((n) => ({ v, n }))).slice(0, 3);
    return [
      {
        checkId: this.id,
        fingerprint: 'homepage',
        title: `${plural(rules.length, 'serious accessibility failure')} on the homepage`,
        pageUrl: page.finalUrl,
        viewport: page.viewport,
        where: page.viewport === 'mobile' ? 'homepage_mobile' : 'homepage_desktop',
        detail: { rules },
        evidence: boxed.length
          ? boxed.map(({ v, n }) => elementEvidence(page, n.target, n.box, `${v.help} (${v.id}, ${v.impact}, ${v.nodeCount} element${v.nodeCount === 1 ? '' : 's'}). ${n.html}`))
          : [{ kind: 'page', url: page.finalUrl, viewport: page.viewport, excerpt: rules.map((r) => `${r.help} (${r.id}, ${r.impact}, ${r.nodes})`).join('; ') }],
      },
    ];
  },
  merge(a, b) {
    const rules = common(a.rules as AxeRule[], b.rules as AxeRule[], (r) => r.id);
    return rules.length ? { ...b, rules } : null;
  },
};
