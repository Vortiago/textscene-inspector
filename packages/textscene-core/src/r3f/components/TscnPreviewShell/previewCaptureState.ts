/**
 * Whether the viewport can capture a PNG now, as the shell reports it to its host. A host
 * holds a capture request while the state is `pending` and answers `unavailable` with its
 * reason, so it never polls the canvas or guesses how long the canvas takes to mount.
 */

import type { ViewportMode } from '../../contexts/ViewportModeContext.js';

export type PreviewCaptureState =
  /** The canvas has not created its renderer yet. */
  | { readonly status: 'pending' }
  /** `capture` renders a frame and returns it as a PNG data URL. */
  | { readonly status: 'ready'; readonly capture: () => string | null }
  /** No canvas can capture until the reason changes, so a host answers at once. */
  | { readonly status: 'unavailable'; readonly reason: string };

export const PENDING_CAPTURE: PreviewCaptureState = { status: 'pending' };

/** Only the 3D canvas registers a screenshot handler, as the toolbar's Screenshot button shows. */
const TWO_D_VIEW_REASON = 'The preview shows the 2D view, and only the 3D view can capture.';

/** The reason for a viewport whose render threw, such as a renderer with no WebGL context. */
function viewportCrashReason(error: Error): string {
  return `The viewport crashed: ${error.message}`;
}

interface CaptureInputs {
  /** The registered screenshot handler, or null before the canvas registers one. */
  readonly capture: (() => string | null) | null;
  /** The error the viewport's boundary caught, or null while the viewport renders. */
  readonly viewportError: Error | null;
  readonly mode: ViewportMode;
}

/**
 * The state the shell reports. A registered handler wins: it exists only once a renderer does. A crash comes before the
 * 2D reason, since the crash also stops a later switch to 3D from capturing.
 */
export function previewCaptureStateOf({ capture, viewportError, mode }: CaptureInputs): PreviewCaptureState {
  if (capture) return { status: 'ready', capture };
  if (viewportError) return { status: 'unavailable', reason: viewportCrashReason(viewportError) };
  if (mode === '2D') return { status: 'unavailable', reason: TWO_D_VIEW_REASON };
  return PENDING_CAPTURE;
}
