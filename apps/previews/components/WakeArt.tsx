import type { CSSProperties } from 'react';

/**
 * Drawings for the wake design: a boat seen from above and from the side, trout, volcanic peaks and a
 * marina pontoon, and the geometry of a wake. Nothing here holds words or figures of a business; the
 * pieces take their places and colours from the design that uses them.
 */

export type Pt = readonly [number, number];
export type Seg = readonly [Pt, Pt, Pt, Pt];

const r1 = (n: number) => Math.round(n * 10) / 10;
const pt = (p: readonly number[]) => `${r1(p[0]!)} ${r1(p[1]!)}`;

function bez(s: Seg, t: number): [number, number] {
  const u = 1 - t;
  const [a, b, c, d] = s;
  const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] as const;
  return [k[0] * a[0] + k[1] * b[0] + k[2] * c[0] + k[3] * d[0], k[0] * a[1] + k[1] * b[1] + k[2] * c[1] + k[3] * d[1]];
}

/** Points about `step` apart along a run of curves, each with the distance travelled to it. */
function walk(segs: readonly Seg[], step: number): { p: [number, number]; s: number }[] {
  const dense: [number, number][] = [];
  segs.forEach((seg, k) => {
    for (let i = k ? 1 : 0; i <= 240; i++) dense.push(bez(seg, i / 240));
  });
  const out = [{ p: dense[0]!, s: 0 }];
  let s = 0;
  let since = 0;
  for (let i = 1; i < dense.length; i++) {
    const l = Math.hypot(dense[i]![0] - dense[i - 1]![0], dense[i]![1] - dense[i - 1]![1]);
    s += l;
    since += l;
    if (since >= step || i === dense.length - 1) {
      out.push({ p: dense[i]!, s });
      since = 0;
    }
  }
  return out;
}

export interface WakeShape {
  /** The two lines spreading from the stern, and the churned line down the middle. Each starts at the boat. */
  left: string;
  right: string;
  centre: string;
  /** Curved crests between the two lines, nearest the boat first, with how far back each lies (0 to 1). */
  arcs: { d: string; back: number }[];
  /** Where the boat sits and which way it points, in degrees. */
  boat: { x: number; y: number; deg: number };
  /** Two fishing lines trailed from the stern, ending at their lures. */
  lines: { d: string; lure: Pt }[];
  /** The far end of the wake, for a gradient that fades toward it. */
  tail: Pt;
}

/**
 * The wake left by a boat that has run along the given curves to where it now sits: the stern is at
 * the end of the curves, the bow `bow` further on. The two outer lines spread at `spread` for every
 * unit travelled back, to at most `max`.
 */
export function wake(
  segs: readonly Seg[],
  { step = 8, spread = 0.3, max = 90, beam = 9, arcEvery = 4, bow = 64, scale = 1, trail = 0 }: { step?: number; spread?: number; max?: number; beam?: number; arcEvery?: number; bow?: number; scale?: number; trail?: number } = {},
): WakeShape {
  const pts = walk(segs, step);
  const total = pts[pts.length - 1]!.s;
  const left: string[] = [];
  const right: string[] = [];
  const centre: string[] = [];
  const arcs: { d: string; back: number }[] = [];
  const at: { p: [number, number]; n: [number, number]; o: number; d: number }[] = [];
  for (let i = pts.length - 1, k = 0; i >= 0; i--, k++) {
    const a = pts[Math.max(0, i - 1)]!.p;
    const b = pts[Math.min(pts.length - 1, i + 1)]!.p;
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    const n: [number, number] = [-ty, tx];
    const d = total - pts[i]!.s;
    const o = Math.min(max, beam + spread * d);
    const [x, y] = pts[i]!.p;
    const lp = [x + n[0] * o, y + n[1] * o];
    const rp = [x - n[0] * o, y - n[1] * o];
    const cmd = k ? 'L' : 'M';
    left.push(`${cmd}${pt(lp)}`);
    right.push(`${cmd}${pt(rp)}`);
    centre.push(`${cmd}${pt([x, y])}`);
    at.push({ p: [x, y], n, o, d });
    if (k > 3 && k % arcEvery === 0) {
      const c = [x - tx * o * 0.6, y - ty * o * 0.6];
      arcs.push({ d: `M${pt(lp)}Q${pt(c)} ${pt(rp)}`, back: d / total });
    }
  }
  const end = pts[pts.length - 1]!.p;
  const before = pts[Math.max(0, pts.length - 3)]!.p;
  const rad = Math.atan2(end[1] - before[1], end[0] - before[0]);
  const boat = { x: r1(end[0] + Math.cos(rad) * bow * scale), y: r1(end[1] + Math.sin(rad) * bow * scale), deg: r1((rad * 180) / Math.PI) };

  // Lines from the two rods at the stern corners, out to lures set in the wake about `trail` back.
  const lines: { d: string; lure: Pt }[] = [];
  if (trail > 0) {
    const pick = at.reduce((best, a) => (Math.abs(a.d - trail) < Math.abs(best.d - trail) ? a : best), at[0]!);
    for (const side of [1, -1]) {
      const rod: Pt = [end[0] + (Math.cos(rad) * -22 - Math.sin(rad) * 30 * side) * scale, end[1] + (Math.sin(rad) * -22 + Math.cos(rad) * 30 * side) * scale];
      const lure: Pt = [pick.p[0] + pick.n[0] * pick.o * 0.42 * side, pick.p[1] + pick.n[1] * pick.o * 0.42 * side];
      const mid = [(rod[0] + lure[0]) / 2 + pick.n[0] * 10 * side, (rod[1] + lure[1]) / 2 + pick.n[1] * 10 * side];
      lines.push({ d: `M${pt(rod)}Q${pt(mid)} ${pt(lure)}`, lure: [r1(lure[0]), r1(lure[1])] });
    }
  }
  const first = pts[0]!.p;
  return { left: left.join(''), right: right.join(''), centre: centre.join(''), arcs, boat, lines, tail: [r1(first[0]), r1(first[1])] };
}

