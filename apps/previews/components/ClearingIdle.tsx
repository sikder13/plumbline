/**
 * Runs `work` once the browser has nothing more pressing to do after the page loads (or after `timeout`
 * ms at the latest), so the clearing design's scripts never add to the work of the first screen.
 * Returns a function that cancels it if it has not run yet.
 */
export function whenIdle(work: () => void, timeout = 2500): () => void {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    work();
  };
  const start = () => {
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(run, { timeout });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(run, 1200);
    return () => window.clearTimeout(t);
  };
  // Waiting for the load event first keeps hydration and the first paint's work out of the way.
  if (document.readyState === 'complete') {
    const stop = start();
    return () => {
      done = true;
      stop();
    };
  }
  let stop: (() => void) | undefined;
  const onLoad = () => {
    stop = start();
  };
  window.addEventListener('load', onLoad, { once: true });
  return () => {
    done = true;
    window.removeEventListener('load', onLoad);
    stop?.();
  };
}

/** True when the visitor has asked for reduced motion. */
export function stillWanted(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
