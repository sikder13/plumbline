import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { nzMonth, nzYear, type CandidateFinding } from '@plumbline/core';
import { copyrightYear, datedNotices, findPhrases, foreignBlocks, foundingYears, hiddenBlocks, seasonalMismatches } from '@plumbline/collect';
import { elementEvidence, home, norm, okHomes, pagesInOrder, pathOf, whereOf } from '../../helpers.ts';
import type { Check } from '../../types.ts';
import { FILE_NAME_ONLY, PLACEHOLDERS } from './placeholders.ts';
import { SPAM_HOSTS, SPAM_TERMS } from './spam-terms.ts';

export const C01_placeholder_text: Check = {
  id: 'C01_placeholder_text',
  pack: 'core',
  tier: 'measured',
  evidenceSpec: 'element',
  appliesTo: ({ site }) => !site.blocked,
  evaluate({ site }) {
    const out: CandidateFinding[] = [];
    const seen = new Set<string>();
    const perPage = new Map<string, number>();
    const add = (page: (typeof site.inner)[number], label: string, match: string, selector: string, box: Parameters<typeof elementEvidence>[2], excerpt: string) => {
      const fp = `${pathOf(page.finalUrl)}|${norm(match)}`;
      // One finding for one piece of text, however many patterns it matches.
      const place = `${pathOf(page.finalUrl)}|${norm(excerpt)}`;
      if (seen.has(fp) || seen.has(place) || (perPage.get(page.finalUrl) ?? 0) >= 3) return;
      seen.add(fp);
      seen.add(place);
      perPage.set(page.finalUrl, (perPage.get(page.finalUrl) ?? 0) + 1);
      out.push({
        checkId: this.id,
        fingerprint: fp,
        title: label === 'file name' ? `A file name is shown as text: "${match}"` : `Leftover ${label}: "${match.slice(0, 60)}"`,
        pageUrl: page.finalUrl,
        viewport: page.viewport,
        where: whereOf(site, page),
        detail: { label, match, excerpt },
        evidence: [elementEvidence(page, selector, box, excerpt)],
      });
    };
    for (const page of pagesInOrder(site)) {
      for (const h of findPhrases(page, PLACEHOLDERS)) add(page, h.label, h.match, h.block.selector, h.block.box, h.excerpt);
      for (const block of page.blocks) {
        const text = block.text.trim();
        if (FILE_NAME_ONLY.test(text) && (block.heading || block.href)) add(page, 'file name', text, block.selector, block.box, text);
      }
      for (const link of page.links) {
        if (link.visible && FILE_NAME_ONLY.test(link.text.trim())) add(page, 'file name', link.text.trim(), link.selector, link.box, link.text.trim());
      }
    }
    return out;
  },
};

export const C02_stale_copyright: Check = {
  id: 'C02_stale_copyright',
  pack: 'core',
  tier: 'measured',
  evidenceSpec: 'element',
  appliesTo: ({ site }) => !site.blocked,
  evaluate({ site, now }) {
    const year = nzYear(now);
    // Every homepage capture must agree, so a year that only one layout shows is not reported.
    const homes = okHomes(site);
    const hits = homes.map((p) => ({ page: p, c: copyrightYear(p) }));
    const first = hits.find((h) => h.c);
    if (!first?.c || hits.some((h) => h.c && h.c.year !== first.c!.year)) return [];
    const c = first.c;
    if (year - c.year < 2) return [];
    return [
      {
        checkId: this.id,
        fingerprint: `copyright|${c.year}`,
        title: `The footer says ${c.year}`,
        pageUrl: first.page.finalUrl,
        viewport: first.page.viewport,
        where: whereOf(site, first.page),
        detail: { year: c.year, currentYear: year, text: c.hit.excerpt },
        evidence: [elementEvidence(first.page, c.hit.block.selector, c.hit.block.box, c.hit.excerpt)],
      },
    ];
  },
};

export const C03_stale_dated_notice: Check = {
  id: 'C03_stale_dated_notice',
  pack: 'core',
  tier: 'rule',
  evidenceSpec: 'element',
  appliesTo: ({ site }) => !site.blocked,
  evaluate({ site, now }) {
    const out: CandidateFinding[] = [];
    const seen = new Set<string>();
    const titles = { expired: 'An expired date is still showing', covid: 'COVID wording is still showing', old_alert: 'An old notice is still showing' };
    for (const page of pagesInOrder(site)) {
      // Old alerts are only read on the homepage, where a dated line is a notice and not an archive.
      const isHome = whereOf(site, page) !== 'inner';
      for (const n of datedNotices(page, now)) {
        if (n.kind === 'old_alert' && !isHome) continue;
        const fp = `${n.kind}|${norm(n.excerpt).slice(0, 60)}`;
        if (seen.has(fp)) continue;
        seen.add(fp);
        out.push({
          checkId: this.id,
          fingerprint: fp,
          title: titles[n.kind],
          pageUrl: page.finalUrl,
          viewport: page.viewport,
          where: whereOf(site, page),
          detail: { kind: n.kind, date: n.date, text: n.excerpt },
          evidence: [elementEvidence(page, n.block.selector, n.block.box, n.excerpt)],
        });
      }
    }
    // One per kind is enough for a client. The most visible sighting comes first.
    const kinds = new Set<string>();
    return out.filter((f) => (kinds.has(String(f.detail.kind)) ? false : (kinds.add(String(f.detail.kind)), true)));
  },
};