/** A cruiser seen from straight above, bow to the right, about 136 long and 36 wide, centred on 0 0. */
export function BoatTop({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <g className={className} style={style}>
      <path d="M-62 -16H20C44 -16 62 -7 70 0C62 7 44 16 20 16H-62Q-66 0 -62 -16Z" fill="#031327" opacity=".32" transform="translate(4 6)" />
      <path d="M-70 -13H-62V13H-70Z" fill="#c4d1e2" />
      <path d="M-62 -16H20C44 -16 62 -7 70 0C62 7 44 16 20 16H-62Q-66 0 -62 -16Z" fill="#fff" />
      <path d="M-58 -12.5H18C38 -12.5 53 -6 59 0C53 6 38 12.5 18 12.5H-58" fill="none" stroke="#d5deea" strokeWidth="1.4" />
      <rect x="-36" y="-12" width="52" height="24" rx="7" fill="#e6edf5" />
      <path d="M12 -11C20 -10 24 -5 25 0C24 5 20 10 12 11Z" fill="#0f2b52" />
      <rect x="-26" y="-4" width="20" height="8" rx="4" fill="#cbd6e4" />
      <path d="M30 0H54" stroke="#cdd8e6" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M-60 -12L-84 -28M-60 12L-84 28" stroke="#0d2342" strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

/** The same cruiser from the side, bow to the right, drawn in a 260 by 92 box with its waterline at 74. */
export function BoatSide({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 260 92" aria-hidden="true" focusable="false">
      <path d="M118 18L126 4H178L183 8" fill="none" stroke="#e8eef6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="160" y="0" width="12" height="6" rx="3" fill="#e8eef6" />
      <path d="M78 52L92 26C94 22 98 20 103 20H170C176 20 180 22 184 26L204 52Z" fill="#f4f7fb" />
      <path d="M98 30H166C170 30 173 32 176 35L186 46H90Z" fill="#0f2b52" />
      <path d="M128 30V46M152 30V46" stroke="#f4f7fb" strokeWidth="2.4" />
      <path d="M6 50H214C232 49 246 44 256 36L250 58C242 70 226 75 204 76H34C20 76 10 70 6 60Z" fill="#fff" />
      <path d="M8 66C12 72 20 76 34 76H204C222 76 236 72 244 66Z" fill="#0b1f3b" />
      <path d="M150 58C172 56 192 55 214 54L232 52C220 58 198 60 176 61C166 61 158 60 150 58Z" fill="#2f78a8" />
      <ellipse cx="96" cy="58" rx="5" ry="2.6" fill="#0f2b52" />
      <ellipse cx="114" cy="58" rx="5" ry="2.6" fill="#0f2b52" />
      <ellipse cx="132" cy="58" rx="5" ry="2.6" fill="#0f2b52" />
      <path d="M14 44H74M200 46L236 42" stroke="#dfe7f1" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 44V50M34 44V50M54 44V50M218 44V50" stroke="#dfe7f1" strokeWidth="1.6" />
      <path d="M2 54H8" stroke="#c4d1e2" strokeWidth="4" />
    </svg>
  );
}

/** A trout from the side, nose to the left, in a 220 by 80 box. `kind` sets the colouring. */
export function Trout({ kind, className, style }: { kind: 'rainbow' | 'brown'; className?: string; style?: CSSProperties }) {
  const rainbow = kind === 'rainbow';
  const back = rainbow ? '#6f9c9e' : '#8a6a3a';
  const side = rainbow ? '#cfe6e6' : '#d9b56f';
  const belly = rainbow ? '#f2f7f6' : '#f1dfae';
  const spots = rainbow
    ? [[70, 26], [92, 22], [116, 21], [140, 24], [160, 28], [104, 30], [128, 31], [80, 33], [176, 34], [196, 30], [204, 44]]
    : [[66, 28], [88, 24], [110, 23], [134, 26], [156, 30], [98, 36], [122, 38], [146, 40], [78, 40], [170, 36]];
  return (
    <svg className={className} style={style} viewBox="0 0 220 80" aria-hidden="true" focusable="false">
      <path d="M182 40L210 18C214 30 214 50 210 62Z" fill={back} />
      <path d="M100 17C108 6 122 4 130 8L128 19Z" fill={back} />
      <path d="M96 62C100 70 108 74 116 72L112 62Z" fill={back} opacity=".85" />
      <path d="M6 42C16 26 46 15 96 14C140 13 170 24 188 38C170 54 140 66 96 66C46 66 16 56 6 42Z" fill={side} />
      <path d="M6 42C16 26 46 15 96 14C140 13 170 24 188 38C150 34 112 32 72 34C40 36 20 39 6 42Z" fill={back} />
      <path d="M10 46C30 58 60 66 96 66C140 66 168 56 186 41C150 52 110 56 70 54C44 53 24 50 10 46Z" fill={belly} />
      {rainbow && <path d="M20 41C50 36 100 35 186 38C140 45 92 47 52 46C38 45 28 44 20 41Z" fill="#ff7b72" opacity=".9" />}
      {spots.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={rainbow ? 1.8 : 2.4} fill={rainbow ? '#29434a' : i % 3 === 0 ? '#c2412d' : '#4a3216'} />
      ))}
      <circle cx="24" cy="36" r="3.4" fill="#0b1f3b" />
      <circle cx="25" cy="35" r="1" fill="#fff" />
      <path d="M36 32C40 38 40 46 36 52" fill="none" stroke={back} strokeWidth="1.6" opacity=".7" />
      <path d="M50 54C58 60 66 62 70 60" fill="none" stroke={back} strokeWidth="1.4" opacity=".6" />
    </svg>
  );
}

