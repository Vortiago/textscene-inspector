/**
 * Reports to the host whether the viewport can capture a PNG now, through the camera
 * control the toolbar's Screenshot button uses. The host saves the image or answers an
 * agent tool with it. The state follows the screenshot handler slot itself, so `ready`
 * arrives only once a canvas has a renderer to read back.
 */

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useOptionalCameraControl } from '../../contexts/CameraControlContext.js';
import { useViewportMode } from '../../contexts/ViewportModeContext.js';
import { PENDING_CAPTURE, previewCaptureStateOf, type PreviewCaptureState } from './previewCaptureState.js';

const NO_SUBSCRIPTION = () => () => {};
const NO_HANDLER = () => false;

export function CaptureStateReporter({
  onCaptureStateChange,
  viewportError,
}: {
  onCaptureStateChange?: (state: PreviewCaptureState) => void;
  viewportError: Error | null;
}) {
  const control = useOptionalCameraControl();
  const { mode } = useViewportMode();
  const hasHandler = useSyncExternalStore(
    control?.subscribeScreenshotHandler ?? NO_SUBSCRIPTION,
    control?.hasScreenshotHandler ?? NO_HANDLER
  );
  const takeScreenshot = control?.takeScreenshot;

  const state = useMemo(
    () =>
      previewCaptureStateOf({
        capture: hasHandler && takeScreenshot ? takeScreenshot : null,
        viewportError,
        mode,
      }),
    [hasHandler, takeScreenshot, viewportError, mode]
  );

  useEffect(() => {
    onCaptureStateChange?.(state);
  }, [onCaptureStateChange, state]);

  useEffect(() => {
    if (!onCaptureStateChange) return undefined;
    return () => onCaptureStateChange(PENDING_CAPTURE);
  }, [onCaptureStateChange]);

  return null;
}