export const C04_seasonal_mismatch: Check = {
  id: 'C04_seasonal_mismatch',
  pack: 'core',
  tier: 'rule',
  evidenceSpec: 'element',
  appliesTo: ({ site }) => !site.blocked,
  evaluate({ site, now }) {
    const month = nzMonth(now);
    const out: CandidateFinding[] = [];
    const seen = new Set<string>();
    for (const page of pagesInOrder(site)) {
      for (const s of seasonalMismatches(page, month)) {
        const fp = `${s.season}|${norm(s.excerpt).slice(0, 60)}`;
        if (seen.has(fp)) continue;
        seen.add(fp);
        out.push({
          checkId: this.id,
          fingerprint: fp,
          title: `A ${s.season} message is showing out of season`,
          pageUrl: page.finalUrl,
          viewport: page.viewport,
          where: whereOf(site, page),
          detail: { season: s.season, month, text: s.excerpt },
          evidence: [elementEvidence(page, s.block.selector, s.block.box, s.excerpt)],
        });
      }
    }
    return out.slice(0, 2);
  },
};

export const C05_possible_compromise: Check = {
  id: 'C05_possible_compromise',
  pack: 'core',
  tier: 'judgment',
  evidenceSpec: 'element',
  appliesTo: ({ site }) => !site.blocked,
  evaluate({ site }) {
    const out: CandidateFinding[] = [];
    for (const page of pagesInOrder(site)) {
      const foreign = foreignBlocks(page);
      if (!foreign.length) continue;
      const foreignText = foreign.map((f) => f.block.text).join('\n');
      const spam = SPAM_TERMS.map((re) => re.exec(foreignText)?.[0]).filter((x): x is string => !!x);
      const first = foreign[0]!;
      // A business often publishes its own pages in other languages. That is not a compromise, so a
      // foreign block counts only with spam wording, or a link beside it to a host that names itself.
      if (page.meta.hreflangs.length || /french|german|deutsch|chinese|japanese|korean|spanish|francais|\/(fr|de|zh|ja|ko|es|cn)(\/|$)/i.test(page.finalUrl)) continue;
      const top = Math.min(...foreign.map((f) => f.block.box.y));
      const bottom = Math.max(...foreign.map((f) => f.block.box.y + f.block.box.h));
      const outbound = page.links.filter((l) => {
        if (!l.visible || !l.box || !/^https?:/.test(l.href)) return false;
        let host: string;
        try {
          host = new URL(l.href).hostname;
        } catch {
          return false;
        }
        if (host.replace(/^www\./, '') === new URL(page.finalUrl).hostname.replace(/^www\./, '')) return false;
        return l.box.y >= top - 40 && l.box.y <= bottom + 40 && SPAM_HOSTS.test(host);
      });
      if (!spam.length && !outbound.length) continue;
      out.push({
        checkId: this.id,
        fingerprint: `${pathOf(page.finalUrl)}|${first.language}`,
        title: 'Content in another language that does not belong to the business',
        pageUrl: page.finalUrl,
        viewport: page.viewport,
        where: whereOf(site, page),
        detail: { language: first.language, blocks: foreign.length, spamTerms: [...new Set(spam)].slice(0, 8), outboundLinks: [...new Set(outbound.map((l) => l.href))].slice(0, 5), text: first.excerpt },
        evidence: [elementEvidence(page, first.block.selector, first.block.box, first.excerpt)],
      });
      break;
    }
    return out;
  },
};

