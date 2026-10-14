/**
 * The arithmetic of frames held one inside the corner of the next. Each frame is `ratio` times the
 * size of the one before it and they share a bottom left corner, so zooming out by one step puts the
 * frame in view into the corner of the next. `f` is how far the zoom has gone, from 0 (the first and
 * smallest frame filling the view) to `last` (the final frame, which fills the whole stage).
 *
 * Shared by the server, which writes the first state into the page, and the client, which moves it.
 */
export interface FrameState {
  /** Scale of the frame's box. A frame is laid out at the largest size it is ever seen at, so it only ever shrinks. */
  s: number;
  /** How much of the frame's picture shows, from its corner: 1 is all of it. */
  c: number;
  /** Opacity of its caption. */
  o: number;
  /** Whether it is drawn at all. */
  on: boolean;
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const out = (t: number) => 1 - Math.pow(1 - t, 3);

export function frameState(k: number, f: number, ratio: number, last: number): FrameState {
  if (k === last) {
    // The last frame waits until the one before it has lost its caption, then opens out from the corner.
    const t = out(clamp((f - (last - 1) - 0.2) / 0.6));
    return { s: 1, c: t, o: clamp((f - (last - 1) - 0.5) / 0.4), on: f > last - 1 + 0.2 };
  }
  const s = Math.pow(ratio, k - f - 1);
  const c = k === 0 ? 1 : 1 / ratio + (1 - 1 / ratio) * out(clamp((f - (k - 1) - 0.12) / 0.5));
  const o = f <= k ? clamp(1 - (k - f) * 2.4) : clamp(1 - (f - k) * 3.4);
  return { s, c, o, on: f >= k - 1 - 0.001 };
}

/** The same state as CSS custom properties. */
export function frameVars(st: FrameState): Record<string, string> {
  return { '--s': st.s.toFixed(4), '--c': st.c.toFixed(4), '--o': st.o.toFixed(3), '--v': st.on ? 'visible' : 'hidden' };
}
