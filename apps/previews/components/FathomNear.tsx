/**
 * Runs `work` once the element is close to the screen, and then only when the browser is idle, so
 * nothing a section needs is set up while the opening screen is still loading. `margin` is how far
 * below the screen counts as close, as a share of the screen's height. Returns a function that
 * cancels whatever has not run yet.
 */
export function whenNear(el: Element, work: () => (() => void) | void, margin = '80%'): () => void {
  type Idle = Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  const w = window as Idle;
  let idle = 0;
  let timer = 0;
  let undo: (() => void) | void;
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    undo = work();
  };
  const io = new IntersectionObserver(
    ([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      if (w.requestIdleCallback) idle = w.requestIdleCallback(run, { timeout: 400 });
      else timer = window.setTimeout(run, 60);
    },
    { rootMargin: `0px 0px ${margin} 0px` },
  );
  io.observe(el);
  return () => {
    done = true;
    io.disconnect();
    if (idle && w.cancelIdleCallback) w.cancelIdleCallback(idle);
    window.clearTimeout(timer);
    undo?.();
  };
}
