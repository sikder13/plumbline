import type { CSSProperties, ReactNode } from 'react';
import type { PageData, Picture } from '@/lib/data';
import type { Recipe } from '@plumbline/preview/types';
import s from './sections.module.css';

/** What every section is handed: the page's data and the recipe it belongs to. */
export interface Ctx {
  data: PageData;
  recipe: Recipe;
}

/**
 * A headline that rises line by line from behind a mask as the page loads. It is done in CSS, so it
 * runs before any script arrives, and a reader is given the whole sentence at once.
 */
export function Lines({ lines, as: Tag = 'h1', className }: { lines: string[]; as?: 'h1' | 'h2'; className?: string }) {
  return (
    <Tag className={className} aria-label={lines.join(' ')}>
      {lines.map((l, i) => (
        <span key={`${i}-${l}`} className={s.line} aria-hidden="true">
          <span style={{ '--i': i } as CSSProperties}>{l}</span>
        </span>
      ))}
    </Tag>
  );
}

/** The page's one action as a button. Outside addresses open in the same tab, as their own site does. */
export function ActionLink({ recipe, className, children, tone = 'accent' }: { recipe: Recipe; className?: string; children?: ReactNode; tone?: 'accent' | 'light' | 'ink' | 'line' }) {
  return (
    <a className={`${s.button} ${className ?? ''}`} data-tone={tone} data-press data-magnetic href={recipe.action.href} rel="noopener">
      {children ?? recipe.action.label}
    </a>
  );
}

/** A section heading, with the small numbered tag some variants carry above it. */
export function Head({ id, heading, lead, tag, className }: { id: string; heading: string; lead?: string; tag?: string; className?: string }) {
  return (
    <header className={`${s.head} ${className ?? ''}`}>
      {tag && <p className={s.tag}>{tag}</p>}
      <h2 id={id}>{heading}</h2>
      {lead && <p className={s.lead}>{lead}</p>}
    </header>
  );
}

/** A price is shown as it is written on their site, and counts up once when it comes into view. */
export function Price({ value, className }: { value: string; className?: string }) {
  return (
    <b className={className} data-count>
      {value}
    </b>
  );
}

export const two = (n: number) => String(n).padStart(2, '0');

/**
 * The width a photograph is really drawn at on a phone when it fills a slot of another shape. A
 * wide photograph covering a tall slot is drawn much wider than the slot, and a browser told only
 * the slot's width would fetch a file too small and stretch it. `vw` is the slot's width on a
 * phone and `shape` its width over its height there.
 */
export function coverSizes(p: Picture, phone: { vw: number; shape: number }, desktop: string): string {
  const grow = Math.max(1, p.width / p.height / phone.shape);
  return `(min-width: 900px) ${desktop}, ${Math.ceil(phone.vw * grow)}vw`;
}
