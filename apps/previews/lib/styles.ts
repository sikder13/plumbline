import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fontFaces, scopeCss } from '@plumbline/preview/styles';

/**
 * The stylesheet of a page made to order, read from `designs/<design>.css` and scoped to the design, with
 * the @font-face rules of the families it sets. The page renders it inline, `<style href={design} precedence="design">`,
 * so each page carries its own styles and nothing else. `s` maps each class as written to its scoped name, as a
 * CSS module would; a client component is handed the names it needs.
 *
 * Read when the page is rendered, so in development a changed stylesheet shows on the next load.
 */
export function designStyles(design: string, families: string[]): { css: string; s: Record<string, string> } {
  const app = process.cwd();
  const { css, classes } = scopeCss(design, readFileSync(join(app, 'designs', `${design}.css`), 'utf8'));
  const faces = fontFaces(readFileSync(join(app, 'app', 'faces.css'), 'utf8'), families);
  const missing = families.filter((f) => !faces.includes(`'${f}'`));
  if (missing.length) throw new Error(`${design}: no @font-face rules for ${missing.join(', ')}. Use a family from scripts/fonts.mjs below "MADE TO ORDER".`);
  // A class the design names but its stylesheet does not would silently do nothing: it is reported instead.
  const s = new Proxy(classes, {
    get(target, key) {
      if (typeof key !== 'string' || key in target) return target[key as string];
      // Names a framework may look for on any object are answered quietly.
      if (!/^[a-zA-Z][\w-]*$/.test(key) || key === 'then' || key === 'toJSON') return undefined;
      throw new Error(`${design}: the class "${key}" is used but not in designs/${design}.css`);
    },
  });
  return { css: `${faces}\n${css}`, s };
}