export const C05b_hidden_injected_content: Check = {
  id: 'C05b_hidden_injected_content',
  pack: 'core',
  tier: 'judgment',
  evidenceSpec: 'element',
  appliesTo: ({ site }) => !site.blocked,
  evaluate({ site }) {
    const out: CandidateFinding[] = [];
    const pages = pagesInOrder(site);
    const done = new Set<string>();
    for (const page of pages) {
      if (done.has(page.finalUrl) || !page.dir || !page.htmlFile) continue;
      done.add(page.finalUrl);
      const file = join(page.dir, page.htmlFile);
      if (!existsSync(file)) continue;
      // Text shown at either screen size is not hidden, so every capture of this address counts.
      const captures = pages.filter((p) => p.finalUrl === page.finalUrl);
      const blocks = hiddenBlocks(readFileSync(file, 'utf8'), captures.map((p) => p.text), page.finalUrl, SPAM_TERMS, page.meta.lang || 'en');
      for (const b of blocks.slice(0, 2)) {
        // The place in the page where the hidden block sits: the visible text that comes just before it.
        const anchor = b.before.map((t) => page.blocks.find((v) => v.text.replace(/\s+/g, ' ').includes(t.slice(0, 50)))).find((v) => !!v);
        const what = [b.language ? `text in another language (${b.language})` : '', b.spamTerms.length ? `spam wording (${b.spamTerms.slice(0, 3).join(', ')})` : ''].filter(Boolean).join(' and ');
        const excerpt = `Hidden in the page code${b.line ? ` at line ${b.line} of the saved HTML` : ''}, not shown to visitors: ${what}. Links to ${b.links.map((l) => l.href).join(', ')}.\nHTML: ${b.html}\nText: ${b.text.slice(0, 300)}`;
        out.push({
          checkId: this.id,
          fingerprint: `${pathOf(page.finalUrl)}|${b.links.map((l) => l.domain).sort().join(',')}`,
          title: `Hidden ${b.language ? 'foreign-language ' : ''}text in the page code links to ${b.links[0]!.domain}`,
          pageUrl: page.finalUrl,
          viewport: page.viewport,
          where: whereOf(site, page),
          detail: { language: b.language, spamTerms: b.spamTerms, outboundLinks: b.links, htmlLine: b.line, html: b.html, text: b.text.slice(0, 600), characters: b.text.length, shownToVisitors: false },
          evidence: [
            anchor
              ? elementEvidence(page, anchor.selector, anchor.box, `${excerpt}\nThe screenshot shows the part of the page where this block sits in the code. The boxed text is the visible text just before it. The hidden text does not appear.`)
              : { kind: 'page', url: page.finalUrl, viewport: page.viewport, excerpt: `${excerpt}\nThe screenshot shows the page as a visitor sees it. The hidden text does not appear.` },
          ],
        });
      }
    }
    return out.slice(0, 3);
  },
};

export const C36_thin_homepage: Check = {
  id: 'C36_thin_homepage',
  pack: 'core',
  tier: 'measured',
  evidenceSpec: 'page',
  appliesTo: ({ site }) => !site.blocked && okHomes(site).length > 0,
  evaluate({ site }) {
    const counts = okHomes(site).map((p) => ({ viewport: p.viewport, words: (p.text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length }));
    const most = Math.max(...counts.map((c) => c.words));
    if (most >= 150) return [];
    const h = home(site)!;
    return [
      {
        checkId: this.id,
        fingerprint: 'homepage',
        title: `The homepage has ${most} visible words`,
        pageUrl: h.finalUrl,
        viewport: h.viewport,
        where: 'homepage_mobile',
        detail: { words: most, byViewport: counts, threshold: 150 },
        evidence: [{ kind: 'page', url: h.finalUrl, viewport: h.viewport, excerpt: `${most} visible words on the homepage (threshold 150). Text: ${h.text.replace(/\s+/g, ' ').slice(0, 400)}` }],
      },
    ];
  },
};

export const C60_conflicting_facts: Check = {
  id: 'C60_conflicting_facts',
  pack: 'core',
  tier: 'judgment',
  evidenceSpec: 'element',
  appliesTo: ({ site }) => !site.blocked,
  evaluate({ site }) {
    const byYear = new Map<number, { page: (typeof site.inner)[number]; hit: ReturnType<typeof foundingYears>[number] }>();
    // Only the homepage and pages about the business are read. History and blog pages talk about other people's dates.
    for (const page of pagesInOrder(site).filter((p) => whereOf(site, p) !== 'inner' || /about|story|who-we-are|our-/i.test(p.finalUrl))) {
      for (const f of foundingYears(page, site.business.name)) if (!byYear.has(f.year)) byYear.set(f.year, { page, hit: f });
    }
    if (byYear.size < 2) return [];
    const years = [...byYear.keys()].sort((a, b) => a - b);
    const sightings = years.map((y) => byYear.get(y)!);
    const first = sightings[0]!;
    return [
      {
        checkId: this.id,
        fingerprint: `founded|${years.join(',')}`,
        title: `Different starting years are given: ${years.join(', ')}`,
        pageUrl: first.page.finalUrl,
        viewport: first.page.viewport,
        where: sightings.some((s) => whereOf(site, s.page) === 'homepage_mobile') ? 'homepage_mobile' : whereOf(site, first.page),
        detail: { fact: 'founding year', values: sightings.map((s) => ({ year: s.hit.year, url: s.page.finalUrl, text: s.hit.excerpt })) },
        evidence: sightings.slice(0, 3).map((s) => elementEvidence(s.page, s.hit.block.selector, s.hit.block.box, s.hit.excerpt)),
      },
    ];
  },
};
