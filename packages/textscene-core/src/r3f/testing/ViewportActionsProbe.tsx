/**
 * Reads the viewport actions from inside a provider, for component tests. Test-only: the `testing/`
 * directories under `src` are excluded from the build.
 */
import { useViewportActions, type ViewportActionsContextValue } from '../contexts/ViewportActionsContext';

/** A probe to mount under `ViewportActionsProvider`, and the actions it last read. */
export function viewportActionsProbe(): { Probe: () => null; actions: () => ViewportActionsContextValue } {
  let seen: ViewportActionsContextValue | null = null;
  function Probe(): null {
    seen = useViewportActions();
    return null;
  }
  return {
    Probe,
    actions: () => {
      if (!seen) throw new Error('expected the probe to mount under a ViewportActionsProvider, got no read');
      return seen;
    },
  };
}
