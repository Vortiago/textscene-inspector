/**
 * Reports to the host whether the viewport can capture a PNG now, through the camera
 * control the toolbar's Screenshot button uses. The host saves the image or answers an
 * agent tool with it. `ready` arrives only once the canvas has rendered the current
 * scene and the scene's resources and textures have landed, so a capture shows it whole.
 */

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useResourceLoader } from '../../../resources/useResource.js';
import { usePendingTextureWork } from '../../../resources/usePendingTextureWork.js';
import { useOptionalCameraControl } from '../../contexts/CameraControlContext.js';
import { useOptionalHierarchy } from '../../contexts/HierarchyContext.js';
import { PENDING_CAPTURE, previewCaptureStateOf, type PreviewCaptureState } from './previewCaptureState.js';

const NO_SUBSCRIPTION = () => () => {};
const NO_HANDLER = () => false;
const NO_SCENE = () => null;

/** How many resources the shell's loader still waits for, or zero outside a loader. */
function usePendingResourceCount(): number {
  const loader = useResourceLoader();
  const subscribe = useCallback(
    (listener: () => void) => (loader ? loader.subscribePending(listener) : () => {}),
    [loader]
  );
  return useSyncExternalStore(subscribe, () => loader?.pendingResourceCount ?? 0);
}

/**
 * Whether a frame now would show the current scene whole: the shell has a scene, the canvas has
 * rendered it, and no resource or texture it uses is still on its way.
 */
function useIsSceneComplete(): boolean {
  const control = useOptionalCameraControl();
  const currentScene = useOptionalHierarchy()?.sceneGraph ?? null;
  const renderedScene = useSyncExternalStore(
    control?.subscribeScreenshotHandler ?? NO_SUBSCRIPTION,
    control?.screenshotScene ?? NO_SCENE
  );
  // Every hook runs on every render, so React sees one hook order.
  const pendingResources = usePendingResourceCount();
  const pendingTextures = usePendingTextureWork();
  return (
    currentScene !== null && renderedScene === currentScene && pendingResources === 0 && pendingTextures === 0
  );
}

export function CaptureStateReporter({
  onCaptureStateChange,
  viewportError,
}: {
  onCaptureStateChange?: (state: PreviewCaptureState) => void;
  viewportError: Error | null;
}) {
  const control = useOptionalCameraControl();
  const hasHandler = useSyncExternalStore(
    control?.subscribeScreenshotHandler ?? NO_SUBSCRIPTION,
    control?.hasScreenshotHandler ?? NO_HANDLER
  );
  const takeScreenshot = control?.takeScreenshot;
  const isSceneComplete = useIsSceneComplete();

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
