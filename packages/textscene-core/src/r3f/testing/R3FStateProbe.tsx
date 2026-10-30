/**
 * Reads the R3F store from inside a canvas, for component tests. Test-only: the `testing/`
 * directories under `src` are excluded from the build.
 */
import { useThree, type RootState } from '@react-three/fiber';

/** A probe to mount inside a canvas, and the live store state it reads. */
export function r3fStateProbe(): { Probe: () => null; state: () => RootState } {
  let get: (() => RootState) | null = null;
  function Probe(): null {
    get = useThree((s) => s.get);
    return null;
  }
  return {
    Probe,
    state: () => {
      if (!get) throw new Error('expected the probe to mount inside a canvas, got no store');
      return get();
    },
  };
}
