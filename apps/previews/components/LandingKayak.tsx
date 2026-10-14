/**
 * A double sea kayak seen from above, bow to the right: the hull with its keel line, two cockpits
 * with a paddler in each and their paddles across. Drawn to be read at any size from a section mark
 * to the hero. An optional sail and wake. Decoration only: hidden from a screen reader.
 */
export function Kayak({ className, sail, wake }: { className?: string; sail?: boolean; wake?: boolean }) {
  return (
    <svg className={className} viewBox="-44 -10 166 48" aria-hidden="true" focusable="false" data-kayak>
      {wake && (
        <g data-wake fill="none" stroke="currentColor" strokeLinecap="round">
          <path d="M4 11.4L-40 -2" strokeWidth="1.3" />
          <path d="M4 16.6L-40 30" strokeWidth="1.3" />
          <path d="M-6 14H-22M-30 14H-36" strokeWidth="1.1" />
        </g>
      )}
      <path data-hull d="M2 14C24 4.2 94 4.2 118 14C94 23.8 24 23.8 2 14Z" />
      <path data-keel d="M10 14C30 11.4 90 11.4 112 14" fill="none" />
      <rect data-cockpit x="37.5" y="10.2" width="16" height="7.6" rx="3.8" />
      <rect data-cockpit x="68.5" y="10.2" width="16" height="7.6" rx="3.8" />
      <g data-paddle>
        <path d="M44 1.5L49 26.5" fill="none" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M43.6 -0.5C42.4 -3.6 43.4 -7 44.8 -6.6C46 -6.2 45.8 -2.6 44.8 0Z" />
        <path d="M49.4 28.5C50.6 31.6 49.6 35 48.2 34.6C47 34.2 47.2 30.6 48.2 28Z" />
      </g>
      <g data-paddle>
        <path d="M75 1.5L80 26.5" fill="none" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M74.6 -0.5C73.4 -3.6 74.4 -7 75.8 -6.6C77 -6.2 76.8 -2.6 75.8 0Z" />
        <path d="M80.4 28.5C81.6 31.6 80.6 35 79.2 34.6C78 34.2 78.2 30.6 79.2 28Z" />
      </g>
      <circle data-head cx="47" cy="14" r="2.8" />
      <circle data-head cx="78" cy="14" r="2.8" />
      {sail && <path data-sail d="M57 14L64 -9L91 11Z" />}
    </svg>
  );
}
