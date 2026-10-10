import type { CandidateFinding } from '@plumbline/core';
import { contactLinkProblems, isBrokenStatus } from '@plumbline/collect';
import type { PageCapture, PageLink } from '@plumbline/render';
import { common, elementEvidence, okHomes, pagesInOrder, pathOf, plural, whereOf } from '../../helpers.ts';
import type { Check } from '../../types.ts';

interface BrokenImage {
  src: string;
  status: number | string;
}

export const C06_broken_images: Check = {
  id: 'C06_broken_images',
  pack: 'core',
  tier: 'measured',
  evidenceSpec: 'element',
  appliesTo: ({ site }) => !site.blocked && okHomes(site).length === 2,
  evaluate({ site }) {
    // Broken means the browser finished with the image and got nothing, and the server said why.
    const brokenOn = (page: NonNullable<typeof site.homepage.mobile>) => {
      const out = new Map<string, { status: number | string; img: (typeof page.images)[number] }>();
      for (const img of page.images) {
        if (!img.visible || img.width < 40 || img.height < 40 || !img.complete || img.naturalWidth !== 0) continue;
        const src = img.currentSrc || (img.src ? new URL(img.src, page.finalUrl).href : '');
        if (!src || src.startsWith('data:')) continue;
        const bad = page.badResponses.find((r) => r.url === src);
        const failed = page.failedRequests.find((r) => r.url === src);
        if (!bad && !failed) continue;
        out.set(src, { status: bad ? bad.status : failed!.error, img });
      }
      return out;
    };
    const mobile = brokenOn(site.homepage.mobile!);
    const desktop = brokenOn(site.homepage.desktop!);
    const both = [...mobile.entries()].filter(([src]) => desktop.has(src));
    if (!both.length) return [];
    const page = site.homepage.mobile!;
    const images: BrokenImage[] = both.map(([src, v]) => ({ src, status: v.status }));
    return [
      {
        checkId: this.id,
        fingerprint: 'homepage',
        title: `${plural(images.length, 'image')} on the homepage ${images.length === 1 ? 'fails' : 'fail'} to load`,
        pageUrl: page.finalUrl,
        viewport: 'mobile',
        where: 'homepage_mobile',
        detail: { images },
        evidence: both.slice(0, 3).map(([src, v]) => elementEvidence(page, v.img.selector, v.img.box, `Image ${src} returned ${v.status}`)),
      },
    ];
  },
  merge(a, b) {
    const images = common(a.images as BrokenImage[], b.images as BrokenImage[], (i) => i.src);
    return images.length ? { ...b, images } : null;
  },
};

export const C10_broken_contact_links: Check = {
  id: 'C10_broken_contact_links',
  pack: 'core',
  tier: 'measured',
  evidenceSpec: 'element',
  appliesTo: ({ site }) => !site.blocked,
  evaluate({ site }) {
    const out: CandidateFinding[] = [];
    const seen = new Set<string>();
    for (const page of pagesInOrder(site)) {
      for (const p of contactLinkProblems(page)) {
        // The same broken address behind several links is one problem. An empty address is told apart by its label.
        const fp = `${p.kind}|${p.link.raw.slice(0, 100)}${p.link.raw.trim().length <= 1 ? `|${p.link.text.slice(0, 40)}` : ''}`;
        if (seen.has(fp)) continue;
        seen.add(fp);
        out.push({
          checkId: this.id,
          fingerprint: fp,
          title: { mailto: 'The email link is broken', tel: 'The phone link is broken', whatsapp: 'The WhatsApp link is broken', messenger: 'The Messenger link is broken', scheme: 'A contact link has a malformed address' }[p.kind],
          pageUrl: page.finalUrl,
          viewport: page.viewport,
          where: whereOf(site, page),
          detail: { kind: p.kind, href: p.link.raw, linkText: p.link.text, problem: p.problem },
          evidence: [elementEvidence(page, p.link.selector, p.link.box, `${p.problem} Link text: "${p.link.text}". href="${p.link.raw}"`)],
        });
      }
    }
    return out.slice(0, 4);
  },
};

/** Buttons that open or close a menu, and language switches. They are controls, not menu items. */
const TOGGLE = /^(menu|show menu|hide menu|open menu|close menu|close|open|toggle( navigation| menu)?|navigation|search|skip to (main )?content|back to top|top|more options|english|en|nz|☰|×|x)$/i;

