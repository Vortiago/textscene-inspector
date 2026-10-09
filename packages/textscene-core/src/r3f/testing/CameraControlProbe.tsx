/**
 * Reads the camera control from inside a provider, for component tests. Test-only: the `testing/`
 * directories under `src` are excluded from the build.
 */
import { useCameraControl, type CameraControlContextValue } from '../contexts/CameraControlContext';

/** A probe to mount under `CameraControlProvider`, and the control it last read. */
export function cameraControlProbe(): { Probe: () => null; control: () => CameraControlContextValue } {
  let seen: CameraControlContextValue | null = null;
  function Probe(): null {
    seen = useCameraControl();
    return null;
  }
  return {
    Probe,
    control: () => {
      if (!seen) throw new Error('expected the probe to mount under a CameraControlProvider, got no read');
      return seen;
    },
  };
}
