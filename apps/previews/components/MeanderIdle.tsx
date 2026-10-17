type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

/** Runs `cb` when the browser has a moment to spare, or after `timeout` ms at the latest. Returns a cancel. */
export function whenIdle(cb: () => void, timeout = 1500): () => void {
  const w = window as IdleWindow;
  if (w.requestIdleCallback && w.cancelIdleCallback) {
    const id = w.requestIdleCallback(cb, { timeout });
    return () => w.cancelIdleCallback!(id);
  }
  const id = window.setTimeout(cb, 250);
  return () => window.clearTimeout(id);
}

/**
 * Runs `cb` once `el` comes within `margin` of the screen and the browser is idle, so a section's
 * scripts do no work while the page is loading and the visitor is elsewhere. Returns a cancel.
 */
export function whenNear(el: Element, cb: () => void, margin = '100% 0px', timeout = 1500): () => void {
  let cancelIdle: (() => void) | undefined;
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      cancelIdle = whenIdle(cb, timeout);
    },
    { rootMargin: margin },
  );
  io.observe(el);
  return () => {
    io.disconnect();
    cancelIdle?.();
  };
}