interface DeadNav {
  text: string;
  href: string;
  reason: string;
}

export const C11_dead_navigation: Check = {
  id: 'C11_dead_navigation',
  pack: 'core',
  tier: 'measured',
  evidenceSpec: 'element',
  appliesTo: ({ site }) => !site.blocked && okHomes(site).length > 0,
  evaluate({ site }) {
    // A phone hides the menu behind a button, so the desktop capture is read as well.
    const items = new Map<string, { item: DeadNav; link: PageLink; page: PageCapture }>();
    const status = new Map(site.links.map((l) => [l.url, l]));
    for (const page of okHomes(site)) {
      for (const link of page.links) {
        if (!link.visible || !(link.inNav || link.inHeader) || !link.text || TOGGLE.test(link.text.trim())) continue;
        const raw = link.raw.trim();
        let reason = '';
        if (raw === '#' || raw === '' || /^#!?$/.test(raw)) reason = 'links to "#"';
        else if (/^javascript:/i.test(raw)) reason = 'links to a javascript: address';
        else {
          const s = status.get(link.href.split('#')[0]!);
          if (s?.internal && isBrokenStatus(s.status)) reason = `returns ${s.status}`;
        }
        if (!reason) continue;
        const key = `${link.text.toLowerCase()}|${reason}`;
        if (!items.has(key)) items.set(key, { item: { text: link.text, href: raw, reason }, link, page });
      }
    }
    if (!items.size) return [];
    const list = [...items.values()];
    const page = list.some((x) => x.page.viewport === 'mobile') ? site.homepage.mobile! : list[0]!.page;
    return [
      {
        checkId: this.id,
        fingerprint: 'homepage',
        title: `${plural(list.length, 'menu item')} ${list.length === 1 ? 'leads' : 'lead'} nowhere: ${list.slice(0, 4).map((x) => `"${x.item.text}"`).join(', ')}`,
        pageUrl: page.finalUrl,
        viewport: page.viewport,
        where: whereOf(site, page),
        detail: { items: list.map((x) => x.item) },
        evidence: list.slice(0, 3).map((x) => elementEvidence(x.page, x.link.selector, x.link.box, `Menu item "${x.item.text}" ${x.item.reason} (href="${x.item.href}")`)),
      },
    ];
  },
  merge(a, b) {
    const items = common(a.items as DeadNav[], b.items as DeadNav[], (i) => `${i.text}|${i.reason}`);
    return items.length ? { ...b, items } : null;
  },
};

interface BrokenLink {
  url: string;
  status: number | null;
  text: string;
  foundOn: string;
}

export const C12_broken_internal_links: Check = {
  id: 'C12_broken_internal_links',
  pack: 'core',
  tier: 'measured',
  evidenceSpec: 'element',
  appliesTo: ({ site }) => !site.blocked,
  evaluate({ site }) {
    const broken = site.links.filter((l) => l.internal && isBrokenStatus(l.status));
    if (!broken.length) return [];
    const pages = pagesInOrder(site);
    const links: BrokenLink[] = broken.map((l) => ({ url: l.url, status: l.status, text: l.seen[0]?.text ?? '', foundOn: l.seen[0]?.pageUrl ?? '' }));
    const onHome = broken.some((l) => l.seen.some((s) => okHomes(site).some((h) => h.finalUrl === s.pageUrl)));
    const firstPage = pages.find((p) => p.finalUrl === broken[0]!.seen[0]?.pageUrl) ?? pages[0]!;
    return [
      {
        checkId: this.id,
        fingerprint: 'site',
        title: `${plural(links.length, 'internal link')} ${links.length === 1 ? 'ends' : 'end'} in an error page`,
        pageUrl: firstPage.finalUrl,
        viewport: firstPage.viewport,
        where: onHome ? 'homepage_mobile' : 'inner',
        detail: { links },
        evidence: broken.slice(0, 3).map((l) => {
          const s = l.seen[0]!;
          const page = pages.find((p) => p.finalUrl === s.pageUrl && p.viewport === s.viewport) ?? firstPage;
          return elementEvidence(page, s.selector, s.box, `Link "${s.text}" on ${pathOf(s.pageUrl)} goes to ${l.url}, which returns ${l.status}`);
        }),
      },
    ];
  },
  merge(a, b) {
    const links = common(a.links as BrokenLink[], b.links as BrokenLink[], (l) => l.url);
    return links.length ? { ...b, links } : null;
  },
};
