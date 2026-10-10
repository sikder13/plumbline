import type { ReactNode } from 'react';
import './styles.css';

export const metadata = { title: 'Plumbline review', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="bar">
          <strong>Plumbline review</strong>
          <a href="/">Businesses</a>
          <a href="/library">Library</a>
          <a href="/ai">AI answers</a>
          <a href="/contacts">Contacts</a>
          <span className="muted">Local only. Nothing here is seen by a client.</span>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
