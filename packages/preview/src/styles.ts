/**
 * Scopes the stylesheet of one design made to order, the way CSS modules would: every class becomes
 * `<design>__<class>` and every keyframes name `<design>__<name>`, except what sits inside `:global(...)`.
 *
 * A page made to order carries its own stylesheet inline, so a visitor's browser fetches the styles of that
 * page only. Imported as a CSS module instead, every design's styles would travel with every page.
 */
export interface ScopedCss {
  css: string;
  /** Each class the stylesheet names, by the name it is written with, as it reads after scoping. */
  classes: Record<string, string>;
}

const CLASS = /\.(-?[_a-zA-Z][\w-]*)/g;
const KEYFRAMES = /@(?:-webkit-)?keyframes\s+(-?[_a-zA-Z][\w-]*)/g;

/** The end of a quoted string or a bracketed group that starts at `from`, so its contents are copied as they are. */
function skip(css: string, from: number): number {
  const open = css[from]!;
  if (open === '"' || open === "'") {
    let i = from + 1;
    while (i < css.length && css[i] !== open) i += css[i] === '\\' ? 2 : 1;
    return i + 1;
  }
  return from + 1;
}

function scopeSelector(selector: string, name: string, classes: Record<string, string>): string {
  let out = '';
  let i = 0;
  while (i < selector.length) {
    if (selector.startsWith(':global(', i)) {
      // Kept as written, and the wrapper dropped.
      let depth = 1;
      let j = i + ':global('.length;
      const start = j;
      while (j < selector.length && depth > 0) {
        if (selector[j] === '(') depth++;
        else if (selector[j] === ')') depth--;
        j++;
      }
      out += selector.slice(start, j - 1);
      i = j;
      continue;
    }
    const c = selector[i]!;
    if (c === '"' || c === "'") {
      const end = skip(selector, i);
      out += selector.slice(i, end);
      i = end;
      continue;
    }
    if (c === '.') {
      CLASS.lastIndex = i;
      const m = CLASS.exec(selector);
      if (m && m.index === i) {
        classes[m[1]!] = `${name}__${m[1]}`;
        out += `.${name}__${m[1]}`;
        i += m[0].length;
        continue;
      }
    }
    out += c;
    i++;
  }
  return out;
}

function scopeDeclaration(declaration: string, name: string, frames: Set<string>): string {
  const colon = declaration.indexOf(':');
  if (colon < 0) return declaration;
  const property = declaration.slice(0, colon).trim().toLowerCase();
  if (property !== 'animation' && property !== 'animation-name' && property !== '-webkit-animation' && property !== '-webkit-animation-name') return declaration;
  return declaration.slice(0, colon + 1) + declaration.slice(colon + 1).replace(/-?[_a-zA-Z][\w-]*/g, (word) => (frames.has(word) ? `${name}__${word}` : word));
}

export function scopeCss(name: string, source: string): ScopedCss {
  if (!/^[a-z][a-z0-9]*$/.test(name)) throw new Error(`"${name}" is not a design name: one lowercase word`);
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const frames = new Set([...css.matchAll(KEYFRAMES)].map((m) => m[1]!));
  const classes: Record<string, string> = {};
  let out = '';
  let buffer = '';
  // Whether the block being read holds keyframe steps (from, to, 40%) rather than selectors.
  const inFrames: boolean[] = [];
  let i = 0;
  while (i < css.length) {
    const c = css[i]!;
    if (c === '"' || c === "'") {
      const end = skip(css, i);
      buffer += css.slice(i, end);
      i = end;
      continue;
    }
    if (css.startsWith('url(', i)) {
      const end = css.indexOf(')', i);
      buffer += css.slice(i, end + 1);
      i = end + 1;
      continue;
    }
    if (c === '{') {
      const prelude = buffer.trim();
      let written: string;
      if (/^@(?:-webkit-)?keyframes\b/.test(prelude)) written = prelude.replace(KEYFRAMES, (whole, frame: string) => whole.replace(frame, `${name}__${frame}`));
      else if (prelude.startsWith('@') || inFrames[inFrames.length - 1]) written = prelude;
      else written = scopeSelector(prelude, name, classes);
      inFrames.push(/^@(?:-webkit-)?keyframes\b/.test(prelude));
      out += `${written}{`;
      buffer = '';
    } else if (c === ';' || c === '}') {
      out += scopeDeclaration(buffer, name, frames) + c;
      buffer = '';
      if (c === '}') inFrames.pop();
    } else buffer += c;
    i++;
  }
  out += buffer;
  return { css: out.replace(/\s*\n\s*/g, '\n').trim(), classes };
}

/** The @font-face rules among `css` for the families named, and nothing else. */
export function fontFaces(css: string, families: string[]): string {
  const wanted = new Set(families.map((f) => f.toLowerCase()));
  return (css.match(/@font-face\s*\{[^}]*\}/g) ?? []).filter((rule) => wanted.has(/font-family:\s*'([^']+)'/.exec(rule)?.[1]?.toLowerCase() ?? '')).join('\n');
}
