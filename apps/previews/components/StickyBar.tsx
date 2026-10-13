/**
 * The one action a page asks for, floating at the bottom of a phone screen once the opening photo
 * has scrolled away, with Call as a round button beside it. Each design colours it.
 */
export function StickyBar({ main, call }: { main: { label: string; href: string; external?: boolean }; call: { label: string; tel: string } }) {
  return (
    <nav className="float-bar" aria-label="Book or call">
      <a className="float-main" data-press href={main.href} rel={main.external ? 'noopener' : undefined}>
        {main.label}
      </a>
      <a className="float-call" data-press href={call.tel} aria-label={call.label}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
          <path d="M6.6 3.5h3l1.5 4.2-2 1.5a12 12 0 0 0 5.7 5.7l1.5-2 4.2 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      </a>
    </nav>
  );
}
