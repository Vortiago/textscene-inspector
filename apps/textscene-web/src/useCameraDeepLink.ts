/**
 * useCameraDeepLink — reads the `?camera=` deep-link once at mount.
 *
 * The value is a Camera3D node path (as the scene tree reports it, e.g.
 * `Camera3D` or `World/Rig/Camera3D`); the previewer looks through that camera
 * on open instead of the free-orbit editor camera. Read-only: unlike
 * `?fixture=`, it is never written back — it seeds the initial view, and the
 * usual camera controls (the Cameras panel, Reset) take over from there. An
 * unknown path resolves to nothing and simply leaves the free-orbit camera.
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
