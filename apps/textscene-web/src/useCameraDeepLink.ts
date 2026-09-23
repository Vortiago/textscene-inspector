/**
 * Reads the `?camera=` deep link once at mount: a Camera3D node path as the scene tree reports
 * it (`World/Rig/Camera3D`), which the previewer looks through on open. It is never written
 * back, as it only seeds the first view. An unknown path leaves the free-orbit camera.
 */
import { useState } from 'react';

export function useCameraDeepLink(): string | null {
  const [cameraPath] = useState<string | null>(() => {
    try {
      const param = new URLSearchParams(window.location.search).get('camera');
      return param && param.trim() ? param : null;
    } catch {
      return null;
    }
  });
  return cameraPath;
}
