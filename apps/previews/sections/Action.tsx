import type { Recipe } from '@plumbline/preview/types';

/**
 * The one action a page asks for, floating at the foot of a phone screen once the opening photograph
 * has gone by, on glass, with Call beside it.
 * `pill` is a pill with a round Call beside it; `dock` joins the two as one piece of glass; `stack`
 * sets Call above the action at the right edge.
 */
export function Action({ recipe }: { recipe: Recipe }) {
  const a = recipe.action;
  return (
    <nav className="float-bar" data-variant={a.variant} aria-label="Book or call">
      <a className="float-main" data-press href={a.href} rel="noopener">
        {a.label}
      </a>
      <a className="float-call" data-press href={recipe.call.tel} aria-label={`Call ${recipe.call.display}`}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
          <path d="M6.6 3.5h3l1.5 4.2-2 1.5a12 12 0 0 0 5.7 5.7l1.5-2 4.2 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      </a>
    </nav>
  );
}
