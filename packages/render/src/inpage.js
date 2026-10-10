// Runs inside the audited page. Plain browser JavaScript, loaded as text and
// evaluated by the renderer. Everything here answers one question: what can a
// visitor actually see?
(() => {
  if (window.__plumb) return;

  const NEVER = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'META', 'LINK', 'TITLE', 'DATALIST', 'OPTION']);
  const MIN_OPACITY = 0.05;
  const revealed = new WeakSet();
  let generation = 0;
  let chainCache = new WeakMap();
  let clipCache = new WeakMap();

  function reset() {
    chainCache = new WeakMap();
    clipCache = new WeakMap();
    generation += 1;
  }

  function rootClips(axis) {
    const html = getComputedStyle(document.documentElement);
    const body = document.body ? getComputedStyle(document.body) : null;
    const v = axis === 'x' ? [html.overflowX, body && body.overflowX] : [html.overflowY, body && body.overflowY];
    return v.some((o) => o === 'hidden' || o === 'clip');
  }

  // The area a visitor can reach by scrolling, in viewport coordinates at the current scroll position.
  function scrollArea() {
    const d = document.documentElement;
    const b = document.body;
    const fullW = Math.max(d.scrollWidth, b ? b.scrollWidth : 0, d.clientWidth);
    const fullH = Math.max(d.scrollHeight, b ? b.scrollHeight : 0, d.clientHeight);
    const w = rootClips('x') ? d.clientWidth : fullW;
    const h = rootClips('y') ? window.innerHeight : fullH;
    return { left: -window.scrollX, top: -window.scrollY, right: w - window.scrollX, bottom: h - window.scrollY, docW: w, docH: h };
  }

  function clipIsTiny(clip) {
    if (!clip || clip === 'auto') return false;
    const n = (clip.match(/-?\d+(\.\d+)?/g) || []).map(Number);
    if (n.length < 4) return false;
    return n[1] - n[3] <= 1 || n[2] - n[0] <= 1;
  }

  function clipPathHides(cp) {
    if (!cp || cp === 'none') return false;
    if (/inset\(\s*(50|100)%/.test(cp)) return true;
    if (/^(circle|ellipse)\(\s*0(px|%)?[\s)]/.test(cp)) return true;
    if (/^polygon\(\s*0(px|%)? 0(px|%)?,\s*0(px|%)? 0(px|%)?,\s*0(px|%)? 0(px|%)?/.test(cp)) return true;
    return false;
  }

  // Why this element, taken on its own, hides itself and everything inside it. Null when it does not.
  function selfHidden(el, cs) {
    if (NEVER.has(el.tagName)) return 'tag';
    if (el.getAttribute('aria-hidden') === 'true') return 'aria-hidden';
    if (cs.display === 'none') return 'display';
    const parent = el.parentElement;
    if (parent && parent.tagName === 'DETAILS' && !parent.open && !(el.tagName === 'SUMMARY' && parent.querySelector('summary') === el)) return 'details-closed';
    if (cs.contentVisibility === 'hidden') return 'content-visibility';
    if (parseFloat(cs.opacity) <= MIN_OPACITY && !revealed.has(el)) return 'opacity';
    if ((cs.position === 'absolute' || cs.position === 'fixed') && clipIsTiny(cs.clip)) return 'sr-only';
    if (clipPathHides(cs.clipPath)) return 'sr-only';
    const clipsBoth = (cs.overflowX === 'hidden' || cs.overflowX === 'clip') && (cs.overflowY === 'hidden' || cs.overflowY === 'clip');
    if (clipsBoth && cs.display !== 'inline') {
      const w = parseFloat(cs.width);
      const h = parseFloat(cs.height);
      if ((w <= 1 && !Number.isNaN(w)) || (h <= 1 && !Number.isNaN(h))) return 'sr-only';
    }
    return null;
  }

  function chainHidden(el) {
    if (!el || el.nodeType !== 1) return null;
    if (chainCache.has(el)) return chainCache.get(el);
    const cs = getComputedStyle(el);
    let reason = selfHidden(el, cs);
    if (!reason) {
      const parent = el.parentElement || (el.getRootNode() && el.getRootNode().host) || null;
      reason = parent ? chainHidden(parent) : null;
    }
    chainCache.set(el, reason);
    return reason;
  }

  function intersect(a, b) {
    return { left: Math.max(a.left, b.left), top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) };
  }

  const EVERYTHING = { left: -1e9, top: -1e9, right: 1e9, bottom: 1e9 };

  // The rectangle that overflow-clipping ancestors leave for this element's contents.
  function clipFor(el) {
    if (!el || el === document.documentElement || el === document.body) return EVERYTHING;
    if (clipCache.has(el)) return clipCache.get(el);
    const cs = getComputedStyle(el);
    let result;
    if (cs.position === 'fixed') {
      result = EVERYTHING;
    } else {
      let parent = el.parentElement;
      if (cs.position === 'absolute') {
        // Only the containing block and what lies above it can clip an absolutely positioned box.
        while (parent && parent !== document.body && parent !== document.documentElement) {
          const ps = getComputedStyle(parent);
          if (ps.position !== 'static' || ps.transform !== 'none' || ps.contain === 'paint' || ps.filter !== 'none') break;
          parent = parent.parentElement;
        }
      }
      result = parent ? ownClip(parent) : EVERYTHING;
    }
    clipCache.set(el, result);
    return result;
  }

  const ownClipCache = new WeakMap();
  // The clip an element applies to its children, combined with what its own ancestors allow.
  function ownClip(el) {
    if (!el || el === document.documentElement || el === document.body) return EVERYTHING;
    const cached = ownClipCache.get(el);
    if (cached && cached.gen === generation) return cached.rect;
    let rect = clipFor(el);
    const cs = getComputedStyle(el);
    const cx = cs.overflowX === 'hidden' || cs.overflowX === 'clip';
    const cy = cs.overflowY === 'hidden' || cs.overflowY === 'clip';
    if ((cx || cy) && cs.display !== 'inline' && cs.display !== 'contents') {
      const r = el.getBoundingClientRect();
      rect = intersect(rect, { left: cx ? r.left : -1e9, right: cx ? r.right : 1e9, top: cy ? r.top : -1e9, bottom: cy ? r.bottom : 1e9 });
    }
    ownClipCache.set(el, { gen: generation, rect });
    return rect;
  }

  function visiblePart(rect, el) {
    const area = scrollArea();
    let r = intersect({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }, area);
    r = intersect(r, clipFor(el));
    return r.right - r.left > 1 && r.bottom - r.top > 1 ? r : null;
  }

  function elementRect(el) {
    let r = el.getBoundingClientRect();
    if (r.width > 1 && r.height > 1) return r;
    // An anchor wrapping floated or absolutely placed children can have an empty box of its own.
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    let n = 0;
    for (const child of el.querySelectorAll('*')) {
      if (n++ > 40) break;
      const c = child.getBoundingClientRect();
      if (c.width <= 1 || c.height <= 1) continue;
      left = Math.min(left, c.left);
      top = Math.min(top, c.top);
      right = Math.max(right, c.right);
      bottom = Math.max(bottom, c.bottom);
    }
    if (right > left) r = { left, top, right, bottom, width: right - left, height: bottom - top };
    return r;
  }

  // Null when hidden, otherwise the visible rectangle in viewport coordinates.
  function visibleRect(el) {
    if (!el || el.nodeType !== 1 || !el.isConnected) return null;
    if (chainHidden(el)) return null;
    const cs = getComputedStyle(el);
    if (cs.visibility !== 'visible') return null;
    const r = elementRect(el);
    if (!(r.width > 1 && r.height > 1)) return null;
    return visiblePart(r, el);
  }

  function isVisible(el) {
    return visibleRect(el) !== null;
  }

  function whyHidden(el) {
    if (!el || el.nodeType !== 1) return 'not-an-element';
    const chain = chainHidden(el);
    if (chain) return chain;
    if (getComputedStyle(el).visibility !== 'visible') return 'visibility';
    const r = elementRect(el);
    if (!(r.width > 1 && r.height > 1)) return 'size';
    const a = scrollArea();
    const inArea = intersect({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }, a);
    if (!(inArea.right - inArea.left > 1 && inArea.bottom - inArea.top > 1)) return 'outside-scroll-area';
    return visiblePart(r, el) ? null : 'clipped';
  }

  // Visible rectangles of a text node, or an empty list.
  function textRects(node) {
    const parent = node.parentElement;
    if (!parent || chainHidden(parent)) return [];
    const cs = getComputedStyle(parent);
    if (cs.visibility !== 'visible') return [];
    if (parseFloat(cs.fontSize) < 1) return [];
    const range = document.createRange();
    range.selectNodeContents(node);
    const out = [];
    for (const r of range.getClientRects()) {
      if (!(r.width > 1 && r.height > 1)) continue;
      const v = visiblePart(r, parent);
      if (v) out.push(v);
    }
    return out;
  }

  function toDoc(r) {
    return {
      x: Math.round(r.left + window.scrollX),
      y: Math.round(r.top + window.scrollY),
      w: Math.round(r.right - r.left),
      h: Math.round(r.bottom - r.top),
    };
  }

  function union(rects) {
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const r of rects) {
      left = Math.min(left, r.left);
      top = Math.min(top, r.top);
      right = Math.max(right, r.right);
      bottom = Math.max(bottom, r.bottom);
    }
    return { left, top, right, bottom };
  }

  function selectorFor(el) {
    if (!el || el.nodeType !== 1) return '';
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== document.documentElement && parts.length < 8) {
      let part = node.tagName.toLowerCase();
      if (node.id && /^[A-Za-z][\w-]*$/.test(node.id) && document.querySelectorAll(`#${CSS.escape(node.id)}`).length === 1) {
        parts.unshift(`#${node.id}`);
        break;
      }
      const parent = node.parentElement;
      if (parent) {
        const same = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
        if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`;
      }
      parts.unshift(part);
      node = parent;
    }
    return parts.join(' > ');
  }

  function blockAncestor(el) {
    let node = el;
    while (node && node !== document.body) {
      const d = getComputedStyle(node).display;
      if (!d.startsWith('inline') && d !== 'contents') return node;
      node = node.parentElement;
    }
    return document.body;
  }

  function regionOf(el) {
    return {
      inHeader: !!el.closest('header, [role="banner"]'),
      inNav: !!el.closest('nav, [role="navigation"], [class*="menu" i], [class*="navbar" i], [id*="menu" i]'),
      inFooter: !!el.closest('footer, [role="contentinfo"], [class*="footer" i], [id*="footer" i]'),
    };
  }

  // Visible text grouped by block, in document order.
  function blocks() {
    const map = new Map();
    const order = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        if (node.nodeType === 1) {
          if (NEVER.has(node.tagName)) return NodeFilter.FILTER_REJECT;
          return node.tagName === 'BR' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
        return /\S/.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    });
    let lastBlock = null;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeType === 1) {
        if (lastBlock && map.has(lastBlock)) map.get(lastBlock).parts.push('\n');
        continue;
      }
      const rects = textRects(node);
      if (!rects.length) continue;
      const parent = node.parentElement;
      const block = blockAncestor(parent);
      let entry = map.get(block);
      if (!entry) {
        entry = { el: block, parts: [], rects: [], fontSize: parseFloat(getComputedStyle(parent).fontSize), first: parent };
        map.set(block, entry);
        order.push(entry);
      }
      entry.parts.push(node.nodeValue);
      entry.rects.push(...rects);
      lastBlock = block;
    }
    return order
      .map((e) => {
        const text = e.parts
          .join(' ')
          .replace(/[^\S\n]+/g, ' ')
          .replace(/ ?\n ?/g, '\n')
          .trim();
        const heading = e.first.closest('h1, h2, h3, h4, h5, h6');
        const link = e.first.closest('a[href]');
        return {
          text,
          tag: e.el.tagName.toLowerCase(),
          heading: heading ? heading.tagName.toLowerCase() : null,
          selector: selectorFor(e.el),
          box: toDoc(union(e.rects)),
          fontSize: e.fontSize,
          href: link ? link.href : null,
          ...regionOf(e.el),
        };
      })
      .filter((b) => b.text);
  }

  function visibleTextOf(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const parts = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (/\S/.test(n.nodeValue) && textRects(n).length) parts.push(n.nodeValue);
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  function inFold(rect) {
    const top = Math.max(rect.top, 0);
    const bottom = Math.min(rect.bottom, window.innerHeight);
    const left = Math.max(rect.left, 0);
    const right = Math.min(rect.right, window.innerWidth);
    const h = rect.bottom - rect.top;
    return right - left > 1 && bottom - top >= Math.min(h * 0.5, 20) && bottom - top > 1;
  }

  function links() {
    const out = [];
    for (const a of document.querySelectorAll('a[href], area[href]')) {
      const raw = a.getAttribute('href');
      const rect = visibleRect(a);
      const img = a.querySelector('img[alt]');
      const text = visibleTextOf(a) || (rect && (a.getAttribute('aria-label') || a.getAttribute('title') || (img && isVisible(img) ? img.getAttribute('alt') : '') || '')) || '';
      let href;
      try {
        href = a.href;
      } catch (_e) {
        href = '';
      }
      out.push({
        raw: raw === null ? '' : raw,
        href: typeof href === 'string' ? href : '',
        text: text.trim().slice(0, 200),
        visible: !!rect,
        fold: !!rect && inFold(rect),
        box: rect ? toDoc(rect) : null,
        selector: selectorFor(a),
        target: a.getAttribute('target') || '',
        hasHandler: !!a.onclick || a.hasAttribute('onclick') || a.getAttribute('role') === 'button' || a.hasAttribute('data-toggle') || a.hasAttribute('data-bs-toggle') || a.hasAttribute('aria-haspopup') || a.hasAttribute('aria-expanded'),
        ...regionOf(a),
      });
    }
    return out;
  }

  function controls() {
    const out = [];
    for (const el of document.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"], iframe, form')) {
      const rect = visibleRect(el);
      if (!rect) continue;
      const tag = el.tagName.toLowerCase();
      out.push({
        tag,
        text: (tag === 'input' ? el.value : visibleTextOf(el) || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim().slice(0, 200),
        src: tag === 'iframe' ? el.src || '' : '',
        action: tag === 'form' ? el.getAttribute('action') || '' : '',
        fields: tag === 'form' ? el.querySelectorAll('input:not([type="hidden"]), textarea, select').length : 0,
        hasEmailField: tag === 'form' ? !!el.querySelector('input[type="email"], input[name*="email" i], textarea') : false,
        fold: inFold(rect),
        box: toDoc(rect),
        selector: selectorFor(el),
      });
    }
    return out;
  }

  function images() {
    const out = [];
    for (const img of document.querySelectorAll('img')) {
      const rect = visibleRect(img);
      const r = img.getBoundingClientRect();
      out.push({
        src: img.getAttribute('src') || '',
        currentSrc: img.currentSrc || '',
        alt: img.getAttribute('alt'),
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        complete: img.complete,
        width: Math.round(r.width),
        height: Math.round(r.height),
        visible: !!rect,
        box: rect ? toDoc(rect) : null,
        selector: selectorFor(img),
        loading: img.getAttribute('loading') || '',
        lazyAttr: ['data-src', 'data-lazy-src', 'data-original', 'data-srcset', 'data-lazy'].some((a) => img.hasAttribute(a)),
        ...regionOf(img),
      });
    }
    return out;
  }

  function meta() {
    const pick = (sel, attr) => {
      const el = document.querySelector(sel);
      return el ? (el.getAttribute(attr) || '').trim() : null;
    };
    const og = {};
    for (const m of document.querySelectorAll('meta[property^="og:"]')) og[m.getAttribute('property')] = m.getAttribute('content') || '';
    const hreflangs = Array.from(document.querySelectorAll('link[rel="alternate"][hreflang]')).map((l) => l.getAttribute('hreflang'));
    return {
      title: document.title || '',
      description: pick('meta[name="description" i]', 'content'),
      canonical: pick('link[rel="canonical"]', 'href'),
      robots: pick('meta[name="robots" i]', 'content'),
      viewport: pick('meta[name="viewport" i]', 'content'),
      generator: Array.from(document.querySelectorAll('meta[name="generator" i]')).map((m) => m.getAttribute('content') || ''),
      lang: document.documentElement.getAttribute('lang') || '',
      og,
      hreflangs,
      h1: Array.from(document.querySelectorAll('h1')).filter(isVisible).map((h) => visibleTextOf(h)),
      h1Total: document.querySelectorAll('h1').length,
      jsonld: Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map((s) => s.textContent || ''),
      scripts: Array.from(document.querySelectorAll('script[src]')).map((s) => s.src).slice(0, 300),
      stylesheets: Array.from(document.querySelectorAll('link[rel~="stylesheet"][href]')).map((s) => s.href).slice(0, 200),
      iframes: Array.from(document.querySelectorAll('iframe[src]')).map((s) => s.src).slice(0, 100),
    };
  }

  function layout() {
    const d = document.documentElement;
    const b = document.body;
    const fullW = Math.max(d.scrollWidth, b ? b.scrollWidth : 0);
    const area = scrollArea();
    // A phone widens its layout to fit content that overflows, so the device width is the real limit.
    const deviceWidth = Math.min(window.innerWidth, screen.width || window.innerWidth);
    const overflows = !rootClips('x') && fullW > deviceWidth + 4;
    const wide = [];
    if (overflows) {
      for (const el of document.querySelectorAll('body *')) {
        if (wide.length >= 5) break;
        const r = el.getBoundingClientRect();
        if (r.right + window.scrollX > deviceWidth + 4 && r.width > 1 && r.height > 1 && isVisible(el)) {
          const kids = Array.from(el.children).some((c) => c.getBoundingClientRect().right + window.scrollX > deviceWidth + 4);
          if (!kids) wide.push({ selector: selectorFor(el), box: toDoc(r), right: Math.round(r.right + window.scrollX) });
        }
      }
    }
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      deviceWidth,
      scrollWidth: fullW,
      docW: area.docW,
      docH: area.docH,
      horizontalScroll: overflows,
      wide,
    };
  }

  // Elements holding content that are transparent right now. Scroll-reveal effects leave them like this
  // once they are off screen, so the renderer scrolls past them again and calls markRevealed.
  function transparentCandidates() {
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      if (NEVER.has(el.tagName)) continue;
      if (revealed.has(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || parseFloat(cs.opacity) > MIN_OPACITY) continue;
      if (!el.textContent.trim() && !el.querySelector('img, a, button')) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 1 && r.height > 1) out.push(el);
    }
    return out;
  }

  let pendingReveal = [];
  function startReveal() {
    pendingReveal = transparentCandidates();
    return pendingReveal.length;
  }
  function stepReveal() {
    let found = 0;
    for (const el of pendingReveal) {
      if (revealed.has(el)) continue;
      const r = el.getBoundingClientRect();
      const onScreen = r.bottom > 0 && r.top < window.innerHeight;
      if (onScreen && parseFloat(getComputedStyle(el).opacity) > MIN_OPACITY) {
        revealed.add(el);
        found += 1;
      }
    }
    return found;
  }

  function collect() {
    reset();
    const b = blocks();
    return {
      blocks: b,
      text: b.map((x) => x.text).join('\n'),
      links: links(),
      controls: controls(),
      images: images(),
      meta: meta(),
      layout: layout(),
    };
  }

  window.__plumb = { isVisible, whyHidden, visibleRect, visibleTextOf, selectorFor, blocks, links, controls, images, meta, layout, collect, startReveal, stepReveal, reset, toDoc };
})();
