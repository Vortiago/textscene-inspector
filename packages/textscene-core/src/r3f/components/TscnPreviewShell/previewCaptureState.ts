import type { ViewAnswers } from '../../viewStatus/viewAnswers.js';
import { captureWhenSettled, type ViewSettle } from './viewSettle.js';

/** A host holds a request while `pending`, so it never polls the view. */
export type PreviewCaptureState =
  /** No scene yet, or the view has not settled on the current one. */
  | { readonly status: 'pending' }
  /** `capture` waits for the view to settle again, then gives its PNG. */
  | { readonly status: 'ready'; readonly capture: () => Promise<Blob> }
  /** No view can capture until the reason changes, so a host answers at once. */
  | { readonly status: 'unavailable'; readonly reason: string };

export const PENDING_CAPTURE: PreviewCaptureState = { status: 'pending' };

interface CaptureInputs {
  /** The mounted view, or null while none is. */
  readonly view: ViewAnswers | null;
  readonly settle: ViewSettle;
  /** Whether the host has sent a scene: an empty view is never captured. */
  readonly hasScene: boolean;
  /** The error the viewport's boundary caught, or null while the viewport renders. */
  readonly viewportError: Error | null;
}

export function previewCaptureStateOf({
  view,
  settle,
  hasScene,
  viewportError,
}: CaptureInputs): PreviewCaptureState {
  if (viewportError)
    return { status: 'unavailable', reason: `The viewport crashed: ${viewportError.message}` };
  if (!view || !hasScene) return PENDING_CAPTURE;
  if (settle.status === 'failed') return { status: 'unavailable', reason: settle.reason };
  if (settle.status === 'pending') return PENDING_CAPTURE;
  return { status: 'ready', capture: () => captureWhenSettled(view) };
}
