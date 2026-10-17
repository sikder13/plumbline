'use client';

import { useEffect, useState } from 'react';

/** The two edges of the valley floor, from the coast at the left to the head of the valley at the right. */
const upperEdge = (x: number) => 186 + x * 0.034 + Math.sin(x / 74) * 9 + Math.sin(x / 23) * 3;
const lowerEdge = (x: number) => 338 - x * 0.05 + Math.sin(x / 61 + 1) * 10 + Math.sin(x / 19) * 3;

function line(f: (x: number) => number, from = -10, to = 1010, step = 12): string {
  let d = '';
  for (let x = from; step > 0 ? x <= to : x >= to; x += step) d += `${d ? 'L' : 'M'}${x.toFixed(0)} ${f(x).toFixed(1)}`;
  return d;
}

/**
 * A glacier valley drawn as a map seen from above: contour lines up both walls, bush on the lower slopes,
 * the braided river on the valley floor and the glacier filling the head of the valley. A track runs up the
 * valley floor; the part on the ice, the closed mark where it stops and the new trails to lookouts are
 * drawn and taken away by the step of the story the visitor has reached. Decoration: the story is told in
 * words beside it. Before the script arrives the frame stands empty at its size.
 */
export function AfootValley({ className }: { className?: string }) {
  // The drawing is worked out in the browser once the page is up: it sits below the first screen, and drawn on the server it would travel twice, as markup and as page data.
  const [shown, setShown] = useState(false);
  useEffect(() => setShown(true), []);
  if (!shown) return <svg className={className} viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" />;
  const up: string[] = [];
  const down: string[] = [];
  for (let k = 1; k <= 14; k++) {
    const gap = k * 15 + k * k * 0.35;
    up.push(line((x) => upperEdge(x) - gap + Math.sin(x / 57 + k * 0.7) * k * 0.9));
    down.push(line((x) => lowerEdge(x) + gap + Math.sin(x / 49 + k * 0.9) * k * 0.9));
  }
  const floor = `${line(upperEdge, -10, 660)}${line(lowerEdge, 660, -10, -12).replace('M', 'L')}Z`;
  const bushUp = `${line(upperEdge, -10, 700)}${line((x) => upperEdge(x) - 62 + Math.sin(x / 40) * 6, 700, -10, -12).replace('M', 'L')}Z`;
  const bushDown = `${line(lowerEdge, -10, 700)}${line((x) => lowerEdge(x) + 62 + Math.sin(x / 37) * 6, 700, -10, -12).replace('M', 'L')}Z`;
  const ogives: string[] = [];
  for (let x = 690; x <= 1000; x += 26) {
    const t = upperEdge(x) - (x - 640) * 0.16 + 10;
    const b = lowerEdge(x) + (x - 640) * 0.1 - 10;
    ogives.push(`M${x} ${t.toFixed(0)}Q${x - 20} ${((t + b) / 2).toFixed(0)} ${x} ${b.toFixed(0)}`);
  }
  return (
    <svg className={className} viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <path data-bush d={bushUp} />
      <path data-bush d={bushDown} />
      <g data-contours>
        {[...up, ...down].map((d, i) => (
          <path key={i} d={d} data-index={i % 14 === 4 || i % 14 === 9 ? '' : undefined} />
        ))}
      </g>
      <path data-floor d={floor} />
      <path data-river d="M0 268 C120 262 220 276 330 266 S520 252 640 258M0 284 C140 280 260 290 380 278 S560 266 640 260M60 252 C180 250 300 258 420 254 S580 248 640 256" />
      <path data-ice d={`M640 258 C652 ${upperEdge(660) - 6} 690 ${upperEdge(700) - 14} 740 ${upperEdge(740) - 22} L1010 ${upperEdge(1010) - 70} L1010 ${lowerEdge(1010) + 40} L740 ${lowerEdge(740) + 12} C690 ${lowerEdge(700) + 6} 652 ${lowerEdge(660) + 2} 640 258Z`} />
      <path data-crevasse d={ogives.join('')} />
      <path data-trail="floor" pathLength={1} d="M-10 296 C120 292 230 282 330 270 C430 258 540 262 640 258" />
      <path data-trail="ice" pathLength={1} d="M640 258 C690 252 730 246 780 242 C840 238 900 236 960 232" />
      <path data-closed-trail d="M640 258 C690 252 730 246 780 242 C840 238 900 236 960 232" />
      <path data-trail="new" pathLength={1} d="M300 272 L318 246 L298 222 L324 198 L306 174 L332 150" />
      <path data-trail="new" pathLength={1} d="M470 262 L490 290 L468 314 L494 338 L478 362 L504 384" />
      <path data-trail="new" pathLength={1} d="M540 262 C570 262 590 262 610 262" />
      <g data-closed transform="translate(640 258)">
        <circle r="13" />
        <path d="M-6 -6 6 6M6 -6-6 6" />
      </g>
      <g data-lookouts>
        <path d="M332 136l11 18h-22Z" />
        <path d="M504 370l11 18h-22Z" />
        <path d="M612 248l11 18h-22Z" />
      </g>
    </svg>
  );
}

