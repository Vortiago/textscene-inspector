/**
 * Reports to the host whether the viewport can capture a PNG now, through the camera
 * control the toolbar's Screenshot button uses. The host saves the image or answers an
 * agent tool with it. `ready` arrives only once the canvas has rendered the current
 * scene and the scene's resources and textures have landed, so a capture shows it whole.
 */

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useOptionalViewportActions } from '../../contexts/ViewportActionsContext.js';
import { PENDING_CAPTURE, previewCaptureStateOf, type PreviewCaptureState } from './previewCaptureState.js';
import { useSceneLoad } from './useSceneLoad.js';
import { subscribeToNothing } from '../../../utils/subscribeToNothing.js';

const NO_HANDLER = () => false;

export function CaptureStateReporter({
  onCaptureStateChange,
  viewportError,
}: {
  onCaptureStateChange?: (state: PreviewCaptureState) => void;
  viewportError: Error | null;
}) {
  const control = useOptionalViewportActions();
  const hasHandler = useSyncExternalStore(
    control?.subscribeScreenshotHandler ?? subscribeToNothing,
    control?.hasScreenshotHandler ?? NO_HANDLER
  );
  const takeScreenshot = control?.takeScreenshot;
  const isSceneComplete = useSceneLoad().isComplete;

  const state = useMemo(
    () =>
      previewCaptureStateOf({
        capture: hasHandler && takeScreenshot ? takeScreenshot : null,
        isSceneComplete,
        viewportError,
      }),
    [hasHandler, takeScreenshot, isSceneComplete, viewportError]
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
