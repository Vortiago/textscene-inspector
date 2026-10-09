/**
 * Whether the viewport can capture a PNG now, as the shell reports it to its host. A host
 * holds a capture request while the state is `pending` and answers `unavailable` with its
 * reason, so it never polls the canvas or guesses how long the canvas takes to mount.
 */

export type PreviewCaptureState =
  /** The canvas has no renderer yet, has yet to render the current scene, or the scene still loads. */
  | { readonly status: 'pending' }
  /** `capture` renders a frame and returns it as a PNG data URL. */
  | { readonly status: 'ready'; readonly capture: () => string | null }
  /** No canvas can capture until the reason changes, so a host answers at once. */
  | { readonly status: 'unavailable'; readonly reason: string };

export const PENDING_CAPTURE: PreviewCaptureState = { status: 'pending' };

/** The reason for a viewport whose render threw, such as a renderer with no WebGL context. */
function viewportCrashReason(error: Error): string {
  return `The viewport crashed: ${error.message}`;
}

interface CaptureInputs {
  /** The registered screenshot handler, or null before the canvas registers one. */
  readonly capture: (() => string | null) | null;
  /** Whether a frame now shows the current scene whole, every resource and texture it uses landed. */
  readonly isSceneComplete: boolean;
  /** The error the viewport's boundary caught, or null while the viewport renders. */
  readonly viewportError: Error | null;
}

/**
 * The state the shell reports. A registered handler wins, since it exists only once the active view's renderer does,
 * but it waits until the scene is complete.
 */
export function previewCaptureStateOf({
  capture,
  isSceneComplete,
  viewportError,
}: CaptureInputs): PreviewCaptureState {
  if (capture) return isSceneComplete ? { status: 'ready', capture } : PENDING_CAPTURE;
  if (viewportError) return { status: 'unavailable', reason: viewportCrashReason(viewportError) };
  return PENDING_CAPTURE;
}
