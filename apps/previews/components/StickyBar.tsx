/** The bar pinned to the bottom of a phone screen: the main action and Call. Each design colours it. */
export function StickyBar({ main, call, className }: { main: { label: string; href: string; external?: boolean }; call: { label: string; tel: string }; className?: string }) {
  return (
    <nav className={`sticky-bar ${className ?? ''}`} aria-label="Book or call">
      <a className="sticky-main" href={main.href} rel={main.external ? 'noopener' : undefined}>
        {main.label}
      </a>
      <a className="sticky-call" href={call.tel}>
        {call.label}
      </a>
    </nav>
  );
}
