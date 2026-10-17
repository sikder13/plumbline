import type { CSSProperties, ReactNode } from 'react';
import type { EngineDemo } from '@plumbline/preview/engine';
import { Pic } from '@/components/Pic';
import type { PageData, Picture } from '@/lib/data';

/** Class names of an engine's scoped stylesheet, as written. */
export type Cls = Record<string, string>;

export interface Action {
  href: string;
  label: string;
  kind: 'booking' | 'phone' | 'email';
  external: boolean;
}

export function mailto(address: string, subject: string, body?: string): string {
  return `mailto:${address}?subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ''}`;
}

/**
 * The business's own ways to book, best first: their booking link, their phone, their email. The
 * page's main button is the first of these. Nothing here takes a booking itself.
 */
export function ways(c: EngineDemo, subject = `Enquiry from your website`): { main: Action; phone: Action | null; email: Action | null; booking: Action | null } {
  const booking: Action | null = c.contact.booking ? { href: c.contact.booking.href, label: c.contact.booking.label, kind: 'booking', external: true } : null;
  const phone: Action | null = c.contact.phone ? { href: c.contact.phone.tel, label: c.contact.phone.display, kind: 'phone', external: false } : null;
  const email: Action | null = c.contact.email ? { href: mailto(c.contact.email.address, subject), label: c.contact.email.address, kind: 'email', external: false } : null;
  const main = booking ?? (phone ? { ...phone, label: `Call ${phone.label}` } : { ...email!, label: 'Email to book' });
  return { main, phone, email, booking };
}

/** The page's colours and faces, set once on its root. The floating bar takes the accent. */
export function rootVars(c: EngineDemo): CSSProperties {
  const p = c.palette;
  return {
    '--paper': p.paper,
    '--ink': p.ink,
    '--soft': p.soft,
    '--deep': p.deep,
    '--on-deep': p.onDeep,
    '--accent': p.accent,
    '--on-accent': p.onAccent,
    '--accent-ink': p.accentInk,
    '--display': `'${c.pair.display}', ui-sans-serif, system-ui, sans-serif`,
    '--text': `'${c.pair.text}', ui-sans-serif, system-ui, sans-serif`,
    '--float-bg': p.accent,
    '--float-ink': p.onAccent,
    '--float-font': `'${c.pair.text}', system-ui, sans-serif`,
    '--float-call-bg': p.onDeep,
    '--float-call-ink': p.deep,
  } as CSSProperties;
}

/** A headline whose lines rise into view from behind their own edge. The words are read once, as one line. */
export function Lines({ lines, cls, as: Tag = 'h1', id, className }: { lines: string[]; cls: Cls; as?: 'h1' | 'h2'; id?: string; className?: string }) {
  return (
    <Tag id={id} className={className} aria-label={lines.join(' ')} style={{ '--chars': Math.max(6, ...lines.map((l) => l.length)) } as CSSProperties}>
      {lines.map((l, i) => (
        <span key={`${i}-${l}`} className={cls.line} aria-hidden="true">
          <span style={{ '--i': i } as CSSProperties}>{l}</span>
        </span>
      ))}
    </Tag>
  );
}

/** One of the page's photos, with its phone crop where it has one. */
export function Photo({ data, id, sizes, first, className, parallax }: { data: PageData; id: string; sizes: string; first?: boolean; className?: string; parallax?: boolean }) {
  const p: Picture | undefined = data.images[id];
  if (!p) return null;
  return <Pic pic={p} phone={data.images[`${id}Phone`]} sizes={sizes} first={first} low={!first} className={className} parallax={parallax} />;
}

export function Arrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path d="M6.6 3.5h3l1.5 4.2-2 1.5a12 12 0 0 0 5.7 5.7l1.5-2 4.2 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path d="M3.5 6.5h17v11h-17zM3.5 7l8.5 6.5L20.5 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

/** The main button: the business's own booking path, phone or email. */
export function Go({ action, cls, className, children }: { action: Action; cls: Cls; className?: string; children?: ReactNode }) {
  return (
    <a className={`${cls.go} ${className ?? ''}`} href={action.href} rel={action.external ? 'noopener' : undefined} data-press data-magnetic>
      <span>{children ?? action.label}</span>
      {action.kind === 'phone' ? <PhoneIcon /> : action.kind === 'email' ? <MailIcon /> : <Arrow />}
    </a>
  );
}
