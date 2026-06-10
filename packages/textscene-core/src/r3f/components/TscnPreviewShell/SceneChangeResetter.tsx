/**
 * Clears all selection-derived state (selection, hover, expanded set,
 * hidden set, and the path→Object3D ref-map) whenever the active
 * `sceneGraph` reference changes between two non-null values — i.e.
 * the user picked a different fixture.
 *
 * The initial null → first-scene transition is intentionally NOT a
 * clear: there is nothing to clear yet, and firing during mount would
 * just churn React state for no observable effect. Subsequent
 * non-null → non-null transitions ARE clears: the old scene's
 * `selectedNodePath` would otherwise hang around and the
 * `SelectionHighlight` BoxHelper would render against an unmounted
 * Object3D at the prior fixture's coordinates (WI-UX-5 regression).
 *
 * Lives inside `<SelectionProvider>` so it can call `clearAll()`.
 * Renders no DOM.
 */
import { useEffect, useRef } from 'react';
import type { SceneGraph } from '../../../core/SceneGraph.js';
import { useSelection } from '../../contexts/SelectionContext.js';
import { useOptionalCameraControl } from '../../contexts/CameraControlContext.js';

export function SceneChangeResetter({ sceneGraph }: { sceneGraph: SceneGraph | null }) {
  const { clearAll } = useSelection();
  const returnToFreeView = useOptionalCameraControl()?.returnToFreeView;
  const prevSceneGraphRef = useRef<SceneGraph | null>(sceneGraph);

  useEffect(() => {
    const prev = prevSceneGraphRef.current;
    if (prev !== null && sceneGraph !== null && prev !== sceneGraph) {
      clearAll();
      // The previous scene's active Camera3D no longer exists; drop back to
      // free-orbit so CameraFit re-frames the newly loaded scene (CameraFit
      // is gated on activeCameraPath === null).
      returnToFreeView?.();
    }
    prevSceneGraphRef.current = sceneGraph;
  }, [sceneGraph, clearAll, returnToFreeView]);

  return null;
}
