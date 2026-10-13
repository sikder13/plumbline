import { SENDER, SENDER_SITE, demoNote } from '@/lib/offer';

/** The small print that closes every demo: where its content came from, and who made it. */
export function DemoFoot({ domain }: { domain: string }) {
  return (
    <p className="demo-foot-note">
      {demoNote(domain)} Demo by{' '}
      <a href={SENDER_SITE} target="_blank" rel="noopener">
        {SENDER}
      </a>
      .
    </p>
  );
}
