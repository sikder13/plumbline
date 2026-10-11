// Runs inside the audited homepage after the visibility helper is in place.
// Reads the brand as a visitor sees it: logo, colours, fonts and large images.
(() => {
  const P = window.__plumb;
  const rgbToHex = (c) => {
    const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+%?))?\s*\)/.exec(c || '');
    if (!m) return null;
    let alpha = m[4] === undefined ? 1 : parseFloat(m[4]);
    if (m[4] && m[4].endsWith('%')) alpha /= 100;
    if (alpha < 0.5) return null;
    return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
  };

  function logo() {
    const origin = location.origin;
    const isHomeLink = (a) => {
      if (!a) return false;
      const href = a.getAttribute('href') || '';
      return href === '/' || href === '' || a.href === `${origin}/` || a.href === origin || a.href === location.href.split('#')[0];
    };
    const named = (el) => {
      const hay = [el.getAttribute('src'), el.getAttribute('alt'), el.getAttribute('class'), el.id, el.getAttribute('data-src')];
      let node = el.parentElement;
      for (let i = 0; node && i < 3; i++, node = node.parentElement) hay.push(node.getAttribute('class'), node.id);
      return /logo|brand/i.test(hay.filter(Boolean).join(' '));
    };
    const describe = (el) => {
      const r = P.visibleRect(el);
      if (!r) return null;
      if (el.tagName.toLowerCase() === 'svg') {
        const markup = el.outerHTML;
        return markup.length < 200000 ? { type: 'svg', src: '', markup, alt: el.getAttribute('aria-label') || '', box: P.toDoc(r) } : null;
      }
      const src = el.currentSrc || el.src;
      return src ? { type: 'img', src, markup: '', alt: el.getAttribute('alt') || '', box: P.toDoc(r) } : null;
    };
    const header = document.querySelector('header, [role="banner"], #header, .header, [class*="site-header" i], nav');
    const inHeader = header ? Array.from(header.querySelectorAll('img, svg')) : [];
    for (const el of inHeader) if (named(el)) { const d = describe(el); if (d) return d; }
    for (const el of document.querySelectorAll('img, svg')) {
      const r = el.getBoundingClientRect();
      if (r.top + window.scrollY > 400) continue;
      if (named(el)) { const d = describe(el); if (d) return d; }
    }
    for (const el of inHeader) if (isHomeLink(el.closest('a'))) { const d = describe(el); if (d) return d; }
    return null;
  }

  function colours() {
    const tally = new Map();
    const add = (hex, role, area) => {
      if (!hex || !(area > 0)) return;
      const e = tally.get(hex) || { hex, area: 0, roles: {} };
      e.area += area;
      e.roles[role] = (e.roles[role] || 0) + area;
      tally.set(hex, e);
    };
    const layout = P.layout();
    const pageArea = Math.max(1, layout.docW * layout.docH);
    add(rgbToHex(getComputedStyle(document.body).backgroundColor) || rgbToHex(getComputedStyle(document.documentElement).backgroundColor) || '#ffffff', 'background', pageArea * 0.25);
    let n = 0;
    for (const el of document.querySelectorAll('body *')) {
      if (n++ > 6000) break;
      const r = P.visibleRect(el);
      if (!r) continue;
      const area = (r.right - r.left) * (r.bottom - r.top);
      const cs = getComputedStyle(el);
      const tag = el.tagName.toLowerCase();
      const isButton = tag === 'button' || el.getAttribute('role') === 'button' || (tag === 'a' && /\b(btn|button|cta)\b/i.test(el.className || '')) || (tag === 'input' && /submit|button/.test(el.type));
      const bg = rgbToHex(cs.backgroundColor);
      if (bg) add(bg, isButton ? 'button' : 'background', area);
      const hasOwnText = Array.from(el.childNodes).some((c) => c.nodeType === 3 && /\S/.test(c.nodeValue));
      if (hasOwnText) {
        const fg = rgbToHex(cs.color);
        const role = tag === 'a' || el.closest('a') ? 'accent' : /^h[1-6]$/.test(tag) || el.closest('h1,h2,h3,h4,h5,h6') ? 'heading' : 'text';
        add(fg, role, area * 0.35);
      }
    }
    const all = [...tally.values()].sort((a, b) => b.area - a.area);
    const total = all.reduce((s, e) => s + e.area, 0) || 1;
    const plain = (hex) => hex === '#ffffff' || hex === '#000000';
    const kept = all.filter((e) => !plain(e.hex) || e.area / total > 0.3).slice(0, 6);
    return kept.map((e) => {
      const role = Object.entries(e.roles).sort((a, b) => b[1] - a[1])[0][0];
      return { hex: e.hex, role: role === 'heading' ? 'accent' : role, share: Math.round((e.area / total) * 1000) / 1000 };
    });
  }

  function fonts() {
    const fam = (el) => (el ? getComputedStyle(el).fontFamily : null);
    const firstVisible = (sel) => Array.from(document.querySelectorAll(sel)).find((e) => P.isVisible(e)) || null;
    const body = fam(firstVisible('main p, article p, p') || document.body);
    const headings = fam(firstVisible('h1') || firstVisible('h2') || firstVisible('h3'));
    const buttons = fam(firstVisible('button, a[class*="btn" i], a[class*="button" i], input[type="submit"]'));
    const loaded = new Set();
    try {
      for (const f of document.fonts) if (f.status === 'loaded') loaded.add(f.family.replace(/["']/g, ''));
    } catch (_e) {
      // Some pages lock down the font set. The resource list below still applies.
    }
    const sources = new Set();
    for (const e of performance.getEntriesByType('resource')) {
      if (!/\.(woff2?|ttf|otf|eot)(\?|$)/i.test(e.name) && e.initiatorType !== 'font' && !/fonts\.(googleapis|gstatic)\.com|typekit\.net/.test(e.name)) continue;
      let host;
      try {
        host = new URL(e.name).hostname;
      } catch (_e) {
        continue;
      }
      if (/fonts\.(googleapis|gstatic)\.com$/.test(host)) sources.add('Google Fonts');
      else if (/typekit\.net$/.test(host)) sources.add('Typekit');
      else if (host === location.hostname) sources.add('self-hosted');
      else sources.add(host);
    }
    return { body, headings, buttons, webFonts: [...loaded].slice(0, 12), sources: [...sources] };
  }

  function pictures() {
    const out = [];
    for (const img of document.querySelectorAll('img')) {
      const r = P.visibleRect(img);
      if (!r) continue;
      const src = img.currentSrc || img.src;
      if (!src || src.startsWith('data:') || img.naturalWidth < 600) continue;
      out.push({ url: src, alt: img.getAttribute('alt') || '', width: img.naturalWidth, height: img.naturalHeight, top: Math.round(r.top + window.scrollY), shown: Math.round((r.right - r.left) * (r.bottom - r.top)), background: false });
    }
    // A hero is often a background image on a large block near the top.
    let n = 0;
    for (const el of document.querySelectorAll('body *')) {
      if (n++ > 3000) break;
      const bg = getComputedStyle(el).backgroundImage;
      if (!bg || bg === 'none' || !bg.includes('url(')) continue;
      const r = P.visibleRect(el);
      if (!r || r.right - r.left < 600 || r.bottom - r.top < 200) continue;
      const m = /url\(["']?([^"')]+)["']?\)/.exec(bg);
      if (!m || m[1].startsWith('data:')) continue;
      let url;
      try {
        url = new URL(m[1], location.href).href;
      } catch (_e) {
        continue;
      }
      out.push({ url, alt: el.getAttribute('aria-label') || '', width: Math.round(r.right - r.left), height: Math.round(r.bottom - r.top), top: Math.round(r.top + window.scrollY), shown: Math.round((r.right - r.left) * (r.bottom - r.top)), background: true });
    }
    const seen = new Set();
    const unique = out.filter((p) => (seen.has(p.url) ? false : (seen.add(p.url), true)));
    const heroPool = unique.filter((p) => p.top < window.innerHeight * 1.2).sort((a, b) => b.shown - a.shown);
    const hero = heroPool[0] || null;
    const others = unique.filter((p) => p !== hero).sort((a, b) => a.top - b.top).slice(0, 10);
    return { hero, others };
  }

  return { logo: logo(), colours: colours(), fonts: fonts(), pictures: pictures() };
})();
