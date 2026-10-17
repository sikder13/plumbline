import { describe, expect, it } from 'vitest';
import { fontFaces, scopeCss } from './styles.ts';

describe('the stylesheet of a page made to order', () => {
  it('scopes every class and keyframes name to the design, and leaves :global(...) as written', () => {
    const { css, classes } = scopeCss(
      'tide',
      `/* a note */
.root { color: red; animation: rise 1s var(--ease) both; }
.root :global(.float-main) { background: #000; }
.hero > .line + .line, a.go:hover { transform: translateY(0.5rem); }
@keyframes rise { from { opacity: 0; } 50% { opacity: .5; } to { opacity: 1; } }
@media (min-width: 37.5em) { .hero { padding: 1.5rem; } }`,
    );
    expect(classes).toEqual({ root: 'tide__root', hero: 'tide__hero', line: 'tide__line', go: 'tide__go' });
    expect(css).toContain('.tide__root{ color: red; animation: tide__rise 1s var(--ease) both;');
    expect(css).toContain('.tide__root .float-main{');
    expect(css).toContain('.tide__hero > .tide__line + .tide__line, a.tide__go:hover{');
    expect(css).toContain('@keyframes tide__rise{');
    expect(css).toContain('opacity: .5;');
    expect(css).toContain('@media (min-width: 37.5em){');
    expect(css).not.toContain('a note');
  });

  it('copies urls and quoted strings as they are', () => {
    const { css, classes } = scopeCss('tide', `.mark::after { content: "a.b"; background: url(/demo/fonts/x.woff2); } [href$=".pdf"] { color: blue; }`);
    expect(classes).toEqual({ mark: 'tide__mark' });
    expect(css).toContain('content: "a.b"');
    expect(css).toContain('url(/demo/fonts/x.woff2)');
    expect(css).toContain('[href$=".pdf"]{');
  });

  it('scopes nested rules', () => {
    const { css } = scopeCss('tide', `.card { color: red; .title { font-weight: 700; } &:hover .title { color: blue; } }`);
    expect(css).toContain('.tide__card{ color: red;');
    expect(css).toContain('.tide__title{ font-weight: 700;');
    expect(css).toContain('&:hover .tide__title{');
  });

  it('refuses a name that is not one lowercase word', () => {
    expect(() => scopeCss('Tide-line', '.a{}')).toThrow('not a design name');
  });

  it('picks the @font-face rules of the families named', () => {
    const faces = `@font-face{font-family:'Fraunces';src:url(/demo/fonts/a.woff2)}\n@font-face{font-family:'Onest';src:url(/demo/fonts/b.woff2)}\n@font-face{font-family:'Fraunces';font-style:italic;src:url(/demo/fonts/c.woff2)}`;
    expect(fontFaces(faces, ['Fraunces']).split('\n')).toHaveLength(2);
    expect(fontFaces(faces, ['onest'])).toContain('b.woff2');
    expect(fontFaces(faces, ['Syne'])).toBe('');
  });
});
