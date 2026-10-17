/**
 * A compass drawn as an instrument: a hairline ring, a tick every five degrees with a longer one at each
 * eighth, the four points and a needle that turns to `--aim` (set on any parent). The needle's tip is the
 * end that points. Usable from the server and from a client component; the design colours it.
 */
export interface DialClasses {
  svg?: string;
  ring?: string;
  ticks?: string;
  major?: string;
  points?: string;
  needle?: string;
  tip?: string;
  tail?: string;
  hub?: string;
}

function tickPath(major: boolean): string {
  let d = '';
  for (let i = 0; i < 72; i++) {
    const isMajor = i % 9 === 0;
    if (isMajor !== major) continue;
    const a = (i * 5 * Math.PI) / 180;
    const [r1, r2] = isMajor ? [79, 93] : [86, 93];
    const x1 = 100 + r1 * Math.sin(a);
    const y1 = 100 - r1 * Math.cos(a);
    const x2 = 100 + r2 * Math.sin(a);
    const y2 = 100 - r2 * Math.cos(a);
    d += `M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }
  return d;
}

const MINOR = tickPath(false);
const MAJOR = tickPath(true);

export function BearingDial({ points, cls, needle = true, pointsAt = 64 }: { points: string[]; cls: DialClasses; needle?: boolean; pointsAt?: number }) {
  const at = [0, 90, 180, 270];
  return (
    <svg className={cls.svg} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <circle className={cls.ring} cx="100" cy="100" r="96" pathLength={1} />
      <path className={cls.ticks} d={MINOR} />
      <path className={cls.major} d={MAJOR} />
      <g className={cls.points}>
        {points.slice(0, 4).map((p, i) => {
          const a = (at[i]! * Math.PI) / 180;
          return (
            <text key={p} x={(100 + pointsAt * Math.sin(a)).toFixed(1)} y={(100 - pointsAt * Math.cos(a)).toFixed(1)} textAnchor="middle" dominantBaseline="central">
              {p}
            </text>
          );
        })}
      </g>
      {needle && (
        <g className={cls.needle}>
          <path className={cls.tail} d="M95.5 100L100 146L104.5 100Z" />
          <path className={cls.tip} d="M95.5 100L100 30L104.5 100Z" />
          <circle className={cls.hub} cx="100" cy="100" r="5" />
        </g>
      )}
    </svg>
  );
}
