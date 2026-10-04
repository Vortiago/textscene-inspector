/**
 * Answers a `capturePreview` once the canvas has a screenshot handler. React Three
 * Fiber mounts the canvas contents a beat after the shell posts `webviewReady`, so the
 * first attempt may find no handler. It retries on a timer, never on
 * `requestAnimationFrame`: a preview in a background editor group is not composited,
 * and its frames are paused.
 */

/** Captures the viewport as a PNG data URL, or null while no handler is registered. */
export type Capture = () => string | null;

export interface CaptureWhenReadyDeps {
  /** The handler now, which may be null before the canvas mounts. */
  readonly capture: () => Capture | null;
  readonly post: (dataUrl: string) => void;
  readonly fail: () => void;
  readonly now: () => number;
  /** Schedules one retry; the caller chooses the delay, since it owns the timer. */
  readonly schedule: (run: () => void) => void;
  readonly deadlineMs?: number;
}

const DEFAULT_DEADLINE_MS = 4000;

/** Capture now, or retry until `deadlineMs` passes and answer the failure. */
export function captureWhenReady(deps: CaptureWhenReadyDeps): void {
  const deadline = deps.now() + (deps.deadlineMs ?? DEFAULT_DEADLINE_MS);

  const attempt = (): void => {
    const dataUrl = deps.capture()?.() ?? null;
    if (dataUrl !== null) {
      deps.post(dataUrl);
      return;
    }
    if (deps.now() < deadline) {
      deps.schedule(attempt);
      return;
    }
    deps.fail();
  };

  attempt();
}
