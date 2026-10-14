/**
 * Geometry for the skyline design: a profile is a list of [x, y] points, x running left to right and y
 * downwards, drawn as straight segments like an elevation chart. Shared by the page and its client parts.
 */
export type Pt = [number, number];

const n = (v: number) => Number(v.toFixed(2));

/** The height of a profile at x, read off the straight segment that spans it. */
export function yAt(points: Pt[], x: number): number {
  if (!points.length) return 0;
  if (x <= points[0]![0]) return points[0]![1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i]!;
    const [x0, y0] = points[i - 1]!;
    if (x <= x1) return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return points[points.length - 1]![1];
}

/** The line itself. */
export function linePath(points: Pt[], lift = 0): string {
  return points.map(([x, y], i) => `${i ? 'L' : 'M'}${n(x)} ${n(y - lift)}`).join('');
}

/** The ground under the line, closed down to `bottom`. */
export function areaPath(points: Pt[], bottom: number): string {
  if (!points.length) return '';
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return `${linePath(points)}L${n(last[0])} ${bottom}L${n(first[0])} ${bottom}Z`;
}

/** The part of a profile between two x positions, with the ends cut exactly at those positions. */
export function slice(points: Pt[], from: number, to: number): Pt[] {
  const inside = points.filter(([x]) => x > from && x < to);
  return [[from, yAt(points, from)], ...inside, [to, yAt(points, to)]];
}

/** Heights spread evenly across a width, as points. */
export function spread(heights: number[], width = 100): Pt[] {
  const step = heights.length > 1 ? width / (heights.length - 1) : 0;
  return heights.map((y, i) => [i * step, y]);
}
