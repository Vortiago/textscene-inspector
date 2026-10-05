/**
 * Hands the host a function that captures the current viewport as a PNG data URL,
 * through the camera control the toolbar's Screenshot button already uses. The host
 * calls it when it saves an image or answers an agent tool. On unmount it hands over a
 * capture that answers null, so a capture posted after unmount gets no image.
 */

import { useEffect } from 'react';
import { useOptionalCameraControl } from '../../contexts/CameraControlContext.js';

export function ScreenshotRequestBridge({
  onScreenshotReady,
}: {
  onScreenshotReady?: (capture: () => string | null) => void;
}) {
  const control = useOptionalCameraControl();
  const takeScreenshot = control?.takeScreenshot;

  useEffect(() => {
    if (!onScreenshotReady || !takeScreenshot) return undefined;
    onScreenshotReady(takeScreenshot);
    return () => onScreenshotReady(() => null);
  }, [onScreenshotReady, takeScreenshot]);

  return null;
}