/** Three volcanic peaks with snow on them, along the bottom of a 1440 by 320 box. */
export function Peaks({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1440 320" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <path d="M0 296L180 250L320 262L470 214L560 224L640 196L700 206L760 180L880 232L1020 216L1160 252L1300 236L1440 262V320H0Z" fill="#9db5d6" />
      <path d="M520 300L700 190C740 166 770 150 810 138L860 128C900 126 930 140 960 160L1210 300Z" fill="#5a7fb4" />
      <path d="M770 156C790 146 812 138 836 132L862 128C884 128 902 136 918 146C900 150 886 160 872 156C858 152 846 162 828 160C810 158 798 166 784 164Z" fill="#fff" />
      <path d="M220 300L380 196L412 178L432 176L456 190L600 300Z" fill="#6b8dbd" />
      <path d="M380 196L412 178L432 176L456 190C444 196 434 192 424 198C414 204 400 198 380 196Z" fill="#fff" />
      <path d="M1000 300L1110 236C1130 226 1150 222 1170 224L1210 230L1330 300Z" fill="#7a99c5" />
      <path d="M1110 236C1130 226 1150 222 1170 224L1196 228C1180 234 1166 232 1150 238C1136 242 1124 238 1110 236Z" fill="#fff" />
    </svg>
  );
}

/** A marina pontoon from above in a 1200 by 300 box: a walkway along the top and finger jetties between the berths. */
export function Pontoon({ className, mark }: { className?: string; mark: number }) {
  const fingers = Array.from({ length: 9 }, (_, i) => 60 + i * 140);
  return (
    <g className={className}>
      <rect x="-40" y="40" width="1280" height="26" rx="3" fill="#2a4a78" />
      <rect x="-40" y="40" width="1280" height="26" rx="3" fill="none" stroke="#4d6d9c" strokeWidth="1.2" />
      {fingers.map((x, i) => (
        <g key={x}>
          <rect x={x} y="66" width="12" height="150" rx="2" fill={i === mark || i === mark + 1 ? '#4fd6c6' : '#2a4a78'} />
          <circle cx={x + 6} cy="222" r="5" fill="#4d6d9c" />
        </g>
      ))}
    </g>
  );
}
