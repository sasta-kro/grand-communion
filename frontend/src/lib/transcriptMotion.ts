type ScrollArea = Pick<
  HTMLElement,
  "scrollTop" | "scrollHeight" | "clientHeight"
>;
interface AnimationClock {
  now: () => number;
  request: (step: FrameRequestCallback) => number;
  cancel: (frame: number) => void;
}
const browserClock: AnimationClock = {
  now: () => performance.now(),
  request: (step) => requestAnimationFrame(step),
  cancel: (frame) => cancelAnimationFrame(frame),
};

/** Follow measured row heights without restarting native smooth scrolling. */
export function animateTranscriptEnd(
  area: ScrollArea,
  reducedMotion: boolean,
  finished: () => void,
  clock: AnimationClock = browserClock,
) {
  const start = area.scrollTop;
  const started = clock.now();
  let frame = 0;
  let cancelled = false;
  const step = (now: number) => {
    if (cancelled) return;
    const progress = reducedMotion ? 1 : Math.min(1, (now - started) / 320);
    const target = Math.max(0, area.scrollHeight - area.clientHeight);
    area.scrollTop = start + (target - start) * (1 - Math.pow(1 - progress, 3));
    if (progress < 1) frame = clock.request(step);
    else finished();
  };
  if (reducedMotion) step(started);
  else frame = clock.request(step);
  return () => {
    cancelled = true;
    clock.cancel(frame);
  };
}
