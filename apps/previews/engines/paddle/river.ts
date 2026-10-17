/**
 * The paddle engine's line: a river drawn through a row of points, each bend an even curve. The
 * points are placed by the engine, never read as a map: the line shows order, not distance.
 */
export function riverPoints(n: number, width = 360, height = 150, pad = 26): [number, number][] {
  if (n < 2) return [[width / 2, height / 2]];
  return Array.from({ length: n }, (_, i) => [pad + (i * (width - 2 * pad)) / (n - 1), i % 2 === 0 ? height * 0.36 : height * 0.68] as [number, number]);
}

export function riverPath(points: [number, number][], lead = 0): string {
  const [first, ...rest] = points;
  if (!first) return '';
  let d = lead ? `M${first[0] - lead} ${first[1]}L${first[0]} ${first[1]}` : `M${first[0]} ${first[1]}`;
  let [x0, y0] = first;
  for (const [x, y] of rest) {
    const dx = (x - x0) / 2;
    d += `C${(x0 + dx).toFixed(1)} ${y0.toFixed(1)} ${(x - dx).toFixed(1)} ${y.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
    [x0, y0] = [x, y];
  }
  return lead ? `${d}L${x0 + lead} ${y0}` : d;
}
